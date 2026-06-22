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
import type { ProjectGroup } from "@/lib/projectGrouping";
import { getGroupDisplayName } from "@/lib/projectGrouping";

interface ConcludedTableProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  onRowClick: (id: number, e: React.MouseEvent) => void;
  /** Pixel offset for the sticky header so it pins below the page filter bar. */
  headerOffset?: number;
}

// Read-only table of completed projects. No selection or row actions — this is an
// archive view. The sticky <thead> pins below the page filter bar (see Part B).
export function ConcludedTable({
  groups,
  expandedGroups,
  onToggleGroup,
  onRowClick,
  headerOffset = 0,
}: ConcludedTableProps) {
  const { getSystemColorPreview } = useColorSettings();
  const { exclusionSet } = useInstructionExclusions(null);

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          No concluded projects found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-clip mb-6">
      <div>
        <table className="w-full text-sm">
          <thead className="sticky z-20" style={{ top: headerOffset }}>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 w-12 bg-gray-50 dark:bg-gray-900" />
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                System
              </th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                Project Name
              </th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                Languages
              </th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                Collaborator(s)
              </th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                Due Date
              </th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                Instructions
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const isGrouped = group.projects.length > 1;

              return (
                <Fragment key={group.key}>
                  {isGrouped && (
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-blue-50/60 dark:bg-blue-900/10">
                      <td colSpan={7} className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => onToggleGroup(group.key)}
                          className="w-full text-left flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
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
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                          {project.language_in} → {project.language_out}
                        </td>
                        <td className="px-6 py-4">
                          {project.translators.length > 0 ? (
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
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                              Not assigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <DeadlineDisplay
                            initialDeadline={project.initial_deadline}
                            interimDeadline={project.interim_deadline}
                            finalDeadline={project.final_deadline}
                          />
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm max-w-xs truncate">
                          {
                            getInstructionsPreview({
                              instructions: project.instructions,
                              sapInstructions: project.sap_instructions,
                              exclusionSet,
                            }).displayText
                          }
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
