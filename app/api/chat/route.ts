import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, system, context } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply: 'Demo-Modus: Bitte ANTHROPIC_API_KEY in .env.local eintragen für echte KI-Antworten.',
      })
    }

    const baseSystem = system || 'Du bist der KI-Assistent der Petersen KI Betriebssteuerung. Antworte auf Deutsch, professionell und hilfreich.'
    const fullSystem = context ? `${context}\n\n${baseSystem}` : baseSystem

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: fullSystem,
        messages,
      }),
    })

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'Keine Antwort erhalten.'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI API error:', err)
    return NextResponse.json({ reply: 'Fehler bei der KI-Anfrage. Bitte prüfen Sie Ihre Konfiguration.' }, { status: 500 })
  }
}
