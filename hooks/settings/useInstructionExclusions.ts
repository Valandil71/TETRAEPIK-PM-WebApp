"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/hooks/core/useSupabase";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { normalizeInstructionTextForMatch } from "@/lib/sap/instruction-normalization";
import {
  type InstructionExclusionV2,
  toInstructionExclusionSet,
} from "@/lib/sap/instruction-exclusions";

interface UseInstructionExclusionsResult {
  exclusions: InstructionExclusionV2[];
  exclusionSet: Set<string>;
  isLoading: boolean;
  addExclusion: (rawText: string) => void;
  removeExclusion: (id: number) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

export function useInstructionExclusions(currentUserId: string | null): UseInstructionExclusionsResult {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.instructionExclusions();

  const { data: exclusions = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<InstructionExclusionV2[]> => {
      const { data, error } = await supabase
        .from("instruction_exclusions_v2")
        .select("id, created_at, created_by, raw_text, normalized_text, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as InstructionExclusionV2[];
    },
  });

  const exclusionSet = useMemo(() => toInstructionExclusionSet(exclusions), [exclusions]);

  const addMutation = useMutation({
    mutationFn: async (rawText: string): Promise<InstructionExclusionV2> => {
      if (!currentUserId) throw new Error("User ID required");

      const normalizedText = normalizeInstructionTextForMatch(rawText);
      if (!normalizedText) throw new Error("Please paste a valid instruction text");

      if (exclusionSet.has(normalizedText)) {
        throw new Error("duplicate_exclusion");
      }

      const { data, error } = await supabase
        .from("instruction_exclusions_v2")
        .insert({
          created_by: currentUserId,
          raw_text: rawText,
          normalized_text: normalizedText,
          is_active: true,
        })
        .select("id, created_at, created_by, raw_text, normalized_text, is_active")
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Failed to add exclusion");

      return data as InstructionExclusionV2;
    },
    onMutate: async (rawText: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousExclusions = queryClient.getQueryData<InstructionExclusionV2[]>(queryKey) || [];

      const optimisticRow: InstructionExclusionV2 = {
        id: -Date.now(),
        created_at: new Date().toISOString(),
        created_by: currentUserId ?? "",
        raw_text: rawText,
        normalized_text: normalizeInstructionTextForMatch(rawText),
        is_active: true,
      };

      queryClient.setQueryData<InstructionExclusionV2[]>(
        queryKey,
        [optimisticRow, ...previousExclusions]
      );

      return { previousExclusions, optimisticId: optimisticRow.id };
    },
    onSuccess: (createdRow, _rawText, context) => {
      queryClient.setQueryData<InstructionExclusionV2[]>(queryKey, (current = []) =>
        current.map((row) => (row.id === context?.optimisticId ? createdRow : row))
      );
      toast.success("Exclusion added");
    },
    onError: (error: Error, _rawText, context) => {
      if (context?.previousExclusions) {
        queryClient.setQueryData(queryKey, context.previousExclusions);
      }

      if (error.message.includes("duplicate") || error.message.includes("duplicate_exclusion")) {
        toast.error("This instruction is already excluded");
      } else {
        toast.error(error.message || "Failed to add exclusion");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase
        .from("instruction_exclusions_v2")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Exclusion was not deleted");
      }
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey });
      const previousExclusions = queryClient.getQueryData<InstructionExclusionV2[]>(queryKey) || [];

      queryClient.setQueryData<InstructionExclusionV2[]>(
        queryKey,
        previousExclusions.filter((row) => row.id !== id)
      );

      return { previousExclusions };
    },
    onSuccess: () => {
      toast.success("Exclusion removed");
    },
    onError: (error: Error, _id, context) => {
      if (context?.previousExclusions) {
        queryClient.setQueryData(queryKey, context.previousExclusions);
      }
      toast.error(error.message || "Failed to remove exclusion");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    exclusions,
    exclusionSet,
    isLoading,
    addExclusion: (rawText: string) => addMutation.mutate(rawText),
    removeExclusion: (id: number) => removeMutation.mutate(id),
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}