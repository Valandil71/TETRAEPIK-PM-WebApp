// /lib/sap/importer.ts
// SAP import orchestrator - no HTTP dependencies, callable from any context

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SapTpmApiClient } from './client';
import type { SapSyncResponse } from '@/types/sap';
import { mapSapSubProjectToProjects, sanitizeImportData } from './mappers';
import { dedupeImportProjects, mergeModifiedProjects } from './sync-utils';
import { createFailureRecorder } from './failure-log';
import { findExistingProject, updateProjectFromSap, insertProjectFromSap } from './project-writer';
import { createImportReport, type ImportReportWarning, type NewProjectReport } from './report-writer';
import type { ModifiedReportEntry } from './sync-utils';
import { isBlockedSapProjectType } from './project-type-rules';

export interface ManualImportParams {
  supabase: SupabaseClient;
  sapClient: SapTpmApiClient;
  projects: Array<{ projectId: number; subProjectId: string }>;
  userId: string;
}

export interface ManualImportResult extends SapSyncResponse {
  hadSuccessfulSync: boolean;
}

export async function runManualImport(params: ManualImportParams): Promise<ManualImportResult> {
  const { supabase, sapClient, projects, userId } = params;

  const sapProjectsData = await sapClient.getProjects();
  const sapProjectsMap = new Map(
    sapProjectsData.projects.map(p => [p.projectId, p])
  );

  const failures = createFailureRecorder();
  const reportNewProjects: NewProjectReport[] = [];
  const reportModifiedProjects: ModifiedReportEntry[] = [];
  const reportWarnings: ImportReportWarning[] = [];

  let imported = 0;
  let hadSuccessfulSync = false;
  const startedAt = Date.now();

  for (const { projectId, subProjectId } of projects) {
    try {
      const parent = sapProjectsMap.get(projectId);
      if (!parent) {
        failures.record('lookup', `Parent project ${projectId} not found`, projectId, subProjectId);
        continue;
      }

      const subProject = parent.subProjects.find(s => s.subProjectId === subProjectId);
      if (!subProject) {
        failures.record('lookup', `Subproject ${subProjectId} not found in project ${projectId}`, projectId, subProjectId);
        continue;
      }
      if (isBlockedSapProjectType(subProject.projectType)) {
        continue;
      }

      let details;
      try {
        details = await sapClient.getSubProjectDetails(projectId, subProjectId);
      } catch (error) {
        failures.record(
          'details',
          `Failed to fetch details for ${subProjectId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          projectId,
          subProjectId
        );
        continue;
      }

      const needsInstructions = details.subProjectSteps.some(s => s.hasInstructions);
      let instructionsUnavailable = false;
      let instructionsData: Awaited<ReturnType<typeof sapClient.getInstructions>> | { instructions: never[] } = { instructions: [] };

      if (needsInstructions) {
        try {
          instructionsData = await sapClient.getInstructions(projectId, subProjectId);
        } catch (error) {
          instructionsUnavailable = true;
          reportWarnings.push({
            type: 'instructions_unavailable',
            projectId,
            subProjectId,
            projectName: `${subProject.subProjectId}: ${parent.projectName} | ${subProject.subProjectName}`,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const importProjects = dedupeImportProjects(mapSapSubProjectToProjects(
        subProject,
        parent,
        details,
        instructionsData.instructions
      ));

      for (const importData of importProjects) {
        const sanitizedData = sanitizeImportData(importData);

        const { data: existing, error: matchError } = await findExistingProject(supabase, sanitizedData);

        if (matchError) {
          failures.record('match', `Failed to match ${subProjectId}: ${matchError.message}`, projectId, subProjectId);
          continue;
        }

        if (existing) {
          const { error, changes } = await updateProjectFromSap(supabase, existing.id, sanitizedData, {
            includeSapInstructions: !instructionsUnavailable,
          });
          if (error) {
            failures.record('update', `Failed to update ${subProjectId}: ${error}`, projectId, subProjectId);
          } else {
            hadSuccessfulSync = true;
            if (Object.keys(changes).length > 0) {
              reportModifiedProjects.push({ id: existing.id, name: sanitizedData.name, changes });
            }
          }
        } else {
          const { id, error } = await insertProjectFromSap(supabase, sanitizedData);
          if (error) {
            failures.record('insert', `Failed to import ${subProjectId}: ${error}`, projectId, subProjectId);
          } else {
            hadSuccessfulSync = true;
            imported++;
            reportNewProjects.push({
              id: id!,
              name: sanitizedData.name,
              system: sanitizedData.system,
              language_in: sanitizedData.language_in,
              language_out: sanitizedData.language_out,
            });
          }
        }
      }
    } catch (error) {
      failures.record(
        'process',
        `Error processing ${subProjectId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        projectId,
        subProjectId
      );
    }
  }

  const mergedModifiedProjects = mergeModifiedProjects(reportModifiedProjects);

  const { created: reportCreated, error: reportCreationError } = await createImportReport(supabase, {
    triggeredBy: userId,
    reportType: 'manual',
    newProjects: reportNewProjects,
    modifiedProjects: mergedModifiedProjects,
    warnings: reportWarnings,
    durationMs: Date.now() - startedAt,
  });

  const result: ManualImportResult = {
    imported,
    updated: mergedModifiedProjects.length,
    failed: failures.failedCount,
    hadSuccessfulSync,
    reportCreated,
    reportCreationError,
  };

  if (failures.errorMessages.length > 0) {
    result.errors = failures.errorMessages;
  }

  return result;
}
