"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/management/ConfirmationDialog";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";

interface InstructionExclusionSettingsProps {
  userId: string | null;
}

export function InstructionExclusionSettings({
  userId,
}: InstructionExclusionSettingsProps) {
  const [newText, setNewText] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const {
    exclusions,
    isLoading,
    addExclusion,
    removeExclusion,
    isAdding,
    isRemoving,
  } = useInstructionExclusions(userId);

  const pendingDeleteExclusion = useMemo(
    () => exclusions.find((exclusion) => exclusion.id === pendingDeleteId) ?? null,
    [exclusions, pendingDeleteId]
  );

  const handleAdd = () => {
    if (!newText.trim() || isAdding) return;
    addExclusion(newText);
    setNewText("");
  };

  const handleRequestDelete = (id: number) => {
    if (isRemoving) return;
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId == null) return;
    removeExclusion(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const handleCancelDelete = () => {
    if (isRemoving) return;
    setPendingDeleteId(null);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left">
        <div className="mb-5">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="w-6 h-6" />
            Instruction Exclusions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Global list: matching SAP instructions are hidden in the UI, but still imported and stored.
          </p>
        </div>

        <div className="space-y-2 mb-5">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Paste SAP instruction text to hide in UI..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newText.trim() || isAdding}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Exclusion
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : exclusions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center italic">
            No exclusions configured yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {exclusions.map((exclusion) => (
              <div
                key={exclusion.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 group"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words min-w-0">
                  {exclusion.raw_text}
                </span>
                <button
                  onClick={() => handleRequestDelete(exclusion.id)}
                  disabled={isRemoving}
                  className="p-1 shrink-0 cursor-pointer text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 mt-0.5"
                  type="button"
                  aria-label="Remove exclusion"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) handleCancelDelete();
        }}
        title="Delete Exclusion"
        description={
          pendingDeleteExclusion ? (
            <>
              Are you sure you want to delete this exclusion?
              <span className="mt-2 block rounded-md bg-gray-100 dark:bg-gray-900 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                {pendingDeleteExclusion.raw_text}
              </span>
            </>
          ) : (
            "Are you sure you want to delete this exclusion?"
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isRemoving}
        variant="destructive"
      />
    </>
  );
}