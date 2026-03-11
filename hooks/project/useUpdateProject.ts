"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useConcurrencySafeMutation } from '@/hooks/core/useConcurrencySafeMutation';
import { useOriginalRecordStore } from "@/lib/stores/useOriginalRecordStore";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import type { Project } from "@/types/project";

/** Human-readable labels for project fields */
const PROJECT_FIELD_LABELS: Record<string, string> = {
  name: "Project Name",
  status: "Status",
  system: "System",
  words: "Word Count",
  lines: "Line Count",
  language_in: "Source Language",
  language_out: "Target Language",
  initial_deadline: "Initial Deadline",
  interim_deadline: "Interim Deadline",
  final_deadline: "Final Deadline",
  instructions: "Instructions",
  paid: "Paid",
  invoiced: "Invoiced",
};

/**
 * Hook for updating projects with concurrency safety.
 * Detects if another user modified the project since it was loaded
 * and prompts the user to resolve conflicts.
 */
export function useUpdateProject(projectId: number) {
  const queryClient = useQueryClient();
  const getOriginal = useOriginalRecordStore((s) => s.getOriginal);
  const clearOriginal = useOriginalRecordStore((s) => s.clearOriginal);

  const {
    executeMutation,
    conflictResult,
    forceUpdate,
    discardChanges,
    isConflictModalOpen,
    isLoading,
  } = useConcurrencySafeMutation<Project>({
    tableName: "projects",
    fieldLabels: PROJECT_FIELD_LABELS,
    versionField: "updated_at",
  });

  /**
   * Update a project with concurrency checking.
   * Returns { conflictDetected: true } if a conflict was found.
   */
  const updateProject = async (updates: Partial<Project>) => {
    const original = getOriginal("projects", { id: projectId });

    if (!original) {
      toast.error(
        "Unable to verify project version. Please refresh and try again."
      );
      return { conflictDetected: false, error: true };
    }

    try {
      const result = await executeMutation(
        { id: projectId },
        original as unknown as Project,
        updates,
        () => {
          // Success callback
          clearOriginal("projects", { id: projectId });
          queryClient.invalidateQueries({
            queryKey: queryKeys.project(projectId),
          });
          queryClient.invalidateQueries({
            queryKey: ["projects-with-translators"],
          });
          toast.success("Project updated successfully");
        }
      );

      return result;
    } catch {
      toast.error("Failed to update project. Please try again.");
      return { conflictDetected: false, error: true };
    }
  };

  /** Force update after user confirms they want to keep their changes */
  const handleForceUpdate = async () => {
    await forceUpdate();
    clearOriginal("projects", { id: projectId });
    queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: ["projects-with-translators"],
    });
    toast.success("Project updated successfully");
  };

  /** Discard changes and reload latest data */
  const handleDiscardChanges = () => {
    discardChanges();
    // Refetch to get latest data
    queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
    toast.info("Changes discarded. Reloading latest data.");
  };

  return {
    /** Update project with concurrency checking */
    updateProject,
    /** Current conflict result (null if no conflict) */
    conflictResult,
    /** Whether the conflict modal should be open */
    isConflictModalOpen,
    /** Force the update despite detected conflicts */
    forceUpdate: handleForceUpdate,
    /** Discard changes and close the conflict modal */
    discardChanges: handleDiscardChanges,
    /** Whether a mutation is in progress */
    isLoading,
  };
}
