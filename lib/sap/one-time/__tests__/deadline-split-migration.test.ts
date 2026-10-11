// ONE-TIME-USE: delete together with lib/sap/one-time/ after the first production import.

import { describe, expect, it } from 'vitest';
import { migrateLegacyDeadlineSplits } from '../deadline-split-migration';
import { createFakeSupabase, type Row, type Tables } from './fake-supabase';
import { findExistingProject, updateProjectFromSap } from '@/lib/sap/project-writer';
import type { SapProjectForImport } from '@/types/sap';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const FUTURE = '2026-10-20T10:00:00.000Z';
const PAST = '2026-10-01T10:00:00.000Z';
const BASE_KEY = 'STD|SSE|enUS|ptBR|TA|CHR000';

function sapData(overrides: Partial<SapProjectForImport>): SapProjectForImport {
  return {
    sap_subproject_id: 'sp-1',
    sap_import_key: BASE_KEY,
    name: 'sp-1: P | N',
    language_in: 'enUS',
    language_out: 'ptBR',
    initial_deadline: null,
    final_deadline: null,
    instructions: null,
    sap_instructions: null,
    system: 'SSE',
    api_source: 'TPM_sap_api',
    last_synced_at: NOW.toISOString(),
    sap_pm: null,
    project_type: null,
    terminology_key: null,
    lxe_project: null,
    translation_area: ['CHR000'],
    work_list: null,
    graph_id: null,
    lxe_projects: null,
    url: null,
    hours: null,
    words: 10,
    lines: null,
    ...overrides,
  };
}

function splitPair(initialDeadline: string, finalDeadline: string) {
  return [
    sapData({ sap_import_key: `${BASE_KEY}|DEADLINE|FINAL`, final_deadline: finalDeadline }),
    sapData({ sap_import_key: `${BASE_KEY}|DEADLINE|INITIAL`, initial_deadline: initialDeadline }),
  ];
}

function legacyRow(overrides: Row = {}): Row {
  return {
    id: 1,
    sap_subproject_id: 'sp-1',
    sap_import_key: BASE_KEY,
    system: 'SSE',
    language_in: 'enUS',
    language_out: 'ptBR',
    translation_area: ['CHR000'],
    initial_deadline: '2026-10-19T10:00:00.000Z',
    final_deadline: '2026-10-21T10:00:00.000Z',
    status: 'active',
    name: 'sp-1: P | N',
    ...overrides,
  };
}

const assignments = (): Row[] => [
  { project_id: 1, user_id: 'u1', assignment_status: 'claimed' },
  { project_id: 1, user_id: 'u2', assignment_status: 'done', done_message: 'ok' },
];

async function migrate(tables: Tables, pair: SapProjectForImport[], failOn?: Parameters<typeof createFakeSupabase>[1]) {
  return migrateLegacyDeadlineSplits({
    supabase: createFakeSupabase(tables, failOn) as never,
    projects: pair,
    includeSapInstructions: true,
    now: NOW,
  });
}

