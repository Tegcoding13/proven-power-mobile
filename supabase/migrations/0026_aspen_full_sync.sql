-- Aspen (Charter Software DMS) full data sync — equipment, invoices, and
-- service history. The sync job upserts into these staging/live tables keyed
-- by Aspen IDs. When a customer is claimed, promote_aspen_customer_data() is
-- called automatically to link their history to their business account.

-- ─────────────────────────────────────────────────────────────
-- 0. Ensure aspen_customer_imports exists (created in 0011;
--    guard here so this migration is safe to run standalone)
-- ─────────────────────────────────────────────────────────────
create table if not exists aspen_customer_imports (
  id uuid primary key default gen_random_uuid(),
  aspen_customer_id text not null unique,
  phone text not null,
  full_name text,
  email text,
  business_account_id uuid not null references business_accounts(id) on delete cascade,
  claimed_by_profile_id uuid references profiles(id),
  claimed_at timestamptz,
  imported_at timestamptz not null default now(),
  raw_payload jsonb
);

create index if not exists aspen_customer_imports_phone_idx on aspen_customer_imports (phone) where claimed_at is null;
alter table aspen_customer_imports enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'aspen_customer_imports' and policyname = 'staff manage aspen imports'
  ) then
    create policy "staff manage aspen imports" on aspen_customer_imports for all
      using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 1. Track Aspen origin on equipment rows (added to live table)
-- ─────────────────────────────────────────────────────────────
alter table equipment
  add column if not exists aspen_equipment_id text unique,
  add column if not exists aspen_customer_id  text;

create index if not exists equipment_aspen_id_idx on equipment (aspen_equipment_id) where aspen_equipment_id is not null;
create index if not exists equipment_aspen_customer_idx on equipment (aspen_customer_id) where aspen_customer_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 2. Equipment staging — synced from Aspen before claim
-- ─────────────────────────────────────────────────────────────
-- Rows land here during sync. promote_aspen_customer_data() copies them into
-- the live equipment table once a customer is matched.
create table if not exists aspen_equipment_imports (
  id                       uuid    primary key default gen_random_uuid(),
  aspen_customer_id        text    not null,
  aspen_equipment_id       text    not null unique,
  make                     text    not null default 'John Deere',
  model                    text    not null,
  model_year               integer,
  serial_number            text,
  category                 text    not null default 'other'
                                   check (category in ('tractor','mower','utility_vehicle','attachment','other')),
  purchase_date            date,
  purchase_dealership_location_id uuid references dealership_locations(id),
  current_hours            numeric,
  promoted_equipment_id    uuid    references equipment(id),   -- set after promotion
  promoted_at              timestamptz,
  imported_at              timestamptz not null default now(),
  last_synced_at           timestamptz not null default now(),
  raw_payload              jsonb
);

create index if not exists aspen_equipment_customer_idx on aspen_equipment_imports (aspen_customer_id);

alter table aspen_equipment_imports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'aspen_equipment_imports' and policyname = 'staff manage aspen equipment imports') then
    create policy "staff manage aspen equipment imports" on aspen_equipment_imports
      for all using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Invoice / order history
-- ─────────────────────────────────────────────────────────────
create table if not exists aspen_invoices (
  id                    uuid    primary key default gen_random_uuid(),
  business_account_id   uuid    references business_accounts(id) on delete set null,
  aspen_customer_id     text    not null,
  aspen_invoice_id      text    not null unique,
  invoice_number        text,
  invoice_date          date,
  due_date              date,
  total_amount          numeric(10,2),
  balance_due           numeric(10,2),
  status                text    not null default 'unknown'
                                check (status in ('paid','unpaid','partial','voided','unknown')),
  dealership_location_id uuid   references dealership_locations(id),
  line_items            jsonb,   -- [{part_number, description, qty, unit_price, extended_price}]
  imported_at           timestamptz not null default now(),
  last_synced_at        timestamptz not null default now(),
  raw_payload           jsonb
);

create index if not exists aspen_invoices_account_idx on aspen_invoices (business_account_id) where business_account_id is not null;
create index if not exists aspen_invoices_customer_idx on aspen_invoices (aspen_customer_id);
create index if not exists aspen_invoices_date_idx on aspen_invoices (invoice_date desc);

alter table aspen_invoices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'aspen_invoices' and policyname = 'members read own invoices') then
    create policy "members read own invoices" on aspen_invoices for select
      using (business_account_id is not null and public.business_account_role(business_account_id) is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'aspen_invoices' and policyname = 'staff manage aspen invoices') then
    create policy "staff manage aspen invoices" on aspen_invoices
      for all using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Service history (historical work orders from Aspen)
-- ─────────────────────────────────────────────────────────────
create table if not exists aspen_service_history (
  id                    uuid    primary key default gen_random_uuid(),
  business_account_id   uuid    references business_accounts(id) on delete set null,
  equipment_id          uuid    references equipment(id) on delete set null,
  aspen_customer_id     text    not null,
  aspen_equipment_id    text,
  aspen_work_order_id   text    not null unique,
  work_order_number     text,
  service_date          date,
  closed_date           date,
  description           text,    -- summary of work performed
  labor_hours           numeric(8,2),
  labor_amount          numeric(10,2),
  parts_amount          numeric(10,2),
  total_amount          numeric(10,2),
  technician_name       text,
  dealership_location_id uuid   references dealership_locations(id),
  line_items            jsonb,   -- [{type: 'labor'|'part', description, qty, amount}]
  imported_at           timestamptz not null default now(),
  last_synced_at        timestamptz not null default now(),
  raw_payload           jsonb
);

