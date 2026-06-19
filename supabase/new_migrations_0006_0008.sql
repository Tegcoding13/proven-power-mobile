-- New migrations since you last ran combined_migrations.sql: 0006-0008
-- (Service Requests, Parts Requests, Messaging). Paste this into the SQL
-- Editor and run once.

-- ============================================================
-- migrations/0006_service_requests.sql
-- ============================================================
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

-- ============================================================
-- migrations/0007_parts_requests.sql
-- ============================================================
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

-- ============================================================
-- migrations/0008_messaging.sql
-- ============================================================
-- M5: Messaging — department threads, attachments, read receipts, quote flag.
-- Auto-reply-when-closed (checking dealership_locations.hours) is deferred —
-- not in this migration.

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  department text not null check (department in ('sales', 'parts', 'service', 'office')),
  subject text,
  related_service_request_id uuid references service_requests(id) on delete set null,
  related_parts_request_id uuid references parts_requests(id) on delete set null,
  assigned_staff_profile_id uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index message_threads_business_account_idx on message_threads (business_account_id);
create index message_threads_department_idx on message_threads (department, status);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_profile_id uuid references profiles(id),
  sender_type text not null check (sender_type in ('customer', 'staff')),
  body text,
  is_quote boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on messages (thread_id, created_at);

create table message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  media_type text not null check (media_type in ('photo', 'video', 'document'))
);

create table message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  read_at timestamptz not null default now(),
  unique (message_id, profile_id)
);

-- Bump the thread's last_message_at whenever a new message lands, so thread
-- lists can sort/show recency without a join+aggregate on every read.
create function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger on_message_created
  after insert on messages
  for each row execute function public.handle_new_message();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table message_attachments enable row level security;
alter table message_read_receipts enable row level security;

create policy "members read own threads" on message_threads for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members create own threads" on message_threads for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "staff update threads" on message_threads for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "members read own thread messages" on messages for select
  using (
    exists (select 1 from message_threads mt where mt.id = thread_id and (public.business_account_role(mt.business_account_id) is not null or public.is_staff()))
  );
create policy "members send own thread messages" on messages for insert
  with check (
    exists (select 1 from message_threads mt where mt.id = thread_id and (public.business_account_role(mt.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own message attachments" on message_attachments for select
  using (
    exists (
      select 1 from messages m join message_threads mt on mt.id = m.thread_id
      where m.id = message_id and (public.business_account_role(mt.business_account_id) is not null or public.is_staff())
    )
  );
create policy "members add own message attachments" on message_attachments for insert
  with check (
    exists (
      select 1 from messages m join message_threads mt on mt.id = m.thread_id
      where m.id = message_id and (public.business_account_role(mt.business_account_id) is not null or public.is_staff())
    )
  );

create policy "anyone reads receipts on their visible messages" on message_read_receipts for select
  using (
    exists (
      select 1 from messages m join message_threads mt on mt.id = m.thread_id
      where m.id = message_id and (public.business_account_role(mt.business_account_id) is not null or public.is_staff())
    )
  );
create policy "members mark their own read receipts" on message_read_receipts for insert
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket: message-attachments (private).
-- Path convention: {business_account_id}/{thread_id}/{filename}.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

create policy "members read own message attachment files" on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own message attachment files" on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );

