"use client";

import { useRouter } from "next/navigation";
import { Check, Info, X } from "lucide-react";
import { formatNumber, formatProjectName } from "@/utils/formatters";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { LanguagePair } from "@/components/shared/LanguagePair";
import type { ProjectAssignment } from "@/types/project-assignment";
import type { ProjectSelection } from "@/hooks/project/useProjectSelection";
import { Checkbox } from "@/components/ui/checkbox";
import { MyProjectsActionsMenu } from "./MyProjectsActionsMenu";
import { TruncatedText } from "@/components/shared/TruncatedText";

interface MyProjectsCardProps {
  projects: ProjectAssignment[];
  activeTab: "unclaimed" | "inProgress";
  onClaim: (assignment: ProjectAssignment) => void;
  onReject: (projectId: number, projectName: string) => void;
  onDone: (projectId: number, projectName: string) => void;
  onSelectMultiple: (projectId: number) => void;
  /** Multi-select mode: items toggle (click or drag) instead of opening the project. */
  selection?: ProjectSelection;
}

export function MyProjectsCard({
  projects,
  activeTab,
  onClaim,
  onReject,
  onDone,
  onSelectMultiple,
  selection,
}: MyProjectsCardProps) {
  const router = useRouter();

  const isSelecting = !!selection?.isActive;
  const showBulkMenu = !isSelecting && projects.length > 1;

  const handleCardClick = (projectId: number, e: React.MouseEvent) => {
    // Don't navigate if clicking on a button
    if (isSelecting || (e.target as HTMLElement).closest("button")) {
      return;
    }
    router.push(`/project/${projectId}`);
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedProjects.map((assignment) => {
        const project = assignment.projects;
        const isSelected = isSelecting && selection.isSelected(project.id);

        return (
          <div
            key={`${assignment.project_id}-${assignment.user_id}`}
            className={`group rounded-2xl border p-4 cursor-pointer hover:shadow-lg dark:hover:shadow-blue-500/20 transition-all ${
              isSelected ?
                "bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-500"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:hover:border-blue-500/50"
            } ${isSelecting ? "select-none" : ""}`}
            onClick={(e) => handleCardClick(project.id, e)}
            {...(isSelecting ? selection.getItemProps(project.id) : {})}
          >
            <div className="flex items-center mb-4">
              {isSelecting && (
                <Checkbox
                  checked={isSelected}
                  tabIndex={-1}
                  className="pointer-events-none mr-3"
                  aria-label={`Select ${project.name}`}
                />
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs md:text-sm">
                {project.system}
              </span>
              <LanguagePair
                languageIn={project.language_in}
                languageOut={project.language_out}
                className="ml-2 text-xs md:text-sm"
              />
              {showBulkMenu && (
                <div className="ml-auto">
                  <MyProjectsActionsMenu
                    activeTab={activeTab}
                    onSelectMultiple={() => onSelectMultiple(project.id)}
                  />
                </div>
              )}
            </div>
            <h3 className="text-gray-900 dark:text-white text-lg font-bold mb-2">
              <TruncatedText
                text={formatProjectName(project.name)}
                copyValue={isSelecting ? undefined : project.name}
                copyMessage="Project name copied"
              />
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
              Lines: {project.lines ? formatNumber(project.lines) : "-"}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
              Words: {project.words ? formatNumber(project.words) : "-"}
            </p>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-1 flex items-center gap-1">
              <span>Due Date:</span>
              <DeadlineDisplay
                initialDeadline={project.initial_deadline}
                interimDeadline={project.interim_deadline}
                finalDeadline={project.final_deadline}
              />
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mb-4">
              <TruncatedText text={project.instructions || "-"} />
            </div>
            {activeTab === "inProgress" && assignment.initial_message && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex gap-2">
                <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 uppercase">
                    Info from PM
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-4">
                    {assignment.initial_message}
                  </p>
                </div>
              </div>
            )}
            {isSelecting ? null
            : activeTab === "unclaimed" ?
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
              </button>
            }
          </div>
        );
      })}
    </div>
  );
}

