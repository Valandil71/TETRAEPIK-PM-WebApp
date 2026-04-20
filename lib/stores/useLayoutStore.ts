import { create } from "zustand";
import type { ThemePreference } from "@/hooks/settings/useThemePreference";

export type GroupExpansionMode = "expandAll" | "collapseAll";

interface LayoutState {
  // Theme preference from user settings ('system', 'light', 'dark')
  themePreference: ThemePreference;
  // The resolved dark mode state (true = dark, false = light)
  resolvedDarkMode: boolean;
  // Sidebar collapsed state
  collapsed: boolean;
  // Account grouped-list expansion behavior
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
  groupExpansionMode: "expandAll",
  
  setThemePreference: (preference) => set({ themePreference: preference }),
  setResolvedDarkMode: (value) => set({ resolvedDarkMode: value }),
  setCollapsed: (value) => set({ collapsed: value }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  setGroupExpansionMode: (mode) => set({ groupExpansionMode: mode }),
  toggleGroupExpansionMode: () =>
    set((state) => {
      const nextMode = state.groupExpansionMode === "expandAll" ? "collapseAll" : "expandAll";
      return { groupExpansionMode: nextMode };
    }),
  
  // Legacy getter for backwards compatibility
  get darkMode() {
    return get().resolvedDarkMode;
  },
}));
