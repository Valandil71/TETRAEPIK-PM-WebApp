import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteProject, isDeleteConfirmed, isRecreatedBySapImport } from '@/lib/projects/delete';

function mockSupabase(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ select });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { supabase: { from } as unknown as SupabaseClient, from, eq };
}

describe('isDeleteConfirmed', () => {
  it('accepts only the exact phrase', () => {
    expect(isDeleteConfirmed('I want to delete')).toBe(true);
    expect(isDeleteConfirmed('i want to delete')).toBe(false);
    expect(isDeleteConfirmed('I want to delete ')).toBe(false);
    expect(isDeleteConfirmed('')).toBe(false);
  });
});

describe('isRecreatedBySapImport', () => {
  it('is true for a project imported from SAP', () => {
    expect(
      isRecreatedBySapImport({ sap_subproject_id: '6690-58', sap_import_key: 'STD|A86|deDE|ptBR|LANGPAIR' })
    ).toBe(true);
  });

  it('is false for STM copies, duplicates and projects created by hand', () => {
    expect(isRecreatedBySapImport({ sap_subproject_id: '6690-58', sap_import_key: 'STM|A86|deDE|ptBR|LANGPAIR' })).toBe(false);
    expect(isRecreatedBySapImport({ sap_subproject_id: '6690-58', sap_import_key: 'DUP|0b1c' })).toBe(false);
    expect(isRecreatedBySapImport({ sap_subproject_id: null, sap_import_key: null })).toBe(false);
  });
});

describe('deleteProject', () => {
  it('deletes the project by id', async () => {
    const { supabase, from, eq } = mockSupabase({ data: [{ id: 7 }], error: null });
    await expect(deleteProject(supabase, 7)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('projects');
    expect(eq).toHaveBeenCalledWith('id', 7);
  });

  it('fails when nothing was deleted (not found or refused by row-level security)', async () => {
    const { supabase } = mockSupabase({ data: [], error: null });
    await expect(deleteProject(supabase, 7)).rejects.toThrow("you don't have permission");
  });

  it('fails when the delete fails', async () => {
    const { supabase } = mockSupabase({ data: null, error: { message: 'boom' } });
    await expect(deleteProject(supabase, 7)).rejects.toThrow('Failed to delete project: boom');
  });
});
