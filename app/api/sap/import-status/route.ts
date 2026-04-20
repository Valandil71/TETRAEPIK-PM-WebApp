import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { RATE_LIMIT_MINUTES } from '@/lib/sap/constants';

const SAP_IMPORT_STATUS_ROW_ID = 1;

export async function GET() {
  try {
    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;
    const { supabase, user } = auth;

    const { data: statusRow, error } = await supabase
      .from('sap_import_status')
      .select('status, started_at, finished_at, started_by')
      .eq('id', SAP_IMPORT_STATUS_ROW_ID)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch SAP import status' },
        { status: 500 }
      );
    }

    const { data: rateLimit } = await supabase
      .from('sap_api_rate_limits')
      .select('last_fetch_at')
      .eq('user_id', user.id)
      .maybeSingle();

    let waitMinutes: number | null = null;
    let retryAt: string | null = null;

    if (rateLimit?.last_fetch_at) {
      const lastImport = new Date(rateLimit.last_fetch_at);
      const cooldownMs = RATE_LIMIT_MINUTES * 60 * 1000;
      const elapsed = Date.now() - lastImport.getTime();

      if (elapsed < cooldownMs) {
        waitMinutes = Math.ceil((cooldownMs - elapsed) / 60000);
        retryAt = new Date(lastImport.getTime() + cooldownMs).toISOString();
      }
    }

    return NextResponse.json({
      status: statusRow?.status ?? 'idle',
      startedAt: statusRow?.started_at ?? null,
      finishedAt: statusRow?.finished_at ?? null,
      startedBy: statusRow?.started_by ?? null,
      cooldown: {
        isActive: retryAt !== null,
        waitMinutes,
        retryAt,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP import status');
  }
}
