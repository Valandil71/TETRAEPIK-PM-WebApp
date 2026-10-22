import { MANUALLY_EDITABLE_SAP_FIELDS } from "@/lib/sap/constants";
import { collectTrackedChanges } from "@/lib/sap/sync-utils";
import type { Project } from "@/types/project";

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * The projects.manual_fields to save after an edit: SAP-owned fields the PM changed are added,
 * so the SAP import stops overwriting them; fields the PM cleared are removed, so SAP fills
 * them again on the next import.
 */
export function nextManualFields(
  current: Pick<Project, (typeof MANUALLY_EDITABLE_SAP_FIELDS)[number] | "manual_fields">,
  next: Record<string, unknown>
): string[] {
  const fields = new Set(current.manual_fields ?? []);
  const changed = collectTrackedChanges(current, next, MANUALLY_EDITABLE_SAP_FIELDS);

  for (const field of MANUALLY_EDITABLE_SAP_FIELDS) {
    if (isEmptyValue(next[field])) fields.delete(field);
    else if (field in changed) fields.add(field);
  }

  return [...fields];
}

/** Whether the project's instructions were written by a person (not composed by the SAP import). */
export function hasManualInstructions(
  project: Pick<Project, "instructions" | "manual_fields" | "api_source">
): boolean {
  if (!project.instructions?.trim()) return false;
  return project.api_source === "manual" || (project.manual_fields ?? []).includes("instructions");
}
