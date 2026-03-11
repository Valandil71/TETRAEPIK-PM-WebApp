import { describe, expect, it } from 'vitest';
import { buildSapUpdatePayload } from '@/lib/sap/project-writer';
import type { SapProjectForImport } from '@/types/sap';

const baseData: SapProjectForImport = {
  sap_subproject_id: 'sp-1',
  sap_import_key: 'k1',
  name: 'Project',
  language_in: 'EN',
  language_out: 'PT',
  initial_deadline: null,
  final_deadline: null,
  instructions: null,
  sap_instructions: null,
  system: 'XTM',
  api_source: 'TPM_sap_api',
  last_synced_at: new Date().toISOString(),
  sap_pm: null,
  project_type: null,
  terminology_key: null,
  lxe_project: null,
  translation_area: null,
  work_list: null,
  graph_id: null,
  lxe_projects: null,
  url: null,
  hours: null,
  words: 1200,
  lines: 100,
};

describe('buildSapUpdatePayload', () => {
  it('includes words and lines by default', () => {
    const payload = buildSapUpdatePayload(baseData);
    expect(payload.words).toBe(1200);
    expect(payload.lines).toBe(100);
  });

  it('excludes words and lines when includeVolumes is false', () => {
    const payload = buildSapUpdatePayload(baseData, { includeVolumes: false });
    expect('words' in payload).toBe(false);
    expect('lines' in payload).toBe(false);
  });
});
