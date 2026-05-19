import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.monatsberichtEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const body = await req.json() as {
    kpi: {
      umsatzMonat: number
      gewinnMonat: number
      artikelGesamt: number
      artikelNiedrig: number
      artikelLeer: number
      aktivKunden: number
      offeneAngebote: number
      offeneRechnungen: number
      offeneRechnungenSumme: number
      lagerwert: number
    }
    umsatzVormonat?: number
    monat?: string
  }

  const prompt = `Du bist ein Unternehmensberater-Assistent für ein deutsches KMU. Erstelle einen professionellen Monatsbericht.

Kennzahlen für ${body.monat ?? 'den aktuellen Monat'}:
- Umsatz: ${body.kpi.umsatzMonat.toFixed(2)} €${body.umsatzVormonat ? ` (Vormonat: ${body.umsatzVormonat.toFixed(2)} €)` : ''}
- Gewinn: ${body.kpi.gewinnMonat.toFixed(2)} €
- Artikel im Lager: ${body.kpi.artikelGesamt} (davon ${body.kpi.artikelNiedrig} niedrig, ${body.kpi.artikelLeer} leer)
- Lagerwert: ${body.kpi.lagerwert.toFixed(2)} €
- Aktive Kunden: ${body.kpi.aktivKunden}
- Offene Angebote: ${body.kpi.offeneAngebote}
- Offene Rechnungen: ${body.kpi.offeneRechnungen} (Wert: ${body.kpi.offeneRechnungenSumme.toFixed(2)} €)

Erstelle einen strukturierten Monatsbericht mit:
1. Executive Summary (2-3 Sätze)
2. Wichtigste Highlights (3 Punkte)
3. Handlungsbedarf (2-3 konkrete Empfehlungen)
4. Ausblick nächster Monat

Maximal 400 Wörter, professionell, auf Deutsch.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
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
