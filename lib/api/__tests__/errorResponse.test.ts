import { beforeEach, describe, expect, it, vi } from 'vitest';

const logApiError = vi.fn();
vi.mock('@/lib/logging/errorLog', () => ({ logApiError: (...args: unknown[]) => logApiError(...args) }));

import { handleRouteError } from '@/lib/api/errorResponse';
import { RateLimitError, SapApiError } from '@/lib/sap/errors';

const ctx = { route: '/api/sap/projects', method: 'GET', userId: 'user-1' };

describe('handleRouteError', () => {
  beforeEach(() => logApiError.mockReset());

  it('logs the error with the status sent to the browser', async () => {
    const error = new SapApiError('down', 503);
    const response = handleRouteError(error, 'Failed', ctx);

    expect(response.status).toBe(502);
    expect(logApiError).toHaveBeenCalledWith(error, { ...ctx, httpStatus: 502 });
  });

  it('does not log expected local rate limits', () => {
    const response = handleRouteError(new RateLimitError(new Date()), 'Failed', ctx);

    expect(response.status).toBe(429);
    expect(logApiError).not.toHaveBeenCalled();
  });
});
