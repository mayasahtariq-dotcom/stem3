import * as Sentry from "@sentry/nextjs";

// Error reporting only when a DSN is configured; no tracing, replay or PII (child users).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0 });
}