describe('migrateLegacyDeadlineSplits', () => {
  it('moves translators to INITIAL when its deadline has not passed', async () => {
    const tables: Tables = { projects: [legacyRow()], projects_assignment: assignments() };

    const result = await migrate(tables, splitPair(FUTURE, '2026-10-25T10:00:00.000Z'));

    expect(result.failures).toEqual([]);
    expect(result.imported).toBe(1);
    expect(result.handledKeys.size).toBe(2);

    const final = tables.projects.find((p) => p.id === 1)!;
    const initial = tables.projects.find((p) => p.id !== 1)!;
    expect(final.sap_import_key).toBe(`${BASE_KEY}|DEADLINE|FINAL`);
    expect(final.initial_deadline).toBeNull();
    expect(final.status).toBe('active');
    expect(initial.sap_import_key).toBe(`${BASE_KEY}|DEADLINE|INITIAL`);
    expect(initial.final_deadline).toBeNull();
    expect(initial.status).toBe('active');

    // Same rows (status, messages) moved, none lost or duplicated.
    expect(tables.projects_assignment).toHaveLength(2);
    expect(tables.projects_assignment.every((a) => a.project_id === initial.id)).toBe(true);
    expect(tables.projects_assignment.find((a) => a.user_id === 'u2')).toMatchObject({
      assignment_status: 'done',
      done_message: 'ok',
    });
  });

  it('completes INITIAL and keeps translators on FINAL when the initial deadline has passed', async () => {
    const tables: Tables = { projects: [legacyRow()], projects_assignment: assignments() };

    const result = await migrate(tables, splitPair(PAST, '2026-10-25T10:00:00.000Z'));

    expect(result.failures).toEqual([]);
    const final = tables.projects.find((p) => p.id === 1)!;
    const initial = tables.projects.find((p) => p.id !== 1)!;
    expect(initial.status).toBe('complete');
    expect(final.status).toBe('active');
    expect(final.initial_deadline).toBeNull();
    expect(tables.projects_assignment.every((a) => a.project_id === 1)).toBe(true);
  });

  it('marks FINAL complete when its own deadline has also passed', async () => {
    const tables: Tables = { projects: [legacyRow()], projects_assignment: assignments() };

    await migrate(tables, splitPair(PAST, '2026-10-05T10:00:00.000Z'));

    expect(tables.projects.find((p) => p.id === 1)!.status).toBe('complete');
    expect(tables.projects.find((p) => p.id !== 1)!.status).toBe('complete');
  });

  it('does not reopen a legacy project that was already completed or cancelled', async () => {
    const tables: Tables = {
      projects: [legacyRow({ status: 'cancelled' })],
      projects_assignment: assignments(),
    };

    await migrate(tables, splitPair(FUTURE, '2026-10-25T10:00:00.000Z'));

    const final = tables.projects.find((p) => p.id === 1)!;
    const initial = tables.projects.find((p) => p.id !== 1)!;
    expect(final.status).toBe('cancelled');
    expect(initial.status).toBe('cancelled');
    expect(tables.projects_assignment.every((a) => a.project_id === 1)).toBe(true);
  });

  it('leaves the legacy row untouched when moving translators fails, and recovers on retry', async () => {
    const tables: Tables = { projects: [legacyRow()], projects_assignment: assignments() };
    const pair = splitPair(FUTURE, '2026-10-25T10:00:00.000Z');

    const failed = await migrate(tables, pair, (table, op) =>
      table === 'projects_assignment' && op === 'update' ? 'blocked by trigger' : null
    );

    expect(failed.failures).toHaveLength(1);
    expect(failed.failures[0].message).toContain('blocked by trigger');
    expect(failed.handledKeys.size).toBe(2); // regular loop must not touch the legacy row
    const legacy = tables.projects.find((p) => p.id === 1)!;
    expect(legacy.sap_import_key).toBe(BASE_KEY);
    expect(legacy.initial_deadline).toBe('2026-10-19T10:00:00.000Z');
    expect(tables.projects_assignment.every((a) => a.project_id === 1)).toBe(true);
    expect(tables.projects).toHaveLength(2); // INITIAL already created

    const retried = await migrate(tables, pair);

    expect(retried.failures).toEqual([]);
    expect(retried.imported).toBe(0); // INITIAL reused, not duplicated
    expect(tables.projects).toHaveLength(2);
    const initial = tables.projects.find((p) => p.id !== 1)!;
    expect(tables.projects_assignment.every((a) => a.project_id === initial.id)).toBe(true);
    expect(tables.projects.find((p) => p.id === 1)!.sap_import_key).toBe(`${BASE_KEY}|DEADLINE|FINAL`);
  });

  it('is a no-op once the project is already split', async () => {
    const tables: Tables = {
      projects: [
        legacyRow({ sap_import_key: `${BASE_KEY}|DEADLINE|FINAL`, initial_deadline: null }),
        legacyRow({ id: 2, sap_import_key: `${BASE_KEY}|DEADLINE|INITIAL`, final_deadline: null }),
      ],
      projects_assignment: [{ project_id: 1, user_id: 'u1', assignment_status: 'claimed' }],
    };

    const result = await migrate(tables, splitPair(FUTURE, '2026-10-25T10:00:00.000Z'));

    expect(result.handledKeys.size).toBe(0);
    expect(result.imported).toBe(0);
    expect(tables.projects).toHaveLength(2);
    expect(tables.projects_assignment[0].project_id).toBe(1);
  });

  it('ignores brand-new projects and projects with a single deadline', async () => {
    const empty: Tables = { projects: [], projects_assignment: [] };
    const fresh = await migrate(empty, splitPair(FUTURE, '2026-10-25T10:00:00.000Z'));
    expect(fresh.handledKeys.size).toBe(0);
    expect(empty.projects).toHaveLength(0);

    const single = await migrate(
      { projects: [legacyRow()], projects_assignment: [] },
      [sapData({ final_deadline: FUTURE })]
    );
    expect(single.handledKeys.size).toBe(0);
  });

  it('after migrating, the regular import path keeps both rows stable (idempotent)', async () => {
    const tables: Tables = { projects: [legacyRow()], projects_assignment: assignments() };
    const pair = splitPair(FUTURE, '2026-10-25T10:00:00.000Z');
    await migrate(tables, pair);
    const snapshot = JSON.stringify(tables);

    const supabase = createFakeSupabase(tables) as never;
    for (const data of pair) {
      const { data: existing } = await findExistingProject(supabase, data);
      expect(existing).not.toBeNull();
      await updateProjectFromSap(supabase, existing!.id, data);
    }

    expect(tables.projects).toHaveLength(2);
    expect(tables.projects_assignment).toEqual(JSON.parse(snapshot).projects_assignment);
    const second = await migrate(tables, pair);
    expect(second.handledKeys.size).toBe(0);
  });
});
