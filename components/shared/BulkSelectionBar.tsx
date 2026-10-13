"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkSelectionAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Tailwind classes for the button colour. */
  className: string;
  disabled?: boolean;
}

interface BulkSelectionBarProps {
  count: number;
  actions: BulkSelectionAction[];
  onCancel: () => void;
  hint?: string;
}

/**
 * Floating bar shown while a list is in multi-select mode. It moves up when the push
 * notification banner (also bottom-centre) is showing, so neither covers the other.
 */
export function BulkSelectionBar({ count, actions, onCancel, hint }: BulkSelectionBarProps) {
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
        {actions.map(({ label, icon: Icon, onClick, className, disabled }) => (
          <Button
            key={label}
            onClick={onClick}
            disabled={disabled || count === 0}
            className={`text-white ${className}`}
          >
            <Icon className="w-4 h-4 mr-1.5" />
            {label}
          </Button>
        ))}
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
