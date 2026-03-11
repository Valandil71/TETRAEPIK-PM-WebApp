"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { getSystemColorStyle } from "@/utils/projectTableHelpers";
import { formatProjectName } from "@/utils/formatters";
import { getInstructionsPreview } from "@/utils/instructionsPreview";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";
import type { ProjectWithTranslators } from "@/types/project";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { ProjectColorLegendTooltip } from "@/components/shared/ProjectColorLegendTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectGroup } from "@/lib/projectGrouping";
import {
  getGroupDisplayName,
  getGroupSelectionState,
} from "@/lib/projectGrouping";

interface InvoicingCardProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  selectedProjects: Set<number>;
  onSelection: (projectId: number) => void;
  onGroupSelection: (groupKey: string) => void;
}

export function InvoicingCard({
  groups,
  expandedGroups,
  onToggleGroup,
  selectedProjects,
  onSelection,
  onGroupSelection,
}: InvoicingCardProps) {
  const { getSystemColorPreview } = useColorSettings();
  const { exclusionSet } = useInstructionExclusions(null);

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);

  const renderProjectCard = (project: ProjectWithTranslators) => {
    const isSelected = selectedProjects.has(project.id);
    return (
      <div
        key={project.id}
        className={`p-6 bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 cursor-pointer ${
          isSelected ?
            "border-blue-500 shadow-lg dark:shadow-blue-500/20"
          : "border-gray-200 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-blue-500/20 dark:hover:border-blue-500/50"
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.tagName === "INPUT" &&
            target.getAttribute("type") === "checkbox"
          ) {
            return;
          }
          onSelection(project.id);
        }}
      >
        <div className="flex items-start gap-4 mb-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelection(project.id)}
            className="outline-style w-4 h-4 mt-1 rounded cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
          <ProjectColorLegendTooltip
            status={project.status}
            system={project.system}
            langIn={project.language_in}
            langOut={project.language_out}
            className="shrink-0 mt-1"
          >
            <div
              className="w-3 h-3 rounded"
              style={getSystemColorStyleLocal(project.system)}
            />
          </ProjectColorLegendTooltip>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm mb-2">
              {project.system}
            </span>
          </div>
        </div>

        <h3 className="text-gray-900 dark:text-white mb-4 break-words line-clamp-2">
          {formatProjectName(project.name)}
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Invoiced
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm ${
                project.invoiced ?
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {project.invoiced ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Paid
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm ${
                project.paid ?
                  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {project.paid ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Due Date
            </span>
            <DeadlineDisplay
              initialDeadline={project.initial_deadline}
              interimDeadline={project.interim_deadline}
              finalDeadline={project.final_deadline}
            />
          </div>
        </div>

        <div className="mb-3">
          <span className="text-gray-500 dark:text-gray-400 text-sm block mb-1">
            Collaborator(s)
          </span>
          {project.translators.length > 0 ?
            <div className="text-gray-700 dark:text-gray-300 text-sm">
              {project.translators.map((t) => t.name).join(", ")}
            </div>
          : <span className="text-gray-400 dark:text-gray-500 text-sm italic">
              Not assigned
            </span>
          }
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">
            {getInstructionsPreview({
              instructions: project.instructions,
              sapInstructions: project.sap_instructions,
              exclusionSet,
            }).displayText}
          </p>
        </div>
      </div>
    );
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          No projects found
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      {groups.map((group) => {
        if (group.projects.length === 1) {
          return renderProjectCard(group.projects[0]);
        }

        const isExpanded = expandedGroups.has(group.key);
        const groupProjectIds = group.projects.map((project) => project.id);
        const groupSelectionState = getGroupSelectionState(
          groupProjectIds,
          selectedProjects
        );
        const isChecked = groupSelectionState === "checked";
        const isIndeterminate = groupSelectionState === "indeterminate";

        return (
          <div
            key={group.key}
            className="md:col-span-2 lg:col-span-3 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Checkbox
                  checked={isIndeterminate ? "indeterminate" : isChecked}
                  onCheckedChange={() => onGroupSelection(group.key)}
                  aria-label={`Select all projects in ${group.name}`}
                />
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.key)}
                  className="flex items-center gap-2 cursor-pointer min-w-0"
                >
                  {isExpanded ?
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                  <span className="font-semibold text-gray-900 dark:text-white truncate">
                    {formatProjectName(getGroupDisplayName(group.name))}
                  </span>
                </button>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {group.projects.length} projects
              </span>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.projects.map(renderProjectCard)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

