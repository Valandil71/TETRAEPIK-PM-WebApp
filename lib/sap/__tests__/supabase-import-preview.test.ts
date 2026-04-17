import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getSapClient } from '@/lib/sap/client';
import { mapSapSubProjectToProjects } from '@/lib/sap/step-groups';
import type {
  SapInstruction,
  SapProject,
  SapProjectForImport,
  SapSubProject,
  SapSubProjectInfo,
  SapStep,
} from '@/types/sap';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');
const EXPECTED_FILE = path.resolve(FIXTURES_DIR, 'supabase-import-preview.expected.json');
const ARTIFACT_FILE = path.resolve(ARTIFACTS_DIR, 'supabase-import-preview.actual.json');
const SCENARIO_5164_FILE = path.resolve(FIXTURES_DIR, 'subproject-5164-177.json');
const LIVE_5164_FILE = path.resolve(FIXTURES_DIR, 'subproject-5164-177.live.json');

interface ScenarioInput {
  key: string;
  project: SapProject;
  subProject: SapSubProject;
  details: SapSubProjectInfo;
  instructions: SapInstruction[];
}

interface Scenario5164FileShape {
  project: SapProject;
  subProject: SapSubProject;
  details: SapSubProjectInfo;
  instructions: SapInstruction[];
}

function sortNullableArray(values: string[] | null): string[] | null {
  if (!values) return null;
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalizeImportRecord(project: SapProjectForImport) {
  return {
    sap_subproject_id: project.sap_subproject_id,
    sap_import_key: project.sap_import_key,
    name: project.name,
    language_in: project.language_in,
    language_out: project.language_out,
    initial_deadline: project.initial_deadline,
    final_deadline: project.final_deadline,
    instructions: project.instructions,
    sap_instructions: project.sap_instructions,
    system: project.system,
    api_source: project.api_source,
    last_synced_at: '<generated>',
    sap_pm: project.sap_pm,
    project_type: project.project_type,
    terminology_key: sortNullableArray(project.terminology_key),
    lxe_project: sortNullableArray(project.lxe_project),
    translation_area: sortNullableArray(project.translation_area),
    work_list: sortNullableArray(project.work_list),
    graph_id: sortNullableArray(project.graph_id),
    lxe_projects: sortNullableArray(project.lxe_projects),
    url: project.url,
    hours: project.hours,
    words: project.words,
    lines: project.lines,
  };
}

function shiftIsoByHours(iso: string, hours: number): string {
  const date = new Date(iso);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

function assertDeadlinesAreThreeHoursEarlier(
  mappedProjects: SapProjectForImport[],
  steps: SapStep[]
) {
  const adjustedInitialCandidates = new Set<string>();
  const adjustedFinalCandidates = new Set<string>();

  for (const step of steps) {
    if (!step.endDate) continue;
    const adjusted = shiftIsoByHours(step.endDate, -3);

    if (step.serviceStep === 'TRANSLREGU') {
      adjustedInitialCandidates.add(adjusted);
      continue;
    }

    adjustedFinalCandidates.add(adjusted);
  }

  for (const project of mappedProjects) {
    if (project.initial_deadline) {
      expect(adjustedInitialCandidates.has(project.initial_deadline)).toBe(true);
    }
    if (project.final_deadline) {
      expect(adjustedFinalCandidates.has(project.final_deadline)).toBe(true);
    }
  }
}

function sortByImportKey(records: ReturnType<typeof normalizeImportRecord>[]) {
  return [...records].sort((a, b) => a.sap_import_key.localeCompare(b.sap_import_key));
}

async function loadScenario5164():
  Promise<(ScenarioInput & { source: 'fixture' | 'live' }) | null> {
  if (existsSync(SCENARIO_5164_FILE)) {
    const parsed = JSON.parse(readFileSync(SCENARIO_5164_FILE, 'utf8')) as Scenario5164FileShape;
    return {
      key: '5164-177',
      project: parsed.project,
      subProject: parsed.subProject,
      details: parsed.details,
      instructions: parsed.instructions ?? [],
      source: 'fixture',
    };
  }

  if (process.env.SAP_LIVE_TESTS !== '1') {
    return null;
  }

  const client = getSapClient();
  const projectsResponse = await client.getProjects();

  let parentProject: SapProject | null = null;
  let subProject: SapSubProject | null = null;

  for (const project of projectsResponse.projects) {
    const match = project.subProjects.find((candidate) => candidate.subProjectId === '5164-177');
    if (match) {
      parentProject = project;
      subProject = match;
      break;
    }
  }

  if (!parentProject || !subProject) {
    throw new Error('Subproject 5164-177 was not found in SAP projects list.');
  }

  const details = await client.getSubProjectDetails(parentProject.projectId, subProject.subProjectId);
  const needsInstructions = details.subProjectSteps.some((step) => step.hasInstructions);
  const instructions = needsInstructions
    ? (await client.getInstructions(parentProject.projectId, subProject.subProjectId)).instructions
    : [];

  const liveFixturePayload: Scenario5164FileShape = {
    project: parentProject,
    subProject,
    details,
    instructions,
  };

  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(LIVE_5164_FILE, JSON.stringify(liveFixturePayload, null, 2), 'utf8');

  return {
    key: '5164-177',
    project: parentProject,
    subProject,
    details,
    instructions,
    source: 'live',
  };
}

const scenario6198: ScenarioInput = {
  key: '6198-109',
  project: {
    projectId: 6198,
    projectName: 'Core Systems UI',
    account: 'Account',
    subProjects: [],
  },
  subProject: {
    subProjectId: '6198-109',
    subProjectName: 'UI_weekly_2026CW12',
    dmName: 'PM_6198',
    pmName: 'PM_6198',
    projectType: 'translation',
  },
  details: {
    subProjectId: '6198-109',
    subProjectName: 'UI_weekly_2026CW12',
    terminologyKey: [],
    environment: [
      {
        contentId: '000001',
        environmentName: 'SAP Translation System - B0X / 000 / SAP',
        toolType: 'SAP',
        toolTypeDescription: 'SAP Translation System',
        projectUrl: '',
        graphId: ['00587 - Coresystems', '00621 - Coresystems_dotnet_WebApp'],
        lxeProject: [],
        translationArea: [
          '000053 - CoreSystems: Field Service Management [TEW] (1880560371)',
        ],
        worklist: ['0001 - WL1 for SOLITT non-ABAP'],
        is_xtm: false,
        content_name: 'UI_weekly_2026CW12',
        external_project_id: '0000000000',
        external_system: '',
      },
    ],
    subProjectSteps: [
      {
        contentId: '000001',
        serviceStep: 'TRANSLFWL',
        stepText: 'Translate final volume',
        slsLang: 'ptBR',
        sourceLang: 'enUS',
        tGroup: 'TE',
        startDate: '2026-03-17T00:00:00.000Z',
        endDate: '2026-03-19T17:00:00.000Z',
        hasInstructions: false,
        instructionsLastChangedAt: '',
        subProjectFiles: '',
        volume: [
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0,
            ceBillUnit: 'Hours',
            activityText: 'Other hourly-based activities in translation project',
          },
          {
            volumeQuantity: 0,
            volumeUnit: 'Terms',
            ceBillQuantity: 0,
            ceBillUnit: 'Terms',
            activityText: 'Translate terminology during translation',
          },
          {
            volumeQuantity: 52,
            volumeUnit: 'Words',
            ceBillQuantity: 52,
            ceBillUnit: 'Words',
            activityText: 'Translate long texts',
          },
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0.5,
            ceBillUnit: 'Hours',
            activityText: 'Automated minimum charge',
          },
        ],
        stepStatusId: '400',
        stepStatusDescription: 'Invoiced',
      },
      {
        contentId: '000001',
        serviceStep: 'TRANSLFWL',
        stepText: 'Translate final volume',
        slsLang: 'ptPT',
        sourceLang: 'enUS',
        tGroup: 'TE',
        startDate: '2026-03-17T00:00:00.000Z',
        endDate: '2026-03-19T17:00:00.000Z',
        hasInstructions: false,
        instructionsLastChangedAt: '',
        subProjectFiles: '',
        volume: [],
        stepStatusId: '400',
        stepStatusDescription: 'Invoiced',
      },
    ],
  },
  instructions: [],
};

