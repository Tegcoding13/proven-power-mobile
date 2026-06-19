-- Inventory (staff-managed for now; schema is sync-ready for a future Aspen/DMS
-- integration via external_source/external_id) + Winter Storage sign-ups (using
-- the zone framework from 0002_winter_storage_zones.sql, now that `equipment`
-- exists).

create table inventory_listings (
  id uuid primary key default gen_random_uuid(),
  dealership_location_id uuid references dealership_locations(id),
  category text not null default 'other' check (category in ('tractor', 'mower', 'utility_vehicle', 'attachment', 'other')),
  make text not null default 'John Deere',
  model text not null,
  model_year integer,
  title text not null,
  description text,
  price numeric,
  condition text not null default 'new' check (condition in ('new', 'used')),
  status text not null default 'available' check (status in ('available', 'pending', 'sold')),
  stock_number text,
  -- Sync-ready fields for a future DMS integration (e.g. Aspen by Charter).
  -- Null external_source = manually entered by staff (the case for now).
  external_source text,
  external_id text,
  created_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id)
);

create index inventory_listings_status_idx on inventory_listings (status);
create index inventory_listings_location_idx on inventory_listings (dealership_location_id);

create table inventory_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references inventory_listings(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index inventory_listing_photos_listing_idx on inventory_listing_photos (listing_id);

create trigger inventory_listings_set_updated_at
  before update on inventory_listings
  for each row execute function public.set_updated_at_now();

-- ---------------------------------------------------------------------------
-- Winter Storage sign-ups
-- ---------------------------------------------------------------------------
create table winter_storage_signups (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  zone_id uuid references storage_zones(id),
  season_window_id uuid references storage_season_windows(id),
  requested_dropoff_date date,
  requested_pickup_date date,
  winterization_bundle_added boolean not null default false,
  agreement_signed_at timestamptz,
  status text not null default 'requested' check (status in (
    'requested', 'confirmed', 'dropped_off', 'stored', 'picked_up', 'cancelled'
  )),
  dropoff_condition_notes text,
  requested_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index winter_storage_signups_business_account_idx on winter_storage_signups (business_account_id);
create index winter_storage_signups_status_idx on winter_storage_signups (status);

create table winter_storage_checkin_photos (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references winter_storage_signups(id) on delete cascade,
  storage_path text not null,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create trigger winter_storage_signups_set_updated_at
  before update on winter_storage_signups
  for each row execute function public.set_updated_at_now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table inventory_listings enable row level security;
alter table inventory_listing_photos enable row level security;
alter table winter_storage_signups enable row level security;
alter table winter_storage_checkin_photos enable row level security;

-- Inventory is public marketing content — any authenticated customer can browse
-- available listings; staff manage everything (including sold/pending units).
create policy "anyone reads available inventory" on inventory_listings for select
  using (status = 'available' or public.is_staff());
create policy "staff manage inventory" on inventory_listings for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "anyone reads inventory photos" on inventory_listing_photos for select
  using (
    exists (select 1 from inventory_listings il where il.id = listing_id and (il.status = 'available' or public.is_staff()))
  );
create policy "staff manage inventory photos" on inventory_listing_photos for all
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own winter storage signups" on winter_storage_signups for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members create winter storage signups" on winter_storage_signups for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "staff update winter storage signups" on winter_storage_signups for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own checkin photos" on winter_storage_checkin_photos for select
  using (
    exists (select 1 from winter_storage_signups s where s.id = signup_id and (public.business_account_role(s.business_account_id) is not null or public.is_staff()))
  );
create policy "members add own checkin photos" on winter_storage_checkin_photos for insert
  with check (
    exists (select 1 from winter_storage_signups s where s.id = signup_id and (public.business_account_role(s.business_account_id) is not null or public.is_staff()))
  );

-- ---------------------------------------------------------------------------
-- Storage buckets.
-- inventory-photos is PUBLIC (marketing content, no signed URLs needed).
-- winter-storage-checkin-photos is private, same per-account path convention
-- as other buckets.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inventory-photos', 'inventory-photos', true)
on conflict (id) do nothing;

create policy "staff manage inventory photo files" on storage.objects for all
  using (bucket_id = 'inventory-photos' and public.is_staff())
  with check (bucket_id = 'inventory-photos' and public.is_staff());

insert into storage.buckets (id, name, public)
values ('winter-storage-checkin-photos', 'winter-storage-checkin-photos', false)
on conflict (id) do nothing;

create policy "members read own checkin photo files" on storage.objects for select
  using (
    bucket_id = 'winter-storage-checkin-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own checkin photo files" on storage.objects for insert
  with check (
    bucket_id = 'winter-storage-checkin-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
