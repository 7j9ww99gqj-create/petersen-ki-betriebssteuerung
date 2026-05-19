import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { getServerMarketingKiSettings } from '@/lib/ai-settings'

const Schema = z.object({
  leads: z.array(z.object({
    name: z.string().max(200),
    firma: z.string().max(200),
    status: z.string().max(40),
    wert: z.string().max(60),
    quelle: z.string().max(100),
    betreuer: z.string().max(120),
  })).max(500).optional(),
})

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
  if (!settings.salesAssistantEnabled) {
    return NextResponse.json({ disabled: true }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })
  }

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data

  const leads = (body.leads ?? [])
    .filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
    .sort((a, b) => {
      const order = { Angebot: 0, Qualifiziert: 1, Kontaktiert: 2, Neu: 3 } as Record<string, number>
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })
    .slice(0, 5)
    .map(l => `${l.name} (${l.firma}): Status=${l.status}, Wert=${l.wert}, Quelle=${l.quelle}`)
    .join('\n- ')

  if (!leads) {
    return NextResponse.json({ error: 'Keine offenen Leads vorhanden.' }, { status: 400 })
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      instructions: `Du bist ein erfahrener B2B-Vertriebsprofi für den deutschen Mittelstand.
Analysiere die offenen Leads und gib konkrete, umsetzbare Handlungsempfehlungen.
Antworte ausschließlich als valides JSON ohne Kommentare.`,
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: `Offene Leads:\n- ${leads}\n\nErstelle priorisierte Vertriebsempfehlungen als JSON.` }],
      }],
      max_output_tokens: 768,
      text: {
        format: {
          type: 'json_schema',
          name: 'sales_assistant_result',
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              top_lead: { type: 'string' },
              sofort_aktion: { type: 'string' },
              followup_text: { type: 'string' },
              kanal: { type: 'string', enum: ['Telefon', 'E-Mail', 'LinkedIn', 'WhatsApp', 'Meeting'] },
              einwand_vorbereitung: { type: 'string' },
              naechste_3_schritte: { type: 'string' },
            },
            required: ['top_lead', 'sofort_aktion', 'followup_text', 'kanal', 'einwand_vorbereitung', 'naechste_3_schritte'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OpenAI-Fehler beim Sales-Assistenten.' }, { status: 502 })
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
