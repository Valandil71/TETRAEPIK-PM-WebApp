"use client";

import { useRouter } from "next/navigation";
import { Check, XCircle, MessageSquare, ChevronRight, ChevronDown } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { formatNumber, formatProjectName } from "@/utils/formatters";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { getSystemColorStyle, getLanguageColorStyle, getStatusIcon } from "@/utils/projectTableHelpers";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import { ProjectColorLegendTooltip } from "@/components/shared/ProjectColorLegendTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getInstructionsPreview } from "@/utils/instructionsPreview";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";
import type { ProjectGroup } from "@/lib/projectGrouping";
import { getGroupDisplayName } from "@/lib/projectGrouping";

interface ProjectWithTranslators {
  id: number;
  name: string;
  system: string;
  words: number | null;
  lines: number | null;
  translators: Array<{
    id: string;
    name: string;
    short_name?: string | null;
    role: string;
    assignment_status: string;
    avatar?: string | null;
    done_message?: string | null;
  }>;
  initial_deadline: string | null;
  interim_deadline: string | null;
  final_deadline: string | null;
  instructions?: string | null;
  sap_instructions?: import("@/types/project").SapInstructionEntry[] | null;
  status: "complete" | "active" | "cancelled";
  language_in: string;
  language_out: string;
}

interface DoneMessagePopoverProps {
  translatorName: string;
  doneMessage: string;
}

function DoneMessagePopover({ translatorName, doneMessage }: DoneMessagePopoverProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);

  const isOpen = isPinned || isHoveringTrigger;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) setIsPinned(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPinned((prev) => !prev);
          }}
          onMouseEnter={() => setIsHoveringTrigger(true)}
          onMouseLeave={() => setIsHoveringTrigger(false)}
          className="cursor-pointer shrink-0"
          aria-label="View collaborator note"
        >
          <MessageSquare className="w-3.5 h-3.5 text-green-500 hover:text-green-600 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-xs text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-semibold text-xs text-gray-500 dark:text-gray-400 mb-1">
          {translatorName} wrote:
        </p>
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {doneMessage}
        </p>
      </PopoverContent>
    </Popover>
  );
}
interface ManagementTableProps {
  groups: ProjectGroup<ProjectWithTranslators>[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  openMenu: string | null;
  onMenuToggle: (projectId: string | null) => void;
  onAddTranslator: (projectId: number) => void;
  onRemoveTranslator: (projectId: number) => void;
  onDuplicate: (projectId: number) => void;
  onEditDetails: (projectId: number) => void;
  onCompleteProject: (projectId: number) => void;
  editingProjectId: number | null;
  editFocusField: "words" | "lines";
  editWords: string;
  editLines: string;
  onEditWordsChange: (value: string) => void;
  onEditLinesChange: (value: string) => void;
  onStartWordsLinesEdit: (
    projectId: number,
    words: number | null,
    lines: number | null,
    focusField?: "words" | "lines"
  ) => void;
  onSaveWordsLines: (projectId: number) => void;
  onCancelWordsLinesEdit: () => void;
  isUpdatingWordsLines: boolean;
  onInstructionsClick?: (project: ProjectWithTranslators) => void;
}

export function ManagementTable({
  groups,
  expandedGroups,
  onToggleGroup,
  openMenu,
  onMenuToggle,
  onAddTranslator,
  onRemoveTranslator,
  onDuplicate,
  onEditDetails,
  onCompleteProject,
  editingProjectId,
  editFocusField,
  editWords,
  editLines,
  onEditWordsChange,
  onEditLinesChange,
  onStartWordsLinesEdit,
  onSaveWordsLines,
  onCancelWordsLinesEdit,
  isUpdatingWordsLines,
  onInstructionsClick,
}: ManagementTableProps) {
  const router = useRouter();
  const { getSystemColorPreview, getLanguageColorPreview } = useColorSettings();
  const { exclusionSet } = useInstructionExclusions(null);

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);
  const getLanguageColorStyleLocal = (langIn: string, langOut: string) =>
    getLanguageColorStyle(langIn, langOut, getLanguageColorPreview);

  const handleRowClick = (project: ProjectWithTranslators, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    router.push(`/project/${project.id}`);
  };

