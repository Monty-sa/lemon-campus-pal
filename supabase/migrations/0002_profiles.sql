-- LEMON-010E: user profiles with case-insensitive unique usernames and owner-only RLS.
-- Preserves existing schedules and auth users without data loss.

create table if not exists public.profiles (
  id uuid not null references auth.users (id) on delete cascade primary key,
  username text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 30),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 60)
);

comment on table public.profiles is 'User profiles with public display name and handle. Never stores private emails.';
comment on column public.profiles.id is 'Matches auth.users(id). Profile ownership cannot be changed.';
comment on column public.profiles.username is 'Unique case-insensitive handle (3-30 chars, alphanumeric and underscore).';
comment on column public.profiles.display_name is 'Public display name (1-60 chars).';

-- Case-insensitive uniqueness for usernames
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Trigger to maintain updated_at and prevent client modification of created_at
create or replace function public.profiles_touch_updated_at()
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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.profiles_touch_updated_at();

-- Trigger to auto-create safe profile on new user signup (email or OAuth)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  default_name text;
  default_user text;
  clean_prefix text;
begin
  -- Derive safe default display name
  default_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(split_part(new.email, '@', 1)), ''),
    'Student'
  );
  if char_length(default_name) > 60 then
    default_name := substr(default_name, 1, 60);
  end if;

  -- Derive safe default username (alphanumeric, unique fallback)
  clean_prefix := regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(clean_prefix) < 3 then
    clean_prefix := 'user';
  end if;
  default_user := substr(clean_prefix, 1, 20) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  if char_length(default_user) > 30 then
    default_user := substr(default_user, 1, 30);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, default_user, default_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-destructive backfill for existing auth users
insert into public.profiles (id, username, display_name)
select
  id,
  substr(coalesce(nullif(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'user'), 1, 20) || '_' || substr(replace(id::text, '-', ''), 1, 6),
  coalesce(
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''),
    nullif(trim(split_part(email, '@', 1)), ''),
    'Student'
  )
from auth.users
on conflict (id) do nothing;

-- Owner-only RLS
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
