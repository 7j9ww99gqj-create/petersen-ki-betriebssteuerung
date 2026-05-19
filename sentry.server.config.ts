import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Free-Tier-Schutz: Performance-Monitoring aus → nur Errors tracken
    tracesSampleRate: 0,
    debug: false,
  })
}
