// /lib/sap/client.ts
// Server-side SAP TPM API client with OAuth 2.0 Resource Owner Password Credentials grant

import type {
  SapProjectDTO,
  SapSubProjectInfo,
  SapInstructionDTO,
  SapTokenResponse,
} from '@/types/sap';
import {
  SAP_UNAVAILABLE_MESSAGE,
  SapApiError,
  type UpstreamAttempt,
  attachUpstreamDetails,
  SapConfigError,
  SapTokenError,
  isRetryableError,
  isSapUnavailableStatus,
} from './errors';

// API Configuration. Both URLs can be overridden via env vars (e.g. if SAP moves the
// TPM service to a new cluster) without a code change; the defaults are the current hosts.
const DEFAULT_SAP_TOKEN_URL = 'https://lpxtpmsub.authentication.sap.hana.ondemand.com/oauth/token';
const DEFAULT_SAP_API_BASE_URL = 'https://lpxtpmsub-tpm.ingress.prod.lp.shoot.live.k8s-hana.ondemand.com';

function readUrlEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return (value || fallback).replace(/\/+$/, '');
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 8000;
const RETRY_JITTER_MS = 500;
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_TIMEOUT_MS = 15000;

// Debug logging (server-side only, visible in terminal)
const DEBUG = process.env.NODE_ENV === 'development';

function getRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
  return exponentialDelay + jitter;
}

function debugLog(stage: string, data: Record<string, unknown>) {
  if (!DEBUG) return;
  console.log(`[SAP-DEBUG] ${stage}:`, JSON.stringify(data, null, 2));
}

interface RequestTrace {
  url: string;
  attempts: UpstreamAttempt[];
  lastStatus: number | null;
  lastBody: string | null;
  startedAt: number;
}

/** Short description of a low-level error, including Node's `cause` (e.g. ENOTFOUND). */
function describeError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = error.cause as { code?: string; message?: string } | undefined;
    const causeText = cause ? ` (${cause.code ?? cause.message ?? String(cause)})` : '';
    return `${error.name}: ${error.message}${causeText}`;
  }
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: unknown }).name);
  }
  return String(error);
}

/**
 * Server-side SAP TPM API client
 * Uses OAuth 2.0 Resource Owner Password Credentials grant for authentication
 */
export class SapTpmApiClient {
  private jwtClientId: string;
  private jwtClientSecret: string;
  private username: string;
  private password: string;
  private tokenUrl: string;
  private apiBaseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    const jwtClientId = process.env.SAP_TPM_JWT_CLIENT_ID;
    const jwtClientSecret = process.env.SAP_TPM_JWT_CLIENT_SECRET;
    const username = process.env.SAP_TPM_USERNAME;
    const password = process.env.SAP_TPM_PASSWORD;

    if (!jwtClientId) {
      throw new SapConfigError('SAP_TPM_JWT_CLIENT_ID');
    }
    if (!jwtClientSecret) {
      throw new SapConfigError('SAP_TPM_JWT_CLIENT_SECRET');
    }
    if (!username) {
      throw new SapConfigError('SAP_TPM_USERNAME');
    }
    if (!password) {
      throw new SapConfigError('SAP_TPM_PASSWORD');
    }

    this.jwtClientId = jwtClientId;
    this.jwtClientSecret = jwtClientSecret;
    this.username = username;
    this.password = password;
    this.tokenUrl = readUrlEnv('SAP_TPM_TOKEN_URL', DEFAULT_SAP_TOKEN_URL);
    this.apiBaseUrl = readUrlEnv('SAP_TPM_API_BASE_URL', DEFAULT_SAP_API_BASE_URL);

