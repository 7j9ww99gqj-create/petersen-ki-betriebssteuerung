import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Bauteil-KI-Suche v2: Embedding-basiert.
// 1) Such-Foto + Hinweis → GPT-4o-mini Vision → Kurzbeschreibung
// 2) Beschreibung → text-embedding-3-small → 1536-dim Vector
// 3) Supabase RPC match_pondruff_bauteile (pgvector Kosinus) → Top-N
// 4) Fallback wenn keine Embeddings vorhanden: alte Live-GPT-Vision-Variante (max. 12 Bilder)

export const maxDuration = 60

const MAX_RESULTS = 10
const SIM_THRESHOLD = 0.35
const VISION_FALLBACK_MAX = 12

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }
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

  // Wenn Embeddings noch fehlen (Backfill nicht gelaufen): Fallback auf Live-Vision-Vergleich
  if (!hits.length) {
    const { data: anyEmb } = await sb.from('pondruff_bauteile')
      .select('id', { count: 'exact', head: true }).not('embedding', 'is', null)
    const hasAny = (anyEmb as unknown as { count?: number })?.count ?? 0
    if (!hasAny) {
      return await visionFallback(sb, apiKey, image)
    }
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

// Fallback: alte Live-GPT-Vision-Vergleichs-Logik (nur wenn noch keine Embeddings da sind)
async function visionFallback(sb: NonNullable<Awaited<ReturnType<typeof getRouteAccess>>['supabase']>, apiKey: string, image: string) {
  const { data: bauteile } = await sb.from('pondruff_bauteile').select('*').order('created_at', { ascending: false }).limit(VISION_FALLBACK_MAX)
  if (!bauteile?.length) return NextResponse.json({ matches: [], note: 'Keine gespeicherten Bauteile zum Vergleich.' })
  const compared: { id: string; customer: string | null; delivery_id: string | null; description: string | null; signed: string }[] = []
  for (const b of bauteile) {
    if (!b.image_url) continue
    const { data: signed } = await sb.storage.from('pondruff').createSignedUrl(b.image_url, 300)
    if (signed?.signedUrl) compared.push({ id: b.id, customer: b.customer, delivery_id: b.delivery_id, description: b.description, signed: signed.signedUrl })
  }
  if (!compared.length) return NextResponse.json({ matches: [], note: 'Keine Bilder zum Vergleich.' })
  type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  const content: Part[] = [
    { type: 'text', text: `Vergleiche das Such-Bild mit ${compared.length} Vergleichs-Bildern. Antworte als JSON {"matches":[{"index":0,"score":0,"reason":""}]}. score 0–100, sortiert DESC, nur ab 30.` },
    { type: 'text', text: 'SUCH-BILD:' },
    { type: 'image_url', image_url: { url: image } },
  ]
  compared.forEach((c, i) => {
    content.push({ type: 'text', text: `VERGLEICH ${i}: ${c.description || ''} (Kunde: ${c.customer || '-'})` })
    content.push({ type: 'image_url', image_url: { url: c.signed } })
  })
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content }], response_format: { type: 'json_object' }, max_tokens: 1024 }),
  })
  if (!r.ok) return NextResponse.json({ matches: [], note: 'Fallback fehlgeschlagen' })
  const data = await r.json()
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
  const arr = Array.isArray(parsed.matches) ? parsed.matches : []
  const enriched = arr.map((m: { index: number; score: number; reason: string }) => {
    const c = compared[m.index]
    return c ? { ...m, bauteil: { id: c.id, customer: c.customer, delivery_id: c.delivery_id, description: c.description, signed: c.signed } } : null
  }).filter(Boolean)
  return NextResponse.json({ matches: enriched, fallback: true, note: 'Live-Vergleich (Embedding-Backfill empfohlen).' })
}
