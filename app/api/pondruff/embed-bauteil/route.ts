import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Embedding fuer ein Bauteil: Bild + Metadaten -> textuelle Beschreibung (GPT-4o-mini Vision)
// -> 1536-dim Embedding (text-embedding-3-small) -> pondruff_bauteile.embedding.
// Wird einmalig pro Bauteil aufgerufen (beim Wareneingang-Save oder via Backfill).

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  if (!body.id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const sb = access.supabase
  const { data: bt, error } = await sb.from('pondruff_bauteile').select('*').eq('id', body.id).single()
  if (error || !bt) return NextResponse.json({ error: error?.message || 'Bauteil nicht gefunden' }, { status: 404 })

  // Bild signed URL
  let visionDescription = ''
  try {
    const { data: signed } = await sb.storage.from('pondruff').createSignedUrl(bt.image_url, 300)
    if (signed?.signedUrl) {
      const visionPrompt = 'Beschreibe das Bauteil auf dem Foto in 1–2 deutschen Sätzen. Fokus: Form (rund/eckig), grobe Maße falls sichtbar, Material/Farbe, Besonderheiten (Bohrungen, Gewinde, Beschichtung). Maximal 200 Zeichen, keine Fülltextfloskeln.'
      const vRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [{ role: 'user', content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: signed.signedUrl } },
          ] }],
        }),
      })
      if (vRes.ok) {
        const vData = await vRes.json()
        visionDescription = String(vData.choices?.[0]?.message?.content || '').trim()
      }
    }
  } catch {}

  // Embedding-Text aus allen verfuegbaren Feldern
  const embText = [
    bt.customer ? `Kunde: ${bt.customer}` : '',
    bt.article_no ? `Artikel-Nr.: ${bt.article_no}` : '',
    bt.description ? `Beschreibung: ${bt.description}` : '',
    bt.note ? `Notiz: ${bt.note}` : '',
    visionDescription ? `Bild: ${visionDescription}` : '',
  ].filter(Boolean).join(' | ')

  if (!embText.trim()) {
    return NextResponse.json({ error: 'Kein Inhalt fuer Embedding' }, { status: 400 })
  }

  // Embedding generieren
  const eRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: embText }),
  })
  if (!eRes.ok) {
    const err = await eRes.text()
    return NextResponse.json({ error: 'OpenAI-Embedding fehlgeschlagen', detail: err.slice(0, 300) }, { status: 502 })
  }
  const eData = await eRes.json()
  const embedding = eData.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    return NextResponse.json({ error: 'Ungueltiges Embedding' }, { status: 502 })
  }

  // In DB speichern (pgvector erwartet Array-Literal als String)
  const { error: uErr } = await sb.from('pondruff_bauteile').update({
    embedding: embedding,
    embedding_text: embText,
  }).eq('id', body.id)
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, embedding_text: embText, vision_description: visionDescription })
}
