// /app/api/sap/sync/route.ts
// POST: Import SAP subprojects to local database (thin controller)

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/sap/errors';
import { RATE_LIMIT_MINUTES } from '@/lib/sap/constants';
import { ensureSapImportStatusRow, getSapImportStatus, acquireSapImportLock, finalizeSapImportStatus } from '@/lib/sap/import-lock';
import { getSapClient } from '@/lib/sap/client';
import { runManualImport } from '@/lib/sap/importer';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { sapSyncRequestSchema } from '@/types/sap';

export async function POST(request: NextRequest) {
  let supabase: ReturnType<typeof createServerClient> | null = null;
  let lockAcquired = false;
  try {
    const rawBody = await request.json();
    const parsed = sapSyncRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const body = parsed.data;

    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;
    supabase = auth.supabase;
    const { user } = auth;

    const { error: ensureStatusError } = await ensureSapImportStatusRow(supabase);
    if (ensureStatusError) {
      return NextResponse.json({ error: 'Failed to initialize SAP import status' }, { status: 500 });
    }

    const { data: importStatus, error: importStatusError } = await getSapImportStatus(supabase);
    if (importStatusError) {
      return NextResponse.json({ error: 'Failed to fetch SAP import status' }, { status: 500 });
    }
    if (importStatus?.status === 'running') {
      return NextResponse.json(
        { error: 'import_in_progress', startedAt: importStatus.started_at ?? null },
        { status: 409 }
      );
    }

    const { data: rateLimit } = await supabase
      .from('sap_api_rate_limits')
      .select('last_fetch_at')
      .eq('user_id', user.id)
      .single();

    if (rateLimit?.last_fetch_at) {
      const lastImport = new Date(rateLimit.last_fetch_at);
      const cooldownMs = RATE_LIMIT_MINUTES * 60 * 1000;
      const elapsed = Date.now() - lastImport.getTime();

      if (elapsed < cooldownMs) {
        const waitMinutes = Math.ceil((cooldownMs - elapsed) / 60000);
        const retryAt = new Date(lastImport.getTime() + cooldownMs).toISOString();
        return NextResponse.json(
          { error: 'rate_limited', waitMinutes, retryAt },
          { status: 429 }
        );
      }
    }

    const { data: lockRow, error: lockError } = await acquireSapImportLock(supabase, user.id);
    if (lockError) {
      return NextResponse.json({ error: 'Failed to acquire SAP import lock' }, { status: 500 });
    }
    if (!lockRow) {
      const { data: latestStatus } = await getSapImportStatus(supabase);
      return NextResponse.json(
        { error: 'import_in_progress', startedAt: latestStatus?.started_at ?? null },
        { status: 409 }
      );
    }
    lockAcquired = true;

    const result = await runManualImport({
      supabase,
      sapClient: getSapClient(),
      projects: body.projects,
      userId: user.id,
    });

    if (result.hadSuccessfulSync) {
      await supabase
        .from('sap_api_rate_limits')
        .upsert({ user_id: user.id, last_fetch_at: new Date().toISOString() });
    }

    const { error: finalizeError } = await finalizeSapImportStatus(supabase, 'idle');
    if (finalizeError) {
      console.error('Failed to finalize SAP import status:', finalizeError.message);
    }
    lockAcquired = false;

    const { hadSuccessfulSync, ...response } = result;
    void hadSuccessfulSync;
    return NextResponse.json(response);
  } catch (error) {
    if (lockAcquired && supabase) {
      const { error: finalizeError } = await finalizeSapImportStatus(
        supabase,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      if (finalizeError) {
        console.error('Failed to mark SAP import as failed:', finalizeError.message);
      }
    }

    return createErrorResponse(error, 'Failed to sync SAP projects');
  }
}