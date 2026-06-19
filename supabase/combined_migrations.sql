-- Combined migrations 0001-0005, generated for one-shot paste into the Supabase SQL editor.
-- Source of truth is still the individual files in supabase/migrations/ — regenerate this
-- if those change. Safe to run once against a brand-new Supabase project.

-- ============================================================
-- migrations/0001_init_identity_and_locations.sql
-- ============================================================
-- M0: identity, business accounts (My Garage ownership root), staff roles, dealership locations.
-- Run via Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor for a new project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'customer' check (account_type in ('customer', 'staff')),
  full_name text,
  phone text,
  avatar_url text,
  notification_prefs jsonb not null default '{
    "push_enabled": true,
    "sms_enabled": true,
    "email_enabled": true,
    "marketing_sms_opt_in": false,
    "marketing_email_opt_in": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- dealership_locations
-- ---------------------------------------------------------------------------
create table dealership_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  after_hours_phone text,
  latitude double precision,
  longitude double precision,
  hours jsonb,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- business_accounts (the farm/business equipment belongs to)
-- ---------------------------------------------------------------------------
create table business_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_location_id uuid references dealership_locations(id),
  tax_exempt_cert_url text,
  tax_exempt_status text,
  jd_financial_account_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_account_members (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'operator')),
  invited_by uuid references profiles(id),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  unique (business_account_id, profile_id)
);

create index business_account_members_profile_idx on business_account_members (profile_id);

-- ---------------------------------------------------------------------------
-- staff_roles
-- ---------------------------------------------------------------------------
create table staff_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  department text not null check (department in ('sales', 'parts', 'service', 'office', 'manager')),
  dealership_location_id uuid references dealership_locations(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index staff_roles_profile_idx on staff_roles (profile_id);

-- ---------------------------------------------------------------------------
-- Helper functions (used throughout this and later migrations' RLS policies)
-- ---------------------------------------------------------------------------

-- True if the current JWT belongs to an active staff member (any department).
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_roles sr
    where sr.profile_id = auth.uid() and sr.is_active
  );
$$;

-- True if the current JWT belongs to an active staff manager (sees everything).
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_roles sr
    where sr.profile_id = auth.uid() and sr.is_active and sr.department = 'manager'
  );
$$;

