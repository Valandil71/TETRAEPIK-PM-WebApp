"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatConflictValue } from "@/utils/formatters";

export interface FieldConflict {
  field: string;
  label: string;
  originalValue: unknown;
  currentValue: unknown;
}

interface EditConflictModalProps {
  open: boolean;
  onContinueEditing: () => void;
  onDiscardChanges: () => void;
  conflicts: FieldConflict[];
}

/** Format a value for display in the conflict modal */
function formatValue(value: unknown): string {
  return formatConflictValue(value);
}

export function EditConflictModal({
  open,
  onContinueEditing,
  onDiscardChanges,
  conflicts,
}: EditConflictModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Project Updated</DialogTitle>
              <DialogDescription>
                Another user has made changes to this project
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Changes List */}
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The following fields have been changed:
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {conflicts.map((conflict) => (
              <div
                key={conflict.field}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {conflict.label}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Was: </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {formatValue(conflict.originalValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Now: </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {formatValue(conflict.currentValue)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6 flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={onDiscardChanges}
            className="flex-1"
          >
            Stop Editing
          </Button>
          <Button
            onClick={onContinueEditing}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            Continue Editing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
