"use client";

interface Tab<T extends string> {
  id: T;
  label: string;
  count: number;
}

interface StatusTabsProps<T extends string> {
  tabs: Tab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export function StatusTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: StatusTabsProps<T>) {
  return (
    <div className="flex gap-8 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`pb-3 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
            activeTab === tab.id ?
              "border-blue-500 text-blue-500"
            : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          type="button"
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}
