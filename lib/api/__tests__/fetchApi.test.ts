import { describe, expect, it, vi } from 'vitest';
import { ApiError, fetchApi } from '@/lib/api/fetchApi';

describe('fetchApi', () => {
  it('returns parsed json on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(fetchApi<{ ok: boolean }>('/api/test')).resolves.toEqual({ ok: true });
  });

  it('throws ApiError with json body details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'msg' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(fetchApi('/api/test')).rejects.toMatchObject({
      message: 'msg',
      status: 500,
    });
  });

  it('falls back to default message for non-json errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    );

    await expect(fetchApi('/api/test')).rejects.toMatchObject({
      message: 'Request failed with status 500',
      status: 500,
    });
  });

  it('exposes ApiError status helpers', () => {
    expect(new ApiError('rate', 429, null).isRateLimited).toBe(true);
    expect(new ApiError('conflict', 409, null).isConflict).toBe(true);
    expect(new ApiError('missing', 404, null).isNotFound).toBe(true);
    expect(new ApiError('unauth', 401, null).isUnauthorized).toBe(true);
  });

  it('propagates network errors', async () => {
    const networkError = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    await expect(fetchApi('/api/test')).rejects.toBe(networkError);
  });
});
