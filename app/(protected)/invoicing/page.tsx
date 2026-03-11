"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useProjectFilters } from "@/hooks/project/useProjectFilters";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { ViewToggle } from "@/components/general/ViewToggle";
import { SearchBar } from "@/components/general/SearchBar";
import { StatusTabs } from "@/components/general/StatusTabs";
import { InvoicingTable } from "@/components/invoicing/InvoicingTable";
import { InvoicingCard } from "@/components/invoicing/InvoicingCard";
import { ConfirmationDialog } from "@/components/management/ConfirmationDialog";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RouteId } from "@/lib/roleAccess";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserClient } from "@supabase/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import {
  getGroupSelectionState,
  groupProjectsByExactName,
} from "@/lib/projectGrouping";
import { useProjectGroupExpansion } from "@/hooks/project/useProjectGroupExpansion";

type TabType = "all" | "toBeInvoiced" | "toBePaid";
type ViewMode = "table" | "card";
type ConfirmActionType = "invoiced" | "paid" | "paidAndInvoiced" | null;

export default function InvoicingPage() {
  return (
    <RoleGuard routeId={RouteId.INVOICING}>
      <InvoicingContent />
    </RoleGuard>
  );
}

function InvoicingContent() {
  const { loading: userLoading } = useUser();
  const queryClient = useQueryClient();
  const collapsed = useLayoutStore((state) => state.collapsed);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // State
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(
    new Set()
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmActionType>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Page-specific filter states
  const [hideFullyProcessed, setHideFullyProcessed] = useState<boolean>(true);

  // Fetch all projects
  const {
    data: projectsData = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectsWithTranslators(false, true, true);

  // Filter to only show complete projects in invoicing
  const allProjectsRaw = useMemo(
    () => projectsData.filter((p) => p.status === "complete"),
    [projectsData]
  );

  // Common filters from hook
  const {
    searchTerm,
    setSearchTerm,
    systemFilter,
    setSystemFilter,
    dueDateFilter,
    setDueDateFilter,
    customDueDate,
    setCustomDueDate,
    assignmentStatusFilter,
    setAssignmentStatusFilter,
    sourceLangFilter,
    setSourceLangFilter,
    targetLangFilter,
    setTargetLangFilter,
    lengthFilter,
    setLengthFilter,
    uniqueSystems,
    uniqueSourceLangs,
    uniqueTargetLangs,
    hasActiveFilters: baseHasActiveFilters,
    clearFilters: baseClearFilters,
    applyBaseFilters,
  } = useProjectFilters(allProjectsRaw);

  // Get closest deadline for a project
  const getClosestDeadline = useCallback((project: (typeof allProjectsRaw)[0]) => {
    const deadlines = [
      project.final_deadline,
      project.interim_deadline,
      project.initial_deadline,
    ]
      .filter(Boolean)
      .map((d) => {
        const date = new Date(d!);
        return isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean) as Date[];

    if (deadlines.length === 0) return null;
    return new Date(Math.min(...deadlines.map((d) => d.getTime())));
  }, []);

  // Categorize projects by invoicing status
  const categorizedProjects = useMemo(() => {
    const toBeInvoiced: typeof allProjectsRaw = [];
    const toBePaid: typeof allProjectsRaw = [];

    allProjectsRaw.forEach((project) => {
      if (!project.invoiced) {
        toBeInvoiced.push(project);
      } else if (project.invoiced && !project.paid) {
        toBePaid.push(project);
      }
    });

    return { toBeInvoiced, toBePaid };
  }, [allProjectsRaw]);

  // Create tabs
  const tabs = useMemo(
    () => [
      {
        id: "all" as const,
        label: "All Projects",
        count: allProjectsRaw.length,
      },
      {
        id: "toBeInvoiced" as const,
        label: "To be Invoiced",
        count: categorizedProjects.toBeInvoiced.length,
      },
      {
        id: "toBePaid" as const,
        label: "To Be Paid",
        count: categorizedProjects.toBePaid.length,
      },
    ],
    [allProjectsRaw, categorizedProjects]
  );

  // Filter projects
  const filteredProjects = useMemo(() => {
    let projects = [...allProjectsRaw];

    // Tab filter (page-specific)
    if (activeTab === "toBeInvoiced") {
      projects = projects.filter((p) => !p.invoiced);
    } else if (activeTab === "toBePaid") {
      projects = projects.filter((p) => p.invoiced && !p.paid);
    }

    // Hide fully processed (invoiced + paid) filter (page-specific)
    if (hideFullyProcessed) {
      projects = projects.filter((p) => !(p.invoiced && p.paid));
    }

    // Apply the 7 common filters via the hook
    projects = applyBaseFilters(projects);

    // Sort: projects that are both invoiced AND paid go to the end, then by due date
    return projects.sort((a, b) => {
      const aFullyProcessed = a.invoiced && a.paid;
      const bFullyProcessed = b.invoiced && b.paid;

      // Put fully processed (invoiced + paid) projects at the end
      if (aFullyProcessed && !bFullyProcessed) return 1;
      if (!aFullyProcessed && bFullyProcessed) return -1;

      // Within the same group, sort by due date (earliest first)
      const dateA = getClosestDeadline(a);
      const dateB = getClosestDeadline(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
  }, [
    allProjectsRaw,
    activeTab,
    hideFullyProcessed,
    applyBaseFilters,
    getClosestDeadline,
  ]);

  const groupedProjects = useMemo(
    () => groupProjectsByExactName(filteredProjects),
    [filteredProjects]
  );

  const selectedProjectRecords = useMemo(
    () => allProjectsRaw.filter((project) => selectedProjects.has(project.id)),
    [allProjectsRaw, selectedProjects]
  );

  const hasSelectedUninvoiced = selectedProjectRecords.some(
    (project) => !project.invoiced
  );
  const hasSelectedUnpaid = selectedProjectRecords.some(
    (project) => !project.paid
  );

  const showConfirmInvoicedAction =
    activeTab === "toBeInvoiced" ||
    (activeTab === "all" && hasSelectedUninvoiced);
  const showConfirmPaidAndInvoicedAction =
    activeTab === "all" && hasSelectedUninvoiced;
  const showConfirmPaidAction =
    activeTab === "toBePaid" || (activeTab === "all" && hasSelectedUnpaid);

  const { expandedGroups, toggleGroup, expandGroup, expandAll, collapseAll } =
    useProjectGroupExpansion({
      groups: groupedProjects,
      defaultExpanded: false,
    });

  // Mutations
  const markInvoicedMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      const { error } = await supabase
        .from("projects")
        .update({ invoiced: true })
        .in("id", projectIds);

      if (error)
        throw new Error(
          `Failed to mark projects as invoiced: ${error.message}`
        );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      toast.success("Projects marked as invoiced");
      setSelectedProjects(new Set());
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "invoicing")),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      const { error } = await supabase
        .from("projects")
        .update({ paid: true })
        .in("id", projectIds);

      if (error)
        throw new Error(`Failed to mark projects as paid: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      toast.success("Projects marked as paid");
      setSelectedProjects(new Set());
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "invoicing")),
  });

  const markPaidAndInvoicedMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      const { error } = await supabase
        .from("projects")
        .update({ paid: true, invoiced: true })
        .in("id", projectIds);

      if (error)
        throw new Error(
          `Failed to mark projects as paid & invoiced: ${error.message}`
        );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      toast.success("Projects marked as paid & invoiced");
      setSelectedProjects(new Set());
    },
    onError: (error: Error) =>
      toast.error(getUserFriendlyError(error, "invoicing")),
  });

  // Handlers
  const handleRowClick = (id: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" &&
      target.getAttribute("type") === "checkbox"
    ) {
      return;
    }
    handleSelection(id);
  };

  const handleSelection = (projectId: number) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  const handleGroupSelection = (groupKey: string) => {
    const group = groupedProjects.find((g) => g.key === groupKey);
    if (!group) return;

    const groupProjectIds = group.projects.map((project) => project.id);
    const groupState = getGroupSelectionState(groupProjectIds, selectedProjects);

    const nextSelection = new Set(selectedProjects);
    if (groupState === "checked") {
      groupProjectIds.forEach((id) => nextSelection.delete(id));
    } else {
      groupProjectIds.forEach((id) => nextSelection.add(id));
      if (group.projects.length > 1) {
        expandGroup(group.key);
      }
    }
    setSelectedProjects(nextSelection);
  };

  const openConfirmDialog = (action: Exclude<ConfirmActionType, null>) => {
    if (selectedProjects.size === 0) return;
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  const handleDialogConfirm = () => {
    if (selectedProjects.size === 0 || !confirmAction) return;

    const projectIds = Array.from(selectedProjects);
    if (confirmAction === "invoiced") {
      markInvoicedMutation.mutate(projectIds);
      return;
    }

    if (confirmAction === "paid") {
      markPaidMutation.mutate(projectIds);
      return;
    }

    markPaidAndInvoicedMutation.mutate(projectIds);
  };

  const handleDialogCancel = () => {
    setConfirmDialogOpen(false);
    setConfirmAction(null);
  };

  const confirmDialogTitle =
    confirmAction === "invoiced" ? "Confirm Invoiced"
    : confirmAction === "paid" ? "Confirm Paid"
    : "Confirm Paid & Invoiced";

  const confirmDialogDescription =
    confirmAction === "invoiced" ?
      `Are you sure you want to mark ${selectedProjects.size} selected project${
        selectedProjects.size !== 1 ? "s" : ""
      } as invoiced?`
    : confirmAction === "paid" ?
      `Are you sure you want to mark ${selectedProjects.size} selected project${
        selectedProjects.size !== 1 ? "s" : ""
      } as paid?`
    : `Are you sure you want to mark ${selectedProjects.size} selected project${
        selectedProjects.size !== 1 ? "s" : ""
      } as paid and invoiced?`;

  const confirmDialogConfirmText =
    confirmAction === "invoiced" ? "Confirm Invoiced"
    : confirmAction === "paid" ? "Confirm Paid"
    : "Confirm Paid & Invoiced";

  const confirmDialogLoading =
    (confirmAction === "invoiced" && markInvoicedMutation.isPending) ||
    (confirmAction === "paid" && markPaidMutation.isPending) ||
    (confirmAction === "paidAndInvoiced" &&
      markPaidAndInvoicedMutation.isPending);

  const clearAllFilters = () => {
    baseClearFilters();
    setHideFullyProcessed(true);
  };

  const hasActiveFilters = baseHasActiveFilters || !hideFullyProcessed;

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
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Invoicing & Payments
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Track and manage invoicing and payment status for all projects
        </p>
      </div>

      {/* Tabs + View Toggle + Search + Filters - Sticky Header */}
      <div className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 backdrop-blur-sm shadow-md mb-6 pt-4 pb-4 -mx-8 px-8">
        {/* Tabs + View Toggle */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-end justify-between">
            <StatusTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                setSelectedProjects(new Set());
              }}
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
              {/* Toggle for showing fully processed projects */}
              <button
                onClick={() => setHideFullyProcessed(!hideFullyProcessed)}
                className={`px-4 py-2 cursor-pointer rounded-lg border text-sm transition-all flex items-center gap-2 ${
                  hideFullyProcessed ?
                    "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500"
                  : "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                }`}
                type="button"
              >
                <span
                  className={`w-3 h-3 rounded-sm border ${
                    hideFullyProcessed ?
                      "border-gray-400 dark:border-gray-500"
                    : "border-blue-500 bg-blue-500"
                  }`}
                >
                  {!hideFullyProcessed && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="M10 3L4.5 8.5 2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                Show Invoiced/Paid
              </button>
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
        <InvoicingTable
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          selectedProjects={selectedProjects}
          onRowClick={handleRowClick}
          onSelection={handleSelection}
          onGroupSelection={handleGroupSelection}
        />
      : <InvoicingCard
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          selectedProjects={selectedProjects}
          onSelection={handleSelection}
          onGroupSelection={handleGroupSelection}
        />
      }

      {/* Confirm Button Bar */}
      {selectedProjects.size > 0 && (
        <div
          className={`fixed bottom-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 transition-all duration-300 ${
            collapsed ? "left-20" : "left-52"
          }`}
        >
          <div className="max-w-screen-2xl mx-auto px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-gray-900 dark:text-white">
                <span className="font-semibold">{selectedProjects.size}</span>{" "}
                project{selectedProjects.size !== 1 ? "s" : ""} selected
              </div>
              <button
                onClick={() => setSelectedProjects(new Set())}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-800"
                type="button"
              >
                Clear selection
              </button>
            </div>
            <div className="flex gap-3">
              {showConfirmInvoicedAction && (
                <button
                  onClick={() => openConfirmDialog("invoiced")}
                  disabled={markInvoicedMutation.isPending}
                  className="px-6 py-3 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {markInvoicedMutation.isPending ?
                    "Processing..."
                  : "Confirm Invoiced"}
                </button>
              )}
              {showConfirmPaidAndInvoicedAction && (
                <button
                  onClick={() => openConfirmDialog("paidAndInvoiced")}
                  disabled={markPaidAndInvoicedMutation.isPending}
                  className="px-6 py-3 cursor-pointer bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {markPaidAndInvoicedMutation.isPending ?
                    "Processing..."
                  : "Confirm Paid & Invoiced"}
                </button>
              )}
              {showConfirmPaidAction && (
                <button
                  onClick={() => openConfirmDialog("paid")}
                  disabled={markPaidMutation.isPending}
                  className="px-6 py-3 cursor-pointer bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {markPaidMutation.isPending ?
                    "Processing..."
                  : "Confirm Paid"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          setConfirmDialogOpen(open);
          if (!open) setConfirmAction(null);
        }}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
        confirmText={confirmDialogConfirmText}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
        isLoading={confirmDialogLoading}
        variant="success"
      />
    </div>
  );
}
