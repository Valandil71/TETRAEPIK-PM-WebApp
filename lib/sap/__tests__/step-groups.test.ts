import { describe, expect, it } from 'vitest';
import { mapSapSubProjectToProjects } from '@/lib/sap/step-groups';
import type { SapProject, SapSubProject, SapSubProjectInfo, SapStep } from '@/types/sap';

function buildParent(projectId: number, projectName: string): SapProject {
  return {
    projectId,
    projectName,
    account: 'Account',
    subProjects: [],
  };
}

function buildSubProject(subProjectId: string, subProjectName: string): SapSubProject {
  return {
    subProjectId,
    subProjectName,
    dmName: 'DM',
    pmName: 'PM',
    projectType: 'standard',
  };
}

function buildStep(params: {
  contentId: string;
  slsLang: string;
  sourceLang?: string;
  serviceStep?: string;
  stepText?: string;
  endDate: string;
  volumes?: Array<{ volumeUnit: string; volumeQuantity: number; ceBillQuantity?: number }>;
}): SapStep {
  return {
    contentId: params.contentId,
    serviceStep: params.serviceStep ?? 'TRANSLFWL',
    stepText: params.stepText ?? 'Translate final volume',
    slsLang: params.slsLang,
    sourceLang: params.sourceLang ?? 'enUS',
    tGroup: 'TE',
    startDate: '2026-03-17T00:00:00.000Z',
    endDate: params.endDate,
    hasInstructions: false,
    instructionsLastChangedAt: '',
    subProjectFiles: '',
    volume: (params.volumes ?? []).map((volume) => ({
      volumeUnit: volume.volumeUnit,
      volumeQuantity: volume.volumeQuantity,
      ceBillQuantity: volume.ceBillQuantity ?? volume.volumeQuantity,
      ceBillUnit: volume.volumeUnit,
      activityText: volume.volumeUnit,
    })),
    stepStatusId: '400',
    stepStatusDescription: 'Invoiced',
  };
}

