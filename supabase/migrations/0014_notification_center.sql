-- In-app notification center. A real inbox per profile, populated by triggers
-- on the events customers actually care about (service/parts/winter-storage
-- status changes, new messages). Distinct from notification_rules (which is
-- just channel/category preferences) — this is the actual feed the bell icon
-- reads from. Inserts only ever happen via SECURITY DEFINER trigger
-- functions; there's no direct insert policy for users.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_profile_unread_idx on notifications (profile_id, is_read, created_at desc);

alter table notifications enable row level security;

create policy "users read own notifications" on notifications for select
  using (profile_id = auth.uid());

create policy "users update own notifications" on notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared helper: notify every active member of a business account.
-- ---------------------------------------------------------------------------
create or replace function public.notify_business_account_members(
  p_business_account_id uuid, p_title text, p_body text, p_link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, title, body, link)
  select profile_id, p_title, p_body, p_link
  from business_account_members
  where business_account_id = p_business_account_id and status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- Service request status changes -> notify the customer side.
-- ---------------------------------------------------------------------------
create or replace function public.notify_service_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_business_account_members(
      new.business_account_id,
      'Service Request Updated',
      'Status changed to ' || replace(new.status, '_', ' '),
      '/service/' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger service_requests_notify_status_change
  after update on service_requests
  for each row execute function public.notify_service_request_status_change();

-- ---------------------------------------------------------------------------
-- Parts request status changes -> notify the customer side.
-- ---------------------------------------------------------------------------
create or replace function public.notify_parts_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_business_account_members(
      new.business_account_id,
      'Parts Request Updated',
      'Status changed to ' || replace(new.status, '_', ' '),
      '/parts/' || new.id
    );
  end if;
  return new;
end;
$$;

create trigger parts_requests_notify_status_change
  after update on parts_requests
  for each row execute function public.notify_parts_request_status_change();

-- ---------------------------------------------------------------------------
-- Winter storage status changes -> notify the customer side.
-- ---------------------------------------------------------------------------
create or replace function public.notify_winter_storage_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_business_account_members(
      new.business_account_id,
      'Winter Storage Updated',
      'Status changed to ' || replace(new.status, '_', ' '),
      '/winter-storage'
    );
  end if;
  return new;
end;
$$;

create trigger winter_storage_notify_status_change
  after update on winter_storage_signups
  for each row execute function public.notify_winter_storage_status_change();

-- ---------------------------------------------------------------------------
-- New messages from staff -> notify the customer side. (Not the reverse —
-- there's no admin notification inbox UI yet, so there'd be nothing to read
-- a staff-facing notification; the admin message queue already covers that.)
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  thread record;
  preview text;
begin
  if new.sender_type != 'staff' then
    return new;
  end if;

  select * into thread from message_threads where id = new.thread_id;
  preview := left(coalesce(new.body, 'New attachment'), 140);

  perform public.notify_business_account_members(
    thread.business_account_id, 'New Message', preview, '/messages/' || new.thread_id
  );

  return new;
end;
$$;

create trigger messages_notify_new
  after insert on messages
  for each row execute function public.notify_new_message();
