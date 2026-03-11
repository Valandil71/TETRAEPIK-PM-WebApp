"use client";

import { useState } from "react";
import { Filter, Check, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDefaultFilters } from "@/hooks/settings/useDefaultFilters";

interface DefaultFilterSettingsProps {
  userId: string | null;
  availableProjectTypes: string[];
}

export function DefaultFilterSettings({
  userId,
  availableProjectTypes,
}: DefaultFilterSettingsProps) {
  const { getFilter, upsertFilter, isFetched, isLoading, isUpdating } =
    useDefaultFilters(userId);

  // null = no local edits yet (show DB value); string[] = user is editing
  const [draft, setDraft] = useState<string[] | null>(null);

  // The saved value from DB
  const savedTypes = isFetched ? (getFilter("project_type")?.included_values ?? []) : [];

  // What the UI shows: draft if editing, otherwise the DB value
  const selectedTypes = draft ?? savedTypes;

  const isDirty =
    draft !== null &&
    JSON.stringify([...draft].sort()) !== JSON.stringify([...savedTypes].sort());

  const handleToggle = (type: string) => {
    setDraft((prev) => {
      const current = prev ?? savedTypes;
      return current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
    });
  };

  const handleClearAll = () => setDraft([]);

  const handleSave = () => {
    upsertFilter({
      filterKey: "project_type",
      includedValues: selectedTypes,
      excludedValues: [],
    });
    setDraft(null); // reset draft; UI will read fresh DB value
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left">
      {/* Header — matches ThemeSettings style */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Filter className="w-6 h-6" />
          Default Project Type Filter
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which project types are shown by default on the project pages.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : availableProjectTypes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
          No project types found. Add a project with a project type first.
        </div>
      ) : (
        <>
          {/* Current state label */}
          <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {selectedTypes.length === 0 ? (
              <span className="italic">
                No filter set — all project types will be shown by default.
              </span>
            ) : (
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedTypes.length}
                </span>{" "}
                of {availableProjectTypes.length} type
                {availableProjectTypes.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>

          {/* Type toggle buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            {availableProjectTypes.map((type) => {
              const selected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => handleToggle(type)}
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                    selected
                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm"
                      : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {selected ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {type}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={selectedTypes.length === 0}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear selection
            </button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating || !isDirty}
              className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {isDirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
