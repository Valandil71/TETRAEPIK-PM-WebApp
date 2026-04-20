import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useProjectFilters } from "@/hooks/project/useProjectFilters";
import { createDefaultProjectFilterState } from "@/lib/projectFilterState";

const projects = [
  {
    name: "Alpha Project",
    system: "SAP",
    language_in: "EN",
    language_out: "PT",
    words: 100,
    lines: 10,
    initial_deadline: null,
    interim_deadline: null,
    final_deadline: "2026-04-20",
    project_type: "Translation",
    translators: [],
  },
  {
    name: "Beta Project",
    system: "ERP",
    language_in: "FR",
    language_out: "ES",
    words: 5000,
    lines: 500,
    initial_deadline: null,
    interim_deadline: null,
    final_deadline: "2026-04-21",
    project_type: "Review",
    translators: [{ assignment_status: "claimed" }],
  },
];

function useControlledProjectFilters() {
  const [filters, setFilters] = useState(() => createDefaultProjectFilterState());
  return useProjectFilters(projects, {
    filters,
    onFiltersChange: setFilters,
  });
}

describe("useProjectFilters", () => {
  it("can be controlled by page-level state", () => {
    const { result } = renderHook(() => useControlledProjectFilters());

    act(() => {
      result.current.setSearchTerm("alpha");
    });

    expect(result.current.searchTerm).toBe("alpha");
    expect(result.current.applyBaseFilters(projects)).toEqual([projects[0]]);
  });

  it("merges consecutive controlled updates without dropping values", () => {
    const { result } = renderHook(() => useControlledProjectFilters());

    act(() => {
      result.current.setCustomDueDate("2026-04-20");
      result.current.setDueDateFilter("Custom date");
    });

    expect(result.current.customDueDate).toBe("2026-04-20");
    expect(result.current.dueDateFilter).toBe("Custom date");
  });
});
