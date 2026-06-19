-- Combined seed data: Proven Power's real locations + sample maintenance templates.
-- Run this AFTER combined_migrations.sql.

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
    '(262) 781-9050',
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

-- Sample maintenance schedule templates for common John Deere compact/utility
-- models. Replace/expand with the dealership's actual factory schedules —
-- these are reasonable placeholders so M2 is demoable end-to-end.

insert into maintenance_schedule_templates (make, model_pattern, task_name, interval_hours, interval_months, interval_type, category, parts_needed) values
  ('John Deere', '1025R%', 'Engine oil & filter change', 50, null, 'hours', 'fluids', '[{"description": "Engine oil (Plus-50 II)"}, {"description": "Oil filter AM125424"}]'),
  ('John Deere', '1025R%', 'Hydraulic/transmission filter change', 200, null, 'hours', 'filters', '[{"description": "Hydraulic filter AM126476"}]'),
  ('John Deere', '1025R%', 'Annual inspection', null, 12, 'calendar', 'inspection', null),
  ('John Deere', '2025R%', 'Engine oil & filter change', 50, null, 'hours', 'fluids', '[{"description": "Engine oil (Plus-50 II)"}, {"description": "Oil filter AM125424"}]'),
  ('John Deere', '2025R%', 'Annual inspection', null, 12, 'calendar', 'inspection', null),
  ('John Deere', 'X3%', 'Engine oil & filter change', 100, null, 'hours', 'fluids', '[{"description": "Engine oil"}, {"description": "Oil filter GY20577"}]'),
  ('John Deere', 'X3%', 'Air filter check/replace', 100, null, 'hours', 'filters', '[{"description": "Air filter GY21055"}]'),
  ('John Deere', 'X3%', 'Annual blade sharpening/inspection', null, 12, 'calendar', 'inspection', null),
  ('John Deere', 'Z3%', 'Engine oil & filter change', 100, null, 'hours', 'fluids', '[{"description": "Engine oil"}, {"description": "Oil filter GY20577"}]'),
  ('John Deere', 'Z3%', 'Annual inspection', null, 12, 'calendar', 'inspection', null);
