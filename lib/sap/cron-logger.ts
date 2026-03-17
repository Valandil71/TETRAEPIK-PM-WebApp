// /lib/sap/cron-logger.ts
// Persists every cron run to the database for developer/ops visibility.
// Vercel free tier only retains logs for 1 hour — this survives indefinitely.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CronRunLogParams {
  synced: number;
  imported: number;
  failed: number;
  errors: string[];
}

export async function logCronRun(
  supabase: SupabaseClient,
  params: CronRunLogParams,
): Promise<void> {
  const { error } = await supabase.from('cron_run_logs').insert({
    synced:   params.synced,
    imported: params.imported,
    failed:   params.failed,
    errors:   params.errors,
  });

  if (error) {
    // Non-fatal — cron result is already returned; this is best-effort logging
    console.error('[cron-logger] Failed to write cron run log:', error.message);
  }
}
