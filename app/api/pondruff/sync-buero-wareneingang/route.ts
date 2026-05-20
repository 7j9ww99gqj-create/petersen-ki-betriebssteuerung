import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { POND_USER_EMAIL } from '@/lib/pondruff'

const Schema = z.object({
  id: z.string().trim().min(1).max(100),
})

// Pondruff Wareneingang → BüroPilot als Dokument-Eintrag (Kategorie: Wareneingang).
// Damit erscheint der Wareneingang auch im BüroPilot/Archiv.

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data

  const sb = access.supabase
  const { data: src, error: e1 } = await sb.from('pondruff_wareneingaenge').select('*').eq('id', body.id).single()
  if (e1 || !src) return NextResponse.json({ error: e1?.message || 'Wareneingang nicht gefunden' }, { status: 404 })

  // Idempotent: bestehende Dokument-ID wiederverwenden, statt jedes Mal neu zu erzeugen
  const dokId: string = (src.synced_buero_dokument_id as string | null) || `WE-${Date.now().toString(36).toUpperCase()}`
  const positionen = Array.isArray(src.positionen) ? (src.positionen as { artikelbezeichnung?: string; menge?: string; beschichtung?: string }[]) : []
  const posLines = positionen.map((p, i) =>
    `Pos. ${i + 1}: ${p.menge || ''} × ${p.artikelbezeichnung || '—'}${p.beschichtung && p.beschichtung !== 'Keine' ? ` [${p.beschichtung}]` : ''}`
  ).join('\n')
  const beschreibung = [
    src.purchase_order ? `Bestell-Nr.: ${src.purchase_order}` : '',
    src.delivery_id && src.delivery_id !== src.purchase_order ? `Lieferschein-ID: ${src.delivery_id}` : '',
    src.customer ? `Kunde: ${src.customer}` : '',
    src.lieferbedingungen ? `Lieferbedingungen: ${src.lieferbedingungen}` : '',
    src.eingelagert_von ? `Eingelagert von: ${src.eingelagert_von}` : '',
    src.eingelagert_am ? `Eingelagert am: ${src.eingelagert_am}` : '',
    src.operator ? `Bediener: ${src.operator}` : '',
    posLines || '',
    src.note || '',
  ].filter(Boolean).join('\n')

  const { error: e2 } = await sb.from('buero_dokumente').upsert({
    id: dokId,
    user_id: access.user.id,
    kategorie: 'Wareneingang',
    titel: src.purchase_order
      ? `Wareneingang ${src.purchase_order}`
      : src.delivery_id ? `Wareneingang ${src.delivery_id}` : `Wareneingang ${src.customer || ''}`,
    kunde: src.customer,
    datum: new Date().toISOString().slice(0, 10),
    beschreibung,
    dateipfad: src.receipt_url || null,
    status: src.status || 'offen',
  }, { onConflict: 'id' })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  await sb.from('pondruff_wareneingaenge').update({
    synced_buero_dokument_id: dokId, synced_buero_at: new Date().toISOString(),
  }).eq('id', body.id)

  return NextResponse.json({ ok: true, buero_dokument_id: dokId })
}
