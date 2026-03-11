"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface MultiSelectFilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onSelect: (values: string[]) => void;
}

export function MultiSelectFilterDropdown({
  label,
  options,
  selected,
  onSelect,
}: MultiSelectFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onSelect(selected.filter((v) => v !== option));
    } else {
      onSelect([...selected, option]);
    }
  };

  const handleClearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect([]);
  };

  const hasSelection = selected.length > 0;
  const displayValue =
    hasSelection
      ? selected.length === 1
        ? selected[0]
        : `${label} (${selected.length})`
      : label;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 cursor-pointer rounded-lg border transition-all flex items-center gap-2 text-sm shadow-sm ${
          hasSelection
            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
        type="button"
      >
        <span>{displayValue}</span>
        {hasSelection ? (
          <X
            className="w-4 h-4 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full hover:text-red-600 dark:hover:text-red-400 transition-colors"
            onClick={handleClearFilter}
          />
        ) : (
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
          <button
            onClick={() => {
              onSelect([]);
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 cursor-pointer text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between"
            type="button"
          >
            <span>All</span>
            {!hasSelection && <Check className="w-4 h-4 text-blue-500" />}
          </button>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleToggle(option)}
              className="w-full px-4 py-2.5 cursor-pointer text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between"
              type="button"
            >
              <span>{option}</span>
              {selected.includes(option) && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
