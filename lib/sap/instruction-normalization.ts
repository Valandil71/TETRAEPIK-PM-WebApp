// /lib/sap/instruction-normalization.ts
// Shared normalization for instruction exclusion matching and display.

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * Best-effort plain-text cleanup for instruction text.
 * - Removes HTML tags
 * - Decodes common HTML entities
 * - Normalizes unicode + NBSP
 * - Collapses whitespace to single spaces
 */
export function normalizeInstructionText(input: string | null | undefined): string {
  if (!input) return '';

  const withoutTags = input.replace(/<[^>]*>/g, ' ');
  const decodedEntities = withoutTags.replace(
    /(&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;)/gi,
    (match) => HTML_ENTITY_MAP[match.toLowerCase()] ?? match
  );

  return decodedEntities
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalized value specifically for case-insensitive matching. */
export function normalizeInstructionTextForMatch(input: string | null | undefined): string {
  return normalizeInstructionText(input).toLowerCase();
}