"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Loader2, AlertCircle, Download, FileDown } from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useSapImportStatus } from "@/hooks/sap/useSapImportStatus";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { MultiSelectFilterDropdown } from "@/components/general/MultiSelectFilterDropdown";
import { ViewToggle } from "@/components/general/ViewToggle";
import { SearchBar } from "@/components/general/SearchBar";
import { ScrollToTopButton } from "@/components/general/ScrollToTopButton";
import { StatusTabs } from "@/components/general/StatusTabs";
import { ManagementTable } from "@/components/management/ManagementTable";
import { ManagementCard } from "@/components/management/ManagementCard";
import { AddTranslatorDialog } from "@/components/management/AddTranslatorDialog";
import { RemoveTranslatorDialog } from "@/components/management/RemoveTranslatorDialog";
import { ConfirmationDialog } from "@/components/management/ConfirmationDialog";
import { SapImportDialog } from "@/components/sap/SapImportDialog";
import { InstructionsDrawer } from "@/components/management/InstructionsDrawer";
import { ExportProjectsDialog } from "@/components/management/ExportProjectsDialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { RouteId } from "@/lib/roleAccess";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserClient } from "@supabase/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { useDefaultFilters } from "@/hooks/settings/useDefaultFilters";
import { useProjectFilters } from "@/hooks/project/useProjectFilters";
import { useManagementPageStore } from "@/lib/stores/useManagementPageStore";
import type { SapInstructionEntry } from "@/types/project";
import { groupProjectsByExactName } from "@/lib/projectGrouping";
import { useProjectGroupExpansion } from "@/hooks/project/useProjectGroupExpansion";

type ProjectStatus = "all" | "ready" | "inProgress" | "unclaimed";

export default function ProjectManagementPage() {
  return (
    <RoleGuard routeId={RouteId.MANAGEMENT}>
      <ProjectManagementContent />
    </RoleGuard>
  );
}

