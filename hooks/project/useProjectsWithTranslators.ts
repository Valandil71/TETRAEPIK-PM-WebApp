"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslators, ProjectTranslator } from '@/types/project';
import { queryKeys, type ProjectListStatus } from "@/lib/queryKeys";
import {
  getBlankInstructionIds,
  loadSapInstructionPreviews,
} from '@/hooks/project/useSapInstructionPreviews';

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

// PostgREST returns at most this many rows per request (the project's db-max-rows),
// so larger lists are fetched page by page.
export const PROJECT_LIST_PAGE_SIZE = 1000;

async function fetchProjectListRows(
  supabase: ReturnType<typeof useSupabase>,
  status: ProjectListStatus
): Promise<ProjectListRow[]> {
  const rows: ProjectListRow[] = [];
  for (let from = 0; ; from += PROJECT_LIST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_LIST_SELECT)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // stable order across pages
      .range(from, from + PROJECT_LIST_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }

    const page = (data ?? []) as ProjectListRow[];
    rows.push(...page);
    if (page.length < PROJECT_LIST_PAGE_SIZE) return rows;
  }
}

/**
 * @param status "active" for the working lists; "complete" for Concluded Projects and
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

  return useQuery({
    queryKey: queryKeys.projectsWithTranslators(showPast, showAll, status),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      // Assignments are embedded so only rows for the listed projects are fetched.
      const typedProjects = await fetchProjectListRows(supabase, status);

      if (typedProjects.length === 0) {
        return [];
      }

      const sapPreviews =
        status === "active" ?
          await loadSapInstructionPreviews(supabase, queryClient, getBlankInstructionIds(typedProjects))
        : new Map();

      // Combine projects with their translators
      const projectsWithTranslators: ProjectWithTranslators[] = typedProjects.map(
        ({ projects_assignment, ...project }) => ({
          ...project,
          sap_instructions: sapPreviews.get(project.id) ?? null,
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
}
