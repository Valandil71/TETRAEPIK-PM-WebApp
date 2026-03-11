"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchApi } from "@/lib/api/fetchApi";

export interface SapImportStatusResponse {
  status: "idle" | "running" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  startedBy: string | null;
}

interface UseSapImportStatusOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useSapImportStatus(options: UseSapImportStatusOptions = {}) {
  const { enabled = true, refetchInterval = false } = options;

  return useQuery({
    queryKey: queryKeys.sapImportStatus(),
    queryFn: () => fetchApi<SapImportStatusResponse>("/api/sap/import-status"),
    enabled,
    refetchInterval,
  });
}
