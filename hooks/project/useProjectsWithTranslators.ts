"use client";

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

interface AssignmentUserRow {
  id: string;
  name: string;
  short_name: string | null;
  role: string;
  avatar: string | null;
}

interface ProjectAssignmentRow {
  assignment_status: ProjectTranslator["assignment_status"];
  done_message: string | null;
  users: AssignmentUserRow | null;
}

type ProjectListRow = Omit<ProjectWithTranslators, "translators" | "sap_instructions"> & {
  projects_assignment: ProjectAssignmentRow[] | null;
  /** Only selected for working lists (see PROJECT_LIST_SAP_FIRST). */
  sap_first?: SapInstructionEntry | null;
};

// `sap_instructions` is deliberately not selected here: it is ~95% of the list payload.
// See loadSapInstructionPreviews for how the list still gets what the previews need.
// created_at/updated_at are not selected either: no list view reads them.
const PROJECT_LIST_SELECT = `
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
    users (
      id,
      name,
      short_name,
      role,
      avatar
    )
  )
`;

// Working lists also take the first SAP instruction entry (small), which the instructions
// preview needs; selecting it here saves a request after the list (loadSapInstructionPreviews).
const PROJECT_LIST_SAP_FIRST = `, sap_first:sap_instructions->0`;

// PostgREST returns at most this many rows per request (the project's db-max-rows),
// so larger lists are fetched page by page.
export const PROJECT_LIST_PAGE_SIZE = 1000;

async function fetchProjectListRows(
  supabase: ReturnType<typeof useSupabase>,
  status: ProjectListStatus,
  withSapFirst: boolean
): Promise<ProjectListRow[]> {
  const rows: ProjectListRow[] = [];
  const select = withSapFirst ? PROJECT_LIST_SELECT + PROJECT_LIST_SAP_FIRST : PROJECT_LIST_SELECT;
  for (let from = 0; ; from += PROJECT_LIST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('projects')
      .select(select)
      .in('status', getProjectListStatuses(status))
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // stable order across pages
      .range(from, from + PROJECT_LIST_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    const page = (data ?? []) as unknown as ProjectListRow[];
    rows.push(...page);
    if (page.length < PROJECT_LIST_PAGE_SIZE) return rows;
  }
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
  // Working lists (not the ~2,000-row complete list) carry SAP previews
  const withPreviews = status !== "complete";

  const listQuery = useQuery({
    queryKey: queryKeys.projectsWithTranslators(showPast, showAll, status),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      // Assignments and the first SAP entry are embedded, so the list is one request.
      const typedProjects = await fetchProjectListRows(supabase, status, withPreviews);

      if (typedProjects.length === 0) {
        return [];
      }

      // Rows without manual instructions get their first SAP entry as the preview; the views
      // filter it by the exclusions when rendering (see useExcludedFirstEntryPreviews below).
      const blankIds = new Set(getBlankInstructionIds(typedProjects));

      // Combine projects with their translators
      const projectsWithTranslators: ProjectWithTranslators[] = typedProjects.map(
        ({ projects_assignment, sap_first, ...project }) => ({
          ...project,
          sap_instructions: blankIds.has(project.id) && sap_first ? [sap_first] : null,
          translators: (projects_assignment ?? []).flatMap((assignment) =>
            assignment.users ?
              [{
                id: assignment.users.id,
                name: assignment.users.name,
                short_name: assignment.users.short_name || null,
                role: assignment.users.role,
                assignment_status: assignment.assignment_status,
                avatar: assignment.users.avatar || null,
                done_message: assignment.done_message || null,
              }]
            : []
          ),
        })
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
