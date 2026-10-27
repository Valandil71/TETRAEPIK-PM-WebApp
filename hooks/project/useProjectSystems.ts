"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import { queryKeys } from "@/lib/queryKeys";

/**
 * Every system used by a project, sorted, for the System select.
 * `current` is always included, so a project keeps its own system as an option.
 */
export function useProjectSystems(current?: string | null) {
  const supabase = useSupabase();

  const query = useQuery({
    queryKey: queryKeys.projectSystems(),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('project_systems');
      if (error) throw new Error(`Failed to load systems: ${error.message}`);
      return (data as string[] | null) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const systems = query.data ?? [];
  const options =
    current && !systems.includes(current) ?
      [...systems, current].sort()
    : systems;

  return { systems: options, isLoading: query.isLoading, error: query.error };
}
