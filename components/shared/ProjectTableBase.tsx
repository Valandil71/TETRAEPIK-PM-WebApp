"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePagination } from "@/hooks/core/usePagination";
import { EmptyState } from "./EmptyState";
import { Pagination } from "@/components/ui/pagination";

interface Column<T> {
  header: string;
  className?: string;
  render: (item: T, index: number) => ReactNode;
}

interface ProjectTableBaseProps<T> {
  items: T[];
  columns: Column<T>[];
  emptyStateTitle: string;
  emptyStateSubtitle?: string;
  onRowClick?: (item: T, e: React.MouseEvent) => void;
  enablePagination?: boolean;
  itemsPerPage?: number;
  className?: string;
  rowClassName?: string | ((item: T) => string);
  getRowKey: (item: T) => string | number;
  leadingColumn?: (item: T) => ReactNode;
  getRowStyle?: (item: T) => React.CSSProperties;
  stickyHeader?: boolean;
  /** External page control — when provided, overrides internal pagination state */
  page?: number;
  /** External page change handler */
  onPageChange?: (page: number) => void;
}

/**
 * Base table component for project tables
 * Handles common structure, pagination, and empty states
 */
export function ProjectTableBase<T>({
  items,
  columns,
  emptyStateTitle,
  emptyStateSubtitle,
  onRowClick,
  enablePagination = false,
  itemsPerPage = 10,
  className = "",
  rowClassName = "",
  getRowKey,
  leadingColumn,
  getRowStyle,
  stickyHeader = false,
  page: externalPage,
  onPageChange: externalOnPageChange,
}: ProjectTableBaseProps<T>) {
  const previousItemsRef = useRef(items);

  const internal = usePagination(
    items,
    {
      itemsPerPage: enablePagination ? itemsPerPage : items.length,
      totalItems: items.length,
    }
  );

  // Use external page control when provided, otherwise fall back to internal
  const isExternallyControlled = externalPage !== undefined && externalOnPageChange !== undefined;
  const currentPage = isExternallyControlled ? externalPage : internal.currentPage;
  const setCurrentPage = isExternallyControlled ? externalOnPageChange : internal.setCurrentPage;
  const totalPages = Math.ceil(items.length / (enablePagination ? itemsPerPage : items.length));

  // Calculate paginated items based on the active page
  const paginatedItems = enablePagination
    ? items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : items;

  const displayItems = enablePagination ? paginatedItems : items;

  useEffect(() => {
    if (!enablePagination || !isExternallyControlled) return;

    // Reset to the first page whenever the filtered/sorted data set changes.
    if (previousItemsRef.current !== items && currentPage !== 1) {
      setCurrentPage(1);
    }
    previousItemsRef.current = items;
  }, [items, enablePagination, isExternallyControlled, currentPage, setCurrentPage]);

  useEffect(() => {
    if (!enablePagination || !isExternallyControlled) return;

    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [enablePagination, isExternallyControlled, currentPage, totalPages, setCurrentPage]);

  const handleRowClick = (item: T, e: React.MouseEvent) => {
    if (onRowClick) {
      // Don't navigate if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a") ||
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT"
      ) {
        return;
      }
      onRowClick(item, e);
    }
  };

  const getRowClass = (item: T): string => {
    const baseClass =
      "border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors";
    const cursorClass = onRowClick ? "cursor-pointer" : "";
    const customClass =
      typeof rowClassName === "function" ? rowClassName(item) : rowClassName;
    return `${baseClass} ${cursorClass} ${customClass}`.trim();
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              {leadingColumn && <th className="px-6 py-4 w-4" />}
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-4 text-left text-gray-700 dark:text-gray-300 ${column.className || ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.length > 0 ?
              displayItems.map((item, index) => (
                <tr
                  key={getRowKey(item)}
                  className={getRowClass(item)}
                  style={getRowStyle ? getRowStyle(item) : undefined}
                  onClick={(e) => handleRowClick(item, e)}
                >
                  {leadingColumn && (
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      {leadingColumn(item)}
                    </td>
                  )}
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-6 py-4 ${column.className || ""}`}
                    >
                      {column.render(item, index)}
                    </td>
                  ))}
                </tr>
              ))
            : <tr>
                <td colSpan={columns.length + (leadingColumn ? 1 : 0)} className="px-6 py-12 text-center">
                  <EmptyState
                    title={emptyStateTitle}
                    subtitle={emptyStateSubtitle}
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      {enablePagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={items.length}
        />
      )}
    </div>
  );
}
