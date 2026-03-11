import { describe, expect, it } from 'vitest';
import { extractGraphIds } from '@/lib/sap/extract-fields';

describe('extractGraphIds', () => {
  it('returns normalized, deduped, sorted graph ids', () => {
    const env = [
      { graphId: [' 20 abc', '10 foo', '20 duplicated '] },
      { graphId: ['3 bar', '10 repeated'] },
    ] as Array<{ graphId: string[] }>;

    const result = extractGraphIds(env as never);

    expect(result).toEqual(['3', '10', '20']);
  });
});

