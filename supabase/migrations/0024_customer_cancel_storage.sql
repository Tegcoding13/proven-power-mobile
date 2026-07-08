-- Allow customers to cancel their own winter storage signup while it is
-- still in the 'requested' state. The using clause restricts which rows
-- they can touch (must own the account + status must be 'requested'); the
-- with check clause restricts what they can set (only 'cancelled').

create policy "members cancel own requested signups" on winter_storage_signups
  for update
  using (
    public.business_account_role(business_account_id) is not null
    and status = 'requested'
  )
  with check (
    public.business_account_role(business_account_id) is not null
    and status = 'cancelled'
  );
