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

/**
 * Import key for a manually created STM copy of an SAP project.
 * The SAP import never generates this key, so it can't match or overwrite the copy,
 * and the copy doesn't collide with the source on the unique (subproject, key) index.
 */
export function toStmImportKey(importKey: string | null | undefined): string | null {
  if (!importKey) return null;
  if (importKey.startsWith('STM|')) return importKey;
  if (importKey.startsWith('STD|')) return `STM|${importKey.slice(4)}`;

  return `STM|${importKey}`;
}

export function stripDeadlineVariantFromImportKey(importKey: string): string {
  const variant = getDeadlineVariantFromImportKey(importKey);
  if (!variant) return importKey;

  return importKey.slice(0, -`${DEADLINE_VARIANT_MARKER}${variant}`.length);
}
