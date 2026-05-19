import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Bauteil-KI-Suche: Such-Foto vs. alle bisher gespeicherten Bauteile.
// GPT-4 Vision bekommt das Such-Bild + bis zu N Vergleichs-Bilder und gibt eine Treffer-Liste mit Score (0-100) zurück.

export const maxDuration = 90

const MAX_COMPARE = 12

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { image?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  const image = body.image
  if (!image?.startsWith('data:')) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 })

  const sb = access.supabase
  const { data: bauteile, error } = await sb.from('pondruff_bauteile').select('*').order('created_at', { ascending: false }).limit(MAX_COMPARE)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bauteile?.length) return NextResponse.json({ matches: [], note: 'Keine gespeicherten Bauteile zum Vergleich.' })

  // Signed URLs für die Bilder erzeugen (Storage ist privat)
  const compared: { id: string; customer: string | null; delivery_id: string | null; description: string | null; url: string; signed: string | null }[] = []
  for (const b of bauteile) {
    if (!b.image_url) continue
    const { data: signed } = await sb.storage.from('pondruff').createSignedUrl(b.image_url, 300)
    compared.push({
      id: b.id, customer: b.customer, delivery_id: b.delivery_id, description: b.description,
      url: b.image_url, signed: signed?.signedUrl || null,
    })
  }
  const withSigned = compared.filter(x => x.signed)
  if (!withSigned.length) return NextResponse.json({ matches: [], note: 'Keine Bilder zum Vergleich verfügbar.' })

  const prompt = `Du bist ein Bauteil-Vergleichs-Assistent.

Du bekommst ein Such-Bild und ${withSigned.length} Vergleichs-Bilder.
Vergleiche das Such-Bild mit jedem Vergleichs-Bild.

Antworte NUR als JSON ohne Markdown:
{"matches":[{"index":0,"score":0,"reason":""}]}

- index: 0-basiert in der Reihenfolge der Vergleichs-Bilder
- score: 0–100 (Wahrscheinlichkeit, dass es das gleiche Bauteil ist)
- reason: kurze deutsche Begründung (max 80 Zeichen)

Gib nur Treffer mit score >= 30 zurück, sortiert nach score DESC.`

  type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  const content: Part[] = [{ type: 'text', text: prompt }, { type: 'text', text: 'SUCH-BILD:' }, { type: 'image_url', image_url: { url: image } }]
  withSigned.forEach((c, i) => {
    content.push({ type: 'text', text: `VERGLEICH ${i}: ${c.description || ''} (Kunde: ${c.customer || '-'})` })
    content.push({ type: 'image_url', image_url: { url: c.signed! } })
  })

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_tokens: 1024,
      }),
    })
    if (!r.ok) {
      const err = await r.text()
      return NextResponse.json({ error: 'OpenAI-Fehler', detail: err.slice(0, 500) }, { status: 502 })
    }
    const data = await r.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    const matches = Array.isArray(parsed.matches) ? parsed.matches : []
    const enriched = matches.map((m: { index: number; score: number; reason: string }) => {
      const c = withSigned[m.index]
      return c ? { ...m, bauteil: c } : null
    }).filter(Boolean)
    return NextResponse.json({ matches: enriched })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
