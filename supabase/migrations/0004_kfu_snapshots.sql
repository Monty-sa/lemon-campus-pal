-- LEMON-015: Automated KFU Section Monitoring
-- Schema for storing verified course snapshots and section change histories.
-- Restricted write access (server-side service role only).

create table if not exists public.kfu_snapshots (
  id uuid primary key default gen_random_uuid(),
  term_id text not null,
  college_code text not null,
  category_code text not null check (category_code in ('11', '12')),
  source_url text not null,
  snapshot_data jsonb not null,
  raw_hash text not null,
  course_count integer not null check (course_count >= 0),
  section_count integer not null check (section_count >= 0),
  validation_status text not null check (validation_status in ('valid', 'warning', 'invalid')),
  validation_warnings text[] not null default '{}'::text[],
  fetched_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  is_active boolean not null default true
);

comment on table public.kfu_snapshots is 'Validated course and section snapshots imported from KFU. Read-only for clients, managed by server refresh pipeline.';
comment on column public.kfu_snapshots.snapshot_data is 'Full DataImport payload conforming to DataImportSchema.';
comment on column public.kfu_snapshots.is_active is 'Flag indicating the active published snapshot for the given term and category.';

create index if not exists kfu_snapshots_active_idx
  on public.kfu_snapshots (term_id, category_code, is_active, published_at desc);

create table if not exists public.kfu_section_changes (
  id uuid primary key default gen_random_uuid(),
  term_id text not null,
  category_code text not null check (category_code in ('11', '12')),
  crn text not null,
  course_code text not null,
  change_type text not null check (change_type in ('added', 'cancelled', 'availability_changed', 'schedule_changed', 'instructor_changed')),
  old_val jsonb,
  new_val jsonb,
  detected_at timestamptz not null default now()
);

comment on table public.kfu_section_changes is 'Granular change log between validated snapshots. Powers section change alerts and notifications.';

create index if not exists kfu_section_changes_crn_idx
  on public.kfu_section_changes (crn, detected_at desc);

create index if not exists kfu_section_changes_term_cat_idx
  on public.kfu_section_changes (term_id, category_code, detected_at desc);

-- Row Level Security
alter table public.kfu_snapshots enable row level security;
alter table public.kfu_snapshots force row level security;

alter table public.kfu_section_changes enable row level security;
alter table public.kfu_section_changes force row level security;

-- Client permissions: Read-only access for authenticated and anonymous users
revoke all on table public.kfu_snapshots from public;
revoke all on table public.kfu_snapshots from anon;
grant select on table public.kfu_snapshots to anon, authenticated;

revoke all on table public.kfu_section_changes from public;
revoke all on table public.kfu_section_changes from anon;
grant select on table public.kfu_section_changes to anon, authenticated;

-- Policies: Clients can view active snapshots and verified change records
drop policy if exists "Clients can read active snapshots" on public.kfu_snapshots;
create policy "Clients can read active snapshots"
  on public.kfu_snapshots for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Clients can read section changes" on public.kfu_section_changes;
create policy "Clients can read section changes"
  on public.kfu_section_changes for select
  to anon, authenticated
  using (true);

-- No public INSERT, UPDATE, or DELETE policies exist.
-- Only the service_role key (server-only) can insert or update snapshots.
