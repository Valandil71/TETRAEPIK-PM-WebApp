"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, FilePlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/hooks/core/useSupabase";
import { queryKeys } from "@/lib/queryKeys";
import { createStmProject, ProjectCopyError } from "@/lib/projects/stm";
import { getUserFriendlyError } from "@/utils/toastHelpers";

interface DuplicateProjectDialogProps {
  /** The project to copy; null keeps the dialog closed. */
  project: { id: number; name: string } | null;
  onClose: () => void;
}

/**
 * Copies a project either as its STM project (created right away) or as a duplicate, which
 * opens the edit form first and is only created when the PM saves it.
 */
export function DuplicateProjectDialog({ project, onClose }: DuplicateProjectDialogProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const stmMutation = useMutation({
    mutationFn: (projectId: number) => createStmProject(supabase, projectId),
    onSuccess: (newProject, projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      onClose();
      toast.success("STM project created. Opening it now.");
      router.push(`/project/${newProject.id}`);
    },
    onError: (error: Error) => {
      // The dialog stays open, so the PM can choose "Duplicate project" instead
      if (error instanceof ProjectCopyError) {
        const existingProjectId = error.existingProjectId;
        toast.error(error.message, {
          action:
            existingProjectId ?
              {
                label: "Open STM project",
                onClick: () => {
                  onClose();
                  router.push(`/project/${existingProjectId}`);
                },
              }
            : undefined,
        });
        return;
      }
      toast.error(getUserFriendlyError(error, "project creation"));
    },
  });

  const openDuplicateForm = () => {
    if (!project) return;
    onClose();
    router.push(`/project/${project.id}/edit?duplicate=1`);
  };

  const optionClassName =
    "w-full flex items-start gap-3 p-4 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <Dialog
      open={project !== null}
      onOpenChange={(next) => !next && !stmMutation.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Copy className="w-6 h-6 text-blue-500" />
            <DialogTitle>Duplicate project</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{project?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            className={optionClassName}
            onClick={() => project && stmMutation.mutate(project.id)}
            disabled={stmMutation.isPending}
          >
            {stmMutation.isPending ?
              <Loader2 className="w-5 h-5 mt-0.5 shrink-0 animate-spin text-blue-500" />
            : <FilePlus className="w-5 h-5 mt-0.5 shrink-0 text-blue-500" />}
            <span>
              <span className="block font-medium text-gray-900 dark:text-white">
                Create STM project
              </span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Copy with system STM, for the terminology. One per project.
              </span>
            </span>
          </button>
          <button
            type="button"
            className={optionClassName}
            onClick={openDuplicateForm}
            disabled={stmMutation.isPending}
          >
            <Copy className="w-5 h-5 mt-0.5 shrink-0 text-blue-500" />
            <span>
              <span className="block font-medium text-gray-900 dark:text-white">
                Duplicate project
              </span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                Opens a form with this project&apos;s details, it is only created when you save it. The SAP
                import does not update it.
              </span>
            </span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={stmMutation.isPending}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
