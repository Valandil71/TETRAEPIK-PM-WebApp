"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import type { ProjectAssignment } from "@/types/project-assignment";
import { queryKeys } from "@/lib/queryKeys";

export function useMyProjects(userId: string | null) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const {
    data: projectsData,
    isLoading: loading,
  } = useQuery({
    queryKey: queryKeys.myProjects(userId),
    queryFn: async (): Promise<{ unclaimed: ProjectAssignment[]; claimed: ProjectAssignment[] }> => {
      if (!userId) {
        return { unclaimed: [], claimed: [] };
      }

      const { data, error } = await supabase
        .from("projects_assignment")
        .select(`
          project_id,
          user_id,
          assignment_status,
          initial_message,
          refusal_message,
          done_message,
          projects (
            id,
            name,
            system,
            words,
            lines,
            initial_deadline,
            interim_deadline,
            final_deadline,
            instructions,
            language_in,
            language_out,
            status
          )
        `)
        .eq("user_id", userId)
        .in("assignment_status", ["unclaimed", "claimed"]);

      if (error) {
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }

      const typedData = data as unknown as ProjectAssignment[];

      const unclaimed = typedData?.filter((p) => p.assignment_status === "unclaimed") || [];
      const claimed = typedData?.filter((p) => p.assignment_status === "claimed") || [];

      return { unclaimed, claimed };
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const unclaimedProjects = projectsData?.unclaimed || [];
  const claimedProjects = projectsData?.claimed || [];

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({
      projectId,
      userId,
      status,
      projectName,
      message,
    }: {
      projectId: number;
      userId: string;
      status: "claimed" | "rejected" | "done";
      projectName: string;
      message?: string | null;
    }) => {
      const updateData: {
        assignment_status: string;
        refusal_message?: string | null;
        done_message?: string | null;
      } = { assignment_status: status };

      if (status === "rejected" && message) {
        updateData.refusal_message = message;
      }
      if (status === "done" && message) {
        updateData.done_message = message;
      }

      const { error } = await supabase
        .from("projects_assignment")
        .update(updateData)
        .eq("project_id", projectId)
        .eq("user_id", userId);

      if (error) throw error;

      return { projectId, status, projectName };
    },
    onSuccess: ({ status, projectName, projectId }) => {
      const messages = {
        claimed: `Project "${projectName}" claimed successfully`,
        rejected: `Project "${projectName}" has been rejected`,
        done: `Project "${projectName}" marked as done`,
      };

      toast.success(messages[status]);

      // Invalidate and refetch the projects queries
      queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeManageProjectsCount() });
    },
    onError: (_error: Error, { status }) => {
      const action = status === "claimed"
        ? "claim"
        : status === "rejected"
        ? "reject"
        : "mark as done";
      
      toast.error(`Failed to ${action} project. Please try again.`);
    },
  });

  const claimProject = (projectId: number, projectName: string) => {
    if (!userId) return;
    updateAssignmentMutation.mutate({
      projectId,
      userId,
      status: "claimed",
      projectName,
    });
  };

  const rejectProject = (
    projectId: number,
    projectName: string,
    refusalMessage: string
  ) => {
    if (!userId) return;
    updateAssignmentMutation.mutate({
      projectId,
      userId,
      status: "rejected",
      projectName,
      message: refusalMessage,
    });
  };

  const markAsDone = (
    projectId: number,
    projectName: string,
    doneMessage?: string | null
  ) => {
    if (!userId) return;
    updateAssignmentMutation.mutate({
      projectId,
      userId,
      status: "done",
      projectName,
      message: doneMessage,
    });
  };

  const refreshProjects = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
  };

  return {
    unclaimedProjects,
    claimedProjects,
    loading,
    claimProject,
    rejectProject,
    markAsDone,
    refreshProjects,
    isUpdating: updateAssignmentMutation.isPending,
  };
}
