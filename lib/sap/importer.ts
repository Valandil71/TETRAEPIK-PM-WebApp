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
  failed: number;
  errors?: string[];
}

export async function runCronSync(
  supabase: SupabaseClient,
  sapClient: SapTpmApiClient,
): Promise<CronSyncResult> {
  // Get all projects that came from SAP
  const { data: sapProjects, error: fetchError } = await supabase
    .from('projects')
    .select('id, sap_subproject_id, sap_import_key, language_in, language_out, translation_area, system, project_type')
    .eq('api_source', 'TPM_sap_api')
    .not('sap_subproject_id', 'is', null);

  if (fetchError) {
    return { message: 'Failed to fetch projects', synced: 0, failed: 0, errors: [fetchError.message] };
  }

  if (!sapProjects || sapProjects.length === 0) {
    return { message: 'No SAP projects to sync', synced: 0, failed: 0 };
  }

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
  let failed = 0;
  const errors: string[] = [];
  const reportModifiedProjects: ModifiedReportEntry[] = [];

  // Cache API calls to avoid duplicate requests for same subproject
  const detailsCache = new Map<string, Awaited<ReturnType<typeof sapClient.getSubProjectDetails>>>();
  const instructionsCache = new Map<string, { instructions: Awaited<ReturnType<typeof sapClient.getInstructions>>['instructions'] }>();
  const importProjectsCache = new Map<string, Map<string, ReturnType<typeof sanitizeImportData>>>();

  for (const localProject of sapProjects) {
    try {
      if (isBlockedSapProjectType(localProject.project_type)) {
        continue;
      }

      const sapData = subProjectToParent.get(localProject.sap_subproject_id);
      if (!sapData) continue;

      const { parent, subProject } = sapData;
      const cacheKey = `${parent.projectId}|${subProject.subProjectId}`;

      // Populate caches if needed
      if (!detailsCache.has(cacheKey)) {
        const details = await sapClient.getSubProjectDetails(parent.projectId, subProject.subProjectId);
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

      if (!localProject.sap_import_key) continue;

      const matchingImport = importProjectsCache.get(cacheKey)?.get(localProject.sap_import_key);
      if (!matchingImport) continue;

      const { error, changes } = await updateProjectFromSap(supabase, localProject.id, matchingImport);

      if (error) {
        failed++;
        errors.push(`Project ${localProject.id}: ${error}`);
      } else {
        synced++;
        if (Object.keys(changes).length > 0) {
          reportModifiedProjects.push({ id: localProject.id, name: matchingImport.name, changes });
        }
      }
    } catch (error) {
      failed++;
      errors.push(
        `Project ${localProject.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  const mergedModifiedProjects = mergeModifiedProjects(reportModifiedProjects);

  await createImportReport(supabase, {
    triggeredBy: null,
    reportType: 'cron',
    newProjects: [],
    modifiedProjects: mergedModifiedProjects,
  });

  return {
    message: 'SAP sync complete',
    synced,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}
