import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import {
  addCollaborators,
  buildAssignmentRows,
  invalidateCollaboratorQueries,
  removeCollaborator,
} from '@/lib/projects/collaborators';
import { queryKeys } from '@/lib/queryKeys';

describe('buildAssignmentRows', () => {
  it('claims the current user\'s own assignment and leaves others unclaimed', () => {
    const rows = buildAssignmentRows(
      [
        { projectId: 1, userId: 'me', message: 'hello' },
        { projectId: 1, userId: 'other', message: '' },
        { projectId: 2, userId: 'other' },
      ],
      'me'
    );
    expect(rows).toEqual([
      { project_id: 1, user_id: 'me', assignment_status: 'claimed', initial_message: 'hello' },
      { project_id: 1, user_id: 'other', assignment_status: 'unclaimed', initial_message: null },
      { project_id: 2, user_id: 'other', assignment_status: 'unclaimed', initial_message: null },
    ]);
  });

  it('never claims when the current user is unknown', () => {
    const rows = buildAssignmentRows([{ projectId: 1, userId: 'x' }], undefined);
    expect(rows[0].assignment_status).toBe('unclaimed');
  });
});

describe('addCollaborators', () => {
  function mockInsert(result: { error: unknown }) {
    const insert = vi.fn().mockResolvedValue(result);
    const from = vi.fn().mockReturnValue({ insert });
    return { supabase: { from } as unknown as SupabaseClient, from, insert };
  }

  it('inserts all rows in a single call', async () => {
    const { supabase, from, insert } = mockInsert({ error: null });
    const rows = await addCollaborators(
      supabase,
      [{ projectId: 1, userId: 'a' }, { projectId: 2, userId: 'b' }],
      'a'
    );
    expect(from).toHaveBeenCalledWith('projects_assignment');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual(rows);
    expect(rows.map((r) => r.assignment_status)).toEqual(['claimed', 'unclaimed']);
  });

  it('rejects an empty selection without calling the database', async () => {
    const { supabase, insert } = mockInsert({ error: null });
    await expect(addCollaborators(supabase, [], 'a')).rejects.toThrow('No collaborators selected');
    expect(insert).not.toHaveBeenCalled();
  });

  it('surfaces database errors', async () => {
    const { supabase } = mockInsert({ error: { message: 'duplicate key' } });
    await expect(addCollaborators(supabase, [{ projectId: 1, userId: 'a' }], null)).rejects.toThrow(
      'Failed to add collaborators: duplicate key'
    );
  });
});

describe('removeCollaborator', () => {
  function mockDelete(result: { data: unknown; error: unknown }) {
    const select = vi.fn().mockResolvedValue(result);
    const eq = vi.fn();
    const query = { eq, select };
    eq.mockReturnValue(query);
    const del = vi.fn().mockReturnValue(query);
    const from = vi.fn().mockReturnValue({ delete: del });
    return { supabase: { from } as unknown as SupabaseClient, eq, select };
  }

  it('deletes by the composite key and asks for the deleted row back', async () => {
    const { supabase, eq, select } = mockDelete({ data: [{ project_id: 1, user_id: 'u' }], error: null });
    await removeCollaborator(supabase, 1, 'u');
    expect(eq).toHaveBeenCalledWith('project_id', 1);
    expect(eq).toHaveBeenCalledWith('user_id', 'u');
    expect(select).toHaveBeenCalledWith('project_id, user_id');
  });

  it('fails when nothing was deleted (already removed or blocked by RLS)', async () => {
    const { supabase } = mockDelete({ data: [], error: null });
    await expect(removeCollaborator(supabase, 1, 'u')).rejects.toThrow('Collaborator was not removed');
  });

  it('surfaces database errors', async () => {
    const { supabase } = mockDelete({ data: null, error: { message: 'boom' } });
    await expect(removeCollaborator(supabase, 1, 'u')).rejects.toThrow('Failed to remove collaborator: boom');
  });

  it('requires both ids', async () => {
    const { supabase } = mockDelete({ data: [], error: null });
    await expect(removeCollaborator(supabase, 0, 'u')).rejects.toThrow('required');
  });
});

describe('invalidateCollaboratorQueries', () => {
  it('invalidates lists, each project and each user\'s views', () => {
    const queryClient = new QueryClient();
    const keys = [
      queryKeys.projectsWithTranslators(false, true, false),
      queryKeys.project(1),
      queryKeys.project(2),
      queryKeys.myProjects('u1'),
      queryKeys.homeMyProjectsCount('u1'),
      queryKeys.myProjects('u2'),
      queryKeys.homeMyProjectsCount('u2'),
    ];
    const untouched = [queryKeys.project(3), queryKeys.myProjects('u3')];
    [...keys, ...untouched].forEach((key) => queryClient.setQueryData(key, []));

    invalidateCollaboratorQueries(queryClient, [1, 2, 1], ['u1', 'u2']);

    keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    untouched.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false));
  });
});
