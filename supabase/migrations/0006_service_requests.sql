-- M3: Service Requests — submit with photo/video, live status, status history.

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  requested_by_profile_id uuid references profiles(id),
  dealership_location_id uuid references dealership_locations(id),
  request_type text not null default 'drop_off' check (request_type in ('drop_off', 'pickup_delivery', 'field_service', 'loaner_request')),
  description text not null,
  gps_lat double precision,
  gps_lng double precision,
  preferred_date date,
  status text not null default 'submitted' check (status in (
    'submitted', 'acknowledged', 'scheduled', 'in_progress',
    'awaiting_approval', 'approved', 'completed', 'cancelled'
  )),
  assigned_staff_profile_id uuid references profiles(id),
  estimate_amount numeric,
  estimate_approved_at timestamptz,
  estimate_approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_requests_business_account_idx on service_requests (business_account_id);
create index service_requests_status_idx on service_requests (status);

-- Now that service_requests exists, link the maintenance task it closed out.
alter table maintenance_tasks
  add constraint maintenance_tasks_completed_service_request_fkey
  foreign key (completed_service_request_id) references service_requests(id) on delete set null;

create table service_request_media (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  storage_path text not null,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index service_request_media_request_idx on service_request_media (service_request_id);

create table service_request_status_history (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  status text not null,
  note text,
  changed_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index service_request_status_history_request_idx on service_request_status_history (service_request_id, created_at);

create trigger service_requests_set_updated_at
  before update on service_requests
  for each row execute function public.set_updated_at_now();

-- Automatically log every status change (insert + update) so the app never
-- has to remember to write a history row itself.
create function public.handle_service_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into service_request_status_history (service_request_id, status, changed_by_profile_id)
    values (new.id, new.status, new.requested_by_profile_id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into service_request_status_history (service_request_id, status, changed_by_profile_id)
    values (new.id, new.status, new.assigned_staff_profile_id);
  end if;
  return new;
end;
$$;

create trigger on_service_request_status_change
  after insert or update on service_requests
  for each row execute function public.handle_service_request_status_change();

-- ---------------------------------------------------------------------------
-- RLS — members read/insert their own requests; staff read/manage all.
-- ---------------------------------------------------------------------------
alter table service_requests enable row level security;
alter table service_request_media enable row level security;
alter table service_request_status_history enable row level security;

create policy "members read own service requests" on service_requests for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members create service requests" on service_requests for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "staff update service requests" on service_requests for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own request media" on service_request_media for select
  using (
    exists (select 1 from service_requests sr where sr.id = service_request_id and (public.business_account_role(sr.business_account_id) is not null or public.is_staff()))
  );
create policy "members add own request media" on service_request_media for insert
  with check (
    exists (select 1 from service_requests sr where sr.id = service_request_id and (public.business_account_role(sr.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own request status history" on service_request_status_history for select
  using (
    exists (select 1 from service_requests sr where sr.id = service_request_id and (public.business_account_role(sr.business_account_id) is not null or public.is_staff()))
  );

-- ---------------------------------------------------------------------------
-- Storage bucket: service-request-media (private).
-- Path convention: {business_account_id}/{service_request_id}/{filename}.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('service-request-media', 'service-request-media', false)
on conflict (id) do nothing;

create policy "members read own service request media files" on storage.objects for select
  using (
    bucket_id = 'service-request-media'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own service request media files" on storage.objects for insert
  with check (
    bucket_id = 'service-request-media'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
