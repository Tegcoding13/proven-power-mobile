-- M4: Parts Requests — stock checks, orders, broken-part photo ID.
-- Full priced/browsable catalog + cart is Phase 2; this is request-based only.

create table parts_requests (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete set null,
  requested_by_profile_id uuid references profiles(id),
  dealership_location_id uuid references dealership_locations(id),
  request_type text not null default 'part_order' check (request_type in ('stock_check', 'part_order', 'broken_part_id')),
  description text not null,
  status text not null default 'submitted' check (status in (
    'submitted', 'researching', 'in_stock', 'ordered', 'ready_for_pickup', 'fulfilled', 'cancelled'
  )),
  assigned_staff_profile_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index parts_requests_business_account_idx on parts_requests (business_account_id);
create index parts_requests_status_idx on parts_requests (status);

create table parts_request_media (
  id uuid primary key default gen_random_uuid(),
  parts_request_id uuid not null references parts_requests(id) on delete cascade,
  storage_path text not null,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index parts_request_media_request_idx on parts_request_media (parts_request_id);

create trigger parts_requests_set_updated_at
  before update on parts_requests
  for each row execute function public.set_updated_at_now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table parts_requests enable row level security;
alter table parts_request_media enable row level security;

create policy "members read own parts requests" on parts_requests for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members create parts requests" on parts_requests for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "staff update parts requests" on parts_requests for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own parts request media" on parts_request_media for select
  using (
    exists (select 1 from parts_requests pr where pr.id = parts_request_id and (public.business_account_role(pr.business_account_id) is not null or public.is_staff()))
  );
create policy "members add own parts request media" on parts_request_media for insert
  with check (
    exists (select 1 from parts_requests pr where pr.id = parts_request_id and (public.business_account_role(pr.business_account_id) is not null or public.is_staff()))
  );

-- ---------------------------------------------------------------------------
-- Storage bucket: parts-request-media (private).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('parts-request-media', 'parts-request-media', false)
on conflict (id) do nothing;

create policy "members read own parts request media files" on storage.objects for select
  using (
    bucket_id = 'parts-request-media'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own parts request media files" on storage.objects for insert
  with check (
    bucket_id = 'parts-request-media'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
