"use client";

import { useState, useMemo, useCallback, useDeferredValue } from "react";
import {
  matchesDueDateFilter,
  matchesLengthFilter,
} from "@/utils/filterHelpers";
import {
  createDefaultProjectFilterState,
  type ProjectFilterState,
  type ProjectFilterUpdate,
} from "@/lib/projectFilterState";

/** Minimal project shape required by the filter logic */
interface FilterableProject {
  name: string;
  system: string;
  language_in: string | null;
  language_out: string | null;
  words: number | null;
  lines: number | null;
  initial_deadline: string | null;
  interim_deadline: string | null;
  final_deadline: string | null;
  project_type?: string | null;
  translators: { assignment_status: string }[];
}

interface UseProjectFiltersOptions {
  filters?: ProjectFilterState;
  onFiltersChange?: (filters: ProjectFilterUpdate) => void;
}

export function useProjectFilters<T extends FilterableProject>(
  projects: T[],
  options?: UseProjectFiltersOptions
) {
  const [uncontrolledFilters, setUncontrolledFilters] =
    useState<ProjectFilterState>(() => createDefaultProjectFilterState());
  const filters = options?.filters ?? uncontrolledFilters;
  const setFilters = options?.onFiltersChange ?? setUncontrolledFilters;
  const {
    searchTerm,
    systemFilter,
    dueDateFilter,
    customDueDate,
    assignmentStatusFilter,
    sourceLangFilter,
    targetLangFilter,
    lengthFilter,
  } = filters;
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const updateFilter = useCallback(
    <K extends keyof ProjectFilterState>(
      key: K,
      value: ProjectFilterState[K]
    ) => {
      setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
    },
    [setFilters]
  );

  const setSearchTerm = useCallback(
    (value: string) => updateFilter("searchTerm", value),
    [updateFilter]
  );
  const setSystemFilter = useCallback(
    (value: string | null) => updateFilter("systemFilter", value),
    [updateFilter]
  );
  const setDueDateFilter = useCallback(
    (value: string | null) => updateFilter("dueDateFilter", value),
    [updateFilter]
  );
  const setCustomDueDate = useCallback(
    (value: string) => updateFilter("customDueDate", value),
    [updateFilter]
  );
  const setAssignmentStatusFilter = useCallback(
    (value: string | null) => updateFilter("assignmentStatusFilter", value),
    [updateFilter]
  );
  const setSourceLangFilter = useCallback(
    (value: string | null) => updateFilter("sourceLangFilter", value),
    [updateFilter]
  );
  const setTargetLangFilter = useCallback(
    (value: string | null) => updateFilter("targetLangFilter", value),
    [updateFilter]
  );
  const setLengthFilter = useCallback(
    (value: string | null) => updateFilter("lengthFilter", value),
    [updateFilter]
  );

  // Derived unique values for dropdowns
  const uniqueSystems = useMemo(() => {
    const systems = new Set(projects.map((p) => p.system).filter(Boolean));
    return Array.from(systems).sort();
  }, [projects]);

  const uniqueSourceLangs = useMemo(() => {
    const langs = new Set<string>();
    projects.forEach((p) => {
      if (p.language_in) langs.add(p.language_in);
    });
    return Array.from(langs).sort();
  }, [projects]);

  const uniqueTargetLangs = useMemo(() => {
    const langs = new Set<string>();
    projects.forEach((p) => {
      if (p.language_out) langs.add(p.language_out);
    });
    return Array.from(langs).sort();
  }, [projects]);

  const uniqueProjectTypes = useMemo(() => {
    const types = new Set<string>();
    projects.forEach((p) => {
      if (p.project_type) types.add(p.project_type);
    });
    return Array.from(types).sort();
  }, [projects]);

  const clearFilters = useCallback(() => {
    setFilters(createDefaultProjectFilterState());
  }, [setFilters]);

  const hasActiveFilters =
    !!deferredSearchTerm ||
    !!systemFilter ||
    !!dueDateFilter ||
    !!assignmentStatusFilter ||
    !!sourceLangFilter ||
    !!targetLangFilter ||
    !!lengthFilter;

  /**
   * Applies the 7 common filters (search, system, dueDate, assignmentStatus,
   * sourceLang, targetLang, length) and sorts by deadline (earliest first).
   *
   * Page-specific filters (tab, projectType, hideFullyProcessed, etc.)
   * should be applied by the caller before or after this.
   */
  const applyBaseFilters = useCallback(
    (items: T[]): T[] => {
      let filtered = items;

      // Search filter
      if (deferredSearchTerm) {
        const term = deferredSearchTerm.toLowerCase();
        filtered = filtered.filter((p) =>
          p.name.toLowerCase().includes(term)
        );
      }

      // System filter
      if (systemFilter) {
        filtered = filtered.filter((p) => p.system === systemFilter);
      }

      // Due date filter
      if (dueDateFilter) {
        filtered = filtered.filter((p) => {
          const deadline =
            p.final_deadline || p.interim_deadline || p.initial_deadline;
          if (!deadline) return false;
          return matchesDueDateFilter(
            deadline,
            dueDateFilter,
            customDueDate || undefined
          );
        });
      }

      // Assignment status filter
      if (assignmentStatusFilter === "Unassigned") {
        filtered = filtered.filter((p) => p.translators.length === 0);
      } else if (assignmentStatusFilter === "Assigned") {
        filtered = filtered.filter((p) => p.translators.length > 0);
      }

      // Source language filter
      if (sourceLangFilter) {
        filtered = filtered.filter((p) => p.language_in === sourceLangFilter);
      }

      // Target language filter
      if (targetLangFilter) {
        filtered = filtered.filter((p) => p.language_out === targetLangFilter);
      }

      // Length filter
      if (lengthFilter) {
        filtered = filtered.filter((p) =>
          matchesLengthFilter(p.words, p.lines, lengthFilter)
        );
      }

      // Sort by deadline (earliest first)
      return filtered.sort((a, b) => {
        const dateA = a.final_deadline ? new Date(a.final_deadline).getTime() : 0;
        const dateB = b.final_deadline ? new Date(b.final_deadline).getTime() : 0;
        if (!a.final_deadline && !b.final_deadline) return 0;
        if (!a.final_deadline) return 1;
        if (!b.final_deadline) return -1;
        return dateA - dateB;
      });
    },
    [
      deferredSearchTerm,
      systemFilter,
      dueDateFilter,
      customDueDate,
      assignmentStatusFilter,
      sourceLangFilter,
      targetLangFilter,
      lengthFilter,
    ]
  );

  return {
    // State
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

    // Derived
    uniqueSystems,
    uniqueSourceLangs,
    uniqueTargetLangs,
    uniqueProjectTypes,
    hasActiveFilters,

    // Actions
    clearFilters,
    applyBaseFilters,
  };
}
