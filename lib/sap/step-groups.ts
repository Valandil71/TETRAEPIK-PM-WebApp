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
import { SAP_DEADLINE_OFFSET_HOURS } from './constants';
import { appendDeadlineVariantToImportKey } from './import-keys';

function applyDeadlineOffset(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;

  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return null;

  const shifted = new Date(timestamp);
  shifted.setUTCHours(shifted.getUTCHours() + SAP_DEADLINE_OFFSET_HOURS);
  return shifted.toISOString();
}

function isEarlierIsoDate(candidate: string, current: string | null): boolean {
  if (!current) return true;
  return Date.parse(candidate) < Date.parse(current);
}

function isLaterIsoDate(candidate: string, current: string | null): boolean {
  if (!current) return true;
  return Date.parse(candidate) > Date.parse(current);
}

// ============================================================================
// Step Joining (TRANSLFWL + TRANSLREGU)
// ============================================================================

export interface JoinedStepGroup {
  contentId: string;
  languageIn: string | null;
  languageOut: string | null;
  initialDeadline: string | null; // from TRANSLREGU endDate
  finalDeadline: string | null; // from TRANSLFWL endDate
  words: number;
  lines: number;
  hours: number;
  terms: number;
  hasTermsInFwl: boolean;
  allSteps: SapStep[];
}

/**
 * Group steps by contentId + language pair, joining TRANSLFWL and TRANSLREGU.
 * TRANSLREGU endDate -> initial_deadline
 * TRANSLFWL endDate -> final_deadline
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

    const adjustedEndDate = applyDeadlineOffset(step.endDate);

    // Deadline assignment based on service step type
    if (step.serviceStep === 'TRANSLREGU' && adjustedEndDate) {
      if (isLaterIsoDate(adjustedEndDate, group.initialDeadline)) {
        group.initialDeadline = adjustedEndDate;
      }
    }
    if (step.serviceStep === 'TRANSLFWL' && adjustedEndDate) {
      if (isLaterIsoDate(adjustedEndDate, group.finalDeadline)) {
        group.finalDeadline = adjustedEndDate;
      }
    }

    // If neither TRANSLFWL nor TRANSLREGU, use endDate as final_deadline
    if (step.serviceStep !== 'TRANSLREGU' && step.serviceStep !== 'TRANSLFWL' && adjustedEndDate) {
      if (isLaterIsoDate(adjustedEndDate, group.finalDeadline)) {
        group.finalDeadline = adjustedEndDate;
      }
    }

    // Sum volumes from this step
    for (const vol of step.volume ?? []) {
      const qty = vol.volumeQuantity || vol.ceBillQuantity || 0;
      switch (vol.volumeUnit) {
        case 'Words':
          group.words += qty;
          break;
        case 'Lines':
          group.lines += qty;
          break;
        case 'Hours':
          group.hours += qty;
          break;
        case 'Terms':
          group.terms += 1;
          break;
      }
    }

    // Track Terms presence in TRANSLFWL steps specifically
    if (step.serviceStep === 'TRANSLFWL' && (step.volume ?? []).some((v) => v.volumeUnit === 'Terms')) {
      group.hasTermsInFwl = true;
    }
  }

  return Array.from(groups.values());
}

// ============================================================================
// Multi-Project Logic
// ============================================================================

/** Systems that create language_pairs x translationAreas projects */
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

function splitProjectByDeadline(project: SapProjectForImport): SapProjectForImport[] {
  if (!project.initial_deadline || !project.final_deadline) {
    return [project];
  }

  return [
    {
      ...project,
      sap_import_key: appendDeadlineVariantToImportKey(project.sap_import_key, 'FINAL'),
      initial_deadline: null,
    },
    {
      ...project,
      sap_import_key: appendDeadlineVariantToImportKey(project.sap_import_key, 'INITIAL'),
      final_deadline: null,
    },
  ];
}

