import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAiUsage, extractUsage, checkCostLimit } from '@/lib/ai-usage'

const Schema = z.object({
  rechnung: z.object({
    nummer: z.string().trim().max(60).optional(),
    kunde: z.string().trim().min(1).max(200),
    betrag: z.string().trim().min(1).max(40),
    faellig: z.string().trim().min(1).max(40),
    mahnung_count: z.number().int().min(0).max(10).optional(),
  }),
  ton: z.enum(['freundlich', 'bestimmt', 'streng']).optional(),
  firmenname: z.string().trim().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.mahnungsgeneratorEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const limited = checkRateLimit(user.id, 'ai')
  if (limited) return limited

  const costCheck = await checkCostLimit(user.id)
  if (!costCheck.allowed) return NextResponse.json({ error: `KI-Budget erschöpft (${costCheck.spent.toFixed(4)} / ${costCheck.limit} €).` }, { status: 429 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const result = await parseBody(req, Schema)
  if (!result.ok) return result.error
  const body = result.data

  const mahnStufe = (body.rechnung.mahnung_count ?? 0) + 1
  const ton = body.ton ?? (mahnStufe === 1 ? 'freundlich' : mahnStufe === 2 ? 'bestimmt' : 'streng')

  const prompt = `Erstelle einen deutschen Mahnbrief (${mahnStufe}. Mahnung) für folgende Rechnung:

Rechnungsnummer: ${body.rechnung.nummer ?? 'N/A'}
Kunde: ${body.rechnung.kunde}
Betrag: ${body.rechnung.betrag}
Fälligkeitsdatum: ${body.rechnung.faellig}
Mahnstufe: ${mahnStufe}
Ton: ${ton}
Absender: ${body.firmenname ?? 'Ihr Unternehmen'}

Schreibe einen professionellen Mahnbrief auf Deutsch.
- Nur den Brieftext (kein Betreff-Präfix, keine Erläuterungen davor/danach)
- Beginne direkt mit der Anrede
- Zahlungsfrist: ${mahnStufe === 1 ? '7' : mahnStufe === 2 ? '5' : '3'} Werktage
- Bei Mahnstufe 3: weise auf rechtliche Schritte hin
- Maximal 200 Wörter`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `OpenAI Fehler: ${err}` }, { status: 500 })
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const usage = extractUsage(data)
  logAiUsage({ userId: user.id, route: 'openai/mahnung', model: 'gpt-4o-mini', inputTokens: usage.input, outputTokens: usage.output })
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
