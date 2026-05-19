import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

// ── KI-Angebotstext generieren ────────────────────────────────────────────────

const Schema = z.object({
  kunde: z.string().trim().max(200).optional(),
  titel: z.string().trim().max(300).optional(),
  betrag: z.string().trim().max(60).optional(),
  notiz: z.string().trim().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const access = await getRouteAccess(req, ['Admin', 'Mitarbeiter', 'Büro'])
    if (access.error) return access.error

    if (access.user) {
      const limited = checkRateLimit(access.user.id, 'ai')
      if (limited) return limited
    }

    const parsed = await parseBody(req, Schema)
    if (!parsed.ok) return parsed.error
    const { kunde, titel, betrag, notiz } = parsed.data

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' }, { status: 500 })
    }

    const prompt = `Du bist ein professioneller Texter für Handwerks- und Industriebetriebe. Erstelle einen professionellen, sachlichen Angebotstext auf Deutsch.

Kundendaten:
- Kunde: ${kunde || 'nicht angegeben'}
- Leistungstitel: ${titel || 'nicht angegeben'}
- Angebotsbetrag: ${betrag || 'nicht angegeben'}
${notiz ? `- Hinweise: ${notiz}` : ''}

Erstelle einen kurzen, professionellen Angebotstext (3-5 Sätze) der:
1. Die Leistung klar beschreibt
2. Den Kundennutzen betont
3. Professionell und vertrauenswürdig klingt
4. Keine Füllwörter oder übertriebene Superlative enthält

Antworte NUR mit dem Angebotstext, ohne Überschriften oder Einleitung.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'KI-Dienst nicht verfügbar' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    return NextResponse.json({ text })
  } catch (err) {
    console.error('generate-angebot error:', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
