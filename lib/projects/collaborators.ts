import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface CollaboratorAssignment {
  projectId: number;
  userId: string;
  message?: string | null;
}

export interface AssignmentRow {
  project_id: number;
  user_id: string;
  assignment_status: "claimed" | "unclaimed";
  initial_message: string | null;
}

/**
 * Rows for projects_assignment. Whoever assigns themselves is taking the work, so their
 * assignment starts as "claimed"; everyone else starts as "unclaimed".
 */
export function buildAssignmentRows(
  assignments: CollaboratorAssignment[],
  currentUserId: string | null | undefined
): AssignmentRow[] {
  return assignments.map(({ projectId, userId, message }) => ({
    project_id: projectId,
    user_id: userId,
    assignment_status: currentUserId && userId === currentUserId ? "claimed" : "unclaimed",
    initial_message: message || null,
  }));
}

/** Assign collaborators to one or more projects in a single insert. */
export async function addCollaborators(
  supabase: SupabaseClient,
  assignments: CollaboratorAssignment[],
  currentUserId: string | null | undefined
): Promise<AssignmentRow[]> {
  const rows = buildAssignmentRows(assignments, currentUserId);
  if (rows.length === 0) {
    throw new Error("No collaborators selected");
  }

  const { error } = await supabase.from("projects_assignment").insert(rows);
  if (error) throw new Error(`Failed to add collaborators: ${error.message}`);

  return rows;
}

/**
 * Remove a collaborator from a project. The deleted row is returned by the database, so a
 * delete that matched nothing (already removed, or blocked by RLS) is reported as an error
 * instead of a silent success.
 */
export async function removeCollaborator(
  supabase: SupabaseClient,
  projectId: number,
  userId: string
): Promise<void> {
  if (!projectId || !userId) {
    throw new Error("Project ID and User ID are required");
  }

  const { data, error } = await supabase
    .from("projects_assignment")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select("project_id, user_id");

  if (error) throw new Error(`Failed to remove collaborator: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Collaborator was not removed: the assignment no longer exists or you do not have permission to remove it."
    );
  }
}

/** Refresh every cached view that shows who is assigned to these projects. */
export function invalidateCollaboratorQueries(
  queryClient: QueryClient,
  projectIds: number[],
  userIds: string[]
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });
  new Set(projectIds).forEach((projectId) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) })
  );
  new Set(userIds).forEach((userId) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
  });
}
