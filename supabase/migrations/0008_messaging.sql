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
