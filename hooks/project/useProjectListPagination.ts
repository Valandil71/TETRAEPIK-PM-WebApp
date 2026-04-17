"use client";

import { useCallback, useMemo, useState } from "react";

export const PROJECT_LIST_ITEMS_PER_PAGE = 50;

interface UseProjectListPaginationOptions {
  itemsPerPage?: number;
}

export function useProjectListPagination<T>(
  items: T[],
  { itemsPerPage = PROJECT_LIST_ITEMS_PER_PAGE }: UseProjectListPaginationOptions = {}
) {
  const [pageState, setPageState] = useState<{
    items: T[];
    currentPage: number;
  }>(() => ({
    items,
    currentPage: 1,
  }));

  const requestedPage = pageState.items === items ? pageState.currentPage : 1;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const safeCurrentPage =
    totalPages === 0 ? 1 : Math.min(Math.max(requestedPage, 1), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [items, itemsPerPage, safeCurrentPage]);

  const setCurrentPage = useCallback(
    (page: number) => {
      setPageState({
        items,
        currentPage: page,
      });
    },
    [items]
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
