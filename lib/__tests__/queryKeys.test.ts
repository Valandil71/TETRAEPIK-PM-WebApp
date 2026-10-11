import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

describe('queryKeys.projectsWithTranslators', () => {
  it('invalidating without arguments refreshes every project list variant', async () => {
    const queryClient = new QueryClient();
    const lists = [
      queryKeys.projectsWithTranslators(false, true, "active"), // management, workload, home
      queryKeys.projectsWithTranslators(false, true, "complete"), // concluded, invoicing
      queryKeys.projectsWithTranslators(false, false, "active"), // project table
    ];
    lists.forEach((key) => queryClient.setQueryData(key, []));

    await queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithTranslators() });

    lists.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('keeps list variants as distinct cache entries', () => {
    expect(queryKeys.projectsWithTranslators(false, true, "active")).not.toEqual(
      queryKeys.projectsWithTranslators(false, true, "complete")
    );
  });
});
