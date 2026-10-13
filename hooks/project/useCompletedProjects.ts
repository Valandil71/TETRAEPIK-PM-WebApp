"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslators } from '@/types/project';
import { queryKeys } from '@/lib/queryKeys';
import {
  PROJECT_LIST_SELECT,
  fetchUsersById,
  toProjectWithTranslators,
  useProjectsWithTranslators,
  type ProjectListRow,
} from '@/hooks/project/useProjectsWithTranslators';

// Enough rows for the first page (50 groups; most groups are 1-3 rows), still a small request.
export const COMPLETED_PREVIEW_ROWS = 300;

/** Invoicing tab filters the server can apply to the preview. */
export type CompletedPreviewFilter = 'none' | 'notFullyProcessed' | 'notInvoiced' | 'invoicedNotPaid';

export interface CompletedProjectsPreview {
  /**
   * Closest deadline order of the page's first page. Ties follow the full list's order
   * (created_at, then id, newest first), so the preview's first page matches it exactly.
   */
  order: 'asc' | 'desc';
  filter?: CompletedPreviewFilter;
}

/**
 * The complete list (~2,000 projects, shared by Concluded Projects and Invoicing), plus a
 * preview of its first rows fetched in parallel, in the page's own order: the page shows the
 * preview while the full list loads (`isPartial`), then switches to the full list.
 *
 * Pass `preview: null` when the preview could not match what the page shows (filters or a
 * search active, a page other than the first, an order the server cannot reproduce): the
 * page then waits for the full list.
 */
export function useCompletedProjects(preview: CompletedProjectsPreview | null) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const full = useProjectsWithTranslators(false, true, 'complete');
  const filter = preview?.filter ?? 'none';

  const previewQuery = useQuery({
    queryKey: queryKeys.completedProjectsPreview(preview?.order ?? 'none', filter),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      const ascending = preview?.order === 'asc';
      let query = supabase
        .from('projects')
        .select(PROJECT_LIST_SELECT)
        .eq('status', 'complete');
      if (filter === 'notFullyProcessed') query = query.or('invoiced.eq.false,paid.eq.false');
      if (filter === 'notInvoiced') query = query.eq('invoiced', false);
      if (filter === 'invoicedNotPaid') query = query.eq('invoiced', true).eq('paid', false);

      const [{ data, error }, usersById] = await Promise.all([
        query
          .order('closest_deadline', { ascending, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(COMPLETED_PREVIEW_ROWS),
        fetchUsersById(supabase, queryClient),
      ]);
      if (error) throw new Error(`Failed to fetch projects: ${error.message}`);

      return ((data ?? []) as unknown as ProjectListRow[]).map((row) =>
        toProjectWithTranslators(row, usersById)
      );
    },
    // Only needed until the full list is there; a failure just means waiting for it.
    enabled: preview !== null && !full.data,
    retry: false,
  });

  const previewProjects = preview !== null && !full.data ? previewQuery.data : undefined;

  return {
    projects: full.data ?? previewProjects,
    /** Showing the first rows only; the full list is still loading. */
    isPartial: !full.data && !!previewProjects,
    isLoading: !full.data && !previewProjects && !full.error,
    error: full.error,
  };
}
