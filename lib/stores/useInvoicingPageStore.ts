import { create } from "zustand";
import {
  createDefaultProjectFilterState,
  type ProjectFilterState,
  type ProjectFilterUpdate,
} from "@/lib/projectFilterState";

type TabType = "all" | "toBeInvoiced" | "toBePaid";
type ViewMode = "table" | "card";

interface InvoicingPageState {
  activeTab: TabType;
  viewMode: ViewMode;
  currentPage: number;
  hideFullyProcessed: boolean;
  selectedProjectIds: number[];
  scrollY: number;
  filters: ProjectFilterState;
  setActiveTab: (tab: TabType) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentPage: (page: number) => void;
  setHideFullyProcessed: (hideFullyProcessed: boolean) => void;
  setSelectedProjectIds: (projectIds: number[]) => void;
  clearSelectedProjects: () => void;
  setScrollY: (scrollY: number) => void;
  setFilters: (filters: ProjectFilterUpdate) => void;
}

export const useInvoicingPageStore = create<InvoicingPageState>((set) => ({
  activeTab: "all",
  viewMode: "table",
  currentPage: 1,
  hideFullyProcessed: true,
  selectedProjectIds: [],
  scrollY: 0,
  filters: createDefaultProjectFilterState(),
  setActiveTab: (tab) =>
    set({ activeTab: tab, currentPage: 1, selectedProjectIds: [] }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setHideFullyProcessed: (hideFullyProcessed) =>
    set({ hideFullyProcessed, currentPage: 1 }),
  setSelectedProjectIds: (projectIds) => set({ selectedProjectIds: projectIds }),
  clearSelectedProjects: () => set({ selectedProjectIds: [] }),
  setScrollY: (scrollY) => set({ scrollY }),
  setFilters: (filters) =>
    set((state) => ({
      filters: typeof filters === "function" ? filters(state.filters) : filters,
    })),
}));
