"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { SapProject, SapSubProject } from "@/hooks/sap/useSapProjects";

export interface SapSubProjectSelection {
  projectId: number;
  subProjectId: string;
  subProjectName: string;
  parentName: string;
  isNew: boolean;
  isUpdated: boolean;
}

interface SapProjectListProps {
  projects: SapProject[];
  existingSubProjectIds: Set<string>;
  selectedSubProjects: SapSubProjectSelection[];
  onSelectionChange: (selections: SapSubProjectSelection[]) => void;
  onImportProject: (projectId: number) => void;
}

/**
 * Hierarchical list of SAP projects and subprojects with selection capability
 */
export function SapProjectList({
  projects,
  existingSubProjectIds,
  selectedSubProjects,
  onSelectionChange,
  onImportProject,
}: SapProjectListProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(
    new Set()
  );

  const toggleProject = (projectId: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const isSubProjectSelected = (
    projectId: number,
    subProjectId: string
  ): boolean => {
    return selectedSubProjects.some(
      (s) => s.projectId === projectId && s.subProjectId === subProjectId
    );
  };

  const toggleSubProject = (
    project: SapProject,
    subProject: SapSubProject,
    isNew: boolean,
    isUpdated: boolean
  ) => {
    const selection: SapSubProjectSelection = {
      projectId: project.projectId,
      subProjectId: subProject.subProjectId,
      subProjectName: subProject.subProjectName,
      parentName: project.projectName,
      isNew,
      isUpdated,
    };

    if (isSubProjectSelected(project.projectId, subProject.subProjectId)) {
      onSelectionChange(
        selectedSubProjects.filter(
          (s) =>
            !(
              s.projectId === project.projectId &&
              s.subProjectId === subProject.subProjectId
            )
        )
      );
    } else {
      onSelectionChange([...selectedSubProjects, selection]);
    }
  };

  const selectAllFromProject = (project: SapProject) => {
    const projectSelections: SapSubProjectSelection[] = project.subProjects.map(
      (subProject) => ({
        projectId: project.projectId,
        subProjectId: subProject.subProjectId,
        subProjectName: subProject.subProjectName,
        parentName: project.projectName,
        isNew: !existingSubProjectIds.has(subProject.subProjectId),
        isUpdated: existingSubProjectIds.has(subProject.subProjectId),
      })
    );

    // Remove existing selections from this project and add all new ones
    const otherSelections = selectedSubProjects.filter(
      (s) => s.projectId !== project.projectId
    );
    onSelectionChange([...otherSelections, ...projectSelections]);
  };

  const getSubProjectStatus = (
    subProjectId: string
  ): { label: string; className: string } => {
    if (existingSubProjectIds.has(subProjectId)) {
      return {
        label: "SYNCED",
        className:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      };
    }
    return {
      label: "NEW",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No SAP projects found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.projectId);
        const selectedCount = selectedSubProjects.filter(
          (s) => s.projectId === project.projectId
        ).length;

        return (
          <div
            key={project.projectId}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Project Header */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750">
              <button
                type="button"
                onClick={() => toggleProject(project.projectId)}
                className="flex items-center gap-3 flex-1 cursor-pointer text-left"
              >
                {isExpanded ?
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {project.projectName}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                    ({project.subProjects.length} subprojects)
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedCount} selected
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllFromProject(project);
                  }}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImportProject(project.projectId);
                  }}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Import All
                </Button>
              </div>
            </div>

            {/* SubProjects List */}
            {isExpanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {project.subProjects.map((subProject) => {
                  const status = getSubProjectStatus(subProject.subProjectId);
                  const isNew = !existingSubProjectIds.has(
                    subProject.subProjectId
                  );
                  const isChecked = isSubProjectSelected(
                    project.projectId,
                    subProject.subProjectId
                  );

                  return (
                    <div
                      key={subProject.subProjectId}
                      className="flex items-center gap-3 p-3 pl-12 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() =>
                          toggleSubProject(project, subProject, isNew, !isNew)
                        }
                        className="cursor-pointer"
                      />
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white truncate">
                            {subProject.subProjectName}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          <span>DM: {subProject.dmName || "N/A"}</span>
                          <span className="mx-2">|</span>
                          <span>PM: {subProject.pmName || "N/A"}</span>
                          <span className="mx-2">|</span>
                          <span>Type: {subProject.projectType || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
