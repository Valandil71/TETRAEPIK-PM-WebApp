"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  XCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
interface ManagementCardProps {
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
  onStartWordsLinesEdit: (projectId: number, words: number | null, lines: number | null, focusField?: "words" | "lines") => void;
  onSaveWordsLines: (projectId: number) => void;
  onCancelWordsLinesEdit: () => void;
  isUpdatingWordsLines: boolean;
  onInstructionsClick?: (project: ProjectWithTranslators) => void;
}

export function ManagementCard({
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
}: ManagementCardProps) {
  const router = useRouter();
  const { getSystemColorPreview, getLanguageColorPreview } = useColorSettings();
  const { exclusionSet } = useInstructionExclusions(null);

  const getSystemColorStyleLocal = (system: string) =>
    getSystemColorStyle(system, getSystemColorPreview);
  const getLanguageColorStyleLocal = (langIn: string, langOut: string) =>
    getLanguageColorStyle(langIn, langOut, getLanguageColorPreview);

  const handleCardClick = (id: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    router.push(`/project/${id}`);
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

  const renderProjectCard = (project: ProjectWithTranslators) => (
    <div
      key={project.id}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-lg dark:hover:shadow-blue-500/20 dark:hover:border-blue-500/50 transition-all"
      onClick={(e) => handleCardClick(project.id, e)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <ProjectColorLegendTooltip
            status={project.status}
            system={project.system}
            langIn={project.language_in}
            langOut={project.language_out}
            className="mr-2"
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
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs md:text-sm">
            {project.system}
          </span>
        </div>
        <ProjectActionsMenu
          projectId={project.id}
          isOpen={openMenu === String(project.id)}
          translators={project.translators}
          onToggle={() =>
            onMenuToggle(
              openMenu === String(project.id) ? null : String(project.id)
            )
          }
          onAddTranslator={() => onAddTranslator(project.id)}
          onRemoveTranslator={() => onRemoveTranslator(project.id)}
          onDuplicate={() => onDuplicate(project.id)}
          onEditDetails={() => onEditDetails(project.id)}
          onCompleteProject={() => onCompleteProject(project.id)}
        />
      </div>

      <h3 className="text-gray-900 dark:text-white text-sm font-bold mt-2 break-words line-clamp-2">
        {formatProjectName(project.name)}
      </h3>
      <div className="text-gray-500 dark:text-gray-400 text-xs mt-1" onClick={(e) => e.stopPropagation()}>
        {editingProjectId === project.id ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span>Words:</span>
            <input
              type="number"
              value={editWords}
              onChange={(e) => onEditWordsChange(e.target.value)}
              onKeyDown={(e) => handleWordsLinesKeyDown(e, project.id)}
              ref={wordsInputRef}
              className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="0"
            />
            <span>Lines:</span>
            <input
              type="number"
              value={editLines}
              onChange={(e) => onEditLinesChange(e.target.value)}
              onKeyDown={(e) => handleWordsLinesKeyDown(e, project.id)}
              ref={linesInputRef}
              className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              min="0"
            />
            <button
              onClick={() => onSaveWordsLines(project.id)}
              disabled={isUpdatingWordsLines}
              className="p-0.5 text-green-600 hover:text-green-700 hover:scale-125 transition-transform disabled:opacity-50"
              type="button"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCancelWordsLinesEdit}
              className="p-0.5 text-red-600 hover:text-red-700 hover:scale-125 transition-transform"
              type="button"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => onStartWordsLinesEdit(project.id, project.words, project.lines, "words")}
              className="hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
              type="button"
            >
              Words: {project.words ? formatNumber(project.words) : "-"}
            </button>
            <span>,</span>
            <button
              onClick={() => onStartWordsLinesEdit(project.id, project.words, project.lines, "lines")}
              className="hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
              type="button"
            >
              Lines: {project.lines ? formatNumber(project.lines) : "-"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2">
        {project.translators.length > 0 ?
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {project.translators.map((translator) => {
                const statusInfo = getStatusIconLocal(translator.assignment_status);
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={translator.id}
                    className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 text-xs"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color} shrink-0`} />
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
                    <span>{translator.short_name || translator.name}</span>
                    {translator.done_message && translator.assignment_status === "done" && (
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
      </div>

      <div className="text-gray-700 dark:text-gray-300 text-xs md:text-sm mt-2 flex items-center gap-1">
        <span>Due Date:</span>
        <DeadlineDisplay
          initialDeadline={project.initial_deadline}
          interimDeadline={project.interim_deadline}
          finalDeadline={project.final_deadline}
        />
      </div>
      {(() => {
        const { displayText, hasAnyInstructions } = getInstructionsPreview({
          instructions: project.instructions,
          sapInstructions: project.sap_instructions,
          exclusionSet,
        });
        const canOpenInstructions = !!onInstructionsClick && hasAnyInstructions;

        return (
          <p
            className={`text-gray-500 dark:text-gray-400 text-xs md:text-sm max-w-xs truncate mt-1 ${canOpenInstructions ? "cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" : ""}`}
            onClick={(e) => {
              if (!canOpenInstructions) return;
              e.stopPropagation();
              onInstructionsClick(project);
            }}
          >
            Instructions: {displayText}
          </p>
        );
      })()}
    </div>
  );

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {groups.map((group) => {
        if (group.projects.length === 1) {
          return renderProjectCard(group.projects[0]);
        }

        const isExpanded = expandedGroups.has(group.key);
        return (
          <div
            key={group.key}
            className="md:col-span-2 lg:col-span-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 transition-all"
          >
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

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.projects.map(renderProjectCard)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

















