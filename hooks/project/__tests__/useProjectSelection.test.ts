import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  applySelection,
  getDragMode,
  retainSelection,
  useProjectSelection,
} from "@/hooks/project/useProjectSelection";

describe("applySelection", () => {
  it("adds ids in select mode and removes them in deselect mode", () => {
    expect([...applySelection(new Set([1]), [2, 3], "select")]).toEqual([1, 2, 3]);
    expect([...applySelection(new Set([1, 2, 3]), [2], "deselect")]).toEqual([1, 3]);
  });

  it("returns the same Set when nothing changes", () => {
    const selected = new Set([1, 2]);
    expect(applySelection(selected, [1, 2], "select")).toBe(selected);
    expect(applySelection(selected, [3], "deselect")).toBe(selected);
  });
});

describe("getDragMode", () => {
  it("follows the first item: unselected selects, selected deselects", () => {
    expect(getDragMode(new Set([1]), 2)).toBe("select");
    expect(getDragMode(new Set([1]), 1)).toBe("deselect");
  });
});

describe("retainSelection", () => {
  it("drops ids that are no longer visible", () => {
    expect([...retainSelection(new Set([1, 2, 3]), [1, 3, 4])]).toEqual([1, 3]);
  });

  it("returns the same Set when every id is still visible", () => {
    const selected = new Set([1, 2]);
    expect(retainSelection(selected, [1, 2, 3])).toBe(selected);
  });
});

function pointerDown(target: HTMLElement = document.createElement("div")) {
  return {
    button: 0,
    target,
    preventDefault: () => {},
  } as unknown as React.PointerEvent;
}

describe("useProjectSelection", () => {
  it("starts with the chosen project selected and exits clearing everything", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(7));
    expect(result.current.isActive).toBe(true);
    expect([...result.current.selectedIds]).toEqual([7]);

    act(() => result.current.exit());
    expect(result.current.isActive).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("toggles on click and applies the first item's mode while dragging", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(1));

    // Press on an unselected row and drag over two more: all selected
    act(() => result.current.getItemProps(2).onPointerDown(pointerDown()));
    act(() => result.current.getItemProps(3).onPointerEnter());
    act(() => result.current.getItemProps(4).onPointerEnter());
    act(() => window.dispatchEvent(new Event("pointerup")));
    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3, 4]);

    // Moving after release changes nothing
    act(() => result.current.getItemProps(5).onPointerEnter());
    expect(result.current.isSelected(5)).toBe(false);

    // Press on a selected row and drag: deselects
    act(() => result.current.getItemProps(3).onPointerDown(pointerDown()));
    act(() => result.current.getItemProps(4).onPointerEnter());
    act(() => window.dispatchEvent(new Event("pointerup")));
    expect([...result.current.selectedIds].sort()).toEqual([1, 2]);
  });

  it("ignores presses on buttons and inputs inside a row", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(1));
    act(() => result.current.getItemProps(2).onPointerDown(pointerDown(document.createElement("button"))));
    expect(result.current.isSelected(2)).toBe(false);
  });

  it("selects and clears a whole group", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(1));
    act(() => result.current.setMany([1, 2, 3], true));
    expect(result.current.count).toBe(3);
    act(() => result.current.setMany([1, 2, 3], false));
    expect(result.current.count).toBe(0);
  });

  it("exits on Escape when no dialog or menu is open", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(1));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.isActive).toBe(false);
  });
});
