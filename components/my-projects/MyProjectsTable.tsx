"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { formatNumber, formatProjectName } from "@/utils/formatters";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { getSystemColorStyle, getLanguageColorStyle } from "@/utils/projectTableHelpers";
import { ProjectTableBase } from "@/components/shared/ProjectTableBase";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { ProjectColorLegendTooltip } from "@/components/shared/ProjectColorLegendTooltip";
import type { ProjectAssignment } from "@/types/project-assignment";

interface MyProjectsTableProps {
  projects: ProjectAssignment[];
  activeTab: "unclaimed" | "inProgress";
  onClaim: (assignment: ProjectAssignment) => void;
  onReject: (projectId: number, projectName: string) => void;
  onDone: (projectId: number, projectName: string) => void;
}

export function MyProjectsTable({
  projects,
  activeTab,
  onClaim,
  onReject,
  onDone,
}: MyProjectsTableProps) {
  const router = useRouter();
  const { getSystemColorPreview, getLanguageColorPreview } = useColorSettings();

  // Use shared utility functions for color styles
  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);
  const getLanguageColorStyleLocal = (langIn: string, langOut: string) =>
    getLanguageColorStyle(langIn, langOut, getLanguageColorPreview);

  const handleRowClick = (assignment: ProjectAssignment, e: React.MouseEvent) => {
    // Don't navigate if clicking on a button
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    router.push(`/project/${assignment.projects.id}`);
  };

  // Sort projects by due date (earliest first)
  const sortedProjects = [...projects].sort((a, b) => {
    const dateA =
      a.projects.final_deadline ||
      a.projects.interim_deadline ||
      a.projects.initial_deadline ||
      "";
    const dateB =
      b.projects.final_deadline ||
      b.projects.interim_deadline ||
      b.projects.initial_deadline ||
      "";
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const columns = [
    {
      header: "",
      className: "w-4",
      render: (assignment: ProjectAssignment) => {
        const project = assignment.projects;
        return (
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
        );
      },
    },
    {
      header: "System",
      render: (assignment: ProjectAssignment) => {
        const project = assignment.projects;
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm">
            {project.system}
          </span>
        );
      },
    },
    {
      header: "Project Name",
      render: (assignment: ProjectAssignment) => (
        <span className="text-gray-900 dark:text-white max-w-[280px] block break-words line-clamp-2">
          {formatProjectName(assignment.projects.name)}
        </span>
      ),
    },
    {
      header: "Words",
      className: "text-right",
      render: (assignment: ProjectAssignment) => (
        <span className="text-gray-700 dark:text-gray-300">
          {assignment.projects.words ? formatNumber(assignment.projects.words) : "-"}
        </span>
      ),
    },
    {
      header: "Lines",
      className: "text-right",
      render: (assignment: ProjectAssignment) => (
        <span className="text-gray-700 dark:text-gray-300">
          {assignment.projects.lines ? formatNumber(assignment.projects.lines) : "-"}
        </span>
      ),
    },
    {
      header: "Due Date",
      render: (assignment: ProjectAssignment) => {
        const project = assignment.projects;
        return (
          <DeadlineDisplay
            initialDeadline={project.initial_deadline}
            interimDeadline={project.interim_deadline}
            finalDeadline={project.final_deadline}
          />
        );
      },
    },
    {
      header: "Instructions",
      className: "text-gray-500 dark:text-gray-400 text-xs md:text-sm max-w-xs truncate",
      render: (assignment: ProjectAssignment) => (
        assignment.projects.instructions || "-"
      ),
    },
    {
      header: "Action",
      render: (assignment: ProjectAssignment) => {
        const project = assignment.projects;
        return activeTab === "unclaimed" ?
          <div className="flex gap-2 group-hover:scale-110 group-hover:opacity-100 opacity-90 transition-all duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClaim(assignment);
              }}
              className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all text-sm hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm group-hover:shadow-md"
              type="button"
            >
              <Check className="w-4 h-4" />
              Claim
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject(project.id, project.name);
              }}
              className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all text-sm hover:bg-red-500 dark:hover:bg-red-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm group-hover:shadow-md"
              type="button"
            >
              <X className="w-4 h-4" />
              Refuse
            </button>
          </div>
        : <button
            onClick={(e) => {
              e.stopPropagation();
              onDone(project.id, project.name);
            }}
            className="inline-flex cursor-pointer items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all text-sm hover:bg-green-500 dark:hover:bg-green-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm group-hover:scale-110 group-hover:opacity-100 opacity-90 group-hover:shadow-md duration-200"
            type="button"
          >
            <Check className="w-4 h-4" />
            Done
          </button>;
      },
    },
  ];

  return (
    <ProjectTableBase
      items={sortedProjects}
      columns={columns}
      emptyStateTitle="No projects found"
      onRowClick={handleRowClick}
      enablePagination={false}
      rowClassName="group"
      getRowKey={(assignment) => `${assignment.project_id}-${assignment.user_id}`}
    />
  );
}



