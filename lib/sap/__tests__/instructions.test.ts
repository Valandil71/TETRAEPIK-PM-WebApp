import { describe, expect, it } from 'vitest';
import {
  attachSapInstructionHtml,
  buildInstructions,
  buildSapInstructions,
  splitSapInstructionHtml,
} from '@/lib/sap/instructions';
import { filterSapInstructions, toInstructionExclusionSet } from '@/lib/sap/instruction-exclusions';
import {
  normalizeInstructionText,
  normalizeInstructionTextForMatch,
} from '@/lib/sap/instruction-normalization';

describe('instruction normalization', () => {
  it('normalizes HTML, entities, and whitespace for matching', () => {
    const raw = '<p>Hello&nbsp;&nbsp;World</p>\n\nLine 2';
    expect(normalizeInstructionText(raw)).toBe('Hello World Line 2');
    expect(normalizeInstructionTextForMatch(raw)).toBe('hello world line 2');
  });

  it('buildSapInstructions deduplicates normalized SAP instructions', () => {
    const instructions = [
      {
        subProjectId: 'SP1',
        contentId: 'CID1',
        serviceStep: 'TRANSLREGU',
        slsLang: 'en',
        lastChangedAt: '2026-01-01T00:00:00.000Z',
        instructionShort: '<b>Do this</b>',
        instructionLong: '<p>Hello&nbsp;World</p>',
        isTemplate: false,
        deleted: false,
      },
      {
        subProjectId: 'SP1',
        contentId: 'CID2',
        serviceStep: 'TRANSLREGU',
        slsLang: 'en',
        lastChangedAt: '2026-01-01T00:00:00.000Z',
        instructionShort: 'Do this',
        instructionLong: 'Hello   World',
        isTemplate: false,
        deleted: false,
      },
    ];

    const result = buildSapInstructions(instructions);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result?.[0].instructionLong).toBe('Hello World');
  });

  it('filterSapInstructions hides normalized exact matches', () => {
    const visible = filterSapInstructions(
      [
        { instructionShort: 'A', instructionLong: '<p>Hello&nbsp;World</p>' },
        { instructionShort: 'B', instructionLong: 'Keep this' },
      ],
      new Set(['hello world'])
    );

    expect(visible).toHaveLength(1);
    expect(visible[0].long).toBe('Keep this');
  });

  it('does not include terms or hours in composed instructions', () => {
    const composed = buildInstructions({
      translationAreas: ['000053'],
      lxeProjects: [],
      graphIds: ['00587'],
      hours: 2,
      terms: 4,
      terminologyKeys: [],
      workLists: ['0001'],
      system: 'B0X',
    });

    expect(composed).toContain('TA: 000053');
    expect(composed).not.toContain('Terms:');
    expect(composed).not.toContain('Hours:');
  });

  it('decodes named and numeric HTML entities', () => {
    expect(normalizeInstructionText('we&rsquo;re &#34;live&#34; Friday&ndash;Monday &amp; more')).toBe(
      'we’re "live" Friday–Monday & more'
    );
  });

  it('keeps the SAP HTML body next to the plain text', () => {
    const [entry] = buildSapInstructions([
      {
        subProjectId: 'SP1',
        contentId: 'CID1',
        serviceStep: 'TRANSLFWL',
        slsLang: 'ptBR',
        lastChangedAt: '2026-10-22T06:02:31.000Z',
        instructionShort: 'Weekly cycle',
        instructionLong: '<ol><li><strong>Deadline:</strong>&nbsp;Monday</li></ol>',
        isTemplate: false,
        deleted: false,
      },
      {
        subProjectId: 'SP1',
        contentId: 'CID1',
        serviceStep: 'TRANSLFWL',
        slsLang: 'ptBR',
        lastChangedAt: '2026-10-22T06:02:31.000Z',
        instructionShort: 'Plain',
        instructionLong: 'No markup here',
        isTemplate: false,
        deleted: false,
      },
    ])!;

    expect(entry.instructionLong).toBe('Deadline: Monday');
    expect(entry.instructionLongHtml).toBe('<ol><li><strong>Deadline:</strong>&nbsp;Monday</li></ol>');
  });

  it('splits HTML into its own column and attaches it back in order', () => {
    const entries = [
      { instructionShort: 'A', instructionLong: 'a', instructionLongHtml: '<p>a</p>' },
      { instructionShort: 'B', instructionLong: 'b' },
    ];
    const { sap_instructions, sap_instructions_html } = splitSapInstructionHtml(entries);

    expect(sap_instructions).toEqual([
      { instructionShort: 'A', instructionLong: 'a' },
      { instructionShort: 'B', instructionLong: 'b' },
    ]);
    expect(sap_instructions_html).toEqual(['<p>a</p>', null]);
    expect(attachSapInstructionHtml(sap_instructions, sap_instructions_html)).toEqual(entries);
    expect(splitSapInstructionHtml([{ instructionShort: 'B', instructionLong: 'b' }]).sap_instructions_html).toBeNull();
  });

  it('exclusions saved before entities were decoded still hide their instruction', () => {
    const exclusionSet = toInstructionExclusionSet([
      {
        normalized_text: 'in accordance with sap&rsquo;s recent guidance',
        raw_text: 'In accordance with SAP&rsquo;s recent guidance',
      },
    ]);
    const visible = filterSapInstructions(
      [
        { instructionShort: 'Old row', instructionLong: 'In accordance with SAP&rsquo;s recent guidance' },
        { instructionShort: 'New row', instructionLong: 'In accordance with SAP’s recent guidance' },
        { instructionShort: 'Other', instructionLong: 'Keep me', instructionLongHtml: '<p>Keep me</p>' },
      ],
      exclusionSet
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ long: 'Keep me', html: '<p>Keep me</p>' });
  });
});
