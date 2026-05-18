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

// ── Server-seitige Hilfsfunktionen ───────────────────────────────────────────

/** Server-seitig: Push-Benachrichtigung an einen User senden */
export async function sendPushNotification(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
): Promise<{ success: boolean; error?: string }> {
  // Dynamischer Import – nur server-seitig
  try {
    const webpush = await import('web-push')

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidEmail = process.env.VAPID_EMAIL

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      return { success: false, error: 'VAPID Keys nicht konfiguriert (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in Vercel Env-Vars setzen)' }
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    await webpush.sendNotification(
      { endpoint, keys },
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
