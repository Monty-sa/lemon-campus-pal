-- Release privacy corrections. Apply only through the approved migration process.
-- A policy on app_admins cannot query app_admins again without recursive RLS.
drop policy if exists "Admins can view admin allowlist" on public.app_admins;

-- Device IDs are caller-controlled and cannot authorize access to private rows.
-- Guest notifications remain local until a server-verifiable device credential exists.
drop policy if exists "Guests insert push subscriptions with device_id" on public.push_subscriptions;
drop policy if exists "Guests read notifications by device_id" on public.user_notifications;
drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.push_subscriptions from anon;
revoke all on table public.user_notifications from anon;
