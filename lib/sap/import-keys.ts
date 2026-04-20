export type SapDeadlineVariant = 'INITIAL' | 'FINAL';

const DEADLINE_VARIANT_MARKER = '|DEADLINE|';

export function appendDeadlineVariantToImportKey(
  importKey: string,
  variant: SapDeadlineVariant
): string {
  return `${importKey}${DEADLINE_VARIANT_MARKER}${variant}`;
}

export function getDeadlineVariantFromImportKey(
  importKey: string
): SapDeadlineVariant | null {
  if (importKey.endsWith(`${DEADLINE_VARIANT_MARKER}INITIAL`)) {
    return 'INITIAL';
  }

  if (importKey.endsWith(`${DEADLINE_VARIANT_MARKER}FINAL`)) {
    return 'FINAL';
  }

  return null;
}

export function stripDeadlineVariantFromImportKey(importKey: string): string {
  const variant = getDeadlineVariantFromImportKey(importKey);
  if (!variant) return importKey;

  return importKey.slice(0, -`${DEADLINE_VARIANT_MARKER}${variant}`.length);
}
