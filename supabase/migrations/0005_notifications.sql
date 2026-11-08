-- LEMON-016: Section Change Notifications & Push Subscriptions
-- Supports opt-in Web Push and in-app notification center for guest and signed-in users.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  subscribed_crns text[] not null default '{}'::text[],
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '07:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_device_endpoint_unique unique (device_id, endpoint),
  constraint push_subscriptions_device_id_len check (char_length(device_id) between 10 and 128)
);

comment on table public.push_subscriptions is 'Securely stored Web Push subscriptions supporting multi-device authenticated users and anonymous guest device tokens.';

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_device_idx on public.push_subscriptions (device_id);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null,
  crn text not null,
  title text not null,
  body text not null,
  change_type text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_device_id_len check (char_length(device_id) between 10 and 128)
);

comment on table public.user_notifications is 'In-app notification records for verified section and timetable changes.';

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, read_at, created_at desc);
create index if not exists user_notifications_device_unread_idx
  on public.user_notifications (device_id, read_at, created_at desc);

-- Row Level Security
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

alter table public.user_notifications enable row level security;
alter table public.user_notifications force row level security;

revoke all on table public.push_subscriptions from public;
revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to anon, authenticated;

revoke all on table public.user_notifications from public;
revoke all on table public.user_notifications from anon;
grant select, update on table public.user_notifications to anon, authenticated;

-- Policies for Authenticated Users
drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id or user_id is null)
  with check ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "Users view their own notifications" on public.user_notifications;
create policy "Users view their own notifications"
  on public.user_notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users update their own notifications" on public.user_notifications;
create policy "Users update their own notifications"
  on public.user_notifications
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Policies for Anonymous Guests (scoped by device_id)
drop policy if exists "Guests insert push subscriptions with device_id" on public.push_subscriptions;
create policy "Guests insert push subscriptions with device_id"
  on public.push_subscriptions
  for insert
  to anon
  with check (user_id is null and char_length(device_id) >= 10);

drop policy if exists "Guests read notifications by device_id" on public.user_notifications;
create policy "Guests read notifications by device_id"
  on public.user_notifications
  for select
  to anon
  using (user_id is null);
