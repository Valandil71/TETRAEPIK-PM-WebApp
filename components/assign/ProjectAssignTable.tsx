"use client";

import { UserCircle, ChevronRight, ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { formatNumber, formatProjectName } from "@/utils/formatters";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { getSystemColorStyle, getLanguageColorStyle } from "@/utils/projectTableHelpers";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { ProjectColorLegendTooltip } from "@/components/shared/ProjectColorLegendTooltip";
import type { Project } from "@/types/project";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectGroup } from "@/lib/projectGrouping";
import {
  getGroupDisplayName,
  getGroupSelectionState,
} from "@/lib/projectGrouping";

interface ProjectWithTranslators extends Project {
  translators: Array<{
    id: string;
    name: string;
    role: string;
    assignment_status: string;
  }>;
}

interface ProjectAssignTableProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  selectedProjects: Set<number>;
  onToggleProject: (projectId: number) => void;
  onToggleGroupSelection: (groupKey: string) => void;
  onRowClick?: (projectId: number) => void;
}

export function ProjectAssignTable({
  groups,
  expandedGroups,
  onToggleGroup,
  selectedProjects,
  onToggleProject,
  onToggleGroupSelection,
  onRowClick,
}: ProjectAssignTableProps) {
  const { getSystemColorPreview, getLanguageColorPreview } = useColorSettings();

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);
  const getLanguageColorStyleLocal = (langIn: string, langOut: string) =>
    getLanguageColorStyle(langIn, langOut, getLanguageColorPreview);

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
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-right">Words</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-right">Lines</th>
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
                          onCheckedChange={() => onToggleGroupSelection(group.key)}
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
                        className={`border-b border-gray-200 dark:border-gray-700 transition-colors cursor-pointer ${
                          isGrouped ? "bg-blue-50/30 dark:bg-blue-900/5 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                          : "hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        }`}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (
                            target.closest("button") ||
                            target.closest('[role="checkbox"]') ||
                            (target.tagName === "INPUT" &&
                              target.getAttribute("type") === "checkbox")
                          ) {
                            return;
                          }
                          if (onRowClick) onRowClick(project.id);
                        }}
                      >
                        <td className={`px-6 py-4 relative ${isGrouped ? "pl-10" : ""}`}>
                          {isGrouped && (
                            <>
                              <div className="absolute left-3 top-0 bottom-0 w-px bg-blue-200/70 dark:bg-blue-800/50" />
                              <div className="absolute left-3 top-1/2 h-px w-3 bg-blue-200/70 dark:bg-blue-800/50" />
                            </>
                          )}
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project.id)}
                            onChange={() => onToggleProject(project.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="outline-style w-4 h-4 rounded cursor-pointer"
                            aria-label={`Select project ${project.name}`}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <ProjectColorLegendTooltip
                            status={project.status}
                            system={project.system}
                            langIn={project.language_in}
                            langOut={project.language_out}
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className="w-3 h-3 rounded"
                                style={getSystemColorStyleLocal(project.system)}
                              />
                              <div
                                className="w-3 h-1 mt-0.5"
                                style={getLanguageColorStyleLocal(
                                  project.language_in || "",
                                  project.language_out || ""
                                )}
                              />
                            </div>
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
                        <td className="px-6 py-4 text-right">
                          <span className="text-gray-700 dark:text-gray-300">
                            {project.words ? formatNumber(project.words) : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-gray-700 dark:text-gray-300">
                            {project.lines ? formatNumber(project.lines) : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {project.translators && project.translators.length > 0 ?
                            <div className="flex flex-wrap gap-2">
                              {project.translators.map((translator, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1 text-gray-700 dark:text-gray-300 text-xs md:text-sm"
                                >
                                  <UserCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <span>{translator.name}</span>
                                </div>
                              ))}
                            </div>
                          : <span className="text-gray-400 dark:text-gray-500 text-xs md:text-sm italic">
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
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs md:text-sm max-w-xs overflow-hidden text-ellipsis">
                          {project.instructions || "-"}
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



