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
