import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAiUsage, extractUsage } from '@/lib/ai-usage'

const Schema = z.object({
  anfrage: z.string().trim().min(1).max(4000),
  empfaenger: z.string().trim().max(200).optional(),
  kontext: z.string().trim().max(2000).optional(),
  ton: z.enum(['professionell', 'freundlich', 'formell']).optional(),
  firmenname: z.string().trim().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.emailAssistentEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const limited = checkRateLimit(user.id, 'ai')
  if (limited) return limited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const result = await parseBody(req, Schema)
  if (!result.ok) return result.error
  const body = result.data

  const prompt = `Du bist ein professioneller E-Mail-Assistent für ein deutsches Unternehmen.

Erstelle eine E-Mail-Antwort auf folgende Anfrage:
"${body.anfrage}"

${body.empfaenger ? `Empfänger: ${body.empfaenger}` : ''}
${body.kontext ? `Zusatz-Kontext: ${body.kontext}` : ''}
Ton: ${body.ton ?? 'professionell'}
Absender: ${body.firmenname ?? 'Das Team'}

Schreibe nur die E-Mail (Betreff + Inhalt). Format:
Betreff: [Betreffzeile]

[Brieftext mit Anrede, Hauptteil, Grußformel]

Maximal 200 Wörter, auf Deutsch, ${body.ton ?? 'professionell'} formuliert.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `OpenAI Fehler: ${err}` }, { status: 500 })
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const usage = extractUsage(data)
  logAiUsage({ userId: user.id, route: 'openai/email-assistent', model: 'gpt-4o-mini', inputTokens: usage.input, outputTokens: usage.output })
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
