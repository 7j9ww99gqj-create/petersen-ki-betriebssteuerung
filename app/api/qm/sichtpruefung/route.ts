import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkCostLimit, extractUsage, logAiUsage } from '@/lib/ai-usage'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const Schema = z.object({
  foto_path: z.string().min(1).max(500),
  bauteil_beschreibung: z.string().max(500).optional(),
  material: z.string().max(200).optional(),
})

export const maxDuration = 60

const SYSTEM_PROMPT = `Du bist Qualitätsprüfer für Metallbauteile. Analysiere das Foto auf Oberflächenmängel. Antworte NUR mit validem JSON.

Schema:
{
  "gesamtbewertung": "ok" | "mangelhaft" | "ausschuss",
  "konfidenz": number,
  "befunde": [
    {
      "typ": "kratzer" | "delle" | "grat" | "verschmutzung" | "polierfehler" | "beschaedigung" | "sonstiges",
      "schwere": "leicht" | "mittel" | "schwer",
      "position": string,
      "beschreibung": string
    }
  ],
  "empfehlung": string,
  "hinweise": string[]
}

Regeln:
- konfidenz als ganze Zahl 0–100.
- gesamtbewertung "ok" wenn keine relevanten Mängel.
- gesamtbewertung "mangelhaft" bei leichten/mittleren Mängeln, die nachbesserbar sind.
- gesamtbewertung "ausschuss" bei schweren Mängeln, die nicht reparabel sind.
- befunde nur eintragen, wenn auf dem Foto sichtbar — nicht halluzinieren.
- position möglichst präzise ("oben links", "Bohrung Mitte", "Stirnseite", etc.).
- empfehlung kurz und konkret ("Nachpolieren empfohlen", "OK für Versand", "Ausschuss").`

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user) return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })

  const limited = checkRateLimit(access.user.id, 'ocr')
  if (limited) return limited

  const costCheck = await checkCostLimit(access.user.id)
  if (!costCheck.allowed) {
    return NextResponse.json({
      error: 'Monatliches KI-Kostenlimit erreicht',
      detail: `Verbraucht: ${costCheck.spent.toFixed(2)} € / Limit: ${costCheck.limit.toFixed(2)} €`,
    }, { status: 429 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const { foto_path, bauteil_beschreibung, material } = parsedBody.data

  // Pfad muss mit user_id beginnen (RLS-Safety)
  const firstSegment = foto_path.split('/')[0]
  if (firstSegment !== access.user.id) {
    return NextResponse.json({ error: 'Pfad gehört nicht zum aktuellen Nutzer.' }, { status: 403 })
  }

  // Signed URL via Service-Role erzeugen
  const admin = createSupabaseAdminClient()
  const { data: signed, error: signedErr } = await admin.storage
    .from('qm-fotos')
    .createSignedUrl(foto_path, 3600)
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Signed URL konnte nicht erzeugt werden', detail: signedErr?.message }, { status: 500 })
  }

  const model = process.env.OPENAI_QM_SICHT_MODEL || 'gpt-4o'

  const kontextZeile = [
    bauteil_beschreibung ? `Bauteil: ${bauteil_beschreibung}` : null,
    material ? `Material: ${material}` : null,
  ].filter(Boolean).join(' · ')

  const userText = kontextZeile
    ? `${kontextZeile}\n\nAnalysiere das Foto auf Oberflächenmängel und gib JSON gemäß Schema zurück.`
    : 'Analysiere das Foto auf Oberflächenmängel und gib JSON gemäß Schema zurück.'

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: 'OpenAI-Aufruf fehlgeschlagen', detail: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }

  if (!response.ok) {
    const errText = await response.text()
    let detail = errText.slice(0, 500)
    try {
      const j = JSON.parse(errText) as { error?: { message?: string } }
      if (j?.error?.message) detail = j.error.message
    } catch { /* ignore */ }
    return NextResponse.json({ error: 'OpenAI-Fehler', detail, status: response.status }, { status: 502 })
  }

  const data = await response.json()
  const usage = extractUsage(data)
  logAiUsage({
    userId: access.user.id,
    route: 'qm/sichtpruefung',
    model,
    inputTokens: usage.input,
    outputTokens: usage.output,
  })

  const text: string = data.choices?.[0]?.message?.content || '{}'
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'KI-Antwort kein gültiges JSON', detail: text.slice(0, 500) }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
