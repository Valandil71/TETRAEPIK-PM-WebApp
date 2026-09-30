import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys.projectsWithTranslators', () => {
  it('invalidating without arguments refreshes every project list variant', async () => {
    const queryClient = new QueryClient();
    const lists = [
      queryKeys.projectsWithTranslators(false, true, false), // management, workload, home
      queryKeys.projectsWithTranslators(false, true, true), // concluded, invoicing
      queryKeys.projectsWithTranslators(false, false, false), // project table
    ];
    lists.forEach((key) => queryClient.setQueryData(key, []));

    await queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });

    lists.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('keeps list variants as distinct cache entries', () => {
    expect(queryKeys.projectsWithTranslators(false, true, false)).not.toEqual(
      queryKeys.projectsWithTranslators(false, true, true)
    );
  });
});
