// /lib/api/errorResponse.ts
// Route-level error handler: builds the HTTP error response and saves the error to
// app_error_logs. Expected outcomes (local rate limit) are not logged.

import { RateLimitError, createErrorResponse } from '@/lib/sap/errors';
import { logApiError, type ErrorLogContext } from '@/lib/logging/errorLog';

export function handleRouteError(
  error: unknown,
  defaultMessage: string,
  ctx: Omit<ErrorLogContext, 'httpStatus'>,
): Response {
  const response = createErrorResponse(error, defaultMessage);
  if (!(error instanceof RateLimitError)) {
    logApiError(error, { ...ctx, httpStatus: response.status });
  }
  return response;
}
