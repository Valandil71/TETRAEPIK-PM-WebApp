import { create } from "zustand";

interface OriginalRecord {
  tableName: string;
  primaryKey: string; // JSON stringified primary key
  data: Record<string, unknown>;
  loadedAt: number;
}

interface OriginalRecordStore {
  records: Map<string, OriginalRecord>;

  /** Store the original state of a record when it's loaded */
  setOriginal: (
    tableName: string,
    primaryKey: Record<string, unknown>,
    data: Record<string, unknown>
  ) => void;

  /** Get the original state of a record */
  getOriginal: (
    tableName: string,
    primaryKey: Record<string, unknown>
  ) => Record<string, unknown> | null;

  /** Clear the original record after successful update */
  clearOriginal: (
    tableName: string,
    primaryKey: Record<string, unknown>
  ) => void;

  /** Clear all original records for a table */
  clearAllForTable: (tableName: string) => void;
}

const makeKey = (tableName: string, primaryKey: Record<string, unknown>) =>
  `${tableName}:${JSON.stringify(primaryKey)}`;

export const useOriginalRecordStore = create<OriginalRecordStore>((set, get) => ({
  records: new Map(),

  setOriginal: (tableName, primaryKey, data) => {
    const key = makeKey(tableName, primaryKey);
    set((state) => {
      const newRecords = new Map(state.records);
      newRecords.set(key, {
        tableName,
        primaryKey: JSON.stringify(primaryKey),
        data: { ...data },
        loadedAt: Date.now(),
      });
      return { records: newRecords };
    });
  },

  getOriginal: (tableName, primaryKey) => {
    const key = makeKey(tableName, primaryKey);
    return get().records.get(key)?.data ?? null;
  },

  clearOriginal: (tableName, primaryKey) => {
    const key = makeKey(tableName, primaryKey);
    set((state) => {
      const newRecords = new Map(state.records);
      newRecords.delete(key);
      return { records: newRecords };
    });
  },

  clearAllForTable: (tableName) => {
    set((state) => {
      const newRecords = new Map(state.records);
      for (const [key] of newRecords) {
        if (key.startsWith(`${tableName}:`)) {
          newRecords.delete(key);
        }
      }
      return { records: newRecords };
    });
  },
}));
