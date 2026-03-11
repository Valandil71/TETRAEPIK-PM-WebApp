"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useConcurrencySafeMutation } from '@/hooks/core/useConcurrencySafeMutation';
import { useOriginalRecordStore } from "@/lib/stores/useOriginalRecordStore";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

/** Assignment record from the database */
interface ProjectAssignmentRecord {
  project_id: number;
  user_id: string;
  assignment_status: "unclaimed" | "claimed" | "done" | "rejected";
  initial_message?: string | null;
  refusal_message?: string | null;
  done_message?: string | null;
  created_at?: string;
}

/** Human-readable labels for assignment fields */
const ASSIGNMENT_FIELD_LABELS: Record<string, string> = {
  assignment_status: "Status",
  initial_message: "Initial Message",
  refusal_message: "Refusal Message",
  done_message: "Completion Message",
};

/**
 * Hook for updating project assignments with concurrency safety.
 * Detects if another user modified the assignment since it was loaded
 * and prompts the user to resolve conflicts.
 */
export function useUpdateAssignment(projectId: number, userId: string) {
  const queryClient = useQueryClient();
  const getOriginal = useOriginalRecordStore((s) => s.getOriginal);
  const clearOriginal = useOriginalRecordStore((s) => s.clearOriginal);
  const setOriginal = useOriginalRecordStore((s) => s.setOriginal);

  const primaryKey = { project_id: projectId, user_id: userId };

  const {
    executeMutation,
    conflictResult,
    forceUpdate,
    discardChanges,
    isConflictModalOpen,
    isLoading,
  } = useConcurrencySafeMutation<ProjectAssignmentRecord>({
    tableName: "projects_assignment",
    fieldLabels: ASSIGNMENT_FIELD_LABELS,
    // Note: projects_assignment doesn't have updated_at, so we use created_at
    // This means conflicts are only detected if the record was deleted and recreated
    // For actual concurrent edits, we rely on the field-level comparison
    versionField: "created_at",
  });

  /**
   * Store the original assignment record for later conflict detection.
   * Call this when you first load the assignment data.
   */
  const storeOriginalAssignment = (assignment: ProjectAssignmentRecord) => {
    setOriginal("projects_assignment", primaryKey, assignment as unknown as Record<string, unknown>);
  };

  /**
   * Update an assignment with concurrency checking.
   * Returns { conflictDetected: true } if a conflict was found.
   */
  const updateAssignment = async (
    updates: Partial<ProjectAssignmentRecord>
  ) => {
    const original = getOriginal("projects_assignment", primaryKey);

    if (!original) {
      // No original stored - proceed without conflict check
      // This can happen if the assignment was created after page load
      toast.warning(
        "Could not verify assignment version. Proceeding with update."
      );
    }

    try {
      const result = await executeMutation(
        primaryKey,
        (original as unknown as ProjectAssignmentRecord) || { ...primaryKey, ...updates },
        updates,
        () => {
          // Success callback
          clearOriginal("projects_assignment", primaryKey);
          queryClient.invalidateQueries({
            queryKey: queryKeys.project(projectId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.myProjects(userId),
          });
          queryClient.invalidateQueries({
            queryKey: ["projects-with-translators"],
          });
          toast.success("Assignment updated successfully");
        }
      );

      return result;
    } catch {
      toast.error("Failed to update assignment. Please try again.");
      return { conflictDetected: false, error: true };
    }
  };

  /** Force update after user confirms they want to keep their changes */
  const handleForceUpdate = async () => {
    await forceUpdate();
    clearOriginal("projects_assignment", primaryKey);
    queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.myProjects(userId),
    });
    queryClient.invalidateQueries({
      queryKey: ["projects-with-translators"],
    });
    toast.success("Assignment updated successfully");
  };

  /** Discard changes and reload latest data */
  const handleDiscardChanges = () => {
    discardChanges();
    // Refetch to get latest data
    queryClient.invalidateQueries({
      queryKey: queryKeys.project(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.myProjects(userId),
    });
    toast.info("Changes discarded. Reloading latest data.");
  };

  return {
    /** Store original assignment for conflict detection */
    storeOriginalAssignment,
    /** Update assignment with concurrency checking */
    updateAssignment,
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
