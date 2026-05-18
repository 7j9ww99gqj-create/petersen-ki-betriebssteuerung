/**
 * Push-Benachrichtigungen Utility (Client + Server)
 *
 * Benötigte Vercel Env-Vars:
 * - VAPID_PUBLIC_KEY  (generieren mit: npx web-push generate-vapid-keys)
 * - VAPID_PRIVATE_KEY (wie oben)
 * - VAPID_EMAIL       (z.B. mailto:info@petersen-ki-pilot.de)
 */

// ── Client-seitige Hilfsfunktionen ────────────────────────────────────────────

/** Prüft ob Push-Benachrichtigungen im Browser unterstützt werden */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/** Service Worker registrieren und Push-Subscription erstellen */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY nicht gesetzt')
    return null
  }

  try {
    // SW registrieren
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Prüfe ob bereits subscribed
    const existing = await registration.pushManager.getSubscription()
    if (existing) return existing

    // Neue Subscription erstellen
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
    })

    return subscription
  } catch (err) {
    console.error('[push] Subscription fehlgeschlagen:', err)
    return null
  }
}

/** Push-Subscription beenden */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return false
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true
    return await subscription.unsubscribe()
  } catch (err) {
    console.error('[push] Unsubscribe fehlgeschlagen:', err)
    return false
  }
}

/** Aktuelle Push-Subscription abrufen (oder null) */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!registration) return null
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** VAPID Public Key (Base64) → Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

