-- Placeholder winter storage zones/zip-codes/season-windows, covering the zip
-- codes for Proven Power's two real locations (Oconomowoc 53066, Waukesha
-- 53189) plus a few neighboring zips, so the sign-up flow is testable.
-- REPLACE with real zone boundaries and season dates once finalized — these
-- dates/boundaries are made up.

insert into storage_zones (name, description, dealership_location_id)
select 'Oconomowoc Zone', 'Placeholder zone around the Oconomowoc store', id
from dealership_locations where name = 'Proven Power - Oconomowoc'
limit 1;

insert into storage_zones (name, description, dealership_location_id)
select 'Waukesha Zone', 'Placeholder zone around the Waukesha store', id
from dealership_locations where name = 'Proven Power - Waukesha'
limit 1;

insert into storage_zone_zip_codes (zone_id, zip)
select id, zip from storage_zones, unnest(array['53066', '53038', '53029']) as zip
where name = 'Oconomowoc Zone';

insert into storage_zone_zip_codes (zone_id, zip)
select id, zip from storage_zones, unnest(array['53189', '53186', '53188']) as zip
where name = 'Waukesha Zone';

insert into storage_season_windows (zone_id, season_label, dropoff_window_start, dropoff_window_end, pickup_window_start, pickup_window_end)
select id, 'Winter 2026-2027', '2026-10-15', '2026-11-30', '2027-03-01', '2027-04-15'
from storage_zones where name = 'Oconomowoc Zone';

insert into storage_season_windows (zone_id, season_label, dropoff_window_start, dropoff_window_end, pickup_window_start, pickup_window_end)
select id, 'Winter 2026-2027', '2026-10-15', '2026-11-30', '2027-03-01', '2027-04-15'
from storage_zones where name = 'Waukesha Zone';
