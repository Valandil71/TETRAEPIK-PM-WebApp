"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import { queryKeys } from "@/lib/queryKeys";
import type { User } from '@/types/user';

export function useUser() {
  const supabase = useSupabase();

  const { data: user, isLoading: loading } = useQuery({
    queryKey: queryKeys.user(),
    queryFn: async (): Promise<User | null> => {
      // The session is read locally (no round trip to the auth server, which getUser makes).
      // It is still trusted: the proxy checks it, and the database validates the JWT on every
      // query, so a tampered session cannot read a profile it should not.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authUser = session?.user;

      if (!authUser) {
        return null;
      }

      const { data: userProfile, error } = await supabase
        .from('users')
        .select('id, name, email, role, C_user, TE_user, short_name, avatar, custom_avatar, theme_preference, expansion_mode')
        .eq('id', authUser.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      // Get email from auth user (it's the source of truth)
      return {
        ...userProfile,
        email: authUser.email || userProfile.email || '',
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if user is not authenticated
  });

  return { user, loading };
}
