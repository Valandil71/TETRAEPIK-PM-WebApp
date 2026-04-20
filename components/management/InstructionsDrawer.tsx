"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileText, ClipboardList, ChevronDown, ChevronRight, Ban } from "lucide-react";
import { useState } from "react";
import type { SapInstructionEntry } from "@/types/project";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";
import { filterSapInstructions } from "@/lib/sap/instruction-exclusions";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";

interface InstructionsDrawerProject {
  name: string;
  instructions?: string | null;
  sap_instructions?: SapInstructionEntry[] | null;
}

interface InstructionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: InstructionsDrawerProject | null;
}

export function InstructionsDrawer({
  open,
  onOpenChange,
  project,
}: InstructionsDrawerProps) {
  const [sapExpanded, setSapExpanded] = useState(false);
  const { user, isPmOrAdmin } = useRoleAccess();
  const {
    exclusionSet,
    addExclusion,
    isAdding,
  } = useInstructionExclusions(user?.id ?? null);

  if (!project) return null;

  const hasInstructions = project.instructions && project.instructions.trim() !== "";
  const visibleSapInstructions = filterSapInstructions(project.sap_instructions, exclusionSet);
  const canExcludeSapInstructions = isPmOrAdmin() && !!user?.id;

  const handleExcludeSapInstruction = (text: string) => {
    if (!canExcludeSapInstructions || isAdding) return;
    addExclusion(text);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{project.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {visibleSapInstructions.length > 0 && (
            <div>
              <button
                onClick={() => setSapExpanded(!sapExpanded)}
                className="flex items-center gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                type="button"
              >
                {sapExpanded ? (
                  <ChevronDown className="w-4 h-4 text-amber-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-amber-500" />
                )}
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  SAP Instructions ({visibleSapInstructions.length})
                </h3>
              </button>

              {sapExpanded && (
                <div className="space-y-2">
                  {visibleSapInstructions.map((entry, i) => (
                    <CollapsibleSapInstruction
                      key={i}
                      short={entry.short}
                      long={entry.long}
                      slsLang={entry.slsLang}
                      canExclude={canExcludeSapInstructions}
                      isExcluding={isAdding}
                      onExclude={handleExcludeSapInstruction}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {hasInstructions && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Instructions
                </h3>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line break-words overflow-hidden">
                  {project.instructions}
                </p>
              </div>
            </div>
          )}

          {!hasInstructions && visibleSapInstructions.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No instructions available
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CollapsibleSapInstruction({
  short,
  long,
  canExclude,
  isExcluding,
  onExclude,
}: {
  short: string;
  long: string;
  slsLang?: string;
  canExclude: boolean;
  isExcluding: boolean;
  onExclude: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullText = long || short;
  const isLong = fullText.length > 80;
  const excludeButton = canExclude ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onExclude(fullText);
      }}
      disabled={isExcluding}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 dark:border-amber-800/50 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Ban className="h-3 w-3" />
      Exclude
    </button>
  ) : null;

  if (!isLong) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30 p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words" style={{ overflowWrap: "anywhere" }}>
            {fullText}
          </p>
          {excludeButton}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="flex cursor-pointer items-stretch justify-between gap-3 p-3 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <span className="flex min-w-0 flex-1 items-start gap-2 text-left">
          {expanded ?
            <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
          }
          <span className="text-sm text-gray-700 dark:text-gray-300 break-words" style={{ overflowWrap: "anywhere" }}>
            {short || fullText.slice(0, 80) + "..."}
          </span>
        </span>
        {excludeButton}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line break-words" style={{ overflowWrap: "anywhere" }}>
            {fullText}
          </p>
        </div>
      )}
    </div>
  );
}
