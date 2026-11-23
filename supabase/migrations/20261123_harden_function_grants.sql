-- Harden SECURITY DEFINER functions flagged by the Supabase security advisor.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase also grants it to anon and
-- authenticated. Every function in public is therefore callable through /rest/v1/rpc/<name>,
-- including by logged-out clients holding only the anon key.
--
-- What each function needs:
--   * Trigger functions (handle_*, broadcast_*): called only by their triggers. Postgres checks
--     EXECUTE when a trigger is created, not when it fires, so no API role needs it.
--   * current_user_role(), is_pm_or_admin(): used by authenticated-only RLS policies and by the
--     SECURITY INVOKER triggers prevent_role_escalation and restrict_assignment_update, which run
--     as the signed-in user. authenticated keeps EXECUTE; anon and PUBLIC lose it.
--   * acknowledge_import_report(): called by the app (hooks/sap/useImportReports.ts) as a
--     signed-in user. It used to append any p_user_id to acknowledged_by, even for anon. Now
--     only authenticated can call it, and only for itself (p_user_id must equal auth.uid()).
--     The signature is unchanged, so the deployed client keeps working.
--   * save_push_subscription(): already restricted to authenticated and uses auth.uid()
--     (20261011_add_push_notifications.sql). Not changed.
--
-- service_role keeps EXECUTE on everything (it has an explicit grant on each function).

-- ---------------------------------------------------------------------------------------------
-- 1. acknowledge_import_report: callers can only acknowledge as themselves.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_import_report(
  p_report_id int,
  p_user_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- p_user_id is kept for compatibility with existing callers, but it must be the caller.
  IF p_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Cannot acknowledge a report for another user' USING ERRCODE = '42501';
  END IF;

  UPDATE public.import_reports
  SET acknowledged_by = array_append(coalesce(acknowledged_by, '{}'::uuid[]), v_uid)
  WHERE id = p_report_id
    AND NOT (coalesce(acknowledged_by, '{}'::uuid[]) @> ARRAY[v_uid]);
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_import_report(int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_import_report(int, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Trigger-only functions: no API role may call them directly.
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_update()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_delete()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_project_changes()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_assignment_changes()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_import_report_changes()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_sap_import_status_changes() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. RLS helpers: signed-in users only.
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_pm_or_admin()    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pm_or_admin()    TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. Pin search_path on the functions that had none. All of them already schema-qualify
--    their references (realtime.broadcast_changes, public.projects).
-- ---------------------------------------------------------------------------------------------
ALTER FUNCTION public.broadcast_assignment_changes()        SET search_path = public, pg_temp;
ALTER FUNCTION public.broadcast_import_report_changes()     SET search_path = public, pg_temp;
ALTER FUNCTION public.broadcast_sap_import_status_changes() SET search_path = public, pg_temp;
ALTER FUNCTION public.project_systems()                     SET search_path = public, pg_temp;
