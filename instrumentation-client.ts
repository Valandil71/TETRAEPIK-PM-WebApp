// Browser-side Sentry setup. Loaded by Next.js before the app becomes interactive.
import * as Sentry from '@sentry/nextjs';
import {
  scrubSentryEvent,
  sentryDataCollection,
  sentryEnvironment,
  sentryTracesSampleRate,
} from '@/lib/monitoring/sentryOptions';

Sentry.init({
  // No DSN (e.g. local without NEXT_PUBLIC_SENTRY_DSN) = Sentry stays off
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: sentryEnvironment,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  beforeSend: scrubSentryEvent,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      // Never record network request/response details in replays
      networkDetailAllowUrls: [],
    }),
  ],
  // Replays only for sessions that hit an error, and only a quarter of those
  // (the free plan includes 50 replays/month, shared with other apps)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.25,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
