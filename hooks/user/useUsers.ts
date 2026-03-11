"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { User } from '@/types/user';
import { queryKeys } from "@/lib/queryKeys";

export function useUsers() {
  const supabase = useSupabase();

  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: async (): Promise<User[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, C_user, TE_user, short_name, avatar, words_per_hour, lines_per_hour')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
