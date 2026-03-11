// /lib/sap/import-lock.ts
// Import lock/status operations for the sap_import_status singleton row

import type { SupabaseClient } from '@supabase/supabase-js';
import { LOCK_TTL_MINUTES, SAP_IMPORT_STATUS_ROW_ID } from './constants';

export async function ensureSapImportStatusRow(supabase: SupabaseClient) {
  const { data: existing, error } = await supabase
    .from('sap_import_status')
    .select('id')
    .eq('id', SAP_IMPORT_STATUS_ROW_ID)
    .maybeSingle();

  if (error || existing) {
    return { data: existing, error };
  }

  return supabase
    .from('sap_import_status')
    .insert({ id: SAP_IMPORT_STATUS_ROW_ID, status: 'idle' })
    .select('id')
    .single();
}

export async function getSapImportStatus(supabase: SupabaseClient) {
  return supabase
    .from('sap_import_status')
    .select('status, started_at, finished_at, started_by')
    .eq('id', SAP_IMPORT_STATUS_ROW_ID)
    .maybeSingle();
}

export async function acquireSapImportLock(
  supabase: SupabaseClient,
  userId: string,
) {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - LOCK_TTL_MINUTES * 60 * 1000);

  const { data: statusRow, error: statusError } = await supabase
    .from('sap_import_status')
    .select('status, started_at')
    .eq('id', SAP_IMPORT_STATUS_ROW_ID)
    .maybeSingle();

  if (statusError) {
    return { data: null, error: statusError };
  }

  if (!statusRow) {
    return { data: null, error: null };
  }

  const updatePayload = {
    status: 'running',
    started_at: now.toISOString(),
    finished_at: null,
    started_by: userId,
    last_error: null,
    updated_at: now.toISOString(),
  };

  const startedAt = statusRow.started_at ? new Date(statusRow.started_at) : null;
  const isFreshRunning =
    statusRow.status === 'running' &&
    startedAt !== null &&
    startedAt >= staleCutoff;

  if (isFreshRunning) {
    return { data: null, error: null };
  }

  if (statusRow.status === 'running') {
    // Stale running lock recovery using compare-and-set on previous started_at value.
    const query = supabase
      .from('sap_import_status')
      .update(updatePayload)
      .eq('id', SAP_IMPORT_STATUS_ROW_ID)
      .eq('status', 'running');

    const guardedQuery = startedAt
      ? query.eq('started_at', statusRow.started_at)
      : query.is('started_at', null);

    return guardedQuery
      .select('started_at')
      .maybeSingle();
  }

  return supabase
    .from('sap_import_status')
    .update(updatePayload)
    .eq('id', SAP_IMPORT_STATUS_ROW_ID)
    .neq('status', 'running')
    .select('started_at')
    .maybeSingle();
}

export async function finalizeSapImportStatus(
  supabase: SupabaseClient,
  status: 'idle' | 'failed',
  errorMessage?: string,
) {
  return supabase
    .from('sap_import_status')
    .update({
      status,
      finished_at: new Date().toISOString(),
      last_error: status === 'failed' ? errorMessage ?? 'Unknown error' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', SAP_IMPORT_STATUS_ROW_ID);
}
