// /lib/sap/step-groups.ts
// Step grouping and multi-project splitting logic

import type {
  SapProject,
  SapSubProject,
  SapSubProjectInfo,
  SapInstruction,
  SapStep,
  SapProjectForImport,
} from '@/types/sap';
import {
  extractSystem,
  extractTerminologyKeys,
  extractTranslationAreas,
  extractLxeProjects,
  extractWorkLists,
  extractGraphIds,
  extractUrl,
  extractSapPm,
  extractProjectType,
} from './extract-fields';
import { buildInstructions, buildSapInstructions } from './instructions';
import { sanitizeString } from './mappers';
import { isBlockedSapProjectType } from './project-type-rules';

// ============================================================================
// Step Joining (TRANSLFWL + TRANSLREGU)
// ============================================================================

export interface JoinedStepGroup {
  contentId: string;
  languageIn: string | null;
  languageOut: string | null;
  initialDeadline: string | null;  // from TRANSLREGU endDate
  finalDeadline: string | null;    // from TRANSLFWL endDate
  words: number;
  lines: number;
  hours: number;
  terms: number;
  hasTermsInFwl: boolean;
  allSteps: SapStep[];
}

/**
 * Group steps by contentId + language pair, joining TRANSLFWL and TRANSLREGU.
 * TRANSLREGU endDate → initial_deadline
 * TRANSLFWL endDate → final_deadline
 */
export function joinSteps(steps: SapStep[]): JoinedStepGroup[] {
  const groups = new Map<string, JoinedStepGroup>();

  for (const step of steps) {
    const key = `${step.contentId}|${step.sourceLang}|${step.slsLang}`;

    if (!groups.has(key)) {
      groups.set(key, {
        contentId: step.contentId,
        languageIn: step.sourceLang || null,
        languageOut: step.slsLang || null,
        initialDeadline: null,
        finalDeadline: null,
        words: 0,
        lines: 0,
        hours: 0,
        terms: 0,
        hasTermsInFwl: false,
        allSteps: [],
      });
    }

    const group = groups.get(key)!;
    group.allSteps.push(step);

    // Deadline assignment based on service step type
    if (step.serviceStep === 'TRANSLREGU' && step.endDate) {
      if (!group.initialDeadline || step.endDate > group.initialDeadline) {
        group.initialDeadline = step.endDate;
      }
    }
    if (step.serviceStep === 'TRANSLFWL' && step.endDate) {
      if (!group.finalDeadline || step.endDate > group.finalDeadline) {
        group.finalDeadline = step.endDate;
      }
    }

    // If neither TRANSLFWL nor TRANSLREGU, use endDate as final_deadline
    if (step.serviceStep !== 'TRANSLREGU' && step.serviceStep !== 'TRANSLFWL' && step.endDate) {
      if (!group.finalDeadline || step.endDate > group.finalDeadline) {
        group.finalDeadline = step.endDate;
      }
    }

    // Sum volumes from this step
    for (const vol of step.volume ?? []) {
      const qty = vol.volumeQuantity || vol.ceBillQuantity || 0;
      switch (vol.volumeUnit) {
        case 'Words': group.words += qty; break;
        case 'Lines': group.lines += qty; break;
        case 'Hours': group.hours += qty; break;
        case 'Terms': group.terms += 1; break;
      }
    }

    // Track Terms presence in TRANSLFWL steps specifically
    if (step.serviceStep === 'TRANSLFWL' && (step.volume ?? []).some(v => v.volumeUnit === 'Terms')) {
      group.hasTermsInFwl = true;
    }
  }

  return Array.from(groups.values());
}

// ============================================================================
// Multi-Project Logic
// ============================================================================

/** Systems that create language_pairs × translationAreas projects */
const MULTI_TA_SYSTEMS = new Set(['SSE', 'SSK', 'SSH']);

function keyPart(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : '_';
}

