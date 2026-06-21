"use client";

import { useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useProjectFilters } from "@/hooks/project/useProjectFilters";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { ViewToggle } from "@/components/general/ViewToggle";
import { SearchBar } from "@/components/general/SearchBar";
import { ScrollToTopButton } from "@/components/general/ScrollToTopButton";
import { Pagination } from "@/components/ui/pagination";
import { ConcludedTable } from "@/components/concluded/ConcludedTable";
import { ConcludedCard } from "@/components/concluded/ConcludedCard";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RouteId } from "@/lib/roleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import { useConcludedProjectsPageStore } from "@/lib/stores/useConcludedProjectsPageStore";
import {
  compareProjectsByClosestDeadline,
  groupProjectsForDisplay,
} from "@/lib/projectGrouping";
import { useProjectGroupExpansion } from "@/hooks/project/useProjectGroupExpansion";
import { useProjectListPagination } from "@/hooks/project/useProjectListPagination";
import { useWindowScrollMemory } from "@/hooks/ui/useWindowScrollMemory";
import { useStickyHeaderOffset } from "@/hooks/ui/useStickyHeaderOffset";
import { restoreWindowScrollY } from "@/utils/scrollRestoration";

export default function ConcludedProjectsPage() {
  return (
    <RoleGuard routeId={RouteId.CONCLUDED_PROJECTS}>
      <ConcludedProjectsContent />
    </RoleGuard>
  );
}

function ConcludedProjectsContent() {
  const router = useRouter();
  const { loading: userLoading } = useUser();
  const groupExpansionMode = useLayoutStore((state) => state.groupExpansionMode);

  const {
    viewMode,
    setViewMode,
    currentPage: storedCurrentPage,
    setCurrentPage: setStoredCurrentPage,
    scrollY: storedScrollY,
    setScrollY: setStoredScrollY,
    filters: storedFilters,
    setFilters: setStoredFilters,
  } = useConcludedProjectsPageStore();

  const hasRestoredSessionScroll = useRef(false);
  useWindowScrollMemory({
    scrollY: storedScrollY,
    setScrollY: setStoredScrollY,
  });

  // Measure the sticky filter bar so the sticky table header pins below it.
  const { ref: filtersRef, offset: headerOffset } = useStickyHeaderOffset();

  // Fetch all projects (includeAllStatuses) and keep only completed ones.
  const {
    data: projectsData = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectsWithTranslators(false, true, true);

  const completedProjects = useMemo(
    () => projectsData.filter((p) => p.status === "complete"),
    [projectsData]
  );

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
    hasActiveFilters,
    clearFilters,
    applyBaseFilters,
  } = useProjectFilters(completedProjects, {
    filters: storedFilters,
    onFiltersChange: setStoredFilters,
  });

  const filteredProjects = useMemo(() => {
    const projects = applyBaseFilters([...completedProjects]);
    return projects.sort(compareProjectsByClosestDeadline);
  }, [completedProjects, applyBaseFilters]);

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

  const loading = userLoading || projectsLoading;

  useEffect(() => {
    if (loading || hasRestoredSessionScroll.current || storedScrollY <= 0) {
      return;
    }

    let cleanupRestore: (() => void) | undefined;
    const timeout = window.setTimeout(() => {
      cleanupRestore = restoreWindowScrollY(storedScrollY);
      hasRestoredSessionScroll.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      cleanupRestore?.();
    };
  }, [loading, storedScrollY]);

  const { expandedGroups, toggleGroup } = useProjectGroupExpansion({
    groups: paginatedProjectGroups,
    defaultExpanded: groupExpansionMode === "expandAll",
  });

  const handleRowClick = (id: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    router.push(`/project/${id}`);
  };

  const clearAllFilters = () => {
    setStoredCurrentPage(1);
    clearFilters();
  };

  if (loading) {
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
        <h1 className="text-gray-900 dark:text-white mb-2">Concluded Projects</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Browse projects that have been marked as complete
        </p>
      </div>

      {/* View Toggle + Search + Filters - Sticky Header */}
      <div
        ref={filtersRef}
        className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 backdrop-blur-sm shadow-md mb-6 pt-4 pb-4 -mx-8 px-8"
      >
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700 pb-3">
          <div className="flex items-end justify-end">
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                View
              </span>
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SearchBar
            value={searchTerm}
            onChange={(value) => {
              setStoredCurrentPage(1);
              setSearchTerm(value);
            }}
            placeholder="Search by project name"
          />

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
      {viewMode === "table" ? (
        <ConcludedTable
          groups={paginatedProjectGroups}
          headerOffset={headerOffset}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onRowClick={handleRowClick}
        />
      ) : (
        <ConcludedCard
          groups={paginatedProjectGroups}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onCardClick={handleRowClick}
        />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700"
      />

      <ScrollToTopButton />
    </div>
  );
}
