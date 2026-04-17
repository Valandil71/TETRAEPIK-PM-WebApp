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
  type OverrideState = {
    forDefaultExpanded: boolean;
    keys: Set<string>;
  };

  const groupKeys = useMemo(() => groups.map((group) => group.key), [groups]);
  const groupKeySet = useMemo(() => new Set(groupKeys), [groupKeys]);

  // Keys in this set are toggled away from the chosen default.
  const [overrideState, setOverrideState] = useState<OverrideState>(() => ({
    forDefaultExpanded: defaultExpanded,
    keys: new Set<string>(),
  }));

  const expandedGroups = useMemo(() => {
    const overrides =
      overrideState.forDefaultExpanded === defaultExpanded ?
        overrideState.keys
      : new Set<string>();

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
  }, [defaultExpanded, overrideState, groupKeys, groupKeySet]);

  const toggleGroup = useCallback((key: string) => {
    if (!groupKeySet.has(key)) return;
    setOverrideState((prev) => {
      const base =
        prev.forDefaultExpanded === defaultExpanded ? prev.keys : new Set<string>();
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return {
        forDefaultExpanded: defaultExpanded,
        keys: next,
      };
    });
  }, [defaultExpanded, groupKeySet]);

  const expandGroup = useCallback((key: string) => {
    if (!groupKeySet.has(key)) return;
    setOverrideState((prev) => {
      const base =
        prev.forDefaultExpanded === defaultExpanded ? prev.keys : new Set<string>();
      const next = new Set(base);
      if (defaultExpanded) next.delete(key);
      else next.add(key);
      return {
        forDefaultExpanded: defaultExpanded,
        keys: next,
      };
    });
  }, [defaultExpanded, groupKeySet]);

  const expandAll = useCallback(() => {
    if (defaultExpanded) {
      // Default is expanded, clear explicit collapses for visible keys.
      setOverrideState((prev) => {
        const base =
          prev.forDefaultExpanded === defaultExpanded ? prev.keys : new Set<string>();
        const next = new Set(base);
        groupKeys.forEach((key) => next.delete(key));
        return {
          forDefaultExpanded: defaultExpanded,
          keys: next,
        };
      });
      return;
    }
    // Default is collapsed, explicitly expand all visible keys.
    setOverrideState({
      forDefaultExpanded: defaultExpanded,
      keys: new Set(groupKeys),
    });
  }, [defaultExpanded, groupKeys]);

  const collapseAll = useCallback(() => {
    if (defaultExpanded) {
      // Default is expanded, explicitly collapse all visible keys.
      setOverrideState({
        forDefaultExpanded: defaultExpanded,
        keys: new Set(groupKeys),
      });
      return;
    }
    // Default is collapsed, clear explicit expansions for visible keys.
    setOverrideState((prev) => {
      const base =
        prev.forDefaultExpanded === defaultExpanded ? prev.keys : new Set<string>();
      const next = new Set(base);
      groupKeys.forEach((key) => next.delete(key));
      return {
        forDefaultExpanded: defaultExpanded,
        keys: next,
      };
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
