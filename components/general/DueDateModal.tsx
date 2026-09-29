"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DueDateModalProps {
  open: boolean;
  /** Called with false on Cancel, Esc, click outside or the close button. */
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen YYYY-MM-DD date when the user confirms. */
  onConfirm: (date: string) => void;
  /** Currently applied date (YYYY-MM-DD), if any. */
  value?: string;
  /** Earliest / latest selectable date (YYYY-MM-DD, inclusive). */
  min?: string;
  max?: string;
}

function clamp(value: string, min?: string, max?: string) {
  if (value && max && value > max) return max;
  if (value && min && value < min) return min;
  return value;
}

export function DueDateModal({
  open,
  onOpenChange,
  onConfirm,
  value = "",
  min,
  max,
}: DueDateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Mounted only while open, so the draft restarts from the applied value */}
        <DueDateForm
          value={value}
          min={min}
          max={max}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

function DueDateForm({
  value,
  min,
  max,
  onCancel,
  onConfirm,
}: {
  value: string;
  min?: string;
  max?: string;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}) {
  const [draft, setDraft] = useState(() => clamp(value, min, max));
  const outOfRange =
    !!draft && ((!!max && draft > max) || (!!min && draft < min));
  const canConfirm = !!draft && !outOfRange;
  const inputRef = useRef<HTMLInputElement>(null);

  // Open the native calendar straight away. showPicker() needs a recent user
  // gesture (the click on "Custom date") and may be unsupported or refused,
  // in which case the focused input still works as usual.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        inputRef.current?.showPicker?.();
      } catch {
        // ignore: fall back to the plain input
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canConfirm) onConfirm(draft);
      }}
    >
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <DialogTitle>Custom due date</DialogTitle>
        </div>
        <DialogDescription className="pt-1">
          Show projects due up to and including this date.
        </DialogDescription>
      </DialogHeader>

      <div>
        <label
          htmlFor="due-date-modal-input"
          className="block text-xs text-gray-600 dark:text-gray-400 mb-2"
        >
          Until
        </label>
        <input
          id="due-date-modal-input"
          ref={inputRef}
          type="date"
          aria-invalid={outOfRange}
          value={draft}
          min={min}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {outOfRange && (
          <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
            {max && draft > max ?
              `Pick a date on or before ${max}.`
            : `Pick a date on or after ${min}.`}
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canConfirm}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          Apply
        </Button>
      </DialogFooter>
    </form>
  );
}
