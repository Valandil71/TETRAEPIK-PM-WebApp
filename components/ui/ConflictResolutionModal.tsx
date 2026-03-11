"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ConflictResult, FieldChange } from "@/types/concurrency";
import { formatConflictValue } from "@/utils/formatters";

interface ConflictResolutionModalProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictResult: ConflictResult<T> | null;
  onKeepMyChanges: () => void;
  onDiscardAndReload: () => void;
  isLoading?: boolean;
  entityName?: string;
}

export function ConflictResolutionModal<T>({
  open,
  onOpenChange,
  conflictResult,
  onKeepMyChanges,
  onDiscardAndReload,
  isLoading = false,
  entityName = "record",
}: ConflictResolutionModalProps<T>) {
  if (!conflictResult) return null;

  const formatValue = (value: unknown) =>
    formatConflictValue(value, { emptyText: "(empty)", truncateAt: 0 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <DialogTitle>Conflicting Changes Detected</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            This {entityName} has been modified by another user since you loaded
            it. Review the changes below and choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        {/* Changes List */}
        <div className="space-y-4 my-4 max-h-64 overflow-y-auto">
          {conflictResult.changes.map((change, index) => (
            <FieldChangeRow
              key={index}
              change={change}
              formatValue={formatValue}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDiscardAndReload}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Discard & Reload
          </Button>
          <Button
            onClick={onKeepMyChanges}
            disabled={isLoading}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isLoading ? "Saving..." : "Keep My Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldChangeRow({
  change,
  formatValue,
}: {
  change: FieldChange;
  formatValue: (v: unknown) => string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="font-medium text-sm text-gray-900 dark:text-white mb-2">
        {change.label}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500 dark:text-gray-400 mb-1">Was</div>
          <div className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 break-words">
            {formatValue(change.originalValue)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400 mb-1">Now</div>
          <div className="text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded px-2 py-1 break-words">
            {formatValue(change.currentValue)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400 mb-1">Yours</div>
          <div className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded px-2 py-1 break-words">
            {formatValue(change.yourValue)}
          </div>
        </div>
      </div>
    </div>
  );
}
