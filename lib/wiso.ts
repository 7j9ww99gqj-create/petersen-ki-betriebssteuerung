// Gemeinsame WISO-MeinBüro-API-Helfer.
// Liefert Token + macht authentifizierte Requests.
// Beim Token-Holen werden mehrere Endpoint-/Body-Varianten probiert,
// damit ein Auth-Fehler eindeutig diagnostizierbar ist.

export const WISO_API_BASE = 'https://api.meinbuero.de/openapi'
export const WISO_LEGACY_BASE = 'https://api.meinbuero.de'

type Json = Record<string, unknown>

export type WisoRequestResult =
  | { ok: true; data: unknown; status: number }
  | { ok: false; status: number; message: string; body: string }

export async function wisoRequest(method: string, path: string, opts: {
  token?: string
  basic?: string
  payload?: unknown
  formPayload?: Record<string, string>
  base?: string
  ownershipId?: string
} = {}): Promise<WisoRequestResult> {
  const base = opts.base || WISO_API_BASE
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (opts.formPayload) {
    body = new URLSearchParams(opts.formPayload).toString()
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (opts.payload !== undefined) {
    body = JSON.stringify(opts.payload)
    headers['Content-Type'] = 'application/json'
  }
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  if (opts.basic) headers['Authorization'] = `Basic ${opts.basic}`
  if (opts.ownershipId) headers['x-authorization-ownershipid'] = opts.ownershipId

  const r = await fetch(`${base}${path}`, { method, headers, body })
  const text = await r.text()
  if (!r.ok) {
    let msg = text
    try { const j = JSON.parse(text) as Json; msg = String(j.message || j.error || JSON.stringify(j)) } catch {}
    return { ok: false, status: r.status, message: msg.slice(0, 500), body: text.slice(0, 800) }
  }
  try { return { ok: true, status: r.status, data: text ? JSON.parse(text) : {} } }
  catch { return { ok: true, status: r.status, data: {} } }
}

type TokenAttempt = {
  label: string
  path: string
  base?: string
  payload?: Json
  formPayload?: Record<string, string>
}

// WISO-Token mit Fallback-Strategie holen.
// Bei Fehler enthält die Exception einen sprechenden Bericht über alle Versuche
// (Status + Server-Antwort gekürzt) — damit ist die Ursache (401 vs. 404 vs.
// Token-Format-Mismatch) sofort sichtbar.
export async function getWisoToken(apiKey: string, apiSecret: string, ownershipId: string): Promise<string> {
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

  const attempts: TokenAttempt[] = [
    // Bekannte Varianten der WISO MeinBüro Auth-Endpoints — der Server entscheidet welcher zieht.
    { label: 'openapi JSON {ownershipId}', path: '/auth/token', payload: { ownershipId } },
    { label: 'openapi POST ohne Body', path: '/auth/token' },
    { label: 'openapi grant=ownership form', path: '/auth/token', formPayload: { grant_type: 'ownership', ownershipId } },
    { label: 'legacy grant=ownership form', path: '/auth/token', base: WISO_LEGACY_BASE, formPayload: { grant_type: 'ownership', ownershipId } },
    { label: 'legacy JSON {ownershipId}', path: '/auth/token', base: WISO_LEGACY_BASE, payload: { ownershipId } },
  ]

  const errors: string[] = []
  for (const a of attempts) {
    const r = await wisoRequest('POST', a.path, {
      basic, ownershipId,
      payload: a.payload, formPayload: a.formPayload, base: a.base,
    })
    if (r.ok) {
      const d = r.data as Json
      const token = String(
        d.token || d.access_token ||
        (d.data && typeof d.data === 'object' && ((d.data as Json).token || (d.data as Json).access_token)) || '',
      )
      if (token) return token
      errors.push(`[${a.label}] HTTP ${r.status} — Antwort ohne Token: ${JSON.stringify(d).slice(0, 200)}`)
    } else {
      errors.push(`[${a.label}] HTTP ${r.status}: ${r.message}`)
    }
  }

  throw new Error(`WISO Token-Holen fehlgeschlagen nach ${attempts.length} Versuchen.\n${errors.join('\n')}`)
}
