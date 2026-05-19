import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Bauteil-KI-Suche v3: Reine Embedding-Suche.
// 1) Such-Foto + Hinweis → GPT-4o-mini Vision → Kurzbeschreibung
// 2) Beschreibung → text-embedding-3-small → 1536-dim Vector
// 3) Supabase RPC match_pondruff_bauteile (pgvector Kosinus) → Top-N
// 4) Wenn noch keine Embeddings existieren: klarer Hinweis, dass Backfill nötig ist
//    (kein teurer Live-Vision-Vergleich mehr — der hat ~$0.01-0.05 pro Anfrage gekostet)

export const maxDuration = 60

const MAX_RESULTS = 10
const SIM_THRESHOLD = 0.35

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }
  const blocked = await requirePondruffFeature('ki_bauteilsuche', access.user.id)
  if (blocked) return blocked
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { image?: string; note?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  const image = body.image
  const note = (body.note || '').trim()
  if (!image?.startsWith('data:')) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 })

  const sb = access.supabase

  // Schritt 1: Vision-Beschreibung des Such-Bildes
  const visionPrompt = 'Beschreibe das Bauteil auf dem Foto in 1–2 deutschen Sätzen. Fokus: Form, grobe Maße, Material/Farbe, Besonderheiten. Maximal 200 Zeichen.'
  let queryDescription = note
  try {
    const vRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{ role: 'user', content: [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: { url: image } },
        ] }],
      }),
    })
    if (vRes.ok) {
      const vData = await vRes.json()
      const desc = String(vData.choices?.[0]?.message?.content || '').trim()
      queryDescription = [note, desc].filter(Boolean).join(' | ')
    }
  } catch {}

  if (!queryDescription) {
    return NextResponse.json({ matches: [], note: 'Konnte das Such-Bild nicht beschreiben.' })
  }

  // Schritt 2: Embedding fuer die Beschreibung
  const eRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: queryDescription }),
  })
  if (!eRes.ok) {
    const err = await eRes.text()
    return NextResponse.json({ error: 'OpenAI-Embedding fehlgeschlagen', detail: err.slice(0, 300) }, { status: 502 })
  }
  const eData = await eRes.json()
  const queryEmbedding: number[] = eData.data?.[0]?.embedding
  if (!Array.isArray(queryEmbedding)) {
    return NextResponse.json({ error: 'Embedding ungueltig' }, { status: 502 })
  }

  // Schritt 3: RPC-Suche
  const { data: rpc, error: rpcErr } = await sb.rpc('match_pondruff_bauteile', {
    query_embedding: queryEmbedding,
    match_count: MAX_RESULTS,
    similarity_threshold: SIM_THRESHOLD,
  })
  if (rpcErr) {
    return NextResponse.json({ error: 'Suche fehlgeschlagen', detail: rpcErr.message }, { status: 500 })
  }

  type Hit = { id: string; customer: string | null; delivery_id: string | null; article_no: string | null; description: string | null; image_url: string; wareneingang_id: string | null; created_at: string; similarity: number }
  const hits = (rpc as Hit[]) || []

  // Keine Treffer? Pruefen, ob ueberhaupt schon Embeddings existieren.
  if (!hits.length) {
    const { count: withEmbeddings } = await sb.from('pondruff_bauteile')
      .select('id', { count: 'exact', head: true }).not('embedding', 'is', null)
    const { count: withoutEmbeddings } = await sb.from('pondruff_bauteile')
      .select('id', { count: 'exact', head: true }).is('embedding', null)

    if ((withEmbeddings ?? 0) === 0 && (withoutEmbeddings ?? 0) > 0) {
      return NextResponse.json({
        matches: [],
        query_description: queryDescription,
        note: `Der Bauteil-Index ist noch nicht aufgebaut: ${withoutEmbeddings} Bauteil(e) ohne Embedding. Bitte den Inhaber: Backfill über /api/pondruff/embed-backfill ausführen.`,
        needs_backfill: true,
        pending: withoutEmbeddings ?? 0,
      })
    }
    return NextResponse.json({
      matches: [],
      query_description: queryDescription,
      note: 'Keine ähnlichen Bauteile gefunden. Versuche ein klareres Foto oder zusätzliche Hinweise.',
    })
  }

  // Signed URLs anhaengen
  const enriched = await Promise.all(hits.map(async h => {
    const { data: signed } = await sb.storage.from('pondruff').createSignedUrl(h.image_url, 300)
    return {
      score: Math.round(h.similarity * 100),
      reason: `Ähnlichkeits-Score ${Math.round(h.similarity * 100)}% (semantische Suche)`,
      bauteil: {
        id: h.id, customer: h.customer, delivery_id: h.delivery_id,
        article_no: h.article_no, description: h.description,
        signed: signed?.signedUrl || '',
      },
    }
  }))

  return NextResponse.json({ matches: enriched, query_description: queryDescription })
}
