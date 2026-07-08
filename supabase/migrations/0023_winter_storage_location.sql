-- Add dealership_location_id to winter_storage_signups so each signup is
-- directly associated with a store location, enabling per-location calendar
-- views in the admin and per-location badge counts on the home dashboard.
--
-- Backfill from the existing zone chain:
--   winter_storage_signups.dropoff_calendar_day_id
--     → storage_calendar_days.zone_id
--     → storage_zones.dealership_location_id

alter table winter_storage_signups
  add column if not exists dealership_location_id uuid references dealership_locations(id);

-- Backfill from dropoff calendar day's zone (primary source)
update winter_storage_signups s
set dealership_location_id = sz.dealership_location_id
from storage_calendar_days cd
join storage_zones sz on cd.zone_id = sz.id
where s.dropoff_calendar_day_id = cd.id
  and s.dealership_location_id is null
  and sz.dealership_location_id is not null;

-- Fallback: backfill from pickup calendar day's zone
update winter_storage_signups s
set dealership_location_id = sz.dealership_location_id
from storage_calendar_days cd
join storage_zones sz on cd.zone_id = sz.id
where s.pickup_calendar_day_id = cd.id
  and s.dealership_location_id is null
  and sz.dealership_location_id is not null;

create index if not exists winter_storage_signups_location_idx
  on winter_storage_signups (dealership_location_id);
