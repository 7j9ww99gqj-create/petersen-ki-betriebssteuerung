import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerOpenAiToolSettings } from '@/lib/ai-settings'

export async function POST(req: NextRequest) {
  const { isDemo, user, error } = await getRouteAccess(req)
  if (error || isDemo || !user) return NextResponse.json({ disabled: true }, { status: 403 })

  const settings = await getServerOpenAiToolSettings(user.id)
  if (!settings.emailAssistentEnabled) return NextResponse.json({ disabled: true }, { status: 403 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Kein OpenAI API-Key konfiguriert.' }, { status: 500 })

  const body = await req.json() as {
    anfrage: string
    empfaenger?: string
    kontext?: string
    ton?: 'professionell' | 'freundlich' | 'formell'
    firmenname?: string
  }

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
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? '' })
}
