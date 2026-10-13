"use client";

import type { LucideIcon } from "lucide-react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkSelectionAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** Tailwind classes for the button colour. */
  className: string;
  /** Hidden (not just disabled) when the action does not apply to the current selection. */
  hidden?: boolean;
  /** Shows a spinner and "Processing..." while the action runs. */
  isLoading?: boolean;
}

interface BulkSelectionBarProps {
  count: number;
  actions: BulkSelectionAction[];
  onCancel: () => void;
  /** Label of the button that leaves/clears the selection. */
  cancelLabel?: string;
  hint?: string;
}

/**
 * Floating bar shown while projects are selected (Manage Projects, My Projects, Invoicing).
 * It moves up when the push-notification banner (also bottom-centre) is showing, so neither
 * covers the other (see globals.css).
 */
export function BulkSelectionBar({
  count,
  actions,
  onCancel,
  cancelLabel = "Cancel",
  hint,
}: BulkSelectionBarProps) {
  return (
    <div
      data-bulk-selection-bar
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-3 shadow-2xl"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
          {count} project{count !== 1 ? "s" : ""} selected
        </span>
        {hint && (
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{hint}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Only the actions that can be taken now; nothing applies to an empty selection */}
        {(count === 0 ? [] : actions.filter((action) => !action.hidden)).map(
          ({ label, icon: Icon, onClick, className, isLoading }) => (
          <Button
            key={label}
            onClick={onClick}
            disabled={isLoading}
            className={`text-white ${className}`}
          >
            {isLoading ?
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            : Icon && <Icon className="w-4 h-4 mr-1.5" />}
            {isLoading ? "Processing..." : label}
          </Button>
          )
        )}
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1.5" />
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
