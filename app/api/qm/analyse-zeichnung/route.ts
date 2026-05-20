import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkCostLimit, extractUsage, logAiUsage } from '@/lib/ai-usage'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const Schema = z.object({
  datei_path: z.string().min(1).max(500),
})

export const maxDuration = 60

const SYSTEM_PROMPT = `Du bist Experte für technische Zeichnungen nach DIN/ISO-Normen.
Analysiere die Zeichnung und extrahiere ALLE Maße, Toleranzen, Materialangaben und Anforderungen.
Antworte NUR mit validem JSON, kein Markdown, keine Erklärung.

Schema:
{
  "masse": [
    { "name": string, "wert": number, "einheit": string, "toleranz_plus": number|null, "toleranz_minus": number|null, "kritisch": boolean, "konfidenz": number }
  ],
  "material": string|null,
  "oberflaeche": { "ra": number|null, "rz": number|null, "anforderung": string|null },
  "gewinde": [{ "bezeichnung": string, "anzahl": number, "position": string }],
  "beschichtung": string|null,
  "sonderanforderungen": string[],
  "zeichnungsnummer": string|null,
  "revision": string|null,
  "gesamt_konfidenz": number
}

Regeln:
- Konfidenz-Werte als ganze Zahlen 0–100.
- Toleranzen in der Einheit der Maße (meist mm).
- "kritisch" = true bei kritischen Maßen (mit Toleranz <= 0.05 oder explizit markiert).
- Wenn nichts erkennbar: leere Arrays / null einsetzen, kein Halluzinieren.`

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
  const { datei_path } = parsedBody.data

  // Pfad muss mit user_id beginnen (RLS-Safety)
  const firstSegment = datei_path.split('/')[0]
  if (firstSegment !== access.user.id) {
    return NextResponse.json({ error: 'Pfad gehört nicht zum aktuellen Nutzer.' }, { status: 403 })
  }

  // Signed URL via Service-Role erzeugen
  const admin = createSupabaseAdminClient()
  const { data: signed, error: signedErr } = await admin.storage
    .from('qm-zeichnungen')
    .createSignedUrl(datei_path, 3600)
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Signed URL konnte nicht erzeugt werden', detail: signedErr?.message }, { status: 500 })
  }

  const model = process.env.OPENAI_QM_VISION_MODEL || 'gpt-4o-mini'

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
              { type: 'text', text: 'Analysiere diese technische Zeichnung und gib JSON gemäß Schema zurück.' },
              { type: 'image_url', image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2048,
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
    route: 'qm/analyse-zeichnung',
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
