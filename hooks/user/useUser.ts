"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import { queryKeys } from "@/lib/queryKeys";
import type { User } from '@/types/user';

export function useUser() {
  const supabase = useSupabase();

  const { data: user, isLoading: loading } = useQuery({
    queryKey: queryKeys.user(),
    queryFn: async (): Promise<(User & { email: string; theme_preference?: string | null }) | null> => {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        return null;
      }

      const { data: userProfile, error } = await supabase
        .from('users')
        .select('id, name, email, role, C_user, TE_user, short_name, avatar, custom_avatar, theme_preference')
        .eq('id', userData.user.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      // Get email from auth user (it's the source of truth)
      return {
        ...userProfile,
        email: userData.user.email || userProfile.email || '',
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if user is not authenticated
  });

  return { user, loading };
}
