-- Per-department notification settings: which emails/phones get alerted
-- when new requests come in for that department.

create table notification_settings (
  id              uuid primary key default gen_random_uuid(),
  department      text not null unique check (department in ('service','parts','messages','storage','sales','general')),
  email_recipients text[] not null default '{}',
  sms_recipients   text[] not null default '{}',
  email_enabled    boolean not null default true,
  sms_enabled      boolean not null default false,
  updated_at       timestamptz not null default now()
);

-- Seed one row per department so the settings page always has rows to edit
insert into notification_settings (department) values
  ('service'),
  ('parts'),
  ('messages'),
  ('storage'),
  ('sales'),
  ('general')
on conflict (department) do nothing;

-- Only staff can read/write notification settings
alter table notification_settings enable row level security;

create policy "staff read notification settings" on notification_settings
  for select using (public.is_staff());

create policy "staff update notification settings" on notification_settings
  for update using (public.is_staff()) with check (public.is_staff());
