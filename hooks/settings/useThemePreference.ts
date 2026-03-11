"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { queryKeys } from "@/lib/queryKeys";

export type ThemePreference = "system" | "light" | "dark";

interface UpdateThemeParams {
  userId: string;
  preference: ThemePreference;
}

export function useThemePreference() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const updateThemeMutation = useMutation({
    mutationFn: async ({ userId, preference }: UpdateThemeParams) => {
      const { error } = await supabase
        .from("users")
        .update({ theme_preference: preference })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to update theme preference: ${error.message}`);
      }

      return preference;
    },
    onSuccess: (preference) => {
      // Invalidate user query to refresh theme preference
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      
      const label = preference === "system" ? "System" : preference === "light" ? "Light" : "Dark";
      toast.success(`Theme set to ${label}`);
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "theme update"));
    },
  });

  return {
    updateTheme: updateThemeMutation.mutate,
    isUpdating: updateThemeMutation.isPending,
  };
}

/**
 * Resolves the actual dark mode state based on preference and system setting
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): boolean {
  if (preference === "system") {
    return systemPrefersDark;
  }
  return preference === "dark";
}