describe('mapSapSubProjectToProjects', () => {
  it('creates separate projects for different target languages under the same contentId', () => {
    const details: SapSubProjectInfo = {
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
          translationArea: ['000053 - CoreSystems: Field Service Management'],
          worklist: ['0001 - WL1 for SOLITT non-ABAP'],
          is_xtm: false,
          content_name: 'UI_weekly_2026CW12',
          external_project_id: '0000000000',
          external_system: '',
        },
      ],
      subProjectSteps: [
        buildStep({
          contentId: '000001',
          slsLang: 'ptBR',
          endDate: '2026-05-19T17:00:00.000Z',
          volumes: [
            { volumeUnit: 'Words', volumeQuantity: 52 },
            { volumeUnit: 'Terms', volumeQuantity: 0 },
          ],
        }),
        buildStep({
          contentId: '000001',
          slsLang: 'ptPT',
          endDate: '2026-05-19T17:00:00.000Z',
          volumes: [{ volumeUnit: 'Words', volumeQuantity: 10 }],
        }),
      ],
    };

    const projects = mapSapSubProjectToProjects(
      buildSubProject('6198-109', 'UI_weekly_2026CW12'),
      buildParent(6198, 'Main Project'),
      details,
      []
    );

    expect(projects).toHaveLength(2);
    expect(projects.every((project) => project.system === 'B0X')).toBe(true);
    expect(projects.map((project) => project.language_out).sort()).toEqual(['ptBR', 'ptPT']);
    expect(projects.every((project) => project.final_deadline?.endsWith('14:00:00.000Z'))).toBe(true);
    expect(projects.every((project) => !project.instructions?.includes('Terms:'))).toBe(true);
  });

  it('subtracts exactly 3 hours from API deadlines even when timezone suffix is missing', () => {
    const details: SapSubProjectInfo = {
      subProjectId: '7777-10',
      subProjectName: 'NoTimezone_Deadline_Check',
      terminologyKey: [],
      environment: [
        {
          contentId: '000001',
          environmentName: 'SAP Translation System - B0X / 000 / SAP',
          toolType: 'SAP',
          toolTypeDescription: 'SAP Translation System',
          projectUrl: '',
          graphId: [],
          lxeProject: [],
          translationArea: [],
          worklist: [],
          is_xtm: false,
          content_name: 'NoTimezone_Deadline_Check',
          external_project_id: '0000000000',
          external_system: '',
        },
      ],
      subProjectSteps: [
        buildStep({
          contentId: '000001',
          slsLang: 'ptBR',
          endDate: '2026-06-10T17:00:00.000',
          volumes: [{ volumeUnit: 'Words', volumeQuantity: 10 }],
        }),
      ],
    };

    const projects = mapSapSubProjectToProjects(
      buildSubProject('7777-10', 'NoTimezone_Deadline_Check'),
      buildParent(7777, 'Timezone Test'),
      details,
      []
    );

    expect(projects).toHaveLength(1);
    expect(projects[0].final_deadline).toBe('2026-06-10T14:00:00.000Z');
  });

  it('merges multiple contentIds into a single project when language pair matches', () => {
    const details: SapSubProjectInfo = {
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
          translationArea: ['000100 - NW UI: SAP GUI for Java 810'],
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
          graphId: ['00117 - SAP GUI: Windows 800'],
          lxeProject: [],
          translationArea: ['000115 - NW UI: SAP GUI for Windows'],
          worklist: ['0001 - WL1 for SOLITT non-ABAP'],
          is_xtm: false,
          content_name: 'Windows_2603',
          external_project_id: '0000000000',
          external_system: '',
        },
      ],
      subProjectSteps: [
        buildStep({
          contentId: '000001',
          slsLang: 'ptBR',
          endDate: '2026-05-18T16:00:00.000Z',
          volumes: [{ volumeUnit: 'Words', volumeQuantity: 19 }],
        }),
        buildStep({
          contentId: '000002',
          slsLang: 'ptBR',
          endDate: '2026-05-18T16:00:00.000Z',
          volumes: [{ volumeUnit: 'Words', volumeQuantity: 113 }],
        }),
      ],
    };

    const projects = mapSapSubProjectToProjects(
      buildSubProject('4852-33', 'Java_Windows_2603'),
      buildParent(4852, 'Main Project'),
      details,
      []
    );

    expect(projects).toHaveLength(1);
    expect(projects[0].sap_import_key).toContain('LANGPAIR');
    expect(projects[0].translation_area).toEqual(['000100', '000115']);
    expect(projects[0].graph_id).toEqual(['00051', '00117']);
    expect(projects[0].words).toBe(132);
    expect(projects[0].final_deadline).toBe('2026-05-18T13:00:00.000Z');
  });

  it('splits a project with both initial and final deadlines into two import projects', () => {
    const details: SapSubProjectInfo = {
      subProjectId: '9010-27',
      subProjectName: 'Process_Insights_UI_2604',
      terminologyKey: [],
      environment: [
        {
          contentId: '000001',
          environmentName: 'XTM for Product',
          toolType: 'XTM_PM',
          toolTypeDescription: 'XTM for Product',
          projectUrl: '3577469140',
          graphId: [],
          lxeProject: [],
          translationArea: [],
          worklist: [],
          is_xtm: true,
          content_name: 'Process_Insights_UI_2603',
          external_project_id: '0000000000',
          external_system: '',
        },
      ],
      subProjectSteps: [
        buildStep({
          contentId: '000001',
          slsLang: 'ptPT',
          serviceStep: 'TRANSLFWL',
          stepText: 'Translate final volume',
          endDate: '2026-04-27T16:00:00.000Z',
        }),
        buildStep({
          contentId: '000001',
          slsLang: 'ptPT',
          serviceStep: 'TRANSLREGU',
          stepText: 'Translate current volume',
          endDate: '2026-04-23T10:00:00.000Z',
        }),
      ],
    };

    const projects = mapSapSubProjectToProjects(
      buildSubProject('9010-27', 'Process_Insights_UI_2604'),
      buildParent(9010, 'Process Insights'),
      details,
      []
    );

    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.name)).toEqual([
      '9010-27: Process Insights | Process_Insights_UI_2604',
      '9010-27: Process Insights | Process_Insights_UI_2604',
    ]);

    const finalProject = projects.find((project) => project.final_deadline);
    const initialProject = projects.find((project) => project.initial_deadline);

    expect(finalProject?.sap_import_key).toBe('STD|XTM|enUS|ptPT|LANGPAIR|DEADLINE|FINAL');
    expect(finalProject?.initial_deadline).toBeNull();
    expect(finalProject?.final_deadline).toBe('2026-04-27T13:00:00.000Z');

    expect(initialProject?.sap_import_key).toBe('STD|XTM|enUS|ptPT|LANGPAIR|DEADLINE|INITIAL');
    expect(initialProject?.initial_deadline).toBe('2026-04-23T07:00:00.000Z');
    expect(initialProject?.final_deadline).toBeNull();
  });
});
