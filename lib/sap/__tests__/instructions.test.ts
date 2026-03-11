import { describe, expect, it } from 'vitest';
import { buildSapInstructions } from '@/lib/sap/instructions';
import { filterSapInstructions } from '@/lib/sap/instruction-exclusions';
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
});