import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { createErrorResponse } from '@/lib/sap/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAssignmentPayload,
  groupAssignmentsByRecipient,
  type NotificationProject,
  type NotificationUser,
  type PushPayload,
} from '@/lib/notifications/recipients';
import { loadPreferences, sendPushToUsers } from '@/lib/notifications/send';

const bodySchema = z.object({
  assignments: z
    .array(z.object({ projectId: z.number().int().positive(), userId: z.string().uuid() }))
    .min(1)
    .max(1000),
});

/**
 * Sends "project assigned" pushes after the client has inserted the assignments.
 * One request carries the whole batch, so each user gets a single (summarised) notification.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    if ('error' in auth) return auth.error;
    const { supabase, user } = auth;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const projectIds = [...new Set(parsed.data.assignments.map((a) => a.projectId))];
    const userIds = [...new Set(parsed.data.assignments.map((a) => a.userId))];

    // Only notify about assignments that really exist.
    const { data: rows, error: rowsError } = await supabase
      .from('projects_assignment')
      .select('project_id, user_id')
      .in('project_id', projectIds)
      .in('user_id', userIds);
    if (rowsError) throw new Error(rowsError.message);

    const existing = new Set((rows ?? []).map((r: { project_id: number; user_id: string }) => `${r.project_id}:${r.user_id}`));
    const assignments = parsed.data.assignments.filter((a) => existing.has(`${a.projectId}:${a.userId}`));
    if (assignments.length === 0) return NextResponse.json({ sent: 0 });

    const [{ data: projects, error: projectsError }, { data: users, error: usersError }] = await Promise.all([
      supabase.from('projects').select('id, name, project_type').in('id', projectIds),
      supabase.from('users').select('id, role').in('id', userIds),
    ]);
    if (projectsError) throw new Error(projectsError.message);
    if (usersError) throw new Error(usersError.message);

    const admin = createAdminClient();
    const preferences = await loadPreferences(admin, userIds);

    const grouped = groupAssignmentsByRecipient(
      assignments,
      new Map(((projects ?? []) as NotificationProject[]).map((p) => [p.id, p])),
      new Map(((users ?? []) as NotificationUser[]).map((u) => [u.id, u])),
      preferences,
      user.id
    );

    const payloads = new Map<string, PushPayload>();
    grouped.forEach((list, userId) => payloads.set(userId, buildAssignmentPayload(list)));

    const sent = await sendPushToUsers(admin, payloads);
    return NextResponse.json({ sent });
  } catch (error) {
    return createErrorResponse(error, 'Failed to send assignment notifications');
  }
}
