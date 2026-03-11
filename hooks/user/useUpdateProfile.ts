"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { queryKeys } from "@/lib/queryKeys";

interface UpdateProfileData {
  name?: string;
  short_name?: string | null;
  C_user?: string | null;
  TE_user?: string | null;
  email?: string;
  avatar?: string | null;
}

export function useUpdateProfile() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        throw new Error("Not authenticated");
      }

      const updates: UpdateProfileData = {};

      // Update user profile fields
      if (data.name !== undefined) updates.name = data.name;
      // Convert empty string to null for short_name (nullable field)
      if (data.short_name !== undefined) {
        updates.short_name = data.short_name === null ? null : data.short_name.trim() || null;
      }
      // Convert empty string to null for C_user/TE_user (nullable unique fields)
      if (data.C_user !== undefined) {
        updates.C_user = data.C_user === null ? null : data.C_user.trim() || null;
      }
      if (data.TE_user !== undefined) {
        updates.TE_user = data.TE_user === null ? null : data.TE_user.trim() || null;
      }

      // Update users table
      if (Object.keys(updates).length > 0) {
        const { error: profileError } = await supabase
          .from("users")
          .update(updates)
          .eq("id", authUser.id);

        if (profileError) {
          throw new Error(
            `Failed to update profile: ${profileError.message}`
          );
        }
      }

      // Update email if provided and different
      if (data.email && data.email !== authUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        });

        if (emailError) {
          throw new Error(`Failed to update email: ${emailError.message}`);
        }

        // Email change requires confirmation
        return { requiresEmailConfirmation: true };
      }

      return { requiresEmailConfirmation: false };
    },
    onSuccess: (result) => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.availableAvatars() });

      if (result.requiresEmailConfirmation) {
        toast.info(
          "A confirmation email has been sent. Please check your inbox to confirm the email change."
        );
      } else {
        toast.success("Profile updated successfully!");
      }
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "profile update"));
    },
  });
}
