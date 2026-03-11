"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslatorDetails } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";
import { useOriginalRecordStore } from "@/lib/stores/useOriginalRecordStore";

interface AssignmentUserRow {
  id: string;
  name: string;
  short_name: string | null;
  role: string;
  avatar: string | null;
}

interface ProjectAssignmentRow {
  project_id: number;
  assignment_status: string;
  initial_message: string | null;
  refusal_message: string | null;
  done_message: string | null;
  users: AssignmentUserRow | null;
}

export function useProject(projectId: number | string | null) {
  const supabase = useSupabase();
  const setOriginal = useOriginalRecordStore((s) => s.setOriginal);

  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: async (): Promise<ProjectWithTranslatorDetails> => {
      if (!projectId) throw new Error("Project ID is required");

      // Fetch project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw new Error(`Failed to fetch project: ${projectError.message}`);
      }

      if (!project) {
        throw new Error("Project not found");
      }

      // Fetch assignments with user data and messages
      const { data: assignments, error: assignmentsError } = await supabase
        .from('projects_assignment')
        .select(`
          project_id,
          assignment_status,
          initial_message,
          refusal_message,
          done_message,
          users (
            id,
            name,
            short_name,
            role,
            avatar
          )
        `)
        .eq('project_id', projectId);

      if (assignmentsError) {
        throw new Error(`Failed to fetch project assignments: ${assignmentsError.message}`);
      }

      // Map assignments to translators
      const translators = ((assignments ?? []) as ProjectAssignmentRow[])
        .map((assignment) => ({
        id: assignment.users?.id || '',
        name: assignment.users?.name || '',
        short_name: assignment.users?.short_name || null,
        role: assignment.users?.role || '',
        assignment_status: assignment.assignment_status || 'unclaimed',
        initial_message: assignment.initial_message || null,
        refusal_message: assignment.refusal_message || null,
        done_message: assignment.done_message || null,
        avatar: assignment.users?.avatar || null,
      }))
        .filter((t) => t.id); // Filter out any invalid entries

      // Store original project record for concurrency conflict detection
      setOriginal('projects', { id: project.id }, project);

      return {
        ...project,
        translators,
      };
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
