-- Slim the realtime broadcast for public.projects.
--
-- realtime.broadcast_changes() sent the whole old and new row, including sap_instructions
-- and sap_instructions_html: ~67 KB per UPDATE, delivered to every connected client. That
-- was ~93% of the project's egress. RealtimeProvider only reads id and status from these
-- messages (to pick which lists to refetch), so only those are sent now.
--
-- The message shape is unchanged ({ record, old_record, operation, table, schema } on the
-- private 'db-changes' topic); it is built here and passed to realtime.send(), which is what
-- broadcast_changes() does internally. One difference: send() turns a failure into a
-- warning, so a realtime problem can no longer make the project write itself fail.
--
-- Need another field in the client? Add it to both jsonb_build_object calls below.

CREATE OR REPLACE FUNCTION public.broadcast_project_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'record',     CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('id', NEW.id, 'status', NEW.status) END,
      'old_record', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('id', OLD.id, 'status', OLD.status) END,
      'operation',  TG_OP,
      'table',      TG_TABLE_NAME,
      'schema',     TG_TABLE_SCHEMA
    ),
    TG_OP,          -- event
    'db-changes',   -- topic (channel name)
    true            -- private: same RLS on realtime.messages as before
  );
  RETURN NULL;
END;
$$;
