"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, CheckCircle } from "lucide-react";
import { ViewToggle } from "@/components/general/ViewToggle";
import { MyProjectsTable } from "@/components/my-projects/MyProjectsTable";
import { MyProjectsCard } from "@/components/my-projects/MyProjectsCard";
import { RefusalDialog } from "@/components/my-projects/RefusalDialog";
import { DoneDialog } from "@/components/my-projects/DoneDialog";
import { InitialMessageDialog } from "@/components/my-projects/InitialMessageDialog";
import { BulkClaimDialog } from "@/components/my-projects/BulkClaimDialog";
import { BulkSelectionBar } from "@/components/shared/BulkSelectionBar";
import { useProjectSelection } from "@/hooks/project/useProjectSelection";
import { formatProjectName } from "@/utils/formatters";
import { useUser } from "@/hooks/user/useUser";
import { useMyProjects } from "@/hooks/project/useMyProjects";
import type { ProjectAssignment } from "@/types/project-assignment";

export default function MyProjectsPage() {
  const { user, loading: userLoading } = useUser();
  const {
    unclaimedProjects,
    claimedProjects,
    loading: projectsLoading,
    claimProject,
    claimProjects,
    rejectProject,
    markAsDone,
    markProjectsAsDone,
  } = useMyProjects(user?.id || null);

  const [activeTab, setActiveTab] = useState<"unclaimed" | "inProgress">(
    "unclaimed"
  );
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
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
  const [bulkDoneOpen, setBulkDoneOpen] = useState(false);
  const [bulkClaimOpen, setBulkClaimOpen] = useState(false);

  // Multi-select mode (claim / mark done several projects at once)
  const selection = useProjectSelection();
  const currentProjects =
    activeTab === "unclaimed" ? unclaimedProjects : claimedProjects;
  const selectedAssignments = useMemo(
    () => currentProjects.filter((a) => selection.selectedIds.has(a.projects.id)),
    [currentProjects, selection.selectedIds]
  );

  // Selected projects that leave the list (claimed elsewhere, removed by a PM) drop out
  const { isActive: isSelecting, retain: retainSelection } = selection;
  useEffect(() => {
    if (isSelecting) retainSelection(currentProjects.map((a) => a.projects.id));
  }, [isSelecting, retainSelection, currentProjects]);

  const changeTab = (tab: "unclaimed" | "inProgress") => {
    selection.exit();
    setActiveTab(tab);
  };

  const selectedIds = () => selectedAssignments.map((a) => a.projects.id);
  const bulkInstructions = selectedAssignments
    .filter((a) => a.initial_message)
    .map((a) => ({
      projectId: a.projects.id,
      projectName: formatProjectName(a.projects.name),
      message: a.initial_message as string,
    }));

  const handleBulkClaim = () => {
    if (bulkInstructions.length > 0) {
      setBulkClaimOpen(true);
      return;
    }
    claimProjects(selectedIds());
    selection.exit();
  };

  const handleConfirmBulkClaim = () => {
    claimProjects(selectedIds());
    setBulkClaimOpen(false);
    selection.exit();
  };

  const handleConfirmBulkDone = (message: string | null) => {
    markProjectsAsDone(selectedIds(), message);
    setBulkDoneOpen(false);
    selection.exit();
  };
  const [initialMessageDialog, setInitialMessageDialog] = useState<{
    open: boolean;
    projectId: number | null;
    projectName: string;
    message: string;
  }>({ open: false, projectId: null, projectName: "", message: "" });

  // Auto-switch to "In Progress" tab if there are no unclaimed projects
  useEffect(() => {
    if (
      !projectsLoading &&
      unclaimedProjects.length === 0 &&
      claimedProjects.length > 0
    ) {
      const timeout = setTimeout(() => {
        setActiveTab("inProgress");
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [projectsLoading, unclaimedProjects.length, claimedProjects.length]);

  const handleClaimClick = (assignment: ProjectAssignment) => {
    // Check if there's an initial_message
    if (assignment.initial_message) {
      setInitialMessageDialog({
        open: true,
        projectId: assignment.projects.id,
        projectName: assignment.projects.name,
        message: assignment.initial_message,
      });
    } else {
      claimProject(assignment.projects.id, assignment.projects.name);
    }
  };

  const handleClaimAfterMessage = () => {
    if (initialMessageDialog.projectId) {
      claimProject(
        initialMessageDialog.projectId,
        initialMessageDialog.projectName
      );
      setInitialMessageDialog({
        open: false,
        projectId: null,
        projectName: "",
        message: "",
      });
    }
  };

  const handleRefuseClick = (projectId: number, projectName: string) => {
    setRefusalDialog({
      open: true,
      projectId,
      projectName,
    });
  };

  const handleConfirmRefuse = (message: string) => {
    if (refusalDialog.projectId) {
      rejectProject(
        refusalDialog.projectId,
        refusalDialog.projectName,
        message
      );
      setRefusalDialog({ open: false, projectId: null, projectName: "" });
    }
  };

  const handleCancelRefuse = () => {
    setRefusalDialog({ open: false, projectId: null, projectName: "" });
  };

  const handleDoneClick = (projectId: number, projectName: string) => {
    setDoneDialog({
      open: true,
      projectId,
      projectName,
    });
  };

  const handleConfirmDone = (message: string | null) => {
    if (doneDialog.projectId) {
      markAsDone(doneDialog.projectId, doneDialog.projectName, message);
      setDoneDialog({ open: false, projectId: null, projectName: "" });
    }
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

  const loading = userLoading || projectsLoading;

  if (loading) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Please log in to view your projects
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">My Projects</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Claim new assignments or mark your work as complete
        </p>
      </div>

      {/* Tabs + View Toggle */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-end justify-between">
          <div className="flex gap-8">
            <button
              onClick={() => changeTab("unclaimed")}
              className={`pb-3 cursor-pointer border-b-2 text-sm md:text-base transition-colors ${
                activeTab === "unclaimed" ?
                  "border-blue-500 text-blue-500"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              type="button"
            >
              Available to Claim ({unclaimedProjects.length})
            </button>
            <button
              onClick={() => changeTab("inProgress")}
              className={`pb-3 cursor-pointer border-b-2 text-sm md:text-base transition-colors ${
                activeTab === "inProgress" ?
                  "border-blue-500 text-blue-500"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              type="button"
            >
              In Progress ({claimedProjects.length})
            </button>
          </div>

          <div className="mb-3 flex flex-col items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              View
            </span>
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Table or Card View */}
      {currentProjects.length === 0 ?
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {activeTab === "unclaimed" ?
              "No projects available to claim at the moment"
            : "No projects in progress"}
          </p>
        </div>
      : viewMode === "table" ?
        <MyProjectsTable
          projects={currentProjects}
          activeTab={activeTab}
          onClaim={handleClaimClick}
          onReject={handleRefuseClick}
          onDone={handleDoneClick}
          onSelectMultiple={selection.start}
          selection={selection}
        />
      : <MyProjectsCard
          projects={currentProjects}
          activeTab={activeTab}
          onClaim={handleClaimClick}
          onReject={handleRefuseClick}
          onDone={handleDoneClick}
          onSelectMultiple={selection.start}
          selection={selection}
        />
      }

      {/* Dialogs */}
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
      <DoneDialog
        open={bulkDoneOpen}
        projectName=""
        projectNames={selectedAssignments.map((a) => formatProjectName(a.projects.name))}
        onConfirm={handleConfirmBulkDone}
        onCancel={() => setBulkDoneOpen(false)}
      />
      <BulkClaimDialog
        open={bulkClaimOpen}
        projectCount={selectedAssignments.length}
        instructions={bulkInstructions}
        onClaim={handleConfirmBulkClaim}
        onCancel={() => setBulkClaimOpen(false)}
      />
      {selection.isActive && !bulkDoneOpen && !bulkClaimOpen && (
        <BulkSelectionBar
          count={selection.count}
          hint="Click or drag over projects to select · Esc to cancel"
          onCancel={selection.exit}
          actions={[
            activeTab === "unclaimed" ?
              {
                label: "Claim",
                icon: Check,
                className: "bg-blue-500 hover:bg-blue-600",
                onClick: handleBulkClaim,
              }
            : {
                label: "Mark as done",
                icon: CheckCircle,
                className: "bg-green-500 hover:bg-green-600",
                onClick: () => setBulkDoneOpen(true),
              },
          ]}
        />
      )}
      <InitialMessageDialog
        open={initialMessageDialog.open}
        projectName={initialMessageDialog.projectName}
        message={initialMessageDialog.message}
        onClose={handleCloseInitialMessage}
        onClaim={handleClaimAfterMessage}
      />
    </div>
  );
}
