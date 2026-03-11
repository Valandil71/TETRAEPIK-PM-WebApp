-- Add a stable per-generated-project import key for SAP-sourced rows.
-- This allows one SAP subproject to map to multiple local projects safely.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_import_key text;

CREATE INDEX IF NOT EXISTS idx_projects_sap_import_key
ON public.projects(sap_subproject_id, sap_import_key)
WHERE sap_subproject_id IS NOT NULL AND sap_import_key IS NOT NULL;

COMMENT ON COLUMN public.projects.sap_import_key IS
'Stable internal key used to match one generated SAP import row to one local project row';
