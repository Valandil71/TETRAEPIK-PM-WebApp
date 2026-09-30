"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertCircle, Download, FileDown } from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import {
  formatSapImportCooldownMessage,
  useSapImportStatus,
} from "@/hooks/sap/useSapImportStatus";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { MultiSelectFilterDropdown } from "@/components/general/MultiSelectFilterDropdown";
import { ViewToggle } from "@/components/general/ViewToggle";
import { SearchBar } from "@/components/general/SearchBar";
import { ScrollToTopButton } from "@/components/general/ScrollToTopButton";
import { StatusTabs } from "@/components/general/StatusTabs";
import { Pagination } from "@/components/ui/pagination";
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
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import type { SapInstructionEntry } from "@/types/project";
import { groupProjectsForDisplay } from "@/lib/projectGrouping";
import {
  addCollaborators,
  invalidateCollaboratorQueries,
  removeCollaborator,
} from "@/lib/projects/collaborators";
import { createStmProject } from "@/lib/projects/stm";
import { useProjectGroupExpansion } from "@/hooks/project/useProjectGroupExpansion";
import { useProjectListPagination } from "@/hooks/project/useProjectListPagination";
import { useWindowScrollMemory } from "@/hooks/ui/useWindowScrollMemory";
import { useStickyHeaderOffset } from "@/hooks/ui/useStickyHeaderOffset";
import {
  restoreElementIntoView,
  restoreWindowScrollY,
} from "@/utils/scrollRestoration";

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
  const {
    data: sapImportStatus,
    refetch: refetchSapImportStatus,
  } = useSapImportStatus({ refetchInterval: 5000 });
  const queryClient = useQueryClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const isSapImportRunning = sapImportStatus?.status === "running";

  // Measure the sticky filter bar so the sticky table header can pin below it.
  const { ref: filtersRef, offset: headerOffset } = useStickyHeaderOffset();

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const handleOpenSapImportDialog = async () => {
    const latestStatus = await refetchSapImportStatus();
    const cooldown = latestStatus.data?.cooldown ?? sapImportStatus?.cooldown;

    if (cooldown?.isActive) {
      toast.info(formatSapImportCooldownMessage(cooldown), { duration: 6000 });
      return;
    }

    setSapImportDialogOpen(true);
  };

  // Persisted state via Zustand store
  const {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    currentPage: storedCurrentPage,
    setCurrentPage: setStoredCurrentPage,
    returnProjectId,
    shouldScrollToTop,
    scrollY: storedScrollY,
    filters: storedFilters,
    projectTypeFilterOverride,
    rememberReturnProject,
    clearReturnProject,
    clearScrollToTop,
    setScrollY: setStoredScrollY,
    setFilters: setStoredFilters,
    setProjectTypeFilterOverride,
  } = useManagementPageStore();
  const hasRestoredSessionScroll = useRef(false);
  useWindowScrollMemory({
    scrollY: storedScrollY,
    setScrollY: setStoredScrollY,
  });

  // State
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [creatingStmProjectId, setCreatingStmProjectId] = useState<number | null>(null);
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
  const sanitizeDigitsOnly = useCallback(
    (value: string) => value.replace(/[^\d]/g, ""),
    []
  );

  // Project type filter (page-specific, on top of shared filters).
  // null means "use the user's configured default"; [] means "cleared in this session".
  const { getFilter: getDefaultFilter, isFetched: defaultFiltersFetched } =
    useDefaultFilters(user?.id ?? null);

  const setProjectTypeFilter = useCallback(
    (values: string[]) => {
      setStoredCurrentPage(1);
      setProjectTypeFilterOverride(values);
    },
    [setProjectTypeFilterOverride, setStoredCurrentPage]
  );

  const resolvedProjectTypeFilter: string[] = useMemo(() => {
    if (projectTypeFilterOverride !== null) {
      return projectTypeFilterOverride;
    }
    if (defaultFiltersFetched) {
      const pt = getDefaultFilter("project_type");
      return pt?.included_values?.length ? pt.included_values : [];
    }
    return [];
  }, [projectTypeFilterOverride, defaultFiltersFetched, getDefaultFilter]);

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
  } = useProjectFilters(allProjects, {
    filters: storedFilters,
    onFiltersChange: setStoredFilters,
  });

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
    () => groupProjectsForDisplay(filteredProjects),
    [filteredProjects]
  );

  const {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems: paginatedProjectGroups,
    setCurrentPage,
  } = useProjectListPagination(groupedProjects, {
    currentPage: storedCurrentPage,
    onPageChange: setStoredCurrentPage,
  });

  useEffect(() => {
    if (projectsLoading) return;
    if (
      !shouldScrollToTop &&
      returnProjectId == null &&
      (hasRestoredSessionScroll.current || storedScrollY <= 0)
    ) {
      return;
    }

    let cleanupRestore: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      if (shouldScrollToTop) {
        cleanupRestore = restoreWindowScrollY(0);
        clearScrollToTop();
        hasRestoredSessionScroll.current = true;
        return;
      }

      if (returnProjectId == null) {
        cleanupRestore = restoreWindowScrollY(storedScrollY);
        hasRestoredSessionScroll.current = true;
        return;
      }

      const target = document.querySelector<HTMLElement>(
        `[data-management-project-id="${returnProjectId}"]`
      );
      if (target) cleanupRestore = restoreElementIntoView(target);
      clearReturnProject();
      hasRestoredSessionScroll.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      cleanupRestore?.();
    };
  }, [
    clearReturnProject,
    clearScrollToTop,
    projectsLoading,
    returnProjectId,
    shouldScrollToTop,
    storedScrollY,
    viewMode,
    paginatedProjectGroups,
  ]);

  const groupExpansionMode = useLayoutStore((state) => state.groupExpansionMode);

  const { expandedGroups, toggleGroup } =
    useProjectGroupExpansion({
      groups: paginatedProjectGroups,
      defaultExpanded: groupExpansionMode === "expandAll",
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
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.homeManageProjectsCount() });
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
      await addCollaborators(
        supabase,
        userIds.map((userId) => ({ projectId, userId, message: messages[userId] })),
        user?.id
      );
    },
    onSuccess: (_, { projectId, userIds }) => {
      invalidateCollaboratorQueries(queryClient, [projectId], userIds);
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

  const selfAssignMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: string }) => {
      // Assigning yourself makes the assignment start as "claimed"
      await addCollaborators(supabase, [{ projectId, userId }], userId);
    },
    onSuccess: (_, { projectId, userId }) => {
      invalidateCollaboratorQueries(queryClient, [projectId], [userId]);
      toast.success("Project assigned to you");
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
      await removeCollaborator(supabase, projectId, userId);
    },
    onSuccess: (_, { projectId, userId }) => {
      invalidateCollaboratorQueries(queryClient, [projectId], [userId]);
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

  const createStmProjectMutation = useMutation({
    mutationFn: (projectId: number) => createStmProject(supabase, projectId),
    onMutate: (projectId) => {
      setCreatingStmProjectId(projectId);
    },
    onSuccess: (newProject, projectId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      toast.success("STM project created successfully. Opening it now.");
      setOpenMenu(null);
      router.push(`/project/${newProject.id}`);
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "project creation"));
      setOpenMenu(null);
    },
    onSettled: () => {
      setCreatingStmProjectId(null);
    },
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
    const wordsInput = editWords.trim();
    const linesInput = editLines.trim();

    if (
      (wordsInput !== "" && !/^\d+$/.test(wordsInput)) ||
      (linesInput !== "" && !/^\d+$/.test(linesInput))
    ) {
      toast.error("Words and Lines must contain only numbers.");
      return;
    }

    const words = wordsInput === "" ? null : Number.parseInt(wordsInput, 10);
    const lines = linesInput === "" ? null : Number.parseInt(linesInput, 10);
    updateWordsLinesMutation.mutate({ projectId, words, lines });
  };

  const handleEditWordsChange = useCallback(
    (value: string) => setEditWords(sanitizeDigitsOnly(value)),
    [sanitizeDigitsOnly]
  );

  const handleEditLinesChange = useCallback(
    (value: string) => setEditLines(sanitizeDigitsOnly(value)),
    [sanitizeDigitsOnly]
  );

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

  const handleSelfAssign = (projectId: number) => {
    setOpenMenu(null);
    if (!user) return;
    const project = allProjects.find((p) => p.id === projectId);
    if (project?.translators.some((t) => t.id === user.id)) {
      toast.info("You are already assigned to this project");
      return;
    }
    selfAssignMutation.mutate({ projectId, userId: user.id });
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

  const handleCreateStmProject = (projectId: number) => {
    createStmProjectMutation.mutate(projectId);
  };

  const handleEditDetails = (projectId: number) => {
    rememberReturnProject(projectId);
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
    setStoredCurrentPage(1);
    baseClearFilters();
    setProjectTypeFilterOverride([]);
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
            onClick={handleOpenSapImportDialog}
            disabled={isSapImportRunning}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {isSapImportRunning ? "SAP Import Running..." : "Import from SAP"}
          </Button>
        </div>
      </div>

      {/* Tabs + View Toggle + Search + Filters - Sticky Header */}
      <div
        ref={filtersRef}
        className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 backdrop-blur-sm shadow-md mb-6 pt-4 pb-4 -mx-8 px-8"
      >
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
            onChange={(value) => {
              setStoredCurrentPage(1);
              setSearchTerm(value);
            }}
            placeholder="Search by project name"
          />

          {/* Individual Filter Dropdowns */}
          <div className="flex justify-between items-start gap-3">
            <div className="flex flex-wrap gap-3 items-start">
              <FilterDropdown
                label="System"
                options={uniqueSystems}
                selected={systemFilter}
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setSystemFilter(value);
                }}
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
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setDueDateFilter(value);
                }}
                customDateValue={customDueDate}
                onCustomDateChange={(value) => {
                  setStoredCurrentPage(1);
                  setCustomDueDate(value);
                }}
              />
              <FilterDropdown
                label="Assignment Status"
                options={["Unassigned", "Assigned"]}
                selected={assignmentStatusFilter}
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setAssignmentStatusFilter(value);
                }}
              />
              <FilterDropdown
                label="Source Language"
                options={uniqueSourceLangs}
                selected={sourceLangFilter}
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setSourceLangFilter(value);
                }}
              />
              <FilterDropdown
                label="Target Language"
                options={uniqueTargetLangs}
                selected={targetLangFilter}
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setTargetLangFilter(value);
                }}
              />
              <FilterDropdown
                label="Length"
                options={["Short", "Long"]}
                selected={lengthFilter}
                onSelect={(value) => {
                  setStoredCurrentPage(1);
                  setLengthFilter(value);
                }}
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
          groups={paginatedProjectGroups}
          headerOffset={headerOffset}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          openMenu={openMenu}
          onMenuToggle={setOpenMenu}
          onAddTranslator={handleAddTranslator}
          onSelfAssign={handleSelfAssign}
          onRemoveTranslator={handleRemoveTranslator}
          onCreateStmProject={handleCreateStmProject}
          creatingStmProjectId={creatingStmProjectId}
          isCreatingStmProject={createStmProjectMutation.isPending}
          onEditDetails={handleEditDetails}
          onCompleteProject={handleCompleteProject}
          editingProjectId={editingProjectId}
          editFocusField={editFocusField}
          editWords={editWords}
          editLines={editLines}
          onEditWordsChange={handleEditWordsChange}
          onEditLinesChange={handleEditLinesChange}
          onStartWordsLinesEdit={handleStartWordsLinesEdit}
          onSaveWordsLines={handleSaveWordsLines}
          onCancelWordsLinesEdit={handleCancelWordsLinesEdit}
          isUpdatingWordsLines={updateWordsLinesMutation.isPending}
          onInstructionsClick={(project) =>
            setInstructionsDrawer({ open: true, project: { name: project.name, instructions: project.instructions, sap_instructions: project.sap_instructions } })
          }
        />
      : <ManagementCard
          groups={paginatedProjectGroups}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          openMenu={openMenu}
          onMenuToggle={setOpenMenu}
          onAddTranslator={handleAddTranslator}
          onSelfAssign={handleSelfAssign}
          onRemoveTranslator={handleRemoveTranslator}
          onCreateStmProject={handleCreateStmProject}
          creatingStmProjectId={creatingStmProjectId}
          isCreatingStmProject={createStmProjectMutation.isPending}
          onEditDetails={handleEditDetails}
          onCompleteProject={handleCompleteProject}
          editingProjectId={editingProjectId}
          editFocusField={editFocusField}
          editWords={editWords}
          editLines={editLines}
          onEditWordsChange={handleEditWordsChange}
          onEditLinesChange={handleEditLinesChange}
          onStartWordsLinesEdit={handleStartWordsLinesEdit}
          onSaveWordsLines={handleSaveWordsLines}
          onCancelWordsLinesEdit={handleCancelWordsLinesEdit}
          isUpdatingWordsLines={updateWordsLinesMutation.isPending}
          onInstructionsClick={(project) =>
            setInstructionsDrawer({ open: true, project: { name: project.name, instructions: project.instructions, sap_instructions: project.sap_instructions } })
          }
        />
      }

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700"
      />

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













