import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { POND_USER_EMAIL, PRICE_COATINGS, normalizePriceCoating, normalizePriceCustomer } from '@/lib/pondruff'
import { runVisionOcr } from '@/lib/pondruff-ocr'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const blocked = await requirePondruffFeature('ocr_wareneingang', access.user.id)
  if (blocked) return blocked

  const limited = checkRateLimit(access.user.id, 'ocr')
  if (limited) return limited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { image?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  const image = body.image
  if (!image || !image.startsWith('data:')) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 })

  const prompt = `Du bist ein OCR-Assistent fuer Wareneingangs-Lieferscheine bei Pondruff.

Lies den Lieferschein aus dem Bild aus und gib NUR gueltiges JSON zurueck. Kein Markdown.

Kunde / Lieferschein:
- Pondruff ist NIE der Kunde — wenn Pondruff als Absender/Empfaenger auftaucht, ignorieren.
- Lieferant (z.B. Spedition) ist nicht wichtig — nur der eigentliche Kunde / Auftraggeber.
- "id" = Lieferschein-Nr / Auftrag des Kunden.

Positionen:
- Erkenne ALLE Positionen auf dem Lieferschein (kann mehrere geben).
- Jede Position einzeln im positions-Array mit: description, article_no, position_no, order_no, cost_center, purchase_order, quantity, shape, diameter, length, width, height, coating.
- Fuer runde Teile shape = "Rund" + diameter + length.
- Fuer eckige Teile shape = "Eckig" + length + width + height.
- Wenn nur EINE Position erkennbar ist, fuelle die Top-Level-Felder (article_no, description, ...) zusaetzlich.
- Erkenne handschriftliche Leistungen wie "Pol35" oder "Ent20".
- Erlaubte Beschichtungen: ${PRICE_COATINGS.join(', ')}.
- Wenn quantity nicht sicher: 1.

WICHTIG — Bestellnummer (purchase_order) hat höchste Priorität:
- Auf dem Dokument steht die Bestell-Nr. oft mit Beschriftung wie:
  "Bestell-Nr.", "Bestellnummer", "Best.-Nr.", "Ihre Bestellung", "Ihre Bestell-Nr.",
  "Bestell-Nummer", "PO", "PO Number", "Order No.".
- Wenn auf dem Bild auch eine "Bestellung" (separates Dokument) sichtbar ist, dort steht
  die Bestell-Nr. oft groß oben oder in einer eingerahmten Box.
- Setze die globale Bestell-Nr. IMMER in Top-Level "purchase_order".
- Bestellnummern bestehen meist aus 4-12 Zeichen (Zahlen + ggf. Buchstaben/Bindestriche). Beispiele:
  "BN-12345", "Bestell 2024-091", "4500123456", "P/89321".
- Verwechsle nicht mit Auftrags-Nr. (Kundenauftrag intern → order_no) oder Lieferschein-Nr (→ id).

WICHTIG zu Zahlen — bitte sehr genau lesen:
- Deutsche Dokumente nutzen Komma als Dezimaltrenner: "4,4" bedeutet 4.4 (vier Komma vier).
- "1.234,56" bedeutet 1234.56.
- Gib alle Zahlenwerte im JSON IMMER als JSON-Number mit Punkt zurueck (z.B. 4.4, NICHT "4,4" und NICHT 4).
- Wenn auf dem Beleg "4,4" steht, MUSS das Feld den Wert 4.4 haben — verliere die Nachkommastelle nicht.

Häufige Lesefehler — VERMEIDE diese:
- Verwechsle NIE die fuehrende Ziffer mit 0. Eine "4" am Anfang ist eine 4, kein Komma.
  Falsch: "4,4" als 0.4 lesen.   Richtig: "4,4" als 4.4 lesen.
- Wenn unsicher zwischen 4,4 und 0,4 (oder ähnlichen): wähle die größere plausible Variante,
  da Bauteilmaße bei Pondruff üblicherweise im Millimeter-Bereich 1-500mm liegen.
- Pruefe nach: ist die Zahl plausibel als Bauteil-Mass in mm?

Zur Verifikation:
- Setze fuer JEDE Position das Feld "raw_dimension_text" auf den GENAUEN Original-Text der
  Mass-Zeile wie er auf dem Beleg steht (z.B. "Ø 4,4 x 50 mm" oder "12 x 8 x 4,4 mm").
  Das hilft uns zu pruefen ob die Zahl korrekt erkannt wurde.

JSON Schema:
{"id":"","customer":"","article_no":"","description":"","quantity":1,"shape":"Eckig oder Rund","diameter":0,"length":0,"width":0,"height":0,"polished":"Ja oder Nein","polishing_price":0,"coated":"Ja oder Nein","coating":"","purchase_order":"","confidence":0,"ocr_note":"","raw_dimension_text":"","positions":[{"description":"","article_no":"","position_no":"","order_no":"","cost_center":"","purchase_order":"","quantity":1,"shape":"Rund oder Eckig","diameter":0,"length":0,"width":0,"height":0,"coating":"","raw_dimension_text":""}]}`

  const result = await runVisionOcr({ apiKey, prompt, images: [image], maxTokens: 2048 })
  if (!result.ok) return result.response

  const parsed = result.data
  parsed.customer = normalizePriceCustomer(String(parsed.customer || ''))
  if (parsed.coating) parsed.coating = normalizePriceCoating(String(parsed.coating))
  if (Array.isArray(parsed.positions)) {
    parsed.positions = parsed.positions.map((p: Record<string, unknown>) => ({
      ...p,
      coating: normalizePriceCoating(String(p.coating || 'TiCN')),
      shape: String(p.shape || '').toLowerCase() === 'rund' ? 'Rund' : 'Eckig',
    }))
  }
  return NextResponse.json(parsed)
}
