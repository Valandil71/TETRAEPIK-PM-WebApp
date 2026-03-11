import { describe, expect, it } from 'vitest';
import { collectTrackedChanges } from '@/lib/sap/sync-utils';

describe('collectTrackedChanges', () => {
  it('ignores graph_id order-only changes', () => {
    const current = {
      graph_id: ['10', '20', '3'],
      instructions: 'Graph ID: 3, 10, 20',
    };

    const incoming = {
      graph_id: ['3', '10', '20'],
      instructions: 'Graph ID: 3, 10, 20',
    };

    const changes = collectTrackedChanges(current, incoming, ['graph_id', 'instructions']);

    expect(changes).toEqual({});
  });

  it('still reports real graph_id changes', () => {
    const current = { graph_id: ['10', '20'] };
    const incoming = { graph_id: ['10', '30'] };

    const changes = collectTrackedChanges(current, incoming, ['graph_id']);

    expect(changes.graph_id).toBeDefined();
  });
});
