import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Pondruff Wareneingang → BüroPilot als Dokument-Eintrag (Kategorie: Wareneingang).
// Damit erscheint der Wareneingang auch im BüroPilot/Archiv.

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
  const { data: src, error: e1 } = await sb.from('pondruff_wareneingaenge').select('*').eq('id', body.id).single()
  if (e1 || !src) return NextResponse.json({ error: e1?.message || 'Wareneingang nicht gefunden' }, { status: 404 })

  const dokId = `WE-${Date.now().toString(36).toUpperCase()}`
  const ai = (src.ai_data as Record<string, unknown> | null) || null
  const beschreibung = [
    src.delivery_id ? `Lieferschein-ID: ${src.delivery_id}` : '',
    src.customer ? `Kunde: ${src.customer}` : '',
    src.operator ? `Bediener: ${src.operator}` : '',
    src.note || '',
    ai?.ocr_note ? `KI: ${ai.ocr_note}` : '',
  ].filter(Boolean).join('\n')

  const { error: e2 } = await sb.from('buero_dokumente').insert({
    id: dokId,
    user_id: access.user.id,
    kategorie: 'Wareneingang',
    titel: src.delivery_id ? `Wareneingang ${src.delivery_id}` : `Wareneingang ${src.customer || ''}`,
    kunde: src.customer,
    datum: new Date().toISOString().slice(0, 10),
    beschreibung,
    dateipfad: src.receipt_url || null,
    status: src.status || 'offen',
  })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  await sb.from('pondruff_wareneingaenge').update({
    synced_buero_dokument_id: dokId, synced_buero_at: new Date().toISOString(),
  }).eq('id', body.id)

  return NextResponse.json({ ok: true, buero_dokument_id: dokId })
}
