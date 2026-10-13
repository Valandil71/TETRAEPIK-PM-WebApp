"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LINE_CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" } as const;

interface TruncatedTextProps {
  text: string;
  /** Lines shown before cutting with "…" (default 2). */
  lines?: keyof typeof LINE_CLAMP;
  /** Clicking copies this value (e.g. the raw project name). Ignored when `onClick` is set. */
  copyValue?: string;
  /** Toast shown after copying. */
  copyMessage?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * Text cut to a few lines with "…"; hovering shows the whole text, but only when it was cut.
 * Optionally copies a value on click (project names) or runs a custom click (instructions).
 */
export function TruncatedText({
  text,
  lines = 2,
  copyValue,
  copyMessage = "Copied to clipboard",
  onClick,
  className,
}: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const isClickable = !!onClick || copyValue !== undefined;

  const handleClick = async (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (copyValue === undefined) return;
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(copyValue);
      toast.success(copyMessage);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          const el = ref.current;
          const isCut = !!el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
          setOpen(next && isCut);
        }}
      >
        <TooltipTrigger asChild>
          <span
            ref={ref}
            onClick={isClickable ? handleClick : undefined}
            className={cn(
              "break-words",
              LINE_CLAMP[lines],
              isClickable && "cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors",
              className
            )}
          >
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-md whitespace-pre-wrap break-words text-sm">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
