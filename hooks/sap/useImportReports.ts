"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { queryKeys } from "@/lib/queryKeys";

interface ImportReport {
  id: number;
  created_at: string;
  triggered_by: string | null;
  report_type: "manual" | "cron";
  new_projects: Array<{
    id: number;
    name: string;
    system: string;
    language_in: string | null;
    language_out: string | null;
  }>;
  modified_projects: Array<{
    id: number;
    name: string;
    changes: Record<string, { old: unknown; new: unknown }>;
  }>;
  summary: string | null;
  acknowledged_by: string[];
}

export function useImportReports(userId: string | null) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const queryKey = queryKeys.importReports(userId);

  // Fetch unacknowledged reports for the current user
  const { data: reports = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ImportReport[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("import_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      // Filter to only unacknowledged reports for this user
      return (data || []).filter(
        (r: ImportReport) => !r.acknowledged_by?.includes(userId)
      );
    },
    enabled: !!userId,
  });

  // Acknowledge reports (add user ID to acknowledged_by array)
  const acknowledgeMutation = useMutation({
    mutationFn: async (reportIds: number[]) => {
      if (!userId) throw new Error("User ID required");

      for (const reportId of reportIds) {
        const { error } = await supabase.rpc("acknowledge_import_report", {
          p_report_id: reportId,
          p_user_id: userId,
        });

        // Fallback: if the RPC doesn't exist, update directly
        if (error?.message?.includes("function")) {
          const { data: report } = await supabase
            .from("import_reports")
            .select("acknowledged_by")
            .eq("id", reportId)
            .single();

          const currentAcked = report?.acknowledged_by || [];
          if (!currentAcked.includes(userId)) {
            await supabase
              .from("import_reports")
              .update({
                acknowledged_by: [...currentAcked, userId],
              })
              .eq("id", reportId);
          }
        } else if (error) {
          throw new Error(error.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    reports,
    isLoading,
    hasUnacknowledged: reports.length > 0,
    acknowledge: (reportIds: number[]) => acknowledgeMutation.mutate(reportIds),
    acknowledgeAll: () =>
      acknowledgeMutation.mutate(reports.map((r) => r.id)),
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
