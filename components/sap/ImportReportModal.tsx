"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight, FileText, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

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
  const [expandedReports, setExpandedReports] = useState<Set<number>>(new Set());

  if (reports.length === 0) return null;

  const toggleExpand = (id: number) => {
    setExpandedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalNew = reports.reduce((sum, r) => sum + (r.new_projects?.length || 0), 0);
  const totalModified = reports.reduce((sum, r) => sum + (r.modified_projects?.length || 0), 0);

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
                Import Report{reports.length > 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {reports.length} report{reports.length !== 1 ? "s" : ""} since
                your last visit
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            type="button"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="flex gap-4 mb-4">
          {totalNew > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Plus className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {totalNew} new project{totalNew !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {totalModified > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {totalModified} modified project{totalModified !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Reports list */}
        <div className="overflow-y-auto flex-1 space-y-3">
          {reports.map((report) => {
            const isExpanded = expandedReports.has(report.id);
            const newCount = report.new_projects?.length || 0;
            const modCount = report.modified_projects?.length || 0;

            return (
              <div
                key={report.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {/* Report header */}
                <button
                  onClick={() => toggleExpand(report.id)}
                  className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
                  type="button"
                >
                  <div className="flex items-center gap-2 text-left">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-sm text-gray-900 dark:text-white font-medium">
                        {report.report_type === "cron" ? "Scheduled sync" : "Manual import"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {newCount > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                        +{newCount}
                      </span>
                    )}
                    {modCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                        ~{modCount}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                    {report.summary && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {report.summary}
                      </p>
                    )}

                    {/* New projects */}
                    {report.new_projects?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          New Projects:
                        </p>
                        <div className="space-y-1">
                          {report.new_projects.map((p, index) => (
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

                    {/* Modified projects */}
                    {report.modified_projects?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                          Modified Projects:
                        </p>
                        <div className="space-y-1">
                          {report.modified_projects.map((p, index) => (
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
                )}
              </div>
            );
          })}
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