function buildSapImportKey(params: {
  mode: 'STD' | 'STM';
  system: string;
  languageIn: string | null;
  languageOut: string | null;
  contentId?: string | null;
  translationArea?: string | null;
}): string {
  const base = [
    params.mode,
    keyPart(params.system),
    keyPart(params.languageIn),
    keyPart(params.languageOut),
  ];

  if (params.translationArea !== undefined) {
    return [...base, 'TA', keyPart(params.translationArea)].join('|');
  }

  if (params.contentId !== undefined) {
    return [...base, 'CID', keyPart(params.contentId)].join('|');
  }

  return [...base, 'LANGPAIR'].join('|');
}

/**
 * Map SAP subproject data to one or more import-ready projects.
 * Returns array because some systems generate multiple projects per subproject.
 */
export function mapSapSubProjectToProjects(
  subProject: SapSubProject,
  parent: SapProject,
  details: SapSubProjectInfo,
  instructions: SapInstruction[]
): SapProjectForImport[] {
  if (isBlockedSapProjectType(subProject.projectType)) {
    return [];
  }

  const system = extractSystem(details.subProjectSteps, details.environment);
  const terminologyKeys = extractTerminologyKeys(details);
  const allTranslationAreas = extractTranslationAreas(details.environment);
  const allLxeProjects = extractLxeProjects(details.environment);
  const allWorkLists = extractWorkLists(details.environment);
  const allGraphIds = extractGraphIds(details.environment);
  const url = extractUrl(details.subProjectSteps, details.environment, system);
  const sapPm = extractSapPm(subProject);
  const projectType = extractProjectType(subProject);

  const sapInstructions = buildSapInstructions(instructions);

  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const joinedGroups = joinSteps(details.subProjectSteps);

  // Name format: {subProjectId}: {projectName} | {subProjectName}
  const baseName = `${subProject.subProjectId}: ${parent.projectName} | ${subProject.subProjectName}`;

  const results: SapProjectForImport[] = [];

  if (MULTI_TA_SYSTEMS.has(system)) {
    // SSE/SSK/SSH: unique_language_pairs × translationAreas
    const uniqueLangPairs = new Map<string, JoinedStepGroup>();

    for (const group of joinedGroups) {
      const langKey = `${group.languageIn}|${group.languageOut}`;
      if (!uniqueLangPairs.has(langKey)) {
        uniqueLangPairs.set(langKey, group);
      } else {
        // Merge deadlines, volumes
        const existing = uniqueLangPairs.get(langKey)!;
        if (group.initialDeadline && (!existing.initialDeadline || group.initialDeadline < existing.initialDeadline)) {
          existing.initialDeadline = group.initialDeadline;
        }
        if (group.finalDeadline && (!existing.finalDeadline || group.finalDeadline > existing.finalDeadline)) {
          existing.finalDeadline = group.finalDeadline;
        }
        existing.words += group.words;
        existing.lines += group.lines;
        existing.hours += group.hours;
        existing.terms += group.terms;
        existing.hasTermsInFwl = existing.hasTermsInFwl || group.hasTermsInFwl;
        existing.allSteps.push(...group.allSteps);
      }
    }

    const tas = allTranslationAreas.length > 0 ? allTranslationAreas : [''];

    for (const [, langGroup] of uniqueLangPairs) {
      for (const ta of tas) {
        const taArr = ta ? [ta] : [];
        const composedInstructions = buildInstructions({
          translationAreas: taArr,
          lxeProjects: allLxeProjects,
          graphIds: allGraphIds,
          hours: langGroup.hours,
          terms: langGroup.terms,
          terminologyKeys,
          workLists: allWorkLists,
          system,
        });

        // Deadline filter — skip if all deadlines are in the past
        const deadlines = [langGroup.finalDeadline, langGroup.initialDeadline].filter(Boolean);
        const allInPast = deadlines.length > 0 && deadlines.every(d => new Date(d!) < today);

        if (allInPast) continue;

        results.push({
          sap_subproject_id: subProject.subProjectId,
          sap_import_key: buildSapImportKey({
            mode: 'STD',
            system,
            languageIn: langGroup.languageIn,
            languageOut: langGroup.languageOut,
            translationArea: ta,
          }),
          name: sanitizeString(baseName) || baseName,
          language_in: langGroup.languageIn,
          language_out: langGroup.languageOut,
          initial_deadline: langGroup.initialDeadline,
          final_deadline: langGroup.finalDeadline,
          instructions: composedInstructions,
          sap_instructions: sapInstructions,
          system,
          api_source: 'TPM_sap_api',
          last_synced_at: now,
          sap_pm: sapPm,
          project_type: projectType,
          terminology_key: terminologyKeys.length > 0 ? terminologyKeys : null,
          lxe_project: allLxeProjects.length > 0 ? allLxeProjects : null,
          translation_area: taArr.length > 0 ? taArr : null,
          work_list: allWorkLists.length > 0 ? allWorkLists : null,
          graph_id: allGraphIds.length > 0 ? allGraphIds : null,
          lxe_projects: allLxeProjects.length > 0 ? allLxeProjects : null,
          url,
          hours: langGroup.hours || null,
          words: langGroup.words || null,
          lines: langGroup.lines || null,
        });
      }

      if (langGroup.hasTermsInFwl) {
        // Deadline filter — skip STM if all deadlines are in the past
        const stmDeadlines = [langGroup.finalDeadline, langGroup.initialDeadline].filter(Boolean);
        const stmAllInPast = stmDeadlines.length > 0 && stmDeadlines.every(d => new Date(d!) < today);

        if (!stmAllInPast) {
          const stmInstructions = buildInstructions({
            translationAreas: allTranslationAreas,
            lxeProjects: allLxeProjects,
            graphIds: allGraphIds,
            hours: langGroup.hours,
            terms: langGroup.terms,
            terminologyKeys,
            workLists: allWorkLists,
            system: 'STM',
          });

          results.push({
            sap_subproject_id: subProject.subProjectId,
            sap_import_key: buildSapImportKey({
              mode: 'STM',
              system: 'STM',
              languageIn: langGroup.languageIn,
              languageOut: langGroup.languageOut,
            }),
            name: sanitizeString(baseName) || baseName,
            language_in: langGroup.languageIn,
            language_out: langGroup.languageOut,
            initial_deadline: langGroup.initialDeadline,
            final_deadline: langGroup.finalDeadline,
            instructions: stmInstructions,
            sap_instructions: sapInstructions,
            system: 'STM',
            api_source: 'TPM_sap_api',
            last_synced_at: now,
            sap_pm: sapPm,
            project_type: projectType,
            terminology_key: terminologyKeys.length > 0 ? terminologyKeys : null,
            lxe_project: allLxeProjects.length > 0 ? allLxeProjects : null,
            translation_area: allTranslationAreas.length > 0 ? allTranslationAreas : null,
            work_list: allWorkLists.length > 0 ? allWorkLists : null,
            graph_id: allGraphIds.length > 0 ? allGraphIds : null,
            lxe_projects: allLxeProjects.length > 0 ? allLxeProjects : null,
            url,
            hours: langGroup.hours || null,
            words: null,
            lines: null,
          });
        }
      }
    }
  } else {
    // All other systems: 1 project per contentId
    const contentGroups = new Map<string, JoinedStepGroup[]>();

    for (const group of joinedGroups) {
      const cid = group.contentId || '_default';
      if (!contentGroups.has(cid)) {
        contentGroups.set(cid, []);
      }
      contentGroups.get(cid)!.push(group);
    }

    // If no content groups at all, create one project from environment data
    if (contentGroups.size === 0) {
      contentGroups.set('_default', []);
    }

    for (const [contentId, groups] of contentGroups) {
      // Find environment matching this contentId
      const matchingEnv = details.environment.find(e => e.contentId === contentId);

      // Merge all groups for this contentId
      let langIn: string | null = null;
      let langOut: string | null = null;
      let initialDeadline: string | null = null;
      let finalDeadline: string | null = null;
      let words = 0;
      let lines = 0;
      let hours = 0;
      let terms = 0;
      let hasTermsInFwl = false;

      for (const g of groups) {
        if (!langIn) langIn = g.languageIn;
        if (!langOut) langOut = g.languageOut;
        if (g.initialDeadline && (!initialDeadline || g.initialDeadline < initialDeadline)) {
          initialDeadline = g.initialDeadline;
        }
        if (g.finalDeadline && (!finalDeadline || g.finalDeadline > finalDeadline)) {
          finalDeadline = g.finalDeadline;
        }
        words += g.words;
        lines += g.lines;
        hours += g.hours;
        terms += g.terms;
        hasTermsInFwl = hasTermsInFwl || g.hasTermsInFwl;
      }

      // Extract TA from matching env or all envs
      const envTAs = matchingEnv ? extractTranslationAreas([matchingEnv]) : allTranslationAreas;
      const envLxeProjects = matchingEnv
        ? extractLxeProjects([matchingEnv])
        : allLxeProjects;
      const envGraphIds = matchingEnv ? extractGraphIds([matchingEnv]) : allGraphIds;
      const envWorkLists = matchingEnv ? extractWorkLists([matchingEnv]) : allWorkLists;

      const composedInstructions = buildInstructions({
        translationAreas: envTAs,
        lxeProjects: envLxeProjects,
        graphIds: envGraphIds,
        hours,
        terms,
        terminologyKeys,
        workLists: envWorkLists,
        system,
      });

      // XTM words normalization
      const finalWords = system === 'XTM' ? (words !== 0 ? 1 : 0) : words;

      // Deadline filter — skip if all deadlines are in the past
      const deadlines = [finalDeadline, initialDeadline].filter(Boolean);
      const allInPast = deadlines.length > 0 && deadlines.every(d => new Date(d!) < today);

      if (allInPast) continue;

      results.push({
        sap_subproject_id: subProject.subProjectId,
        sap_import_key: buildSapImportKey({
          mode: 'STD',
          system,
          languageIn: langIn,
          languageOut: langOut,
          contentId,
        }),
        name: sanitizeString(baseName) || baseName,
        language_in: langIn,
        language_out: langOut,
        initial_deadline: initialDeadline,
        final_deadline: finalDeadline,
        instructions: composedInstructions,
        sap_instructions: sapInstructions,
        system,
        api_source: 'TPM_sap_api',
        last_synced_at: now,
        sap_pm: sapPm,
        project_type: projectType,
        terminology_key: terminologyKeys.length > 0 ? terminologyKeys : null,
        lxe_project: envLxeProjects.length > 0 ? envLxeProjects : null,
        translation_area: envTAs.length > 0 ? envTAs : null,
        work_list: envWorkLists.length > 0 ? envWorkLists : null,
        graph_id: envGraphIds.length > 0 ? envGraphIds : null,
        lxe_projects: envLxeProjects.length > 0 ? envLxeProjects : null,
        url,
        hours: hours || null,
        words: finalWords || null,
        lines: lines || null,
      });

      if (hasTermsInFwl && system !== 'SMARTLING') {
        const stmInstructions = buildInstructions({
          translationAreas: envTAs,
          lxeProjects: envLxeProjects,
          graphIds: envGraphIds,
          hours,
          terms,
          terminologyKeys,
          workLists: envWorkLists,
          system: 'STM',
        });

        results.push({
          sap_subproject_id: subProject.subProjectId,
          sap_import_key: buildSapImportKey({
            mode: 'STM',
            system: 'STM',
            languageIn: langIn,
            languageOut: langOut,
            contentId,
          }),
          name: sanitizeString(baseName) || baseName,
          language_in: langIn,
          language_out: langOut,
          initial_deadline: initialDeadline,
          final_deadline: finalDeadline,
          instructions: stmInstructions,
          sap_instructions: sapInstructions,
          system: 'STM',
          api_source: 'TPM_sap_api',
          last_synced_at: now,
          sap_pm: sapPm,
          project_type: projectType,
          terminology_key: terminologyKeys.length > 0 ? terminologyKeys : null,
          lxe_project: envLxeProjects.length > 0 ? envLxeProjects : null,
          translation_area: envTAs.length > 0 ? envTAs : null,
          work_list: envWorkLists.length > 0 ? envWorkLists : null,
          graph_id: envGraphIds.length > 0 ? envGraphIds : null,
          lxe_projects: envLxeProjects.length > 0 ? envLxeProjects : null,
          url,
          hours: hours || null,
          words: null,
          lines: null,
        });
      }
    }
  }

  return results;
}
