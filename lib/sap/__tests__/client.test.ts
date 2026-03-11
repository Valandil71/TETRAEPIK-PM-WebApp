import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SapTpmApiClient } from '@/lib/sap/client';
import { SapApiError, SapTokenError } from '@/lib/sap/errors';

function tokenResponse() {
  return new Response(
    JSON.stringify({
      access_token: 'token-123',
      token_type: 'bearer',
      expires_in: 3600,
      scope: 'scope',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function apiResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getApiCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/v1/suppliers/projects'));
}

describe('SapTpmApiClient', () => {
  beforeEach(() => {
    process.env.SAP_TPM_JWT_CLIENT_ID = 'client';
    process.env.SAP_TPM_JWT_CLIENT_SECRET = 'secret';
    process.env.SAP_TPM_USERNAME = 'user';
    process.env.SAP_TPM_PASSWORD = 'pass';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses exponential backoff delays with jitter support', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 1' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 2' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 3' }))
      .mockResolvedValueOnce(apiResponse(200, { projects: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    const promise = client.getProjects();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ projects: [] });

    const delays = timeoutSpy.mock.calls
      .map((call) => Number(call[1]))
      .filter((delay) => delay !== 30000);

    expect(delays).toEqual(expect.arrayContaining([1000, 2000, 4000]));
  });

  it('retries on 5xx and eventually succeeds', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 1' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 2' }))
      .mockResolvedValueOnce(apiResponse(200, { projects: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    const promise = client.getProjects();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ projects: [] });
    expect(getApiCalls(fetchMock)).toHaveLength(3);
  });

  it('does not retry on 4xx errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(404, { error: 'not found' }));

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    await expect(client.getProjects()).rejects.toMatchObject({
      status: 404,
      message: 'not found',
    });
    expect(getApiCalls(fetchMock)).toHaveLength(1);
  });

  it('retries once on auth error and refreshes token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(200, { projects: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    await expect(client.getProjects()).resolves.toEqual({ projects: [] });

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/oauth/token')
    );
    expect(tokenCalls).toHaveLength(2);
    expect(getApiCalls(fetchMock)).toHaveLength(2);
  });

  it('throws SapApiError with 408 on request timeout', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockImplementationOnce((_, init?: RequestInit) => {
        return new Promise((_, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => {
            reject({ name: 'AbortError' });
          });
        });
      });

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    const promise = client.getProjects();
    const assertion = expect(promise).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    await expect(promise).rejects.toBeInstanceOf(SapApiError);
  });

  it('throws SapTokenError on token fetch timeout', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockImplementationOnce((_, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
          reject({ name: 'AbortError' });
        });
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    const promise = client.getProjects();
    const assertion = expect(promise).rejects.toThrow('Token request timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    await expect(promise).rejects.toBeInstanceOf(SapTokenError);
  });

  it('throws after max retries are exhausted', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 1' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 2' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 3' }))
      .mockResolvedValueOnce(apiResponse(500, { error: 'server 4' }));

    vi.stubGlobal('fetch', fetchMock);

    const client = new SapTpmApiClient();
    const promise = client.getProjects();
    const assertion = expect(promise).rejects.toMatchObject({ status: 500 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(getApiCalls(fetchMock)).toHaveLength(4);
  });
});

