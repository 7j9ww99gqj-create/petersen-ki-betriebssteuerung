const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // API-Versionierung: /api/v1/foo → /api/foo (Aliase für künftige Breaking-Changes)
      // Bestehende Routen bleiben unter /api/* erreichbar.
      { source: '/api/v1/:path*', destination: '/api/:path*' },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Source Maps hochladen (nur wenn SENTRY_AUTH_TOKEN gesetzt)
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Source Maps nicht im Client-Bundle ausliefern
  hideSourceMaps: true,
  // Sentry-Wizard-Instrumentation deaktivieren (manuelle Konfig)
  disableLogger: true,
  // Wenn kein DSN gesetzt, Sentry-Tunneling überspringen
  tunnelRoute: '/monitoring-tunnel',
})
