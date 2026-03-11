// /lib/sap/constants.ts
// Shared constants for SAP import operations

export const SAP_IMPORT_STATUS_ROW_ID = 1;
export const RATE_LIMIT_MINUTES = 3;
export const LOCK_TTL_MINUTES = 10;

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

