-- Removes the test accounts/equipment created while verifying the live
-- connection. Safe to run once, then delete this file — it's throwaway.
-- Deleting business_accounts cascades to business_account_members and
-- equipment (which cascades further to photos/documents/hour_readings/
-- maintenance_tasks). auth.users deletion separately cascades to profiles.

delete from business_accounts where name = 'Smoke Test''s Account';

delete from auth.users where email like 'smoketest+%@example.com';
