"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSapImportStatus } from "@/hooks/sap/useSapImportStatus";
import { useSapProjects } from "@/hooks/sap/useSapProjects";
import type { SapProjectsResponse } from "@/hooks/sap/useSapProjects";
import { useSyncSapProjects } from "@/hooks/sap/useSyncSapProjects";

interface SapImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function flattenSubProjects(data: SapProjectsResponse | undefined) {
  if (!data?.projects) return [];

  return data.projects.flatMap((project) =>
    project.subProjects.map((subProject) => ({
      projectId: project.projectId,
      subProjectId: subProject.subProjectId,
    }))
  );
}

export function SapImportDialog({
  open,
  onOpenChange,
}: SapImportDialogProps) {
  const {
    data: importStatus,
    isLoading: isLoadingStatus,
    error: statusError,
    refetch: refetchStatus,
  } = useSapImportStatus({
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const {
    refetch: fetchProjects,
    isFetching: isFetchingProjects,
  } = useSapProjects();
  const syncMutation = useSyncSapProjects();

  const [processingNoticeOpen, setProcessingNoticeOpen] = useState(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  const closeProcessingNotice = () => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    setProcessingNoticeOpen(false);
  };

  const showProcessingNotice = () => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    setProcessingNoticeOpen(true);
    processingTimeoutRef.current = setTimeout(() => {
      setProcessingNoticeOpen(false);
      processingTimeoutRef.current = null;
    }, 7000);
  };

  const isImportRunning = importStatus?.status === "running";
  const isBusy = isFetchingProjects || syncMutation.isPending;

  const lastSyncText = importStatus?.finishedAt
    ? `Last synchronization finished ${formatDistanceToNow(
        new Date(importStatus.finishedAt),
        { addSuffix: true }
      )}.`
    : "No completed SAP import yet.";

  const handleConfirmImport = async () => {
    if (isImportRunning || isBusy) return;

    showProcessingNotice();
    onOpenChange(false);

    try {
      const fetchResult = await fetchProjects();
      if (fetchResult.error) {
        throw fetchResult.error;
      }

      const allSubProjects = flattenSubProjects(fetchResult.data as SapProjectsResponse | undefined);
      if (allSubProjects.length === 0) {
        toast.info("No SAP subprojects are available to import.");
        closeProcessingNotice();
        return;
      }

      await syncMutation.mutateAsync(allSubProjects);
      refetchStatus();
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error("Failed to start the SAP import");
      }
      refetchStatus();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Import from SAP
            </DialogTitle>
            <DialogDescription>
              Start a full synchronization from SAP TPM into the local project
              management system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Last synchronization
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isLoadingStatus ? "Checking latest synchronization..." : lastSyncText}
              </p>
              {importStatus?.finishedAt && (
                <p className="mt-2 text-xs text-gray-400">
                  Completed at {new Date(importStatus.finishedAt).toLocaleString()}
                </p>
              )}
            </div>

            {isImportRunning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  An SAP import is already being processed.
                  {importStatus?.startedAt && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Started {formatDistanceToNow(new Date(importStatus.startedAt), { addSuffix: true })}.
                    </span>
                  )}
                </div>
              </div>
            )}

            {statusError && !isLoadingStatus && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The latest synchronization time could not be loaded, but you can still try to start the import.
              </p>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400">
              This action creates new projects and updates existing SAP-sourced
              projects. You will receive the import report when it finishes.
            </p>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImportRunning || isBusy}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Confirm Import"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={processingNoticeOpen} onOpenChange={setProcessingNoticeOpen}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-lg">Import in progress</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                This may take a few minutes. You&apos;ll be notified with the
                report when it finishes.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={closeProcessingNotice}
            >
              Dismiss
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


