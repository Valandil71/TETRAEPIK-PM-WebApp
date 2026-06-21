import { create } from "zustand";
import {
  createDefaultProjectFilterState,
  type ProjectFilterState,
  type ProjectFilterUpdate,
} from "@/lib/projectFilterState";

type ViewMode = "table" | "card";

interface ConcludedProjectsPageState {
  viewMode: ViewMode;
  currentPage: number;
  scrollY: number;
  filters: ProjectFilterState;
  setViewMode: (mode: ViewMode) => void;
  setCurrentPage: (page: number) => void;
  setScrollY: (scrollY: number) => void;
  setFilters: (filters: ProjectFilterUpdate) => void;
}

// View state for the read-only Concluded Projects page. Mirrors the invoicing
// store but without tabs, selection, or invoicing-specific toggles, since every
// row here is already status "complete" and there are no row actions.
export const useConcludedProjectsPageStore = create<ConcludedProjectsPageState>(
  (set) => ({
    viewMode: "table",
    currentPage: 1,
    scrollY: 0,
    filters: createDefaultProjectFilterState(),
    setViewMode: (mode) => set({ viewMode: mode }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setScrollY: (scrollY) => set({ scrollY }),
    setFilters: (filters) =>
      set((state) => ({
        filters:
          typeof filters === "function" ? filters(state.filters) : filters,
      })),
  })
);