const scenario4852: ScenarioInput = {
  key: '4852-33',
  project: {
    projectId: 4852,
    projectName: 'SAP GUI',
    account: 'Account',
    subProjects: [],
  },
  subProject: {
    subProjectId: '4852-33',
    subProjectName: 'Java_Windows_2603',
    dmName: 'PM_4852',
    pmName: 'PM_4852',
    projectType: 'translation',
  },
  details: {
    subProjectId: '4852-33',
    subProjectName: 'Java_Windows_2603',
    terminologyKey: [],
    environment: [
      {
        contentId: '000001',
        environmentName: 'SAP Translation System - B0X / 000 / SAP',
        toolType: 'SAP',
        toolTypeDescription: 'SAP Translation System',
        projectUrl: '',
        graphId: ['00051 - SAP GUI: Java'],
        lxeProject: [],
        translationArea: [
          '000100 - NW UI: SAP GUI for Java 810',
          '000106 - NW UI: SAP GUI for Java 820',
        ],
        worklist: ['0001 - WL1 for SOLITT non-ABAP'],
        is_xtm: false,
        content_name: 'Java_2603',
        external_project_id: '0000000000',
        external_system: '',
      },
      {
        contentId: '000002',
        environmentName: 'SAP Translation System - B0X / 000 / SAP',
        toolType: 'SAP',
        toolTypeDescription: 'SAP Translation System',
        projectUrl: '',
        graphId: ['00117 - SAP GUI: Windows 800', '00128 - SAP GUI: Windows 810<<'],
        lxeProject: [],
        translationArea: [
          '000115 - NW UI: SAP GUI for Windows [TEW] !Strict Length Check! (2180141297)',
        ],
        worklist: ['0001 - WL1 for SOLITT non-ABAP'],
        is_xtm: false,
        content_name: 'Windows_2603',
        external_project_id: '0000000000',
        external_system: '',
      },
    ],
    subProjectSteps: [
      {
        contentId: '000001',
        serviceStep: 'TRANSLFWL',
        stepText: 'Translate final volume',
        slsLang: 'ptBR',
        sourceLang: 'enUS',
        tGroup: 'TE',
        startDate: '2026-03-16T00:00:00.000Z',
        endDate: '2026-03-18T16:00:00.000Z',
        hasInstructions: true,
        instructionsLastChangedAt: '',
        subProjectFiles: '',
        volume: [
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0,
            ceBillUnit: 'Hours',
            activityText: 'Other hourly-based activities in translation project',
          },
          {
            volumeQuantity: 19,
            volumeUnit: 'Words',
            ceBillQuantity: 19,
            ceBillUnit: 'Words',
            activityText: 'Translate long texts',
          },
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0.5,
            ceBillUnit: 'Hours',
            activityText: 'Automated minimum charge',
          },
        ],
        stepStatusId: '400',
        stepStatusDescription: 'Invoiced',
      },
      {
        contentId: '000002',
        serviceStep: 'TRANSLFWL',
        stepText: 'Translate final volume',
        slsLang: 'ptBR',
        sourceLang: 'enUS',
        tGroup: 'TE',
        startDate: '2026-03-16T00:00:00.000Z',
        endDate: '2026-03-18T16:00:00.000Z',
        hasInstructions: true,
        instructionsLastChangedAt: '',
        subProjectFiles: '',
        volume: [
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0,
            ceBillUnit: 'Hours',
            activityText: 'Other hourly-based activities in translation project',
          },
          {
            volumeQuantity: 113,
            volumeUnit: 'Words',
            ceBillQuantity: 113,
            ceBillUnit: 'Words',
            activityText: 'Translate long texts',
          },
          {
            volumeQuantity: 0,
            volumeUnit: 'Hours',
            ceBillQuantity: 0.5,
            ceBillUnit: 'Hours',
            activityText: 'Automated minimum charge',
          },
        ],
        stepStatusId: '400',
        stepStatusDescription: 'Invoiced',
      },
    ],
  },
  instructions: [],
};

