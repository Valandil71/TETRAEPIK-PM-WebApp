"use client";

import { useState } from "react";
import { FileText, ClipboardList, ChevronDown, ChevronRight, Ban } from "lucide-react";
import type { SapInstructionEntry } from "@/types/project";
import { useInstructionExclusions } from "@/hooks/settings/useInstructionExclusions";
import { filterSapInstructions } from "@/lib/sap/instruction-exclusions";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";

interface ProjectInstructionsCardProps {
  instructions: string | null | undefined;
  sapInstructions?: SapInstructionEntry[] | null;
}

export function ProjectInstructionsCard({
  instructions,
  sapInstructions,
}: ProjectInstructionsCardProps) {
  const { user, isPmOrAdmin } = useRoleAccess();
  const {
    exclusionSet,
    addExclusion,
    isAdding,
  } = useInstructionExclusions(user?.id ?? null);
  const visibleSapInstructions = filterSapInstructions(sapInstructions, exclusionSet);
  const hasInstructions = instructions && instructions.trim() !== "";
  const hasSapInstructions = visibleSapInstructions.length > 0;
  const canExcludeSapInstructions = isPmOrAdmin() && !!user?.id;

  const handleExcludeSapInstruction = (text: string) => {
    if (!canExcludeSapInstructions || isAdding) return;
    addExclusion(text);
  };

  if (!hasInstructions && !hasSapInstructions) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-gray-900 dark:text-white mb-4 text-xl font-semibold">
          Instructions
        </h2>
        <p className="text-gray-500 dark:text-gray-400 italic">
          No instructions available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasSapInstructions && (
        <SapInstructionsSection
          entries={visibleSapInstructions}
          canExclude={canExcludeSapInstructions}
          isExcluding={isAdding}
          onExclude={handleExcludeSapInstruction}
        />
      )}

      {hasInstructions && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-gray-900 dark:text-white text-xl font-semibold">
              Instructions
            </h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {instructions}
          </p>
        </div>
      )}
    </div>
  );
}

function SapInstructionsSection({
  entries,
  canExclude,
  isExcluding,
  onExclude,
}: {
  entries: Array<{ short: string; long: string; slsLang?: string }>;
  canExclude: boolean;
  isExcluding: boolean;
  onExclude: (text: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          SAP Instructions ({entries.length})
        </h2>
      </div>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <CollapsibleInstruction
            key={i}
            short={entry.short}
            long={entry.long}
            slsLang={entry.slsLang}
            canExclude={canExclude}
            isExcluding={isExcluding}
            onExclude={onExclude}
          />
        ))}
      </div>
    </div>
  );
}

function CollapsibleInstruction({
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
