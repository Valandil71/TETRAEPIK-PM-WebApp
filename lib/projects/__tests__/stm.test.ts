import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStmProject } from '@/lib/projects/stm';

function mockSupabase(
  source: { data: unknown; error: unknown },
  created: { data: unknown; error: unknown } = { data: { id: 99 }, error: null }
) {
  const sourceSingle = vi.fn().mockResolvedValue(source);
  const sourceEq = vi.fn().mockReturnValue({ single: sourceSingle });
  const select = vi.fn().mockReturnValue({ eq: sourceEq });

  const createdSingle = vi.fn().mockResolvedValue(created);
  const insertSelect = vi.fn().mockReturnValue({ single: createdSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  const from = vi.fn().mockReturnValue({ select, insert });
  return { supabase: { from } as unknown as SupabaseClient, sourceEq, insert };
}

describe('createStmProject', () => {
  const source = {
    id: 7,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    name: 'Alpha',
    system: 'SSE',
    sap_import_key: 'SAP-1',
    final_deadline: '2026-11-09T15:45:00Z',
  };

  it('reads the source from the database and inserts an STM copy without identity fields', async () => {
    const { supabase, sourceEq, insert } = mockSupabase({ data: source, error: null });
    await expect(createStmProject(supabase, 7)).resolves.toEqual({ id: 99 });
    expect(sourceEq).toHaveBeenCalledWith('id', 7);
    expect(insert).toHaveBeenCalledWith({
      name: 'Alpha',
      system: 'STM',
      sap_import_key: 'STM|SAP-1',
      final_deadline: '2026-11-09T15:45:00Z',
    });
  });

  it('keeps a null import key null', async () => {
    const { supabase, insert } = mockSupabase({ data: { ...source, sap_import_key: null }, error: null });
    await createStmProject(supabase, 7);
    expect(insert.mock.calls[0][0].sap_import_key).toBeNull();
  });

  it('fails when the source cannot be loaded', async () => {
    const { supabase, insert } = mockSupabase({ data: null, error: { message: 'not found' } });
    await expect(createStmProject(supabase, 7)).rejects.toThrow('Failed to load source project: not found');
    expect(insert).not.toHaveBeenCalled();
  });

  it('fails when the insert fails', async () => {
    const { supabase } = mockSupabase({ data: source, error: null }, { data: null, error: { message: 'rls' } });
    await expect(createStmProject(supabase, 7)).rejects.toThrow('Failed to create STM project: rls');
  });
});
