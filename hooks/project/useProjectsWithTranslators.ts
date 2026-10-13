"use client";

import { useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslators, ProjectTranslator, SapInstructionEntry } from '@/types/project';
import { getProjectListStatuses, queryKeys, type ProjectListStatus } from "@/lib/queryKeys";
import {
  buildSapInstructionPreviews,
  getBlankInstructionIds,
  pickSapInstructionPreview,
} from '@/hooks/project/useSapInstructionPreviews';
import { fetchInstructionExclusions } from '@/hooks/settings/useInstructionExclusions';
import { toInstructionExclusionSet } from '@/lib/sap/instruction-exclusions';
import { fetchUsers, USERS_STALE_TIME } from '@/hooks/user/useUsers';
import type { User } from '@/types/user';

interface ProjectAssignmentRow {
  assignment_status: ProjectTranslator["assignment_status"];
  done_message: string | null;
  user_id: string;
}

export type ProjectListRow = Omit<ProjectWithTranslators, "translators" | "sap_instructions"> & {
  projects_assignment: ProjectAssignmentRow[] | null;
  /** Only selected for working lists (see PROJECT_LIST_SAP_FIRST). */
  sap_first?: SapInstructionEntry | null;
};

// `sap_instructions` is deliberately not selected here: it is ~95% of the list payload.
// See loadSapInstructionPreviews for how the list still gets what the previews need.
// created_at/updated_at are not selected either: no list view reads them.
// Assignments carry only the user id: the users are a handful, fetched once and mapped in
// (toProjectWithTranslators), instead of repeating each one in every assignment.
export const PROJECT_LIST_SELECT = `
  id,
  name,
  system,
  words,
  lines,
  initial_deadline,
  interim_deadline,
  final_deadline,
  instructions,
  status,
  language_in,
  language_out,
  paid,
  invoiced,
  project_type,
  projects_assignment (
    assignment_status,
    done_message,
    user_id
  )
`;

// Working lists also take the first SAP instruction entry (small), which the instructions
// preview needs; selecting it here saves a request after the list (loadSapInstructionPreviews).
const PROJECT_LIST_SAP_FIRST = `, sap_first:sap_instructions->0`;

// PostgREST returns at most this many rows per request (the project's db-max-rows),
// so larger lists are fetched page by page.
export const PROJECT_LIST_PAGE_SIZE = 1000;
// Pages requested at once: the ~2,000-row complete list arrives in one round instead of one
// round per page. A full last page means there may be more, so the next batch follows.
export const PROJECT_LIST_PARALLEL_PAGES = 3;

type SupabaseClient = ReturnType<typeof useSupabase>;

async function fetchProjectListPage(
  supabase: SupabaseClient,
  select: string,
  statuses: string[],
  page: number
): Promise<ProjectListRow[]> {
  const from = page * PROJECT_LIST_PAGE_SIZE;
  const { data, error } = await supabase
    .from('projects')
    .select(select)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // stable order across pages
    .range(from, from + PROJECT_LIST_PAGE_SIZE - 1);

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  return (data ?? []) as unknown as ProjectListRow[];
}

async function fetchProjectListRows(
  supabase: SupabaseClient,
  status: ProjectListStatus,
  withSapFirst: boolean
): Promise<ProjectListRow[]> {
  const rows: ProjectListRow[] = [];
  const select = withSapFirst ? PROJECT_LIST_SELECT + PROJECT_LIST_SAP_FIRST : PROJECT_LIST_SELECT;
  const statuses = getProjectListStatuses(status);
  for (let first = 0; ; first += PROJECT_LIST_PARALLEL_PAGES) {
    const pages = await Promise.all(
      Array.from({ length: PROJECT_LIST_PARALLEL_PAGES }, (_, i) =>
        fetchProjectListPage(supabase, select, statuses, first + i)
      )
    );
    for (const page of pages) {
      rows.push(...page);
      if (page.length < PROJECT_LIST_PAGE_SIZE) return rows;
    }
  }
}

/** Users by id, from the cached users list (see useUsers). */
export async function fetchUsersById(
  supabase: SupabaseClient,
  queryClient: QueryClient
): Promise<Map<string, User>> {
  const users = await queryClient.fetchQuery({
    queryKey: queryKeys.users(),
    queryFn: () => fetchUsers(supabase),
    staleTime: USERS_STALE_TIME,
  });
  return new Map(users.map((user) => [user.id, user]));
}

/**
 * Turns a list row into the shape the views use: translators from the user map (an
 * assignment whose user no longer exists is skipped) and, for rows without manual
 * instructions, the first SAP entry as the instructions preview (the views filter it by
 * the exclusions when rendering; see useExcludedFirstEntryPreviews).
 */
export function toProjectWithTranslators(
  { projects_assignment, sap_first, ...project }: ProjectListRow,
  usersById: Map<string, User>
): ProjectWithTranslators {
  const hasManualInstructions = getBlankInstructionIds([project]).length === 0;
  return {
    ...project,
    sap_instructions: !hasManualInstructions && sap_first ? [sap_first] : null,
    translators: (projects_assignment ?? []).flatMap((assignment) => {
      const user = usersById.get(assignment.user_id);
      return user ?
          [{
            id: user.id,
            name: user.name,
            short_name: user.short_name || null,
            role: user.role,
            assignment_status: assignment.assignment_status,
            avatar: user.avatar || null,
            done_message: assignment.done_message || null,
          }]
        : [];
    }),
  };
}

