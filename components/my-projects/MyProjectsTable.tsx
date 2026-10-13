"use client";

import { useRouter } from "next/navigation";
import { Check, Info, X } from "lucide-react";
import { formatNumber, formatProjectName } from "@/utils/formatters";
import { ProjectTableBase } from "@/components/shared/ProjectTableBase";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { LanguagePair } from "@/components/shared/LanguagePair";
import type { ProjectAssignment } from "@/types/project-assignment";
import type { ProjectSelection } from "@/hooks/project/useProjectSelection";
import { Checkbox } from "@/components/ui/checkbox";
import { MyProjectsActionsMenu } from "./MyProjectsActionsMenu";
import { TruncatedText } from "@/components/shared/TruncatedText";

interface MyProjectsTableProps {
  projects: ProjectAssignment[];
  activeTab: "unclaimed" | "inProgress";
  onClaim: (assignment: ProjectAssignment) => void;
  onReject: (projectId: number, projectName: string) => void;
  onDone: (projectId: number, projectName: string) => void;
  onSelectMultiple: (projectId: number) => void;
  /** Multi-select mode: items toggle (click or drag) instead of opening the project. */
  selection?: ProjectSelection;
}

export function MyProjectsTable({
  projects,
  activeTab,
  onClaim,
  onReject,
  onDone,
  onSelectMultiple,
  selection,
}: MyProjectsTableProps) {
  const router = useRouter();

  const isSelecting = !!selection?.isActive;
  const showBulkMenu = !isSelecting && projects.length > 1;

  const handleRowClick = (assignment: ProjectAssignment, e: React.MouseEvent) => {
    // Don't navigate if clicking on a button
    if (isSelecting || (e.target as HTMLElement).closest("button")) {
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
    ...(isSelecting ?
      [{
        header: "",
        className: "w-4",
        render: (assignment: ProjectAssignment) => {
          const project = assignment.projects;
          return (
            <Checkbox
              checked={selection.isSelected(project.id)}
              tabIndex={-1}
              className="pointer-events-none"
              aria-label={`Select ${project.name}`}
            />
          );
        },
      }]
    : []),
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
        <TruncatedText
          text={formatProjectName(assignment.projects.name)}
          copyValue={isSelecting ? undefined : assignment.projects.name}
          copyMessage="Project name copied"
          className="text-gray-900 dark:text-white max-w-[280px] min-w-[180px]"
        />
      ),
    },
    {
      header: "Languages",
      render: (assignment: ProjectAssignment) => (
        <LanguagePair
          languageIn={assignment.projects.language_in}
          languageOut={assignment.projects.language_out}
        />
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
      header: "Words",
      className: "text-right",
      render: (assignment: ProjectAssignment) => (
        <span className="text-gray-700 dark:text-gray-300">
          {assignment.projects.words ? formatNumber(assignment.projects.words) : "-"}
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
      className: "text-gray-500 dark:text-gray-400 text-xs md:text-sm max-w-xs",
      render: (assignment: ProjectAssignment) => (
        <TruncatedText text={assignment.projects.instructions || "-"} />
      ),
    },
    ...(activeTab === "inProgress" ?
      [
        {
          header: "Info from PM",
          className: "max-w-xs",
          render: (assignment: ProjectAssignment) =>
            assignment.initial_message ?
              <div className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap break-words line-clamp-3">
                  {assignment.initial_message}
                </span>
              </div>
            : <span className="text-gray-400 dark:text-gray-500">-</span>,
        },
      ]
    : []),
    {
      header: "Action",
      render: (assignment: ProjectAssignment) => {
        const project = assignment.projects;
        if (isSelecting) return null;
        const actions = activeTab === "unclaimed" ?
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
        return (
          <div className="flex items-center gap-1">
            {actions}
            {showBulkMenu && (
              <MyProjectsActionsMenu
                activeTab={activeTab}
                onSelectMultiple={() => onSelectMultiple(project.id)}
              />
            )}
          </div>
        );
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
      rowClassName={(assignment) =>
        `group ${isSelecting ? "select-none" : ""} ${
          isSelecting && selection.isSelected(assignment.projects.id) ?
            "bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/40"
          : ""
        }`
      }
      getRowProps={(assignment) =>
        isSelecting ? selection.getItemProps(assignment.projects.id) : {}
      }
      getRowKey={(assignment) => `${assignment.project_id}-${assignment.user_id}`}
      stickyHeader
    />
  );
}

