-- Maintenance reminder notifications.
-- send_maintenance_due_notifications() finds tasks that are due or overdue,
-- haven't had a reminder in the last 7 days, and notifies every active member
-- of the equipment's business account. Called by the web app's cron route.

create or replace function public.send_maintenance_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row record;
  notified integer := 0;
  equipment_row equipment%rowtype;
  equipment_label text;
begin
  for task_row in
    select mt.*
    from maintenance_tasks mt
    where mt.status in ('due', 'overdue')
      and (mt.reminder_sent_at is null or mt.reminder_sent_at < now() - interval '7 days')
  loop
    select * into equipment_row from equipment where id = task_row.equipment_id;

    equipment_label := coalesce(
      equipment_row.nickname,
      trim(coalesce(equipment_row.model_year::text || ' ', '') || coalesce(equipment_row.model, 'Equipment'))
    );

    perform public.notify_business_account_members(
      equipment_row.business_account_id,
      case task_row.status
        when 'overdue' then 'Maintenance Overdue — ' || equipment_label
        else 'Maintenance Due — ' || equipment_label
      end,
      task_row.task_name
        || case
          when task_row.due_at_hours is not null then ' (at ' || task_row.due_at_hours || ' hrs)'
          when task_row.due_at_date is not null   then ' (by ' || to_char(task_row.due_at_date, 'Mon DD') || ')'
          else ''
        end,
      '/garage/' || equipment_row.id
    );

    update maintenance_tasks
      set reminder_sent_at = now()
      where id = task_row.id;

    notified := notified + 1;
  end loop;

  return notified;
end;
$$;
