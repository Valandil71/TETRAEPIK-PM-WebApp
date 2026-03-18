// /app/api/cron/sap-sync/route.ts
// GET: Scheduled sync of all SAP-sourced projects (Vercel cron)

export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSapClient } from '@/lib/sap/client';
import { runCronSync } from '@/lib/sap/importer';
import { logCronRun } from '@/lib/sap/cron-logger';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    const result = await runCronSync(supabase, getSapClient());

    await logCronRun(supabase, {
      synced:   result.synced,
      imported: result.imported,
      failed:   result.failed,
      errors:   result.errors ?? [],
    });

    return NextResponse.json(result);
  } catch (error) {
    if (supabase) {
      await logCronRun(supabase, {
        synced: 0, imported: 0, failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    }
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
