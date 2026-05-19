import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.mahnungsgeneratorEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const body = await req.json() as {
    rechnung: { nummer?: string; kunde: string; betrag: string; faellig: string; mahnung_count?: number }
    ton?: 'freundlich' | 'bestimmt' | 'streng'
    firmenname?: string
  }

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
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
