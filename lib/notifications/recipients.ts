import type { UserRole } from "@/types/user";

export interface NotificationProject {
  id: number;
  name: string;
  project_type: string | null;
}

export interface NotificationUser {
  id: string;
  role: UserRole;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces the previous notification instead of stacking another one. */
  tag: string;
}

/** project type → whether the user wants it. An empty preference list means every type. */
export function matchesTypeFilter(projectType: string | null, preferredTypes: string[] | undefined): boolean {
  if (!preferredTypes || preferredTypes.length === 0) return true;
  return projectType !== null && preferredTypes.includes(projectType);
}

function isPmOrAdmin(role: UserRole): boolean {
  return role === "pm" || role === "admin";
}

function addTo(map: Map<string, NotificationProject[]>, userId: string, project: NotificationProject) {
  const list = map.get(userId);
  if (!list) {
    map.set(userId, [project]);
  } else if (!list.some((p) => p.id === project.id)) {
    list.push(project);
  }
}

/**
 * Who gets told about new assignments, and about which projects. Collaborators are always
 * notified; PMs/Admins only for the project types they chose. The actor is never notified.
 */
export function groupAssignmentsByRecipient(
  assignments: { projectId: number; userId: string }[],
  projectsById: Map<number, NotificationProject>,
  usersById: Map<string, NotificationUser>,
  preferencesByUser: Map<string, string[]>,
  actorId: string
): Map<string, NotificationProject[]> {
  const result = new Map<string, NotificationProject[]>();
  for (const { projectId, userId } of assignments) {
    if (userId === actorId) continue;
    const project = projectsById.get(projectId);
    const user = usersById.get(userId);
    if (!project || !user) continue;
    if (isPmOrAdmin(user.role) && !matchesTypeFilter(project.project_type, preferencesByUser.get(userId))) {
      continue;
    }
    addTo(result, userId, project);
  }
  return result;
}

/**
 * Every PM/Admin except the actor, each limited to the project types they chose. Used for
 * projects marked complete and for collaborators marking their assignment done.
 */
export function groupCompletionsByRecipient(
  projects: NotificationProject[],
  users: NotificationUser[],
  preferencesByUser: Map<string, string[]>,
  actorId: string
): Map<string, NotificationProject[]> {
  const result = new Map<string, NotificationProject[]>();
  for (const user of users) {
    if (user.id === actorId || !isPmOrAdmin(user.role)) continue;
    for (const project of projects) {
      if (matchesTypeFilter(project.project_type, preferencesByUser.get(user.id))) {
        addTo(result, user.id, project);
      }
    }
  }
  return result;
}

const MAX_NAMES = 3;

function summarize(projects: NotificationProject[]): string {
  const names = projects.slice(0, MAX_NAMES).map((p) => p.name);
  const rest = projects.length - names.length;
  return rest > 0 ? `${names.join(", ")} +${rest} more` : names.join(", ");
}

export function buildAssignmentPayload(projects: NotificationProject[]): PushPayload {
  if (projects.length === 1) {
    return {
      title: "New project assigned",
      body: projects[0].name,
      url: `/project/${projects[0].id}`,
      tag: "assignment",
    };
  }
  return {
    title: `${projects.length} new projects assigned`,
    body: summarize(projects),
    url: "/my-projects",
    tag: "assignment",
  };
}

/** A collaborator marked their part of one or more projects as done. */
export function buildAssignmentDonePayload(projects: NotificationProject[], translatorName: string): PushPayload {
  if (projects.length === 1) {
    return {
      title: `${translatorName} finished a project`,
      body: projects[0].name,
      url: `/project/${projects[0].id}`,
      tag: "assignment-done",
    };
  }
  return {
    title: `${translatorName} finished ${projects.length} projects`,
    body: summarize(projects),
    url: "/management",
    tag: "assignment-done",
  };
}

export function buildCompletionPayload(projects: NotificationProject[]): PushPayload {
  if (projects.length === 1) {
    return {
      title: "Project completed",
      body: projects[0].name,
      url: `/project/${projects[0].id}`,
      tag: "completion",
    };
  }
  return {
    title: `${projects.length} projects completed`,
    body: summarize(projects),
    url: "/concluded-projects",
    tag: "completion",
  };
}
