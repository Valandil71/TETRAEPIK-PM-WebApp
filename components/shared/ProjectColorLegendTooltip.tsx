"use client";

import type { ReactNode } from "react";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectColorLegendTooltipProps {
  status?: string;
  system?: string;
  langIn?: string;
  langOut?: string;
  children: ReactNode;
  className?: string;
}

export function ProjectColorLegendTooltip({
  status,
  system,
  langIn,
  langOut,
  children,
  className,
}: ProjectColorLegendTooltipProps) {
  const { getProjectColorLegend } = useColorSettings();
  const legend = getProjectColorLegend({ status, system, langIn, langOut });
  const lines = legend.split("\n").filter(Boolean);

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/40",
              className
            )}
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground shadow-lg"
        >
          <div className="space-y-1">
            {lines.map((line, index) => (
              <p key={`${index}-${line}`} className="text-xs leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
