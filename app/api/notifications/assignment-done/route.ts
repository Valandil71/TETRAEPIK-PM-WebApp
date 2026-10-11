import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { createErrorResponse } from '@/lib/sap/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAssignmentDonePayload,
  groupCompletionsByRecipient,
  type NotificationProject,
  type NotificationUser,
  type PushPayload,
} from '@/lib/notifications/recipients';
import { loadPreferences, sendPushToUsers } from '@/lib/notifications/send';

const bodySchema = z.object({
  projectIds: z.array(z.number().int().positive()).min(1).max(1000),
});

/**
 * Tells PMs/Admins that a collaborator marked their part of one or more projects as done.
 * Any signed-in user may call it, but only for their own assignments that are really "done".
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;
    const { supabase, user } = auth;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from('projects_assignment')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('assignment_status', 'done')
      .in('project_id', [...new Set(parsed.data.projectIds)]);
    if (rowsError) throw new Error(rowsError.message);

    const projectIds = (rows ?? []).map((r: { project_id: number }) => r.project_id);
    if (projectIds.length === 0) return NextResponse.json({ sent: 0 });

    const [
      { data: projects, error: projectsError },
      { data: users, error: usersError },
      { data: actor, error: actorError },
    ] = await Promise.all([
      supabase.from('projects').select('id, name, project_type').in('id', projectIds),
      supabase.from('users').select('id, role').in('role', ['pm', 'admin']),
      supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
    ]);
    if (projectsError) throw new Error(projectsError.message);
    if (usersError) throw new Error(usersError.message);
    if (actorError) throw new Error(actorError.message);

    const recipients = (users ?? []) as NotificationUser[];
    const admin = createAdminClient();
    const preferences = await loadPreferences(admin, recipients.map((u) => u.id));

    const grouped = groupCompletionsByRecipient(
      (projects ?? []) as NotificationProject[],
      recipients,
      preferences,
      user.id
    );

    const translatorName = (actor?.name as string | undefined) || 'A collaborator';
    const payloads = new Map<string, PushPayload>();
    grouped.forEach((list, userId) => payloads.set(userId, buildAssignmentDonePayload(list, translatorName)));

    const sent = await sendPushToUsers(admin, payloads);
    return NextResponse.json({ sent });
  } catch (error) {
    return createErrorResponse(error, 'Failed to send assignment done notifications');
  }
}
