import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { POND_USER_EMAIL, PRICE_COATINGS, normalizePriceCoating, normalizePriceCustomer } from '@/lib/pondruff'
import { runVisionOcr } from '@/lib/pondruff-ocr'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const blocked = await requirePondruffFeature('ocr_preisrechner', access.user.id)
  if (blocked) return blocked

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  let body: { images?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 })
  }
  const images = (body.images || []).filter(s => typeof s === 'string' && s.startsWith('data:'))
  if (!images.length) return NextResponse.json({ error: 'Keine Bilder' }, { status: 400 })

  const prompt = `Du liest einen Lieferschein oder ein Produktionsdokument fuer einen Preisrechner aus.

Gib NUR gueltiges JSON zurueck. Kein Markdown, keine Erklaerung.

Ziel:
- Erkenne Kundennamen und Lieferscheinnummer, falls vorhanden.
- Wir sind die Firma Pondruff und koennen niemals der Kunde sein.
- Wenn irgendwo Pondruff als Firmenname auftaucht, ignoriere Pondruff als Kunde.
- Erkenne ALLE Positionen auf allen Bildern.
- Jede Position soll fuer den Preisrechner vorbereitet werden.
- Erkenne je Position Artikelnummer, Positionsnummer, Auftragsnummer, Kostenstelle und Bestellnummer, falls vorhanden.
- Falls eine Bestellnummer nur global auf dem Dokument steht, gib sie oben als purchase_order zurueck.
- Erkenne handschriftliche Leistungen wie "Pol35" oder "Ent20".

Regeln:
- Fuer runde Teile nutze shape = "Rund" und fuelle diameter + length.
- Fuer eckige Teile nutze shape = "Eckig" und fuelle length + width + height.
- Wenn Mengen nicht sicher sind, setze quantity auf 1.
- Erlaubte Beschichtungen: ${PRICE_COATINGS.join(', ')}.

WICHTIG zu Zahlen:
- Deutsche Dokumente nutzen Komma als Dezimaltrenner: "4,4" bedeutet 4.4 (vier Komma vier).
- "1.234,56" bedeutet 1234.56.
- Gib alle Zahlenwerte im JSON IMMER als JSON-Number mit Punkt zurueck (z.B. 4.4, NICHT "4,4" und NICHT 4).
- Wenn auf dem Beleg "4,4" steht, MUSS das Feld den Wert 4.4 haben — verliere die Nachkommastelle nicht.
- Wenn ein Mass mit Einheit "mm" oder "Ø" markiert ist, uebernimm exakt den Zahlenwert inkl. Kommastellen.

JSON Schema:
{"delivery_id":"","customer":"","project":"","purchase_order":"","confidence":0,"ocr_note":"","detected_position_count":0,"detected_coating_count":0,"detected_polishing_count":0,"detected_polishing_price_count":0,"detected_stripping_count":0,"detected_stripping_price_count":0,"validation_notes":[],"positions":[{"description":"","article_no":"","position_no":"","order_no":"","cost_center":"","purchase_order":"","quantity":1,"shape":"Rund oder Eckig","diameter":0,"length":0,"width":0,"height":0,"coating":"","discount":0,"note":""}]}`

  const result = await runVisionOcr({ apiKey, prompt, images, maxTokens: 4096 })
  if (!result.ok) return result.response

  const parsed = result.data
  parsed.customer = normalizePriceCustomer(String(parsed.customer || ''))
  if (Array.isArray(parsed.positions)) {
    parsed.positions = parsed.positions.map((p: Record<string, unknown>) => ({
      ...p,
      coating: normalizePriceCoating(String(p.coating || 'TiCN')),
      shape: String(p.shape || '').toLowerCase() === 'rund' ? 'Rund' : 'Eckig',
    }))
  }
  return NextResponse.json(parsed)
}
