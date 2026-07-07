-- Allow promotions to be auto-synced from external sources (e.g. WordPress).
-- Manually-created promotions have external_source = null.

alter table promotions
  add column if not exists external_source text,
  add column if not exists external_id     text,
  add column if not exists external_url    text;

create unique index if not exists promotions_external_unique
  on promotions (external_source, external_id)
  where external_source is not null;
