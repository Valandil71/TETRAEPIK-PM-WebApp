"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { isAfter, isBefore, startOfDay, isSameDay } from "date-fns";
import { formatDateWithTime } from "@/utils/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DeadlineDisplayProps {
  initialDeadline: string | null;
  interimDeadline: string | null;
  finalDeadline: string | null;
}

type DeadlineType = "initial" | "interim" | "final";

interface DeadlineInfo {
  type: DeadlineType;
  date: Date;
  dateString: string;
  label: string;
  fullName: string;
}

const DEADLINE_CONFIG: Record<
  DeadlineType,
  { label: string; fullName: string }
> = {
  initial: { label: "IN", fullName: "Initial Deadline" },
  interim: { label: "IT", fullName: "Interim Deadline" },
  final: { label: "FN", fullName: "Final Deadline" },
};

export function DeadlineDisplay({
  initialDeadline,
  interimDeadline,
  finalDeadline,
}: DeadlineDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { nextDeadline, remainingDeadlines, hasMoreDeadlines } = useMemo(() => {
    const today = startOfDay(new Date());

    // Check if initial and interim deadlines have passed
    const initialPassed = initialDeadline ? isBefore(new Date(initialDeadline), today) : false;
    const interimPassed = interimDeadline ? isBefore(new Date(interimDeadline), today) : false;

    // If both initial and interim have passed, only show final deadline
    const onlyShowFinal = initialPassed && interimPassed;

    // Build array of all valid deadlines
    const allDeadlines: DeadlineInfo[] = [];

    // Check if initial and final fall on the same calendar day — if so, skip initial
    const initialDate = initialDeadline ? new Date(initialDeadline) : null;
    const finalDate = finalDeadline ? new Date(finalDeadline) : null;
    const initialSameAsFinal = initialDate && finalDate && isSameDay(initialDate, finalDate);

    if (!onlyShowFinal) {
      if (initialDeadline && !initialSameAsFinal) {
        const date = new Date(initialDeadline);
        if (!isNaN(date.getTime())) {
          allDeadlines.push({
            type: "initial",
            date,
            dateString: initialDeadline,
            ...DEADLINE_CONFIG.initial,
          });
        }
      }

      if (interimDeadline) {
        const date = new Date(interimDeadline);
        if (!isNaN(date.getTime())) {
          allDeadlines.push({
            type: "interim",
            date,
            dateString: interimDeadline,
            ...DEADLINE_CONFIG.interim,
          });
        }
      }
    }

    if (finalDeadline) {
      const date = new Date(finalDeadline);
      if (!isNaN(date.getTime())) {
        allDeadlines.push({
          type: "final",
          date,
          dateString: finalDeadline,
          ...DEADLINE_CONFIG.final,
        });
      }
    }

    // Sort by date ascending
    allDeadlines.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Filter to future deadlines (after today)
    const futureDeadlines = allDeadlines.filter((d) => isAfter(d.date, today));

    // If we have future deadlines, use the first one as next
    // Otherwise, use the last (most recent) past deadline or final if all are null
    let next: DeadlineInfo | null = null;
    let remaining: DeadlineInfo[] = [];

    if (futureDeadlines.length > 0) {
      next = futureDeadlines[0];
      remaining = futureDeadlines.slice(1);
    } else if (allDeadlines.length > 0) {
      // All deadlines are in the past, show the last one (most recent)
      next = allDeadlines[allDeadlines.length - 1];
      remaining = [];
    }

    return {
      nextDeadline: next,
      remainingDeadlines: remaining,
      hasMoreDeadlines: remaining.length > 0,
    };
  }, [initialDeadline, interimDeadline, finalDeadline]);

  if (!nextDeadline) {
    return <span className="text-gray-400 dark:text-gray-500">-</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {/* Abbreviation badge with tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-default">
              {nextDeadline.label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{nextDeadline.fullName}</p>
          </TooltipContent>
        </Tooltip>

        {/* Formatted date */}
        <span className="text-gray-700 dark:text-gray-300">
          {formatDateWithTime(nextDeadline.dateString)}
        </span>

        {/* Expandable dropdown for remaining deadlines */}
        {hasMoreDeadlines && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2"
              align="start"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1.5">
                {remainingDeadlines.map((deadline) => (
                  <Tooltip key={deadline.type}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {deadline.label}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {formatDateWithTime(deadline.dateString)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{deadline.fullName}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TooltipProvider>
  );
}
