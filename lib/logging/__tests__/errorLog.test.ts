import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildErrorLogRow, writeErrorLog, ERROR_LOG_TABLE } from '@/lib/logging/errorLog';
import { SapApiError, attachUpstreamDetails } from '@/lib/sap/errors';

const ctx = { route: '/api/sap/projects', method: 'GET', userId: 'user-1', httpStatus: 502 };
const env = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'abc123', VERCEL_REGION: 'cdg1' };

describe('buildErrorLogRow', () => {
  it('captures SAP upstream details, deployment info and request id', () => {
    const error = new SapApiError('SAP TPM is currently unavailable', 503);
    attachUpstreamDetails(error, {
      service: 'sap',
      url: 'https://sap.example.com/v1/suppliers/projects',
      status: 503,
      body: 'no healthy upstream',
      attempts: [
        { at: '2026-11-23T08:52:00.000Z', status: 503, ms: 120 },
        { at: '2026-11-23T08:52:01.000Z', status: 503, ms: 110 },
      ],
      durationMs: 3456.7,
    });

    const row = buildErrorLogRow(error, ctx, env, 'cdg1::abc-123');

    expect(row).toMatchObject({
      route: '/api/sap/projects',
      method: 'GET',
      http_status: 502,
      user_id: 'user-1',
      error_name: 'SapApiError',
      message: 'SAP TPM is currently unavailable',
      upstream_service: 'sap',
      upstream_url: 'https://sap.example.com/v1/suppliers/projects',
      upstream_status: 503,
      upstream_body: 'no healthy upstream',
      duration_ms: 3457,
      vercel_request_id: 'cdg1::abc-123',
      vercel_env: 'production',
      commit_sha: 'abc123',
      region: 'cdg1',
    });
    expect(row.attempts).toHaveLength(2);
    expect(row.stack).toContain('SapApiError');
  });

  it('records network error causes (e.g. DNS failures)', () => {
    const error = new TypeError('fetch failed', { cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND sap.example.com' } });
    const row = buildErrorLogRow(error, ctx, {});

    expect(row.message).toBe('fetch failed');
    expect(row.context.cause).toBe('ENOTFOUND: getaddrinfo ENOTFOUND sap.example.com');
    expect(row.vercel_env).toBe('local');
    expect(row.upstream_service).toBeNull();
  });

  it('handles Supabase (PostgREST) error objects', () => {
    const row = buildErrorLogRow(
      { message: 'duplicate key value', code: '23505', details: 'Key (id)=(1) exists', hint: null },
      { ...ctx, context: { step: 'acquire_lock' } },
      env,
    );

    expect(row.error_name).toBe('SupabaseError');
    expect(row.message).toBe('duplicate key value');
    expect(row.context).toMatchObject({
      step: 'acquire_lock',
      db: { code: '23505', details: 'Key (id)=(1) exists', hint: null },
    });
  });

  it('truncates long messages and upstream bodies', () => {
    const error = new Error('x'.repeat(5000));
    attachUpstreamDetails(error, {
      service: 'sap',
      url: 'u',
      status: 500,
      body: 'y'.repeat(5000),
      attempts: [],
      durationMs: 1,
    });

    const row = buildErrorLogRow(error, ctx, env);
    expect(row.message.length).toBeLessThan(2100);
    expect(row.message).toContain('[truncated');
    expect(row.upstream_body!.length).toBeLessThan(2100);
  });
});

describe('writeErrorLog', () => {
  function fakeSupabase(insertError: { message: string } | null = null) {
    const lt = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ lt }));
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const from = vi.fn(() => ({ insert, delete: del }));
    return { client: { from } as unknown as SupabaseClient, from, insert, del, lt };
  }

  it('inserts the row and prunes rows older than 90 days', async () => {
    const fake = fakeSupabase();
    const row = buildErrorLogRow(new Error('boom'), ctx, env);

    await writeErrorLog(fake.client, row);

    expect(fake.from).toHaveBeenCalledWith(ERROR_LOG_TABLE);
    expect(fake.insert).toHaveBeenCalledWith(row);
    expect(fake.lt).toHaveBeenCalledWith('occurred_at', expect.any(String));
    const cutoff = new Date(fake.lt.mock.calls[0][1] as string).getTime();
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - ninetyDaysAgo)).toBeLessThan(5000);
  });

  it('never throws when the insert fails', async () => {
    const fake = fakeSupabase({ message: 'relation does not exist' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(writeErrorLog(fake.client, buildErrorLogRow(new Error('boom'), ctx, env))).resolves.toBeUndefined();
    expect(fake.lt).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
