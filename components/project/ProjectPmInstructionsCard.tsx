"use client";

import { ClipboardList } from "lucide-react";

interface ProjectPmInstructionsCardProps {
  instructions: string;
}

/** Instructions written by a PM in "Edit project" (not the text composed by the SAP import). */
export function ProjectPmInstructionsCard({ instructions }: ProjectPmInstructionsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-gray-900 dark:text-white text-xl font-semibold">
          Instructions
        </h2>
      </div>
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line text-sm break-words">
        {instructions}
      </p>
    </div>
  );
}
