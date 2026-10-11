"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslators, ProjectTranslator, SapInstructionEntry } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";
import { fetchInstructionExclusions } from '@/hooks/settings/useInstructionExclusions';
import { filterSapInstructions, toInstructionExclusionSet } from '@/lib/sap/instruction-exclusions';

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
  created_at,
  updated_at,
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

// Keeps `.in()` filters well under URL length limits when all ~2,000 projects are listed.
const ID_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Picks the SAP entries a list row needs for getInstructionsPreview: the first entry when it
 * survives the exclusion filter, otherwise null (the caller then loads the full array).
 */
export function pickSapInstructionPreview(
  firstEntry: SapInstructionEntry | null,
  exclusionSet: Set<string>
): SapInstructionEntry[] | null {
  if (!firstEntry) return null;
  return filterSapInstructions([firstEntry], exclusionSet).length > 0 ? [firstEntry] : null;
}

type SupabaseClient = ReturnType<typeof useSupabase>;

async function fetchInChunks<T>(
  ids: number[],
  fetchChunk: (chunkIds: number[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const results = await Promise.all(chunk(ids, ID_CHUNK_SIZE).map(fetchChunk));
  return results.flatMap(({ data, error }) => {
    if (error) throw new Error(`Failed to fetch SAP instructions: ${error.message}`);
    return data ?? [];
  });
}

/**
 * List views only use SAP instructions to label rows without manual instructions as
 * "SAP instructions" vs "No instructions" (getInstructionsPreview). For those rows we fetch
 * just the first entry and fall back to the full array only when that entry is excluded.
 * Rows with manual instructions get no SAP data; the full text is loaded on demand
 * (useProjectInstructions).
 */
async function loadSapInstructionPreviews(
  supabase: SupabaseClient,
  projectIds: number[],
  getExclusionSet: () => Promise<Set<string>>
): Promise<Map<number, SapInstructionEntry[] | null>> {
  const previews = new Map<number, SapInstructionEntry[] | null>();
  if (projectIds.length === 0) return previews;

  const firstEntries = await fetchInChunks<{ id: number; sap_first: SapInstructionEntry | null }>(
    projectIds,
    (ids) =>
      supabase
        .from('projects')
        .select('id, sap_first:sap_instructions->0')
        .in('id', ids)
        .not('sap_instructions', 'is', null)
  );
  if (firstEntries.length === 0) return previews;

  const exclusionSet = await getExclusionSet();
  const needFullIds: number[] = [];
  for (const row of firstEntries) {
    const preview = pickSapInstructionPreview(row.sap_first, exclusionSet);
    if (preview) {
      previews.set(row.id, preview);
    } else {
      needFullIds.push(row.id);
    }
  }

  if (needFullIds.length > 0) {
    const fullRows = await fetchInChunks<{ id: number; sap_instructions: SapInstructionEntry[] | null }>(
      needFullIds,
      (ids) => supabase.from('projects').select('id, sap_instructions').in('id', ids)
    );
    for (const row of fullRows) {
      previews.set(row.id, row.sap_instructions);
    }
  }

  return previews;
}

export function useProjectsWithTranslators(
  showPast: boolean = false,
  showAll: boolean = false,
  includeAllStatuses: boolean = false
) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.projectsWithTranslators(showPast, showAll, includeAllStatuses),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      // Build the query. Assignments are embedded so only rows for the listed projects are fetched.
      let query = supabase
        .from('projects')
        .select(PROJECT_LIST_SELECT)
        .order('created_at', { ascending: false });

      // Only filter by active status unless includeAllStatuses is true
      // (invoicing page needs complete projects)
      if (!includeAllStatuses) {
        query = query.eq('status', 'active');
      }

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`);
      }

      if (!projects || projects.length === 0) {
        return [];
      }

      const typedProjects = projects as ProjectListRow[];

      // getInstructionsPreview only falls back to SAP instructions when manual ones are blank
      const blankInstructionIds = typedProjects
        .filter((p) => !p.instructions || p.instructions.trim() === '')
        .map((p) => p.id);

      const sapPreviews = await loadSapInstructionPreviews(supabase, blankInstructionIds, async () =>
        toInstructionExclusionSet(
          await queryClient.fetchQuery({
            queryKey: queryKeys.instructionExclusions(),
            queryFn: () => fetchInstructionExclusions(supabase),
          })
        )
      );

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
