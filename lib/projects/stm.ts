import type { SupabaseClient } from "@supabase/supabase-js";
import { toStmImportKey } from "@/lib/sap/import-keys";

/**
 * Create an STM copy of a project. The source is read from the database (not from a cached
 * query) so the copy always reflects the current row; identity and timestamps are left to
 * the database.
 */
export async function createStmProject(
  supabase: SupabaseClient,
  sourceProjectId: number
): Promise<{ id: number }> {
  const { data: sourceProject, error: sourceError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", sourceProjectId)
    .single();

  if (sourceError || !sourceProject) {
    throw new Error(
      `Failed to load source project: ${sourceError?.message || "Project not found"}`
    );
  }

  const { id, created_at, updated_at, ...projectData } = sourceProject;
  void id;
  void created_at;
  void updated_at;

  const { data: newProject, error: createError } = await supabase
    .from("projects")
    .insert({
      ...projectData,
      system: "STM",
      sap_import_key: toStmImportKey(projectData.sap_import_key),
    })
    .select("id")
    .single();

  if (createError || !newProject) {
    throw new Error(
      `Failed to create STM project: ${createError?.message || "Unknown error"}`
    );
  }

  return newProject;
}
