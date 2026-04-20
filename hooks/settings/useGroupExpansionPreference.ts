"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/core/useSupabase";
import { queryKeys } from "@/lib/queryKeys";
import type { GroupExpansionMode } from "@/lib/stores/useLayoutStore";
import { getUserFriendlyError } from "@/utils/toastHelpers";

interface UpdateGroupExpansionParams {
  userId: string;
  mode: GroupExpansionMode;
}

export function useGroupExpansionPreference() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const updateGroupExpansionMutation = useMutation({
    mutationFn: async ({ userId, mode }: UpdateGroupExpansionParams) => {
      const { error } = await supabase
        .from("users")
        .update({ expansion_mode: mode })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to update group expansion preference: ${error.message}`);
      }

      return mode;
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });

      const label = mode === "expandAll" ? "Expand All" : "Collapse All";
      toast.success(`Group expansion set to ${label}`);
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "group expansion update"));
    },
  });

  return {
    updateGroupExpansionMode: updateGroupExpansionMutation.mutate,
    isUpdating: updateGroupExpansionMutation.isPending,
  };
}
