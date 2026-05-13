/**
 * Zentrale ID-Generierung für alle Piloten.
 *
 * Format: <PREFIX>-<TIMESTAMP_BASE36>-<RANDOM4>
 * Beispiel: K-M6HJ4X2A-BC1D
 *
 * Präfix-Konvention:
 *   K    → buero_kunden
 *   ANG  → buero_angebote
 *   A    → buero_auftraege
 *   RE   → buero_rechnungen
 *   ER   → buero_eingangsrechnungen
 *   LF   → einkauf_lieferanten
 *   EB   → einkauf_bestellungen
 *   DOK  → buero_dokumente
 *   AK   → werkstatt_karten
 *   MA   → werkstatt_mitarbeiter
 *   WB   → werkstatt_bereiche
 *   WT   → werkstatt_wartungen
 *   ST   → werkstatt_stoerungen
 *   BLG  → steuer_belege
 *   PRJ  → planung_projekte
 *   AU   → planung_aufgaben
 *   T    → planung_termine
 *   R    → planung_ressourcen
 */
export function genId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rnd}`
}
