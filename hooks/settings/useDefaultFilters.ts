"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFriendlyError } from "@/utils/toastHelpers";

interface DefaultFilter {
  id: number;
  filter_key: string;
  included_values: string[];
  excluded_values: string[];
  updated_at: string;
}

export function useDefaultFilters(userId: string | null) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const queryKey = queryKeys.defaultFilters(userId);

  const { data: filters = [], isLoading, isFetched } = useQuery({
    queryKey,
    queryFn: async (): Promise<DefaultFilter[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("default_filters")
        .select("*")
        .eq("user_id", userId);

      if (error) throw new Error(error.message);
      return (data || []) as DefaultFilter[];
    },
    enabled: !!userId,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      filterKey,
      includedValues,
      excludedValues,
    }: {
      filterKey: string;
      includedValues: string[] | null;
      excludedValues: string[] | null;
    }) => {
      if (!userId) throw new Error("User ID required");

      const payload = {
        filter_key: filterKey,
        user_id: userId,
        included_values: includedValues ?? [],
        excluded_values: excludedValues ?? [],
        updated_at: new Date().toISOString(),
      };

      // Current DB schema has UNIQUE(user_id), so upsert must conflict on user_id.
      const { error } = await supabase
        .from("default_filters")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        throw new Error(`Failed to save default filter: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Default filter saved");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error, "default filter save"));
    },
  });

  const getFilter = useCallback(
    (key: string): DefaultFilter | undefined => {
      return filters.find((f) => f.filter_key === key);
    },
    [filters]
  );

  return {
    filters,
    isLoading,
    isFetched,
    getFilter,
    upsertFilter: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
  };
}


