"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { Project } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";

export type ProjectInstructions = Pick<Project, "instructions" | "sap_instructions">;

/** Full manual + SAP instructions for one project, loaded on demand (lists omit them). */
export function useProjectInstructions(projectId: number | null) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: queryKeys.projectInstructions(projectId),
    queryFn: async (): Promise<ProjectInstructions> => {
      const { data, error } = await supabase
        .from('projects')
        .select('instructions, sap_instructions')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch project instructions: ${error.message}`);
      }

      return data as ProjectInstructions;
    },
    enabled: projectId !== null,
  });
}
