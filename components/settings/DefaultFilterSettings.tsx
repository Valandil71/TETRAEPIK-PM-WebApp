"use client";

import { Filter } from "lucide-react";
import { useDefaultFilters } from "@/hooks/settings/useDefaultFilters";
import { ProjectTypePicker } from "@/components/settings/ProjectTypePicker";

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

      <ProjectTypePicker
        availableProjectTypes={availableProjectTypes}
        savedTypes={getFilter("project_type")?.included_values ?? []}
        isFetched={isFetched}
        isLoading={isLoading}
        isUpdating={isUpdating}
        onSave={(types) =>
          upsertFilter({
            filterKey: "project_type",
            includedValues: types,
            excludedValues: [],
          })
        }
        emptySelectionText="No filter set — all project types will be shown by default."
      />
    </div>
  );
}
