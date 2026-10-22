"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { Project } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";
import { attachSapInstructionHtml } from '@/lib/sap/instructions';

export type ProjectInstructions = Pick<Project, "instructions" | "sap_instructions">;

/** Full manual + SAP instructions for one project, loaded on demand (lists omit them). */
export function useProjectInstructions(projectId: number | null) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: queryKeys.projectInstructions(projectId),
    queryFn: async (): Promise<ProjectInstructions> => {
      const { data, error } = await supabase
        .from('projects')
        .select('instructions, sap_instructions, sap_instructions_html')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch project instructions: ${error.message}`);
      }

      const row = data as ProjectInstructions & Pick<Project, "sap_instructions_html">;
      return {
        instructions: row.instructions,
        sap_instructions: attachSapInstructionHtml(row.sap_instructions, row.sap_instructions_html),
      };
    },
    enabled: projectId !== null,
  });
}
