-- LEMON-010A: optional Supabase auth and private per-user schedule storage.
-- Apply with the Supabase CLI or the SQL editor after creating a project.

-- Keep array validation inside an immutable helper so the table CHECK can use it.
create or replace function public.schedules_section_ids_valid(ids text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select cardinality(ids) <= 100
    and cardinality(ids) = (select count(distinct item) from unnest(ids) as item)
    and not exists (
      select 1
      from unnest(ids) as item
      where item is null or char_length(item) < 1 or char_length(item) > 128
    );
$$;

create table if not exists public.schedules (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  term_id text not null,
  section_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_pkey primary key (user_id, id),
  constraint schedules_id_length check (char_length(id) between 1 and 128),
  constraint schedules_name_length check (char_length(name) between 1 and 120),
  constraint schedules_term_id_length check (char_length(term_id) between 1 and 64),
  constraint schedules_section_ids_valid check (public.schedules_section_ids_valid(section_ids))
);

comment on table public.schedules is 'Private user-owned LEMON schedule plans. Guest plans never leave local storage.';
comment on column public.schedules.user_id is 'Derived from auth.uid(); never accepted from browser input.';
comment on column public.schedules.id is 'Client plan ID scoped to the owner. The composite primary key makes upserts idempotent.';
comment on column public.schedules.section_ids is 'Opaque KFU section IDs; no offering data is duplicated here.';
comment on column public.schedules.created_at is 'Server-controlled first-sync timestamp.';
comment on column public.schedules.updated_at is 'Server-controlled last-write timestamp used for last-write-wins merge.';

-- Server controls timestamps and keeps created_at immutable on update.
create or replace function public.schedules_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists schedules_touch_updated_at on public.schedules;
create trigger schedules_touch_updated_at
before update on public.schedules
for each row execute function public.schedules_touch_updated_at();

create index if not exists schedules_user_updated_idx
  on public.schedules (user_id, updated_at desc);

-- Owner-only RLS. Service-role access is server-only and bypasses RLS.
alter table public.schedules enable row level security;
alter table public.schedules force row level security;

-- Remove default access from anonymous and PUBLIC roles before granting to users.
revoke all on table public.schedules from public;
revoke all on table public.schedules from anon;
grant select, insert, update, delete on table public.schedules to authenticated;

drop policy if exists "schedules_select_own" on public.schedules;
create policy "schedules_select_own"
  on public.schedules for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "schedules_insert_own" on public.schedules;
create policy "schedules_insert_own"
  on public.schedules for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "schedules_update_own" on public.schedules;
create policy "schedules_update_own"
  on public.schedules for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "schedules_delete_own" on public.schedules;
create policy "schedules_delete_own"
  on public.schedules for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Deleting the auth user cascades to schedules. Account deletion must run on the
-- server with a verified session and must never expose the service-role key.
