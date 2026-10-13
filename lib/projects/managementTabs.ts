import type { ProjectStatus } from "@/types/project";

export type ManagementTab = "all" | "ready" | "inProgress" | "unclaimed" | "toReview";
export type ManagementCategory = Exclude<ManagementTab, "all">;

interface CategorizableProject {
  status: ProjectStatus;
  translators: { assignment_status: string }[];
}

/**
 * Which Manage Projects tab a project belongs to (besides "All Projects"). Projects still to be
 * reviewed only appear in "To Review"; the others are split by their collaborators' progress.
 */
export function getManagementCategory(project: CategorizableProject): ManagementCategory {
  if (project.status === "pending_review") return "toReview";
  if (project.translators.length === 0) return "unclaimed";
  if (project.translators.every((t) => t.assignment_status === "done")) return "ready";
  if (project.translators.some((t) => t.assignment_status === "claimed")) return "inProgress";
  return "unclaimed";
}

export function categorizeManagementProjects<T extends CategorizableProject>(
  projects: T[]
): Record<ManagementCategory, T[]> {
  const categories: Record<ManagementCategory, T[]> = {
    ready: [],
    inProgress: [],
    unclaimed: [],
    toReview: [],
  };
  projects.forEach((project) => categories[getManagementCategory(project)].push(project));
  return categories;
}
