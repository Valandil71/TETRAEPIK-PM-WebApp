import { create } from "zustand";
import {
  createDefaultProjectFilterState,
  type ProjectFilterState,
  type ProjectFilterUpdate,
} from "@/lib/projectFilterState";

type ViewMode = "table" | "card";

interface AssignProjectsPageState {
  viewMode: ViewMode;
  currentPage: number;
  selectedProjectIds: number[];
  scrollY: number;
  filters: ProjectFilterState;
  assignmentFilter: string | null;
  projectTypeFilterOverride: string[] | null;
  setViewMode: (mode: ViewMode) => void;
  setCurrentPage: (page: number) => void;
  setSelectedProjectIds: (projectIds: number[]) => void;
  clearSelectedProjects: () => void;
  setScrollY: (scrollY: number) => void;
  setFilters: (filters: ProjectFilterUpdate) => void;
  setAssignmentFilter: (assignmentFilter: string | null) => void;
  setProjectTypeFilterOverride: (values: string[] | null) => void;
}

export const useAssignProjectsPageStore = create<AssignProjectsPageState>((set) => ({
  viewMode: "table",
  currentPage: 1,
  selectedProjectIds: [],
  scrollY: 0,
  filters: createDefaultProjectFilterState(),
  assignmentFilter: "Unassigned",
  projectTypeFilterOverride: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedProjectIds: (projectIds) => set({ selectedProjectIds: projectIds }),
  clearSelectedProjects: () => set({ selectedProjectIds: [] }),
  setScrollY: (scrollY) => set({ scrollY }),
  setFilters: (filters) =>
    set((state) => ({
      filters: typeof filters === "function" ? filters(state.filters) : filters,
    })),
  setAssignmentFilter: (assignmentFilter) => set({ assignmentFilter }),
  setProjectTypeFilterOverride: (values) =>
    set({ projectTypeFilterOverride: values }),
}));
