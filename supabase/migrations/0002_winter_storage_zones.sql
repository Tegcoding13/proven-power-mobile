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
