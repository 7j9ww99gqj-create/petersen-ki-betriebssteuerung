import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL, money } from '@/lib/pondruff'

// WISO MeinBüro REST API Direkt-Export eines Pondruff-Preisauftrags.
// Erwartet ENV: WISO_MEINBUERO_API_KEY, WISO_MEINBUERO_API_SECRET, WISO_MEINBUERO_OWNERSHIP_ID.
// Port der Logik aus dem Streamlit-Tool (app.py wiso_get_token / wiso_find_customer_id / create_wiso_meinbuero_order).

export const maxDuration = 60

const API_BASE = 'https://api.meinbuero.de/openapi'
const LEGACY_BASE = 'https://api.meinbuero.de'

type Headers = Record<string, string>

async function wisoRequest(method: string, path: string, opts: {
  token?: string
  basic?: string
  payload?: unknown
  formPayload?: Record<string, string>
  base?: string
  ownershipId?: string
} = {}): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  const base = opts.base || API_BASE
  const headers: Headers = { Accept: 'application/json' }
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
    try { const j = JSON.parse(text); msg = j.message || JSON.stringify(j) } catch {}
    return { ok: false, status: r.status, message: msg.slice(0, 500) }
  }
  try { return { ok: true, data: text ? JSON.parse(text) : {} } } catch { return { ok: true, data: {} } }
}

async function getWisoToken(apiKey: string, apiSecret: string, ownershipId: string): Promise<string> {
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  // Versuch 1: neue API
  const r1 = await wisoRequest('POST', '/auth/token', { basic, payload: { ownershipId }, ownershipId })
  if (r1.ok) {
    const d = r1.data as Record<string, unknown>
    const t = String(d.token || d.access_token || '')
    if (t) return t
  }
  // Versuch 2: legacy
  const r2 = await wisoRequest('POST', '/auth/token', { basic, formPayload: { grant_type: 'ownership', ownershipId }, base: LEGACY_BASE, ownershipId })
  if (r2.ok) {
    const d = r2.data as Record<string, unknown>
    const t = String(d.token || d.access_token || '')
    if (t) return t
  }
  throw new Error(`WISO Token-Holen fehlgeschlagen: ${(r1 as { message?: string }).message || ''} | ${(r2 as { message?: string }).message || ''}`)
}

function compactMatch(v: string): string { return v.toLowerCase().replace(/[^a-z0-9]+/g, '') }

async function findCustomerId(name: string, token: string, ownershipId: string): Promise<{ id: string | null; candidates: string[] }> {
  if (!name.trim()) throw new Error('Kein Kunde im Auftrag')
  const q = new URLSearchParams({ limit: '20', offset: '0', orderBy: 'name', search: name }).toString()
  const r = await wisoRequest('GET', `/customer?${q}`, { token, ownershipId })
  if (!r.ok) throw new Error(`WISO Kundensuche fehlgeschlagen: ${r.message}`)
  const root = r.data as { data?: unknown }
  let list: Record<string, unknown>[] = []
  if (Array.isArray(root.data)) list = root.data as Record<string, unknown>[]
  else if (root.data && typeof root.data === 'object') {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) list = nested as Record<string, unknown>[]
  }
  const needle = compactMatch(name)
  const candidates: string[] = []
  for (const c of list) {
    const nm = String(c.name || c.companyName || c.lastName || '').trim()
    if (nm) candidates.push(nm)
    const hay = compactMatch(nm)
    if (needle && (needle === hay || needle.includes(hay) || hay.includes(needle))) {
      if (c.id) return { id: String(c.id), candidates }
    }
  }
  if (list.length === 1 && list[0].id) return { id: String(list[0].id), candidates }
  return { id: null, candidates }
}

function safeInt(v: unknown, d = 1): number { const n = parseInt(String(v)); return Number.isFinite(n) ? n : d }
function floatFromWiso(v: unknown): number {
  let s = String(v ?? '').trim()
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s); return Number.isFinite(n) ? n : 0
}

type Row = Record<string, unknown>

function positionPayload(row: Row): Record<string, unknown> {
  const desc = String(row['Beschreibung'] || '').trim()
  const articleNo = String(row['Artikel-Nr.'] || '').trim()
  const firstLine = desc.split('\n')[0]?.trim() || ''
  const title = (articleNo || firstLine || 'Pondruff Beschichtung').slice(0, 80)
  let priceNet = floatFromWiso(row['Einzelpreis'])
  if (priceNet <= 0) priceNet = floatFromWiso(row['Listenpreis'])
  return {
    amount: safeInt(row['Menge'], 1),
    title, description: desc, showDescription: true,
    unit: 'Stk.', priceNet, priceGross: money(priceNet * 1.19),
    vatPercent: 19, discountPercent: 0, metaData: { type: 'custom' },
  }
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const apiKey = process.env.WISO_MEINBUERO_API_KEY
  const apiSecret = process.env.WISO_MEINBUERO_API_SECRET
  const ownershipId = process.env.WISO_MEINBUERO_OWNERSHIP_ID
  const missing = [
    !apiKey && 'WISO_MEINBUERO_API_KEY',
    !apiSecret && 'WISO_MEINBUERO_API_SECRET',
    !ownershipId && 'WISO_MEINBUERO_OWNERSHIP_ID',
  ].filter(Boolean)
  if (missing.length) return NextResponse.json({ error: `WISO Env-Vars fehlen: ${missing.join(', ')}` }, { status: 400 })

  let body: { id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const sb = access.supabase
  const { data: src, error: e1 } = await sb.from('pondruff_preisauftraege').select('*').eq('id', body.id).single()
  if (e1 || !src) return NextResponse.json({ error: e1?.message || 'Auftrag nicht gefunden' }, { status: 404 })

  try {
    const token = await getWisoToken(apiKey!, apiSecret!, ownershipId!)
    const { id: customerId, candidates } = await findCustomerId(String(src.customer || ''), token, ownershipId!)
    if (!customerId) {
      const hint = candidates.length ? ` Gefundene Treffer: ${candidates.join(', ')}.` : ''
      return NextResponse.json({ error: `Kunde "${src.customer}" wurde in WISO nicht eindeutig gefunden.${hint}` }, { status: 422 })
    }
    const rows = (Array.isArray(src.rows) ? src.rows : []) as Row[]
    const payload = {
      customerId: /^\d+$/.test(customerId) ? parseInt(customerId, 10) : customerId,
      positions: rows.map(positionPayload),
    }
    const resp = await wisoRequest('POST', '/order/', { token, payload, ownershipId: ownershipId! })
    if (!resp.ok) return NextResponse.json({ error: `WISO POST /order/ fehlgeschlagen: ${resp.message}` }, { status: 502 })

    await sb.from('pondruff_preisauftraege').update({
      synced_wiso_at: new Date().toISOString(),
      synced_wiso_response: resp.data as Record<string, unknown>,
    }).eq('id', body.id)

    return NextResponse.json({ ok: true, customer_id: customerId, response: resp.data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
