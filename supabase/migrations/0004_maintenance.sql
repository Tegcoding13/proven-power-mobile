-- M2: Maintenance — schedule templates (admin/seed-managed reference data) and
-- auto-generated per-equipment maintenance tasks.
--
-- Generation is implemented as Postgres triggers (not an external cron job) so
-- it works without any separate running process: a new equipment row generates
-- its initial task set immediately, and a new hour reading re-evaluates whether
-- any "upcoming" task has become "due". A periodic apps/api job can still be
-- added later for calendar-based (date) due-status transitions, since those
-- aren't triggered by any row insert — see README.

create table maintenance_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  make text not null default 'John Deere',
  -- ILIKE pattern matched against equipment.model, e.g. '1025R' or '1025R%' or 'X3%'.
  model_pattern text not null,
  task_name text not null,
  interval_hours integer,
  interval_months integer,
  interval_type text not null check (interval_type in ('hours', 'calendar', 'both')),
  category text,
  parts_needed jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (interval_type = 'hours' and interval_hours is not null)
    or (interval_type = 'calendar' and interval_months is not null)
    or (interval_type = 'both' and interval_hours is not null and interval_months is not null)
  )
);

create table maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  template_id uuid references maintenance_schedule_templates(id),
  task_name text not null,
  due_at_hours numeric,
  due_at_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'due', 'overdue', 'completed', 'dismissed')),
  completed_at timestamptz,
  completed_service_request_id uuid, -- FK added once service_requests exists (M3 migration)
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_tasks_equipment_idx on maintenance_tasks (equipment_id, status);

-- Prevent duplicate open tasks for the same template+equipment.
create unique index maintenance_tasks_unique_open_template
  on maintenance_tasks (equipment_id, template_id)
  where template_id is not null and status in ('upcoming', 'due', 'overdue');

-- ---------------------------------------------------------------------------
-- Generation: match templates to an equipment row and create any missing tasks.
-- ---------------------------------------------------------------------------
create function public.generate_maintenance_tasks_for_equipment(target_equipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eq equipment%rowtype;
  tmpl maintenance_schedule_templates%rowtype;
begin
  select * into eq from equipment where id = target_equipment_id;
  if not found then
    return;
  end if;

  for tmpl in
    select * from maintenance_schedule_templates
    where is_active
      and eq.model ilike model_pattern
      and (make is null or eq.make ilike make)
  loop
    insert into maintenance_tasks (equipment_id, template_id, task_name, due_at_hours, due_at_date, status)
    values (
      eq.id,
      tmpl.id,
      tmpl.task_name,
      case when tmpl.interval_hours is not null then coalesce(eq.current_hours, 0) + tmpl.interval_hours else null end,
      case when tmpl.interval_months is not null then (coalesce(eq.purchase_date, current_date) + (tmpl.interval_months || ' months')::interval)::date else null end,
      'upcoming'
    )
    on conflict (equipment_id, template_id) where template_id is not null and status in ('upcoming', 'due', 'overdue')
    do nothing;
  end loop;
end;
$$;

create function public.handle_new_equipment_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_maintenance_tasks_for_equipment(new.id);
  return new;
end;
$$;

create trigger on_equipment_created_generate_maintenance
  after insert on equipment
  for each row execute function public.handle_new_equipment_maintenance();

-- Re-evaluate hours-based tasks whenever a new reading comes in: flip
-- "upcoming" to "due" once the logged hours reach the task's due_at_hours.
create function public.handle_hour_reading_maintenance_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update maintenance_tasks
  set status = 'due', updated_at = now()
  where equipment_id = new.equipment_id
    and status = 'upcoming'
    and due_at_hours is not null
    and due_at_hours <= new.hours;
  return new;
end;
$$;

create trigger on_hour_reading_check_maintenance
  after insert on equipment_hour_readings
  for each row execute function public.handle_hour_reading_maintenance_check();

-- (Shared helper, used by any table needing a generic updated_at bump.)
create function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger maintenance_tasks_set_updated_at
  before update on maintenance_tasks
  for each row execute function public.set_updated_at_now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table maintenance_schedule_templates enable row level security;
alter table maintenance_tasks enable row level security;

create policy "anyone authenticated reads active templates" on maintenance_schedule_templates for select
  using (is_active or public.is_manager());
create policy "managers write templates" on maintenance_schedule_templates for all
  using (public.is_manager())
  with check (public.is_manager());

create policy "members read own maintenance tasks" on maintenance_tasks for select
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "members update own maintenance tasks" on maintenance_tasks for update
  using (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  )
  with check (
    exists (select 1 from equipment e where e.id = equipment_id and (public.business_account_role(e.business_account_id) is not null or public.is_staff()))
  );
create policy "staff insert manual maintenance tasks" on maintenance_tasks for insert
  with check (public.is_staff());
