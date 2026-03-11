// /lib/sap/errors.ts
// Error handling for SAP API integration

import type { SapErrorDTO } from '@/types/sap';

/**
 * Custom error class for SAP API errors
 */
export class SapApiError extends Error {
  public readonly status: number;
  public readonly sapError?: SapErrorDTO;
  public readonly isRateLimited: boolean;
  public readonly isAuthError: boolean;
  public readonly isNotFound: boolean;

  constructor(
    message: string,
    status: number,
    sapError?: SapErrorDTO
  ) {
    super(message);
    this.name = 'SapApiError';
    this.status = status;
    this.sapError = sapError;
    this.isRateLimited = status === 429;
    this.isAuthError = status === 401 || status === 403;
    this.isNotFound = status === 404;
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    if (this.isAuthError) {
      return 'SAP authentication failed. Please contact your administrator.';
    }
    if (this.isRateLimited) {
      return 'SAP API rate limit exceeded. Please try again later.';
    }
    if (this.isNotFound) {
      return 'SAP resource not found. The project may have been removed.';
    }
    if (this.sapError?.error?.message) {
      return `SAP Error: ${this.sapError.error.message}`;
    }
    return `Failed to communicate with SAP (${this.status})`;
  }
}

/**
 * Custom error for local rate limiting (5-minute cooldown)
 */
export class RateLimitError extends Error {
  public readonly waitMinutes: number;
  public readonly retryAfter: Date;

  constructor(lastFetchAt: Date) {
    const now = new Date();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    const elapsedMs = now.getTime() - lastFetchAt.getTime();
    const remainingMs = cooldownMs - elapsedMs;
    const waitMinutes = Math.ceil(remainingMs / 60000);

    super(`Rate limited. Please wait ${waitMinutes} minute(s).`);
    this.name = 'RateLimitError';
    this.waitMinutes = waitMinutes;
    this.retryAfter = new Date(lastFetchAt.getTime() + cooldownMs);
  }
}

/**
 * Custom error for missing configuration
 */
export class SapConfigError extends Error {
  constructor(missingVar: string) {
    super(`SAP API configuration error: Missing ${missingVar}`);
    this.name = 'SapConfigError';
  }
}

/**
 * Custom error for token refresh failures
 */
export class SapTokenError extends Error {
  constructor(message: string) {
    super(`SAP OAuth token error: ${message}`);
    this.name = 'SapTokenError';
  }
}

/**
 * Parse SAP API error response
 */
export async function parseSapError(response: Response): Promise<SapApiError> {
  let sapError: SapErrorDTO | undefined;

  try {
    const data = await response.json();
    // SAP API returns { error: { status, message, target, timestamp, details } }
    if (data.error && typeof data.error === 'object') {
      sapError = data as SapErrorDTO;
    }
  } catch {
    // Response body is not JSON, ignore
  }

  const message = sapError?.error?.message || `SAP API error: ${response.status} ${response.statusText}`;
  return new SapApiError(message, response.status, sapError);
}

/**
 * Check if an error is retryable (transient)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof SapApiError) {
    // Retry on server errors (5xx) except 501
    if (error.status >= 500 && error.status !== 501) {
      return true;
    }
    // Retry on rate limit (429)
    if (error.isRateLimited) {
      return true;
    }
    // Retry on specific network errors
    return false;
  }

  // Retry on network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): Response {
  if (error instanceof RateLimitError) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', waitMinutes: error.waitMinutes }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(error.waitMinutes * 60),
        },
      }
    );
  }

  if (error instanceof SapApiError) {
    return Response.json(
      { error: error.message, status: error.status },
      { status: error.status >= 500 ? 502 : error.status }
    );
  }

  if (error instanceof SapConfigError) {
    console.error('SAP configuration error:', error.message);
    return Response.json(
      { error: 'SAP integration is not configured properly' },
      { status: 500 }
    );
  }

  if (error instanceof Error) {
    console.error('Unexpected error:', error);
    return Response.json(
      { error: error.message || defaultMessage },
      { status: 500 }
    );
  }

  console.error('Unknown error:', error);
  return Response.json({ error: defaultMessage }, { status: 500 });
}

