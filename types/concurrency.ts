/**
 * Represents a field that has changed between versions during a concurrent edit.
 */
export interface FieldChange<T = unknown> {
  /** The field/column name */
  field: string;
  /** Human-readable label for display */
  label: string;
  /** Value when the user first loaded the record */
  originalValue: T;
  /** Current value in the database (changed by another user) */
  currentValue: T;
  /** The value the user is trying to save */
  yourValue: T;
}

/**
 * Result of checking for concurrent modification conflicts.
 */
export interface ConflictResult<T> {
  /** Whether a conflict was detected */
  hasConflict: boolean;
  /** List of fields that have conflicting changes */
  changes: FieldChange[];
  /** The record as it was when the user first loaded it */
  originalRecord: T;
  /** The record as it currently exists in the database */
  currentRecord: T;
}

/**
 * Options for executing a concurrency-safe mutation.
 */
export interface ConcurrencySafeMutationOptions<T> {
  /** The database table name */
  tableName: string;
  /** Primary key column(s) and their values */
  primaryKey: Record<string, unknown>;
  /** The record as it was when the user first loaded it */
  originalRecord: T;
  /** The fields being updated */
  updatedFields: Partial<T>;
  /** Column used for version comparison (defaults to 'updated_at') */
  versionField?: keyof T;
}
