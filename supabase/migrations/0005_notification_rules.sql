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
