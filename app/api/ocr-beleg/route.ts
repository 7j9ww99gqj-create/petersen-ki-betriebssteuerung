import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-haiku-4-5-20251001'

const EXTRACT_PROMPT = `Analysiere diesen Beleg/diese Rechnung und extrahiere die Felder.
Antworte NUR als JSON-Objekt mit genau diesen Feldern (unbekannte Werte als null):
{
  "lieferant": string | null,
  "rechnungsnummer": string | null,
  "datum": string | null,
  "betrag_netto": number | null,
  "betrag_brutto": number | null,
  "steuerbetrag": number | null,
  "steuersatz": number | null,
  "notiz": string | null
}
Datum-Format: YYYY-MM-DD. Beträge als Dezimalzahl in Euro. steuersatz: 7, 19 oder 0.`

function getAdminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('Supabase env-vars fehlen')
  return createClient(url, key)
}

async function archiveOriginal(userId: string, fileName: string, data: Uint8Array, contentType: string): Promise<string | null> {
  try {
    const sb = getAdminSupabase()
    const ts = Date.now()
    const safeFile = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${userId}/${ts}_${safeFile}`
    const { error } = await sb.storage.from('ocr-originale').upload(path, data, { upsert: false, contentType })
    if (error) return null
    return path
  } catch {
    return null
  }
}

async function callAnthropic(messages: object[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

function parseExtracted(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Kein JSON in Antwort')
  return JSON.parse(match[0]) as Record<string, unknown>
}

// POST: multipart/form-data { file } ODER application/json { text }
export async function POST(req: NextRequest) {
  try {
    const access = await getRouteAccess(req, ['Admin', 'Mitarbeiter', 'Büro'])
    if (access.error) return access.error
    if (!access.user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const limited = checkRateLimit(access.user.id, 'ocr')
    if (limited) return limited

    const userId = access.user.id
    const ct = req.headers.get('content-type') ?? ''

    let replyText: string
    let storagePath: string | null = null

    if (ct.includes('multipart/form-data')) {
      // ── Bild / PDF via Vision ──────────────────────────────────────────────
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const uint8 = new Uint8Array(bytes)
      const b64 = Buffer.from(uint8).toString('base64')
      const mime = file.type || 'application/octet-stream'

      storagePath = await archiveOriginal(userId, file.name, uint8, mime)

      const isImage = mime.startsWith('image/')
      if (!isImage) {
        return NextResponse.json({ error: 'Nur Bilddateien (JPEG/PNG/WEBP) werden als Upload unterstützt. Für PDFs bitte Text einfügen.' }, { status: 400 })
      }

      replyText = await callAnthropic([{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: b64 } },
          { type: 'text', text: EXTRACT_PROMPT },
        ],
      }])
    } else {
      // ── Roher Text (bisherige API, rückwärtskompatibel) ────────────────────
      const body = await req.json() as { text?: string }
      const text = (body.text ?? '').trim()
      if (!text || text.length < 10) {
        return NextResponse.json({ error: 'text zu kurz (min. 10 Zeichen)' }, { status: 400 })
      }

      const textBytes = new TextEncoder().encode(text)
      storagePath = await archiveOriginal(userId, `ocr_text_${Date.now()}.txt`, textBytes, 'text/plain')

      replyText = await callAnthropic([{
        role: 'user',
        content: `${EXTRACT_PROMPT}\n\nBelegtext:\n${text.slice(0, 4000)}`,
      }])
    }

    const extracted = parseExtracted(replyText)
    return NextResponse.json({ ...extracted, _storage_path: storagePath })
  } catch (err) {
    console.error('ocr-beleg error:', err)
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
