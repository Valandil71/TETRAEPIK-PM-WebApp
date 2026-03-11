import { useState, useMemo, useEffect } from "react";

interface UsePaginationOptions {
  itemsPerPage?: number;
  totalItems: number;
}

interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  paginatedItems: unknown[];
  setCurrentPage: (page: number) => void;
  startIndex: number;
  endIndex: number;
}

/**
 * Shared pagination hook for tables
 * Handles pagination logic, page resets, and item slicing
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = { totalItems: 0 }
): Omit<UsePaginationReturn, "paginatedItems"> & { paginatedItems: T[] } {
  const { itemsPerPage = 10, totalItems } = options;
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate total pages
  const totalPages = Math.ceil((totalItems || items.length) / itemsPerPage);

  // Calculate paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Reset to page 1 when items change or if current page is invalid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      const timeout = setTimeout(() => {
        setCurrentPage(1);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [currentPage, totalPages]);

  // Reset to page 1 when items array changes (e.g., filters change)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timeout);
  }, [items.length]);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    setCurrentPage,
    startIndex,
    endIndex,
  };
}
