const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
