import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { POND_USER_EMAIL } from '@/lib/pondruff'
import { getWisoToken, wisoRequest } from '@/lib/wiso'

// Wareneingang als WISO-Vorgang anlegen (ohne Positionen, nur Notiz).
// WISO MeinBüro hat keinen nativen Wareneingang-Typ → wir legen einen leeren Auftrag
// (oder Vorgang) beim entsprechenden Kunden mit der Wareneingang-Notiz an.

export const maxDuration = 60

function compactMatch(v: string): string { return v.toLowerCase().replace(/[^a-z0-9]+/g, '') }

async function findOrCreateCustomer(name: string, token: string, ownershipId: string): Promise<string> {
  const q = new URLSearchParams({ limit: '20', offset: '0', orderBy: 'name', search: name }).toString()
  const r = await wisoRequest('GET', `/customer?${q}`, { token, ownershipId })
  if (r.ok) {
    const root = r.data as { data?: unknown }
    let list: Record<string, unknown>[] = []
    if (Array.isArray(root.data)) list = root.data as Record<string, unknown>[]
    else if (root.data && typeof root.data === 'object') { const n = (root.data as { data?: unknown }).data; if (Array.isArray(n)) list = n as Record<string, unknown>[] }
    const needle = compactMatch(name)
    for (const c of list) {
      const nm = String(c.name || c.companyName || c.lastName || '').trim()
      if (compactMatch(nm).includes(needle) || needle.includes(compactMatch(nm))) {
        if (c.id) return String(c.id)
      }
    }
    if (list.length === 1 && list[0].id) return String(list[0].id)
  }
  // Kunde anlegen (minimal)
  const create = await wisoRequest('POST', '/customer/', { token, ownershipId, payload: { companyName: name, isCustomer: true } })
  if (!create.ok) throw new Error(`Kunde konnte nicht angelegt werden: ${create.message}`)
  const d = create.data as Record<string, unknown>
  const newId = String(d.id || (d.data as Record<string, unknown> | undefined)?.id || '')
  if (!newId) throw new Error('WISO Kunde angelegt aber keine ID erhalten')
  return newId
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const blocked = await requirePondruffFeature('wiso_sync', access.user.id)
  if (blocked) return blocked

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
  const { data: src, error: e1 } = await sb.from('pondruff_wareneingaenge').select('*').eq('id', body.id).single()
  if (e1 || !src) return NextResponse.json({ error: e1?.message || 'Wareneingang nicht gefunden' }, { status: 404 })
  if (!src.customer) return NextResponse.json({ error: 'Kein Kunde im Wareneingang gespeichert — WISO benötigt einen Kunden.' }, { status: 400 })

  try {
    const token = await getWisoToken(apiKey!, apiSecret!, ownershipId!)
    const customerId = await findOrCreateCustomer(String(src.customer), token, ownershipId!)
    const ai = (src.ai_data as Record<string, unknown> | null) || null
    const description = [
      `Wareneingang ${src.delivery_id || '(ohne Lieferschein-Nr.)'}`,
      src.operator ? `Bediener: ${src.operator}` : '',
      src.status ? `Status: ${src.status}` : '',
      src.note || '',
      ai?.ocr_note ? `KI: ${ai.ocr_note}` : '',
    ].filter(Boolean).join('\n')

    const payload = {
      customerId: /^\d+$/.test(customerId) ? parseInt(customerId, 10) : customerId,
      positions: [{
        amount: 1,
        title: `Wareneingang ${src.delivery_id || ''}`.slice(0, 80),
        description,
        showDescription: true,
        unit: 'Stk.',
        priceNet: 0,
        priceGross: 0,
        vatPercent: 19,
        discountPercent: 0,
        metaData: { type: 'custom' },
      }],
    }
    const resp = await wisoRequest('POST', '/order/', { token, payload, ownershipId: ownershipId! })
    if (!resp.ok) return NextResponse.json({ error: `WISO POST fehlgeschlagen: ${resp.message}` }, { status: 502 })

    await sb.from('pondruff_wareneingaenge').update({
      synced_buero_at: src.synced_buero_at, // unchanged
      ai_data: { ...(ai || {}), wiso: { synced_at: new Date().toISOString(), response: resp.data } },
    }).eq('id', body.id)

    return NextResponse.json({ ok: true, customer_id: customerId, response: resp.data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
