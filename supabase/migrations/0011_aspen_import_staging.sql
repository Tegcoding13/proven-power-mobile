-- Aspen (Charter Software DMS) customer import staging — prep work ahead of
-- confirmed API access. The idea: a future sync job populates
-- aspen_customer_imports + a real business_accounts/equipment row for each
-- Aspen customer, keyed by phone number, BEFORE that person ever signs up.
-- When they eventually authenticate (today: email/password; future: phone
-- OTP) with a matching phone, handle_new_user() links their new profile to
-- the pre-existing business account instead of creating a blank solo one.
--
-- Nothing here changes today's sign-up behavior for unmatched phones/emails —
-- this is purely additive until an import actually runs.

create table aspen_customer_imports (
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

create index aspen_customer_imports_phone_idx on aspen_customer_imports (phone) where claimed_at is null;

alter table aspen_customer_imports enable row level security;

create policy "staff manage aspen imports" on aspen_customer_imports for all
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Extend handle_new_user(): if the new auth user's phone matches an
-- unclaimed import, link them to that pre-existing business account (as
-- owner) instead of creating a brand-new solo one. Falls through to today's
-- behavior if there's no match.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_account_id uuid;
  new_full_name text;
  new_account_type text;
  matched_import aspen_customer_imports%rowtype;
begin
  new_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);
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
      insert into public.business_account_members (business_account_id, profile_id, role, status)
      values (matched_import.business_account_id, new.id, 'owner', 'active');

      update aspen_customer_imports
      set claimed_by_profile_id = new.id, claimed_at = now()
      where id = matched_import.id;
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
