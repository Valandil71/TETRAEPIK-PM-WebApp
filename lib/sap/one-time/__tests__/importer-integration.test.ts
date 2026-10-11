// ONE-TIME-USE: delete together with lib/sap/one-time/ after the first production import.

import { describe, expect, it } from 'vitest';
import { runManualImport } from '@/lib/sap/importer';
import { createFakeSupabase, type Tables } from './fake-supabase';

const SUB_ID = '5164-192';

function buildSapClient(initialAvailableOn: string, endDate: string) {
  const subProject = { subProjectId: SUB_ID, subProjectName: 'N', projectType: 'x', dmName: '' };
  const parent = { projectId: 5164, projectName: 'P', subProjects: [subProject] };
  const details = {
    subProjectId: SUB_ID,
    subProjectName: 'N',
    terminologyKey: [],
    environment: [
      {
        contentId: '000001', environmentName: 'SAP Translation System - SSE / 000 / SAP', toolType: 'SAP',
        toolTypeDescription: '', projectUrl: '', graphId: [], lxeProject: [], translationArea: ['CHR000 - TA'],
        worklist: [], is_xtm: false, content_name: 'c', external_project_id: '1', external_system: '',
      },
    ],
    subProjectSteps: [
      {
        contentId: '000001', sourceLang: 'enUS', slsLang: 'ptBR', serviceStep: 'TRANSLDYN', stepText: 't',
        endDate, finalVolumeAvailableOn: initialAvailableOn, hasInstructions: false,
        volume: [{ volumeUnit: 'Words', volumeQuantity: 5 }],
      },
    ],
  };
  return {
    getProjects: async () => ({ projects: [parent] }),
    getSubProjectDetails: async () => details,
    getInstructions: async () => ({ instructions: [] }),
  };
}

function legacyTables(): Tables {
  return {
    projects: [
      {
        id: 1, sap_subproject_id: SUB_ID, sap_import_key: 'STD|SSE|enUS|ptBR|TA|CHR000', system: 'SSE',
        language_in: 'enUS', language_out: 'ptBR', translation_area: ['CHR000'], status: 'active',
        initial_deadline: '2099-01-01T00:00:00.000Z', final_deadline: '2099-02-01T00:00:00.000Z', name: 'old',
      },
    ],
    projects_assignment: [{ project_id: 1, user_id: 'u1', assignment_status: 'claimed' }],
    import_reports: [],
  };
}

async function run(tables: Tables, client: ReturnType<typeof buildSapClient>) {
  return runManualImport({
    supabase: createFakeSupabase(tables) as never,
    sapClient: client as never,
    projects: [{ projectId: 5164, subProjectId: SUB_ID }],
    userId: 'pm',
  });
}

describe('runManualImport with the one-time deadline split migration', () => {
  it('upcoming initial deadline: translators move to INITIAL, report lists new + modified, second import is stable', async () => {
    const tables = legacyTables();
    const client = buildSapClient('2099-01-10T00:00:00.000Z', '2099-02-10T00:00:00.000Z');

    const first = await run(tables, client);

    expect(first.failed).toBe(0);
    expect(first.imported).toBe(1);
    expect(tables.projects).toHaveLength(2);
    const initial = tables.projects.find((p) => p.id !== 1)!;
    expect(initial.sap_import_key.endsWith('|DEADLINE|INITIAL')).toBe(true);
    expect(tables.projects.find((p) => p.id === 1)!.sap_import_key.endsWith('|DEADLINE|FINAL')).toBe(true);
    expect(tables.projects_assignment).toEqual([{ project_id: initial.id, user_id: 'u1', assignment_status: 'claimed' }]);
    expect(tables.import_reports).toHaveLength(1);
    expect(tables.import_reports[0].new_projects).toHaveLength(1);

    const second = await run(tables, client);

    expect(second.failed).toBe(0);
    expect(second.imported).toBe(0);
    expect(tables.projects).toHaveLength(2);
    expect(tables.projects_assignment[0].project_id).toBe(initial.id);
  });

  it('passed initial deadline: INITIAL is complete, translators stay on FINAL', async () => {
    const tables = legacyTables();

    const result = await run(tables, buildSapClient('2020-01-10T00:00:00.000Z', '2099-02-10T00:00:00.000Z'));

    expect(result.failed).toBe(0);
    expect(tables.projects).toHaveLength(2);
    expect(tables.projects.find((p) => p.id !== 1)!.status).toBe('complete');
    expect(tables.projects.find((p) => p.id === 1)!.status).toBe('active');
    expect(tables.projects_assignment[0].project_id).toBe(1);
  });
});
