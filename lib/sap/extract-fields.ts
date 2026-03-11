// /lib/sap/extract-fields.ts
// Extract structured field values from SAP subproject data

import type {
  SapSubProjectInfo,
  SapEnvironment,
  SapSubProject,
  SapStep,
} from '@/types/sap';

// ============================================================================
// System Extraction
// ============================================================================

/**
 * Extract system from steps and environment.
 * Priority:
 * 1. stepText === "Test, correct and report result" -> LAT
 * 2. toolType === "SAP" -> extract from environmentName
 * 3. toolType === "XTM_PM" or "XTM" -> XTM
 * 4. Otherwise -> Unknown
 */
export function extractSystem(steps: SapStep[], environment?: SapEnvironment[]): string {
  // 1. Check for LAT test step
  if (steps.some(s => s.stepText === 'Test, correct and report result')) {
    return 'LAT';
  }

  // Find toolType from environment (authoritative per OpenAPI spec)
  const envWithTool = environment?.find(e => e.toolType);
  const toolType = envWithTool?.toolType?.toUpperCase();

  // 2. SAP toolType -> extract system from environmentName
  if (toolType === 'SAP') {
    const envName = envWithTool?.environmentName || '';
    // Extract: chars after "SAP Translation System - " before next " "
    const prefix = 'SAP Translation System - ';
    const idx = envName.indexOf(prefix);
    if (idx !== -1) {
      const rest = envName.slice(idx + prefix.length);
      const system = rest.split(' ')[0];
      if (system) return system;
    }
    return 'Unknown';
  }

  // 3. XTM toolType
  if (toolType === 'XTM_PM' || toolType === 'XTM') {
    return 'XTM';
  }

  // 4. SMARTLING toolType
  if (toolType === 'SMARTLING') {
    return 'SMARTLING';
  }

  // 5. TERM toolType
  if (toolType === 'TERM') {
    return 'STM';
  }

  // 6. Unknown environment toolType -> keep raw API value
  if (envWithTool?.toolType?.trim()) {
    return envWithTool.toolType.trim();
  }

  // Fallback: try step-level toolType
  const stepWithTool = steps.find(s => s.toolType);
  if (stepWithTool?.toolType) {
    const stepToolType = stepWithTool.toolType.toUpperCase();
    if (stepToolType === 'SAP') return stepWithTool.toolType.trim();
    if (stepToolType === 'XTM_PM' || stepToolType === 'XTM') return 'XTM';
    if (stepToolType === 'SMARTLING') return 'SMARTLING';
    if (stepToolType === 'TERM') return 'STM';
    return stepWithTool.toolType.trim();
  }

  return 'Unknown';
}

// ============================================================================
// Field Extraction Helpers
// ============================================================================

/** Extract unique terminology key numbers from details */
export function extractTerminologyKeys(details: SapSubProjectInfo): string[] {
  if (!details.terminologyKey?.length) return [];
  return [...new Set(details.terminologyKey.filter(Boolean))];
}

/** Extract first number from each lxeProject entry (only for systems with LXE) */
export function extractLxeProjects(env: SapEnvironment[]): string[] {
  const relevantEnvs = env.filter(e => e.lxeProject?.length > 0);
  const projects: string[] = [];
  for (const e of relevantEnvs) {
    for (const lxe of e.lxeProject) {
      const num = lxe.split(/\s+/)[0];
      if (num) projects.push(num);
    }
  }
  return [...new Set(projects)];
}

/** Extract first code from each translationArea */
export function extractTranslationAreas(env: SapEnvironment[]): string[] {
  const areas: string[] = [];
  for (const e of env) {
    if (e.translationArea?.length > 0) {
      for (const ta of e.translationArea) {
        const code = ta.split(/\s+/)[0];
        if (code) areas.push(code);
      }
    }
  }
  return [...new Set(areas)];
}

/** Extract first number from each worklist */
export function extractWorkLists(env: SapEnvironment[]): string[] {
  const lists: string[] = [];
  for (const e of env) {
    if (e.worklist?.length > 0) {
      for (const wl of e.worklist) {
        const num = wl.split(/\s+/)[0];
        if (num) lists.push(num);
      }
    }
  }
  return [...new Set(lists)];
}

/** Extract first number from each graphId (normalized: trim, dedupe, sorted). */
export function extractGraphIds(env: SapEnvironment[]): string[] {
  const ids: string[] = [];
  for (const e of env) {
    if (e.graphId?.length > 0) {
      for (const gid of e.graphId) {
        const num = gid.split(/\s+/)[0]?.trim();
        if (num) ids.push(num);
      }
    }
  }

  return Array.from(new Set(ids)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

/** Extract URL from subProjectFiles of first step that has one.
 *  For SMARTLING, environment.projectUrl always takes priority. */
export function extractUrl(
  steps: SapStep[],
  environment?: SapEnvironment[],
  system?: string
): string | null {
  // SMARTLING: environment.projectUrl takes priority
  if (system === 'SMARTLING' && environment?.length) {
    for (const env of environment) {
      if (env.projectUrl && env.projectUrl.trim()) {
        return env.projectUrl.trim();
      }
    }
  }

  for (const step of steps) {
    if (step.subProjectFiles && step.subProjectFiles.trim()) {
      return step.subProjectFiles.trim();
    }
  }
  return null;
}

/** Extract hours from volumeUnit "Hours" across steps */
export function extractHours(steps: SapStep[]): number {
  let total = 0;
  for (const step of steps) {
    for (const vol of step.volume ?? []) {
      if (vol.volumeUnit === 'Hours') {
        total += vol.volumeQuantity || vol.ceBillQuantity || 0;
      }
    }
  }
  return total;
}

/** Extract PM name from subProject dmName */
export function extractSapPm(subProject: SapSubProject): string | null {
  return subProject.dmName || null;
}

/** Extract project type from subProject */
export function extractProjectType(subProject: SapSubProject): string | null {
  return subProject.projectType || null;
}
