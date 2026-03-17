-- /supabase/migrations/20260317_add_acknowledge_import_report_rpc.sql
-- RPC to atomically append a user ID to the acknowledged_by array on an import report.
-- Uses array_append only if the user has not already acknowledged the report.

create or replace function acknowledge_import_report(
  p_report_id int,
  p_user_id   uuid
)
returns void
language sql
security definer
as $$
  update import_reports
  set acknowledged_by = array_append(acknowledged_by, p_user_id)
  where id = p_report_id
    and not (acknowledged_by @> array[p_user_id]);
$$;

-- Allow authenticated users to call this function
grant execute on function acknowledge_import_report(int, uuid) to authenticated;
