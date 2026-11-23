// Node.js server-side Sentry setup (API routes, server components). Imported from instrumentation.ts.
import * as Sentry from '@sentry/nextjs';
import {
  scrubSentryEvent,
  sentryDataCollection,
  sentryEnvironment,
  sentryTracesSampleRate,
} from '@/lib/monitoring/sentryOptions';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: sentryEnvironment,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  beforeSend: scrubSentryEvent,
});
