// /lib/sap/report-writer.ts
// Import report creation for SAP imports (manual + cron)

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModifiedReportEntry } from './sync-utils';

export interface NewProjectReport {
  id: number;
  name: string;
  system: string;
  language_in: string | null;
  language_out: string | null;
}

export async function createImportReport(
  supabase: SupabaseClient,
  params: {
    triggeredBy: string | null;
    reportType: 'manual' | 'cron';
    newProjects: NewProjectReport[];
    modifiedProjects: ModifiedReportEntry[];
  },
) {
  const { triggeredBy, reportType, newProjects, modifiedProjects } = params;

  if (newProjects.length === 0 && modifiedProjects.length === 0) {
    return { created: false, error: null };
  }

  const summaryPrefix = reportType === 'manual' ? 'Manual import' : 'Scheduled sync';
  const summary = `${summaryPrefix}: ${newProjects.length} new, ${modifiedProjects.length} modified`;

  const { error } = await supabase.from('import_reports').insert({
    triggered_by: triggeredBy,
    report_type: reportType,
    new_projects: newProjects,
    modified_projects: modifiedProjects,
    summary,
    acknowledged_by: [],
  });

  if (error) {
    console.error(`Failed to create ${reportType} import report:`, error.message);
    return { created: false, error: error.message };
  }

  return { created: true, error: null };
}
