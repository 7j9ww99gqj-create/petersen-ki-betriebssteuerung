import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const Schema = z.object({
  text: z.string().min(10).max(20000),
})

// ── SteuerPilot OCR-Belegtext → strukturierte Felder ─────────────────────────
// Nimmt rohen Text (z.B. aus OCR oder manuellem Einfügen) und extrahiert
// Lieferant, Betrag (netto/brutto), Steuerbetrag, Datum, Rechnungsnummer.
// Gibt JSON zurück, das direkt ins Beleg-Formular übernommen werden kann.

export async function POST(req: NextRequest) {
  try {
    const access = await getRouteAccess(req, ['Admin', 'Mitarbeiter', 'Büro'])
    if (access.error) return access.error

    if (access.user) {
      const limited = checkRateLimit(access.user.id, 'ocr')
      if (limited) return limited
    }

    const parsed = await parseBody(req, Schema)
    if (!parsed.ok) return parsed.error
    const { text } = parsed.data

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
    }

    const prompt = `Analysiere den folgenden Rechnungstext und extrahiere die Felder für einen Steuerbeleg.
Antworte NUR als JSON-Objekt mit genau diesen Feldern (unbekannte Werte als null):
{
  "lieferant": string | null,
  "rechnungsnummer": string | null,
  "datum": string | null,           // Format: YYYY-MM-DD wenn erkennbar
  "betrag_netto": number | null,    // Nettobetrag in Euro als Zahl
  "betrag_brutto": number | null,   // Bruttobetrag in Euro als Zahl
  "steuerbetrag": number | null,    // MwSt-Betrag in Euro als Zahl
  "steuersatz": number | null,      // MwSt-Satz (7 oder 19 oder 0)
  "notiz": string | null            // Kurze Zusammenfassung (max. 80 Zeichen)
}

Rechnungstext:
${text.slice(0, 3000)}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'KI-Dienst nicht verfügbar' }, { status: 502 })
    }

    const data = await response.json()
    const replyText = data.content?.[0]?.text ?? ''

    // JSON aus Antwort extrahieren
    const jsonMatch = replyText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Kein strukturiertes Ergebnis', raw: replyText }, { status: 422 })
    }

    const parsedJson = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsedJson)
  } catch (err) {
    console.error('ocr-beleg error:', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