describe('Supabase import preview export', () => {
  it('writes a file with mapped import payload and validates expected output', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    try {
      const scenarios = [scenario6198, scenario4852];

      const mappedByScenario: Record<string, ReturnType<typeof normalizeImportRecord>[]> = {};
      for (const scenario of scenarios) {
        const mapped = mapSapSubProjectToProjects(
          scenario.subProject,
          scenario.project,
          scenario.details,
          scenario.instructions
        );

        expect(mapped.some((project) => project.system === 'STM')).toBe(false);
        assertDeadlinesAreThreeHoursEarlier(mapped, scenario.details.subProjectSteps);

        mappedByScenario[scenario.key] = sortByImportKey(
          mapped.map((project) => normalizeImportRecord(project))
        );
      }

      const expected = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8')) as Record<
        string,
        ReturnType<typeof normalizeImportRecord>[]
      >;

      expect(mappedByScenario['6198-109']).toEqual(expected['6198-109']);
      expect(mappedByScenario['4852-33']).toEqual(expected['4852-33']);

      let scenario5164Artifact:
        | {
            status: 'not-run';
            reason: string;
          }
        | {
            status: 'checked';
            source: 'fixture' | 'live';
            containsSTM: boolean;
            mappedProjects: ReturnType<typeof normalizeImportRecord>[];
          };

      let scenario5164: (ScenarioInput & { source: 'fixture' | 'live' }) | null = null;
      let scenario5164Error: string | null = null;

      try {
        scenario5164 = await loadScenario5164();
      } catch (error) {
        scenario5164Error = error instanceof Error ? error.message : String(error);
      }

      if (!scenario5164) {
        scenario5164Artifact = {
          status: 'not-run',
          reason: scenario5164Error
            ?? 'Provide fixture at lib/sap/__tests__/fixtures/subproject-5164-177.json or run with SAP_LIVE_TESTS=1.',
        };
      } else {
        const mapped5164 = mapSapSubProjectToProjects(
          scenario5164.subProject,
          scenario5164.project,
          scenario5164.details,
          scenario5164.instructions
        );

        assertDeadlinesAreThreeHoursEarlier(mapped5164, scenario5164.details.subProjectSteps);
        const containsSTM = mapped5164.some((project) => project.system === 'STM');
        expect(containsSTM).toBe(false);

        scenario5164Artifact = {
          status: 'checked',
          source: scenario5164.source,
          containsSTM,
          mappedProjects: sortByImportKey(
            mapped5164.map((project) => normalizeImportRecord(project))
          ),
        };
      }

      mkdirSync(ARTIFACTS_DIR, { recursive: true });
      writeFileSync(
        ARTIFACT_FILE,
        `${JSON.stringify(
          {
            generated_at: new Date().toISOString(),
            scenarios: mappedByScenario,
            subproject_5164_177: scenario5164Artifact,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
