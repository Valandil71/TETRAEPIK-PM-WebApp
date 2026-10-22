// /lib/sap/instruction-normalization.ts
// Shared normalization for instruction exclusion matching and display.

import { decode } from 'html-entities';

/**
 * Best-effort plain-text cleanup for instruction text.
 * - Removes HTML tags
 * - Decodes HTML entities (named and numeric, e.g. &rsquo; &#34;)
 * - Normalizes unicode + NBSP
 * - Collapses whitespace to single spaces
 */
export function normalizeInstructionText(input: string | null | undefined): string {
  if (!input) return '';

  const withoutTags = input.replace(/<[^>]*>/g, ' ');
  const decodedEntities = decode(withoutTags, { level: 'html5' });

  return decodedEntities
    .normalize('NFKC')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalized value specifically for case-insensitive matching. */
export function normalizeInstructionTextForMatch(input: string | null | undefined): string {
  return normalizeInstructionText(input).toLowerCase();
}
