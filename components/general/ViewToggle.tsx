"use client";

import { LayoutList, LayoutGrid } from "lucide-react";

type ViewMode = "table" | "card";

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => onViewChange("table")}
        className={`inline-flex cursor-pointer items-center justify-center w-8 h-8 rounded-full text-xs transition-colors ${
          view === "table" ?
            "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        }`}
        title="Table view"
      >
        <LayoutList className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("card")}
        className={`inline-flex cursor-pointer items-center justify-center w-8 h-8 rounded-full text-xs transition-colors ${
          view === "card" ?
            "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        }`}
        title="Card view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}
