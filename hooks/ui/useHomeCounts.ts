"use client";

import { useQuery } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { useUser } from "@/hooks/user/useUser";
import { queryKeys } from "@/lib/queryKeys";

export function useHomeCounts() {
  const { user } = useUser();
  const supabase = useSupabase();

  // Count of user's projects (unclaimed + claimed)
  const { data: myProjectsCount = 0, isLoading: myProjectsLoading } = useQuery({
    queryKey: queryKeys.homeMyProjectsCount(user?.id),
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from("projects_assignment")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("assignment_status", ["unclaimed", "claimed"]);

      if (error) {
        throw new Error(`Failed to fetch my projects count: ${error.message}`);
      }

      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Count of projects that are not completed (for manage projects)
  const { data: manageProjectsCount = 0, isLoading: manageProjectsLoading } =
    useQuery({
      queryKey: queryKeys.homeManageProjectsCount(),
      queryFn: async () => {
        const { count, error } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .neq("status", "complete");

        if (error) {
          throw new Error(
            `Failed to fetch manage projects count: ${error.message}`
          );
        }

        return count || 0;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

  return {
    myProjectsCount,
    manageProjectsCount,
    loading: myProjectsLoading || manageProjectsLoading,
  };
}

