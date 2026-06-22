export interface ProjectGroup<T extends { id: number; name: string }> {
  key: string;
  name: string;
  projects: T[];
}

export type GroupSelectionState = "checked" | "indeterminate" | "unchecked";

interface ProjectDeadlineShape {
  initial_deadline?: string | null;
  interim_deadline?: string | null;
  final_deadline?: string | null;
}

interface ProjectDisplayGroupShape {
  id: number;
  name: string;
  sap_subproject_id?: string | null;
}

function getValidProjectDeadlines(project: ProjectDeadlineShape) {
  return [
    project.initial_deadline,
    project.interim_deadline,
    project.final_deadline,
  ]
    .filter(Boolean)
    .map((deadline) => {
      const date = new Date(deadline!);
      return Number.isNaN(date.getTime())
        ? null
        : { date, dateString: deadline! };
    })
    .filter(Boolean) as Array<{ date: Date; dateString: string }>;
}

export function getClosestProjectDeadline(
  project: ProjectDeadlineShape
): Date | null {
  const deadlines = getValidProjectDeadlines(project);

  if (deadlines.length === 0) {
    return null;
  }

  deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return deadlines[0].date;
}

export function getClosestProjectDeadlineString(
  project: ProjectDeadlineShape
): string | null {
  const deadlines = getValidProjectDeadlines(project);

  if (deadlines.length === 0) {
    return null;
  }

  deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return deadlines[0].dateString;
}

export function compareProjectsByClosestDeadline<T extends ProjectDeadlineShape>(
  a: T,
  b: T
): number {
  const dateA = getClosestProjectDeadline(a);
  const dateB = getClosestProjectDeadline(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA.getTime() - dateB.getTime();
}

/** Keep raw DB name semantics: exact string match only. */
export function groupProjectsByExactName<T extends { id: number; name: string }>(
  projects: T[]
): ProjectGroup<T>[] {
  const groups = new Map<string, ProjectGroup<T>>();

  projects.forEach((project) => {
    const key = project.name;
    const existing = groups.get(key);
    if (existing) {
      existing.projects.push(project);
      return;
    }

    groups.set(key, {
      key,
      name: project.name,
      projects: [project],
    });
  });

  return Array.from(groups.values());
}

function getProjectGroupKey<T extends ProjectDisplayGroupShape>(project: T): string {
  if (project.sap_subproject_id) {
    return `sap:${project.sap_subproject_id}`;
  }

  return `name:${project.name}`;
}

export function groupProjectsForDisplay<T extends ProjectDisplayGroupShape>(
  projects: T[]
): ProjectGroup<T>[] {
  const groups = new Map<string, ProjectGroup<T>>();

  projects.forEach((project) => {
    const key = getProjectGroupKey(project);
    const existing = groups.get(key);
    if (existing) {
      existing.projects.push(project);
      return;
    }

    groups.set(key, {
      key,
      name: project.name,
      projects: [project],
    });
  });

  return Array.from(groups.values());
}

export function getGroupDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? name : "(No name)";
}

export function getGroupSelectionState(
  projectIds: number[],
  selectedProjects: Set<number>
): GroupSelectionState {
  const selectedCount = projectIds.filter((id) => selectedProjects.has(id)).length;
  if (selectedCount === 0) return "unchecked";
  if (selectedCount === projectIds.length) return "checked";
  return "indeterminate";
}
