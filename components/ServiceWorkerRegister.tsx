'use client'

import { useEffect } from 'react'

/**
 * Registriert den Service Worker beim App-Start.
 * Nötig für: PWA-Install, Offline-Asset-Cache, Push-Benachrichtigungen.
 * Subscriben auf Push passiert separat in den Einstellungen.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Verzögere die Registrierung leicht, damit der erste Render nicht blockiert
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] Registrierung fehlgeschlagen:', err)
      })
    }, 1500)
    return () => window.clearTimeout(id)
  }, [])

  return null
}
