"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Calendar, X } from "lucide-react";

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  customDateValue?: string;
  onCustomDateChange?: (date: string) => void;
}

export function FilterDropdown({
  label,
  options,
  selected,
  onSelect,
  customDateValue,
  onCustomDateChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowDatePicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    if (option === "Custom date") {
      setShowDatePicker(true);
    } else {
      onSelect(option);
      setIsOpen(false);
      setShowDatePicker(false);
    }
  };

  const displayValue =
    selected === "Custom date" && customDateValue ?
      `Until ${customDateValue}`
    : selected || label;

  const handleClearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setShowDatePicker(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 cursor-pointer rounded-lg border transition-all flex items-center gap-2 text-sm shadow-sm ${
          selected ?
            "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
        type="button"
      >
        <span>{displayValue}</span>
        {selected ?
          <X
            className="w-4 h-4 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full hover:text-red-600 dark:hover:text-red-400 transition-colors"
            onClick={handleClearFilter}
          />
        : <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        }
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
          <button
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
              setShowDatePicker(false);
            }}
            className="w-full px-4 py-2.5 cursor-pointer text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between"
            type="button"
          >
            <span>All</span>
            {!selected && <Check className="w-4 h-4 text-blue-500" />}
          </button>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => handleOptionClick(option)}
              className="w-full px-4 py-2.5 cursor-pointer text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between"
              type="button"
            >
              <span>{option}</span>
              {selected === option && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))}

          {/* Custom Date Picker */}
          {showDatePicker && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 mt-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Until:
                </span>
              </div>
              <input
                type="date"
                value={customDateValue || ""}
                onChange={(e) => {
                  if (onCustomDateChange) {
                    onCustomDateChange(e.target.value);
                    onSelect("Custom date");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  setShowDatePicker(false);
                  onSelect(null);
                }}
                className="absolute top-2 right-2 cursor-pointer text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