create index if not exists aspen_service_history_account_idx on aspen_service_history (business_account_id) where business_account_id is not null;
create index if not exists aspen_service_history_equipment_idx on aspen_service_history (equipment_id) where equipment_id is not null;
create index if not exists aspen_service_history_customer_idx on aspen_service_history (aspen_customer_id);
create index if not exists aspen_service_history_date_idx on aspen_service_history (service_date desc);

alter table aspen_service_history enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'aspen_service_history' and policyname = 'members read own service history') then
    create policy "members read own service history" on aspen_service_history for select
      using (business_account_id is not null and public.business_account_role(business_account_id) is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'aspen_service_history' and policyname = 'staff manage aspen service history') then
    create policy "staff manage aspen service history" on aspen_service_history
      for all using (public.is_staff()) with check (public.is_staff());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Promotion function — called when a customer is claimed
--    or during re-sync for already-claimed customers
-- ─────────────────────────────────────────────────────────────
create or replace function public.promote_aspen_customer_data(
  p_aspen_customer_id text,
  p_business_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eq_import aspen_equipment_imports%rowtype;
  new_equipment_id uuid;
begin
  -- Link invoice history to this business account
  update aspen_invoices
  set business_account_id = p_business_account_id
  where aspen_customer_id = p_aspen_customer_id
    and business_account_id is null;

  -- Link service history to this business account
  update aspen_service_history
  set business_account_id = p_business_account_id
  where aspen_customer_id = p_aspen_customer_id
    and business_account_id is null;

  -- Promote each equipment import that hasn't been promoted yet
  for eq_import in
    select * from aspen_equipment_imports
    where aspen_customer_id = p_aspen_customer_id
      and promoted_at is null
  loop
    -- Upsert into live equipment table keyed by aspen_equipment_id
    insert into equipment (
      business_account_id,
      aspen_equipment_id,
      aspen_customer_id,
      make,
      model,
      model_year,
      serial_number,
      category,
      purchase_date,
      purchase_dealership_location_id,
      current_hours
    )
    values (
      p_business_account_id,
      eq_import.aspen_equipment_id,
      p_aspen_customer_id,
      eq_import.make,
      eq_import.model,
      eq_import.model_year,
      eq_import.serial_number,
      eq_import.category,
      eq_import.purchase_date,
      eq_import.purchase_dealership_location_id,
      eq_import.current_hours
    )
    on conflict (aspen_equipment_id) do update
      set current_hours  = excluded.current_hours,
          updated_at     = now()
    returning id into new_equipment_id;

    -- Mark import as promoted
    update aspen_equipment_imports
    set promoted_equipment_id = new_equipment_id,
        promoted_at           = now()
    where id = eq_import.id;

    -- Link service history rows for this piece of equipment
    update aspen_service_history
    set equipment_id = new_equipment_id
    where aspen_equipment_id = eq_import.aspen_equipment_id
      and equipment_id is null;
  end loop;

  -- Re-sync hours on already-promoted equipment (subsequent syncs)
  update equipment e
  set current_hours = aei.current_hours,
      updated_at    = now()
  from aspen_equipment_imports aei
  where aei.aspen_customer_id   = p_aspen_customer_id
    and aei.promoted_at          is not null
    and aei.promoted_equipment_id = e.id
    and aei.current_hours        is not null
    and aei.current_hours        > coalesce(e.current_hours, 0);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Update handle_new_user() to call promotion on claim
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_account_id uuid;
  new_full_name            text;
  new_account_type         text;
  matched_import           aspen_customer_imports%rowtype;
begin
  new_full_name    := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  new_account_type := coalesce(new.raw_user_meta_data->>'account_type', 'customer');

  insert into public.profiles (id, account_type, full_name, phone)
  values (new.id, new_account_type, new_full_name, new.phone)
  on conflict (id) do nothing;

  if new_account_type = 'customer' then
    if new.phone is not null then
      select * into matched_import
      from aspen_customer_imports
      where phone = new.phone and claimed_at is null
      limit 1;
    end if;

    if matched_import.id is not null then
      new_business_account_id := matched_import.business_account_id;

      insert into public.business_account_members (business_account_id, profile_id, role, status)
      values (new_business_account_id, new.id, 'owner', 'active');

      update aspen_customer_imports
      set claimed_by_profile_id = new.id, claimed_at = now()
      where id = matched_import.id;

      -- Promote all Aspen history into live tables
      perform public.promote_aspen_customer_data(matched_import.aspen_customer_id, new_business_account_id);
    else
      insert into public.business_accounts (name)
      values (new_full_name || '''s Account')
      returning id into new_business_account_id;

      insert into public.business_account_members (business_account_id, profile_id, role, status)
      values (new_business_account_id, new.id, 'owner', 'active');
    end if;
  end if;

  return new;
end;
$$;
