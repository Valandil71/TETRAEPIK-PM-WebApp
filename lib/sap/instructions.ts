// /lib/sap/instructions.ts
// SAP instruction composition and processing

import type { SapInstruction, SapInstructionEntry } from '@/types/sap';
import { normalizeInstructionText, normalizeInstructionTextForMatch } from './instruction-normalization';

/**
 * Build composed instructions string from extracted fields.
 * Order: TA, lxe/DITA (if DNW), Graph ID, TK, WL
 */
export function buildInstructions(params: {
  translationAreas: string[];
  lxeProjects: string[];
  graphIds: string[];
  hours: number;
  terms: number;
  terminologyKeys: string[];
  workLists: string[];
  system: string;
}): string | null {
  const parts: string[] = [];

  if (params.translationAreas.length > 0) {
    parts.push(`TA: ${params.translationAreas.join(', ')}`);
  }

  // LXE/DITA only for DNW system
  if (params.system === 'DNW' && params.lxeProjects.length > 0) {
    parts.push(`LXE: ${params.lxeProjects.join(', ')}`);
  }

  if (params.graphIds.length > 0) {
    parts.push(`Graph ID: ${params.graphIds.join(', ')}`);
  }

  if (params.terminologyKeys.length > 0) {
    parts.push(`TK: ${params.terminologyKeys.join(', ')}`);
  }

  if (params.workLists.length > 0) {
    parts.push(`WL: ${params.workLists.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Build sap_instructions JSONB array from SAP instruction entries.
 * - Stores both instructionShort and instructionLong
 * - Normalizes text for consistent display + dedupe
 * - Deduplicates by normalized long/short text
 */
export function buildSapInstructions(
  instructions: SapInstruction[]
): SapInstructionEntry[] | null {
  const seen = new Set<string>();
  const entries: SapInstructionEntry[] = [];

  for (const instr of instructions) {
    const strippedShort = normalizeInstructionText(instr.instructionShort || '');
    const strippedLong = normalizeInstructionText(instr.instructionLong || '');

    const textForDedup = strippedLong || strippedShort;
    const normalizedForMatch = normalizeInstructionTextForMatch(textForDedup);
    if (!normalizedForMatch) continue;

    if (seen.has(normalizedForMatch)) continue;
    seen.add(normalizedForMatch);

    const html = instr.instructionLong?.trim();
    entries.push({
      instructionShort: strippedShort,
      instructionLong: strippedLong,
      instructionLongHtml: html && /<[a-z][^>]*>/i.test(html) ? html : undefined,
      slsLang: instr.slsLang || undefined,
      contentId: instr.contentId || undefined,
    });
  }

  return entries.length > 0 ? entries : null;
}

/**
 * Splits the HTML bodies off the entries: sap_instructions keeps the plain-text entries that
 * lists load, sap_instructions_html holds the HTML (same order) for the detail views only.
 */
export function splitSapInstructionHtml(entries: SapInstructionEntry[] | null): {
  sap_instructions: SapInstructionEntry[] | null;
  sap_instructions_html: (string | null)[] | null;
} {
  if (!entries) return { sap_instructions: null, sap_instructions_html: null };
  return {
    sap_instructions: entries.map(({ instructionLongHtml, ...entry }) => {
      void instructionLongHtml;
      return entry;
    }),
    sap_instructions_html: entries.some((entry) => entry.instructionLongHtml)
      ? entries.map((entry) => entry.instructionLongHtml ?? null)
      : null,
  };
}

/** Puts the HTML bodies from sap_instructions_html back on their entries, for display. */
export function attachSapInstructionHtml(
  entries: SapInstructionEntry[] | null | undefined,
  html: (string | null)[] | null | undefined
): SapInstructionEntry[] | null {
  if (!entries) return null;
  if (!html || html.length !== entries.length) return entries;
  return entries.map((entry, i) => (html[i] ? { ...entry, instructionLongHtml: html[i] } : entry));
}

/**
 * Legacy helper kept for compatibility with existing imports.
 * Prefer normalizeInstructionText for new code.
 */
export function stripHtmlTags(html: string): string {
  return normalizeInstructionText(html);
}
