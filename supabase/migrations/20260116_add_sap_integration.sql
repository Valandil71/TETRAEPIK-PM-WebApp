-- SAP Integration Migration
-- Adds SAP reference fields to projects table and creates rate limiting table

-- ============================================================================
-- PART 1: Add SAP reference fields to projects table
-- ============================================================================

-- Unique identifier for SAP subprojects (prevents duplicates)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_subproject_id text UNIQUE;

-- SAP parent project reference
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_parent_id text;

-- SAP parent project name (denormalized for display)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_parent_name text;

-- SAP account name
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_account text;

-- Source tracking (manual, TPM_sap_api, or future XTM_sap_api)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS api_source text DEFAULT 'manual'
CHECK (api_source IN ('manual', 'TPM_sap_api', 'XTM_sap_api'));

-- Last sync timestamp for tracking when SAP data was refreshed
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- SAP Instructions (read-only, from SAP API - includes DM name)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sap_instructions text;

-- NOTE: The plan calls for renaming 'instructions' to 'custom_instructions'
-- This is deferred to a future migration after frontend is updated
-- For now, 'instructions' column is kept for backward compatibility

-- ============================================================================
-- PART 2: Create index for efficient SAP subproject lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_sap_subproject_id
ON public.projects(sap_subproject_id)
WHERE sap_subproject_id IS NOT NULL;

-- Index for finding all projects from a specific API source
CREATE INDEX IF NOT EXISTS idx_projects_api_source
ON public.projects(api_source)
WHERE api_source != 'manual';

-- ============================================================================
-- PART 3: Create SAP API rate limiting table
-- ============================================================================

-- Track SAP API usage per user for rate limiting (5-minute cooldown)
CREATE TABLE IF NOT EXISTS public.sap_api_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_fetch_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.sap_api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limit
CREATE POLICY "Users can view own rate limit"
  ON public.sap_api_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rate limit record
CREATE POLICY "Users can insert own rate limit"
  ON public.sap_api_rate_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rate limit
CREATE POLICY "Users can update own rate limit"
  ON public.sap_api_rate_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 4: Comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.projects.sap_subproject_id IS 'Unique SAP subproject identifier - used as upsert key';
COMMENT ON COLUMN public.projects.sap_parent_id IS 'SAP parent project ID (string)';
COMMENT ON COLUMN public.projects.sap_parent_name IS 'SAP parent project name (denormalized)';
COMMENT ON COLUMN public.projects.sap_account IS 'SAP account/client name';
COMMENT ON COLUMN public.projects.api_source IS 'Data source: manual, TPM_sap_api, or XTM_sap_api';
COMMENT ON COLUMN public.projects.last_synced_at IS 'Last time this project was synced from SAP';
COMMENT ON COLUMN public.projects.sap_instructions IS 'Read-only instructions from SAP (includes DM name)';
COMMENT ON COLUMN public.projects.instructions IS 'User-editable team notes (will be renamed to custom_instructions in future migration)';

COMMENT ON TABLE public.sap_api_rate_limits IS 'Rate limiting for SAP API calls (5-min cooldown per user)';
