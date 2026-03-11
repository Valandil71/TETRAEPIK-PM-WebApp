"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProjectGroup } from "@/lib/projectGrouping";

interface UseProjectGroupExpansionArgs<T extends { id: number; name: string }> {
  groups: ProjectGroup<T>[];
  defaultExpanded?: boolean;
}

export function useProjectGroupExpansion<T extends { id: number; name: string }>({
  groups,
  defaultExpanded = false,
}: UseProjectGroupExpansionArgs<T>) {
  const groupKeys = useMemo(() => groups.map((group) => group.key), [groups]);
  const groupKeySet = useMemo(() => new Set(groupKeys), [groupKeys]);

  // Keys in this set are toggled away from the chosen default.
  const [overrides, setOverrides] = useState<Set<string>>(new Set());

  const expandedGroups = useMemo(() => {
    if (defaultExpanded) {
      const expanded = new Set(groupKeys);
      overrides.forEach((key) => {
        if (groupKeySet.has(key)) expanded.delete(key);
      });
      return expanded;
    }

    const expanded = new Set<string>();
    overrides.forEach((key) => {
      if (groupKeySet.has(key)) expanded.add(key);
    });
    return expanded;
  }, [defaultExpanded, overrides, groupKeys, groupKeySet]);

  const toggleGroup = useCallback((key: string) => {
    if (!groupKeySet.has(key)) return;
    setOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [groupKeySet]);

  const expandGroup = useCallback((key: string) => {
    if (!groupKeySet.has(key)) return;
    setOverrides((prev) => {
      const next = new Set(prev);
      if (defaultExpanded) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [defaultExpanded, groupKeySet]);

  const expandAll = useCallback(() => {
    if (defaultExpanded) {
      // Default is expanded, clear explicit collapses for visible keys.
      setOverrides((prev) => {
        const next = new Set(prev);
        groupKeys.forEach((key) => next.delete(key));
        return next;
      });
      return;
    }
    // Default is collapsed, explicitly expand all visible keys.
    setOverrides(new Set(groupKeys));
  }, [defaultExpanded, groupKeys]);

  const collapseAll = useCallback(() => {
    if (defaultExpanded) {
      // Default is expanded, explicitly collapse all visible keys.
      setOverrides(new Set(groupKeys));
      return;
    }
    // Default is collapsed, clear explicit expansions for visible keys.
    setOverrides((prev) => {
      const next = new Set(prev);
      groupKeys.forEach((key) => next.delete(key));
      return next;
    });
  }, [defaultExpanded, groupKeys]);

  return {
    expandedGroups,
    toggleGroup,
    expandGroup,
    expandAll,
    collapseAll,
  };
}
