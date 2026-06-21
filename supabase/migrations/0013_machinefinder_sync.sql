-- Prep for syncing Proven Power's real used-inventory feed from John Deere's
-- MachineFinder platform (publicly exposed at provenpower.com/wp-json/mfp/v1/feed,
-- already used-only). Maps each feed dealerId to our dealership_locations row,
-- and lets inventory photos hot-link to MachineFinder's photo CDN instead of
-- re-uploading into our own storage bucket.

alter table dealership_locations add column machinefinder_dealer_id text unique;

update dealership_locations set machinefinder_dealer_id = '083326' where name = 'Proven Power - Oconomowoc';
update dealership_locations set machinefinder_dealer_id = '083276' where name = 'Proven Power - Waukesha';

alter table inventory_listing_photos add column external_url text;
alter table inventory_listing_photos alter column storage_path drop not null;
alter table inventory_listing_photos add constraint inventory_listing_photos_has_source
  check (storage_path is not null or external_url is not null);
