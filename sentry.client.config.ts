import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Free-Tier-Schutz: Performance-Monitoring aus → nur Errors tracken (5k/Monat-Limit)
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    debug: false,
    beforeSend(event, hint) {
      // Demo-User-Errors nicht tracken
      if (typeof document !== 'undefined') {
        const cookies = document.cookie
        if (cookies.includes('pk_demo=1')) return null
      }
      // Lokale Entwicklung nicht tracken
      if (process.env.NODE_ENV === 'development') return null
      return event
    },
  })
}
