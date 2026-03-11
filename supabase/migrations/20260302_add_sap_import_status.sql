-- Track global SAP import state so only one import can run at a time.

CREATE TABLE IF NOT EXISTS public.sap_import_status (
  id bigint PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'running', 'failed')),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  started_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sap_import_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read SAP import status"
  ON public.sap_import_status FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert SAP import status"
  ON public.sap_import_status FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update SAP import status"
  ON public.sap_import_status FOR UPDATE
  USING (auth.uid() IS NOT NULL);

INSERT INTO public.sap_import_status (id, status)
VALUES (1, 'idle')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.sap_import_status IS
'Singleton table tracking the global SAP import state';
