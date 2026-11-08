# Auth and private cloud storage

## Status

LEMON-010A added the database and migration foundation. LEMON-010B added optional
Supabase email authentication and private cloud schedule sync. LEMON-010D added
Google OAuth ("Continue with Google") via Supabase `signInWithOAuth`. LEMON-010E
adds user profiles with case-insensitive unique usernames, public display names,
and an Account Settings dialog. Guest mode, local plans, and security boundaries remain intact.

The implementation contains:

- `src/lib/cloud/config.ts` — validates Supabase URL and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `src/lib/cloud/client.ts` & `src/lib/cloud/server.ts` — `@supabase/ssr` browser and cookie-based server clients.
- `src/lib/cloud/auth.ts` — email signup/login, Google OAuth, password reset, and session verification.
- `src/lib/cloud/profiles.ts` — profile validation, username/display name constraints, and profile updates.
- `src/lib/cloud/schedules.ts` — plan validation, row mapping, limits, and `SupabaseScheduleStore`.
- `src/lib/cloud/sync.ts` — guest plan preservation, login merge sync, and logout restoration.
- `src/app/auth/callback/route.ts` — server-side auth callback exchanging auth codes for sessions and handling OAuth errors.
- `src/components/planner.tsx` — accessible auth modal, Account Settings dialog, account pill with `@username`, and cloud sync status.
- `supabase/migrations/0001_schedules.sql` — schedules table, constraints, trigger, grants, and owner-only RLS.
- `supabase/migrations/0002_profiles.sql` — profiles table, case-insensitive unique index, auto-creation trigger, backfill, and owner-only RLS.
- `supabase/migrations/0003_admin.sql` — administrator allowlist table with restrictive RLS and bootstrap documentation.
- `src/lib/cloud/admin.ts` — server-enforced admin verification, privileged client initialization, and aggregated metrics.
- `src/lib/explorer-filters.ts` — advanced course explorer filtering engine with day matching/avoiding and cascading selectors.
- `src/app/admin/page.tsx` & `src/app/api/admin/metrics/route.ts` — protected admin dashboard and JSON endpoint.

## Environment

Copy `.env.example` to `.env.local` and set both public values (using either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), or leave both unset:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<public anon or publishable key>
```

Rules enforced by `readSupabaseConfig`:

- Both values must be present together. Partial configuration fails fast rather
  than silently falling back to guest mode.
- The URL must be a valid URL.
- A `sb_secret_...` key or a JWT whose `role` is `service_role` is rejected in
  the public environment.

`SUPABASE_SERVICE_ROLE_KEY`, when it is eventually needed, is server-only. Never
prefix it with `NEXT_PUBLIC_` and never import it into client components.

## Data model

`public.schedules` stores one row per owned plan:

| Column | Notes |
| --- | --- |
| `user_id` | `uuid` FK to `auth.users(id)` with `on delete cascade`. Always derived from `auth.uid()`. |
| `id` | Text plan ID, scoped to the owner. Composite primary key `(user_id, id)`. |
| `name` | 1–120 characters. |
| `term_id` | 1–64 characters. |
| `section_ids` | Up to 100 unique, non-empty KFU section IDs. |
| `created_at` | Server-controlled first-sync timestamp. Immutable on update. |
| `updated_at` | Server-controlled last-write timestamp, refreshed by trigger. |

Offering data is not duplicated in the cloud table. Only opaque section IDs are
stored; the bundled snapshot remains the source for names, times, and credits.

`public.profiles` stores user account details:

| Column | Notes |
| --- | --- |
| `id` | `uuid` primary key matching `auth.users(id)` with `on delete cascade`. Profile ownership cannot be changed. |
| `username` | 3–30 characters, alphanumeric and underscore (`^[a-zA-Z0-9_]{3,30}$`). Unique case-insensitive. |
| `display_name` | 1–60 characters. Safe defaults on signup/Google OAuth. |
| `created_at` | Server-controlled creation timestamp. Immutable on update. |
| `updated_at` | Server-controlled last-write timestamp, refreshed by trigger. |

Private email addresses are never stored in `public.profiles` and remain securely in `auth.users`.

`public.app_admins` stores administrator authorization records:

| Column | Notes |
| --- | --- |
| `user_id` | `uuid` primary key referencing `auth.users(id)` with `on delete cascade`. |
| `created_at` | Server-controlled creation timestamp. |

RLS strictly allows users to query their own admin status (`auth.uid() = user_id`) and permits verified admins to view the allowlist. No direct client-side insert, update, or deletion is permitted.

### One-Time Admin Bootstrap Procedure

Admin privileges are never inferred from email addresses or automatically granted. To grant admin access to a verified user:

1. Obtain the user's UUID from the Supabase Dashboard (`Authentication -> Users`).
2. Run the following statement in Supabase SQL Editor:

```sql
insert into public.app_admins (user_id)
values ('<VERIFIED_USER_UUID>')
on conflict (user_id) do nothing;
```

To revoke admin access:
```sql
delete from public.app_admins where user_id = '<VERIFIED_USER_UUID>';
```

## Security model

- **Owner-only RLS.** Select, insert, update, and delete policies all require
  `auth.uid() = user_id` (or `auth.uid() = id` on `profiles`). Update policies also check the new owner ID, so a row
  cannot be moved to another owner.
- **No anonymous access.** Table privileges on both `schedules` and `profiles` are revoked from `PUBLIC` and
  `anon`; only `authenticated` receives permissions.
- **Forced RLS.** `force row level security` prevents the table owner from
  accidentally bypassing policies outside an explicit superuser/service path.
- **No profile ownership changes.** `profiles_update_own` validates `with check ((select auth.uid()) = id)`.
- **Private email protection.** `public.profiles` deliberately excludes email; emails remain private to the user session.
- **Service role is server-only.** The service key bypasses RLS and must only be
  used in a server route for account deletion or other privileged operations.
- **No browser-supplied user IDs.** Application code must derive the user from
  the verified session. The `CloudScheduleStore` contract is deliberately
  session-bound and does not accept a `userId` argument.
- **Validation before writes.** `CloudPlanSchema` and `CloudScheduleInsertSchema`
  reject blank or oversized fields, duplicate section IDs, too many sections,
  and invalid timestamps. The insert schema strips nothing: it is strict, so a
  timestamp or unexpected column is a programming error.

## Session handling requirements

When auth is wired:

1. Use `@supabase/ssr` with the cookie-based browser and server clients. Keep
   cookies `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
