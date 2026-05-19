import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple In-Memory Rate-Limiter pro User+Bucket.
 *
 * Limits sind pro Lambda-Instanz — bei Vercel reicht das,
 * weil die meisten Abuse-Szenarien aus einer einzelnen Quelle kommen.
 * Für globales Limit später Upstash/Redis ergänzen.
 */

type Bucket = {
  /** Max. Requests pro Fenster */
  max: number
  /** Fenstergröße in Millisekunden */
  windowMs: number
}

const BUCKETS: Record<string, Bucket> = {
  // KI-Routen sind teuer → strikt limitieren
  ai: { max: 20, windowMs: 60_000 },
  // OCR ist sehr teuer (Vision-API) → noch strikter
  ocr: { max: 10, windowMs: 60_000 },
  // Normale geschützte Routen
  default: { max: 60, windowMs: 60_000 },
}

type Entry = { count: number; resetAt: number }
const store = new Map<string, Entry>()

function getEntry(key: string, windowMs: number): Entry {
  const now = Date.now()
  const existing = store.get(key)
  if (!existing || existing.resetAt < now) {
    const fresh = { count: 0, resetAt: now + windowMs }
    store.set(key, fresh)
    return fresh
  }
  return existing
}

/**
 * Check rate-limit. Returns null if allowed, NextResponse 429 if blocked.
 *
 * Verwendung:
 *   const limited = checkRateLimit(user.id, 'ai')
 *   if (limited) return limited
 */
export function checkRateLimit(
  userId: string,
  bucket: keyof typeof BUCKETS = 'default',
): NextResponse | null {
  const config = BUCKETS[bucket]
  const key = `${bucket}:${userId}`
  const entry = getEntry(key, config.windowMs)
  entry.count++

  if (entry.count > config.max) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: `Rate-Limit überschritten — max. ${config.max} Anfragen pro ${config.windowMs / 1000}s. Bitte ${retryAfter}s warten.`,
        retryAfter,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }
  return null
}

/**
 * Helper für Routen ohne userId (IP-basiert als Fallback).
 */
export function checkRateLimitByRequest(
  req: NextRequest,
  userId: string | null,
  bucket: keyof typeof BUCKETS = 'default',
): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return checkRateLimit(userId ?? `ip:${ip}`, bucket)
}

// Periodische Cleanup der abgelaufenen Einträge (verhindert Memory-Leak)
if (typeof globalThis !== 'undefined') {
  const g = globalThis as { __pkRateLimitCleanup?: NodeJS.Timeout }
  if (!g.__pkRateLimitCleanup) {
    g.__pkRateLimitCleanup = setInterval(() => {
      const now = Date.now()
      store.forEach((entry, key) => {
        if (entry.resetAt < now) store.delete(key)
      })
    }, 60_000)
  }
}
