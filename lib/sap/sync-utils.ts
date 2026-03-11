import type { SapProjectForImport } from '@/types/sap';

export type ReportChanges = Record<string, { old: unknown; new: unknown }>;

export interface ModifiedReportEntry {
  id: number;
  name: string;
  changes: ReportChanges;
}

const ORDER_INSENSITIVE_FIELDS = new Set<string>(['graph_id']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T|\b)/.test(value);
}

function normalizeForComparison(value: unknown): unknown {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (looksLikeIsoDateString(trimmed)) {
      const time = new Date(trimmed).getTime();
      if (!Number.isNaN(time)) {
        return { __type: 'date', value: time };
      }
    }

    return trimmed;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForComparison(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function normalizeAsStringSet(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
}

function valuesAreMeaningfullyEqualForField(field: string, a: unknown, b: unknown): boolean {
  if (ORDER_INSENSITIVE_FIELDS.has(field)) {
    const normalizedA = normalizeAsStringSet(a);
    const normalizedB = normalizeAsStringSet(b);

    if (normalizedA && normalizedB) {
      return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
    }
  }

  return valuesAreMeaningfullyEqual(a, b);
}

export function valuesAreMeaningfullyEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeForComparison(a)) === JSON.stringify(normalizeForComparison(b));
}

export function collectTrackedChanges<
  TCurrent extends object,
  TIncoming extends object,
  TField extends keyof TCurrent & keyof TIncoming,
>(
  current: TCurrent,
  incoming: TIncoming,
  fields: readonly TField[],
): ReportChanges {
  const changes: ReportChanges = {};

  for (const field of fields) {
    const oldVal = (current as Record<PropertyKey, unknown>)[field];
    const newVal = (incoming as Record<PropertyKey, unknown>)[field];

    if (!valuesAreMeaningfullyEqualForField(String(field), oldVal, newVal)) {
      changes[String(field)] = { old: oldVal, new: newVal };
    }
  }

  return changes;
}

export function mergeModifiedProjects(entries: ModifiedReportEntry[]): ModifiedReportEntry[] {
  const merged = new Map<number, ModifiedReportEntry>();

  for (const entry of entries) {
    const existing = merged.get(entry.id);
    if (!existing) {
      merged.set(entry.id, {
        id: entry.id,
        name: entry.name,
        changes: { ...entry.changes },
      });
      continue;
    }

    merged.set(entry.id, {
      id: entry.id,
      name: entry.name,
      changes: {
        ...existing.changes,
        ...entry.changes,
      },
    });
  }

  return Array.from(merged.values());
}

export function dedupeImportProjects(projects: SapProjectForImport[]): SapProjectForImport[] {
  const deduped = new Map<string, SapProjectForImport>();

  for (const project of projects) {
    deduped.set(project.sap_import_key, project);
  }

  return Array.from(deduped.values());
}
