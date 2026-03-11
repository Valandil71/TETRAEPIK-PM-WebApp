"use client";

import { Monitor, Sun, Moon, Check } from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import { useThemePreference, type ThemePreference } from "@/hooks/settings/useThemePreference";

export function ThemeSettings() {
  const { user } = useUser();
  const { themePreference } = useLayoutStore();
  const { updateTheme, isUpdating } = useThemePreference();

  const handleThemeChange = (preference: ThemePreference) => {
    if (!user?.id || isUpdating) return;
    updateTheme({ userId: user.id, preference });
  };

  const themeOptions: { value: ThemePreference; label: string; icon: typeof Monitor }[] = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sun className="w-6 h-6" /> Theme
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how the application appears to you.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = themePreference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemeChange(option.value)}
              disabled={isUpdating}
              className={`
                relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all cursor-pointer
                ${isSelected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="w-5 h-5 text-blue-500" />
                </div>
              )}
              <Icon
                className={`w-8 h-8 ${
                  isSelected
                    ? "text-blue-500"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isSelected
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {themePreference === "system"
          ? "The theme will automatically match your system preferences."
          : themePreference === "light"
          ? "The application will always use the light theme."
          : "The application will always use the dark theme."}
      </p>
    </div>
  );
}
