/* eslint-disable @typescript-eslint/no-explicit-any -- test double for the supabase-js query builder */
// ONE-TIME-USE: delete together with lib/sap/one-time/ after the first production import.

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

/** Minimal in-memory stand-in for the supabase-js query builder (only what the importer uses). */
export function createFakeSupabase(tables: Tables, failOn: (table: string, op: string) => string | null = () => null) {
  let nextId = 1000;

  function from(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let payload: Row = {};
    let ordered = false;
    let max = Infinity;

    const run = () => {
      const failure = failOn(table, op);
      if (failure) return { data: null, error: { message: failure } };
      const matches = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        matches.forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      if (op === 'insert') {
        const row = { id: nextId++, ...payload };
        rows.push(row);
        return { data: { id: row.id }, error: null };
      }
      const sorted = ordered ? [...matches].sort((a, b) => a.id - b.id) : matches;
      return { data: sorted.slice(0, max).map((r) => ({ ...r })), error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), builder),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), builder),
      contains: (k: string, v: unknown[]) => (filters.push((r) => v.every((x) => (r[k] ?? []).includes(x))), builder),
      order: () => ((ordered = true), builder),
      limit: async (n: number) => ((max = n), run()),
      maybeSingle: async () => {
        const res: any = run();
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      single: async () => {
        const res: any = run();
        const first = Array.isArray(res.data) ? res.data[0] : res.data;
        return { data: first ?? null, error: res.error ?? (first ? null : { message: 'not found' }) };
      },
      update: (p: Row) => ((op = 'update'), (payload = p), builder),
      insert: (p: Row) => ((op = 'insert'), (payload = p), builder),
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  }

  return { from };
}
