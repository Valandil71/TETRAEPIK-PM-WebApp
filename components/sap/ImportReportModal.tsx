"use client";

import { FileText, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportReportData {
  id: number;
  created_at: string;
  report_type: "manual" | "cron";
  new_projects: Array<{
    id: number;
    name: string;
    system: string;
    language_in: string | null;
    language_out: string | null;
  }>;
  modified_projects: Array<{
    id: number;
    name: string;
    changes: Record<string, { old: unknown; new: unknown }>;
  }>;
  summary: string | null;
}

interface ImportReportModalProps {
  reports: ImportReportData[];
  onDismiss: () => void;
}

export function ImportReportModal({ reports, onDismiss }: ImportReportModalProps) {
  if (reports.length === 0) return null;

  // Merge all reports into flat deduplicated lists — last entry wins on duplicate id
  const allNew = Array.from(
    new Map(
      reports.flatMap(r => r.new_projects ?? []).map(p => [p.id, p])
    ).values()
  );

  const allModified = Array.from(
    new Map(
      reports.flatMap(r => r.modified_projects ?? []).map(p => [p.id, p])
    ).values()
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onDismiss}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-gray-900 dark:text-white font-semibold">
                Import Report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Since your last visit
              </p>
            </div>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-4 mb-4">
          {allNew.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Plus className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {allNew.length} new project{allNew.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {allModified.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {allModified.length} modified project{allModified.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Merged project lists */}
        <div className="overflow-y-auto flex-1 space-y-4">
          {allNew.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                New Projects
              </p>
              <div className="space-y-1">
                {allNew.map((p, index) => (
                  <div
                    key={`${p.id}-${index}`}
                    className="text-xs text-gray-700 dark:text-gray-300 pl-3 py-0.5"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 ml-1">
                      ({p.system}
                      {p.language_in && `, ${p.language_in}`}
                      {p.language_out && ` > ${p.language_out}`})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allModified.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                Modified Projects
              </p>
              <div className="space-y-1">
                {allModified.map((p, index) => (
                  <div
                    key={`${p.id}-${index}`}
                    className="text-xs pl-3 py-0.5"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {p.name}
                    </span>
                    <div className="text-gray-400 pl-2 mt-0.5">
                      {Object.entries(p.changes).map(([field, change]) => (
                        <div key={field}>
                          <span className="text-gray-500">{field}:</span>{" "}
                          <span className="text-red-400 line-through">
                            {String(change.old ?? "null")}
                          </span>{" "}
                          <span className="text-green-500">
                            {String(change.new ?? "null")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onDismiss}
            className="bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
