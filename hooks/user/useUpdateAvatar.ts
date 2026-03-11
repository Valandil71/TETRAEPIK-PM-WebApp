"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { queryKeys } from "@/lib/queryKeys";

// Custom error class for avatar-specific errors
export class AvatarAlreadyTakenError extends Error {
  constructor(message = "This avatar has already been taken by another user") {
    super(message);
    this.name = "AvatarAlreadyTakenError";
  }
}

interface UpdateAvatarResult {
  success: boolean;
  avatar: string | null;
}

export function useUpdateAvatar() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (avatar: string | null): Promise<UpdateAvatarResult> => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        throw new Error("Not authenticated. Please log in and try again.");
      }

      // If setting to null (removing avatar), just do it
      if (avatar === null) {
        const { error } = await supabase
          .from("users")
          .update({ avatar: null })
          .eq("id", authUser.id);

        if (error) {
          throw new Error(`Failed to remove avatar: ${error.message}`);
        }

        return { success: true, avatar: null };
      }

      // If it's a custom URL (starts with http), skip availability check
      // Custom URLs are unique per user and don't need the predefined avatar logic
      const isCustomUrl = avatar.startsWith("http://") || avatar.startsWith("https://");

      if (isCustomUrl) {
        // Just update the avatar directly for custom URLs
        const { error: updateError } = await supabase
          .from("users")
          .update({ avatar })
          .eq("id", authUser.id);

        if (updateError) {
          throw new Error(`Failed to update avatar: ${updateError.message}`);
        }

        return { success: true, avatar };
      }

      // For predefined avatars, check if avatar is still available before attempting update
      // This is a pre-check to give better UX, but the DB constraint is the real protection
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("avatar", avatar)
        .neq("id", authUser.id)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Failed to check avatar availability: ${checkError.message}`);
      }

      if (existingUser) {
        throw new AvatarAlreadyTakenError();
      }

      // Attempt to update the avatar
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar })
        .eq("id", authUser.id);

      if (updateError) {
        // Check for unique constraint violation (race condition case)
        // PostgreSQL unique violation error code is 23505
        if (
          updateError.code === "23505" ||
          updateError.message.toLowerCase().includes("unique") ||
          updateError.message.toLowerCase().includes("duplicate")
        ) {
          throw new AvatarAlreadyTakenError(
            "Someone just selected this avatar! Please choose a different one."
          );
        }

        throw new Error(`Failed to update avatar: ${updateError.message}`);
      }

      return { success: true, avatar };
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.availableAvatars() });

      toast.success("Avatar updated successfully!");
    },
    onError: (error: Error) => {
      if (error instanceof AvatarAlreadyTakenError) {
        toast.error(error.message, {
          description: "Please select a different avatar.",
          duration: 5000,
        });
      } else {
        toast.error(getUserFriendlyError(error, "avatar update"));
      }
    },
  });
}
