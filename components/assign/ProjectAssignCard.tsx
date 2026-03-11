"use client";

import { UserCircle, ChevronRight, ChevronDown } from "lucide-react";
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

interface ProjectAssignCardProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  selectedProjects: Set<number>;
  onToggleProject: (projectId: number) => void;
  onToggleGroupSelection: (groupKey: string) => void;
}

export function ProjectAssignCard({
  groups,
  expandedGroups,
  onToggleGroup,
  selectedProjects,
  onToggleProject,
  onToggleGroupSelection,
}: ProjectAssignCardProps) {
  const { getSystemColorPreview, getLanguageColorPreview } = useColorSettings();

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);
  const getLanguageColorStyleLocal = (langIn: string, langOut: string) =>
    getLanguageColorStyle(langIn, langOut, getLanguageColorPreview);

  const renderProjectCard = (project: ProjectWithTranslators) => {
    const isSelected = selectedProjects.has(project.id);

    return (
      <div
        key={project.id}
        className={`p-6 bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 cursor-pointer ${
          isSelected ?
            "border-blue-500 shadow-lg"
          : "border-gray-200 dark:border-gray-700 hover:shadow-lg"
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.tagName === "INPUT" &&
            target.getAttribute("type") === "checkbox"
          ) {
            return;
          }
          onToggleProject(project.id);
        }}
      >
        <div className="flex items-start gap-4 mb-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleProject(project.id)}
            onClick={(e) => e.stopPropagation()}
            className="outline-style w-4 h-4 mt-1 rounded cursor-pointer"
            aria-label={`Select project ${project.name}`}
          />
          <ProjectColorLegendTooltip
            status={project.status}
            system={project.system}
            langIn={project.language_in}
            langOut={project.language_out}
            className="shrink-0 mt-1"
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
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm mb-2">
              {project.system}
            </span>
          </div>
        </div>

        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white break-words line-clamp-2">
          {formatProjectName(project.name)}
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              Words
            </span>
            <span className="text-gray-900 dark:text-white text-sm">
              {project.words ? formatNumber(project.words) : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              Lines
            </span>
            <span className="text-gray-900 dark:text-white text-sm">
              {project.lines ? formatNumber(project.lines) : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
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
          <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">
            Translator(s)
          </span>
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
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm max-h-12 overflow-hidden text-ellipsis">
            {project.instructions || "-"}
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
                  onCheckedChange={() => onToggleGroupSelection(group.key)}
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



