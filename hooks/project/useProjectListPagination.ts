"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export const PROJECT_LIST_ITEMS_PER_PAGE = 50;

interface UseProjectListPaginationOptions {
  itemsPerPage?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function useProjectListPagination<T>(
  items: T[],
  {
    itemsPerPage = PROJECT_LIST_ITEMS_PER_PAGE,
    currentPage,
    onPageChange,
  }: UseProjectListPaginationOptions = {}
) {
  const isControlled = currentPage !== undefined;
  const [pageState, setPageState] = useState<{
    items: T[];
    currentPage: number;
  }>(() => ({
    items,
    currentPage: 1,
  }));

  const requestedPage =
    isControlled ? currentPage : pageState.items === items ? pageState.currentPage : 1;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const safeCurrentPage =
    totalPages === 0 ? 1 : Math.min(Math.max(requestedPage, 1), totalPages);

  useEffect(() => {
    if (isControlled && onPageChange && currentPage !== safeCurrentPage) {
      onPageChange(safeCurrentPage);
    }
  }, [currentPage, isControlled, onPageChange, safeCurrentPage]);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [items, itemsPerPage, safeCurrentPage]);

  const setCurrentPage = useCallback(
    (page: number) => {
      if (isControlled) {
        onPageChange?.(page);
        return;
      }
      setPageState({
        items,
        currentPage: page,
      });
    },
    [isControlled, items, onPageChange]
  );

  return {
    currentPage: safeCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
    setCurrentPage,
  };
}
