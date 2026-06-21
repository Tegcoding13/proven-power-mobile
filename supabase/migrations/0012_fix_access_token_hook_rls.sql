-- Fix: custom_access_token_hook was not marked SECURITY DEFINER, so when
-- Supabase Auth actually invokes it (as the supabase_auth_admin role, with
-- no request-scoped auth.uid()), the RLS policy on profiles silently
-- returned zero rows — account_type always fell back to 'customer', so
-- staff could never log into the admin app. The grants we added in 0001
-- (GRANT SELECT) don't bypass RLS by themselves; only SECURITY DEFINER
-- (running as the function's owner, who owns the table) does.
--
-- A manual test via the service-role key didn't catch this because the
-- service role bypasses RLS entirely, masking the exact bug.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_account_type text;
begin
  select account_type into user_account_type
  from public.profiles
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(claims, '{app_metadata, account_type}', to_jsonb(coalesce(user_account_type, 'customer')));
  event := jsonb_set(event, '{claims}', claims);

  return event;
end;
$$;
