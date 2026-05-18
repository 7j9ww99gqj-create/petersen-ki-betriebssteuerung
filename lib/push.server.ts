/**
 * Server-only Push-Hilfsfunktionen (web-push, Node.js only)
 * Benötigte Vercel Env-Vars:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 */

export async function sendPushNotification(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const webpush = await import('web-push')

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidEmail = process.env.VAPID_EMAIL

    if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      return { success: false, error: 'VAPID Keys nicht konfiguriert' }
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
    await webpush.sendNotification({ endpoint, keys }, JSON.stringify(payload))
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}
