import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'
import { WISO_API_BASE, WISO_LEGACY_BASE, WISO_APP_BASE } from '@/lib/wiso'

// WISO-Auth-Diagnose: zeigt für jeden Token-Versuch HTTP-Status + Antwort-Body.
// Hilft zu sehen, ob API-Key/Secret/OwnershipId in Vercel korrekt sind und
// welche Endpoint-Variante WISO MeinBüro aktuell akzeptiert.
// Nur Inhaber (Pondruff-Email).

export const maxDuration = 30

type AttemptResult = {
  label: string
  url: string
  contentType: string
  bodyPreview: string
  status: number
  ok: boolean
  responseBody: string
  hasToken: boolean
}

async function tryAttempt(label: string, url: string, basic: string, ownershipId: string, init: { body?: string; contentType?: string }): Promise<AttemptResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Basic ${basic}`,
    'x-authorization-ownershipid': ownershipId,
  }
  if (init.contentType) headers['Content-Type'] = init.contentType
  const r = await fetch(url, { method: 'POST', headers, body: init.body })
  const text = await r.text()
  let hasToken = false
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    const data = j.data as Record<string, unknown> | undefined
    hasToken = Boolean(j.token || j.access_token || data?.token || data?.access_token)
  } catch {}
  return {
    label,
    url,
    contentType: init.contentType || '—',
    bodyPreview: init.body ? init.body.slice(0, 200) : '(leer)',
    status: r.status,
    ok: r.ok,
    responseBody: text.slice(0, 800),
    hasToken,
  }
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const apiKey = process.env.WISO_MEINBUERO_API_KEY
  const apiSecret = process.env.WISO_MEINBUERO_API_SECRET
  const ownershipId = process.env.WISO_MEINBUERO_OWNERSHIP_ID

  const envStatus = {
    WISO_MEINBUERO_API_KEY: apiKey ? `gesetzt (${apiKey.length} Zeichen, beginnt mit "${apiKey.slice(0, 4)}…")` : 'FEHLT',
    WISO_MEINBUERO_API_SECRET: apiSecret ? `gesetzt (${apiSecret.length} Zeichen)` : 'FEHLT',
    WISO_MEINBUERO_OWNERSHIP_ID: ownershipId ? `gesetzt: "${ownershipId}"` : 'FEHLT',
  }

  if (!apiKey || !apiSecret || !ownershipId) {
    return NextResponse.json({
      ok: false,
      error: 'WISO Env-Vars fehlen',
      env: envStatus,
    })
  }

  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

  const attempts: AttemptResult[] = []

  // Variante 1: openapi + JSON ownershipId
  attempts.push(await tryAttempt(
    'openapi JSON {ownershipId}',
    `${WISO_API_BASE}/auth/token`,
    basic, ownershipId,
    { body: JSON.stringify({ ownershipId }), contentType: 'application/json' },
  ))

  // Variante 2: openapi POST ohne Body
  attempts.push(await tryAttempt(
    'openapi POST ohne Body',
    `${WISO_API_BASE}/auth/token`,
    basic, ownershipId,
    {},
  ))

  // Variante 3: openapi form grant=ownership
  attempts.push(await tryAttempt(
    'openapi grant=ownership form',
    `${WISO_API_BASE}/auth/token`,
    basic, ownershipId,
    { body: new URLSearchParams({ grant_type: 'ownership', ownershipId }).toString(), contentType: 'application/x-www-form-urlencoded' },
  ))

  // Variante 4: openapi JSON mit apiKey/apiSecret im Body (ohne Basic)
  {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-authorization-ownershipid': ownershipId,
    }
    const url = `${WISO_API_BASE}/auth/token`
    const body = JSON.stringify({ apiKey, apiSecret, ownershipId })
    const r = await fetch(url, { method: 'POST', headers, body })
    const text = await r.text()
    let hasToken = false
    try {
      const j = JSON.parse(text) as Record<string, unknown>
      const data = j.data as Record<string, unknown> | undefined
      hasToken = Boolean(j.token || j.access_token || data?.token || data?.access_token)
    } catch {}
    attempts.push({
      label: 'openapi JSON {apiKey,apiSecret,ownershipId} OHNE Basic-Header',
      url, contentType: 'application/json',
      bodyPreview: body.slice(0, 200),
      status: r.status, ok: r.ok,
      responseBody: text.slice(0, 800),
      hasToken,
    })
  }

  // Variante 5: app-host
  attempts.push(await tryAttempt(
    'app-host JSON {ownershipId}',
    `${WISO_APP_BASE}/auth/token`,
    basic, ownershipId,
    { body: JSON.stringify({ ownershipId }), contentType: 'application/json' },
  ))

  // Variante 6: legacy host
  attempts.push(await tryAttempt(
    'legacy grant=ownership form',
    `${WISO_LEGACY_BASE}/auth/token`,
    basic, ownershipId,
    { body: new URLSearchParams({ grant_type: 'ownership', ownershipId }).toString(), contentType: 'application/x-www-form-urlencoded' },
  ))

  const winner = attempts.find(a => a.hasToken) || null
  return NextResponse.json({
    ok: Boolean(winner),
    env: envStatus,
    winner: winner ? { label: winner.label, url: winner.url } : null,
    attempts,
    hint: winner
      ? `Erfolgreich: ${winner.label}. Code in lib/wiso.ts kann auf diesen Pfad festgenagelt werden.`
      : 'Kein Token-Versuch erfolgreich. Prüfe in WISO MeinBüro: 1) API-Key/Secret korrekt? 2) OwnershipId stimmt mit dem Mandanten? 3) API-Zugang ist aktiv (manchmal extra freischaltbar in den Account-Einstellungen).',
  })
}
