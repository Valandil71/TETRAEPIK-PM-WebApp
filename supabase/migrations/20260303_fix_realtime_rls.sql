-- Fix cross-user realtime by switching from postgres_changes to broadcast triggers.
--
-- Problem: postgres_changes applies per-subscriber RLS checks before delivering
-- events. This caused User B's browser to never receive events for rows scoped
-- to User A, so realtime only worked within the same session.
--
-- Solution: Use realtime.broadcast_changes() triggers (Supabase recommended
-- production approach). The trigger fires server-side with SECURITY DEFINER
-- privileges, broadcasts to a named channel, and all authenticated subscribers
-- on that channel receive the event — no per-subscriber RLS check needed.
--
-- Components:
-- 1. RLS policies on realtime.messages (required for channel authorization)
-- 2. Permissive SELECT policies on tables (still needed for direct queries)
-- 3. Broadcast trigger functions + triggers on all 4 realtime tables
-- 4. REPLICA IDENTITY FULL so OLD record is available in UPDATE/DELETE payloads

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. RLS policies on realtime.messages
-- ════════════════════════════════════════════════════════════════════════════════

-- Required for any Realtime channel authorization — without these, private
-- channels will reject connections from authenticated users.

ALTER TABLE IF EXISTS "realtime"."messages" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON "realtime"."messages";
CREATE POLICY "Authenticated users can receive broadcasts"
  ON "realtime"."messages"
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send broadcasts" ON "realtime"."messages";
CREATE POLICY "Authenticated users can send broadcasts"
  ON "realtime"."messages"
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. Permissive SELECT policies on tables
-- ════════════════════════════════════════════════════════════════════════════════

-- These ensure any authenticated user can query these tables directly.
-- (Write policies are unchanged.)

DROP POLICY IF EXISTS "Authenticated users can read projects" ON public.projects;
CREATE POLICY "Authenticated users can read projects"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read project assignments" ON public.projects_assignment;
CREATE POLICY "Authenticated users can read project assignments"
  ON public.projects_assignment FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Ensure both tables are published to supabase_realtime publication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects_assignment;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. REPLICA IDENTITY FULL
-- ════════════════════════════════════════════════════════════════════════════════

-- Required so that UPDATE and DELETE triggers receive the full OLD record,
-- not just the primary key columns.

ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.projects_assignment REPLICA IDENTITY FULL;
ALTER TABLE public.import_reports REPLICA IDENTITY FULL;
ALTER TABLE public.sap_import_status REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. Broadcast trigger functions and triggers
-- ════════════════════════════════════════════════════════════════════════════════

-- Each trigger calls realtime.broadcast_changes() to push the change into
-- the 'db-changes' broadcast channel. All authenticated subscribers on that
-- channel receive the event server-side — no per-subscriber RLS filtering.
--
-- SET search_path = '' ensures the function can only reference
-- schema-qualified names, which is required for SECURITY DEFINER safety.

-- ── projects ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.broadcast_project_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'db-changes',       -- topic (channel name)
    TG_OP,              -- event
    TG_OP,              -- operation
    TG_TABLE_NAME,      -- table
    TG_TABLE_SCHEMA,    -- schema
    NEW,                -- new record
    OLD                 -- old record
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS broadcast_project_changes ON public.projects;
CREATE TRIGGER broadcast_project_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_project_changes();

-- ── projects_assignment ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.broadcast_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'db-changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS broadcast_assignment_changes ON public.projects_assignment;
CREATE TRIGGER broadcast_assignment_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.projects_assignment
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_assignment_changes();

-- ── import_reports ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.broadcast_import_report_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'db-changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS broadcast_import_report_changes ON public.import_reports;
CREATE TRIGGER broadcast_import_report_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.import_reports
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_import_report_changes();

-- ── sap_import_status ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.broadcast_sap_import_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'db-changes',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS broadcast_sap_import_status_changes ON public.sap_import_status;
CREATE TRIGGER broadcast_sap_import_status_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sap_import_status
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_sap_import_status_changes();

-- ════════════════════════════════════════════════════════════════════════════════
-- Diagnostic: Run this SELECT to verify everything is in place
-- ════════════════════════════════════════════════════════════════════════════════
--
-- SELECT tgname, tgrelid::regclass, tgfoid::regproc
-- FROM pg_trigger
-- WHERE tgname LIKE 'broadcast_%';
--
-- Should return 4 rows:
--   broadcast_project_changes        | projects            | broadcast_project_changes
--   broadcast_assignment_changes     | projects_assignment | broadcast_assignment_changes
--   broadcast_import_report_changes  | import_reports      | broadcast_import_report_changes
--   broadcast_sap_import_status_changes | sap_import_status | broadcast_sap_import_status_changes
