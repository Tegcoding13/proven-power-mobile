-- Winter Storage: individual calendar days (admin manages which specific dates are
-- available for drop-off or pick-up), plus address fields on business_accounts
-- so the form can auto-populate the customer's zip without manual entry.

-- Address fields on business_accounts (farm/home address for zone lookup)
alter table business_accounts
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text;

-- Individual available drop-off / pick-up days (admin creates these via calendar)
create table storage_calendar_days (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references storage_zones(id) on delete cascade,
  date date not null,
  day_type text not null check (day_type in ('dropoff', 'pickup')),
  max_slots integer not null default 10,
  is_manually_full boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (zone_id, date, day_type)
);

create index storage_calendar_days_zone_date_idx on storage_calendar_days (zone_id, date);
create index storage_calendar_days_date_type_idx on storage_calendar_days (date, day_type);

-- Link signups to specific calendar days (which day they actually chose)
alter table winter_storage_signups
  add column if not exists dropoff_calendar_day_id uuid references storage_calendar_days(id),
  add column if not exists pickup_calendar_day_id uuid references storage_calendar_days(id);

-- RLS
alter table storage_calendar_days enable row level security;

create policy "anyone reads calendar days" on storage_calendar_days for select
  using (true);
create policy "staff manage calendar days" on storage_calendar_days for all
  using (public.is_staff())
  with check (public.is_staff());

-- View: available days with slot counts (how many confirmed signups per day)
create or replace view storage_calendar_day_availability as
select
  d.id,
  d.zone_id,
  d.date,
  d.day_type,
  d.max_slots,
  d.is_manually_full,
  d.notes,
  count(case
    when d.day_type = 'dropoff' and s.dropoff_calendar_day_id = d.id
         and s.status not in ('cancelled') then 1
    when d.day_type = 'pickup' and s.pickup_calendar_day_id = d.id
         and s.status not in ('cancelled') then 1
  end) as booked_slots,
  d.is_manually_full
    or count(case
      when d.day_type = 'dropoff' and s.dropoff_calendar_day_id = d.id
           and s.status not in ('cancelled') then 1
      when d.day_type = 'pickup' and s.pickup_calendar_day_id = d.id
           and s.status not in ('cancelled') then 1
    end) >= d.max_slots as is_full
from storage_calendar_days d
left join winter_storage_signups s on true
group by d.id, d.zone_id, d.date, d.day_type, d.max_slots, d.is_manually_full, d.notes;
