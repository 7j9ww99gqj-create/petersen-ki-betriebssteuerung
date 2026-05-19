import { NextResponse } from 'next/server'

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export type OcrVisionOptions = {
  apiKey: string
  prompt: string
  images: string[]
  maxTokens?: number
  model?: string
}

export type OcrVisionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse }

export async function runVisionOcr(opts: OcrVisionOptions): Promise<OcrVisionResult> {
  const content: Part[] = [{ type: 'text', text: opts.prompt }]
  if (opts.images.length === 1) {
    content.push({ type: 'image_url', image_url: { url: opts.images[0] } })
  } else {
    opts.images.forEach((url, i) => {
      content.push({ type: 'text', text: `Dokumentbild ${i + 1}:` })
      content.push({ type: 'image_url', image_url: { url } })
    })
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model ?? 'gpt-4o',
        messages: [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_tokens: opts.maxTokens ?? 1024,
      }),
    })
    if (!r.ok) {
      const err = await r.text()
      // Versuche, ein klares OpenAI error.message rauszufiltern
      let parsedMsg = ''
      try {
        const j = JSON.parse(err) as { error?: { message?: string; type?: string } }
        parsedMsg = j?.error?.message ? `${j.error.type || 'error'}: ${j.error.message}` : ''
      } catch { /* ignore */ }
      const detail = `HTTP ${r.status} — ${parsedMsg || err.slice(0, 500)}`
      return { ok: false, response: NextResponse.json({ error: 'OpenAI-Fehler', detail, status: r.status }, { status: 502 }) }
    }
    const data = await r.json()
    const text = data.choices?.[0]?.message?.content || '{}'
    return { ok: true, data: JSON.parse(text) as Record<string, unknown> }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, response: NextResponse.json({ error: 'OCR fehlgeschlagen', detail: msg }, { status: 500 }) }
  }
}
