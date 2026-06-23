-- Two-store separation: every customer picks a home store (Oconomowoc or
-- Waukesha) right after verifying their account, stored on
-- business_accounts.primary_location_id (a field that already existed in
-- the schema but was never set anywhere). From then on, every service
-- request, parts request, and message thread that account creates is
-- automatically stamped with that store via a shared BEFORE INSERT trigger,
-- so admin can filter "who should be working on this" by location without
-- the customer having to pick a store on every single request.

alter table message_threads add column dealership_location_id uuid references dealership_locations(id);

create or replace function public.fill_dealership_location_from_business_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dealership_location_id is null then
    select primary_location_id into new.dealership_location_id
    from business_accounts where id = new.business_account_id;
  end if;
  return new;
end;
$$;

create trigger service_requests_fill_location
  before insert on service_requests
  for each row execute function public.fill_dealership_location_from_business_account();

create trigger parts_requests_fill_location
  before insert on parts_requests
  for each row execute function public.fill_dealership_location_from_business_account();

create trigger message_threads_fill_location
  before insert on message_threads
  for each row execute function public.fill_dealership_location_from_business_account();
