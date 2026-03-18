// /lib/sap/importer.ts
// SAP import orchestrators — no HTTP dependencies, callable from any context

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SapTpmApiClient } from './client';
import type { SapSyncResponse } from '@/types/sap';
import { mapSapSubProjectToProjects, sanitizeImportData } from './mappers';
import { dedupeImportProjects, mergeModifiedProjects } from './sync-utils';
import { createFailureRecorder } from './failure-log';
import { findExistingProject, updateProjectFromSap, insertProjectFromSap } from './project-writer';
import { createImportReport, type NewProjectReport } from './report-writer';
import type { ModifiedReportEntry } from './sync-utils';
import { isBlockedSapProjectType } from './project-type-rules';

// ---------------------------------------------------------------------------
// Manual Import
// ---------------------------------------------------------------------------

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

  // Fetch all SAP projects to resolve parent info
  const sapProjectsData = await sapClient.getProjects();
  const sapProjectsMap = new Map(
    sapProjectsData.projects.map(p => [p.projectId, p])
  );

  const failures = createFailureRecorder();
  const reportNewProjects: NewProjectReport[] = [];
  const reportModifiedProjects: ModifiedReportEntry[] = [];

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
      const instructionsData = needsInstructions
        ? await sapClient.getInstructions(projectId, subProjectId).catch(() => ({ instructions: [] as never[] }))
        : { instructions: [] as never[] };

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
          const { error, changes } = await updateProjectFromSap(supabase, existing.id, sanitizedData);
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

  // Create import report
  const { created: reportCreated, error: reportCreationError } = await createImportReport(supabase, {
    triggeredBy: userId,
    reportType: 'manual',
    newProjects: reportNewProjects,
    modifiedProjects: mergedModifiedProjects,
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

// ---------------------------------------------------------------------------
// Cron Sync
// ---------------------------------------------------------------------------

export interface CronSyncResult {
  message: string;
  synced: number;
  imported: number;
  failed: number;
  errors?: string[];
}

export async function runCronSync(
  supabase: SupabaseClient,
  sapClient: SapTpmApiClient,
): Promise<CronSyncResult> {
  // Fetch all SAP projects once
  const sapProjectsData = await sapClient.getProjects();

  // Build subProjectId → parent map
  const subProjectToParent = new Map<string, { parent: typeof sapProjectsData.projects[0]; subProject: typeof sapProjectsData.projects[0]['subProjects'][0] }>();
  for (const parent of sapProjectsData.projects) {
    for (const sub of parent.subProjects) {
      subProjectToParent.set(sub.subProjectId, { parent, subProject: sub });
    }
  }

  let synced = 0;
  let imported = 0;
  const startedAt = Date.now();
  const failures = createFailureRecorder();
  const reportNewProjects: NewProjectReport[] = [];
  const reportModifiedProjects: ModifiedReportEntry[] = [];

  // Cache API calls to avoid duplicate requests for same subproject
  const detailsCache = new Map<string, Awaited<ReturnType<typeof sapClient.getSubProjectDetails>>>();
  const instructionsCache = new Map<string, { instructions: Awaited<ReturnType<typeof sapClient.getInstructions>>['instructions'] }>();
  const importProjectsCache = new Map<string, Map<string, ReturnType<typeof sanitizeImportData>>>();

  for (const [, { parent, subProject }] of subProjectToParent) {
    if (isBlockedSapProjectType(subProject.projectType)) {
      continue;
    }

    const cacheKey = `${parent.projectId}|${subProject.subProjectId}`;

    try {
      // Populate caches if needed
      if (!detailsCache.has(cacheKey)) {
        let details;
        try {
          details = await sapClient.getSubProjectDetails(parent.projectId, subProject.subProjectId);
        } catch (error) {
          failures.record('details', `${subProject.subProjectId}: Failed to fetch details: ${error instanceof Error ? error.message : 'Unknown error'}`, parent.projectId, subProject.subProjectId);
          continue;
        }
        detailsCache.set(cacheKey, details);

        const needsInstructions = details.subProjectSteps.some(s => s.hasInstructions);
        const instructionsData = needsInstructions
          ? await sapClient.getInstructions(parent.projectId, subProject.subProjectId)
              .catch(() => ({ instructions: [] as never[] }))
          : { instructions: [] as never[] };
        instructionsCache.set(cacheKey, instructionsData);
      }

      const details = detailsCache.get(cacheKey)!;
      const instructionsData = instructionsCache.get(cacheKey)!;

      if (!importProjectsCache.has(cacheKey)) {
        const importProjects = dedupeImportProjects(mapSapSubProjectToProjects(
          subProject,
          parent,
          details,
          instructionsData.instructions
        ));

        importProjectsCache.set(
          cacheKey,
          new Map(importProjects.map((project) => {
            const sanitized = sanitizeImportData(project);
            return [sanitized.sap_import_key, sanitized] as const;
          }))
        );
      }

      const importProjects = importProjectsCache.get(cacheKey)!;

      for (const [, sanitizedData] of importProjects) {
        try {
          const { data: existing, error: matchError } = await findExistingProject(supabase, sanitizedData);

          if (matchError) {
            failures.record('match', `${subProject.subProjectId}: Failed to match: ${matchError.message}`, parent.projectId, subProject.subProjectId);
            continue;
          }

          if (existing) {
            const { error, changes } = await updateProjectFromSap(supabase, existing.id, sanitizedData);
            if (error) {
              failures.record('update', `Project ${existing.id}: ${error}`, parent.projectId, subProject.subProjectId);
            } else {
              synced++;
              if (Object.keys(changes).length > 0) {
                reportModifiedProjects.push({ id: existing.id, name: sanitizedData.name, changes });
              }
            }
          } else {
            const { id, error } = await insertProjectFromSap(supabase, sanitizedData);
            if (error) {
              failures.record('insert', `${subProject.subProjectId}: Failed to insert: ${error}`, parent.projectId, subProject.subProjectId);
            } else {
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
        } catch (error) {
          failures.record('process', `${subProject.subProjectId}: ${error instanceof Error ? error.message : 'Unknown error'}`, parent.projectId, subProject.subProjectId);
        }
      }
    } catch (error) {
      failures.record('process', `${subProject.subProjectId}: ${error instanceof Error ? error.message : 'Unknown error'}`, parent.projectId, subProject.subProjectId);
    }
  }

  const mergedModifiedProjects = mergeModifiedProjects(reportModifiedProjects);

  await createImportReport(supabase, {
    triggeredBy: null,
    reportType: 'cron',
    newProjects: reportNewProjects,
    modifiedProjects: mergedModifiedProjects,
    durationMs: Date.now() - startedAt,
  });

  return {
    message: 'SAP sync complete',
    synced,
    imported,
    failed: failures.failedCount,
    errors: failures.errorMessages.length > 0 ? failures.errorMessages : undefined,
  };
}
