// /lib/sap/constants.ts
// Shared constants for SAP import operations

export const SAP_IMPORT_STATUS_ROW_ID = 1;
export const RATE_LIMIT_MINUTES = 3;
export const LOCK_TTL_MINUTES = 10;
export const SAP_DEADLINE_OFFSET_HOURS = -3;

/** Fields compared between current DB row and incoming SAP data for change reports */
export const TRACKED_FIELDS = [
  'name',
  'language_in',
  'language_out',
  'initial_deadline',
  'final_deadline',
  'system',
  'instructions',
  'words',
  'lines',
  'hours',
  'sap_pm',
  'project_type',
] as const;


/**
 * SAP-owned fields a PM can edit in "Edit project". Once edited they are listed in
 * projects.manual_fields and the SAP import stops overwriting them.
 */
export const MANUALLY_EDITABLE_SAP_FIELDS = [
  'instructions',
  'terminology_key',
  'translation_area',
  'work_list',
  'graph_id',
  'lxe_project',
  'lxe_projects',
] as const;

export type ManuallyEditableSapField = (typeof MANUALLY_EDITABLE_SAP_FIELDS)[number];
