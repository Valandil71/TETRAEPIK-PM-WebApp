// /lib/sap/report-writer.ts
// Import report creation for manual SAP imports

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModifiedReportEntry } from './sync-utils';

export interface NewProjectReport {
  id: number;
  name: string;
  system: string;
  language_in: string | null;
  language_out: string | null;
}

export interface ImportReportWarning {
  type: 'instructions_unavailable';
  projectId: number;
  subProjectId: string;
  projectName: string;
  message: string;
}

export async function createImportReport(
  supabase: SupabaseClient,
  params: {
    triggeredBy: string | null;
    reportType: 'manual';
    newProjects: NewProjectReport[];
    modifiedProjects: ModifiedReportEntry[];
    warnings?: ImportReportWarning[];
    durationMs?: number;
  },
) {
  const {
    triggeredBy,
    reportType,
    newProjects,
    modifiedProjects,
    warnings = [],
    durationMs,
  } = params;

  if (newProjects.length === 0 && modifiedProjects.length === 0 && warnings.length === 0) {
    return { created: false, error: null };
  }

  const warningSummary = warnings.length > 0 ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : '';
  const summary = `Manual import: ${newProjects.length} new, ${modifiedProjects.length} modified${warningSummary}`;

  const { error } = await supabase.from('import_reports').insert({
    triggered_by: triggeredBy,
    report_type: reportType,
    new_projects: newProjects,
    modified_projects: modifiedProjects,
    warnings,
    summary,
    acknowledged_by: [],
    duration_ms: durationMs ?? null,
  });

  if (error) {
    console.error(`Failed to create ${reportType} import report:`, error.message);
    return { created: false, error: error.message };
  }

  return { created: true, error: null };
}
