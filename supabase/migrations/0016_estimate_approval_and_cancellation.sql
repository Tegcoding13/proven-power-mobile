-- Customers had no RLS UPDATE policy on service_requests at all (only
-- staff did), so the "Approve Estimate" button silently failed — the update
-- matched zero rows and the client never checked the error. Rather than
-- opening a broad customer UPDATE policy on the whole row (which would also
-- let a customer rewrite assigned_staff_profile_id, dealership_location_id,
-- etc.), this is a narrow SECURITY DEFINER RPC that only ever touches the
-- three approval fields, and only when the caller is actually a member of
-- the business account that owns the request and there's a real estimate
-- to approve.

alter table service_requests add column estimate_notes text;

create or replace function public.approve_service_estimate(p_service_request_id uuid)
returns service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request service_requests%rowtype;
  result service_requests%rowtype;
begin
  select * into request from service_requests where id = p_service_request_id;

  if request.id is null then
    raise exception 'Service request not found.';
  end if;

  if public.business_account_role(request.business_account_id) is null then
    raise exception 'Not authorized to approve this estimate.';
  end if;

  if request.estimate_amount is null then
    raise exception 'There is no estimate to approve.';
  end if;

  update service_requests
  set estimate_approved_at = now(), estimate_approved_by = auth.uid(), status = 'approved'
  where id = p_service_request_id
  returning * into result;

  return result;
end;
$$;

grant execute on function public.approve_service_estimate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Same RLS gap on the cancel side: customers can submit a request but can't
-- update it at all, so there was no way to let them cancel one themselves.
-- Only allowed while status is still 'submitted' — once staff has
-- acknowledged/scheduled/started it, cancelling needs a human conversation,
-- not a self-serve button.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_service_request(p_service_request_id uuid)
returns service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request service_requests%rowtype;
  result service_requests%rowtype;
begin
  select * into request from service_requests where id = p_service_request_id;

  if request.id is null then
    raise exception 'Service request not found.';
  end if;

  if public.business_account_role(request.business_account_id) is null then
    raise exception 'Not authorized to cancel this request.';
  end if;

  if request.status <> 'submitted' then
    raise exception 'This request is already being worked on — message us if you need to cancel it.';
  end if;

  update service_requests set status = 'cancelled' where id = p_service_request_id returning * into result;
  return result;
end;
$$;

grant execute on function public.cancel_service_request(uuid) to authenticated;

create or replace function public.cancel_parts_request(p_parts_request_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request parts_requests%rowtype;
  result parts_requests%rowtype;
begin
  select * into request from parts_requests where id = p_parts_request_id;

  if request.id is null then
    raise exception 'Parts request not found.';
  end if;

  if public.business_account_role(request.business_account_id) is null then
    raise exception 'Not authorized to cancel this request.';
  end if;

  if request.status <> 'submitted' then
    raise exception 'This request is already being worked on — message us if you need to cancel it.';
  end if;

  update parts_requests set status = 'cancelled' where id = p_parts_request_id returning * into result;
  return result;
end;
$$;

grant execute on function public.cancel_parts_request(uuid) to authenticated;
