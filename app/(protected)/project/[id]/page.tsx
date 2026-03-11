"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit, Loader2, Check, X, Copy, Info } from "lucide-react";
import { formatProjectName } from "@/utils/formatters";
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/hooks/project/useProject";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";
import { useMyProjects } from "@/hooks/project/useMyProjects";
import { ProjectDetailsCard } from "@/components/project/ProjectDetailsCard";
import { ProjectInstructionsCard } from "@/components/project/ProjectInstructionsCard";
import { ProjectNotesCard } from "@/components/project/ProjectNotesCard";
import { TranslatorsList } from "@/components/project/TranslatorsList";
import { AddTranslatorDialog } from "@/components/management/AddTranslatorDialog";
import { ReminderModal } from "@/components/project/ReminderModal";
import { ReassignModal } from "@/components/project/ReassignModal";
import { RefusalDialog } from "@/components/my-projects/RefusalDialog";
import { DoneDialog } from "@/components/my-projects/DoneDialog";
import { InitialMessageDialog } from "@/components/my-projects/InitialMessageDialog";
import { ConfirmationDialog } from "@/components/management/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.id ? Number(params.id) : null;

  const { data: project, isLoading, error } = useProject(projectId);
  const { getSystemColorPreview } = useColorSettings();
  const {
    user,
    loading: userLoading,
    isTranslator,
    canManageAssignments,
  } = useRoleAccess();

  // Use the same hook as my-projects for claim/reject/done functionality
  const { claimProject, rejectProject, markAsDone, isUpdating } = useMyProjects(user?.id || null);

  const [addTranslatorModal, setAddTranslatorModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
    assignedTranslatorIds: string[];
  }>({ open: false, projectId: 0, projectName: "", assignedTranslatorIds: [] });
  const [showPMNoteModal, setShowPMNoteModal] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    currentMessage: string | null;
  }>({ open: false, userId: "", userName: "", currentMessage: null });
  const [showReassignModal, setShowReassignModal] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  // Translator action dialogs
  const [refusalDialog, setRefusalDialog] = useState<{
    open: boolean;
    projectId: number | null;
    projectName: string;
  }>({ open: false, projectId: null, projectName: "" });
  const [doneDialog, setDoneDialog] = useState<{
    open: boolean;
    projectId: number | null;
    projectName: string;
  }>({ open: false, projectId: null, projectName: "" });
  const [initialMessageDialog, setInitialMessageDialog] = useState<{
    open: boolean;
    projectId: number | null;
    projectName: string;
    message: string;
  }>({ open: false, projectId: null, projectName: "", message: "" });

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const hasRedirected = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Current user's assignment (if assigned to this project)
  const currentUserAssignment =
    project ? project.translators.find((t) => t.id === user?.id) : null;

  // Employee-specific assignment used for access gating and employee actions
  const translatorAssignment = isTranslator() ? currentUserAssignment : null;

  const isTranslatorAssigned = !!translatorAssignment;

  // Redirect translator if not assigned to this project
  useEffect(() => {
    if (
      !isLoading &&
      !userLoading &&
      project &&
      isTranslator() &&
      !isTranslatorAssigned &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      router.back();
    }
  }, [
    isLoading,
    userLoading,
    project,
    isTranslator,
    isTranslatorAssigned,
    router,
  ]);

  // Add translators mutation (PM/Admin only)
  const addTranslatorsMutation = useMutation({
    mutationFn: async ({
      projectId,
      userIds,
      messages,
    }: {
      projectId: number;
      userIds: string[];
      messages: Record<string, string>;
    }) => {
      const assignments = userIds.map((userId) => ({
        project_id: projectId,
        user_id: userId,
        assignment_status: userId === user?.id ? "claimed" : "unclaimed", // Auto-claim if self-assigning
        initial_message: messages[userId] || null,
      }));

      const { error } = await supabase
        .from("projects_assignment")
        .insert(assignments);

      if (error) throw new Error(`Failed to add collaborators: ${error.message}`);
    },
    onSuccess: (_, { userIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      userIds.forEach((uid) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(uid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(uid) });
      });
      toast.success("Collaborators added successfully");
      setAddTranslatorModal({
        open: false,
        projectId: 0,
        projectName: "",
        assignedTranslatorIds: [],
      });
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "collaborator management"));
    },
  });

  // Remove translator mutation (PM/Admin only)
  const removeTranslatorMutation = useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: number;
      userId: string;
    }) => {
      const { error } = await supabase
        .from("projects_assignment")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to remove collaborator: ${error.message}`);
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
      toast.success("Collaborator removed successfully");
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "collaborator management"));
    },
  });

  // Save PM note mutation (PM/Admin only)
  const savePMNoteMutation = useMutation({
    mutationFn: async ({
      projectId,
      userId,
      message,
    }: {
      projectId: number;
      userId: string;
      message: string | null;
    }) => {
      const { error } = await supabase
        .from("projects_assignment")
        .update({ initial_message: message })
        .eq("project_id", projectId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to save PM note: ${error.message}`);
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
      toast.success("PM note saved");
      setShowPMNoteModal({ open: false, userId: "", userName: "", currentMessage: null });
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "collaborator management"));
    },
  });

  // Reassign mutation (PM/Admin only) — resets assignment to unclaimed + clears messages
  const reassignMutation = useMutation({
    mutationFn: async ({
      projectId,
      userId,
      message,
    }: {
      projectId: number;
      userId: string;
      message: string | null;
    }) => {
      const { error } = await supabase
        .from("projects_assignment")
        .update({
          assignment_status: "unclaimed",
          initial_message: message,
          done_message: null,
          refusal_message: null,
        })
        .eq("project_id", projectId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to reassign: ${error.message}`);
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
      toast.success("Assignment reset — project is now available to claim again");
      setShowReassignModal({ open: false, userId: "", userName: "" });
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "collaborator management"));
    },
  });

  // Mark complete mutation (PM/Admin only)
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Project ID is required");
      const { error } = await supabase
        .from("projects")
        .update({ status: "complete" })
        .eq("id", projectId);

      if (error)
        throw new Error(`Failed to mark project as complete: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      toast.success("Project marked as complete");
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "project management"));
    },
  });

  // PM/Admin handlers
  const handleEdit = () => {
    router.push(`/project/${projectId}/edit`);
  };

  const handleDuplicate = () => {
    if (!projectId) return;
    router.push(`/new-project?duplicateFrom=${projectId}`);
  };

  const handleAddTranslator = () => {
    if (!project) return;
    setAddTranslatorModal({
      open: true,
      projectId: project.id,
      projectName: project.name,
      assignedTranslatorIds: project.translators.map((t) => t.id),
    });
  };

  const handleRemoveTranslator = (userId: string) => {
    if (!projectId) return;
    removeTranslatorMutation.mutate({ projectId, userId });
  };

  const handleEditPMNote = (userId: string, userName: string, currentMessage: string | null) => {
    setShowPMNoteModal({ open: true, userId, userName, currentMessage });
  };

  const handleSavePMNote = (message: string | null) => {
    if (!projectId) return;
    savePMNoteMutation.mutate({
      projectId,
      userId: showPMNoteModal.userId,
      message,
    });
  };

  const handleReassign = (userId: string, userName: string) => {
    setShowReassignModal({ open: true, userId, userName });
  };

  const handleConfirmReassign = (message: string | null) => {
    if (!projectId) return;
    reassignMutation.mutate({
      projectId,
      userId: showReassignModal.userId,
      message,
    });
  };

  const handleAddTranslators = (
    projectId: number,
    userIds: string[],
    messages: Record<string, string>
  ) => {
    addTranslatorsMutation.mutate({ projectId, userIds, messages });
  };

  // Wrapper handlers for TranslatorsList (for PM/Admin when assigned as translators)
  const handleClaimForTranslator = (projectId: number) => {
    if (!user?.id || !project) return;
    const translator = project.translators.find((t) => t.id === user.id);
    if (translator?.initial_message) {
      setInitialMessageDialog({
        open: true,
        projectId,
        projectName: project.name,
        message: translator.initial_message,
      });
    } else {
      claimProject(projectId, project.name);
    }
  };

  const handleRefuseForTranslator = (projectId: number) => {
    if (!project) return;
    setRefusalDialog({
      open: true,
      projectId,
      projectName: project.name,
    });
  };

  const handleDoneForTranslator = (projectId: number) => {
    if (!project) return;
    setDoneDialog({
      open: true,
      projectId,
      projectName: project.name,
    });
  };

  // Translator handlers
  const handleClaimClick = () => {
    if (!project || !user?.id) return;

    // Check if there's an initial_message
    if (translatorAssignment?.initial_message) {
      setInitialMessageDialog({
        open: true,
        projectId: project.id,
        projectName: project.name,
        message: translatorAssignment.initial_message,
      });
    } else {
      handleClaimProject();
    }
  };

  const handleClaimProject = () => {
    if (!projectId || !user?.id || !project) return;
    claimProject(projectId, project.name);
    setInitialMessageDialog({
      open: false,
      projectId: null,
      projectName: "",
      message: "",
    });
  };

  const handleRefuseClick = () => {
    if (!project) return;
    setRefusalDialog({
      open: true,
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleConfirmRefuse = (message: string) => {
    if (!refusalDialog.projectId || !user?.id) return;
    rejectProject(refusalDialog.projectId, refusalDialog.projectName, message);
    setRefusalDialog({ open: false, projectId: null, projectName: "" });
  };

  const handleCancelRefuse = () => {
    setRefusalDialog({ open: false, projectId: null, projectName: "" });
  };

  const handleDoneClick = () => {
    if (!project) return;
    setDoneDialog({
      open: true,
      projectId: project.id,
      projectName: project.name,
    });
  };

  const handleConfirmDone = (message: string | null) => {
    if (!doneDialog.projectId || !user?.id) return;
    markAsDone(doneDialog.projectId, doneDialog.projectName, message);
    setDoneDialog({ open: false, projectId: null, projectName: "" });
  };

  const handleCancelDone = () => {
    setDoneDialog({ open: false, projectId: null, projectName: "" });
  };

  const handleCloseInitialMessage = () => {
    setInitialMessageDialog({
      open: false,
      projectId: null,
      projectName: "",
      message: "",
    });
  };

  if (isLoading || userLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <h2 className="text-gray-900 dark:text-white mb-4">
            Project not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {error ?
              "Failed to load project. Please try again."
            : "The project you're looking for doesn't exist or has been removed."
            }
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // If translator not assigned, show loading while redirecting
  if (isTranslator() && !isTranslatorAssigned) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  // Get system color preview for the indicator dot
  const systemColorPreview = getSystemColorPreview(project.system);
  const systemColorStyle =
    systemColorPreview !== "transparent" ?
      { backgroundColor: systemColorPreview }
    : undefined;

  // Determine translator's assignment status for action buttons
  const assignmentStatus = translatorAssignment?.assignment_status;
  const hasProjectNotes = !!project.project_notes?.trim();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded" style={systemColorStyle} />
            <div>
              <h1 className="text-gray-900 dark:text-white mb-2 text-3xl font-bold">
                {formatProjectName(project.name)}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-base">
                  {project.system}
                </span>
                
              </div>
            </div>
          </div>

          {/* Action buttons based on role */}
          <div className="flex gap-2">
            {/* PM/Admin: Duplicate and Edit buttons */}
            {canManageAssignments() && (
              <>
                <Button
                  onClick={handleDuplicate}
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  onClick={handleEdit}
                  size="lg"
                  className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Edit className="w-12 h-12 mr-2" />
                  Edit Project
                </Button>
              </>
            )}

            {/* Translator: Claim/Refuse or Done buttons */}
            {isTranslator() && isTranslatorAssigned && (
              <>
                {assignmentStatus === "unclaimed" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClaimClick}
                      disabled={isUpdating}
                      className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <Check className="w-5 h-5" />
                      Claim Project
                    </button>
                    <button
                      onClick={handleRefuseClick}
                      disabled={isUpdating}
                      className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all hover:bg-red-500 dark:hover:bg-red-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <X className="w-5 h-5" />
                      Refuse
                    </button>
                  </div>
                )}
                {assignmentStatus === "claimed" && (
                  <button
                    onClick={handleDoneClick}
                    disabled={isUpdating}
                    className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-all hover:bg-green-500 dark:hover:bg-green-600 hover:text-white dark:hover:text-white hover:shadow-lg hover:scale-105 border border-gray-200 dark:border-gray-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <Check className="w-5 h-5" />
                    Mark as Done
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`grid grid-cols-1 ${canManageAssignments() ? "lg:grid-cols-3" : ""} gap-6`}
      >
        {/* Left Column - Main Info */}
        <div
          className={`${canManageAssignments() ? "lg:col-span-2" : ""} space-y-6`}
        >
          {/* PM Info banner shown when the assigned current user has a PM note */}
          {currentUserAssignment?.initial_message && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wide">
                  Info from PM
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {currentUserAssignment.initial_message}
                </p>
              </div>
            </div>
          )}
          <ProjectDetailsCard project={project} showFinancial={canManageAssignments()} />
          {!canManageAssignments() && hasProjectNotes && (
            <ProjectNotesCard
              projectId={project.id}
              notes={project.project_notes}
              canEdit={false}
            />
          )}
          <ProjectInstructionsCard
            instructions={project.instructions}
            sapInstructions={canManageAssignments() ? project.sap_instructions : null}
          />
        </div>

        {/* Right Column - Translators (PM/Admin only) */}
        {canManageAssignments() && (
          <div className="space-y-6">
            <TranslatorsList
              project={project}
              onAddTranslator={handleAddTranslator}
              onRemoveTranslator={handleRemoveTranslator}
              onEditPMNote={handleEditPMNote}
              onReassign={handleReassign}
              currentUserId={user?.id}
              onClaim={handleClaimForTranslator}
              onRefuse={handleRefuseForTranslator}
              onDone={handleDoneForTranslator}
              onMarkComplete={() => setShowCompleteConfirm(true)}
              canMarkComplete={
                canManageAssignments() &&
                project.translators.length > 0 &&
                project.translators.every(
                  (t) => t.assignment_status === "done"
                ) &&
                project.status !== "complete"
              }
              isUpdating={
                isUpdating ||
                markCompleteMutation.isPending ||
                savePMNoteMutation.isPending ||
                reassignMutation.isPending
              }
              projectStatus={project.status}
            />
            <ProjectNotesCard
              projectId={project.id}
              notes={project.project_notes}
              canEdit={canManageAssignments()}
            />
          </div>
        )}
      </div>

      {/* PM/Admin Modals */}
      {canManageAssignments() && (
        <>
          <AddTranslatorDialog
            open={addTranslatorModal.open}
            onOpenChange={(open) =>
              setAddTranslatorModal({
                open,
                projectId: addTranslatorModal.projectId,
                projectName: addTranslatorModal.projectName,
                assignedTranslatorIds: addTranslatorModal.assignedTranslatorIds,
              })
            }
            projectId={addTranslatorModal.projectId}
            projectName={addTranslatorModal.projectName}
            assignedTranslatorIds={addTranslatorModal.assignedTranslatorIds}
            liveAssignedTranslatorIds={project?.translators.map((t) => t.id)}
            onAddTranslators={handleAddTranslators}
            isAdding={addTranslatorsMutation.isPending}
          />

          <ReminderModal
            open={showPMNoteModal.open}
            translatorName={showPMNoteModal.userName}
            initialValue={showPMNoteModal.currentMessage}
            onClose={() =>
              setShowPMNoteModal({ open: false, userId: "", userName: "", currentMessage: null })
            }
            onSend={handleSavePMNote}
            isSending={savePMNoteMutation.isPending}
          />

          <ReassignModal
            open={showReassignModal.open}
            translatorName={showReassignModal.userName}
            onClose={() =>
              setShowReassignModal({ open: false, userId: "", userName: "" })
            }
            onReassign={handleConfirmReassign}
            isReassigning={reassignMutation.isPending}
          />

          <ConfirmationDialog
            open={showCompleteConfirm}
            onOpenChange={setShowCompleteConfirm}
            title="Mark Project Complete"
            description="Are you sure you want to mark this project as complete? This action indicates the project is finished."
            confirmText="Mark Complete"
            onConfirm={() => markCompleteMutation.mutate()}
            onCancel={() => {}}
            isLoading={markCompleteMutation.isPending}
          />
        </>
      )}

      {/* Translator Dialogs - show for translators OR PM/Admin assigned to project */}
      {(isTranslator() || (canManageAssignments() && project?.translators?.some(t => t.id === user?.id))) && (
        <>
          <RefusalDialog
            open={refusalDialog.open}
            projectName={refusalDialog.projectName}
            onConfirm={handleConfirmRefuse}
            onCancel={handleCancelRefuse}
          />
          <DoneDialog
            open={doneDialog.open}
            projectName={doneDialog.projectName}
            onConfirm={handleConfirmDone}
            onCancel={handleCancelDone}
          />
          <InitialMessageDialog
            open={initialMessageDialog.open}
            projectName={initialMessageDialog.projectName}
            message={initialMessageDialog.message}
            onClose={handleCloseInitialMessage}
            onClaim={handleClaimProject}
          />
        </>
      )}
    </div>
  );
}
