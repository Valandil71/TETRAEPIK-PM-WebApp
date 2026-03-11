// /types/sap.ts
// SAP TPM API response types and internal mapping types

// ============================================================================
// SAP API Response Types (from /v1/suppliers/projects endpoints)
// ============================================================================

/** Response from GET /v1/suppliers/projects */
export interface SapProjectDTO {
  projects: SapProject[];
}

/** Project from SAP (contains sub-projects) */
export interface SapProject {
  projectId: number;
  projectName: string;
  account: string;
  subProjects: SapSubProject[];
}

/** Sub-project summary from project list */
export interface SapSubProject {
  subProjectId: string;
  subProjectName: string;
  dmName: string;
  pmName: string;
  projectType: string;
}

/** Detailed sub-project info from GET /v1/suppliers/projects/{id}/subprojects/{subId} */
export interface SapSubProjectInfo {
  subProjectId: string;
  subProjectName: string;
  terminologyKey: string[];
  environment: SapEnvironment[];
  subProjectSteps: SapStep[];
}

/** Environment info for sub-project (matches OpenAPI EnvironmentModel) */
export interface SapEnvironment {
  contentId: string;
  environmentName: string;
  toolType: string;
  toolTypeDescription: string;
  projectUrl: string;
  graphId: string[];
  lxeProject: string[];
  translationArea: string[];
  worklist: string[];
  is_xtm: boolean;
  content_name: string;
  external_project_id: string;
  external_system: string;
}

/** Step within a sub-project (matches OpenAPI SubProjectStepsModel) */
export interface SapStep {
  contentId: string;
  serviceStep: string;
  stepText: string;
  slsLang: string;       // Target language
  sourceLang: string;    // Source language
  tGroup: string;
  startDate: string;     // ISO date string
  endDate: string;       // ISO date string
  hasInstructions: boolean;
  instructionsLastChangedAt: string;
  subProjectFiles: string;
  volume?: SapVolume[];
  stepStatusId: string;
  stepStatusDescription: string;
  // toolType is on EnvironmentModel per OpenAPI spec, not on steps.
  // Kept optional for backwards compat — extractSystem falls back to environment.
  toolType?: string;
}

/** Volume info within a step (matches OpenAPI VolumeModel) */
export interface SapVolume {
  volumeQuantity: number;
  volumeUnit: string;    // "Words", "Lines", etc.
  ceBillQuantity: number;
  ceBillUnit: string;
  activityText: string;
}

/** Response from GET /v1/suppliers/projects/{id}/subprojects/{subId}/instructions */
export interface SapInstructionDTO {
  instructions: SapInstruction[];
}

/** Individual instruction entry (matches OpenAPI InstructionModel) */
export interface SapInstruction {
  subProjectId: string;
  contentId: string;
  serviceStep: string;
  slsLang: string;
  lastChangedAt: string;
  instructionShort: string;
  instructionLong: string;
  isTemplate: boolean;
  deleted: boolean;
}

/** Detail entry within SAP error response */
export interface SapErrorDetail {
  message: string;
}

/** Nested error body inside SAP error responses (matches OpenAPI ErrorDto) */
export interface SapErrorBody {
  status: string;       // e.g. "404 NOT_FOUND", "401 UNAUTHORIZED"
  message: string;
  target: string;
  timestamp: string;    // ISO 8601 date-time
  details: SapErrorDetail[];
}

/** Top-level error response from SAP API */
export interface SapErrorDTO {
  error: SapErrorBody;
}

// ============================================================================
// OAuth Token Response
// ============================================================================

/** OAuth token response from SAP UAA */
export interface SapTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  jti?: string;
  id_token?: string;
  refresh_token?: string;
}

// ============================================================================
// Internal Types (for mapping SAP data to local database)
// ============================================================================

/** Data ready to be inserted/updated in the projects table */
export interface SapProjectForImport {
  sap_subproject_id: string;
  sap_import_key: string;
  name: string;
  language_in: string | null;
  language_out: string | null;
  initial_deadline: string | null;
  final_deadline: string | null;
  interim_deadline?: string | null;
  instructions: string | null;
  sap_instructions: SapInstructionEntry[] | null;
  system: string;
  api_source: 'TPM_sap_api';
  last_synced_at: string;
  sap_pm: string | null;
  project_type: string | null;
  terminology_key: string[] | null;
  lxe_project: string[] | null;
  translation_area: string[] | null;
  work_list: string[] | null;
  graph_id: string[] | null;
  lxe_projects: string[] | null;
  url: string | null;
  hours: number | null;
  words: number | null;
  lines: number | null;
}

/** SAP instruction entry stored in sap_instructions JSONB column */
export interface SapInstructionEntry {
  /** Title/summary from SAP */
  instructionShort: string;
  /** Full body from SAP */
  instructionLong: string;
  slsLang?: string;
  contentId?: string;
  /** @deprecated Use instructionLong or instructionShort. Kept for backward compat with existing DB data. */
  text?: string;
}

/** Request body for POST /api/sap/sync */
export interface SapSyncRequest {
  projects: Array<{
    projectId: number;    // SAP parent project ID
    subProjectId: string; // SAP sub-project ID
  }>;
}

// Zod schema for runtime validation of SapSyncRequest
import { z } from 'zod';

export const sapSyncRequestSchema = z.object({
  projects: z.array(
    z.object({
      projectId: z.number({ message: 'projectId must be a number' }),
      subProjectId: z.string().min(1, 'subProjectId is required'),
    })
  ).min(1, 'Request must include at least one project'),
});

/** Response from POST /api/sap/sync */
export interface SapSyncResponse {
  imported: number;  // New projects created
  updated: number;   // Existing projects updated
  failed: number;    // Projects that failed to import
  errors?: string[]; // Error messages for failed imports
  reportCreated?: boolean;
  reportCreationError?: string | null;
}

/** Response from GET /api/sap/projects (transformed for frontend) */
export interface SapProjectListItem {
  projectId: number;
  projectName: string;
  account: string;
  subProjects: SapSubProjectListItem[];
}

/** Sub-project item for the import list */
export interface SapSubProjectListItem {
  subProjectId: string;
  subProjectName: string;
  dmName: string;
  pmName: string;
  projectType: string;
  /** Whether this sub-project already exists in local DB */
  existsLocally: boolean;
  /** Local project ID if exists */
  localProjectId?: number;
  /** Whether local version needs update (SAP has newer data) */
  needsUpdate?: boolean;
}

/** Combined sub-project details (info + instructions) for import preview */
export interface SapSubProjectDetails {
  subProjectId: string;
  subProjectName: string;
  dmName: string;
  languages: {
    source: string | null;
    target: string | null;
  };
  deadlines: {
    start: string | null;
    end: string | null;
  };
  system: string;
  instructions: string | null;
  volumes: {
    words: number;
    lines: number;
  };
  projectType: string | null;
  terminologyKey: string[];
  translationArea: string[];
  hours: number;
}

// ============================================================================
// API Source Type
// ============================================================================

export type ApiSource = 'manual' | 'TPM_sap_api' | 'XTM_sap_api';

// ============================================================================
// System/ToolType Mapping
// ============================================================================

/** Map SAP toolType to local system value */
export const TOOL_TYPE_TO_SYSTEM: Record<string, string> = {
  'XTM': 'XTM',
  'LXE': 'LAT',
  'SSE': 'SSE',
  'STM': 'STM',
};

/** Default system when toolType is not recognized */
export const DEFAULT_SYSTEM = 'Unknown';
