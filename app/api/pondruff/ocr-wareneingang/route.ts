import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { requirePondruffFeature } from '@/lib/pondruff-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { POND_USER_EMAIL, normalizePriceCustomer, WE_COATINGS } from '@/lib/pondruff'
import { runVisionOcr } from '@/lib/pondruff-ocr'

function normalizeWeCoating(val: unknown): string {
  if (!val) return 'Keine'
  const v = String(val).trim()
  const match = WE_COATINGS.find(c => c.toLowerCase() === v.toLowerCase())
  if (match) return match
  const map: Record<string, string> = {
    'tialn': 'TiAlN', 'tialn-multi': 'AlTiN-Multi', 'altin': 'AlTiN-Multi',
    'altin-multi': 'AlTiN-Multi', 'alcrn': 'AlCrN', 'crn': 'CrN',
    'crn-rb': 'CrN-RB', 'crn-dlc': 'CrN-DLC', 'ticn': 'TiCN', 'tin': 'TiN',
    'lamcoat': 'LamCoat', 'meta-s': 'Meta-S', 'meta-cax': 'Meta-CAX',
    'duplex meta-va': 'Duplex Meta-VA', 'duplex': 'Duplex Meta-VA',
    'keine': 'Keine', 'none': 'Keine', '': 'Keine',
  }
  return map[v.toLowerCase()] ?? 'Keine'
}

const Schema = z.object({
  image: z.string().max(10_000_000),
})

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

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const { image } = parsedBody.data
  if (!image.startsWith('data:')) return NextResponse.json({ error: 'Kein Bild' }, { status: 400 })

  const coatingList = WE_COATINGS.join(', ')

  const prompt = `Du bist ein OCR-Assistent für Wareneingangs-Lieferscheine bei Pondruff Polierservice.

Lies den Lieferschein aus und gib NUR gültiges JSON zurück. Kein Markdown, keine Erklärungen.

REGELN:
- Pondruff ist NIEMALS der Kunde — ignorieren wenn als Absender/Empfänger sichtbar.
- Erkenne den eigentlichen Auftraggeber/Kunden (Firma die die Teile schickt).
- "bestellnummer" = die wichtigste Referenznummer auf dem Dokument: Bestell-Nr., Auftragsnummer, Lieferschein-Nr., PO-Nummer, Your Order No. etc. — wähle die aussagekräftigste.
- Erkenne ALLE Positionen auf dem Lieferschein.
- Deutsche Zahlen: Komma = Dezimaltrenner (4,4 → 4.4), Punkt = Tausender (1.234 → 1234). Gib Zahlen IMMER mit Punkt zurück.
- Bauteilmaße liegen typischerweise zwischen 1–500 mm.

PRO POSITION erkenne:
- position_nr: Positionsnummer (1, 2, 3...)
- menge: Stückzahl (Zahl)
- artikelbezeichnung: Artikelname (Stempel, Matrize, Kern etc.)
- form: "Rund" (wenn Ø/Durchmesser angegeben) ODER "Eckig" (Länge×Breite×Höhe)
- Für "Rund": durchmesser (mm), durchmesser_laenge (mm = die Länge bei Rundteilen)
- Für "Eckig": laenge (mm), breite (mm), hoehe (mm)
- raw_dimension_text: Original-Text der Maß-Zeile exakt wie auf dem Beleg (z.B. "Ø 4,4 x 50 mm")
- weitere_infos: Array von {key, value} für alle sonstigen Angaben (Kostenstelle, Werkstoff, Zeichnungsnr., etc.)
- polieren: "Ja" wenn Polieren erkannt (pol, Pol, HL, Hochglanz, polier...), sonst "Nein"
- polieren_wo: wenn polieren="Ja" und eine Stelle angegeben ist, diese angeben, sonst ""
- entschichtung: "Ja" wenn Entschichtung erkannt (ent, Ent, entschicht...), sonst "Nein"
- microstrahlen: "Ja" wenn Microstrahlen erkannt (ms, Micro, microstr...), sonst "Nein"
- laeppstrahlen: "Ja" wenn Läppstrahlen erkannt (läpp, lapp, laep...), sonst "Nein"
- polierstrahlen: "Ja" wenn Polierstrahlen erkannt (pstr, polierstr...), sonst "Nein"
- beschichtung: EXAKT eine dieser Optionen: ${coatingList} — wenn unklar oder nicht erkannt: "Keine"

JSON Schema (gib exakt dieses Format zurück):
{
  "kunde": "",
  "bestellnummer": "",
  "positionen": [
    {
      "position_nr": 1,
      "menge": 1,
      "artikelbezeichnung": "",
      "form": "Eckig",
      "laenge": 0,
      "breite": 0,
      "hoehe": 0,
      "durchmesser": 0,
      "durchmesser_laenge": 0,
      "raw_dimension_text": "",
      "weitere_infos": [{"key": "", "value": ""}],
      "polieren": "Nein",
      "polieren_wo": "",
      "entschichtung": "Nein",
      "microstrahlen": "Nein",
      "laeppstrahlen": "Nein",
      "polierstrahlen": "Nein",
      "beschichtung": "Keine"
    }
  ]
}`

  const result = await runVisionOcr({ apiKey, prompt, images: [image], maxTokens: 3000 })
  if (!result.ok) return result.response

  const parsed = result.data
  parsed.kunde = normalizePriceCustomer(String(parsed.kunde || ''))
  if (Array.isArray(parsed.positionen)) {
    parsed.positionen = parsed.positionen.map((p: Record<string, unknown>, idx: number) => ({
      ...p,
      position_nr: Number(p.position_nr || idx + 1),
      form: String(p.form || '').toLowerCase() === 'rund' ? 'Rund' : 'Eckig',
      polieren: p.polieren === 'Ja' ? 'Ja' : 'Nein',
      entschichtung: p.entschichtung === 'Ja' ? 'Ja' : 'Nein',
      microstrahlen: p.microstrahlen === 'Ja' ? 'Ja' : 'Nein',
      laeppstrahlen: p.laeppstrahlen === 'Ja' ? 'Ja' : 'Nein',
      polierstrahlen: p.polierstrahlen === 'Ja' ? 'Ja' : 'Nein',
      beschichtung: normalizeWeCoating(p.beschichtung),
      weitere_infos: Array.isArray(p.weitere_infos)
        ? (p.weitere_infos as unknown[]).filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
        : [],
    }))
  }

  return NextResponse.json(parsed)
}