  const getStatusIconLocal = getStatusIcon;
  const wordsInputRef = useRef<HTMLInputElement | null>(null);
  const linesInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingProjectId == null) return;

    const targetInput =
      editFocusField === "lines" ? linesInputRef.current : wordsInputRef.current;
    if (!targetInput) return;

    targetInput.focus();
    targetInput.select();
  }, [editingProjectId, editFocusField]);
  const handleWordsLinesKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    projectId: number
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onSaveWordsLines(projectId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancelWordsLinesEdit();
    }
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
          No projects found in this category
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
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 w-4" />
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">System</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Project Name</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-right">Words</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300 text-right">Lines</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Collaborator(s)</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Due Date</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Instructions</th>
              <th className="px-6 py-4 text-left text-gray-700 dark:text-gray-300">Actions</th>
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
                      <td colSpan={9} className="px-6 py-3">
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
                        onClick={(e) => handleRowClick(project, e)}
                      >
                        <td className={`px-6 py-4 relative ${isGrouped ? "pl-10" : ""}`}>
                          {isGrouped && (
                            <>
                              <div className="absolute left-3 top-0 bottom-0 w-px bg-blue-200/70 dark:bg-blue-800/50" />
                              <div className="absolute left-3 top-1/2 h-px w-3 bg-blue-200/70 dark:bg-blue-800/50" />
                            </>
                          )}
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
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-blue-400 text-sm">
                            {project.system}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-900 dark:text-white max-w-[280px] block break-words line-clamp-2">
                            {formatProjectName(project.name)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div onClick={(e) => e.stopPropagation()}>
                            {editingProjectId === project.id ?
                              <input
                                type="number"
                                value={editWords}
                                onChange={(e) => onEditWordsChange(e.target.value)}
                                onKeyDown={(e) => handleWordsLinesKeyDown(e, project.id)}
                                ref={wordsInputRef}
                                className="w-24 px-3 py-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                min="0"
                              />
                            : <button
                                onClick={() =>
                                  onStartWordsLinesEdit(
                                    project.id,
                                    project.words,
                                    project.lines,
                                    "words"
                                  )
                                }
                                className="inline-flex min-h-9 min-w-[72px] items-center justify-end rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                type="button"
                              >
                                {project.words != null ? formatNumber(project.words) : "-"}
                              </button>
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div onClick={(e) => e.stopPropagation()}>
                            {editingProjectId === project.id ?
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  value={editLines}
                                  onChange={(e) => onEditLinesChange(e.target.value)}
                                  onKeyDown={(e) => handleWordsLinesKeyDown(e, project.id)}
                                  ref={linesInputRef}
                                  className="w-24 px-3 py-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  min="0"
                                />
                                <button
                                  onClick={() => onSaveWordsLines(project.id)}
                                  disabled={isUpdatingWordsLines}
                                  className="p-1 text-green-600 hover:text-green-700 hover:scale-125 transition-transform disabled:opacity-50"
                                  type="button"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={onCancelWordsLinesEdit}
                                  className="p-1 text-red-600 hover:text-red-700 hover:scale-125 transition-transform"
                                  type="button"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            : <button
                                onClick={() =>
                                  onStartWordsLinesEdit(
                                    project.id,
                                    project.words,
                                    project.lines,
                                    "lines"
                                  )
                                }
                                className="inline-flex min-h-9 min-w-[72px] items-center justify-end rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                type="button"
                              >
                                {project.lines != null ? formatNumber(project.lines) : "-"}
                              </button>
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {project.translators.length > 0 ?
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-2">
                                {project.translators.map((translator) => {
                                  const statusInfo = getStatusIconLocal(
                                    translator.assignment_status
                                  );
                                  const StatusIcon = statusInfo.icon;
                                  return (
                                    <div
                                      key={translator.id}
                                      className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 text-xs"
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <StatusIcon
                                            className={`w-3.5 h-3.5 ${statusInfo.color} shrink-0`}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{statusInfo.label}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <ProfileAvatar
                                        name={translator.name}
                                        avatar={translator.avatar}
                                        size="xs"
                                        showEditButton={false}
                                      />
                                      <span>
                                        {translator.short_name || translator.name}
                                      </span>
                                      {translator.done_message &&
                                        translator.assignment_status === "done" && (
                                          <DoneMessagePopover
                                            translatorName={translator.name}
                                            doneMessage={translator.done_message}
                                          />
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            </TooltipProvider>
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
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs md:text-sm max-w-xs">
                          {(() => {
                            const { displayText, hasAnyInstructions } =
                              getInstructionsPreview({
                                instructions: project.instructions,
                                sapInstructions: project.sap_instructions,
                                exclusionSet,
                              });
                            const canOpenInstructions =
                              !!onInstructionsClick && hasAnyInstructions;

                            return (
                              <span
                                className={`line-clamp-3 ${
                                  canOpenInstructions ?
                                    "cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                  : ""
                                }`}
                                onClick={(e) => {
                                  if (!canOpenInstructions) return;
                                  e.stopPropagation();
                                  onInstructionsClick(project);
                                }}
                              >
                                {displayText}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          <div onClick={(e) => e.stopPropagation()}>
                            <ProjectActionsMenu
                              projectId={project.id}
                              isOpen={openMenu === String(project.id)}
                              translators={project.translators}
                              onToggle={() =>
                                onMenuToggle(
                                  openMenu === String(project.id) ?
                                    null
                                  : String(project.id)
                                )
                              }
                              onAddTranslator={() => onAddTranslator(project.id)}
                              onRemoveTranslator={() =>
                                onRemoveTranslator(project.id)
                              }
                              onDuplicate={() => onDuplicate(project.id)}
                              onEditDetails={() => onEditDetails(project.id)}
                              onCompleteProject={() =>
                                onCompleteProject(project.id)
                              }
                            />
                          </div>
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




















