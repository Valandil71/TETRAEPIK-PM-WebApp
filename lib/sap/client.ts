// /lib/sap/client.ts
// Server-side SAP TPM API client with OAuth 2.0 Resource Owner Password Credentials grant

import type {
  SapProjectDTO,
  SapSubProjectInfo,
  SapInstructionDTO,
  SapTokenResponse,
} from '@/types/sap';
import {
  SapApiError,
  SapConfigError,
  SapTokenError,
  isRetryableError,
} from './errors';

// API Configuration
const SAP_TOKEN_URL = 'https://lpxtpmsub.authentication.sap.hana.ondemand.com/oauth/token';
const SAP_API_BASE_URL = 'https://lpxtpmsub-tpm.ingress.prod.lp.shoot.live.k8s-hana.ondemand.com';

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

/**
 * Server-side SAP TPM API client
 * Uses OAuth 2.0 Resource Owner Password Credentials grant for authentication
 */
export class SapTpmApiClient {
  private jwtClientId: string;
  private jwtClientSecret: string;
  private username: string;
  private password: string;
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
      url: SAP_TOKEN_URL,
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

    let response: Response;
    try {
      response = await fetch(SAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: bodyParams,
        signal: controller.signal,
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') {
        throw new SapTokenError('Token request timed out');
      }
      throw error;
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
      throw new SapTokenError(`Failed to obtain token: ${response.status} - ${errorText}`);
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
   * Uses x-approuter-authorization header as required by SAP TPM API.
   */
  private async request<T>(endpoint: string, retries = MAX_RETRIES): Promise<T> {
    const token = await this.getAccessToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const requestUrl = `${SAP_API_BASE_URL}${endpoint}`;
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
          error = new SapApiError(
            rawBody || `SAP API error: ${response.status} ${response.statusText}`,
            response.status
          );
        }

        if (error.isAuthError && retries > 0) {
          debugLog('AUTH_RETRY', {
            status: error.status,
            retriesLeft: retries - 1,
            message: error.message,
          });
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          return this.request<T>(endpoint, retries - 1);
        }

        throw error;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') {
        debugLog('TIMEOUT', { url: requestUrl });
        throw new SapApiError('Request timeout', 408);
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
        return this.request<T>(endpoint, retries - 1);
      }

      throw error;
    }
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

