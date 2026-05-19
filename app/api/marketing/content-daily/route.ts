import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { getServerMarketingKiSettings } from '@/lib/ai-settings'

const Schema = z.object({
  kampagnen: z.array(z.object({
    name: z.string().max(200),
    typ: z.string().max(60),
    status: z.string().max(40),
  })).max(500).optional(),
  leads: z.array(z.object({
    name: z.string().max(200),
    status: z.string().max(40),
    wert: z.string().max(60),
  })).max(500).optional(),
  seoKeywords: z.array(z.object({ keyword: z.string().max(200) })).max(500).optional(),
  newsletter: z.array(z.object({
    betreff: z.string().max(300),
    status: z.string().max(40),
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
  if (!settings.contentDailyEnabled) {
    return NextResponse.json({ disabled: true }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })
  }

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data

  const aktiveKampagnen = (body.kampagnen ?? [])
    .filter(k => k.status === 'Aktiv')
    .map(k => `${k.name} (${k.typ})`)
    .join(', ') || 'keine'

  const topLeads = (body.leads ?? [])
    .slice(0, 3)
    .map(l => `${l.name} (${l.status}, ${l.wert})`)
    .join(', ') || 'keine'

  const keywords = (body.seoKeywords ?? [])
    .slice(0, 4)
    .map(s => s.keyword)
    .join(', ') || 'keine'

  const newsletterDraft = (body.newsletter ?? []).filter(n => n.status === 'Entwurf').length

  const context = `Aktive Kampagnen: ${aktiveKampagnen}
Top-Leads: ${topLeads}
SEO-Keywords: ${keywords}
Newsletter im Entwurf: ${newsletterDraft}`

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      instructions: `Du bist ein kreativer B2B-Marketing-Stratege für den deutschen Mittelstand.
Analysiere die Marketing-Daten und erstelle EINEN konkreten Content-Vorschlag für morgen.
Antworte ausschließlich als valides JSON ohne Kommentare.`,
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: `Marketing-Kontext:\n${context}\n\nErstelle den besten Content-Vorschlag für morgen als JSON.` }],
      }],
      max_output_tokens: 512,
      text: {
        format: {
          type: 'json_schema',
          name: 'content_daily_result',
          strict: false,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              titel: { type: 'string' },
              kanal: { type: 'string', enum: ['LinkedIn', 'Instagram', 'Newsletter', 'Blog', 'WhatsApp', 'Facebook'] },
              hook: { type: 'string' },
              inhalt: { type: 'string' },
              cta: { type: 'string' },
              begruendung: { type: 'string' },
            },
            required: ['titel', 'kanal', 'hook', 'inhalt', 'cta', 'begruendung'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'OpenAI-Fehler bei Content-Daily.' }, { status: 502 })
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
