-- Seed maintenance_schedule_templates with realistic John Deere service intervals.
-- The trigger in 0004_maintenance.sql fires on new equipment rows and new hour
-- readings, matching equipment.model ILIKE template.model_pattern.

insert into maintenance_schedule_templates
  (make, model_pattern, task_name, interval_hours, interval_months, interval_type, category)
values
  -- Universal: applies to all John Deere equipment
  ('John Deere', '%', 'Engine Oil & Filter Change',      200, null, 'hours',    'Engine'),
  ('John Deere', '%', 'Air Filter Inspection/Replacement', 400, null, 'hours',  'Engine'),
  ('John Deere', '%', 'Grease & Lubrication',              50,  null, 'hours',  'General'),
  ('John Deere', '%', 'Annual Safety Inspection',          null, 12,  'calendar', 'General'),
  ('John Deere', '%', 'Fuel Filter Replacement',           400, null, 'hours',   'Engine'),
  ('John Deere', '%', 'Battery Check & Terminal Clean',    null, 12,  'calendar', 'Electrical'),
  ('John Deere', '%', 'Coolant Level & Condition Check',   200, null, 'hours',   'Cooling'),

  -- Compact utility tractors: 1 series (1023E, 1025R, 1026R)
  ('John Deere', '10%', 'Transmission Fluid Change',      300, null, 'hours', 'Drivetrain'),
  ('John Deere', '10%', 'Hydraulic Oil & Filter Change',  400, null, 'hours', 'Hydraulics'),
  ('John Deere', '10%', 'Front Axle Differential Oil',    400, null, 'hours', 'Drivetrain'),

  -- Utility tractors: 2 series (2025R, 2032R, 2038R)
  ('John Deere', '2%R', 'Transmission Fluid Change',      500, null, 'hours', 'Drivetrain'),
  ('John Deere', '2%R', 'Hydraulic Oil & Filter Change',  500, null, 'hours', 'Hydraulics'),

  -- Utility tractors: 3 series (3025E, 3032E, 3033R, 3038E, 3039R, 3043D, 3046R)
  ('John Deere', '3%',  'Transmission Fluid Change',      500, null, 'hours', 'Drivetrain'),
  ('John Deere', '3%',  'Hydraulic Oil & Filter Change',  500, null, 'hours', 'Hydraulics'),
  ('John Deere', '3%',  'Front Axle Differential Oil',    500, null, 'hours', 'Drivetrain'),
  ('John Deere', '3%',  'PTO Clutch Inspection',          200, null, 'hours', 'Drivetrain'),

  -- Utility tractors: 4 series & 5 series
  ('John Deere', '4%',  'Transmission Fluid Change',      500, null, 'hours', 'Drivetrain'),
  ('John Deere', '4%',  'Hydraulic Oil & Filter Change',  500, null, 'hours', 'Hydraulics'),
  ('John Deere', '5%',  'Transmission Fluid Change',      500, null, 'hours', 'Drivetrain'),
  ('John Deere', '5%',  'Hydraulic Oil & Filter Change',  500, null, 'hours', 'Hydraulics'),

  -- Riding mowers: X300, X500, X700 series (X350, X380, X590, X730, X738, X758...)
  ('John Deere', 'X%',  'Blade Inspection & Sharpening',  25,  null, 'hours',    'Mower Deck'),
  ('John Deere', 'X%',  'Mower Belt Inspection',          100, null, 'hours',    'Mower Deck'),
  ('John Deere', 'X%',  'Mower Deck Cleaning & Wash',     25,  null, 'hours',    'Mower Deck'),
  ('John Deere', 'X%',  'Transaxle Oil Change',           null, 24,  'calendar', 'Drivetrain'),
  ('John Deere', 'X%',  'Spark Plug Replacement',         null, 12,  'calendar', 'Engine'),
  ('John Deere', 'X%',  'Tire Pressure Check',            25,  null, 'hours',    'General'),

  -- Zero-turn mowers: Z300, Z500, Z900 series
  ('John Deere', 'Z%',  'Blade Inspection & Sharpening',  25,  null, 'hours',    'Mower Deck'),
  ('John Deere', 'Z%',  'Mower Belt Inspection',          100, null, 'hours',    'Mower Deck'),
  ('John Deere', 'Z%',  'Hydraulic System Check',         100, null, 'hours',    'Hydraulics'),
  ('John Deere', 'Z%',  'Spark Plug Replacement',         null, 12,  'calendar', 'Engine'),
  ('John Deere', 'Z%',  'Tire Pressure Check',            25,  null, 'hours',    'General'),

  -- S-series riding mowers (S100–S180)
  ('John Deere', 'S%',  'Blade Inspection & Sharpening',  25,  null, 'hours',    'Mower Deck'),
  ('John Deere', 'S%',  'Mower Belt Inspection',          100, null, 'hours',    'Mower Deck'),
  ('John Deere', 'S%',  'Spark Plug Replacement',         null, 12,  'calendar', 'Engine'),

  -- Gator utility vehicles
  ('John Deere', 'Gator%', 'Transmission/Transaxle Service', 200, null, 'hours', 'Drivetrain'),
  ('John Deere', 'Gator%', 'Brake Inspection',               200, null, 'hours', 'Brakes'),
  ('John Deere', 'HPX%',   'Brake Inspection',               200, null, 'hours', 'Brakes'),
  ('John Deere', 'RSX%',   'Brake Inspection',               200, null, 'hours', 'Brakes'),
  ('John Deere', 'XUV%',   'Brake Inspection',               200, null, 'hours', 'Brakes'),
  ('John Deere', 'XUV%',   'Transmission Service',           500, null, 'hours', 'Drivetrain')
on conflict do nothing;

-- Re-generate tasks for any equipment already in the system now that templates exist.
-- This calls the existing SQL function from 0004_maintenance.sql.
do $$
declare
  eq_id uuid;
begin
  for eq_id in select id from equipment where deleted_at is null loop
    perform public.generate_maintenance_tasks_for_equipment(eq_id);
  end loop;
end;
$$;
