"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError, fetchApi } from "@/lib/api/fetchApi";

/**
 * Request body for syncing SAP projects
 */
export interface SyncSapProjectsRequest {
  projects: Array<{
    projectId: number;
    subProjectId: string;
  }>;
}

/**
 * Response from the sync API
 */
export interface SyncSapProjectsResponse {
  imported: number;
  updated: number;
  failed: number;
  errors?: string[];
  reportCreated?: boolean;
  reportCreationError?: string | null;
}

/**
 * Rate limit error response from the sync API
 */
interface RateLimitResponse {
  error: "rate_limited";
  waitMinutes: number;
  retryAt: string;
}

interface ImportInProgressResponse {
  error: "import_in_progress";
  startedAt: string | null;
}

/**
 * Hook for importing/syncing SAP projects to the local database
 *
 * Features:
 * - Batch import - imports multiple subprojects at once
 * - Rate limit handling - 10-minute cooldown between imports with toast feedback
 * - Invalidates project queries on success
 * - Shows summary toast with import results
 */
export function useSyncSapProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      projects: Array<{ projectId: number; subProjectId: string }>
    ): Promise<SyncSapProjectsResponse> => {
      try {
        return await fetchApi<SyncSapProjectsResponse>("/api/sap/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects }),
        });
      } catch (error) {
        if (error instanceof ApiError && error.isRateLimited) {
          const data = error.data as RateLimitResponse | null;
          if (data?.error === "rate_limited" && data.retryAt) {
            const retryTime = new Date(data.retryAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            toast.info(
              `Import is on cooldown. Available again at ${retryTime} (~${data.waitMinutes} min).`,
              { duration: 6000 }
            );
          }
        }

        if (error instanceof ApiError && error.isConflict) {
          const data = error.data as ImportInProgressResponse | null;
          if (data?.error === "import_in_progress") {
            const startedAt = data.startedAt ? new Date(data.startedAt) : null;
            const startedText = startedAt
              ? ` Started ${startedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : "";

            toast.info(
              `An SAP import is already running. Please wait until it finishes.${startedText}`,
              { duration: 6000 }
            );
            queryClient.invalidateQueries({ queryKey: queryKeys.sapImportStatus() });
          }
        }

        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sapImportStatus() });
      queryClient.invalidateQueries({ queryKey: ["import-reports"] });

      if (data.failed === 0) {
        if (data.imported === 0 && data.updated === 0) {
          toast.info("No projects needed to be imported or updated.");
        } else {
          toast.success(
            `Successfully imported ${data.imported} new project(s) and updated ${data.updated} project(s).`
          );
        }
      } else {
        toast.warning(
          `Imported ${data.imported} new, updated ${data.updated}, but ${data.failed} failed.`
        );

      }

      if (data.reportCreated === false) {
        toast.error(
          `The import finished, but the report could not be created, so the report modal will not appear. Reason: ${data.reportCreationError || "Unknown error"}`,
          { duration: 8000 }
        );
      }
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.isRateLimited || error.isConflict)
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to import projects from SAP";

      toast.error(message);
    },
  });
}
