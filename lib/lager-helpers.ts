/**
 * Petersen KI – Pure Lager-Helpers
 *
 * Aus app/dashboard/lager/page.tsx extrahiert, damit:
 *  - die Funktionen testbar sind (siehe tests/lager-helpers.test.ts)
 *  - die Page-Datei einen Schritt kleiner wird
 *  - die Logik wiederverwendbar wird (z.B. für KI-Tagesbericht)
 *
 * Wichtig: keine Closure-Abhängigkeiten — alle Inputs als Parameter.
 */

export type LagerHelperArtikel = {
  id: string
  name: string
  kategorie: string
  bestand: number
  einheit: string
  lagerplatz: string
  status: string
  mindestbestand?: number
}

export type LagerHelperStellplatz = {
  id: string
  code: string
  bereich?: string
  warengruppe?: string
  warenobergruppe?: string
  typ?: string
  aktiv?: boolean
}

export type LagerHelperStellplatzBestand = {
  stellplatz_id: string
}

export type MhdStatus = 'abgelaufen' | 'kritisch' | 'ok' | 'kein'

/**
 * Status eines Mindesthaltbarkeitsdatums.
 * - `kein` → kein Datum angegeben
 * - `abgelaufen` → Datum in der Vergangenheit
 * - `kritisch` → weniger als 30 Tage entfernt
 * - `ok` → 30+ Tage entfernt
 *
 * `now` ist injizierbar für deterministische Tests.
 */
export function mhdStatus(mhd: string | undefined, now: number = Date.now()): MhdStatus {
  if (!mhd) return 'kein'
  const diff = (new Date(mhd).getTime() - now) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'abgelaufen'
  if (diff < 30) return 'kritisch'
  return 'ok'
}

export type StellplatzScore = {
  stellplatz: LagerHelperStellplatz
  score: number
  grund: string[]
}

/**
 * Berechnet den besten Stellplatz für einen Artikel basierend auf:
 *  - Warengruppen-Übereinstimmung (+3)
 *  - Warenobergruppen-Match (+2)
 *  - Lagerplatz-Prefix-Match (+1)
 *  - Freier Stellplatz (+2)
 *  - Kühl-Typ für Betriebsstoffe / Lebensmittel (+2)
 *
 * Liefert den höchsten Score oder bei Gleichstand den ersten freien.
 * `null` wenn der Artikel undefined oder keine aktiven Stellplätze existieren.
 */
export function getBestStellplatz(
  a: LagerHelperArtikel | undefined,
  stellplaetze: LagerHelperStellplatz[],
  stellplatzBestand: LagerHelperStellplatzBestand[],
): StellplatzScore | null {
  if (!a) return null
  const aktive = stellplaetze.filter(sp => sp.aktiv !== false)
  if (aktive.length === 0) return null

  const belegteIds = new Set(stellplatzBestand.map(sb => sb.stellplatz_id))

  const scored = aktive.map(sp => {
    let score = 0
    const grund: string[] = []

    if (sp.warengruppe && sp.warengruppe.toLowerCase() === a.kategorie.toLowerCase()) {
      score += 3; grund.push('gleiche Warengruppe')
    }
    if (sp.warenobergruppe && a.kategorie.toLowerCase().includes(sp.warenobergruppe.toLowerCase())) {
      score += 2; grund.push('passende Warenobergruppe')
    }
    if (a.lagerplatz && sp.code.startsWith(a.lagerplatz.slice(0, 2))) {
      score += 1; grund.push('bekannter Bereich')
    }
    if (!belegteIds.has(sp.id)) {
      score += 2; grund.push('freier Stellplatz')
    }
    const kuehlKat = ['betriebsstoffe', 'kühlware', 'lebensmittel']
    if (kuehlKat.some(k => a.kategorie.toLowerCase().includes(k)) && sp.typ && sp.typ.toLowerCase().includes('kühl')) {
      score += 2; grund.push('passende Temperaturzone')
    }

    return { stellplatz: sp, score, grund }
  })

  const best = scored.sort((a, b) => b.score - a.score)[0]
  return best.score > 0 ? best : { stellplatz: aktive[0], score: 0, grund: ['kein spezifischer Treffer – erster freier Stellplatz'] }
}
