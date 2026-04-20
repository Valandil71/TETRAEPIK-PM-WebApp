import { create } from 'zustand';
import {
  createDefaultProjectFilterState,
  type ProjectFilterState,
  type ProjectFilterUpdate,
} from '@/lib/projectFilterState';

type ProjectStatus = 'all' | 'ready' | 'inProgress' | 'unclaimed';
type ViewMode = 'table' | 'card';

interface ManagementPageState {
  activeTab: ProjectStatus;
  viewMode: ViewMode;
  currentPage: number;
  returnProjectId: number | null;
  shouldScrollToTop: boolean;
  scrollY: number;
  filters: ProjectFilterState;
  projectTypeFilterOverride: string[] | null;
  setActiveTab: (tab: ProjectStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentPage: (page: number) => void;
  setScrollY: (scrollY: number) => void;
  setFilters: (filters: ProjectFilterUpdate) => void;
  setProjectTypeFilterOverride: (values: string[] | null) => void;
  rememberReturnProject: (projectId: number) => void;
  clearReturnProject: () => void;
  clearScrollToTop: () => void;
  resetToStart: () => void;
}

export const useManagementPageStore = create<ManagementPageState>((set) => ({
  activeTab: 'all',
  viewMode: 'table',
  currentPage: 1,
  returnProjectId: null,
  shouldScrollToTop: false,
  scrollY: 0,
  filters: createDefaultProjectFilterState(),
  projectTypeFilterOverride: null,
  setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setScrollY: (scrollY) => set({ scrollY }),
  setFilters: (filters) =>
    set((state) => ({
      filters: typeof filters === 'function' ? filters(state.filters) : filters,
    })),
  setProjectTypeFilterOverride: (values) =>
    set({ projectTypeFilterOverride: values }),
  rememberReturnProject: (projectId) =>
    set({ returnProjectId: projectId, shouldScrollToTop: false }),
  clearReturnProject: () => set({ returnProjectId: null }),
  clearScrollToTop: () => set({ shouldScrollToTop: false }),
  resetToStart: () =>
    set({
      activeTab: 'all',
      currentPage: 1,
      returnProjectId: null,
      shouldScrollToTop: true,
      scrollY: 0,
    }),
}));
