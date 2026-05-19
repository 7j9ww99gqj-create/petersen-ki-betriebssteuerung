import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { POND_USER_EMAIL } from '@/lib/pondruff'
import { runVisionOcr } from '@/lib/pondruff-ocr'

export const maxDuration = 60

const COATINGS = ['Meta-S','CrN','CrN-RB','Duplex Meta cax','AlCrN','TiN','TiaLN','TiCN','Keine']

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const blocked = await requirePondruffFeature('ocr_wareneingang', access.user.id)
  if (blocked) return blocked

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { image?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  const image = body.image
  if (!image || !image.startsWith('data:')) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 })

  const prompt = `Du bist ein OCR-Assistent fuer Wareneingangs-Lieferscheine.

Lies den Lieferschein aus dem Bild aus und gib NUR gueltiges JSON zurueck.

Wichtig:
- Lieferant ist NICHT wichtig und soll ignoriert werden.
- Erkenne Kunde, Artikelnummer, Artikelbezeichnung, Menge, Masse und Beschichtung.
- Wenn die Form rund ist, setze shape = "Rund" und nutze diameter + length.
- Wenn keine Rundform erkennbar ist, setze shape = "Eckig" und nutze length + width + height.
- Wenn ein Wert nicht erkennbar ist, nutze 0 oder leeren String.
- Beschichtung muss eine dieser Optionen sein: ${COATINGS.join(', ')}.

JSON Schema:
{"id":"","customer":"","article_no":"","description":"","quantity":1,"shape":"Eckig oder Rund","diameter":0,"length":0,"width":0,"height":0,"polished":"Ja oder Nein","polishing_price":0,"coated":"Ja oder Nein","coating":"","confidence":0,"ocr_note":""}`

  const result = await runVisionOcr({ apiKey, prompt, images: [image], maxTokens: 1024 })
  if (!result.ok) return result.response
  return NextResponse.json(result.data)
}
