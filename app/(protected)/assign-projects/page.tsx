"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { SearchBar } from "@/components/general/SearchBar";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { MultiSelectFilterDropdown } from "@/components/general/MultiSelectFilterDropdown";
import { ViewToggle } from "@/components/general/ViewToggle";
import { ScrollToTopButton } from "@/components/general/ScrollToTopButton";
import { ProjectAssignTable } from "@/components/assign/ProjectAssignTable";
import { ProjectAssignCard } from "@/components/assign/ProjectAssignCard";
import {
  TranslatorSelectionView,
  type ProjectAssignmentData,
} from "@/components/assign/TranslatorSelectionView";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RouteId } from "@/lib/roleAccess";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useProjectFilters } from "@/hooks/project/useProjectFilters";
import { createBrowserClient } from "@supabase/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import { useUser } from "@/hooks/user/useUser";
import { useDefaultFilters } from "@/hooks/settings/useDefaultFilters";
import {
  getGroupSelectionState,
  groupProjectsByExactName,
} from "@/lib/projectGrouping";
import { useProjectGroupExpansion } from "@/hooks/project/useProjectGroupExpansion";

const ASSIGN_SELECTION_STORAGE_KEY = "assign-projects:selected-project-ids";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
};
export default function AssignProjectsPage() {
  return (
    <RoleGuard routeId={RouteId.ASSIGN_PROJECTS}>
      <AssignProjectsContent />
    </RoleGuard>
  );
}

