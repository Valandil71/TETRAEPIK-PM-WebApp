import { describe, expect, it } from 'vitest';
import {
  RateLimitError,
  SapApiError,
  createErrorResponse,
  isRetryableError,
} from '@/lib/sap/errors';

describe('sap errors', () => {
  it('sets SapApiError flags correctly', () => {
    const rateError = new SapApiError('rate', 429);
    expect(rateError.isRateLimited).toBe(true);

    const authError = new SapApiError('auth', 401);
    expect(authError.isAuthError).toBe(true);

    const notFoundError = new SapApiError('missing', 404);
    expect(notFoundError.isNotFound).toBe(true);
  });

  it('creates user-friendly messages', () => {
    expect(new SapApiError('auth', 401).toUserMessage()).toContain('authentication');
    expect(new SapApiError('rate', 429).toUserMessage()).toContain('rate limit');
    expect(new SapApiError('missing', 404).toUserMessage()).toContain('not found');
    expect(new SapApiError('other', 500).toUserMessage()).toContain('(500)');
  });

  it('marks retryable statuses correctly', () => {
    expect(isRetryableError(new SapApiError('500', 500))).toBe(true);
    expect(isRetryableError(new SapApiError('502', 502))).toBe(true);
    expect(isRetryableError(new SapApiError('503', 503))).toBe(true);
    expect(isRetryableError(new SapApiError('504', 504))).toBe(true);

    expect(isRetryableError(new SapApiError('400', 400))).toBe(false);
    expect(isRetryableError(new SapApiError('401', 401))).toBe(false);
    expect(isRetryableError(new SapApiError('404', 404))).toBe(false);
    expect(isRetryableError(new SapApiError('501', 501))).toBe(false);
  });

  it('includes Retry-After header for RateLimitError responses', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000 + 30_000);
    const response = createErrorResponse(new RateLimitError(fiveMinutesAgo));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();

    const body = await response.json();
    expect(body.error).toBe('rate_limited');
    expect(typeof body.waitMinutes).toBe('number');
  });

  it('maps SapApiError 5xx to 502', async () => {
    const response = createErrorResponse(new SapApiError('server', 500));
    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.error).toBe('server');
    expect(body.status).toBe(500);
  });

  it('returns 500 for generic errors', async () => {
    const response = createErrorResponse(new Error('boom'));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('boom');
  });
});
