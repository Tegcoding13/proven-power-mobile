-- M1: My Garage — equipment, photos, documents, hour readings.

create table equipment (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  added_by_profile_id uuid references profiles(id),
  make text not null default 'John Deere',
  model text not null,
  model_year integer,
  serial_number text,
  category text not null default 'other' check (category in ('tractor', 'mower', 'utility_vehicle', 'attachment', 'other')),
  nickname text,
  purchase_date date,
  purchase_dealership_location_id uuid references dealership_locations(id),
  current_hours numeric,
  primary_photo_url text,
  warranty_expires_at date,
  powergard_expires_at date,
  powergard_plan_name text,
  status text not null default 'active' check (status in ('active', 'sold', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index equipment_business_account_idx on equipment (business_account_id) where deleted_at is null;

create table equipment_photos (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index equipment_photos_equipment_idx on equipment_photos (equipment_id);

create table equipment_documents (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  doc_type text not null check (doc_type in ('purchase_agreement', 'financing', 'insurance', 'operators_manual', 'other')),
  storage_path text not null,
  file_name text not null,
  uploaded_by_profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index equipment_documents_equipment_idx on equipment_documents (equipment_id);

create table equipment_hour_readings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  hours numeric not null check (hours >= 0),
  reading_source text not null default 'customer_entered' check (reading_source in ('customer_entered', 'service_visit', 'jdlink_sync')),
  recorded_by_profile_id uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

create index equipment_hour_readings_equipment_idx on equipment_hour_readings (equipment_id, recorded_at desc);

create table equipment_attachments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  attachment_equipment_id uuid references equipment(id) on delete set null,
  description text
);

-- Keep equipment.current_hours in sync with the latest reading.
create function public.handle_new_hour_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update equipment
  set current_hours = new.hours, updated_at = now()
  where id = new.equipment_id
    and (current_hours is null or new.recorded_at >= (
      select max(recorded_at) from equipment_hour_readings
      where equipment_id = new.equipment_id and id <> new.id
    ));
  return new;
end;
$$;

create trigger on_hour_reading_created
  after insert on equipment_hour_readings
  for each row execute function public.handle_new_hour_reading();

-- ---------------------------------------------------------------------------
-- RLS — any active business account member can read/add equipment & log hours;
-- only owner/manager can delete equipment. Staff can read/write everything.
-- ---------------------------------------------------------------------------
alter table equipment enable row level security;
alter table equipment_photos enable row level security;
alter table equipment_documents enable row level security;
alter table equipment_hour_readings enable row level security;
alter table equipment_attachments enable row level security;

create policy "members read own equipment" on equipment for select
  using (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members add equipment" on equipment for insert
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "members update own equipment" on equipment for update
  using (public.business_account_role(business_account_id) is not null or public.is_staff())
  with check (public.business_account_role(business_account_id) is not null or public.is_staff());
create policy "owners and managers delete equipment" on equipment for delete
  using (public.business_account_role(business_account_id) in ('owner', 'manager') or public.is_staff());

create policy "members read own equipment photos" on equipment_photos for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment photos" on equipment_photos for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own equipment documents" on equipment_documents for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment documents" on equipment_documents for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own hour readings" on equipment_hour_readings for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members log hour readings" on equipment_hour_readings for insert
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

create policy "members read own equipment attachments" on equipment_attachments for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members manage own equipment attachments" on equipment_attachments for all
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );

-- ---------------------------------------------------------------------------
-- Storage buckets: equipment-photos (private), equipment-documents (private).
-- Path convention: {business_account_id}/{equipment_id}/{filename} — RLS below
-- uses the first path segment to check business account membership.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', false), ('equipment-documents', 'equipment-documents', false)
on conflict (id) do nothing;

create policy "members read own equipment photo files" on storage.objects for select
  using (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own equipment photo files" on storage.objects for insert
  with check (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members delete own equipment photo files" on storage.objects for delete
  using (
    bucket_id = 'equipment-photos'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );

create policy "members read own equipment document files" on storage.objects for select
  using (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members upload own equipment document files" on storage.objects for insert
  with check (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
create policy "members delete own equipment document files" on storage.objects for delete
  using (
    bucket_id = 'equipment-documents'
    and (public.business_account_role(((storage.foldername(name))[1])::uuid) is not null or public.is_staff())
  );
