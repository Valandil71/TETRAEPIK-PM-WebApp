import { create } from "zustand";
import type { ThemePreference } from "@/hooks/settings/useThemePreference";

export type GroupExpansionMode = "expandAll" | "collapseAll";

const GROUP_EXPANSION_MODE_STORAGE_KEY = "layout:group-expansion-mode";

const getInitialGroupExpansionMode = (): GroupExpansionMode => {
  if (typeof window === "undefined") return "collapseAll";
  const storedValue = window.localStorage.getItem(GROUP_EXPANSION_MODE_STORAGE_KEY);
  return storedValue === "expandAll" ? "expandAll" : "collapseAll";
};

const persistGroupExpansionMode = (value: GroupExpansionMode) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUP_EXPANSION_MODE_STORAGE_KEY, value);
};

interface LayoutState {
  // Theme preference from user settings ('system', 'light', 'dark')
  themePreference: ThemePreference;
  // The resolved dark mode state (true = dark, false = light)
  resolvedDarkMode: boolean;
  // Sidebar collapsed state
  collapsed: boolean;
  // Global grouped-list expansion behavior
  groupExpansionMode: GroupExpansionMode;
  // Actions
  setThemePreference: (preference: ThemePreference) => void;
  setResolvedDarkMode: (value: boolean) => void;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  setGroupExpansionMode: (mode: GroupExpansionMode) => void;
  toggleGroupExpansionMode: () => void;
  // Legacy support - computed property
  darkMode: boolean;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  themePreference: "system",
  resolvedDarkMode: false,
  collapsed: false,
  groupExpansionMode: getInitialGroupExpansionMode(),
  
  setThemePreference: (preference) => set({ themePreference: preference }),
  setResolvedDarkMode: (value) => set({ resolvedDarkMode: value }),
  setCollapsed: (value) => set({ collapsed: value }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setGroupExpansionMode: (mode) => {
    persistGroupExpansionMode(mode);
    set({ groupExpansionMode: mode });
  },
  toggleGroupExpansionMode: () =>
    set((state) => {
      const nextMode = state.groupExpansionMode === "expandAll" ? "collapseAll" : "expandAll";
      persistGroupExpansionMode(nextMode);
      return { groupExpansionMode: nextMode };
    }),
  
  // Legacy getter for backwards compatibility
  get darkMode() {
    return get().resolvedDarkMode;
  },
}));
