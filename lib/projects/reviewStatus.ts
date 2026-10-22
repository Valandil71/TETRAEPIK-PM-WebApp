import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marks projects as reviewed (they become "active" and can be assigned). Only rows still in
 * "pending_review" change, so a project another PM already reviewed is left as it is.
 */
export async function markProjectsReviewed(
  supabase: SupabaseClient,
  projectIds: number[]
): Promise<void> {
  if (projectIds.length === 0) return;
  const { error } = await supabase
    .from("projects")
    .update({ status: "active" })
    .in("id", projectIds)
    .eq("status", "pending_review");
  if (error) throw new Error(`Failed to mark projects as reviewed: ${error.message}`);
}
