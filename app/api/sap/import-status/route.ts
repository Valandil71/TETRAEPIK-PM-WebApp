import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';

const SAP_IMPORT_STATUS_ROW_ID = 1;

export async function GET() {
  try {
    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;
    const { supabase } = auth;

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

    return NextResponse.json({
      status: statusRow?.status ?? 'idle',
      startedAt: statusRow?.started_at ?? null,
      finishedAt: statusRow?.finished_at ?? null,
      startedBy: statusRow?.started_by ?? null,
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP import status');
  }
}
