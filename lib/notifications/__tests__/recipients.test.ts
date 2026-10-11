import { describe, expect, it } from 'vitest';
import {
  buildAssignmentDonePayload,
  buildAssignmentPayload,
  buildCompletionPayload,
  groupAssignmentsByRecipient,
  groupCompletionsByRecipient,
  matchesTypeFilter,
  type NotificationProject,
  type NotificationUser,
} from '@/lib/notifications/recipients';

const project = (id: number, project_type: string | null = 'TRA'): NotificationProject => ({
  id,
  name: `Project ${id}`,
  project_type,
});

const users: NotificationUser[] = [
  { id: 'actor', role: 'pm' },
  { id: 'emp', role: 'employee' },
  { id: 'pm', role: 'pm' },
  { id: 'admin', role: 'admin' },
];
const usersById = new Map(users.map((u) => [u.id, u]));

describe('matchesTypeFilter', () => {
  it('treats an empty or missing preference as every type', () => {
    expect(matchesTypeFilter('TRA', [])).toBe(true);
    expect(matchesTypeFilter(null, undefined)).toBe(true);
  });

  it('only matches selected types', () => {
    expect(matchesTypeFilter('TRA', ['TRA', 'REV'])).toBe(true);
    expect(matchesTypeFilter('STM', ['TRA'])).toBe(false);
    expect(matchesTypeFilter(null, ['TRA'])).toBe(false);
  });
});

describe('groupAssignmentsByRecipient', () => {
  const projectsById = new Map([project(1, 'TRA'), project(2, 'STM')].map((p) => [p.id, p]));

  it('never notifies the actor', () => {
    const grouped = groupAssignmentsByRecipient(
      [{ projectId: 1, userId: 'actor' }],
      projectsById,
      usersById,
      new Map(),
      'actor'
    );
    expect(grouped.size).toBe(0);
  });

  it('always notifies collaborators, ignoring any type preference', () => {
    const grouped = groupAssignmentsByRecipient(
      [{ projectId: 2, userId: 'emp' }],
      projectsById,
      usersById,
      new Map([['emp', ['TRA']]]),
      'actor'
    );
    expect(grouped.get('emp')?.map((p) => p.id)).toEqual([2]);
  });

  it('applies the PM/Admin type preference', () => {
    const grouped = groupAssignmentsByRecipient(
      [
        { projectId: 1, userId: 'pm' },
        { projectId: 2, userId: 'pm' },
      ],
      projectsById,
      usersById,
      new Map([['pm', ['TRA']]]),
      'actor'
    );
    expect(grouped.get('pm')?.map((p) => p.id)).toEqual([1]);
  });

  it('groups a bulk assignment into one entry per user', () => {
    const many = Array.from({ length: 50 }, (_, i) => project(i + 1));
    const grouped = groupAssignmentsByRecipient(
      many.map((p) => ({ projectId: p.id, userId: 'emp' })),
      new Map(many.map((p) => [p.id, p])),
      usersById,
      new Map(),
      'actor'
    );
    expect(grouped.size).toBe(1);
    expect(grouped.get('emp')).toHaveLength(50);
    expect(buildAssignmentPayload(grouped.get('emp')!).title).toBe('50 new projects assigned');
  });
});

describe('groupCompletionsByRecipient', () => {
  it('notifies every PM/Admin except the actor, each with their own filter', () => {
    const grouped = groupCompletionsByRecipient(
      [project(1, 'TRA'), project(2, 'STM')],
      users,
      new Map([['pm', ['STM']]]),
      'actor'
    );
    expect([...grouped.keys()].sort()).toEqual(['admin', 'pm']);
    expect(grouped.get('pm')?.map((p) => p.id)).toEqual([2]);
    expect(grouped.get('admin')?.map((p) => p.id)).toEqual([1, 2]);
  });

  it('skips PMs whose filter matches none of the projects', () => {
    const grouped = groupCompletionsByRecipient([project(1, 'TRA')], users, new Map([['pm', ['STM']]]), 'actor');
    expect(grouped.has('pm')).toBe(false);
  });
});

describe('payloads', () => {
  it('links a single project directly', () => {
    expect(buildAssignmentPayload([project(7)])).toEqual({
      title: 'New project assigned',
      body: 'Project 7',
      url: '/project/7',
      tag: 'assignment',
    });
    expect(buildCompletionPayload([project(7)]).url).toBe('/project/7');
  });

  it('summarises several projects', () => {
    const payload = buildCompletionPayload([1, 2, 3, 4, 5].map((id) => project(id)));
    expect(payload).toEqual({
      title: '5 projects completed',
      body: 'Project 1, Project 2, Project 3 +2 more',
      url: '/concluded-projects',
      tag: 'completion',
    });
    expect(buildAssignmentPayload([project(1), project(2)]).url).toBe('/my-projects');
  });
});

describe('buildAssignmentDonePayload', () => {
  it('names the collaborator and links the project', () => {
    expect(buildAssignmentDonePayload([project(9)], 'Xiconi')).toEqual({
      title: 'Xiconi finished a project',
      body: 'Project 9',
      url: '/project/9',
      tag: 'assignment-done',
    });
  });

  it('summarises several projects into one notification', () => {
    const payload = buildAssignmentDonePayload([project(1), project(2)], 'Xiconi');
    expect(payload.title).toBe('Xiconi finished 2 projects');
    expect(payload.url).toBe('/management');
  });
});
