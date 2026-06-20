-- Proven Power's two real locations (Oconomowoc + Waukesha, WI).
-- Lat/lng are approximate (geocoded from the street address) — verify before relying on
-- them for distance/map-pin accuracy.
insert into dealership_locations
  (name, address, city, state, zip, phone, after_hours_phone, latitude, longitude, hours, is_active)
values
  (
    'Proven Power - Oconomowoc',
    'N68 W36046 Hwy K',
    'Oconomowoc',
    'WI',
    '53066',
    '(920) 474-4890',
    null, -- TODO: after-hours/emergency breakdown number not yet confirmed
    43.1397,
    -88.4587,
    '{
      "monday": {"open": "08:00", "close": "17:00"},
      "tuesday": {"open": "08:00", "close": "17:00"},
      "wednesday": {"open": "08:00", "close": "17:00"},
      "thursday": {"open": "08:00", "close": "17:00"},
      "friday": {"open": "08:00", "close": "17:00"},
      "saturday": {"open": "08:00", "close": "12:00"},
      "sunday": null
    }'::jsonb,
    true
  ),
  (
    'Proven Power - Waukesha',
    'S65 W22065 National Ave',
    'Waukesha',
    'WI',
    '53189',
    '(262) 679-0100',
    null, -- TODO: after-hours/emergency breakdown number not yet confirmed
    42.9686,
    -88.2851,
    '{
      "monday": {"open": "08:00", "close": "17:00"},
      "tuesday": {"open": "08:00", "close": "17:00"},
      "wednesday": {"open": "08:00", "close": "17:00"},
      "thursday": {"open": "08:00", "close": "17:00"},
      "friday": {"open": "08:00", "close": "17:00"},
      "saturday": {"open": "08:00", "close": "12:00"},
      "sunday": null
    }'::jsonb,
    true
  );
