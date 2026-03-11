// /lib/sap/project-writer.ts
// Shared DB operations for writing SAP-sourced projects

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SapProjectForImport } from '@/types/sap';
import { TRACKED_FIELDS } from './constants';
import { collectTrackedChanges, type ReportChanges } from './sync-utils';

interface BuildPayloadOptions {
  includeVolumes?: boolean;
}

/** The set of SAP-owned fields written on insert/update */
export function buildSapUpdatePayload(
  data: SapProjectForImport,
  options: BuildPayloadOptions = {}
) {
  const { includeVolumes = true } = options;

  const payload = {
    sap_import_key: data.sap_import_key,
    name: data.name,
    language_in: data.language_in,
    language_out: data.language_out,
    initial_deadline: data.initial_deadline,
    final_deadline: data.final_deadline,
    system: data.system,
    instructions: data.instructions,
    sap_instructions: data.sap_instructions,
    sap_pm: data.sap_pm,
    project_type: data.project_type,
    terminology_key: data.terminology_key,
    lxe_project: data.lxe_project,
    translation_area: data.translation_area,
    work_list: data.work_list,
    graph_id: data.graph_id,
    lxe_projects: data.lxe_projects,
    url: data.url,
    hours: data.hours,
    last_synced_at: data.last_synced_at,
  };

  if (!includeVolumes) {
    return payload;
  }

  return {
    ...payload,
    words: data.words,
    lines: data.lines,
  };
}

/**
 * Find an existing local project matching the given SAP import data.
 * Primary: exact match on sap_subproject_id + sap_import_key.
 * Fallback: legacy match (sap_import_key IS NULL) for migration.
 */
export async function findExistingProject(
  supabase: SupabaseClient,
  data: SapProjectForImport,
) {
  const exactMatch = await supabase
    .from('projects')
    .select('id')
    .eq('sap_subproject_id', data.sap_subproject_id)
    .eq('sap_import_key', data.sap_import_key)
    .maybeSingle();

  if (exactMatch.error) return exactMatch;
  if (exactMatch.data) return exactMatch;

  // Legacy fallback: match by system + languages when import key is null
  let legacyQuery = supabase
    .from('projects')
    .select('id')
    .eq('sap_subproject_id', data.sap_subproject_id)
    .is('sap_import_key', null)
    .eq('system', data.system);

  if (data.language_in) {
    legacyQuery = legacyQuery.eq('language_in', data.language_in);
  } else {
    legacyQuery = legacyQuery.is('language_in', null);
  }

  if (data.language_out) {
    legacyQuery = legacyQuery.eq('language_out', data.language_out);
  } else {
    legacyQuery = legacyQuery.is('language_out', null);
  }

  const multiTaSystems = ['SSE', 'SSK', 'SSH'];
  if (multiTaSystems.includes(data.system) && data.translation_area?.length) {
    legacyQuery = legacyQuery.contains('translation_area', [data.translation_area[0]]);
  }

  const legacyMatches = await legacyQuery.limit(2);
  if (legacyMatches.error) {
    return { data: null, error: legacyMatches.error };
  }

  if ((legacyMatches.data?.length || 0) === 1) {
    return { data: legacyMatches.data![0], error: null };
  }

  return { data: null, error: null };
}

/** Update an existing project with SAP-owned fields and return tracked changes */
export async function updateProjectFromSap(
  supabase: SupabaseClient,
  existingId: number,
  data: SapProjectForImport,
): Promise<{ error: string | null; changes: ReportChanges }> {
  // Fetch current values for change tracking
  const { data: currentProject } = await supabase
    .from('projects')
    .select('name, language_in, language_out, initial_deadline, final_deadline, system, instructions, words, lines, hours, sap_pm, project_type')
    .eq('id', existingId)
    .single();

  const trackedFields = TRACKED_FIELDS.filter(
    (field) => field !== 'words' && field !== 'lines'
  );

  const changes = currentProject
    ? collectTrackedChanges(currentProject, data, trackedFields)
    : {};

  const { error: updateError } = await supabase
    .from('projects')
    .update(buildSapUpdatePayload(data, { includeVolumes: false }))
    .eq('id', existingId);

  if (updateError) {
    return { error: updateError.message, changes: {} };
  }

  return { error: null, changes };
}

/** Insert a new project from SAP data and return the inserted ID */
export async function insertProjectFromSap(
  supabase: SupabaseClient,
  data: SapProjectForImport,
): Promise<{ id: number | null; error: string | null }> {
  const { data: inserted, error: insertError } = await supabase
    .from('projects')
    .insert({
      ...buildSapUpdatePayload(data),
      sap_subproject_id: data.sap_subproject_id,
      api_source: data.api_source,
      status: 'active',
    })
    .select('id')
    .single();

  if (insertError) {
    return { id: null, error: insertError.message };
  }

  return { id: inserted.id, error: null };
}

