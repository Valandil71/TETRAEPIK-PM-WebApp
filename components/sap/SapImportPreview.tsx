"use client";

import { Loader2, FileText, CheckCircle2, RefreshCw } from "lucide-react";
import { useSapSubProjectDetails } from "@/hooks/sap/useSapSubProjectDetails";
import type { SapSubProjectSelection } from "./SapProjectList";

interface SapImportPreviewProps {
  selection: SapSubProjectSelection | null;
}

/**
 * Preview panel showing detailed information about a selected SAP subproject
 */
export function SapImportPreview({ selection }: SapImportPreviewProps) {
  const { data: details, isLoading, error } = useSapSubProjectDetails(
    selection?.projectId ?? null,
    selection?.subProjectId ?? null
  );

  if (!selection) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p>Select a subproject to preview</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Loading details...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p>Failed to load subproject details</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            selection.isNew
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-blue-100 dark:bg-blue-900/30"
          }`}
        >
          {selection.isNew ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {selection.subProjectName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            From: {selection.parentName}
          </p>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            selection.isNew
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {selection.isNew ? "New Project" : "Will Update Existing"}
        </span>
      </div>

      {/* Details */}
      {details && (
        <>
          {/* Extracted Fields */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {details.terminologyKey && details.terminologyKey.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  Terminology Keys
                </span>
                <p className="text-gray-900 dark:text-white">
                  {details.terminologyKey.join(", ")}
                </p>
              </div>
            )}
            {details.dmName && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  SAP PM
                </span>
                <p className="text-gray-900 dark:text-white">
                  {details.dmName}
                </p>
              </div>
            )}
          </div>

          {/* Volume Summary */}
          {details.subProjectSteps && details.subProjectSteps.length > 0 && (() => {
            let totalWords = 0;
            let totalLines = 0;
            let totalHours = 0;
            details.subProjectSteps.forEach((step) => {
              step.volume?.forEach((v) => {
                if (v.volumeUnit === "Words") totalWords += v.volumeQuantity;
                if (v.volumeUnit === "Lines") totalLines += v.volumeQuantity;
                if (v.volumeUnit === "Hours") totalHours += v.volumeQuantity;
              });
            });
            const hasVolume = totalWords > 0 || totalLines > 0 || totalHours > 0;
            if (!hasVolume) return null;
            return (
              <div className="flex flex-wrap gap-3 text-sm">
                {totalWords > 0 && (
                  <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Words: </span>
                    <span className="text-gray-900 dark:text-white font-medium">{totalWords.toLocaleString("de-DE")}</span>
                  </div>
                )}
                {totalLines > 0 && (
                  <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Lines: </span>
                    <span className="text-gray-900 dark:text-white font-medium">{totalLines.toLocaleString("de-DE")}</span>
                  </div>
                )}
                {totalHours > 0 && (
                  <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Hours: </span>
                    <span className="text-gray-900 dark:text-white font-medium">{totalHours}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Steps Summary */}
          {details.subProjectSteps && details.subProjectSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Steps ({details.subProjectSteps.length})
              </h4>
              <div className="space-y-2">
                {details.subProjectSteps.slice(0, 3).map((step, index) => (
                  <div
                    key={step.contentId || index}
                    className="text-sm bg-gray-50 dark:bg-gray-800 rounded p-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-gray-900 dark:text-white">
                        {step.stepText || step.serviceStep}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {step.sourceLang} → {step.slsLang}
                      {step.startDate && (
                        <span className="ml-2">
                          Due: {new Date(step.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {details.subProjectSteps.length > 3 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    +{details.subProjectSteps.length - 3} more steps...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Instructions Preview */}
          {details.instructions && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructions
              </h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded p-3 max-h-32 overflow-y-auto whitespace-pre-line">
                {details.instructions.length > 200
                  ? `${details.instructions.substring(0, 200)}...`
                  : details.instructions}
              </div>
            </div>
          )}

          {/* Environment */}
          {details.environment && details.environment.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Environment
              </h4>
              <div className="flex flex-wrap gap-2">
                {details.environment.map((env) => (
                  <span
                    key={env.environmentId}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {env.environmentName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
