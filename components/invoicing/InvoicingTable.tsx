"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { getSystemColorStyle } from "@/utils/projectTableHelpers";
import { formatProjectName } from "@/utils/formatters";
import { getInstructionsPreview } from "@/utils/instructionsPreview";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";
import type { ProjectWithTranslators } from "@/types/project";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { ProjectColorLegendTooltip } from "@/components/shared/ProjectColorLegendTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectGroup } from "@/lib/projectGrouping";
import {
  getGroupDisplayName,
  getGroupSelectionState,
} from "@/lib/projectGrouping";

interface InvoicingTableProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  selectedProjects: Set<number>;
  onRowClick: (id: number, e: React.MouseEvent) => void;
  onSelection: (projectId: number) => void;
  onGroupSelection: (groupKey: string) => void;
}

export function InvoicingTable({
  groups,
  expandedGroups,
  onToggleGroup,
  selectedProjects,
  onRowClick,
  onSelection,
  onGroupSelection,
}: InvoicingTableProps) {
  const { getSystemColorPreview } = useColorSettings();
  const { exclusionSet } = useInstructionExclusions(null);

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);

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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="px-6 py-4 w-4" />
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 w-12" />
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">System</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Project Name</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-center">Invoiced</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-center">Paid</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Collaborator(s)</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Due Date</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const isGrouped = group.projects.length > 1;
              const groupProjectIds = group.projects.map((project) => project.id);
              const groupSelectionState = getGroupSelectionState(
                groupProjectIds,
                selectedProjects
              );
              const isChecked = groupSelectionState === "checked";
              const isIndeterminate = groupSelectionState === "indeterminate";

              return (
                <Fragment key={group.key}>
                  {isGrouped && (
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-blue-50/60 dark:bg-blue-900/10">
                      <td className="px-6 py-3">
                        <Checkbox
                          checked={isIndeterminate ? "indeterminate" : isChecked}
                          onCheckedChange={() => onGroupSelection(group.key)}
                          aria-label={`Select all projects in ${group.name}`}
                        />
                      </td>
                      <td colSpan={8} className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => onToggleGroup(group.key)}
                          className="w-full text-left flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                            {isExpanded ?
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            : <ChevronRight className="w-4 h-4 text-gray-500" />}
                            <span className="font-semibold">
                              {formatProjectName(getGroupDisplayName(group.name))}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {group.projects.length} projects
                          </span>
                        </button>
                      </td>
                    </tr>
                  )}

                  {(isGrouped ? isExpanded : true) &&
                    group.projects.map((project) => (
                      <tr
                        key={project.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                        onClick={(e) => onRowClick(project.id, e)}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project.id)}
                            onChange={() => onSelection(project.id)}
                            className="outline-style w-4 h-4 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <ProjectColorLegendTooltip
                            status={project.status}
                            system={project.system}
                            langIn={project.language_in}
                            langOut={project.language_out}
                          >
                            <div
                              className="w-3 h-3 rounded"
                              style={getSystemColorStyleLocal(project.system)}
                            />
                          </ProjectColorLegendTooltip>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm">
                            {project.system}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-white max-w-[280px] block break-words line-clamp-2">
                            {formatProjectName(project.name)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm ${
                              project.invoiced ?
                                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {project.invoiced ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm ${
                              project.paid ?
                                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {project.paid ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {project.translators.length > 0 ?
                            <div className="flex flex-wrap gap-2">
                              {project.translators.map((translator) => (
                                <div
                                  key={translator.id}
                                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 text-xs"
                                >
                                  <ProfileAvatar
                                    name={translator.name}
                                    avatar={translator.avatar}
                                    size="xs"
                                    showEditButton={false}
                                  />
                                  <span>
                                    {translator.short_name || translator.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          : <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                              Not assigned
                            </span>
                          }
                        </td>
                        <td className="px-6 py-4">
                          <DeadlineDisplay
                            initialDeadline={project.initial_deadline}
                            interimDeadline={project.interim_deadline}
                            finalDeadline={project.final_deadline}
                          />
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm max-w-xs truncate">
                          {getInstructionsPreview({
                            instructions: project.instructions,
                            sapInstructions: project.sap_instructions,
                            exclusionSet,
                          }).displayText}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

