-- Staff-entered manual bookings on winter_storage_signups for customers
-- who aren't using the app. All fields nullable — only populated for
-- manual entries (app signups use the equipment FK instead).

-- Manual bookings don't have a linked app account or equipment record
alter table winter_storage_signups
  alter column business_account_id drop not null,
  alter column equipment_id        drop not null;

alter table winter_storage_signups
  add column if not exists manual_customer_name    text,
  add column if not exists manual_customer_phone   text,
  add column if not exists manual_customer_email   text,
  add column if not exists manual_customer_address text,
  add column if not exists manual_unit             text,
  add column if not exists manual_serial_number    text,
  add column if not exists manual_tag_number       text,
  add column if not exists is_manual_booking       boolean not null default false;

-- Staff can insert manual bookings (RLS already allows staff all access)
-- No additional policy needed — existing staff policy covers insert/update.
