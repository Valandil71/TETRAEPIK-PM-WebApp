"use client";

import { useState, useCallback } from "react";
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ConflictResult, FieldChange } from "@/types/concurrency";

interface UseConcurrencySafeMutationOptions<T> {
  /** The database table name */
  tableName: string;
  /** Maps field names to human-readable labels for the conflict modal */
  fieldLabels?: Record<string, string>;
  /** Column used for version comparison (defaults to 'updated_at') */
  versionField?: keyof T;
}

interface PendingMutation<T> {
  primaryKey: Record<string, unknown>;
  updates: Partial<T>;
  onSuccess?: () => void;
}

/**
 * Hook for executing mutations with optimistic locking.
 * Detects concurrent modifications by comparing version fields (default: updated_at).
 */
export function useConcurrencySafeMutation<T extends object>({
  tableName,
  fieldLabels = {},
  versionField = "updated_at" as keyof T,
}: UseConcurrencySafeMutationOptions<T>) {
  const supabase = useSupabase();
  const [conflictResult, setConflictResult] = useState<ConflictResult<T> | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check for conflicts before mutation by fetching current record
   * and comparing version fields.
   */
  const checkForConflicts = useCallback(
    async (
      primaryKey: Record<string, unknown>,
      originalRecord: T,
      updates: Partial<T>
    ): Promise<ConflictResult<T>> => {
      // Build the query with primary key conditions
      let query = supabase.from(tableName).select("*");
      Object.entries(primaryKey).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: currentRecord, error } = await query.single();

      if (error || !currentRecord) {
        throw new Error(`Failed to fetch current record: ${error?.message}`);
      }

      // Compare version fields
      const originalVersion = (originalRecord as Record<string, unknown>)[versionField as string];
      const currentVersion = currentRecord[versionField as string];

      if (originalVersion === currentVersion) {
        return {
          hasConflict: false,
          changes: [],
          originalRecord,
          currentRecord: currentRecord as T,
        };
      }

      // Detect which fields changed
      const changes: FieldChange[] = [];
      const fieldsToCheck = new Set([
        ...Object.keys(updates),
        ...Object.keys(currentRecord),
      ]);

      fieldsToCheck.forEach((field) => {
        if (field === versionField) return; // Skip version field

        const originalRecordObj = originalRecord as Record<string, unknown>;
        const original = originalRecordObj[field];
        const current = currentRecord[field];
        const yours = updates[field as keyof T] ?? original;

        // Only report if current differs from original AND it's a field user is trying to update
        if (original !== current && field in updates) {
          changes.push({
            field,
            label: fieldLabels[field] || field,
            originalValue: original,
            currentValue: current,
            yourValue: yours,
          });
        }
      });

      return {
        hasConflict: changes.length > 0,
        changes,
        originalRecord,
        currentRecord: currentRecord as T,
      };
    },
    [supabase, tableName, versionField, fieldLabels]
  );

  /**
   * Actually perform the database update.
   */
  const performUpdate = useCallback(
    async (
      primaryKey: Record<string, unknown>,
      updates: Partial<T>,
      onSuccess?: () => void
    ) => {
      let query = supabase.from(tableName).update(updates);
      Object.entries(primaryKey).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error } = await query;

      if (error) {
        throw new Error(`Update failed: ${error.message}`);
      }

      onSuccess?.();
      return { conflictDetected: false, result: null };
    },
    [supabase, tableName]
  );

  /**
   * Execute mutation with conflict check.
   * Returns { conflictDetected: true } if a conflict was found and modal should be shown.
   */
  const executeMutation = useCallback(
    async (
      primaryKey: Record<string, unknown>,
      originalRecord: T,
      updates: Partial<T>,
      onSuccess?: () => void
    ) => {
      setIsLoading(true);
      try {
        const result = await checkForConflicts(primaryKey, originalRecord, updates);

        if (result.hasConflict) {
          setConflictResult(result);
          setPendingMutation({ primaryKey, updates, onSuccess });
          return { conflictDetected: true, result };
        }

        // No conflict, proceed with mutation
        return await performUpdate(primaryKey, updates, onSuccess);
      } finally {
        setIsLoading(false);
      }
    },
    [checkForConflicts, performUpdate]
  );

  /**
   * User chose to force their changes despite conflict.
   */
  const forceUpdate = useCallback(async () => {
    if (!pendingMutation) return;

    setIsLoading(true);
    try {
      await performUpdate(
        pendingMutation.primaryKey,
        pendingMutation.updates,
        pendingMutation.onSuccess
      );
    } finally {
      setConflictResult(null);
      setPendingMutation(null);
      setIsLoading(false);
    }
  }, [pendingMutation, performUpdate]);

  /**
   * User chose to discard their changes.
   */
  const discardChanges = useCallback(() => {
    setConflictResult(null);
    setPendingMutation(null);
  }, []);

  return {
    /** Execute a mutation with conflict detection */
    executeMutation,
    /** Current conflict result (null if no conflict) */
    conflictResult,
    /** Force the update despite detected conflicts */
    forceUpdate,
    /** Discard changes and close the conflict modal */
    discardChanges,
    /** Whether the conflict modal should be open */
    isConflictModalOpen: conflictResult !== null,
    /** Whether a mutation is in progress */
    isLoading,
  };
}
