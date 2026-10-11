// /lib/sap/one-time/deadline-split-migration.ts
//
// ONE-TIME-USE: delete this whole folder (lib/sap/one-time/) after the first production import
// that follows the "split INITIAL/FINAL always" change. Also remove the blocks marked
// `ONE-TIME-USE:BEGIN` ... `ONE-TIME-USE:END` in lib/sap/importer.ts.
// Find everything with: grep -rn "ONE-TIME-USE" .
//
// Context: until now a project whose initial deadline came from `finalVolumeAvailableOn` lived in
// ONE row carrying both deadlines. From now on every project with two deadlines is two rows
// (INITIAL + FINAL). This migrates those legacy rows, once per project:
//   - the legacy row becomes the FINAL row and keeps its translators;
//   - the new INITIAL row takes the translators when its deadline has not passed yet;
//   - an INITIAL (or FINAL) row whose deadline has passed is marked `complete`.
//
// Safety: the legacy row is only turned into FINAL AFTER the INITIAL row exists and its
// translators/status were handled. If any step fails, the legacy row is left untouched (it still
// carries both deadlines), so the next import detects it again and retries. Nothing is deleted.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SapProjectForImport } from '@/types/sap';
import type { FailureStage } from '../failure-log';
import { getDeadlineVariantFromImportKey, stripDeadlineVariantFromImportKey } from '../import-keys';
import { sanitizeImportData } from '../mappers';
import { findExistingProject, insertProjectFromSap, updateProjectFromSap } from '../project-writer';
import type { NewProjectReport } from '../report-writer';
import type { ModifiedReportEntry } from '../sync-utils';

/** ONE-TIME-USE */
export interface DeadlineSplitMigrationFailure {
  stage: FailureStage;
  message: string;
}

/** ONE-TIME-USE */
export interface DeadlineSplitMigrationResult {
  /** Import keys fully handled here; the regular import loop must skip them. */
  handledKeys: Set<string>;
  /** Newly inserted INITIAL rows. */
  imported: number;
  hadSuccessfulSync: boolean;
  newProjects: NewProjectReport[];
  modifiedProjects: ModifiedReportEntry[];
  failures: DeadlineSplitMigrationFailure[];
}

interface LegacyRow {
  id: number;
  status: string;
  initial_deadline: string | null;
  sap_import_key: string | null;
}

function hasPassed(isoDate: string | null, now: number): boolean {
  if (!isoDate) return false;
  const timestamp = Date.parse(isoDate);
  return !Number.isNaN(timestamp) && timestamp < now;
}

/**
 * ONE-TIME-USE
 * Migrates legacy single-row projects (both deadlines on one row) to the INITIAL/FINAL pair.
 * Only acts on INITIAL+FINAL pairs whose FINAL variant matches an existing row that still has an
 * initial deadline and a key without the FINAL suffix. Every other project is left to the regular
 * import loop.
 */
