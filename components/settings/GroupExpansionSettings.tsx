"use client";

import { Check, ChevronDown, ChevronUp, Rows3 } from "lucide-react";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import type { GroupExpansionMode } from "@/lib/stores/useLayoutStore";

export function GroupExpansionSettings() {
  const groupExpansionMode = useLayoutStore((state) => state.groupExpansionMode);
  const setGroupExpansionMode = useLayoutStore((state) => state.setGroupExpansionMode);

  const options: Array<{
    value: GroupExpansionMode;
    label: string;
    description: string;
    icon: typeof ChevronDown;
  }> = [
    {
      value: "expandAll",
      label: "Expand All",
      description: "Project groups are expanded by default across grouped pages.",
      icon: ChevronDown,
    },
    {
      value: "collapseAll",
      label: "Collapse All",
      description: "Project groups are collapsed by default across grouped pages.",
      icon: ChevronUp,
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rows3 className="w-6 h-6" /> Group Expansion
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose one global behavior for grouped lists in Management, Assign Projects, and Invoicing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = groupExpansionMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setGroupExpansionMode(option.value)}
              className={`
                relative flex items-start gap-3 p-5 rounded-xl border-2 transition-all cursor-pointer text-left
                ${
                  isSelected ?
                    "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="w-5 h-5 text-blue-500" />
                </div>
              )}
              <Icon
                className={`w-6 h-6 mt-0.5 ${
                  isSelected ? "text-blue-500" : "text-gray-600 dark:text-gray-400"
                }`}
              />
              <div>
                <p
                  className={`font-semibold ${
                    isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {option.label}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
