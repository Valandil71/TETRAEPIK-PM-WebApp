// /lib/sap/mappers.ts
// Barrel re-export + remaining top-level mapping functions
//
// All existing imports from '@/lib/sap/mappers' continue to work.

import type {
  SapSubProject,
  SapSubProjectInfo,
  SapInstruction,
  SapSubProjectDetails,
  SapProjectForImport,
} from '@/types/sap';

// Re-export all split modules
export {
  extractSystem,
  extractTerminologyKeys,
  extractLxeProjects,
  extractTranslationAreas,
  extractWorkLists,
  extractGraphIds,
  extractUrl,
  extractHours,
  extractSapPm,
  extractProjectType,
} from './extract-fields';

export {
  sumVolumesByUnit,
  countTerms,
} from './extract-volumes';

export {
  buildInstructions,
  buildSapInstructions,
  stripHtmlTags,
} from './instructions';

export {
  joinSteps,
  mapSapSubProjectToProjects,
} from './step-groups';

export type { JoinedStepGroup } from './step-groups';

// Local imports for use in functions below
import { extractSystem, extractTerminologyKeys, extractTranslationAreas, extractHours, extractProjectType } from './extract-fields';
import { sumVolumesByUnit } from './extract-volumes';
import { buildSapInstructions } from './instructions';
import { joinSteps } from './step-groups';

// ============================================================================
// Preview Mapping (for Import UI)
// ============================================================================

/**
 * Map SAP subproject to preview details (for import UI)
 */
export function mapSapToSubProjectDetails(
  subProject: SapSubProject,
  details: SapSubProjectInfo,
  instructions: SapInstruction[]
): SapSubProjectDetails {
  const system = extractSystem(details.subProjectSteps, details.environment);
  const terminologyKeys = extractTerminologyKeys(details);
  const translationAreas = extractTranslationAreas(details.environment);

  // Extract languages from first step group
  const joinedGroups = joinSteps(details.subProjectSteps);
  const firstGroup = joinedGroups[0];

  const words = sumVolumesByUnit(details.subProjectSteps, 'Words');
  const lines = sumVolumesByUnit(details.subProjectSteps, 'Lines');
  const hours = extractHours(details.subProjectSteps);

  const sapInstructions = buildSapInstructions(instructions);

  return {
    subProjectId: subProject.subProjectId,
    subProjectName: subProject.subProjectName,
    dmName: subProject.dmName,
    languages: {
      source: firstGroup?.languageIn || null,
      target: firstGroup?.languageOut || null,
    },
    deadlines: {
      start: firstGroup?.initialDeadline || null,
      end: firstGroup?.finalDeadline || null,
    },
    system,
    instructions: sapInstructions?.map(e => e.instructionLong || e.instructionShort || e.text || '').join('\n\n') || null,
    volumes: { words, lines },
    projectType: extractProjectType(subProject),
    terminologyKey: terminologyKeys,
    translationArea: translationAreas,
    hours,
  };
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize string for database storage (XSS prevention)
 */
export function sanitizeString(input: string | null | undefined): string | null {
  if (!input) return null;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Apply sanitization to all string fields in import data
 */
export function sanitizeImportData(
  data: SapProjectForImport
): SapProjectForImport {
  return {
    ...data,
    name: sanitizeString(data.name) || data.name,
    instructions: sanitizeString(data.instructions),
    sap_pm: sanitizeString(data.sap_pm),
    url: sanitizeString(data.url),
  };
}
