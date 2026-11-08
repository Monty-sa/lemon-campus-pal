-- LEMON-010F: Server-enforced Admin Authorization Allowlist
-- Dedicated table with restrictive RLS for administrator roles.
-- Never automatically grants admin or infers identity from email.

create table if not exists public.app_admins (
  user_id uuid not null references auth.users (id) on delete cascade primary key,
  created_at timestamptz not null default now()
);

comment on table public.app_admins is 'Dedicated administrator allowlist table. Managed exclusively via server-enforced role checks or SQL bootstrap.';
comment on column public.app_admins.user_id is 'Verified user UUID from auth.users. Cannot be forged or self-assigned.';

-- Enable Row Level Security
alter table public.app_admins enable row level security;

-- Drop any prior policies
drop policy if exists "Users can check their own admin role" on public.app_admins;
drop policy if exists "Admins can view admin allowlist" on public.app_admins;

-- Restrictive RLS: Authenticated users can only query their own admin row.
-- Anonymous access is completely denied.
create policy "Users can check their own admin role"
  on public.app_admins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Restrictive RLS: Authenticated admins can view the allowlist
create policy "Admins can view admin allowlist"
  on public.app_admins
  for select
  to authenticated
  using (
    exists (
      select 1 from public.app_admins as self
      where self.user_id = (select auth.uid())
    )
  );

-- No public or client-side INSERT, UPDATE, or DELETE policies.
-- Modifications require superuser / service_role privileges or direct SQL execution.

-- ============================================================================
-- ONE-TIME ADMIN BOOTSTRAP PROCEDURE
-- ============================================================================
-- Step 1: In the Supabase Dashboard -> Authentication -> Users, find the user's
--         verified UUID (e.g. '01234567-89ab-cdef-0123-456789abcdef').
--
-- Step 2: In Supabase SQL Editor, run the following statement:
--
-- insert into public.app_admins (user_id)
-- values ('<VERIFIED_USER_UUID>')
-- on conflict (user_id) do nothing;
--
-- To revoke admin privileges:
-- delete from public.app_admins where user_id = '<VERIFIED_USER_UUID>';
-- ============================================================================
