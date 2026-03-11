"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  MoreVertical,
  UserMinus,
  Pencil,
  RotateCcw,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectWithTranslatorDetails } from "@/types/project";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { formatRoleDisplay } from "@/utils/formatters";

interface TranslatorsListProps {
  project: ProjectWithTranslatorDetails;
  onAddTranslator: () => void;
  onRemoveTranslator: (userId: string) => void;
  onEditPMNote: (userId: string, userName: string, currentMessage: string | null) => void;
  onReassign: (userId: string, userName: string) => void;
  currentUserId?: string;
  onClaim?: (projectId: number) => void;
  onRefuse?: (projectId: number) => void;
  onDone?: (projectId: number) => void;
  onMarkComplete?: () => void;
  canMarkComplete?: boolean;
  isUpdating?: boolean;
  projectStatus?: string;
}

export function TranslatorsList({
  project,
  onAddTranslator,
  onRemoveTranslator,
  onEditPMNote,
  onReassign,
  currentUserId,
  onClaim,
  onRefuse,
  onDone,
  onMarkComplete,
  canMarkComplete = false,
  isUpdating = false,
  projectStatus,
}: TranslatorsListProps) {
  const [translatorToRemove, setTranslatorToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRemoveClick = (id: string, name: string) => {
    setTranslatorToRemove({ id, name });
  };

  const handleConfirmRemove = () => {
    if (translatorToRemove) {
      onRemoveTranslator(translatorToRemove.id);
      setTranslatorToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setTranslatorToRemove(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "claimed":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "done":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "claimed":
        return "In Progress";
      case "done":
        return "Done";
      case "rejected":
        return "Rejected";
      default:
        return "Unclaimed";
    }
  };

  const isDoneOrRejected = (status: string) =>
    status === "done" || status === "rejected";

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
      data-project-status={projectStatus}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold">
            Assigned Translators
          </h2>
        </div>
        <Button
          onClick={onAddTranslator}
          size="sm"
          className=" cursor-pointer bg-blue-500 hover:bg-blue-600 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {project.translators.length > 0 ?
        <div className="space-y-3">
          {project.translators.map((translator) => (
            <div
              key={translator.id}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <div className="flex items-center gap-3 mb-2">
                <ProfileAvatar
                  name={translator.name}
                  avatar={translator.avatar}
                  size="sm"
                  showEditButton={false}
                />
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {translator.id === currentUserId ? (
                      <>
                        Me
                        {translator.short_name && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            ({translator.short_name})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {translator.name}
                        {translator.short_name && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            {" "}
                            ({translator.short_name})
                          </span>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {formatRoleDisplay(translator.role)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isDoneOrRejected(translator.assignment_status) ? (
                      <DropdownMenuItem
                        onClick={() =>
                          onReassign(translator.id, translator.name)
                        }
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reassign
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() =>
                          onEditPMNote(translator.id, translator.name, translator.initial_message ?? null)
                        }
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit PM Note
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        handleRemoveClick(translator.id, translator.name)
                      }
                      className="text-red-600 dark:text-red-400"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove Collaborator
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2 ml-13 mb-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs ${getStatusColor(
                    translator.assignment_status
                  )}`}
                >
                  {getStatusLabel(translator.assignment_status)}
                </span>
                {/* Action buttons for current user when assigned as translator */}
                {currentUserId &&
                  translator.id === currentUserId &&
                  onClaim &&
                  onRefuse &&
                  onDone && (
                    <div className="flex items-center gap-2 ml-2">
                      {translator.assignment_status === "unclaimed" && (
                        <>
                          <Button
                            onClick={() => onClaim(project.id)}
                            size="sm"
                            disabled={isUpdating}
                            className="cursor-pointer bg-green-500 hover:bg-green-600 text-white h-7 text-xs"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Claim
                          </Button>
                          <Button
                            onClick={() => onRefuse(project.id)}
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 h-7 text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Refuse
                          </Button>
                        </>
                      )}
                      {translator.assignment_status === "claimed" && (
                        <Button
                          onClick={() => onDone(project.id)}
                          size="sm"
                          disabled={isUpdating}
                          className="cursor-pointer bg-green-500 hover:bg-green-600 text-white h-7 text-xs"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Done
                        </Button>
                      )}
                    </div>
                  )}
              </div>

              {/* Messages */}
              {(translator.initial_message ||
                translator.refusal_message ||
                translator.done_message) && (
                <div className="mt-2 space-y-1 ml-13">
                  {translator.initial_message && (
                    <div className="text-xs">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        PM info:
                      </span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {translator.initial_message}
                      </span>
                    </div>
                  )}
                  {translator.refusal_message && (
                    <div className="text-xs">
                      <span className="text-red-500 dark:text-red-400 font-medium">
                        Refusal:
                      </span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {translator.refusal_message}
                      </span>
                    </div>
                  )}
                  {translator.done_message && (
                    <div className="text-xs">
                      <span className="text-green-500 dark:text-green-400 font-medium">
                        Done:
                      </span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {translator.done_message}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      : <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            No collaborators assigned yet
          </p>
        </div>
      }

      {/* Mark Complete Button for PM/Admin */}
      {canMarkComplete && onMarkComplete && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onMarkComplete}
            disabled={isUpdating}
            className="cursor-pointer w-full bg-green-500 hover:bg-green-600 text-white"
            size="default"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark Project as Complete
          </Button>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {translatorToRemove && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleCancelRemove}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 dark:text-white font-semibold">
                Confirm Removal
              </h2>
              <button
                onClick={handleCancelRemove}
                className="p-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                type="button"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              Are you sure you want to remove{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {translatorToRemove.name}
              </span>{" "}
              from{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {project.name}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelRemove}
                className="px-4 py-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-2 cursor-pointer bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
