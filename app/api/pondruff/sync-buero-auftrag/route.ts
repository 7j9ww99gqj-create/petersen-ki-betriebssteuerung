import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Pondruff Preisauftrag → BüroPilot Auftrag.
// Erstellt einen buero_auftraege-Eintrag aus einem pondruff_preisauftraege-Record
// und verlinkt beide via synced_buero_auftrag_id.

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  let body: { id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const sb = access.supabase
  const { data: src, error: e1 } = await sb.from('pondruff_preisauftraege').select('*').eq('id', body.id).single()
  if (e1 || !src) return NextResponse.json({ error: e1?.message || 'Auftrag nicht gefunden' }, { status: 404 })

  // BueroPilot-Auftrag bauen
  const auftragId = src.order_id || `PON-${Date.now()}`
  const rows = Array.isArray(src.rows) ? src.rows : []
  const beschreibung = rows.length
    ? rows.map((r: Record<string, unknown>, i: number) => `${String(i + 1).padStart(2, '0')}. ${String(r['Beschreibung'] || '').split('\n')[0]} (${String(r['Menge'])}x ${String(r['Einzelpreis'])} €)`).join('\n')
    : (src.project || '')

  const total = Number(src.total || 0)
  const wert = total > 0 ? total.toFixed(2).replace('.', ',') + ' €' : ''

  // Kunde anlegen falls noch nicht vorhanden
  let kunde_id: string | null = null
  if (src.customer) {
    const { data: existingKunde } = await sb.from('buero_kunden').select('id').ilike('name', src.customer).limit(1).maybeSingle()
    if (existingKunde?.id) {
      kunde_id = existingKunde.id
    } else {
      const newKundeId = `K-${Date.now().toString(36).toUpperCase()}`
      const { error: kErr } = await sb.from('buero_kunden').insert({
        id: newKundeId, name: src.customer, user_id: access.user.id,
      })
      if (!kErr) kunde_id = newKundeId
    }
  }

  const { error: e2 } = await sb.from('buero_auftraege').upsert({
    id: auftragId,
    user_id: access.user.id,
    kunde_id, kunde: src.customer,
    beschreibung,
    wert,
    status: src.status === 'rechnung' ? 'Abgeschlossen' : 'In Bearbeitung',
    start: new Date().toISOString().slice(0, 10),
    ab_nummer: src.order_id,
    ab_verschickt_am: src.confirmed_at ? new Date(src.confirmed_at).toISOString().slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  await sb.from('pondruff_preisauftraege').update({
    synced_buero_auftrag_id: auftragId, synced_buero_at: new Date().toISOString(),
  }).eq('id', body.id)

  return NextResponse.json({ ok: true, buero_auftrag_id: auftragId })
}