function pushDeadlineSplitProjects(
  results: SapProjectForImport[],
  project: SapProjectForImport
): void {
  results.push(...splitProjectByDeadline(project));
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
    // SSE/SSK/SSH: unique_language_pairs x translationAreas
    const uniqueLangPairs = new Map<string, JoinedStepGroup>();

    for (const group of joinedGroups) {
      const langKey = `${group.languageIn}|${group.languageOut}`;
      if (!uniqueLangPairs.has(langKey)) {
        uniqueLangPairs.set(langKey, group);
      } else {
        // Merge deadlines and volumes
        const existing = uniqueLangPairs.get(langKey)!;
        if (group.initialDeadline && isEarlierIsoDate(group.initialDeadline, existing.initialDeadline)) {
          existing.initialDeadline = group.initialDeadline;
        }
        if (group.finalDeadline && isLaterIsoDate(group.finalDeadline, existing.finalDeadline)) {
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

        // Deadline filter - skip if all deadlines are in the past
        const deadlines = [langGroup.finalDeadline, langGroup.initialDeadline].filter(Boolean);
        const allInPast = deadlines.length > 0 && deadlines.every((d) => new Date(d!) < today);

        if (allInPast) continue;

        pushDeadlineSplitProjects(results, {
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
    }
  } else {
    // All other systems: 1 project per language pair (merge contentIds)
    const groupsForMapping = joinedGroups.length > 0
      ? joinedGroups
      : [
          {
            contentId: '_default',
            languageIn: null,
            languageOut: null,
            initialDeadline: null,
            finalDeadline: null,
            words: 0,
            lines: 0,
            hours: 0,
            terms: 0,
            hasTermsInFwl: false,
            allSteps: [],
          } satisfies JoinedStepGroup,
        ];

    const languageGroups = new Map<
      string,
      {
        languageIn: string | null;
        languageOut: string | null;
        groups: JoinedStepGroup[];
        contentIds: Set<string>;
      }
    >();

    for (const group of groupsForMapping) {
      const langKey = `${group.languageIn ?? '_'}|${group.languageOut ?? '_'}`;
      if (!languageGroups.has(langKey)) {
        languageGroups.set(langKey, {
          languageIn: group.languageIn,
          languageOut: group.languageOut,
          groups: [],
          contentIds: new Set<string>(),
        });
      }

      const langGroup = languageGroups.get(langKey)!;
      langGroup.groups.push(group);
      if (group.contentId) {
        langGroup.contentIds.add(group.contentId);
      }
    }

    for (const [, langGroup] of languageGroups) {
      let initialDeadline: string | null = null;
      let finalDeadline: string | null = null;
      let words = 0;
      let lines = 0;
      let hours = 0;
      let terms = 0;

      for (const group of langGroup.groups) {
        if (group.initialDeadline && isEarlierIsoDate(group.initialDeadline, initialDeadline)) {
          initialDeadline = group.initialDeadline;
        }
        if (group.finalDeadline && isLaterIsoDate(group.finalDeadline, finalDeadline)) {
          finalDeadline = group.finalDeadline;
        }

        words += group.words;
        lines += group.lines;
        hours += group.hours;
        terms += group.terms;
      }

      const scopedEnvironments = details.environment.filter((env) =>
        langGroup.contentIds.has(env.contentId)
      );
      const envScope = scopedEnvironments.length > 0 ? scopedEnvironments : details.environment;

      const envTAs = extractTranslationAreas(envScope);
      const envLxeProjects = extractLxeProjects(envScope);
      const envGraphIds = extractGraphIds(envScope);
      const envWorkLists = extractWorkLists(envScope);

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

      // Deadline filter - skip if all deadlines are in the past
      const deadlines = [finalDeadline, initialDeadline].filter(Boolean);
      const allInPast = deadlines.length > 0 && deadlines.every((d) => new Date(d!) < today);

      if (allInPast) continue;

      pushDeadlineSplitProjects(results, {
        sap_subproject_id: subProject.subProjectId,
        sap_import_key: buildSapImportKey({
          mode: 'STD',
          system,
          languageIn: langGroup.languageIn,
          languageOut: langGroup.languageOut,
        }),
        name: sanitizeString(baseName) || baseName,
        language_in: langGroup.languageIn,
        language_out: langGroup.languageOut,
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
    }
  }

  return results;
}
