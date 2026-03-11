"use client";

import { useState, useMemo, useCallback } from "react";
import {
  matchesDueDateFilter,
  matchesLengthFilter,
} from "@/utils/filterHelpers";

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

export function useProjectFilters<T extends FilterableProject>(projects: T[]) {
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [dueDateFilter, setDueDateFilter] = useState<string | null>(null);
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string | null>(null);
  const [sourceLangFilter, setSourceLangFilter] = useState<string | null>(null);
  const [targetLangFilter, setTargetLangFilter] = useState<string | null>(null);
  const [lengthFilter, setLengthFilter] = useState<string | null>(null);

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
    setSearchTerm("");
    setSystemFilter(null);
    setDueDateFilter(null);
    setCustomDueDate("");
    setAssignmentStatusFilter(null);
    setSourceLangFilter(null);
    setTargetLangFilter(null);
    setLengthFilter(null);
  }, []);

  const hasActiveFilters =
    !!searchTerm ||
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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
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
      searchTerm,
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
