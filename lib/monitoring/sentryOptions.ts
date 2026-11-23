// /lib/monitoring/sentryOptions.ts
// Shared Sentry settings for the browser, Node.js server and edge runtimes.
// Privacy first: no user identity, cookies, request/response bodies, query strings,
// local variables or sensitive headers are sent. Sample rates are kept low because the
// free Developer plan is shared with other apps.

import type * as Sentry from '@sentry/nextjs';
import type { ErrorEvent } from '@sentry/nextjs';

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['dataCollection']>;

/** Where events come from: production / preview / development (Vercel), else NODE_ENV. */
export const sentryEnvironment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;

const isDev = process.env.NODE_ENV === 'development';

/** 100% of traces locally (to verify setup), 10% everywhere else. */
export const sentryTracesSampleRate = isDev ? 1.0 : 0.1;

/**
 * Replaces the deprecated/removed `sendDefaultPii: false` (SDK v11 uses `dataCollection`).
 * The SDK's built-in denylist (auth, token, password, secret, key, jwt, bearer, session...)
 * still applies on top of this.
 */
export const sentryDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { allow: ['user-agent', 'content-type', 'accept', 'x-vercel-id'] },
    response: false,
  },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  // Local variables could include SAP credentials held by the SAP client
  stackFrameVariables: false,
};

const SENSITIVE_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|credential|session)/i;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
// JWTs (e.g. SAP/Supabase access tokens) appearing anywhere in text
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function scrubText(value: string): string {
  return value.replace(BEARER, '$1 [Filtered]').replace(JWT, '[Filtered JWT]');
}

/** Recursively masks values under sensitive keys and tokens inside strings. */
export function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[Truncated]';
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[Filtered]' : scrubDeep(v, depth + 1),
      ])
    );
  }
  return value;
}

/** URL without query string or fragment (those can carry codes/tokens). */
export function stripUrlQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    clean[key] = SENSITIVE_KEY.test(key) ? '[Filtered]' : value;
  }
  return clean;
}

/**
 * Last line of defence before an event leaves the app: drops cookies and bodies and masks
 * auth headers / bearer tokens even if an integration added them.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    event.request.headers = scrubHeaders(event.request.headers);
  }
  if (event.user) {
    // Keep only the opaque id if code set one explicitly; never email/IP/username
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  if (event.message) {
    event.message = scrubText(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => scrubDeep(b) as typeof b);
  }
  return event;
}
