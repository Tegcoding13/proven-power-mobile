-- Fix status history "changed_by_profile_id": use auth.uid() (the actual
-- logged-in user making the change) instead of assigned_staff_profile_id
-- (which is often null if the request isn't yet assigned).

create or replace function public.handle_service_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into service_request_status_history (service_request_id, status, changed_by_profile_id)
    values (new.id, new.status, coalesce(auth.uid(), new.requested_by_profile_id));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into service_request_status_history (service_request_id, status, changed_by_profile_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;
