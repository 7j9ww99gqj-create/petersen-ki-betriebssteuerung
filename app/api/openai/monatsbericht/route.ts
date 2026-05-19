import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const Schema = z.object({
  kpi: z.object({
    umsatzMonat: z.number().finite(),
    gewinnMonat: z.number().finite(),
    artikelGesamt: z.number().int().nonnegative(),
    artikelNiedrig: z.number().int().nonnegative(),
    artikelLeer: z.number().int().nonnegative(),
    aktivKunden: z.number().int().nonnegative(),
    offeneAngebote: z.number().int().nonnegative(),
    offeneRechnungen: z.number().int().nonnegative(),
    offeneRechnungenSumme: z.number().finite(),
    lagerwert: z.number().finite(),
  }),
  umsatzVormonat: z.number().finite().optional(),
  monat: z.string().trim().max(40).optional(),
})

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.monatsberichtEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const limited = checkRateLimit(user.id, 'ai')
  if (limited) return limited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const result = await parseBody(req, Schema)
  if (!result.ok) return result.error
  const body = result.data

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
