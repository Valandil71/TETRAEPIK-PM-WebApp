import { create } from 'zustand';

type ProjectStatus = 'all' | 'ready' | 'inProgress' | 'unclaimed';
type ViewMode = 'table' | 'card';

interface ManagementPageState {
  activeTab: ProjectStatus;
  viewMode: ViewMode;
  currentPage: number;
  setActiveTab: (tab: ProjectStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentPage: (page: number) => void;
}

export const useManagementPageStore = create<ManagementPageState>((set) => ({
  activeTab: 'all',
  viewMode: 'table',
  currentPage: 1,
  setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
