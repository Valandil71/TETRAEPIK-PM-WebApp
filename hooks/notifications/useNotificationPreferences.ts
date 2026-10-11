"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/hooks/core/useSupabase";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFriendlyError } from "@/utils/toastHelpers";

/** Project types a PM/Admin gets notified about. Empty = every type. */
export function useNotificationPreferences(userId: string | null) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const queryKey = queryKeys.notificationPreferences(userId);

  const { data: projectTypes = [], isLoading, isFetched } = useQuery({
    queryKey,
    queryFn: async (): Promise<string[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("project_types")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return (data?.project_types as string[] | undefined) ?? [];
    },
    enabled: !!userId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (types: string[]) => {
      if (!userId) throw new Error("User ID required");

      const { error } = await supabase.from("notification_preferences").upsert(
        { user_id: userId, project_types: types, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

      if (error) {
        throw new Error(`Failed to save notification preferences: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Notification preferences saved");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error, "notification preferences save"));
    },
  });

  return {
    projectTypes,
    isLoading,
    isFetched,
    saveProjectTypes: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
  };
}
