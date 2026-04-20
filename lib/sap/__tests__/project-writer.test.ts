import { describe, expect, it } from 'vitest';
import { buildSapUpdatePayload, findExistingProject } from '@/lib/sap/project-writer';
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

  it('can preserve existing SAP instructions by omitting sap_instructions', () => {
    const payload = buildSapUpdatePayload(
      {
        ...baseData,
        sap_instructions: [
          {
            instructionShort: 'Short',
            instructionLong: 'Long',
          },
        ],
      },
      { includeSapInstructions: false }
    );

    expect('sap_instructions' in payload).toBe(false);
  });
});

function createSupabaseSequenceMock(results: Array<{ data: unknown; error: unknown }>) {
  let index = 0;

  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.is = () => builder;
  builder.contains = () => builder;
  builder.order = () => builder;
  builder.maybeSingle = async () => results[index++] ?? { data: null, error: null };
  builder.limit = async () => results[index++] ?? { data: null, error: null };

  return {
    from: () => builder,
  };
}

describe('findExistingProject', () => {
  it('does not use legacy fallbacks for initial deadline split projects', async () => {
    const supabase = createSupabaseSequenceMock([
      { data: null, error: null }, // exact maybeSingle
      { data: [{ id: 10 }], error: null }, // would match if fallback ran
    ]);

    const result = await findExistingProject(supabase as never, {
      ...baseData,
      sap_import_key: 'k1|DEADLINE|INITIAL',
      initial_deadline: '2026-04-23T07:00:00.000Z',
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('matches final deadline split projects to the previous unsplit import key', async () => {
    const supabase = createSupabaseSequenceMock([
      { data: null, error: null }, // exact maybeSingle
      { data: { id: 20 }, error: null }, // unsplit import key maybeSingle
    ]);

    const result = await findExistingProject(supabase as never, {
      ...baseData,
      sap_import_key: 'k1|DEADLINE|FINAL',
      final_deadline: '2026-04-27T13:00:00.000Z',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 20 });
  });

  it('uses compatibility fallback when exact and legacy match fail', async () => {
    const supabase = createSupabaseSequenceMock([
      { data: null, error: null }, // exact maybeSingle
      { data: [{ id: 10 }, { id: 11 }], error: null }, // legacy limit(2)
      { data: [{ id: 22 }, { id: 23 }], error: null }, // compatibility limit(2)
    ]);

    const result = await findExistingProject(supabase as never, baseData);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 22 });
  });
});
