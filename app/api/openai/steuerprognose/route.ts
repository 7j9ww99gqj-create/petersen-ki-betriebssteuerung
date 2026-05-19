import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.steuerprognoseEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const body = await req.json() as {
    umsatzDaten?: Array<{ monat: string; umsatz: number; kosten: number }>
    steuersatz?: number
  }

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
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
