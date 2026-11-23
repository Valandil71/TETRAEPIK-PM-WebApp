// /lib/logging/errorLog.ts
// Saves server-side API errors to Supabase (public.app_error_logs), because Vercel Hobby only
// keeps function logs for 1 hour. Server-only: uses the admin (service role) client.
//
// Logging never throws and never delays the response: rows are written after the response
// is sent (next/server `after`). Secrets (tokens, passwords, auth headers) are never stored.

import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUpstreamDetails } from '@/lib/sap/errors';
import { stripUrlQuery } from '@/lib/monitoring/sentryOptions';

export const ERROR_LOG_TABLE = 'app_error_logs';
export const ERROR_LOG_RETENTION_DAYS = 90;

const MAX_MESSAGE = 2000;
const MAX_STACK = 4000;
const MAX_UPSTREAM_BODY = 2000;
const MAX_CONTEXT_CHARS = 20000;

export interface ErrorLogContext {
  /** e.g. '/api/sap/projects' */
  route: string;
  method?: string;
  userId?: string | null;
  /** Status returned to the browser */
  httpStatus?: number;
  /** Route-specific details (must not contain secrets) */
  context?: Record<string, unknown>;
}

export interface ErrorLogRow {
  route: string;
  method: string | null;
  http_status: number | null;
  user_id: string | null;
  error_name: string | null;
  message: string;
  stack: string | null;
  upstream_service: string | null;
  upstream_url: string | null;
  upstream_status: number | null;
  upstream_body: string | null;
  attempts: unknown[] | null;
  duration_ms: number | null;
  vercel_request_id: string | null;
  vercel_env: string | null;
  commit_sha: string | null;
  region: string | null;
  context: Record<string, unknown>;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max)}… [truncated ${value.length - max} chars]` : value;
}

function describeCause(error: unknown): string | null {
  if (!(error instanceof Error) || error.cause == null) return null;
  const cause = error.cause as { code?: unknown; message?: unknown };
  if (typeof cause === 'object') {
    const parts = [cause.code, cause.message].filter((p) => typeof p === 'string' && p.length > 0);
    if (parts.length > 0) return parts.join(': ');
  }
  return String(error.cause);
}

function limitContext(context: Record<string, unknown>): Record<string, unknown> {
  try {
    const json = JSON.stringify(context);
    if (json.length <= MAX_CONTEXT_CHARS) return context;
    return { truncated: true, preview: json.slice(0, MAX_CONTEXT_CHARS) };
  } catch {
    return { unserializable: true };
  }
}

/** Builds the row to insert. Pure (no I/O) so it can be unit tested. */
export function buildErrorLogRow(
  error: unknown,
  ctx: ErrorLogContext,
  env: Record<string, string | undefined> = process.env,
  vercelRequestId: string | null = null,
): ErrorLogRow {
  const isError = error instanceof Error;
  const upstream = getUpstreamDetails(error);
  const cause = describeCause(error);
  const context: Record<string, unknown> = { ...(ctx.context ?? {}) };
  if (cause) context.cause = cause;

  // Supabase/PostgREST errors are plain objects: { message, code, details, hint }
  const plain = !isError && typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)
    : null;
  const isPostgrestLike = plain !== null && typeof plain.message === 'string';
  if (isPostgrestLike) {
    const { code, details, hint } = plain;
    context.db = { code: code ?? null, details: details ?? null, hint: hint ?? null };
  }

  let baseMessage: string;
  if (isError) baseMessage = error.message;
  else if (typeof error === 'string') baseMessage = error;
  else if (isPostgrestLike) baseMessage = plain.message as string;
  else {
    try {
      baseMessage = JSON.stringify(error);
    } catch {
      baseMessage = String(error);
    }
  }

  return {
    route: ctx.route,
    method: ctx.method ?? null,
    http_status: ctx.httpStatus ?? null,
    user_id: ctx.userId ?? null,
    error_name: isError ? error.name : isPostgrestLike ? 'SupabaseError' : typeof error,
    message: truncate(baseMessage || 'Unknown error', MAX_MESSAGE) ?? 'Unknown error',
    stack: isError ? truncate(error.stack ?? null, MAX_STACK) : null,
    upstream_service: upstream?.service ?? null,
    upstream_url: upstream?.url ?? null,
    upstream_status: upstream?.status ?? null,
    upstream_body: truncate(upstream?.body ?? null, MAX_UPSTREAM_BODY),
    attempts: upstream?.attempts ?? null,
    duration_ms: upstream ? Math.round(upstream.durationMs) : null,
    vercel_request_id: vercelRequestId,
    vercel_env: env.VERCEL_ENV ?? 'local',
    commit_sha: env.VERCEL_GIT_COMMIT_SHA ?? null,
    region: env.VERCEL_REGION ?? null,
    context: limitContext(context),
  };
}

/** Inserts the row and prunes rows older than the retention window. Never throws. */
export async function writeErrorLog(supabase: SupabaseClient, row: ErrorLogRow): Promise<void> {
  try {
    const { error } = await supabase.from(ERROR_LOG_TABLE).insert(row);
    if (error) {
      console.error('[error-log] insert failed:', error.message);
      return;
    }
    const cutoff = new Date(Date.now() - ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: pruneError } = await supabase.from(ERROR_LOG_TABLE).delete().lt('occurred_at', cutoff);
    if (pruneError) {
      console.error('[error-log] prune failed:', pruneError.message);
    }
  } catch (e) {
    console.error('[error-log] unexpected failure:', e instanceof Error ? e.message : e);
  }
}

async function readVercelRequestId(): Promise<string | null> {
  try {
    return (await headers()).get('x-vercel-id');
  } catch {
    return null;
  }
}

/**
 * Records an API error in Supabase after the response is sent.
 * Also prints it to the console so it still shows in Vercel's (1h) logs.
 */
export function logApiError(error: unknown, ctx: ErrorLogContext): void {
  if (process.env.NODE_ENV === 'test') return;

  console.error(`[api-error] ${ctx.method ?? ''} ${ctx.route} (${ctx.httpStatus ?? '?'}):`, error);

  // Routes catch their errors (and return 4xx/5xx), so Sentry's automatic capture never
  // sees them: report them explicitly. No-op when Sentry has no DSN.
  try {
    const upstream = getUpstreamDetails(error);
    Sentry.captureException(error, {
      tags: {
        route: ctx.route,
        method: ctx.method,
        http_status: ctx.httpStatus,
        upstream_service: upstream?.service,
        upstream_status: upstream?.status ?? undefined,
      },
      contexts: {
        ...(upstream && {
          upstream: {
              url: stripUrlQuery(upstream.url),
              status: upstream.status,
              body: upstream.body?.slice(0, 1000) ?? null,
              attempts: upstream.attempts,
              duration_ms: Math.round(upstream.durationMs),
          },
        }),
        ...(ctx.context && { route_context: ctx.context }),
      },
    });
  } catch {
    // Monitoring must never break the request
  }

  const task = async () => {
    try {
      const row = buildErrorLogRow(error, ctx, process.env, await readVercelRequestId());
      await writeErrorLog(createAdminClient(), row);
    } catch (e) {
      console.error('[error-log] could not write error log:', e instanceof Error ? e.message : e);
    }
  };

  try {
    after(task);
  } catch {
    // Outside a request scope: run it without waiting
    void task();
  }
}
