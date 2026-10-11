import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { createErrorResponse } from '@/lib/sap/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildCompletionPayload,
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
 * Sends "project completed" pushes to PMs/Admins after the client has marked projects complete.
 * One request carries the whole batch, so each PM/Admin gets a single (summarised) notification.
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

    const [{ data: projects, error: projectsError }, { data: users, error: usersError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, project_type')
        .in('id', [...new Set(parsed.data.projectIds)])
        .eq('status', 'complete'),
      supabase.from('users').select('id, role').in('role', ['pm', 'admin']),
    ]);
    if (projectsError) throw new Error(projectsError.message);
    if (usersError) throw new Error(usersError.message);
    if (!projects || projects.length === 0) return NextResponse.json({ sent: 0 });

    const recipients = (users ?? []) as NotificationUser[];
    const admin = createAdminClient();
    const preferences = await loadPreferences(admin, recipients.map((u) => u.id));

    const grouped = groupCompletionsByRecipient(
      projects as NotificationProject[],
      recipients,
      preferences,
      user.id
    );

    const payloads = new Map<string, PushPayload>();
    grouped.forEach((list, userId) => payloads.set(userId, buildCompletionPayload(list)));

    const sent = await sendPushToUsers(admin, payloads);
    return NextResponse.json({ sent });
  } catch (error) {
    return createErrorResponse(error, 'Failed to send completion notifications');
  }
}
