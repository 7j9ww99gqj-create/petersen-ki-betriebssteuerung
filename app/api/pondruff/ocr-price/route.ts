import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { POND_USER_EMAIL, PRICE_COATINGS, normalizePriceCoating, normalizePriceCustomer } from '@/lib/pondruff'
import { runVisionOcr } from '@/lib/pondruff-ocr'

const Schema = z.object({
  images: z.array(z.string().max(10_000_000)).max(20).optional(),
})

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const blocked = await requirePondruffFeature('ocr_preisrechner', access.user.id)
  if (blocked) return blocked

  const limited = checkRateLimit(access.user.id, 'ocr')
  if (limited) return limited

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data
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
- Erkenne handschriftliche Leistungen wie "Pol35" oder "Ent20".

WICHTIG — Bestellnummer (purchase_order) hat höchste Priorität:
- Mehrere Bilder koennen GEMISCHT sein: Lieferschein UND separates Bestelldokument ("Bestellung", "Order", "Purchase Order").
- Auf Bestellungen steht die Bestell-Nr. oft groß oben oder in einer Box mit Beschriftung wie:
  "Bestell-Nr.", "Bestellnummer", "Best.-Nr.", "Bestell-Nummer", "Auftrag von Ihnen",
  "Ihre Bestellung", "Ihre Bestell-Nr.", "PO", "PO Number", "Order No."
- WENN du irgendwo auf einem der Bilder eine Bestellnummer findest (egal in welcher Schreibweise),
  setze sie OBEN als globales Feld "purchase_order".
- Wenn die Bestellnummer pro Position unterschiedlich ist, setze sie zusaetzlich pro Position.
- Bestellnummern bestehen meist aus 4-12 Zeichen (Zahlen + ggf. Buchstaben/Bindestriche). Beispiele:
  "BN-12345", "Bestell 2024-091", "4500123456", "P/89321".
- Verwechsle nicht mit der Auftrags-Nr. (interne Auftragsnummer des Kunden) — die kommt ins Feld "order_no".

Regeln:
- Fuer runde Teile nutze shape = "Rund" und fuelle diameter + length.
- Fuer eckige Teile nutze shape = "Eckig" und fuelle length + width + height.
- Wenn Mengen nicht sicher sind, setze quantity auf 1.
- Erlaubte Beschichtungen: ${PRICE_COATINGS.join(', ')}.

WICHTIG zu Zahlen — bitte sehr genau lesen:
- Deutsche Dokumente nutzen Komma als Dezimaltrenner: "4,4" bedeutet 4.4 (vier Komma vier).
- "1.234,56" bedeutet 1234.56.
- Gib alle Zahlenwerte im JSON IMMER als JSON-Number mit Punkt zurueck (z.B. 4.4, NICHT "4,4" und NICHT 4).
- Wenn auf dem Beleg "4,4" steht, MUSS das Feld den Wert 4.4 haben — verliere die Nachkommastelle nicht.
- Wenn ein Mass mit Einheit "mm" oder "Ø" markiert ist, uebernimm exakt den Zahlenwert inkl. Kommastellen.

Häufige Lesefehler — VERMEIDE diese:
- Verwechsle NIE die fuehrende Ziffer mit 0. Eine "4" am Anfang ist eine 4, kein Komma.
  Falsch: "4,4" als 0.4 lesen.   Richtig: "4,4" als 4.4 lesen.
- Bauteilmaße bei Pondruff liegen üblicherweise im Bereich 1-500mm — bei unsicherer
  Lesung lieber die plausiblere groessere Variante waehlen.

Zur Verifikation:
- Setze fuer JEDE Position das Feld "raw_dimension_text" auf den GENAUEN Original-Text der
  Mass-Zeile wie er auf dem Beleg steht (z.B. "Ø 4,4 x 50 mm" oder "12 x 8 x 4,4 mm").

JSON Schema:
{"delivery_id":"","customer":"","project":"","purchase_order":"","confidence":0,"ocr_note":"","detected_position_count":0,"detected_coating_count":0,"detected_polishing_count":0,"detected_polishing_price_count":0,"detected_stripping_count":0,"detected_stripping_price_count":0,"validation_notes":[],"positions":[{"description":"","article_no":"","position_no":"","order_no":"","cost_center":"","purchase_order":"","quantity":1,"shape":"Rund oder Eckig","diameter":0,"length":0,"width":0,"height":0,"coating":"","discount":0,"note":"","raw_dimension_text":""}]}`

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
