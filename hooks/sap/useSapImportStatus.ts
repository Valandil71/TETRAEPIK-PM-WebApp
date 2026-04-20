"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchApi } from "@/lib/api/fetchApi";

export interface SapImportStatusResponse {
  status: "idle" | "running" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  startedBy: string | null;
  cooldown: {
    isActive: boolean;
    waitMinutes: number | null;
    retryAt: string | null;
  };
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

export function formatSapImportCooldownMessage(
  cooldown: SapImportStatusResponse["cooldown"]
): string {
  if (!cooldown.retryAt) {
    return "Import is on cooldown. Please try again in a few minutes.";
  }

  const retryTime = new Date(cooldown.retryAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const waitText = cooldown.waitMinutes
    ? ` (~${cooldown.waitMinutes} min)`
    : "";

  return `Import is on cooldown. Available again at ${retryTime}${waitText}.`;
}