-- The current user's role on a given business account, or null if not a member.
create function public.business_account_role(target_business_account_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from business_account_members
  where business_account_id = target_business_account_id
    and profile_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- New auth.users -> profiles trigger.
-- Public sign-up (no account_type in raw_user_meta_data) creates a `customer`
-- profile plus a solo business_account they own. Staff accounts are created
-- separately by a manager via the admin app's service-role API, which passes
-- raw_user_meta_data.account_type = 'staff' to auth.admin.createUser() — for
-- those, this trigger only creates the profiles row; the caller inserts the
-- matching staff_roles row itself.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_account_id uuid;
  new_full_name text;
  new_account_type text;
begin
  new_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  new_account_type := coalesce(new.raw_user_meta_data->>'account_type', 'customer');

  insert into public.profiles (id, account_type, full_name)
  values (new.id, new_account_type, new_full_name)
  on conflict (id) do nothing;

  if new_account_type = 'customer' then
    insert into public.business_accounts (name)
    values (new_full_name || '''s Account')
    returning id into new_business_account_id;

    insert into public.business_account_members (business_account_id, profile_id, role, status)
    values (new_business_account_id, new.id, 'owner', 'active');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook — stamps account_type onto the JWT's app_metadata
-- so apps/admin's proxy.ts (and any RLS policy) can check it without an extra
-- round trip. MUST be wired up manually after running this migration:
-- Supabase Dashboard -> Authentication -> Hooks -> Custom Access Token ->
-- select "custom_access_token_hook". (Not configurable via SQL alone.)
-- ---------------------------------------------------------------------------
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_account_type text;
begin
  select account_type into user_account_type
  from public.profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(claims, '{app_metadata, account_type}', to_jsonb(coalesce(user_account_type, 'customer')));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table dealership_locations enable row level security;
alter table business_accounts enable row level security;
alter table business_account_members enable row level security;
alter table staff_roles enable row level security;

-- profiles: read your own row; staff can read every profile (needed for admin + messaging).
create policy "read own profile" on profiles for select
  using (id = auth.uid() or public.is_staff());
create policy "update own profile" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- dealership_locations: any authenticated user reads active locations; managers manage them.
create policy "read active locations" on dealership_locations for select
  using (is_active or public.is_manager());
create policy "managers write locations" on dealership_locations for all
  using (public.is_manager())
  with check (public.is_manager());

-- business_accounts: members read/update their own business account; staff read all.
create policy "members read own business account" on business_accounts for select
  using (public.business_account_role(id) is not null or public.is_staff());
create policy "owners and managers update business account" on business_accounts for update
  using (public.business_account_role(id) in ('owner', 'manager'))
  with check (public.business_account_role(id) in ('owner', 'manager'));
create policy "staff insert business accounts" on business_accounts for insert
  with check (public.is_staff());

-- business_account_members: members see their account's roster; staff see all.
create policy "members read own roster" on business_account_members for select
  using (
    public.business_account_role(business_account_id) is not null or public.is_staff()
  );
create policy "owners manage roster" on business_account_members for all
  using (public.business_account_role(business_account_id) = 'owner' or public.is_staff())
  with check (public.business_account_role(business_account_id) = 'owner' or public.is_staff());

-- staff_roles: staff read their own row; managers read/manage all.
create policy "staff read own role" on staff_roles for select
  using (profile_id = auth.uid() or public.is_manager());
create policy "managers manage staff roles" on staff_roles for all
  using (public.is_manager())
  with check (public.is_manager());

-- ============================================================
-- migrations/0002_winter_storage_zones.sql
-- ============================================================
-- Winter Storage zone framework, requested ahead of the Winter Storage Program
-- milestone (Phase 2) so the structure exists before zone/date data is finalized.
--
-- Zones are geographic groupings (defined by zip code) that determine which
-- drop-off/pickup date window a customer is offered. Actual zone boundaries and
-- season dates are TBD — seed/manage them via storage_zones / storage_zone_zip_codes
-- / storage_season_windows once provided; the app should never hardcode them.
--
-- NOTE: `winter_storage_signups` (the actual customer sign-up record, linking a
-- zone + season window to a specific piece of equipment) is deferred to the
-- Winter Storage milestone migration, since it needs a FK to `equipment`, which
-- doesn't exist until the M1 "My Garage" migration runs.

create table storage_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  dealership_location_id uuid references dealership_locations(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A zip code belongs to exactly one zone.
create table storage_zone_zip_codes (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references storage_zones(id) on delete cascade,
  zip text not null unique
);

create index storage_zone_zip_codes_zone_idx on storage_zone_zip_codes (zone_id);

-- Per-zone, per-season drop-off/pickup date windows (e.g. "Winter 2026-2027").
create table storage_season_windows (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references storage_zones(id) on delete cascade,
  season_label text not null,
  dropoff_window_start date not null,
  dropoff_window_end date not null,
  pickup_window_start date not null,
  pickup_window_end date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (dropoff_window_end >= dropoff_window_start),
  check (pickup_window_end >= pickup_window_start),
  check (pickup_window_start >= dropoff_window_end)
);

create index storage_season_windows_zone_idx on storage_season_windows (zone_id, season_label);

-- Look up a customer's storage zone from a zip code (used to determine which
-- season window(s) to show them at Winter Storage sign-up time).
create function public.zone_for_zip(target_zip text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select zone_id from storage_zone_zip_codes where zip = target_zip limit 1;
$$;

alter table storage_zones enable row level security;
alter table storage_zone_zip_codes enable row level security;
alter table storage_season_windows enable row level security;

create policy "read active zones" on storage_zones for select
  using (is_active or public.is_manager());
create policy "managers write zones" on storage_zones for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "read zone zip codes" on storage_zone_zip_codes for select
  using (true);
create policy "managers write zone zip codes" on storage_zone_zip_codes for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "read active season windows" on storage_season_windows for select
  using (is_active or public.is_manager());
create policy "managers write season windows" on storage_season_windows for all
  using (public.is_manager())
  with check (public.is_manager());

-- ============================================================
-- migrations/0003_equipment.sql
-- ============================================================
-- M1: My Garage — equipment, photos, documents, hour readings.

create table equipment (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  added_by_profile_id uuid references profiles(id),
  make text not null default 'John Deere',
  model text not null,
  model_year integer,
  serial_number text,
  category text not null default 'other' check (category in ('tractor', 'mower', 'utility_vehicle', 'attachment', 'other')),
  nickname text,
  purchase_date date,
  purchase_dealership_location_id uuid references dealership_locations(id),
  current_hours numeric,
  primary_photo_url text,
  warranty_expires_at date,
  powergard_expires_at date,
  powergard_plan_name text,
  status text not null default 'active' check (status in ('active', 'sold', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index equipment_business_account_idx on equipment (business_account_id) where deleted_at is null;

create table equipment_photos (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index equipment_photos_equipment_idx on equipment_photos (equipment_id);

create table equipment_documents (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  doc_type text not null check (doc_type in ('purchase_agreement', 'financing', 'insurance', 'operators_manual', 'other')),
  storage_path text not null,
  file_name text not null,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index equipment_documents_equipment_idx on equipment_documents (equipment_id);

create table equipment_hour_readings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  hours numeric not null check (hours >= 0),
  reading_source text not null default 'customer_entered' check (reading_source in ('customer_entered', 'service_visit', 'jdlink_sync')),
  recorded_by_profile_id uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

create index equipment_hour_readings_equipment_idx on equipment_hour_readings (equipment_id, recorded_at desc);

create table equipment_attachments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  attachment_equipment_id uuid references equipment(id) on delete set null,
  description text
);

-- Keep equipment.current_hours in sync with the latest reading.
create function public.handle_new_hour_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update equipment
  set current_hours = new.hours, updated_at = now()
  where id = new.equipment_id
    and (current_hours is null or new.recorded_at >= (
      select max(recorded_at) from equipment_hour_readings
      where equipment_id = new.equipment_id and id <> new.id
    ));
  return new;
end;
$$;

create trigger on_hour_reading_created
  after insert on equipment_hour_readings
  for each row execute function public.handle_new_hour_reading();

-- ---------------------------------------------------------------------------
-- RLS — any active business account member can read/add equipment & log hours;
-- only owner/manager can delete equipment. Staff can read/write everything.
-- ---------------------------------------------------------------------------
alter table equipment enable row level security;
alter table equipment_photos enable row level security;
alter table equipment_documents enable row level security;
alter table equipment_hour_readings enable row level security;
alter table equipment_attachments enable row level security;

create policy "members read own equipment" on equipment for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members add equipment" on equipment for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members update own equipment" on equipment for update
  using (public.business_account_role(business_account_id) is not null or public.is_staff())
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "owners and managers delete equipment" on equipment for delete
  using (public.business_account_role(business_account_id) in ('owner', 'manager') or public.is_staff());

create policy "members read own equipment photos" on equipment_photos for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment photos" on equipment_photos for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own equipment documents" on equipment_documents for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment documents" on equipment_documents for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own hour readings" on equipment_hour_readings for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members log hour readings" on equipment_hour_readings for insert
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own equipment attachments" on equipment_attachments for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment attachments" on equipment_attachments for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

-- ---------------------------------------------------------------------------
-- Storage buckets: equipment-photos (private), equipment-documents (private).
-- Path convention: {business_account_id}/{equipment_id}/{filename} — RLS below
-- uses the first path segment to check business account membership.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', false), ('equipment-documents', 'equipment-documents', false)
on conflict (id) do nothing;

create policy "members read own equipment photo files" on storage.objects for select
  using (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own equipment photo files" on storage.objects for insert
  with check (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members delete own equipment photo files" on storage.objects for delete
  using (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );

create policy "members read own equipment document files" on storage.objects for select
  using (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own equipment document files" on storage.objects for insert
  with check (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members delete own equipment document files" on storage.objects for delete
  using (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );

-- ============================================================
-- migrations/0004_maintenance.sql
-- ============================================================
-- M2: Maintenance — schedule templates (admin/seed-managed reference data) and
-- auto-generated per-equipment maintenance tasks.
--
-- Generation is implemented as Postgres triggers (not an external cron job) so
-- it works without any separate running process: a new equipment row generates
-- its initial task set immediately, and a new hour reading re-evaluates whether
-- any "upcoming" task has become "due". A periodic apps/api job can still be
-- added later for calendar-based (date) due-status transitions, since those
-- aren't triggered by any row insert — see README.

create table maintenance_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  make text not null default 'John Deere',
  -- ILIKE pattern matched against equipment.model, e.g. '1025R' or '1025R%' or 'X3%'.
  model_pattern text not null,
  task_name text not null,
  interval_hours integer,
  interval_months integer,
  interval_type text not null check (interval_type in ('hours', 'calendar', 'both')),
  category text,
  parts_needed jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (interval_type = 'hours' and interval_hours is not null)
    or (interval_type = 'calendar' and interval_months is not null)
    or (interval_type = 'both' and interval_hours is not null and interval_months is not null)
  )
);

create table maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  template_id uuid references maintenance_schedule_templates(id),
  task_name text not null,
  due_at_hours numeric,
  due_at_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'due', 'overdue', 'completed', 'dismissed')),
  completed_at timestamptz,
  completed_service_request_id uuid, -- FK added once service_requests exists (M3 migration)
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_tasks_equipment_idx on maintenance_tasks (equipment_id, status);

-- Prevent duplicate open tasks for the same template+equipment.
create unique index maintenance_tasks_unique_open_template
  on maintenance_tasks (equipment_id, template_id)
  where template_id is not null and status in ('upcoming', 'due', 'overdue');

-- ---------------------------------------------------------------------------
-- Generation: match templates to an equipment row and create any missing tasks.
-- ---------------------------------------------------------------------------
create function public.generate_maintenance_tasks_for_equipment(target_equipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eq equipment%rowtype;
  tmpl maintenance_schedule_templates%rowtype;
begin
  select * into eq from equipment where id = target_equipment_id;
  if not found then
    return;
  end if;

  for tmpl in
    select * from maintenance_schedule_templates
    where is_active
      and eq.model ilike model_pattern
      and (make is null or eq.make ilike make)
  loop
    insert into maintenance_tasks (equipment_id, template_id, task_name, due_at_hours, due_at_date, status)
    values (
      eq.id,
      tmpl.id,
      tmpl.task_name,
      case when tmpl.interval_hours is not null then coalesce(eq.current_hours, 0) + tmpl.interval_hours else null end,
      case when tmpl.interval_months is not null then (coalesce(eq.purchase_date, current_date) + (tmpl.interval_months || ' months')::interval)::date else null end,
      'upcoming'
    )
    on conflict (equipment_id, template_id) where template_id is not null and status in ('upcoming', 'due', 'overdue')
    do nothing;
  end loop;
end;
$$;

create function public.handle_new_equipment_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_maintenance_tasks_for_equipment(new.id);
  return new;
end;
$$;

create trigger on_equipment_created_generate_maintenance
  after insert on equipment
  for each row execute function public.handle_new_equipment_maintenance();

-- Re-evaluate hours-based tasks whenever a new reading comes in: flip
-- "upcoming" to "due" once the logged hours reach the task's due_at_hours.
create function public.handle_hour_reading_maintenance_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update maintenance_tasks
  set status = 'due', updated_at = now()
  where equipment_id = new.equipment_id
    and status = 'upcoming'
    and due_at_hours is not null
    and due_at_hours <= new.hours;
  return new;
end;
$$;

create trigger on_hour_reading_check_maintenance
  after insert on equipment_hour_readings
  for each row execute function public.handle_hour_reading_maintenance_check();

-- (Shared helper, used by any table needing a generic updated_at bump.)
create function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger maintenance_tasks_set_updated_at
  before update on maintenance_tasks
  for each row execute function public.set_updated_at_now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table maintenance_schedule_templates enable row level security;
alter table maintenance_tasks enable row level security;

create policy "anyone authenticated reads active templates" on maintenance_schedule_templates for select
  using (is_active or public.is_manager());
create policy "managers write templates" on maintenance_schedule_templates for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "members read own maintenance tasks" on maintenance_tasks for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members update own maintenance tasks" on maintenance_tasks for update
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "staff insert manual maintenance tasks" on maintenance_tasks for insert
  with check (public.is_staff());

-- ============================================================
-- migrations/0005_notification_rules.sql
-- ============================================================
-- Admin-configurable automated alert / push notification rules, per business
-- account (with global defaults). Lets staff, e.g., turn off promo alerts for
-- a specific account, or add an SMS channel for maintenance reminders on a
-- VIP account. Distinct from `profiles.notification_prefs`, which is the
-- *customer's own* opt-in/opt-out — this table is staff-configured, on top of
-- (and constrained by) what the customer has allowed.
--
-- Actual push delivery (Expo) and the dispatcher service are a later
-- milestone — this is the configuration surface only.

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  expo_push_token text not null,
  device_type text not null check (device_type in ('ios', 'android', 'web')),
  is_active boolean not null default true,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, expo_push_token)
);

create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  -- null = global default applied to every account without its own override row.
  business_account_id uuid references business_accounts(id) on delete cascade,
  category text not null check (category in (
    'maintenance_due', 'warranty_expiring', 'powergard_expiring',
    'service_status', 'parts_status', 'message', 'promo', 'recall'
  )),
  channel text not null check (channel in ('push', 'sms', 'email')),
  is_enabled boolean not null default true,
  -- For date-based categories (warranty/powergard expiring): how many days
  -- before expiration to alert. Null for non-date categories.
  lead_time_days integer,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index notification_rules_account_category_channel_idx
  on notification_rules (business_account_id, category, channel)
  where business_account_id is not null;

create unique index notification_rules_global_category_channel_idx
  on notification_rules (category, channel)
  where business_account_id is null;

create trigger notification_rules_set_updated_at
  before update on notification_rules
  for each row execute function public.set_updated_at_now();

-- Effective rule for a given account+category+channel: the account-specific
-- override if one exists, otherwise the global default, otherwise "enabled"
-- (fail open so alerts work even before any rules are configured).
create function public.notification_rule_enabled(
  target_business_account_id uuid,
  target_category text,
  target_channel text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_enabled from notification_rules
      where business_account_id = target_business_account_id
        and category = target_category and channel = target_channel),
    (select is_enabled from notification_rules
      where business_account_id is null
        and category = target_category and channel = target_channel),
    true
  );
$$;

alter table push_tokens enable row level security;
alter table notification_rules enable row level security;

create policy "members manage own push tokens" on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "staff read notification rules" on notification_rules for select
  using (public.is_staff());
create policy "staff write notification rules" on notification_rules for all
  using (public.is_staff())
  with check (public.is_staff());

