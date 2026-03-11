"use client";

import { useEffect, useState } from "react";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import { useUser } from "@/hooks/user/useUser";
import { resolveTheme, type ThemePreference } from "@/hooks/settings/useThemePreference";

export function DarkModeHandler() {
  const { user } = useUser();
  const { 
    themePreference, 
    setThemePreference, 
    setResolvedDarkMode, 
    resolvedDarkMode,
    collapsed 
  } = useLayoutStore();
  
  // Track system preference
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Initialize system preference and listen for changes
  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    // Listen for system preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Sync theme preference from user data when it loads
  useEffect(() => {
    if (user?.theme_preference) {
      setThemePreference(user.theme_preference as ThemePreference);
    }
  }, [user?.theme_preference, setThemePreference]);

  // Resolve the actual dark mode based on preference and system setting
  useEffect(() => {
    const isDark = resolveTheme(themePreference, systemPrefersDark);
    setResolvedDarkMode(isDark);
  }, [themePreference, systemPrefersDark, setResolvedDarkMode]);

  // Apply dark mode class to HTML element
  useEffect(() => {
    const html = document.documentElement;
    if (resolvedDarkMode) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    html.setAttribute("data-sidebar-collapsed", collapsed.toString());
  }, [resolvedDarkMode, collapsed]);

  return null;
}
