"use client";

import { useState, useMemo } from "react";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useUsers } from "@/hooks/user/useUsers";
import { useUserWorkload } from "@/hooks/user/useUserWorkload";
import type { User } from "@/types/user";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { formatRoleDisplay } from "@/utils/formatters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Test accounts that should never be offered for project assignment */
const HIDDEN_USER_NAMES = ["Francisco Rodrigues", "Xiconi das Coves"];

/** Display order of roles in the selection grid */
const ROLE_ORDER = ["employee", "pm", "admin"];

interface AddTranslatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  /** The assigned translator IDs when the dialog was opened (stored in state) */
  assignedTranslatorIds?: string[];
  /** Live assigned translator IDs from the current query (for detecting changes) */
  liveAssignedTranslatorIds?: string[];
  onAddTranslators: (
    projectId: number,
    userIds: string[],
    messages: Record<string, string>
  ) => void;
  isAdding: boolean;
}

export function AddTranslatorDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  assignedTranslatorIds = [],
  liveAssignedTranslatorIds,
  onAddTranslators,
  isAdding,
}: AddTranslatorDialogProps) {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { workloads, isLoading: workloadsLoading } = useUserWorkload();
  const [selectedTranslators, setSelectedTranslators] = useState<Set<string>>(
    new Set()
  );
  const [translatorMessages, setTranslatorMessages] = useState<
    Record<string, string>
  >({});

  // Detect if the assignment data has changed since the dialog was opened
  const isDataStale = useMemo(() => {
    if (!liveAssignedTranslatorIds) return false;

    // Check if the sets are different
    const originalSet = new Set(assignedTranslatorIds);
    const liveSet = new Set(liveAssignedTranslatorIds);

    if (originalSet.size !== liveSet.size) return true;

    for (const id of originalSet) {
      if (!liveSet.has(id)) return true;
    }

    return false;
  }, [assignedTranslatorIds, liveAssignedTranslatorIds]);

  // Filter out already assigned translators and test accounts, then sort by
  // role (Collaborators, PMs, Admins) and, within each role, lowest workload first
  const availableUsers = useMemo(() => {
    const normalize = (name: string) =>
      name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();
    const hiddenNames = new Set(
      HIDDEN_USER_NAMES.map((name) => normalize(name))
    );
    const roleOrder = (role: string) => {
      const index = ROLE_ORDER.indexOf(role);
      return index === -1 ? ROLE_ORDER.length : index;
    };
    const hours = (id: string) => workloads.get(id)?.estimatedHours ?? 0;

    return (users || [])
      .filter(
        (user) =>
          !assignedTranslatorIds.includes(user.id) &&
          !hiddenNames.has(normalize(user.name))
      )
      .sort(
        (a, b) =>
          roleOrder(a.role) - roleOrder(b.role) ||
          hours(a.id) - hours(b.id) ||
          a.name.localeCompare(b.name)
      );
  }, [users, assignedTranslatorIds, workloads]);

  const handleTranslatorToggle = (userId: string) => {
    const newSelection = new Set(selectedTranslators);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
      const newMessages = { ...translatorMessages };
      delete newMessages[userId];
      setTranslatorMessages(newMessages);
    } else {
      newSelection.add(userId);
    }
    setSelectedTranslators(newSelection);
  };

  const handleMessageChange = (userId: string, message: string) => {
    setTranslatorMessages((prev) => ({ ...prev, [userId]: message }));
  };

  const handleAssignTranslators = () => {
    onAddTranslators(
      projectId,
      Array.from(selectedTranslators),
      translatorMessages
    );
    setSelectedTranslators(new Set());
    setTranslatorMessages({});
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedTranslators(new Set());
    setTranslatorMessages({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Show stale data warning if assignments changed */}
        {isDataStale ?
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Project Updated
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">
              The translator assignments for this project have been modified by another user.
            </p>
            <Button onClick={handleClose} className="px-6">
              Go Back to Selection
            </Button>
          </div>
        : <>
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>Add Collaborator</DialogTitle>
            <DialogDescription>
              Select collaborators to add to{" "}
              <span className="font-medium">{projectName}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            {/* Translator Cards */}
            {usersLoading || workloadsLoading ?
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading users...
              </div>
            : availableUsers.length === 0 ?
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                All available collaborators are already assigned to this project.
              </div>
            : <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 items-start gap-3 pb-6">
            {availableUsers.map((user: User) => {
              const isSelected = selectedTranslators.has(user.id);
              const userWorkload = workloads.get(user.id);
              const fullName =
                user.short_name ? `${user.name} (${user.short_name})` : user.name;
              return (
                <div
                  key={user.id}
                  className={`min-w-0 p-3 bg-white dark:bg-gray-800 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isSelected ?
                      "border-blue-500 shadow-lg"
                    : "border-gray-200 dark:border-gray-700 hover:shadow-md"
                  }`}
                  onClick={(e) => {
                    // Don't toggle if clicking on textarea or label
                    if (
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
                  <div className="relative flex flex-col items-center gap-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTranslatorToggle(user.id)}
                      className="outline-style absolute top-0 left-0 w-5 h-5 rounded cursor-pointer"
                    />
                    <div className="shrink-0">
                      <ProfileAvatar
                        name={user.name}
                        avatar={user.avatar}
                        size="md"
                        showEditButton={false}
                      />
                    </div>
                    <div className="min-w-0 w-full">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h3 className="truncate text-gray-900 dark:text-white text-sm">
                            {user.name}
                            {user.short_name && (
                              <span className="text-gray-500 dark:text-gray-400 font-normal">
                                {" "}
                                ({user.short_name})
                              </span>
                            )}
                          </h3>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{fullName}</p>
                        </TooltipContent>
                      </Tooltip>
                      <p className="truncate text-gray-500 dark:text-gray-400 text-xs">
                        {formatRoleDisplay(user.role)}
                      </p>
                    </div>
                  </div>

                  {/* Workload Info */}
                  {userWorkload &&
                    (userWorkload.totalWords > 0 ||
                      userWorkload.totalLines > 0) && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/50 space-y-1">
                        {/* Next Week Workload */}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Predicted workload:
                        </span>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 text-blue-600 dark:text-blue-400">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="font-medium truncate">
                              Next week: {userWorkload.nextWeekEstimatedHours}h
                            </span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {userWorkload.nextWeekIsFeasible ?
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />
                              : <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              }
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {userWorkload.nextWeekIsFeasible ?
                                  "Should be able to handle workload"
                                : "Workload may be challenging"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {/* Total Workload */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 text-gray-600 dark:text-gray-400">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              Total: {userWorkload.estimatedHours}h
                            </span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {userWorkload.isFeasible ?
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />
                              : <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              }
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {userWorkload.isFeasible ?
                                  "Appears to have availability"
                                : "Workload appears high"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    )}

                  {/* No workload - show available indicator */}
                  {userWorkload &&
                    userWorkload.totalWords === 0 &&
                    userWorkload.totalLines === 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">Available - no current projects</span>
                        </div>
                      </div>
                    )}

                  {isSelected && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-700">
                      <label className="block text-gray-700 dark:text-gray-300 text-xs mb-0.5">
                        Custom Instruction (optional)
                      </label>
                      <span className="block text-gray-400 dark:text-gray-500 text-xs mb-1">
                        Only visible to translator after claiming
                      </span>
                      <Textarea
                        value={translatorMessages[user.id] || ""}
                        onChange={(e) =>
                          handleMessageChange(user.id, e.target.value)
                        }
                        placeholder="Add custom instruction..."
                        className="text-xs resize-none border border-gray-300 dark:border-gray-600"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            </TooltipProvider>
            }
          </div>

          {/* Fixed Footer at bottom */}
          <DialogFooter className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shadow-lg">
            <div className="flex justify-between items-center w-full">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {selectedTranslators.size} translator
                {selectedTranslators.size !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} disabled={isAdding}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignTranslators}
                  disabled={selectedTranslators.size === 0 || isAdding}
                >
                  {isAdding ?
                    "Adding..."
                  : `Assign ${selectedTranslators.size} collaborator${selectedTranslators.size !== 1 ? "s" : ""}`
                  }
                </Button>
              </div>
            </div>
          </DialogFooter>
        </>
        }
      </DialogContent>
    </Dialog>
  );
}
