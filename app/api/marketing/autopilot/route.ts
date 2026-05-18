import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerMarketingKiSettings } from '@/lib/ai-settings'

function pickOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string') return data.output_text
  const output = Array.isArray(data.output) ? data.output as Array<Record<string, unknown>> : []
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content as Array<Record<string, unknown>> : []
    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text
    }
  }
  return ''
}

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) {
    return NextResponse.json({ disabled: true }, { status: 403 })
  }

  const settings = await getServerMarketingKiSettings(user.id)
  if (!settings.autopilotEnabled) {
    return NextResponse.json({ disabled: true }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })
  }

  const body = await req.json() as {
    kampagnen?: Array<{ name: string; typ: string; status: string; zielgruppe: string }>
    leads?: Array<{ name: string; status: string; wert: string; quelle: string }>
    seoKeywords?: Array<{ keyword: string; klicks: number; ranking: number }>
  }

  const aktiveKampagnen = (body.kampagnen ?? [])
    .filter(k => k.status === 'Aktiv')
    .map(k => `${k.name} (${k.typ}, Zielgruppe: ${k.zielgruppe})`)
    .join('\n- ') || 'keine'

  const offeneLeads = (body.leads ?? [])
    .filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
    .slice(0, 5)
    .map(l => `${l.name}: ${l.status}, ${l.wert}, Quelle: ${l.quelle}`)
    .join('\n- ') || 'keine'

  const keywords = (body.seoKeywords ?? [])
    .sort((a, b) => b.klicks - a.klicks)
    .slice(0, 4)
    .map(s => `"${s.keyword}" (${s.klicks} Klicks, Rang #${s.ranking})`)
    .join(', ') || 'keine'

  const context = `Aktive Kampagnen:\n- ${aktiveKampagnen}\n\nOffene Leads:\n- ${offeneLeads}\n\nTop-Keywords: ${keywords}`

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      instructions: `Du bist ein erfahrener B2B-Marketingstratege für den deutschen Mittelstand.
Analysiere die Marketing-Situation und erstelle einen klaren Aktionsplan.
Antworte ausschließlich als valides JSON ohne Kommentare.`,
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: `Marketing-Situation:\n${context}\n\nErstelle einen Autopilot-Marketingplan als JSON.` }],
      }],
      max_output_tokens: 768,
      text: {
        format: {
          type: 'json_schema',
          name: 'autopilot_result',
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              zielgruppe: { type: 'string' },
              kanal_empfehlung: { type: 'string' },
              kampagnen_idee: { type: 'string' },
              funnel_luecke: { type: 'string' },
              naechster_schritt: { type: 'string' },
              prioritaet: { type: 'string', enum: ['Sofort', 'Diese Woche', 'Diesen Monat'] },
            },
            required: ['zielgruppe', 'kanal_empfehlung', 'kampagnen_idee', 'funnel_luecke', 'naechster_schritt', 'prioritaet'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OpenAI-Fehler bei Autopilot.' }, { status: 502 })
  }

  const data = await response.json() as Record<string, unknown>
  const rawText = pickOutputText(data)

  try {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ error: 'Antwort konnte nicht verarbeitet werden.' }, { status: 502 })
  }
}
