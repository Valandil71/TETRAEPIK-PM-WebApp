"use client";

import { useState, useMemo } from "react";
import { X, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber, formatRoleDisplay } from "@/utils/formatters";
import { useUsers } from "@/hooks/user/useUsers";
import { useUserWorkload } from "@/hooks/user/useUserWorkload";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectWithTranslators extends Project {
  translators: Array<{
    id: string;
    name: string;
    role: string;
    assignment_status: string;
  }>;
}

// Per-project assignment data
export interface ProjectAssignmentData {
  translatorIds: Set<string>;
  messages: Record<string, string>;
}

interface TranslatorSelectionViewProps {
  selectedProjects: ProjectWithTranslators[];
  onCancel: () => void;
  onAssign: (assignments: Map<number, ProjectAssignmentData>) => void;
}

export function TranslatorSelectionView({
  selectedProjects,
  onCancel,
  onAssign,
}: TranslatorSelectionViewProps) {
  const { data: users = [], isLoading } = useUsers();
  const { workloads, isLoading: workloadsLoading } = useUserWorkload();
  const collapsed = useLayoutStore((state) => state.collapsed);
  
  // Track current project index for sequential selection
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0);
  
  // Store selections per project: Map<projectId, { translatorIds, messages }>
  const [projectAssignments, setProjectAssignments] = useState<Map<number, ProjectAssignmentData>>(
    () => new Map()
  );

  // Clamp currentProjectIndex to valid range if selectedProjects changed
  const safeIndex = Math.min(currentProjectIndex, Math.max(0, selectedProjects.length - 1));
  const currentProject = selectedProjects[safeIndex];
  const isLastProject = safeIndex === selectedProjects.length - 1;
  const isFirstProject = safeIndex === 0;

  // Get current project's selection state
  const currentAssignment = projectAssignments.get(currentProject?.id) || {
    translatorIds: new Set<string>(),
    messages: {} as Record<string, string>,
  };

  const handleTranslatorToggle = (userId: string) => {
    const newTranslatorIds = new Set(currentAssignment.translatorIds);
    const newMessages = { ...currentAssignment.messages };
    
    if (newTranslatorIds.has(userId)) {
      newTranslatorIds.delete(userId);
      delete newMessages[userId];
    } else {
      newTranslatorIds.add(userId);
    }
    
    setProjectAssignments((prev) => {
      const updated = new Map(prev);
      updated.set(currentProject.id, {
        translatorIds: newTranslatorIds,
        messages: newMessages,
      });
      return updated;
    });
  };

  const handleMessageChange = (userId: string, message: string) => {
    setProjectAssignments((prev) => {
      const updated = new Map(prev);
      const current = updated.get(currentProject.id) || {
        translatorIds: new Set<string>(),
        messages: {},
      };
      updated.set(currentProject.id, {
        ...current,
        messages: { ...current.messages, [userId]: message },
      });
      return updated;
    });
  };

  const handleNextProject = () => {
    if (!isLastProject) {
      setCurrentProjectIndex((prev) => prev + 1);
    }
  };

  const handlePreviousProject = () => {
    if (!isFirstProject) {
      setCurrentProjectIndex((prev) => prev - 1);
    }
  };

  const handleAssignAll = () => {
    onAssign(projectAssignments);
  };

  // Get user IDs that are already assigned to the current project
  const assignedUserIds = useMemo(() => {
    const assignedIds = new Set<string>();
    if (currentProject?.translators) {
      currentProject.translators.forEach((translator) => {
        assignedIds.add(translator.id);
      });
    }
    return assignedIds;
  }, [currentProject]);

  // Filter out users who are already assigned to the current project
  const availableUsers = useMemo(() => {
    return users.filter((user) => !assignedUserIds.has(user.id));
  }, [users, assignedUserIds]);

  // Count total translators assigned across all projects
  const totalAssignments = useMemo(() => {
    let count = 0;
    projectAssignments.forEach((assignment) => {
      count += assignment.translatorIds.size;
    });
    return count;
  }, [projectAssignments]);

  // Count unique translators across all projects
  const totalUniqueTranslators = useMemo(() => {
    const uniqueIds = new Set<string>();
    projectAssignments.forEach((assignment) => {
      assignment.translatorIds.forEach((id) => uniqueIds.add(id));
    });
    return uniqueIds.size;
  }, [projectAssignments]);

  // Count projects that have at least one translator assigned
  const projectsWithAssignments = useMemo(() => {
    let count = 0;
    projectAssignments.forEach((assignment) => {
      if (assignment.translatorIds.size > 0) {
        count++;
      }
    });
    return count;
  }, [projectAssignments]);

  // Handle case where selectedProjects became empty (e.g., due to realtime update)
  // This check MUST be after all hooks to avoid "Rendered fewer hooks" error
  if (!currentProject || selectedProjects.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Projects Updated
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            The selected projects have been modified by another user.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go Back to Selection
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || workloadsLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Loading translators...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header with progress */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">
            Assign to Collaborator
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Project {currentProjectIndex + 1} of {selectedProjects.length}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors flex items-center gap-2 border border-gray-200 dark:border-gray-700"
          type="button"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>
      </div>

      {/* Progress Bar */}
      {selectedProjects.length > 1 && (
        <div className="mb-6">
          <div className="flex gap-2">
            {selectedProjects.map((project, index) => {
              const hasAssignment = projectAssignments.get(project.id)?.translatorIds.size ?? 0 > 0;
              const isCurrent = index === currentProjectIndex;
              return (
                <button
                  key={project.id}
                  onClick={() => setCurrentProjectIndex(index)}
                  className={`flex-1 h-2 rounded-full transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-blue-500"
                      : hasAssignment
                        ? "bg-green-500"
                        : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  title={`${project.system} - ${project.name}`}
                  type="button"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Current Project Info */}
      <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-blue-900 dark:text-blue-200 mb-1 text-lg font-medium">
              {currentProject.system} - {currentProject.name}
            </h3>
            <div className="flex items-center gap-4 text-blue-700 dark:text-blue-400 text-sm">
              <span>
                {currentProject.words ? formatNumber(currentProject.words) : "0"} words
              </span>
              <span className="flex items-center gap-1">
                Due:
                <DeadlineDisplay
                  initialDeadline={currentProject.initial_deadline}
                  interimDeadline={currentProject.interim_deadline}
                  finalDeadline={currentProject.final_deadline}
                />
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {currentAssignment.translatorIds.size} collaborator{currentAssignment.translatorIds.size !== 1 ? "s" : ""} selected
            </span>
          </div>
        </div>
      </div>

      {/* Translator Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {availableUsers.map((user: User) => {
          const isSelected = currentAssignment.translatorIds.has(user.id);
          const userWorkload = workloads.get(user.id);

          return (
            <div
              key={user.id}
              className={`p-6 bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isSelected ?
                  "border-blue-500 shadow-lg"
                : "border-gray-200 dark:border-gray-700 hover:shadow-lg"
              }`}
              onClick={(e) => {
                // Don't handle clicks on buttons, textarea, or label
                if (
                  (e.target as HTMLElement).closest("button") ||
                  (e.target as HTMLElement).closest("textarea") ||
                  (e.target as HTMLElement).closest("label")
                ) {
                  return;
                }
                // If clicking directly on the checkbox, let the checkbox's onChange handle it
                const target = e.target as HTMLElement;
                if (
                  target.tagName === "INPUT" &&
                  target.getAttribute("type") === "checkbox"
                ) {
                  return;
                }
                handleTranslatorToggle(user.id);
              }}
            >
              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleTranslatorToggle(user.id)}
                  className="outline-style w-5 h-5 mt-1 rounded cursor-pointer"
                />
                <div className="flex flex-col items-center text-center flex-1">
                  <div className="mb-3">
                    <ProfileAvatar
                      name={user.name}
                      avatar={user.avatar}
                      size="md"
                      showEditButton={false}
                    />
                  </div>
                  <h3 className="text-gray-900 dark:text-white mb-1">
                    {user.name}
                    {user.short_name && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        {" "}
                        ({user.short_name})
                      </span>
                    )}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {formatRoleDisplay(user.role)}
                  </p>
                </div>
              </div>

              {/* Workload Info */}
              {userWorkload && (userWorkload.totalWords > 0 || userWorkload.totalLines > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                  {/* Next Week Workload */}
                  <span className="text-xs text-gray-500 dark:text-gray-400">Predicted workload:</span>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">Next week: {userWorkload.nextWeekEstimatedHours}h</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {userWorkload.nextWeekIsFeasible ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {userWorkload.nextWeekIsFeasible
                                ? "Should be able to handle workload"
                                : "Workload may be challenging"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-500 pl-5">
                      {userWorkload.nextWeekWords.toLocaleString()} words • {userWorkload.nextWeekLines.toLocaleString()} lines
                    </div>
                  </div>

                  {/* Total Workload */}
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Total: {userWorkload.estimatedHours}h</span>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {userWorkload.isFeasible ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {userWorkload.isFeasible
                                ? "Appears to have availability"
                                : "Workload appears high"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-500 pl-5">
                      {userWorkload.totalWords.toLocaleString()} words • {userWorkload.totalLines.toLocaleString()} lines
                    </div>
                  </div>
                </div>
              )}

              {/* No workload - show available indicator */}
              {userWorkload && userWorkload.totalWords === 0 && userWorkload.totalLines === 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Available - no current projects</span>
                  </div>
                </div>
              )}

              {isSelected && (
                <div
                  className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="block text-gray-700 dark:text-gray-300 text-sm mb-1">
                    Custom Instruction (optional)
                  </label>
                  <span className="block text-gray-400 dark:text-gray-500 text-xs mb-2">
                    Only visible to translator after claiming
                  </span>
                  <textarea
                    value={currentAssignment.messages[user.id] || ""}
                    onChange={(e) =>
                      handleMessageChange(user.id, e.target.value)
                    }
                    placeholder="Add custom instruction..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation and Assign Buttons - Fixed at bottom, only show when at least one translator is selected */}
      {totalAssignments > 0 && (
        <div
          className={`fixed bottom-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 transition-all duration-300 ${
            collapsed ? "left-20" : "left-52"
          }`}
        >
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Left: Previous button */}
              <div>
                {!isFirstProject && (
                  <button
                    onClick={handlePreviousProject}
                    className="px-6 py-3 cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors flex items-center gap-2 border border-gray-200 dark:border-gray-600"
                    type="button"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Previous Project
                  </button>
                )}
              </div>

              {/* Center: Summary info */}
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
                {projectsWithAssignments} of {selectedProjects.length} projects have collaborators assigned
              </div>

              {/* Right: Next or Assign button */}
              <div>
                {isLastProject ? (
                  <button
                    onClick={handleAssignAll}
                    disabled={totalAssignments === 0}
                    className="px-8 py-3 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
                    type="button"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Assign {totalUniqueTranslators} collaborator{totalUniqueTranslators !== 1 ? "s" : ""} ({totalAssignments} assignment{totalAssignments !== 1 ? "s" : ""})
                  </button>
                ) : (
                  <button
                    onClick={handleNextProject}
                    className="px-6 py-3 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center gap-2 shadow-lg"
                    type="button"
                  >
                    Next Project
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Spacer to prevent content from being hidden behind fixed button */}
      <div className="h-24" />
    </div>
  );
}
