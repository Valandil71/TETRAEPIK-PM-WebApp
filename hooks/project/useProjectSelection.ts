"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DragMode = "select" | "deselect";

/** Adds or removes `ids`; returns the same Set when nothing changes (no re-render). */
export function applySelection(
  selected: Set<number>,
  ids: number[],
  mode: DragMode
): Set<number> {
  const changes = ids.filter((id) => selected.has(id) !== (mode === "select"));
  if (changes.length === 0) return selected;
  const next = new Set(selected);
  changes.forEach((id) => (mode === "select" ? next.add(id) : next.delete(id)));
  return next;
}

/** A drag follows the first item: starting on an unselected item selects, on a selected one deselects. */
export function getDragMode(selected: Set<number>, id: number): DragMode {
  return selected.has(id) ? "deselect" : "select";
}

/** Keeps only the ids that are still visible; returns the same Set when nothing is dropped. */
export function retainSelection(selected: Set<number>, visibleIds: Iterable<number>): Set<number> {
  const visible = new Set(visibleIds);
  if ([...selected].every((id) => visible.has(id))) return selected;
  return new Set([...selected].filter((id) => visible.has(id)));
}

const INTERACTIVE_SELECTOR = "button, input, textarea, select, a, [role='menuitem']";

export interface SelectableItemProps {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  "data-selected": boolean;
}

export interface ProjectSelection {
  isActive: boolean;
  selectedIds: Set<number>;
  count: number;
  isSelected: (id: number) => boolean;
  /** Enters selection mode with `id` selected (adds it if already selecting). */
  start: (id: number) => void;
  exit: () => void;
  setMany: (ids: number[], selected: boolean) => void;
  retain: (visibleIds: Iterable<number>) => void;
  /** Click toggles; press and drag applies the first item's mode to every item the pointer enters. */
  getItemProps: (id: number) => SelectableItemProps;
}

export function useProjectSelection(): ProjectSelection {
  const [isActive, setIsActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const dragModeRef = useRef<DragMode | null>(null);
  const selectedRef = useRef(selectedIds);

  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);

  const exit = useCallback(() => {
    dragModeRef.current = null;
    setIsActive(false);
    setSelectedIds(new Set());
  }, []);

  const start = useCallback(
    (id: number) => {
      // Already selecting (e.g. "Select multiple" on another row): just add it.
      setSelectedIds((prev) => (isActive ? applySelection(prev, [id], "select") : new Set([id])));
      setIsActive(true);
    },
    [isActive]
  );

  const setMany = useCallback((ids: number[], selected: boolean) => {
    setSelectedIds((prev) => applySelection(prev, ids, selected ? "select" : "deselect"));
  }, []);

  const retain = useCallback((visibleIds: Iterable<number>) => {
    setSelectedIds((prev) => retainSelection(prev, visibleIds));
  }, []);

  // The drag ends wherever the button is released, even outside the list.
  useEffect(() => {
    if (!isActive) return;
    const endDrag = () => {
      dragModeRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role='dialog'], [role='menu']")) exit();
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isActive, exit]);

  const getItemProps = useCallback(
    (id: number): SelectableItemProps => ({
      onPointerDown: (e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
        e.preventDefault(); // no text selection while dragging
        const mode = getDragMode(selectedRef.current, id);
        dragModeRef.current = mode;
        setSelectedIds((prev) => applySelection(prev, [id], mode));
      },
      onPointerEnter: () => {
        const mode = dragModeRef.current;
        if (!mode) return;
        setSelectedIds((prev) => applySelection(prev, [id], mode));
      },
      "data-selected": selectedIds.has(id),
    }),
    [selectedIds]
  );

  return useMemo(
    () => ({
      isActive,
      selectedIds,
      count: selectedIds.size,
      isSelected: (id: number) => selectedIds.has(id),
      start,
      exit,
      setMany,
      retain,
      getItemProps,
    }),
    [isActive, selectedIds, start, exit, setMany, retain, getItemProps]
  );
}