export async function migrateLegacyDeadlineSplits(params: {
  supabase: SupabaseClient;
  projects: SapProjectForImport[];
  includeSapInstructions: boolean;
  now?: Date;
}): Promise<DeadlineSplitMigrationResult> {
  const { supabase, projects, includeSapInstructions } = params;
  const now = (params.now ?? new Date()).getTime();

  const result: DeadlineSplitMigrationResult = {
    handledKeys: new Set<string>(),
    imported: 0,
    hadSuccessfulSync: false,
    newProjects: [],
    modifiedProjects: [],
    failures: [],
  };

  const pairs = new Map<string, { initial?: SapProjectForImport; final?: SapProjectForImport }>();
  for (const project of projects) {
    const variant = getDeadlineVariantFromImportKey(project.sap_import_key);
    if (!variant) continue;

    const baseKey = stripDeadlineVariantFromImportKey(project.sap_import_key);
    const pair = pairs.get(baseKey) ?? {};
    if (variant === 'INITIAL') pair.initial = project;
    else pair.final = project;
    pairs.set(baseKey, pair);
  }

  for (const pair of pairs.values()) {
    if (!pair.initial || !pair.final) continue;

    const initialData = sanitizeImportData(pair.initial);
    const finalData = sanitizeImportData(pair.final);

    // A failed lookup here is left to the regular loop, which hits the same error and reports it.
    const { data: match, error: matchError } = await findExistingProject(supabase, finalData);
    if (matchError || !match) continue;

    const { data: legacy, error: legacyError } = await supabase
      .from('projects')
      .select('id, status, initial_deadline, sap_import_key')
      .eq('id', match.id)
      .single<LegacyRow>();

    if (legacyError || !legacy) {
      // Untouched legacy row + handled keys: the regular loop must not strip its initial deadline.
      result.handledKeys.add(initialData.sap_import_key);
      result.handledKeys.add(finalData.sap_import_key);
      result.failures.push({
        stage: 'match',
        message: `Deadline split migration: could not read project #${match.id} (${finalData.sap_subproject_id}): ${legacyError?.message ?? 'not found'}`,
      });
      continue;
    }

    // Already split (FINAL key) or no initial deadline: nothing to migrate.
    if (legacy.sap_import_key === finalData.sap_import_key || !legacy.initial_deadline) continue;

    result.handledKeys.add(initialData.sap_import_key);
    result.handledKeys.add(finalData.sap_import_key);

    const fail = (stage: FailureStage, message: string) => {
      result.failures.push({
        stage,
        message: `Deadline split migration of project #${legacy.id} (${finalData.sap_subproject_id}) will retry on the next import: ${message}`,
      });
    };

    // 1. Create (or, on a retry, update) the INITIAL row.
    const { data: existingInitial, error: initialMatchError } = await findExistingProject(
      supabase,
      initialData
    );
    if (initialMatchError) {
      fail('match', initialMatchError.message);
      continue;
    }

    let initialId: number;
    if (existingInitial) {
      initialId = existingInitial.id;
      const { error, changes } = await updateProjectFromSap(supabase, initialId, initialData, {
        includeSapInstructions,
      });
      if (error) {
        fail('update', error);
        continue;
      }
      if (Object.keys(changes).length > 0) {
        result.modifiedProjects.push({ id: initialId, name: initialData.name, changes });
      }
    } else {
      const { id, error } = await insertProjectFromSap(supabase, initialData);
      if (error || id === null) {
        fail('insert', error ?? 'no id returned');
        continue;
      }
      initialId = id;
      result.imported++;
      result.newProjects.push({
        id,
        name: initialData.name,
        system: initialData.system,
        language_in: initialData.language_in,
        language_out: initialData.language_out,
      });
    }

    result.hadSuccessfulSync = true;

    // 2. Decide who owns the translators and the INITIAL status.
    //    Not active (already complete/cancelled): INITIAL inherits that status, translators stay.
    //    Initial deadline passed: INITIAL is complete, translators stay with FINAL.
    //    Otherwise: translators move to INITIAL.
    const initialStatus =
      legacy.status !== 'active' ? legacy.status
      : hasPassed(initialData.initial_deadline, now) ? 'complete'
      : null;

    if (initialStatus) {
      const { error } = await supabase
        .from('projects')
        .update({ status: initialStatus })
        .eq('id', initialId);
      if (error) {
        fail('update', `could not set INITIAL project #${initialId} to ${initialStatus}: ${error.message}`);
        continue;
      }
    } else {
      const { error } = await supabase
        .from('projects_assignment')
        .update({ project_id: initialId })
        .eq('project_id', legacy.id);
      if (error) {
        fail('update', `could not move translators to INITIAL project #${initialId}: ${error.message}`);
        continue;
      }
    }

    // 3. Only now does the legacy row become the FINAL row.
    const { error: finalError, changes } = await updateProjectFromSap(supabase, legacy.id, finalData, {
      includeSapInstructions,
    });
    if (finalError) {
      fail('update', finalError);
      continue;
    }
    if (Object.keys(changes).length > 0) {
      result.modifiedProjects.push({ id: legacy.id, name: finalData.name, changes });
    }

    if (hasPassed(finalData.final_deadline, now)) {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'complete' })
        .eq('id', legacy.id)
        .eq('status', 'active');
      if (error) {
        result.failures.push({
          stage: 'update',
          message: `Deadline split migration: could not mark FINAL project #${legacy.id} as complete: ${error.message}`,
        });
      }
    }
  }

  return result;
}
