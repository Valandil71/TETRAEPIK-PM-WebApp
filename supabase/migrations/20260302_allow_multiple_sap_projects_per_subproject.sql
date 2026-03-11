-- Allow multiple local projects to map to the same SAP subproject.
-- This is required for:
-- 1. multi-translation-area imports (SSE/SSK/SSH)
-- 2. extra STM copies generated from term volumes

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_sap_subproject_id_key;

COMMENT ON COLUMN public.projects.sap_subproject_id IS
'SAP subproject identifier - not unique because one SAP subproject can map to multiple local projects';
