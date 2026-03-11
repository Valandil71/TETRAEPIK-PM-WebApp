"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { queryKeys } from "@/lib/queryKeys";

interface Avatar {
  filename: string;
  display_name: string;
}

interface UsedAvatarRow {
  avatar: string | null;
}

/**
 * Check if an avatar value is a custom upload (URL) vs predefined (filename)
 */
function isCustomAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith("http://") || avatar.startsWith("https://");
}

export function useAvailableAvatars() {
  const supabase = useSupabase();

  return useQuery({
    queryKey: queryKeys.availableAvatars(),
    queryFn: async (): Promise<Avatar[]> => {
      // Get all avatars
      const { data: allAvatars, error: avatarsError } = await supabase
        .from("avatars")
        .select("filename, display_name")
        .order("display_name");

      if (avatarsError) {
        throw new Error(`Failed to fetch avatars: ${avatarsError.message}`);
      }

      // Get avatars already in use (excluding current user)
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const { data: usedAvatars, error: usedError } = await supabase
        .from("users")
        .select("avatar")
        .not("avatar", "is", null)
        .neq("id", authUser?.id ?? ""); // Exclude current user's avatar

      if (usedError) {
        throw new Error(`Failed to fetch used avatars: ${usedError.message}`);
      }

      // Filter out avatars that are already taken
      // Only consider predefined avatars (not custom uploads) as "in use"
      const usedFilenames = new Set(
        ((usedAvatars ?? []) as UsedAvatarRow[])
          .map((u) => u.avatar)
          .filter((avatar) => !isCustomAvatar(avatar))
      );

      return ((allAvatars ?? []) as Avatar[]).filter(
        (avatar) => !usedFilenames.has(avatar.filename)
      );
    },
    staleTime: 1 * 60 * 1000, // 1 minute (shorter since availability changes)
  });
}
