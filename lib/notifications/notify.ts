import { toast } from "sonner";
import { fetchApi } from "@/lib/api/fetchApi";

/**
 * Fire-and-forget push triggers, called after a write has succeeded. Pass the whole batch in
 * one call: the server groups it so each recipient gets a single notification. A failure here
 * never affects the action the user just did; on localhost it is shown as a toast so a broken
 * setup (e.g. missing env vars) doesn't go unnoticed.
 */
function post(url: string, body: unknown): void {
  fetchApi<{ sent: number }>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((error) => {
    console.warn("Push notification request failed:", error);
    if (process.env.NODE_ENV === "development") {
      toast.error(`Push notification failed: ${error instanceof Error ? error.message : error}`);
    }
  });
}

export function notifyAssigned(assignments: { projectId: number; userId: string }[]): void {
  if (assignments.length === 0) return;
  post("/api/notifications/assignment", { assignments });
}

/** A collaborator marked their own assignment(s) done → PMs/Admins are told. */
export function notifyAssignmentsDone(projectIds: number[]): void {
  if (projectIds.length === 0) return;
  post("/api/notifications/assignment-done", { projectIds });
}

export function notifyProjectsCompleted(projectIds: number[]): void {
  if (projectIds.length === 0) return;
  post("/api/notifications/project-completed", { projectIds });
}
