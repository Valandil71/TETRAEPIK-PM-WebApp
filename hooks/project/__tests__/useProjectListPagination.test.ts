import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProjectListPagination } from "@/hooks/project/useProjectListPagination";

const makeItems = (count: number) => Array.from({ length: count }, (_, index) => index);

describe("useProjectListPagination", () => {
  it("respects an externally controlled current page", () => {
    const items = makeItems(120);
    const onPageChange = vi.fn();

    const { result } = renderHook(() =>
      useProjectListPagination(items, {
        itemsPerPage: 50,
        currentPage: 2,
        onPageChange,
      })
    );

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems[0]).toBe(50);

    act(() => {
      result.current.setCurrentPage(3);
    });

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("clamps a controlled page that is beyond the available pages", async () => {
    const items = makeItems(80);
    const onPageChange = vi.fn();

    const { result } = renderHook(() =>
      useProjectListPagination(items, {
        itemsPerPage: 50,
        currentPage: 5,
        onPageChange,
      })
    );

    expect(result.current.currentPage).toBe(2);
    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(2));
  });

  it("keeps the existing uncontrolled reset behavior when items change", () => {
    const firstItems = makeItems(120);
    const secondItems = makeItems(120);

    const { result, rerender } = renderHook(
      ({ items }) => useProjectListPagination(items, { itemsPerPage: 50 }),
      { initialProps: { items: firstItems } }
    );

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.currentPage).toBe(2);

    rerender({ items: secondItems });

    expect(result.current.currentPage).toBe(1);
  });
});