function ProjectManagementContent() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { data: sapImportStatus } = useSapImportStatus({ refetchInterval: 5000 });
  const queryClient = useQueryClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const isSapImportRunning = sapImportStatus?.status === "running";

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Persisted state via Zustand store
  const { activeTab, setActiveTab, viewMode, setViewMode } = useManagementPageStore();

  // State
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [addTranslatorModal, setAddTranslatorModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
    assignedTranslatorIds: string[];
  }>({ open: false, projectId: 0, projectName: "", assignedTranslatorIds: [] });
  const [removeTranslatorModal, setRemoveTranslatorModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
    translators: Array<{
      id: string;
      name: string;
      role: string;
      assignment_status: string;
    }>;
  }>({ open: false, projectId: 0, projectName: "", translators: [] });

  const [completeConfirmModal, setCompleteConfirmModal] = useState<{
    open: boolean;
    projectId: number;
    projectName: string;
  }>({ open: false, projectId: 0, projectName: "" });

  // SAP Import dialog state
  const [sapImportDialogOpen, setSapImportDialogOpen] = useState(false);

  // Export CSV dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // State for editing project words/lines
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editWords, setEditWords] = useState<string>("");
  const [editLines, setEditLines] = useState<string>("");
  const [editFocusField, setEditFocusField] = useState<"words" | "lines">("words");

  // Project type filter (page-specific, on top of shared filters)
  // Override is tagged with pathname so it auto-expires on navigation
  const pathname = usePathname();
  const { getFilter: getDefaultFilter, isFetched: defaultFiltersFetched } =
    useDefaultFilters(user?.id ?? null);

  const [projectTypeOverride, setProjectTypeOverride] = useState<{
    values: string[];
    path: string;
  } | null>(null);

  const setProjectTypeFilter = useCallback(
    (values: string[]) => setProjectTypeOverride({ values, path: pathname }),
    [pathname]
  );

  // Resolve: use override only if it was set on THIS page visit, otherwise use defaults
  const resolvedProjectTypeFilter: string[] = useMemo(() => {
    if (projectTypeOverride && projectTypeOverride.path === pathname) {
      return projectTypeOverride.values;
    }
    if (defaultFiltersFetched) {
      const pt = getDefaultFilter("project_type");
      return pt?.included_values?.length ? pt.included_values : [];
    }
    return [];
  }, [projectTypeOverride, pathname, defaultFiltersFetched, getDefaultFilter]);

  // Instructions drawer state
  const [instructionsDrawer, setInstructionsDrawer] = useState<{
    open: boolean;
    project: { name: string; instructions?: string | null; sap_instructions?: SapInstructionEntry[] | null } | null;
  }>({ open: false, project: null });

  // Fetch all projects (showAll = true to show all projects for all users)
  const {
    data: allProjectsRaw = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectsWithTranslators(false, true);

  // Filter out complete projects immediately
  const allProjects = useMemo(
    () => allProjectsRaw.filter((p) => p.status !== "complete"),
    [allProjectsRaw]
  );

  // Shared filter state + logic
  const {
    searchTerm, setSearchTerm,
    systemFilter, setSystemFilter,
    dueDateFilter, setDueDateFilter,
    customDueDate, setCustomDueDate,
    assignmentStatusFilter, setAssignmentStatusFilter,
    sourceLangFilter, setSourceLangFilter,
    targetLangFilter, setTargetLangFilter,
    lengthFilter, setLengthFilter,
    uniqueSystems,
    uniqueSourceLangs,
    uniqueTargetLangs,
    uniqueProjectTypes,
    hasActiveFilters: baseHasActiveFilters,
    clearFilters: baseClearFilters,
    applyBaseFilters,
  } = useProjectFilters(allProjects);

  // Determine project status based on translators
  const getProjectStatus = useCallback((
    project: (typeof allProjects)[0]
  ): ProjectStatus => {
    if (project.translators.length === 0) return "unclaimed";
    const allDone = project.translators.every(
      (t) => t.assignment_status === "done"
    );
    if (allDone) return "ready";
    const hasClaimed = project.translators.some(
      (t) => t.assignment_status === "claimed"
    );
    if (hasClaimed) return "inProgress";
    return "unclaimed";
  }, []);



  // Categorize projects
  const categorizedProjects = useMemo(() => {
    const ready: typeof allProjects = [];
    const inProgress: typeof allProjects = [];
    const unclaimed: typeof allProjects = [];

    allProjects.forEach((project) => {
      const status = getProjectStatus(project);
      if (status === "ready") ready.push(project);
      else if (status === "inProgress") inProgress.push(project);
      else if (status === "unclaimed") unclaimed.push(project);
    });

    return { ready, inProgress, unclaimed };
  }, [allProjects, getProjectStatus]);

  // Create tabs
  const tabs = useMemo(
    () => [
      {
        id: "all" as const,
        label: "All Projects",
        count: allProjects.length,
      },
      {
        id: "ready" as const,
        label: "Ready to Go",
        count: categorizedProjects.ready.length,
      },
      {
        id: "inProgress" as const,
        label: "In Progress",
        count: categorizedProjects.inProgress.length,
      },
      {
        id: "unclaimed" as const,
        label: "Awaiting Assignment",
        count: categorizedProjects.unclaimed.length,
      },
    ],
    [allProjects, categorizedProjects]
  );

  // Filter projects: tab filter + page-specific projectType on top of shared base filters
  const filteredProjects = useMemo(() => {
    // Start with tab filter
    let projects = [...allProjects];
    if (activeTab !== "all") {
      const status =
        activeTab === "ready" ? categorizedProjects.ready
        : activeTab === "inProgress" ? categorizedProjects.inProgress
        : categorizedProjects.unclaimed;
      projects = projects.filter((p) => status.includes(p));
    }

    // Apply shared base filters (search, system, dueDate, assignment, langs, length)
    projects = applyBaseFilters(projects);

    // Page-specific: project type filter
    if (resolvedProjectTypeFilter.length > 0) {
      projects = projects.filter(
        (p) => p.project_type && resolvedProjectTypeFilter.includes(p.project_type)
      );
    }

    return projects;
  }, [allProjects, activeTab, categorizedProjects, applyBaseFilters, resolvedProjectTypeFilter]);

  const groupedProjects = useMemo(
    () => groupProjectsByExactName(filteredProjects),
    [filteredProjects]
  );

  const { expandedGroups, toggleGroup, expandAll, collapseAll } =
    useProjectGroupExpansion({
      groups: groupedProjects,
      defaultExpanded: false,
    });

  // Mutations
  const markCompleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "complete" })
        .eq("id", projectId);

      if (error)
        throw new Error(`Failed to mark project as complete: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      toast.success("Project marked as complete");
      setOpenMenu(null);
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "project management")),
  });

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
    onSuccess: (_, { projectId, userIds }) => {
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
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
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "project management")),
  });

  const removeTranslatorMutation = useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: number; // bigint in database
      userId: string; // uuid in database
    }) => {
      // Ensure we have valid IDs
      if (!projectId || !userId) {
        throw new Error("Project ID and User ID are required");
      }

      // Check if current user is admin or PM (they should be able to delete any assignment)
      const isAdminOrPM = user && (user.role === "admin" || user.role === "pm");
      const isDeletingSelf = user && user.id === userId;

      // First, verify the assignment exists before deleting
      const { data: existingAssignment, error: checkError } = await supabase
        .from("projects_assignment")
        .select("project_id, user_id")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .single();

      if (checkError || !existingAssignment) {
        throw new Error(
          `Collaborator assignment not found. No row exists with project_id=${projectId} and user_id=${userId}`
        );
      }

      // Delete the specific row using the composite primary key (project_id, user_id)
      // According to schema: constraint projects_assignment_pkey primary key (project_id, user_id)
      // Note: If RLS is blocking self-deletion, admins/PMs should still be able to delete
      const { error } = await supabase
        .from("projects_assignment")
        .delete()
        .eq("project_id", projectId) // bigint - matches projects.id
        .eq("user_id", userId); // uuid - matches users.id

      if (error) {
        // Check if this is the database trigger error (column pm_id doesn't exist)
        // Error code 42703 = undefined_column in PostgreSQL
        if (error.code === "42703" && error.message?.includes("pm_id")) {
          console.error("Database trigger error - pm_id column missing:", {
            error,
            projectId,
            userId,
            isDeletingSelf,
            isAdminOrPM,
            currentUserId: user?.id,
          });

          throw new Error(
            `Database configuration error: The trigger function is trying to update a 'pm_id' column that doesn't exist in the projects table. Please contact your database administrator to fix the 'clear_pm_if_no_assignments()' function or add the missing 'pm_id' column to the projects table.`
          );
        }

        // Enhanced error message with context for other errors
        const errorContext =
          isDeletingSelf ? " (Attempting to delete own assignment)" : "";
        const roleContext =
          isAdminOrPM ?
            " (User is admin/PM)"
          : ` (User role: ${user?.role || "unknown"})`;

        console.error("Delete error details:", {
          error,
          projectId,
          userId,
          isDeletingSelf,
          isAdminOrPM,
          currentUserId: user?.id,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
        });

        throw new Error(
          `Failed to remove collaborator: ${error.message}${errorContext}${roleContext}. Project ID: ${projectId}, User ID: ${userId}`
        );
      }

      // Verify deletion was successful by checking if assignment still exists
      // Wait a small moment for the delete to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data: verifyAssignment, error: verifyError } = await supabase
        .from("projects_assignment")
        .select("project_id, user_id")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();

      // If assignment still exists and it's not a permission error, throw
      if (verifyAssignment && !verifyError) {
        throw new Error(
          "Delete operation completed but assignment still exists. This may be due to RLS policies preventing the deletion."
        );
      }

      // Return the deleted assignment data for confirmation
      return existingAssignment;
    },
    onSuccess: (_, { projectId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ["projects-with-translators"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProjects(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeMyProjectsCount(userId) });
      toast.success("Collaborator removed successfully");
      setRemoveTranslatorModal({
        open: false,
        projectId: 0,
        projectName: "",
        translators: [],
      });
      setOpenMenu(null);
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "project management")),
  });

  // Mutation to update project words/lines
  const updateWordsLinesMutation = useMutation({
    mutationFn: async ({
      projectId,
      words,
      lines,
    }: {
      projectId: number;
      words: number | null;
      lines: number | null;
    }) => {
      const { error } = await supabase
        .from("projects")
        .update({ words, lines })
        .eq("id", projectId);

      if (error) {
        throw new Error(`Failed to update words/lines: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      toast.success("Words/Lines updated successfully");
      setEditingProjectId(null);
      setEditFocusField("words");
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "project management")),
  });

  // Handlers for words/lines editing
  const handleStartWordsLinesEdit = (
    projectId: number,
    words: number | null,
    lines: number | null,
    focusField: "words" | "lines" = "words"
  ) => {
    setEditingProjectId(projectId);
    setEditWords(words?.toString() || "");
    setEditLines(lines?.toString() || "");
    setEditFocusField(focusField);
  };

  const handleSaveWordsLines = (projectId: number) => {
    const words = editWords ? parseInt(editWords) : null;
    const lines = editLines ? parseInt(editLines) : null;
    updateWordsLinesMutation.mutate({ projectId, words, lines });
  };

  const handleCancelWordsLinesEdit = () => {
    setEditingProjectId(null);
    setEditWords("");
    setEditLines("");
    setEditFocusField("words");
  };

  // Handlers
  const handleAddTranslator = (projectId: number) => {
    const project = allProjects.find((p) => p.id === projectId);
    if (project) {
      setAddTranslatorModal({
        open: true,
        projectId,
        projectName: project.name,
        assignedTranslatorIds: project.translators.map((t) => t.id),
      });
      setOpenMenu(null);
    }
  };

  const handleRemoveTranslator = (projectId: number) => {
    const project = allProjects.find((p) => p.id === projectId);
    if (project) {
      setRemoveTranslatorModal({
        open: true,
        projectId,
        projectName: project.name,
        translators: project.translators,
      });
      setOpenMenu(null);
    }
  };

  const handleDuplicate = (projectId: number) => {
    setOpenMenu(null);
    router.push(`/new-project?duplicateFrom=${projectId}`);
  };

  const handleEditDetails = (projectId: number) => {
    setOpenMenu(null);
    router.push(`/project/${projectId}/edit`);
  };

  const handleCompleteProject = (projectId: number) => {
    const project = allProjects.find((p) => p.id === projectId);
    if (project) {
      setCompleteConfirmModal({
        open: true,
        projectId,
        projectName: project.name,
      });
      setOpenMenu(null);
    }
  };

  const clearAllFilters = () => {
    baseClearFilters();
    setProjectTypeFilter([]);
  };

  const hasActiveFilters = baseHasActiveFilters || resolvedProjectTypeFilter.length > 0;

  // Loading state
  if (userLoading || projectsLoading) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading projects...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (projectsError) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Error Loading Projects
              </h2>
              <p className="text-muted-foreground">
                {projectsError.message ||
                  "An error occurred while loading projects."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white mb-2">Manage Projects</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Complete oversight of all translation projects and their status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => setSapImportDialogOpen(true)}
            disabled={isSapImportRunning}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {isSapImportRunning ? "SAP Import Running..." : "Import from SAP"}
          </Button>
        </div>
      </div>

      {/* Tabs + View Toggle + Search + Filters - Sticky Header */}
      <div className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 backdrop-blur-sm shadow-md mb-6 pt-4 pb-4 -mx-8 px-8">
        {/* Tabs + View Toggle */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-end justify-between">
            <StatusTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div className="mb-3 flex flex-col items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                View
              </span>
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by project name"
          />

          {/* Individual Filter Dropdowns */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex flex-wrap gap-3 items-start">
              <FilterDropdown
                label="System"
                options={uniqueSystems}
                selected={systemFilter}
                onSelect={setSystemFilter}
              />
              <FilterDropdown
                label="Due Date"
                options={[
                  "Today",
                  "In 1 day",
                  "In 3 days",
                  "In a week",
                  "In a month",
                  "Custom date",
                ]}
                selected={dueDateFilter}
                onSelect={setDueDateFilter}
                customDateValue={customDueDate}
                onCustomDateChange={setCustomDueDate}
              />
              <FilterDropdown
                label="Assignment Status"
                options={["Unassigned", "Assigned"]}
                selected={assignmentStatusFilter}
                onSelect={setAssignmentStatusFilter}
              />
              <FilterDropdown
                label="Source Language"
                options={uniqueSourceLangs}
                selected={sourceLangFilter}
                onSelect={setSourceLangFilter}
              />
              <FilterDropdown
                label="Target Language"
                options={uniqueTargetLangs}
                selected={targetLangFilter}
                onSelect={setTargetLangFilter}
              />
              <FilterDropdown
                label="Length"
                options={["Short", "Long"]}
                selected={lengthFilter}
                onSelect={setLengthFilter}
              />
              {uniqueProjectTypes.length > 0 && (
                <MultiSelectFilterDropdown
                  label="Project Type"
                  options={uniqueProjectTypes}
                  selected={resolvedProjectTypeFilter}
                  onSelect={setProjectTypeFilter}
                />
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={expandAll}
                className="px-4 py-2 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-sm shadow-sm"
                type="button"
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                className="px-4 py-2 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-sm shadow-sm"
                type="button"
              >
                Collapse all
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-black text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 transition-all flex items-center gap-2 text-sm shadow-sm"
                  type="button"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table or Card View */}
      {viewMode === "table" ?
        <ManagementTable
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          openMenu={openMenu}
          onMenuToggle={setOpenMenu}
          onAddTranslator={handleAddTranslator}
          onRemoveTranslator={handleRemoveTranslator}
          onDuplicate={handleDuplicate}
          onEditDetails={handleEditDetails}
          onCompleteProject={handleCompleteProject}
          editingProjectId={editingProjectId}
          editFocusField={editFocusField}
          editWords={editWords}
          editLines={editLines}
          onEditWordsChange={setEditWords}
          onEditLinesChange={setEditLines}
          onStartWordsLinesEdit={handleStartWordsLinesEdit}
          onSaveWordsLines={handleSaveWordsLines}
          onCancelWordsLinesEdit={handleCancelWordsLinesEdit}
          isUpdatingWordsLines={updateWordsLinesMutation.isPending}
          onInstructionsClick={(project) =>
            setInstructionsDrawer({ open: true, project: { name: project.name, instructions: project.instructions, sap_instructions: project.sap_instructions } })
          }
        />
      : <ManagementCard
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          openMenu={openMenu}
          onMenuToggle={setOpenMenu}
          onAddTranslator={handleAddTranslator}
          onRemoveTranslator={handleRemoveTranslator}
          onDuplicate={handleDuplicate}
          onEditDetails={handleEditDetails}
          onCompleteProject={handleCompleteProject}
          editingProjectId={editingProjectId}
          editFocusField={editFocusField}
          editWords={editWords}
          editLines={editLines}
          onEditWordsChange={setEditWords}
          onEditLinesChange={setEditLines}
          onStartWordsLinesEdit={handleStartWordsLinesEdit}
          onSaveWordsLines={handleSaveWordsLines}
          onCancelWordsLinesEdit={handleCancelWordsLinesEdit}
          isUpdatingWordsLines={updateWordsLinesMutation.isPending}
          onInstructionsClick={(project) =>
            setInstructionsDrawer({ open: true, project: { name: project.name, instructions: project.instructions, sap_instructions: project.sap_instructions } })
          }
        />
      }

      {/* Modals */}
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
        liveAssignedTranslatorIds={
          allProjects
            .find((p) => p.id === addTranslatorModal.projectId)
            ?.translators.map((t) => t.id) || []
        }
        onAddTranslators={(projectId, userIds, messages) =>
          addTranslatorsMutation.mutate({ projectId, userIds, messages })
        }
        isAdding={addTranslatorsMutation.isPending}
      />

      <RemoveTranslatorDialog
        open={removeTranslatorModal.open}
        onOpenChange={(open) =>
          setRemoveTranslatorModal({
            open,
            projectId: removeTranslatorModal.projectId,
            projectName: removeTranslatorModal.projectName,
            translators: removeTranslatorModal.translators,
          })
        }
        projectId={removeTranslatorModal.projectId}
        projectName={removeTranslatorModal.projectName}
        translators={removeTranslatorModal.translators}
        onRemoveTranslator={(projectId, userId) =>
          removeTranslatorMutation.mutate({ projectId, userId })
        }
        isRemoving={removeTranslatorMutation.isPending}
      />

      <ConfirmationDialog
        open={completeConfirmModal.open}
        onOpenChange={(open) =>
          setCompleteConfirmModal({
            open,
            projectId: completeConfirmModal.projectId,
            projectName: completeConfirmModal.projectName,
          })
        }
        title="Mark Project Complete"
        description={
          <>
            Are you sure you want to mark{" "}
            <span className="font-medium">
              {completeConfirmModal.projectName}
            </span>{" "}
            as complete? This action indicates the project is finished.
          </>
        }
        confirmText="Mark Complete"
        onConfirm={() =>
          markCompleteMutation.mutate(completeConfirmModal.projectId)
        }
        onCancel={() => {}}
        isLoading={markCompleteMutation.isPending}
      />

      {/* SAP Import Dialog */}
      <SapImportDialog
        open={sapImportDialogOpen}
        onOpenChange={setSapImportDialogOpen}
      />

      {/* Export CSV Dialog */}
      <ExportProjectsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      {/* Instructions Drawer */}
      <InstructionsDrawer
        open={instructionsDrawer.open}
        onOpenChange={(open) =>
          setInstructionsDrawer({ open, project: open ? instructionsDrawer.project : null })
        }
        project={instructionsDrawer.project}
      />

      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}