function AssignProjectsContent() {
  const { data: allProjects = [], isLoading: projectsLoading } =
    useProjectsWithTranslators(false, true);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const collapsed = useLayoutStore((state) => state.collapsed);

  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();

    try {
      const rawStoredSelection = window.localStorage.getItem(
        ASSIGN_SELECTION_STORAGE_KEY
      );
      if (!rawStoredSelection) return new Set();

      const parsedSelection = JSON.parse(rawStoredSelection);
      if (!Array.isArray(parsedSelection)) return new Set();

      const validSelection = parsedSelection
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      return new Set(validSelection);
    } catch {
      window.localStorage.removeItem(ASSIGN_SELECTION_STORAGE_KEY);
      return new Set();
    }
  });
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Page-specific filter states
  const [assignmentFilter, setAssignmentFilter] = useState<string | null>(
    "Unassigned"
  );
  // Project type filter — override is tagged with pathname so it auto-expires on navigation
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

  // Shared filter state + logic
  const {
    searchTerm, setSearchTerm,
    systemFilter, setSystemFilter,
    dueDateFilter, setDueDateFilter,
    customDueDate, setCustomDueDate,
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const loading = projectsLoading;
  useEffect(() => {
    if (typeof window === "undefined") return;

    const selectionArray = Array.from(selectedProjects);
    if (selectionArray.length === 0) {
      window.localStorage.removeItem(ASSIGN_SELECTION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      ASSIGN_SELECTION_STORAGE_KEY,
      JSON.stringify(selectionArray)
    );
  }, [selectedProjects]);
  const clearAllFilters = () => {
    baseClearFilters();
    setAssignmentFilter(null);
    setProjectTypeFilter([]);
  };

  const hasActiveFilters = baseHasActiveFilters || !!assignmentFilter || resolvedProjectTypeFilter.length > 0;

  // Filtering logic: shared base filters + page-specific filters
  const filteredProjects = useMemo(() => {
    // Apply shared base filters (search, system, dueDate, langs, length)
    let projects = applyBaseFilters(allProjects);

    // Page-specific: assignment status filter
    if (assignmentFilter === "Unassigned") {
      projects = projects.filter((p) => !p.translators || p.translators.length === 0);
    } else if (assignmentFilter === "Assigned") {
      projects = projects.filter((p) => p.translators && p.translators.length > 0);
    }

    // Page-specific: project type filter
    if (resolvedProjectTypeFilter.length > 0) {
      projects = projects.filter(
        (p) => p.project_type && resolvedProjectTypeFilter.includes(p.project_type)
      );
    }

    return projects;
  }, [allProjects, applyBaseFilters, assignmentFilter, resolvedProjectTypeFilter]);

  const groupedProjects = useMemo(
    () => groupProjectsByExactName(filteredProjects),
    [filteredProjects]
  );

  const { expandedGroups, toggleGroup, expandGroup, expandAll, collapseAll } =
    useProjectGroupExpansion({
      groups: groupedProjects,
      defaultExpanded: false,
    });

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

  const handleConfirmSelection = useCallback(() => {
    if (selectedProjects.size > 0) {
      setShowUserSelection(true);
    }
  }, [selectedProjects.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedProjects(new Set());
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showUserSelection || selectedProjects.size === 0) return;
      if (event.isComposing || isTypingTarget(event.target)) return;

      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirmSelection();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showUserSelection,
    selectedProjects.size,
    handleConfirmSelection,
    handleClearSelection,
  ]);

  // Assignment mutation - handles per-project translator assignments
  const assignMutation = useMutation({
    mutationFn: async ({
      assignments,
    }: {
      assignments: Map<number, ProjectAssignmentData>;
    }) => {
      // Create assignments for each project with its specific translators
      const dbAssignments: Array<{
        project_id: number;
        user_id: string;
        assignment_status: string;
        initial_message: string | null;
      }> = [];

      assignments.forEach((data, projectId) => {
        data.translatorIds.forEach((translatorId) => {
          dbAssignments.push({
            project_id: projectId,
            user_id: translatorId,
            assignment_status: translatorId === user?.id ? "claimed" : "unclaimed",
            initial_message: data.messages[translatorId] || null,
          });
        });
      });

      if (dbAssignments.length === 0) {
        throw new Error("No assignments to create");
      }

      const { error } = await supabase
        .from("projects_assignment")
        .insert(dbAssignments);

      if (error) {
        throw new Error(`Failed to assign projects: ${error.message}`);
      }

      return {
        projectCount: assignments.size,
        assignmentCount: dbAssignments.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectsWithTranslators(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      toast.success(
        `Successfully created ${result.assignmentCount} assignment${result.assignmentCount !== 1 ? "s" : ""} across ${result.projectCount} project${result.projectCount !== 1 ? "s" : ""}.`
      );
      setShowUserSelection(false);
      setSelectedProjects(new Set());
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "project assignment"));
    },
  });

  const handleAssign = (assignments: Map<number, ProjectAssignmentData>) => {
    assignMutation.mutate({ assignments });
  };

  const selectedProjectsList = allProjects.filter((p) =>
    selectedProjects.has(p.id)
  );

  if (loading) {
    return (
      <div className="p-8 max-w-screen-2xl mx-auto">
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // --- USER SELECTION VIEW ---
  if (showUserSelection) {
    return (
      <TranslatorSelectionView
        selectedProjects={selectedProjectsList}
        onCancel={() => {
          setShowUserSelection(false);
        }}
        onAssign={handleAssign}
      />
    );
  }

  // --- PROJECT SELECTION VIEW ---
  return (
    <div className="p-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">Assign Projects</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Select one or more projects and assign them to a collaborator
        </p>
      </div>

      {/* Search and Filters - Sticky Header */}
      <div className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 backdrop-blur-sm shadow-md mb-6 pt-4 pb-4 -mx-8 px-8 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by project name"
          />

          <div className="flex flex-col gap-1 items-center">
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              View
            </span>
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
          </div>
        </div>

        {/* Individual Filter Dropdowns */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-wrap gap-3 items-start">
            <FilterDropdown
              label="Assignment Status"
              options={["Unassigned", "Assigned"]}
              selected={assignmentFilter}
              onSelect={setAssignmentFilter}
            />
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

      {/* Table or Card View */}
      {viewMode === "table" ?
        <ProjectAssignTable
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          selectedProjects={selectedProjects}
          onToggleProject={handleSelection}
          onToggleGroupSelection={handleGroupSelection}
          onRowClick={handleSelection}
        />
      : <ProjectAssignCard
          groups={groupedProjects}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          selectedProjects={selectedProjects}
          onToggleProject={handleSelection}
          onToggleGroupSelection={handleGroupSelection}
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
                onClick={handleClearSelection}
                className="px-4 py-2 cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-800"
                type="button"
              >
                Clear selection
              </button>
            </div>
            <button
              onClick={handleConfirmSelection}
              className="px-6 py-3 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm"
              type="button"
            >
              Continue with {selectedProjects.size} project
              {selectedProjects.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}








