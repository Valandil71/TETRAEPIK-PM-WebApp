"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabase } from "@/hooks/core/useSupabase";
import { queryKeys } from "@/lib/queryKeys";
import {
  DELETE_CONFIRMATION_PHRASE,
  deleteProject,
  isDeleteConfirmed,
  isRecreatedBySapImport,
} from "@/lib/projects/delete";
import { formatProjectName } from "@/utils/formatters";
import { getUserFriendlyError } from "@/utils/toastHelpers";

interface DeleteProjectSectionProps {
  project: {
    id: number;
    name: string;
    sap_subproject_id?: string | null;
    sap_import_key?: string | null;
  };
}

/** Danger zone at the bottom of the project page (PM/Admin): deletes the project for good. */
export function DeleteProjectSection({ project }: DeleteProjectSectionProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(supabase, project.id),
    onSuccess: () => {
      // Drop the deleted project instead of refetching it, which would only fail
      queryClient.removeQueries({ queryKey: queryKeys.project(project.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeManageProjectsCount() });
      toast.success("Project deleted");
      router.replace("/management");
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "project deletion"));
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (deleteMutation.isPending) return;
    setOpen(next);
    if (!next) setTyped("");
  };

  const confirmed = isDeleteConfirmed(typed);

  return (
    <section className="mt-10 rounded-2xl border border-red-200 dark:border-red-900/60 p-6">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger zone</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Delete this project</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Once deleted, the project and its collaborator assignments are gone for good.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="cursor-pointer shrink-0 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete project
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <DialogTitle>Delete project</DialogTitle>
            </div>
            <DialogDescription asChild className="pt-2">
              <div className="space-y-3">
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatProjectName(project.name)}
                </p>
                <p>
                  This cannot be undone. The project and its collaborator assignments will be
                  permanently deleted.
                </p>
                {isRecreatedBySapImport(project) && (
                  <p className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-800 dark:text-amber-300">
                    This project came from SAP. If it is still in SAP, the next “Import from
                    SAP” will create it again.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmed) deleteMutation.mutate();
            }}
            className="space-y-4"
          >
            <label htmlFor="delete-confirmation" className="block text-sm text-gray-700 dark:text-gray-300">
              To confirm, type <span className="font-semibold">“{DELETE_CONFIRMATION_PHRASE}”</span>{" "}
              in the box below
            </label>
            <Input
              id="delete-confirmation"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={deleteMutation.isPending}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!confirmed || deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteMutation.isPending ?
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Trash2 className="w-4 h-4 mr-2" />}
                {deleteMutation.isPending ? "Deleting..." : "Delete this project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
