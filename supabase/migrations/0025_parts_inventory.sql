-- Parts inventory synced from Aspen (Charter Software DMS).
-- A future sync job upserts rows keyed by part_number + dealership_location_id.
-- Customers can read; only staff/service-role can write.

create table parts_inventory (
  id uuid primary key default gen_random_uuid(),
  dealership_location_id uuid references dealership_locations(id) on delete cascade,
  part_number text not null,
  description text,
  quantity_on_hand integer not null default 0,
  bin_location text,
  unit_price numeric(10, 2),
  aspen_part_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_number, dealership_location_id)
);

create index parts_inventory_part_number_idx on parts_inventory using gin (to_tsvector('english', part_number || ' ' || coalesce(description, '')));
create index parts_inventory_part_number_exact_idx on parts_inventory (lower(part_number));
create index parts_inventory_location_idx on parts_inventory (dealership_location_id);

alter table parts_inventory enable row level security;

-- Customers can look up inventory (read-only, no auth required for lookup)
create policy "anyone can read parts inventory" on parts_inventory
  for select using (true);

-- Only staff can manage inventory rows
create policy "staff manage parts inventory" on parts_inventory
  for all
  using (public.is_staff())
  with check (public.is_staff());
