"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SystemComboboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  value: string;
  onChange: (system: string) => void;
  /** The systems that can be chosen; typing only filters them, it never adds a new one. */
  systems: string[];
  placeholder?: string;
}

/** Select for a project's system, with a search box to find it by typing. */
export const SystemCombobox = React.forwardRef<HTMLButtonElement, SystemComboboxProps>(
  ({ value, onChange, systems, placeholder = "Select a system", className, ...buttonProps }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [highlighted, setHighlighted] = React.useState(0);
    const listRef = React.useRef<HTMLUListElement>(null);
    const listId = React.useId();

    const matches = React.useMemo(() => {
      const term = search.trim().toLowerCase();
      return term ? systems.filter((system) => system.toLowerCase().includes(term)) : systems;
    }, [search, systems]);

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (next) {
        setSearch("");
        setHighlighted(Math.max(systems.indexOf(value), 0));
      }
    };

    const choose = (system: string) => {
      onChange(system);
      setOpen(false);
    };

    // Keep the highlighted option visible while moving with the arrow keys
    React.useEffect(() => {
      listRef.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
    }, [highlighted]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => Math.min(i + 1, matches.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (matches[highlighted]) choose(matches[highlighted]);
      }
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
              !value && "text-muted-foreground",
              className
            )}
            {...buttonProps}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-48 p-0">
          <div className="flex items-center gap-2 border-b border-input px-3">
            <Search className="h-4 w-4 opacity-50" />
            <input
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search systems..."
              aria-label="Search systems"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {matches.length > 0 ?
            <ul ref={listRef} id={listId} role="listbox" className="max-h-60 overflow-y-auto p-1">
              {matches.map((system, index) => (
                <li
                  key={system}
                  role="option"
                  aria-selected={system === value}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(system)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm",
                    index === highlighted && "bg-accent text-accent-foreground"
                  )}
                >
                  {system}
                  {system === value && <Check className="absolute right-2 h-4 w-4" />}
                </li>
              ))}
            </ul>
          : <p className="px-3 py-4 text-center text-sm text-muted-foreground">No system found</p>}
        </PopoverContent>
      </Popover>
    );
  }
);
SystemCombobox.displayName = "SystemCombobox";