/**
 * @param status "active" for the working lists ("management" for Manage Projects, which also
 * shows the projects still to be reviewed); "complete" for Concluded Projects and
 * Invoicing. Complete lists hold ~2,000 rows, so they skip SAP previews here and the
 * pages load them for the visible rows only (useSapInstructionPreviews).
 */
export function useProjectsWithTranslators(
  showPast: boolean = false,
  showAll: boolean = false,
  status: ProjectListStatus = "active"
) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  // Working lists (not the ~2,000-row complete list) carry SAP previews
  const withPreviews = status !== "complete";

  const listQuery = useQuery({
    queryKey: queryKeys.projectsWithTranslators(showPast, showAll, status),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      // Assignments and the first SAP entry are embedded; the users come alongside.
      const [typedProjects, usersById] = await Promise.all([
        fetchProjectListRows(supabase, status, withPreviews),
        fetchUsersById(supabase, queryClient),
      ]);

      // Combine projects with their translators
      const projectsWithTranslators = typedProjects.map((row) =>
        toProjectWithTranslators(row, usersById)
      );

      // Filter and sort projects based on showPast parameter
      const now = new Date();
      
      const getClosestDeadline = (p: ProjectWithTranslators) => {
        const validDates = [p.initial_deadline, p.interim_deadline, p.final_deadline]
          .filter(Boolean)
          .map((d) => {
            const date = new Date(d!);
            return isNaN(date.getTime()) ? null : date;
          })
          .filter(Boolean);
        
        if (validDates.length === 0) return null;
        return new Date(Math.min(...validDates.map((d) => d!.getTime())));
      };

      // Filter projects based on their closest deadline
      // If showAll is true, return all projects without filtering
      const filteredProjects = showAll
        ? projectsWithTranslators // Show all projects
        : projectsWithTranslators.filter((p) => {
            const closest = getClosestDeadline(p);
            if (!closest) return false; // Exclude projects without valid deadlines
            
            const isPast = closest.getTime() < now.getTime();
            const shouldInclude = showPast ? isPast : !isPast;
            
            return shouldInclude;
          });

      // Sort projects
      const sortedProjects = filteredProjects.sort((a, b) => {
        const da = getClosestDeadline(a);
        const db = getClosestDeadline(b);
        
        // Handle projects without deadlines
        if (!da && !db) return 0;
        if (!da) return 1; // Put projects without deadlines at the end
        if (!db) return -1;
        
        if (showPast) {
          // For past projects: most recent first (reverse chronological order)
          return db.getTime() - da.getTime();
        } else {
          // For future projects: closest deadline first (chronological order)
          return da.getTime() - db.getTime();
        }
      });

      return sortedProjects;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const fullPreviews = useExcludedFirstEntryPreviews(listQuery.data, withPreviews);
  const data = useMemo(
    () =>
      !listQuery.data || !fullPreviews?.size ?
        listQuery.data
      : listQuery.data.map((project) =>
          fullPreviews.has(project.id) ?
            { ...project, sap_instructions: fullPreviews.get(project.id) ?? null }
          : project
        ),
    [listQuery.data, fullPreviews]
  );

  return { ...listQuery, data };
}

/**
 * A row whose first SAP entry is excluded may still have a visible later one, so those rows
 * (usually none or a few) get their full SAP array once the exclusions are known. Done after
 * the list instead of inside it, so the list does not wait for the exclusions request.
 */
function useExcludedFirstEntryPreviews(
  projects: ProjectWithTranslators[] | undefined,
  enabled: boolean
) {
  const supabase = useSupabase();
  const { data: exclusions } = useQuery({
    queryKey: queryKeys.instructionExclusions(),
    queryFn: () => fetchInstructionExclusions(supabase),
    enabled,
  });
  const exclusionSet = useMemo(
    () => (exclusions ? toInstructionExclusionSet(exclusions) : null),
    [exclusions]
  );

  const excludedFirstEntries = useMemo(() => {
    if (!projects || !exclusionSet) return [];
    return projects.flatMap(({ id, sap_instructions }) =>
      sap_instructions?.length === 1 &&
      !pickSapInstructionPreview(sap_instructions[0], exclusionSet) ?
        [{ id, sap_first: sap_instructions[0] }]
      : []
    );
  }, [projects, exclusionSet]);
  const ids = useMemo(
    () => excludedFirstEntries.map(({ id }) => id).sort((a, b) => a - b),
    [excludedFirstEntries]
  );

  const { data } = useQuery({
    queryKey: [...queryKeys.sapInstructionPreviews(ids), 'excluded-first'],
    queryFn: () => buildSapInstructionPreviews(supabase, excludedFirstEntries, exclusionSet!),
    enabled: enabled && ids.length > 0 && exclusionSet !== null,
  });
  return data as Map<number, SapInstructionEntry[] | null> | undefined;
}
