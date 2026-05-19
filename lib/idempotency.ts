import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function serviceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function sha256(str: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Idempotency-Middleware für mutierende API-Routen.
 *
 * Verwendung im POST-Handler:
 *   const idem = await checkIdempotency(req, userId, '/api/buero/rechnungen')
 *   if (idem.cached) return idem.response   // Duplikat — gecachte Antwort
 *   // ... normaler Handler ...
 *   await idem.commit(responseJson, statusCode)
 *
 * Client sendet Header: `Idempotency-Key: <uuid>` (z.B. crypto.randomUUID())
 */
export async function checkIdempotency(
  req: NextRequest,
  userId: string,
  route: string,
): Promise<{ cached: false; commit: (body: object, status?: number) => Promise<void> } | { cached: true; response: NextResponse }> {
  const key = req.headers.get('idempotency-key') ?? req.headers.get('x-idempotency-key')
  if (!key) {
    return { cached: false, commit: async () => {} }
  }

  const client = serviceClient()
  if (!client) return { cached: false, commit: async () => {} }

  const hash = await sha256(`${userId}:${route}:${key}`)

  const { data: existing } = await client
    .from('idempotency_keys')
    .select('response_body,status_code')
    .eq('key_hash', hash)
    .maybeSingle()

  if (existing?.response_body) {
    const body = JSON.parse(existing.response_body) as object
    return {
      cached: true,
      response: NextResponse.json(body, {
        status: existing.status_code ?? 200,
        headers: { 'X-Idempotency-Replayed': '1' },
      }),
    }
  }

  const commit = async (body: object, status = 200) => {
    await client.from('idempotency_keys').upsert({
      key_hash: hash,
      user_id: userId,
      route,
      response_body: JSON.stringify(body),
      status_code: status,
    }, { onConflict: 'key_hash' })
  }

  return { cached: false, commit }
}

/**
 * Täglicher Cleanup: Keys älter als 24h löschen.
 * Aufgerufen von /api/cron/cleanup oder eigenem Cron-Job.
 */
export async function cleanupIdempotencyKeys(): Promise<number> {
  const client = serviceClient()
  if (!client) return 0
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await client
    .from('idempotency_keys')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
  return count ?? 0
}