2. Use PKCE and the SSR cookie adapter. Do not store access or refresh tokens in
   `localStorage`.
3. Authorize on the server with `supabase.auth.getUser()`, which validates the
   token with the Auth server. Do not use `getSession()` alone for authorization.
4. Refresh sessions in middleware and pass updated cookies to the response.
5. Keep auth callbacks and account-sensitive routes same-origin and POST-only
   where they change state.
6. Never trust a client-provided user ID, email, role, or plan owner.

## Logout requirements

- Call `supabase.auth.signOut({ scope: "global" })` to revoke refresh tokens on
  all devices, or `scope: "local"` for this device only.
- Clear the SSR auth cookies and any in-memory/query-cached cloud plans.
- Reload guest plans from local storage. Do **not** delete guest plans on logout.
- If sign-out fails, clear the local session state anyway and show a retry
  option; do not leave privileged UI visible.

## Account deletion requirements

Account deletion is destructive and must be a deliberate server operation:

1. Require a verified session. Derive the user ID from the session, never from
   the request body.
2. Require explicit confirmation (for example, typing `DELETE`) plus a clear
   warning that all cloud plans will be removed.
3. On the server, use a service-role admin client and call
   `auth.admin.deleteUser(user.id)`. The `on delete cascade` foreign key removes
   all `public.schedules` rows.
4. Clear local cloud caches after success. Guest plans remain untouched.
5. Return a generic error and log server-side details; never leak whether an
   arbitrary email exists.
6. Never expose the service-role key to the browser or bundle.

## Local-to-cloud migration

`planCloudMigration(localPlans, cloudRows, mode)` returns the authoritative plan
list, idempotent upserts, and optional deletes.

- **Merge is the default and is non-destructive.** Local-only and cloud-only
  plans are both kept. For duplicate IDs, the newest `updatedAt` wins. When
  timestamps tie and content differs, local content wins and is upserted.
- **Replace is explicit and destructive.** Local plans overwrite the cloud set
  and cloud-only IDs are returned in `deletes`. Require a separate confirmation
  before using it.
- **Keep local data until the write succeeds.** Apply `upserts` and `deletes`
  first; only then persist the merged list locally.
- **Upsert idempotently.** Use `on conflict (user_id, id) do update`; never
  insert duplicate rows.
- **Respect limits.** Exceeding 100 plans throws instead of dropping data.
- **Cloud timestamps are server write times.** They are refreshed by the
  database trigger, so a later local edit still wins on the next sync. Clock
  skew is best-effort; the server timestamp is authoritative for cloud rows.

## Applying the schema

Migrations are applied to your Supabase project in order:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or execute `supabase/migrations/0001_schedules.sql`, `supabase/migrations/0002_profiles.sql`, and `supabase/migrations/0003_admin.sql` in the Supabase SQL editor. The migrations are non-destructive and preserve existing users and schedules.

## Verification status

- **Anonymous table access:** Verified live. Anonymous queries against `public.schedules` return PostgreSQL permission denied (`42501`) as enforced by schema grants and RLS.
- **Cross-user isolation:** Explicitly marked **unverified** against the live project. The active Supabase project enforces email confirmation before issuing valid auth sessions, which blocks automated cross-user session generation without out-of-band email verification or server admin keys.
- **Unit & component test coverage:** Verified with 111 passing tests across configuration, schemas, store, auth operations, profiles, admin authorization, explorer filters, guest preservation, sync merging, Google OAuth, and UI dialogs.

## Exact next setup action

Execute `supabase/migrations/0003_admin.sql` in the Supabase SQL Editor (or via `supabase db push`) to create the `app_admins` allowlist table and RLS policies, then bootstrap an initial administrator using their verified Supabase Auth user UUID.
