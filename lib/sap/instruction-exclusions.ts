import type { SapInstructionEntry } from "@/types/project";
import {
  normalizeInstructionText,
  normalizeInstructionTextForMatch,
} from "@/lib/sap/instruction-normalization";

export interface InstructionExclusionV2 {
  id: number;
  created_at: string;
  created_by: string;
  raw_text: string;
  normalized_text: string;
  is_active: boolean;
}

export interface UiSapInstruction {
  short: string;
  long: string;
  /** SAP's HTML body, when stored; display only (exclusions always use `long || short`). */
  html?: string;
  slsLang?: string;
}

export function isExcludedInstruction(
  text: string | null | undefined,
  exclusionSet: Set<string>
): boolean {
  if (!text) return false;
  return exclusionSet.has(normalizeInstructionTextForMatch(text));
}

/**
 * Match keys of the exclusions. Both the stored normalized_text and the raw_text are
 * re-normalized, so exclusions saved by an older normalization still match.
 */
export function toInstructionExclusionSet(
  exclusions: Array<Pick<InstructionExclusionV2, "normalized_text"> & { raw_text?: string | null }>
): Set<string> {
  return new Set(
    exclusions
      .flatMap((entry) => [
        normalizeInstructionTextForMatch(entry.normalized_text),
        normalizeInstructionTextForMatch(entry.raw_text),
      ])
      .filter((entry) => entry.length > 0)
  );
}

export function filterSapInstructions(
  entries: SapInstructionEntry[] | null | undefined,
  exclusionSet: Set<string>
): UiSapInstruction[] {
  if (!entries || entries.length === 0) return [];

  const seen = new Set<string>();
  const cleaned: UiSapInstruction[] = [];

  for (const entry of entries) {
    const short = normalizeInstructionText(entry.instructionShort || "");
    const long = normalizeInstructionText(entry.instructionLong || entry.text || "");
    const value = long || short;
    if (!value) continue;

    const matchKey = normalizeInstructionTextForMatch(value);
    if (!matchKey) continue;
    if (exclusionSet.has(matchKey)) continue;
    if (seen.has(matchKey)) continue;
    seen.add(matchKey);

    cleaned.push({ short, long, html: entry.instructionLongHtml, slsLang: entry.slsLang });
  }

  return cleaned;
}