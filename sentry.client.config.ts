import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
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