    debugLog('CONSTRUCTOR', {
      jwtClientId: `${jwtClientId.substring(0, 8)}...`,
      jwtClientSecretLength: jwtClientSecret.length,
      username,
      passwordLength: password.length,
    });
  }

  /**
   * Get OAuth access token using Resource Owner Password Credentials grant.
   * Client credentials sent via Basic Auth header, username/password in body.
   * Token cached until expiry (12hr validity, 60s refresh buffer).
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      debugLog('TOKEN_CACHED', {
        expiresIn: Math.round((this.tokenExpiresAt - Date.now()) / 1000) + 's',
      });
      return this.accessToken;
    }

    // Basic Auth: Base64(client_id:client_secret)
    const rawCredentials = `${this.jwtClientId}:${this.jwtClientSecret}`;
    const basicAuth = Buffer.from(rawCredentials).toString('base64');

    const bodyParams = new URLSearchParams({
      grant_type: 'password',
      username: this.username,
      password: this.password,
    });

    debugLog('TOKEN_REQUEST', {
      url: this.tokenUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth.substring(0, 20)}...`,
      },
      body: `grant_type=password&username=${this.username}&password=***`,
      basicAuthInput: `${this.jwtClientId.substring(0, 8)}...:${this.jwtClientSecret.substring(0, 4)}...`,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

    const tokenStartedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: bodyParams,
        signal: controller.signal,
      });
    } catch (error) {
      const tokenError =
        typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError'
          ? new SapTokenError('Token request timed out')
          : error;
      attachUpstreamDetails(tokenError, {
        service: 'sap-auth',
        url: this.tokenUrl,
        status: null,
        body: null,
        attempts: [{ at: new Date(tokenStartedAt).toISOString(), status: null, ms: Date.now() - tokenStartedAt, error: describeError(error) }],
        durationMs: Date.now() - tokenStartedAt,
      });
      throw tokenError;
    } finally {
      clearTimeout(timeoutId);
    }

    debugLog('TOKEN_RESPONSE', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      debugLog('TOKEN_ERROR', {
        status: response.status,
        body: errorText,
      });
      const tokenError = new SapTokenError(`Failed to obtain token: ${response.status} - ${errorText}`);
      attachUpstreamDetails(tokenError, {
        service: 'sap-auth',
        url: this.tokenUrl,
        status: response.status,
        body: errorText,
        attempts: [{ at: new Date(tokenStartedAt).toISOString(), status: response.status, ms: Date.now() - tokenStartedAt }],
        durationMs: Date.now() - tokenStartedAt,
      });
      throw tokenError;
    }

    const data: SapTokenResponse = await response.json();

    debugLog('TOKEN_SUCCESS', {
      hasAccessToken: !!data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
      hasRefreshToken: !!data.refresh_token,
      tokenPreview: data.access_token
        ? `${data.access_token.substring(0, 20)}...${data.access_token.substring(data.access_token.length - 10)}`
        : 'MISSING',
    });

    if (!data.access_token) {
      throw new SapTokenError('Token response missing access_token');
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  /**
   * Make authenticated API request with retry logic.
   * On failure, the thrown error carries the SAP URL, every attempt, the last raw response
   * body and the total duration (see attachUpstreamDetails) so it can be logged later.
   */
  private async request<T>(endpoint: string): Promise<T> {
    const trace: RequestTrace = {
      url: `${this.apiBaseUrl}${endpoint}`,
      attempts: [],
      lastStatus: null,
      lastBody: null,
      startedAt: Date.now(),
    };
    try {
      return await this.requestWithRetry<T>(endpoint, MAX_RETRIES, trace);
    } catch (error) {
      attachUpstreamDetails(error, {
        service: 'sap',
        url: trace.url,
        status: trace.lastStatus,
        body: trace.lastBody,
        attempts: trace.attempts,
        durationMs: Date.now() - trace.startedAt,
      });
      throw error;
    }
  }

  /**
   * Uses x-approuter-authorization header as required by SAP TPM API.
   */
  private async requestWithRetry<T>(endpoint: string, retries: number, trace: RequestTrace): Promise<T> {
    const token = await this.getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const requestUrl = `${this.apiBaseUrl}${endpoint}`;
    const attemptStartedAt = Date.now();
    const recordAttempt = (status: number | null, error?: unknown) => {
      trace.attempts.push({
        at: new Date(attemptStartedAt).toISOString(),
        status,
        ms: Date.now() - attemptStartedAt,
        ...(error !== undefined ? { error: describeError(error) } : {}),
      });
    };
    let retryWithFreshToken = false;
    const requestHeaders = {
      Accept: 'application/json',
      'x-approuter-authorization': `Bearer ${token}`,
    };

    debugLog('API_REQUEST', {
      url: requestUrl,
      method: 'GET',
      headers: {
        ...requestHeaders,
        'x-approuter-authorization': `Bearer ${token.substring(0, 20)}...`,
      },
    });

    try {
      const response = await fetch(requestUrl, {
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      debugLog('API_RESPONSE', {
        url: requestUrl,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        recordAttempt(response.status);
        trace.lastStatus = response.status;
        trace.lastBody = rawBody;
        debugLog('API_ERROR_BODY', {
          status: response.status,
          body: rawBody.substring(0, 2000),
        });

        let error: SapApiError;
        try {
          const data = JSON.parse(rawBody);
          if (data.error && typeof data.error === 'object') {
            const message = data.error.message || `SAP API error: ${response.status} ${response.statusText}`;
            error = new SapApiError(message, response.status, data);
          } else {
            error = new SapApiError(
              data.message || data.error || `SAP API error: ${response.status} ${response.statusText}`,
              response.status
            );
          }
        } catch {
          if (isSapUnavailableStatus(response.status)) {
            // Non-JSON 502/503/504 comes from SAP's gateway (e.g. Istio "no healthy upstream"):
            // the TPM service itself is down. Show a clear message; keep the raw body in the logs.
            if (retries === 0) {
              console.warn(
                `[SAP] ${requestUrl} unavailable: ${response.status} ${rawBody.substring(0, 200)}`
              );
            }
            error = new SapApiError(SAP_UNAVAILABLE_MESSAGE, response.status);
          } else {
            error = new SapApiError(
              rawBody || `SAP API error: ${response.status} ${response.statusText}`,
              response.status
            );
          }
        }

        if (error.isAuthError && retries > 0) {
          debugLog('AUTH_RETRY', {
            status: error.status,
            retriesLeft: retries - 1,
            message: error.message,
          });
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          retryWithFreshToken = true;
        } else {
          throw error;
        }
      } else {
        recordAttempt(response.status);
        return await response.json();
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') {
        debugLog('TIMEOUT', { url: requestUrl });
        recordAttempt(null, 'Request timeout');
        throw new SapApiError('Request timeout', 408);
      }

      if (!(error instanceof SapApiError)) {
        // Network-level failure (DNS, TLS, connection reset...): no HTTP status
        recordAttempt(null, error);
      }

      if (isRetryableError(error) && retries > 0) {
        const attempt = MAX_RETRIES - retries;
        const delayMs = getRetryDelay(attempt);

        debugLog('TRANSIENT_RETRY', {
          error: error instanceof Error ? error.message : String(error),
          retriesLeft: retries - 1,
          delayMs,
          attempt,
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.requestWithRetry<T>(endpoint, retries - 1, trace);
      }

      throw error;
    }

    // Auth retry happens outside the try/catch so a failure in the retried request is not
    // caught here and retried a second time.
    if (retryWithFreshToken) {
      return this.requestWithRetry<T>(endpoint, retries - 1, trace);
    }
    throw new Error('Unreachable: SAP request finished without a result');
  }

  /**
   * GET /v1/suppliers/projects
   * List all projects and sub-projects for the supplier
   */
  async getProjects(): Promise<SapProjectDTO> {
    return this.request<SapProjectDTO>('/v1/suppliers/projects');
  }

  /**
   * GET /v1/suppliers/projects/{projectId}/subprojects/{subProjectId}
   * Get detailed sub-project info (steps, volumes, dates)
   */
  async getSubProjectDetails(
    projectId: number,
    subProjectId: string
  ): Promise<SapSubProjectInfo> {
    return this.request<SapSubProjectInfo>(
      `/v1/suppliers/projects/${projectId}/subprojects/${encodeURIComponent(subProjectId)}`
    );
  }

  /**
   * GET /v1/suppliers/projects/{projectId}/subprojects/{subProjectId}/instructions
   * Get instructions for a sub-project
   */
  async getInstructions(
    projectId: number,
    subProjectId: string
  ): Promise<SapInstructionDTO> {
    return this.request<SapInstructionDTO>(
      `/v1/suppliers/projects/${projectId}/subprojects/${encodeURIComponent(subProjectId)}/instructions`
    );
  }
}

// Singleton instance for reuse across requests
let clientInstance: SapTpmApiClient | null = null;

/**
 * Get or create the SAP API client singleton
 * Throws SapConfigError if credentials are not configured
 */
export function getSapClient(): SapTpmApiClient {
  if (!clientInstance) {
    clientInstance = new SapTpmApiClient();
  }
  return clientInstance;
}

/**
 * Reset the client (useful for testing or credential rotation)
 */
export function resetSapClient(): void {
  clientInstance = null;
}

