import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectStatus } from "@/types/project";

/**
 * Whether a project arrived without a usable volume, so a PM has to review it (confirm it in
 * SOL, set lines/words) before it can be assigned. Hours do not count as volume. XTM words are
 * imported as a 0/1 presence flag, so XTM words ≤ 1 count as "no word count" too.
 */
export function needsVolumeReview(project: {
  system: string | null;
  words: number | null;
  lines: number | null;
}): boolean {
  const hasLines = (project.lines ?? 0) > 0;
  const wordsThreshold = project.system === "XTM" ? 1 : 0;
  const hasWords = (project.words ?? 0) > wordsThreshold;
  return !hasLines && !hasWords;
}

/** Status a newly imported SAP project starts in. */
export function initialImportStatus(project: Parameters<typeof needsVolumeReview>[0]): ProjectStatus {
  return needsVolumeReview(project) ? "pending_review" : "active";
}

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
