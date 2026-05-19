import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAiUsage, extractUsage, checkCostLimit } from '@/lib/ai-usage'

const Schema = z.object({
  umsatzDaten: z.array(z.object({
    monat: z.string().trim().max(40),
    umsatz: z.number().finite(),
    kosten: z.number().finite(),
  })).max(60).optional(),
  steuersatz: z.number().min(0).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.steuerprognoseEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const limited = checkRateLimit(user.id, 'ai')
  if (limited) return limited

  const costCheck = await checkCostLimit(user.id)
  if (!costCheck.allowed) return NextResponse.json({ error: `KI-Budget erschöpft (${costCheck.spent.toFixed(4)} / ${costCheck.limit} €).` }, { status: 429 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const result = await parseBody(req, Schema)
  if (!result.ok) return result.error
  const body = result.data

  const umsatzText = (body.umsatzDaten ?? [])
    .map(d => `${d.monat}: Umsatz ${d.umsatz}€, Kosten ${d.kosten}€, Gewinn ${d.umsatz - d.kosten}€`)
    .join('\n')

  const prompt = `Du bist ein deutscher Steuerberater-Assistent. Analysiere folgende Geschäftszahlen und erstelle eine Steuerprognose für das laufende Jahr.

Umsatz-/Gewinn-Daten:
${umsatzText || 'Keine Daten vorhanden'}

Steuersatz (MwSt): ${body.steuersatz ?? 19}%

Erstelle eine kompakte Steuerprognose mit:
1. Hochgerechneter Jahresgewinn
2. Geschätzte Einkommensteuer / Körperschaftsteuer
3. Geschätzte Gewerbesteuer
4. Umsatzsteuervoranmeldung (aktueller Monat)
5. Empfohlene Steuerrücklagen (Betrag und %-Satz)

Antworte klar strukturiert auf Deutsch, maximal 300 Wörter.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `OpenAI Fehler: ${err}` }, { status: 500 })
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const usage = extractUsage(data)
  logAiUsage({ userId: user.id, route: 'openai/steuerprognose', model: 'gpt-4o-mini', inputTokens: usage.input, outputTokens: usage.output })
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
