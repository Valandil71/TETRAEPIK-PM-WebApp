export interface ProjectGroup<T extends { id: number; name: string }> {
  key: string;
  name: string;
  projects: T[];
}

export type GroupSelectionState = "checked" | "indeterminate" | "unchecked";

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
