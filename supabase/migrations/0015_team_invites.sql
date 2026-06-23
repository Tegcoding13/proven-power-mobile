-- Multi-user business accounts: let an owner invite a teammate by email even
-- if that person hasn't signed up yet. The invite sits as a
-- business_account_members row with profile_id null + invited_email set;
-- handle_new_user() claims it automatically if someone signs up with a
-- matching email, same pattern as the Aspen phone-match claiming in 0011.

alter table business_account_members alter column profile_id drop not null;
alter table business_account_members add column invited_email text;

alter table business_account_members add constraint business_account_members_member_identity
  check (profile_id is not null or invited_email is not null);

create unique index business_account_members_pending_invite_idx
  on business_account_members (business_account_id, invited_email)
  where profile_id is null;

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
  matched_invite business_account_members%rowtype;
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
      if new.email is not null then
        select * into matched_invite
        from business_account_members
        where invited_email = new.email and profile_id is null
        limit 1;
      end if;

      if matched_invite.id is not null then
        update business_account_members
        set profile_id = new.id, status = 'active', invited_email = null
        where id = matched_invite.id;
      else
        insert into public.business_accounts (name)
        values (new_full_name || '''s Account')
        returning id into new_business_account_id;

        insert into public.business_account_members (business_account_id, profile_id, role, status)
        values (new_business_account_id, new.id, 'owner', 'active');
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner-triggered invite. Runs as SECURITY DEFINER specifically so it can
-- check auth.users for an existing account by email (not otherwise readable
-- by normal client roles) — if found, add them as an active member right
-- away instead of leaving a pending invite nobody will ever claim (the
-- handle_new_user claim path only fires on a brand-new signup).
-- ---------------------------------------------------------------------------
create or replace function public.invite_team_member(
  p_business_account_id uuid, p_email text, p_role text
)
returns business_account_members
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_user_id uuid;
  result business_account_members%rowtype;
begin
  if public.business_account_role(p_business_account_id) <> 'owner' and not public.is_staff() then
    raise exception 'Only the account owner can invite team members.';
  end if;

  if p_role not in ('owner', 'manager', 'operator') then
    raise exception 'Invalid role.';
  end if;

  select id into existing_user_id from auth.users where lower(email) = lower(p_email) limit 1;

  if existing_user_id is not null then
    insert into business_account_members (business_account_id, profile_id, role, status, invited_by)
    values (p_business_account_id, existing_user_id, p_role, 'active', auth.uid())
    on conflict (business_account_id, profile_id) do nothing
    returning * into result;
  else
    insert into business_account_members (business_account_id, invited_email, role, status, invited_by)
    values (p_business_account_id, lower(p_email), p_role, 'invited', auth.uid())
    returning * into result;
  end if;

  return result;
end;
$$;

grant execute on function public.invite_team_member(uuid, text, text) to authenticated;
