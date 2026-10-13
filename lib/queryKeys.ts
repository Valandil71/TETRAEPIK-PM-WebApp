/**
 * Centralized query key factory functions for React Query
 *
 * This ensures consistent query key structure across the application
 * and makes it easier to invalidate related queries.
 */

/** Project status a project list is filtered by. */
export type ProjectListStatus = 'active' | 'complete';

export const queryKeys = {
  // User-related queries
  user: () => ['user'] as const,
  userProfile: () => ['user-profile'] as const,
  users: () => ['users'] as const,

  // Project-related queries
  project: (id: number | string | null) => ['project', id] as const,
  // Nested under project(id) so realtime project invalidations also refresh it.
  projectInstructions: (id: number | null) => ['project', id, 'instructions'] as const,
  projects: () => ['projects'] as const,
  // Called without arguments it returns the prefix, so invalidating it refreshes every list variant.
  // The 4th element is the list's project status; realtime invalidation relies on that position.
  projectsWithTranslators: (showPast?: boolean, showAll?: boolean, status?: ProjectListStatus) =>
    showPast === undefined
      ? (['projects-with-translators'] as const)
      : (['projects-with-translators', showPast, showAll, status] as const),
  sapInstructionPreviews: (projectIds?: number[]) =>
    projectIds === undefined
      ? (['sap-instruction-previews'] as const)
      : (['sap-instruction-previews', projectIds] as const),
  myProjects: (userId: string | null) => ['my-projects', userId] as const,

  // Home page counts
  homeMyProjectsCount: (userId: string | null | undefined) =>
    ['home-my-projects-count', userId] as const,
  homeManageProjectsCount: () => ['home-manage-projects-count'] as const,

  // Settings and configuration
  availableAvatars: () => ['available-avatars'] as const,

  // SAP Integration
  sapProjects: () => ['sap-projects'] as const,
  sapImportStatus: () => ['sap-import-status'] as const,
  sapSubProject: (projectId: number | null, subProjectId: string | null) =>
    ['sap-subproject', projectId, subProjectId] as const,
  importReports: (userId: string | null) => ['import-reports', userId] as const,

  // User settings
  instructionExclusions: () => ['instruction-exclusions-v2'] as const,
  defaultFilters: (userId: string | null) => ['default-filters', userId] as const,
  notificationPreferences: (userId: string | null) => ['notification-preferences', userId] as const,
} as const;
