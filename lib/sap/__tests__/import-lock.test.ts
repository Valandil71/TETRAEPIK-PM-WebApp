import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acquireSapImportLock } from '@/lib/sap/import-lock';

type StatusRow = { status: 'idle' | 'running' | 'failed'; started_at: string | null };

function createSupabaseMock(statusRow: StatusRow, updateResult: { data: unknown; error: unknown }) {
  const statusMaybeSingle = vi.fn().mockResolvedValue({ data: statusRow, error: null });
  const selectEq = vi.fn();
  const selectQuery = {
    eq: selectEq,
    maybeSingle: statusMaybeSingle,
  };
  selectEq.mockReturnValue(selectQuery);

  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn();
  const updateNeq = vi.fn();
  const updateIs = vi.fn();
  const updateQuery = {
    eq: updateEq,
    neq: updateNeq,
    is: updateIs,
    select: updateSelect,
  };
  updateEq.mockReturnValue(updateQuery);
  updateNeq.mockReturnValue(updateQuery);
  updateIs.mockReturnValue(updateQuery);

  const select = vi.fn().mockReturnValue(selectQuery);
  const update = vi.fn().mockReturnValue(updateQuery);
  const from = vi.fn().mockReturnValue({ select, update });

  return {
    supabase: { from } as unknown as SupabaseClient,
    calls: {
      from,
      select,
      update,
      statusMaybeSingle,
      updateMaybeSingle,
      updateEq,
      updateNeq,
      updateIs,
    },
  };
}

describe('acquireSapImportLock', () => {
  it('acquires lock for non-running status', async () => {
    const { supabase, calls } = createSupabaseMock(
      { status: 'idle', started_at: null },
      { data: { started_at: new Date().toISOString() }, error: null }
    );

    const result = await acquireSapImportLock(supabase, 'user-1');

    expect(result.data).toBeTruthy();
    expect(calls.updateNeq).toHaveBeenCalledWith('status', 'running');
  });

  it('blocks lock when running lock is recent', async () => {
    const { supabase, calls } = createSupabaseMock(
      { status: 'running', started_at: new Date().toISOString() },
      { data: { started_at: new Date().toISOString() }, error: null }
    );

    const result = await acquireSapImportLock(supabase, 'user-1');

    expect(result).toEqual({ data: null, error: null });
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('allows stale running lock override with guarded compare-and-set', async () => {
    const staleStartedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const { supabase, calls } = createSupabaseMock(
      { status: 'running', started_at: staleStartedAt },
      { data: { started_at: new Date().toISOString() }, error: null }
    );

    const result = await acquireSapImportLock(supabase, 'user-1');

    expect(result.data).toBeTruthy();
    expect(calls.updateEq).toHaveBeenCalledWith('status', 'running');
    expect(calls.updateEq).toHaveBeenCalledWith('started_at', staleStartedAt);
  });
});
