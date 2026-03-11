// /lib/sap/project-type-rules.ts
// Centralized rules for SAP project types.

const BLOCKED_PROJECT_TYPES = new Set(['xtm billing projects']);

export function isBlockedSapProjectType(projectType: string | null | undefined): boolean {
  if (!projectType) return false;
  return BLOCKED_PROJECT_TYPES.has(projectType.trim().toLowerCase());
}

