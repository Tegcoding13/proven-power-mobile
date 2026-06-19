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
