import type { SupabaseClient } from "@supabase/supabase-js";

/** What the PM must type, exactly, to delete a project. */
export const DELETE_CONFIRMATION_PHRASE = "I want to delete";

export function isDeleteConfirmed(typed: string): boolean {
  return typed === DELETE_CONFIRMATION_PHRASE;
}

/**
 * Whether the SAP import would bring the project back after it is deleted: it came from SAP
 * with an import-generated key. Manual STM copies and duplicates have keys SAP never generates.
 */
export function isRecreatedBySapImport(project: {
  sap_subproject_id?: string | null;
  sap_import_key?: string | null;
}): boolean {
  if (!project.sap_subproject_id) return false;
  const key = project.sap_import_key ?? "";
  return !key.startsWith("STM|") && !key.startsWith("DUP|");
}

/** Permanently delete a project; its collaborator assignments are deleted with it (cascade). */
export async function deleteProject(supabase: SupabaseClient, projectId: number): Promise<void> {
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  // Row-level security turns a refused delete into "0 rows deleted" rather than an error
  if (!data || data.length === 0) {
    throw new Error(
      "Failed to delete project: it was not found or you don't have permission to delete it."
    );
  }
}
