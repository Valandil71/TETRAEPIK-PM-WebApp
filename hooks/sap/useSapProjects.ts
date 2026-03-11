"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { fetchApi } from "@/lib/api/fetchApi";

/**
 * SAP Project from the SAP API
 */
export interface SapProject {
  projectId: number;
  projectName: string;
  account: string;
  subProjects: SapSubProject[];
}

/**
 * SAP SubProject from the SAP API
 */
export interface SapSubProject {
  subProjectId: string;
  subProjectName: string;
  dmName: string;
  pmName: string;
  projectType: string;
}

/**
 * Response from the SAP projects API
 */
export interface SapProjectsResponse {
  projects: SapProject[];
}

/**
 * Hook to fetch SAP projects from the API.
 * This only fetches the project list - no rate limit on fetching.
 * Rate limiting is enforced on the import/sync endpoint instead.
 */
export function useSapProjects() {
  const query = useQuery({
    queryKey: queryKeys.sapProjects(),
    queryFn: () => fetchApi<SapProjectsResponse>("/api/sap/projects"),
    retry: false,
    enabled: false,
  });

  useEffect(() => {
    if (!query.error) return;
    const message = query.error instanceof Error
      ? query.error.message
      : "Failed to fetch SAP projects";
    toast.error(`SAP Error: ${message}`);
  }, [query.error]);

  return query;
}
