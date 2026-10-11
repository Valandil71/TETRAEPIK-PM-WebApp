"use client";

import { useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { SapInstructionEntry } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";
import { fetchInstructionExclusions } from '@/hooks/settings/useInstructionExclusions';
import { filterSapInstructions, toInstructionExclusionSet } from '@/lib/sap/instruction-exclusions';

// Keeps `.in()` filters well under URL length limits.
const ID_CHUNK_SIZE = 200;

type SupabaseClient = ReturnType<typeof useSupabase>;

interface InstructionsShape {
  id: number;
  instructions?: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** getInstructionsPreview only falls back to SAP instructions when manual ones are blank. */
export function getBlankInstructionIds(projects: InstructionsShape[]): number[] {
  return projects
    .filter((p) => !p.instructions || p.instructions.trim() === '')
    .map((p) => p.id);
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
export async function loadSapInstructionPreviews(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  blankInstructionIds: number[]
): Promise<Map<number, SapInstructionEntry[] | null>> {
  const previews = new Map<number, SapInstructionEntry[] | null>();
  if (blankInstructionIds.length === 0) return previews;

  const firstEntries = await fetchInChunks<{ id: number; sap_first: SapInstructionEntry | null }>(
    blankInstructionIds,
    (ids) =>
      supabase
        .from('projects')
        .select('id, sap_first:sap_instructions->0')
        .in('id', ids)
        .not('sap_instructions', 'is', null)
  );
  if (firstEntries.length === 0) return previews;

  const exclusionSet = toInstructionExclusionSet(
    await queryClient.fetchQuery({
      queryKey: queryKeys.instructionExclusions(),
      queryFn: () => fetchInstructionExclusions(supabase),
    })
  );
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

/**
 * Fills `sap_instructions` previews for the projects currently on screen. Used by pages whose
 * lists are too large to load previews for every row (Concluded Projects, Invoicing).
 */
export function useSapInstructionPreviews<
  P extends InstructionsShape & { sap_instructions?: SapInstructionEntry[] | null },
  G extends { projects: P[] },
>(groups: G[]): G[] {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const ids = useMemo(
    () => getBlankInstructionIds(groups.flatMap((group) => group.projects)).sort((a, b) => a - b),
    [groups]
  );

  const { data: previews } = useQuery({
    queryKey: queryKeys.sapInstructionPreviews(ids),
    queryFn: () => loadSapInstructionPreviews(supabase, queryClient, ids),
    enabled: ids.length > 0,
  });

  return useMemo(() => {
    if (!previews || previews.size === 0) return groups;
    return groups.map((group) => ({
      ...group,
      projects: group.projects.map((project) =>
        previews.has(project.id) ?
          { ...project, sap_instructions: previews.get(project.id) ?? null }
        : project
      ),
    }));
  }, [groups, previews]);
}
