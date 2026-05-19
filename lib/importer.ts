/**
 * Petersen KI – Import / Migration Utility
 * CSV-Parser, Validierung, Normalisierung, Duplikat-Erkennung
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ImportDataType =
  | 'artikel' | 'kunden' | 'lieferanten' | 'rechnungen'
  | 'angebote' | 'auftraege' | 'bewegungen' | 'belege' | 'projekte'
  | 'steuer_belege' | 'steuer_buchungen' | 'steuer_ustva' | 'steuer_konten'
  | 'werkstatt_zeitbuchungen' | 'werkstatt_material'

export type ImportSource =
  | 'WISO' | 'Lexware' | 'sevDesk' | 'JTL' | 'Billbee' | 'DATEV CSV' | 'Generisch'

export type ImportWarning = {
  row: number
  field: string
  message: string
  type: 'error' | 'warn' | 'info'
}

export type ImportParseResult = {
  headers: string[]
  rows: Record<string, string>[]
  raw: string[][]
  delimiter: string
  encoding: string
  totalRows: number
  error?: string
}

export type ImportValidationResult = {
  valid: Record<string, string>[]
  invalid: Record<string, string>[]
  warnings: ImportWarning[]
  duplicates: number[]
  summary: {
    total: number
    valid: number
    invalid: number
    warnings: number
    duplicates: number
  }
}

export type TargetField = {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date' | 'email'
}

// ── Target field definitions per data type ────────────────────────────────────

export const TARGET_FIELDS: Record<ImportDataType, TargetField[]> = {
  artikel: [
    { key: 'name',          label: 'Name',           required: true },
    { key: 'artikelnummer', label: 'Artikelnummer' },
    { key: 'beschreibung',  label: 'Beschreibung' },
    { key: 'bestand',       label: 'Bestand',         type: 'number' },
    { key: 'mindestbestand',label: 'Mindestbestand',  type: 'number' },
    { key: 'einkaufspreis', label: 'Einkaufspreis',   type: 'number' },
    { key: 'verkaufspreis', label: 'Verkaufspreis',   type: 'number' },
    { key: 'einheit',       label: 'Einheit' },
    { key: 'lagerort',      label: 'Lagerort' },
  ],
  kunden: [
    { key: 'name',           label: 'Name / Firma',   required: true },
    { key: 'kundennummer',   label: 'Kundennummer' },
    { key: 'ansprechpartner',label: 'Ansprechpartner' },
    { key: 'vorname',        label: 'Vorname' },
    { key: 'nachname',       label: 'Nachname' },
    { key: 'email',          label: 'E-Mail',          type: 'email' },
    { key: 'telefon',        label: 'Telefon' },
    { key: 'mobil',          label: 'Mobil' },
    { key: 'strasse',        label: 'Straße' },
    { key: 'plz',            label: 'PLZ' },
    { key: 'ort',            label: 'Ort' },
    { key: 'land',           label: 'Land' },
    { key: 'website',        label: 'Webseite' },
    { key: 'ust_id',         label: 'USt-IdNr' },
    { key: 'adresse',        label: 'Adresse (kombiniert)' },
    { key: 'notizen',        label: 'Notizen' },
  ],
  lieferanten: [
    { key: 'name',          label: 'Name / Firma',   required: true },
    { key: 'email',         label: 'E-Mail',          type: 'email' },
    { key: 'telefon',       label: 'Telefon' },
    { key: 'ort',           label: 'Ort' },
    { key: 'kategorie',     label: 'Kategorie' },
    { key: 'zahlungsziel',  label: 'Zahlungsziel' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  rechnungen: [
    { key: 'nummer',        label: 'Rechnungsnummer',required: true },
    { key: 'kunde',         label: 'Kunde' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'faellig_am',    label: 'Fällig am',       type: 'date' },
    { key: 'summe',         label: 'Betrag',          type: 'number' },
    { key: 'status',        label: 'Status' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  angebote: [
    { key: 'nummer',        label: 'Angebotsnummer', required: true },
    { key: 'kunde',         label: 'Kunde' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'summe',         label: 'Betrag',          type: 'number' },
    { key: 'status',        label: 'Status' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  auftraege: [
    { key: 'nummer',        label: 'Auftragsnummer', required: true },
    { key: 'kunde',         label: 'Kunde' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'summe',         label: 'Betrag',          type: 'number' },
    { key: 'status',        label: 'Status' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  bewegungen: [
    { key: 'artikel',       label: 'Artikel',        required: true },
    { key: 'typ',           label: 'Typ (ein/aus)' },
    { key: 'menge',         label: 'Menge',           type: 'number' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  belege: [
    { key: 'lieferant',     label: 'Lieferant',      required: true },
    { key: 'betrag',        label: 'Betrag',          required: true, type: 'number' },
    { key: 'datum',         label: 'Datum',           required: true, type: 'date' },
    { key: 'steuerbetrag',  label: 'Steuerbetrag',    type: 'number' },
    { key: 'steuersatz',    label: 'Steuersatz %',    type: 'number' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  projekte: [
    { key: 'name',          label: 'Projektname',    required: true },
    { key: 'beschreibung',  label: 'Beschreibung' },
    { key: 'startdatum',    label: 'Startdatum',      type: 'date' },
    { key: 'enddatum',      label: 'Enddatum',        type: 'date' },
    { key: 'status',        label: 'Status' },
    { key: 'budget',        label: 'Budget',          type: 'number' },
  ],
  steuer_belege: [
    { key: 'lieferant',     label: 'Lieferant',      required: true },
    { key: 'betrag',        label: 'Bruttobetrag',   required: true, type: 'number' },
    { key: 'datum',         label: 'Belegdatum',     required: true, type: 'date' },
    { key: 'steuerbetrag',  label: 'Steuerbetrag',    type: 'number' },
    { key: 'steuersatz',    label: 'Steuersatz %',    type: 'number' },
    { key: 'belegnummer',   label: 'Belegnummer' },
    { key: 'kategorie',     label: 'Kategorie' },
    { key: 'status',        label: 'Status' },
    { key: 'notiz',         label: 'Notiz' },
  ],
  steuer_buchungen: [
    { key: 'datum',         label: 'Buchungsdatum',  required: true, type: 'date' },
    { key: 'buchungstext',  label: 'Buchungstext',   required: true },
    { key: 'betrag',        label: 'Betrag',         required: true, type: 'number' },
    { key: 'soll_konto',    label: 'Soll-Konto' },
    { key: 'haben_konto',   label: 'Haben-Konto' },
    { key: 'steuerkonto',   label: 'Steuerkonto' },
    { key: 'steuersatz',    label: 'Steuersatz %',    type: 'number' },
    { key: 'beleg_id',      label: 'Beleg-ID' },
    { key: 'status',        label: 'Status' },
  ],
  steuer_ustva: [
    { key: 'monat',         label: 'Monat (YYYY-MM)', required: true },
    { key: 'umsatzsteuer',  label: 'Umsatzsteuer',   required: true, type: 'number' },
    { key: 'vorsteuer',     label: 'Vorsteuer',       type: 'number' },
    { key: 'zahllast',      label: 'Zahllast',        type: 'number' },
    { key: 'status',        label: 'Status' },
  ],
  steuer_konten: [
    { key: 'kontonummer',   label: 'Kontonummer',    required: true },
    { key: 'name',          label: 'Kontoname',      required: true },
    { key: 'typ',           label: 'Typ' },
    { key: 'steuersatz',    label: 'Steuersatz %',    type: 'number' },
    { key: 'aktiv',         label: 'Aktiv' },
  ],
  werkstatt_zeitbuchungen: [
    { key: 'mitarbeiter',   label: 'Mitarbeiter',    required: true },
    { key: 'auftragsnr',    label: 'Auftragsnr.',    required: true },
    { key: 'stunden',       label: 'Stunden',        required: true, type: 'number' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'taetigkeit',    label: 'Tätigkeit' },
  ],
  werkstatt_material: [
    { key: 'artikel',       label: 'Artikel',        required: true },
    { key: 'menge',         label: 'Menge',          required: true, type: 'number' },
    { key: 'einheit',       label: 'Einheit' },
    { key: 'auftragsnr',    label: 'Auftragsnr.' },
    { key: 'datum',         label: 'Datum',           type: 'date' },
    { key: 'mitarbeiter',   label: 'Mitarbeiter' },
  ],
}

// ── Auto-Mapping Hints per source system ──────────────────────────────────────

const DATEV_HINTS: Record<string, string> = {
  'Betrag': 'betrag', 'Brutto': 'betrag', 'Bruttobetrag': 'betrag',
  'MwSt': 'steuerbetrag', 'USt': 'steuerbetrag', 'Mehrwertsteuer': 'steuerbetrag',
  'Steuerbetrag': 'steuerbetrag', 'Steuer': 'steuerbetrag',
  'Steuersatz': 'steuersatz', 'MwSt-%': 'steuersatz', 'USt-%': 'steuersatz',
  'Belegdatum': 'datum', 'Datum': 'datum', 'Buchungsdatum': 'datum', 'Rechnungsdatum': 'datum',
  'Lieferant': 'lieferant', 'Kreditor': 'lieferant', 'Debitor': 'kunde',
  // Kunden-Felder (deutsche WISO/DATEV/sevDesk/Lexware-Header)
  'Name': 'name', 'Firma': 'name', 'Firmenname': 'name', 'Kundenname': 'name', 'Kunde': 'name', 'Bezeichnung': 'name',
  'Kundennummer': 'kundennummer', 'Kundennr.': 'kundennummer', 'Kundennr': 'kundennummer', 'Kunden-Nr.': 'kundennummer', 'Kunden-Nr': 'kundennummer', 'Debitorennummer': 'kundennummer', 'Debitor-Nr': 'kundennummer',
  'Ansprechpartner': 'ansprechpartner', 'Kontaktperson': 'ansprechpartner', 'Vorname Nachname': 'ansprechpartner',
  'Straße': 'strasse', 'Strasse': 'strasse', 'Strasse Hausnummer': 'strasse', 'Straße Hausnummer': 'strasse', 'Straße / Hausnummer': 'strasse', 'Adresszeile': 'strasse',
  'PLZ': 'plz', 'Postleitzahl': 'plz', 'Plz': 'plz',
  'Ort': 'ort', 'Stadt': 'ort',
  'Land': 'land',
  'Mobil': 'mobil', 'Mobiltelefon': 'mobil', 'Handy': 'mobil',
  'Webseite': 'website', 'Website': 'website', 'URL': 'website', 'Internet': 'website',
  'USt-IdNr': 'ust_id', 'USt-ID': 'ust_id', 'UStId': 'ust_id', 'USt-IdNr.': 'ust_id', 'Umsatzsteuer-ID': 'ust_id',
  // Restliche
  'Konto': 'soll_konto', 'Sollkonto': 'soll_konto', 'Habenkonto': 'haben_konto',
  'Buchungstext': 'buchungstext', 'Verwendungszweck': 'buchungstext',
  'Belegnummer': 'belegnummer', 'Rechnungsnummer': 'nummer',
  'Netto': 'betrag', 'Artikel': 'name', 'Artikelnummer': 'artikelnummer',
  'Beschreibung': 'beschreibung',
  'Menge': 'bestand', 'Bestand': 'bestand', 'Einheit': 'einheit',
  'EK-Preis': 'einkaufspreis', 'Einkaufspreis': 'einkaufspreis',
  'VK-Preis': 'verkaufspreis', 'Verkaufspreis': 'verkaufspreis',
  'E-Mail': 'email', 'EMail': 'email', 'Email': 'email', 'Mail': 'email',
  'Telefon': 'telefon', 'Tel': 'telefon', 'Tel.': 'telefon', 'Telefonnummer': 'telefon',
  'Adresse': 'adresse', 'Anschrift': 'adresse',
  'Notiz': 'notizen', 'Notizen': 'notizen', 'Bemerkung': 'notizen', 'Bemerkungen': 'notizen',
  // WISO MeinBüro Export — englische Spaltennamen
  'CUSTNO': 'kundennummer', 'CustNo': 'kundennummer',
  'KUNDENNAME': 'name', 'KundeName': 'name', 'CustomerName': 'name', 'CompanyName': 'name', 'Company': 'name',
  'STREET': 'strasse', 'Street': 'strasse', 'Address1': 'strasse',
  'ZIPCODE': 'plz', 'ZipCode': 'plz', 'PostalCode': 'plz', 'Zip': 'plz',
  'CITY': 'ort', 'City': 'ort',
  'COUNTRY': 'land', 'Country': 'land',
  'EMAIL': 'email', 'Email1': 'email',
  'PHONE1': 'telefon', 'PHONE': 'telefon', 'Phone1': 'telefon', 'Phone': 'telefon',
  'MOBILE': 'mobil', 'Mobile': 'mobil', 'Cell': 'mobil',
  'ADDRESS': 'adresse', 'Address': 'adresse',
  'TITLE': 'ansprechpartner', 'Title': 'ansprechpartner',
  'VORNAME': 'vorname', 'FirstName': 'vorname',
  'NACHNAME': 'nachname', 'LastName': 'nachname', 'Surname': 'nachname',
  'WEBSITE': 'website',
  'UST_ID': 'ust_id', 'VATId': 'ust_id', 'VATNumber': 'ust_id',
  'Status': 'status', 'Zustand': 'status',
  'Monat': 'monat', 'Umsatzsteuer': 'umsatzsteuer', 'Vorsteuer': 'vorsteuer', 'Zahllast': 'zahllast',
}

const WISO_HINTS: Record<string, string> = {
  ...DATEV_HINTS,
  'Gesamtbetrag': 'betrag', 'Zahlbetrag': 'betrag',
  'Ust-Satz': 'steuersatz', 'MwSt-Satz': 'steuersatz',
  'Belegnr': 'belegnummer', 'Vorgangsnummer': 'nummer',
}

const LEXWARE_HINTS: Record<string, string> = {
  ...DATEV_HINTS,
  'Kundennummer': 'kundennummer', 'Lieferantennummer': 'artikelnummer',
  'Rechnungsbetrag': 'betrag', 'Zahlungsziel': 'zahlungsziel',
}

export const SOURCE_HINTS: Record<ImportSource, Record<string, string>> = {
  'WISO': WISO_HINTS,
  'DATEV CSV': DATEV_HINTS,
  'Lexware': LEXWARE_HINTS,
  'sevDesk': DATEV_HINTS,
  'JTL': { ...DATEV_HINTS, 'Artikelname': 'name', 'Lagerbestand': 'bestand' },
  'Billbee': { ...DATEV_HINTS, 'Bestellnummer': 'nummer', 'Gesamtpreis': 'betrag' },
  'Generisch': {},
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function detectDelimiter(sample: string): string {
  const counts = { ';': 0, ',': 0, '\t': 0, '|': 0 }
  for (const c of [';', ',', '\t', '|'] as const) {
    counts[c] = (sample.match(new RegExp(`\\${c === '\t' ? 't' : c}`, 'g')) ?? []).length
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0]
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue }
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export async function parseCsvFile(file: File): Promise<ImportParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string
        // Strip BOM
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
        // Normalize line endings
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const lines = text.split('\n').filter(l => l.trim().length > 0)
        if (lines.length < 2) {
          resolve({ headers: [], rows: [], raw: [], delimiter: ';', encoding: 'UTF-8', totalRows: 0, error: 'Datei enthält keine Daten' })
          return
        }
        const delimiter = detectDelimiter(lines[0])
        const headers = parseCsvLine(lines[0], delimiter).map(h => h.replace(/^"|"$/g, '').trim())
        const raw: string[][] = []
        const rows: Record<string, string>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCsvLine(lines[i], delimiter)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').replace(/^"|"$/g, '').trim() })
          raw.push(vals)
          rows.push(row)
        }
        resolve({ headers, rows, raw, delimiter, encoding: 'UTF-8', totalRows: rows.length })
      } catch (err) {
        resolve({ headers: [], rows: [], raw: [], delimiter: ';', encoding: 'UTF-8', totalRows: 0, error: String(err) })
      }
    }
    reader.onerror = () => resolve({ headers: [], rows: [], raw: [], delimiter: ';', encoding: 'UTF-8', totalRows: 0, error: 'Datei konnte nicht gelesen werden' })
    reader.readAsText(file, 'UTF-8')
  })
}

// ── Number / Date Normalization ───────────────────────────────────────────────

export function normalizeNumber(value: string): number | null {
  if (!value || value.trim() === '' || value === '-') return null
  let v = value.trim().replace(/\s/g, '')
  // German format: 1.234,56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.')
  // English format: 1,234.56
  else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(v)) v = v.replace(/,/g, '')
  // Simple comma as decimal: 1234,56
  else v = v.replace(',', '.')
  v = v.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

export function normalizeDate(value: string): string | null {
  if (!value || value.trim() === '') return null
  const v = value.trim()
  // ISO: 2025-04-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  // German: 15.04.2025
  const deMatch = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (deMatch) return `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`
  // German short: 15.04.25
  const deShort = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/)
  if (deShort) return `20${deShort[3]}-${deShort[2].padStart(2, '0')}-${deShort[1].padStart(2, '0')}`
  // US: 04/15/2025
  const usMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`
  // Try native parse as fallback
  const d = new Date(v)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

// ── Duplicate Detection ───────────────────────────────────────────────────────

export function detectDuplicates(rows: Record<string, string>[], keyFields: string[]): ImportWarning[] {
  const seen = new Map<string, number>()
  const warnings: ImportWarning[] = []
  rows.forEach((row, idx) => {
    const key = keyFields.map(f => (row[f] ?? '').toLowerCase().trim()).join('|')
    if (!key.replace(/\|/g, '')) return
    if (seen.has(key)) {
      warnings.push({
        row: idx + 2,
        field: keyFields.join(', '),
        message: `Möglicher Duplikat (identisch mit Zeile ${seen.get(key)! + 2})`,
        type: 'warn',
      })
    } else {
      seen.set(key, idx)
    }
  })
  return warnings
}

// ── Build mapped rows ─────────────────────────────────────────────────────────

export function buildImportRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map(row => {
    const out: Record<string, string> = {}
    for (const [sourceCol, targetField] of Object.entries(mapping)) {
      if (targetField && targetField !== '__skip__') out[targetField] = row[sourceCol] ?? ''
    }
    return out
  })
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateImportRows(
  rows: Record<string, string>[],
  dataType: ImportDataType,
  mapping: Record<string, string>,
): ImportValidationResult {
  const fields = TARGET_FIELDS[dataType]
  const requiredFields = fields.filter(f => f.required).map(f => f.key)
  const numberFields = fields.filter(f => f.type === 'number').map(f => f.key)
  const dateFields = fields.filter(f => f.type === 'date').map(f => f.key)
  const emailFields = fields.filter(f => f.type === 'email').map(f => f.key)

  const mapped = buildImportRows(rows, mapping)
  const valid: Record<string, string>[] = []
  const invalid: Record<string, string>[] = []
  const warnings: ImportWarning[] = []
  const dupKeys = dataType === 'artikel' ? ['name', 'artikelnummer']
    : dataType === 'kunden' ? ['name', 'email']
    : dataType === 'steuer_belege' ? ['datum', 'betrag', 'lieferant']
    : dataType === 'steuer_buchungen' ? ['datum', 'buchungstext', 'betrag']
    : ['name']
  const dupWarnings = detectDuplicates(mapped, dupKeys)
  const dupRows = new Set(dupWarnings.map(w => w.row - 2))

  mapped.forEach((row, idx) => {
    let rowValid = true

    // Required fields
    for (const field of requiredFields) {
      if (!row[field] || row[field].trim() === '') {
        warnings.push({ row: idx + 2, field, message: `Pflichtfeld fehlt: ${field}`, type: 'error' })
        rowValid = false
      }
    }

    // Number fields
    for (const field of numberFields) {
      if (row[field] && row[field].trim() !== '') {
        const n = normalizeNumber(row[field])
        if (n === null) {
          warnings.push({ row: idx + 2, field, message: `Ungültige Zahl: "${row[field]}"`, type: 'warn' })
        }
      }
    }

    // Date fields
    for (const field of dateFields) {
      if (row[field] && row[field].trim() !== '') {
        const d = normalizeDate(row[field])
        if (!d) {
          warnings.push({ row: idx + 2, field, message: `Ungültiges Datum: "${row[field]}"`, type: 'warn' })
          rowValid = false
        }
      }
    }

    // Email fields
    for (const field of emailFields) {
      if (row[field] && row[field].trim() !== '') {
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(row[field])) {
          warnings.push({ row: idx + 2, field, message: `Ungültige E-Mail: "${row[field]}"`, type: 'warn' })
        }
      }
    }

    if (rowValid) valid.push(row)
    else invalid.push(row)
  })

  dupWarnings.forEach(w => warnings.push(w))

  return {
    valid, invalid, warnings,
    duplicates: Array.from(dupRows),
    summary: { total: rows.length, valid: valid.length, invalid: invalid.length, warnings: warnings.length, duplicates: dupRows.size },
  }
}

// ── Auto-Map columns from source hints ───────────────────────────────────────

function normalizeHeader(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

export function autoMapColumns(headers: string[], source: ImportSource, dataType: ImportDataType): Record<string, string> {
  const hints = SOURCE_HINTS[source] ?? {}
  const fields = TARGET_FIELDS[dataType]
  const targetKeys = new Set(fields.map(f => f.key))

  // Normalisierte Lookup-Tabelle: Hint-Label + Target-Label + Target-Key alle case-insensitive ohne Sonderzeichen
  const normMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(hints)) {
    if (targetKeys.has(v)) normMap[normalizeHeader(k)] = v
  }
  for (const f of fields) {
    normMap[normalizeHeader(f.key)] = f.key
    if (f.label) normMap[normalizeHeader(f.label)] = f.key
  }
  // Generische Hints zusätzlich (damit ALLE Quellen die deutschen Standardheader treffen)
  for (const [k, v] of Object.entries(DATEV_HINTS)) {
    const norm = normalizeHeader(k)
    if (targetKeys.has(v) && !normMap[norm]) normMap[norm] = v
  }

  const mapping: Record<string, string> = {}
  for (const h of headers) {
    const norm = normalizeHeader(h)
    if (!norm) { mapping[h] = '__skip__'; continue }
    // 1) Direkt-Match
    if (normMap[norm]) { mapping[h] = normMap[norm]; continue }
    // 2) Fuzzy: Header enthält bekannten Begriff, oder bekannter Begriff enthält Header
    let fuzzy: string | null = null
    let fuzzyScore = 0
    for (const [k, v] of Object.entries(normMap)) {
      if (k.length < 3) continue
      if (norm.includes(k) || k.includes(norm)) {
        const score = Math.min(k.length, norm.length)
        if (score > fuzzyScore) { fuzzy = v; fuzzyScore = score }
      }
    }
    mapping[h] = fuzzy ?? '__skip__'
  }
  return mapping
}

// ── Demo mock data ─────────────────────────────────────────────────────────────

export const DEMO_CSV_ARTIKEL = `Artikelnummer;Name;Beschreibung;Bestand;Mindestbestand;Einkaufspreis;Einheit
ART-001;Hydrauliköl HLP46;Hochleistungshydrauliköl 20L;45;10;28,50;Liter
ART-002;Stahlrohr 40x40;Vierkantstahlrohr 6m;12;5;18,90;Stück
ART-003;Dichtungsset universal;Für alle gängigen Pumpen;230;50;3,20;Set
ART-004;Schmierfett NLGI2;Mehrzweckschmierfett 5kg;8;15;12,80;Kg
ART-005;Schrauben M8x20;Innenechskant verzinkt;890;200;0,12;Stück`

export const DEMO_CSV_KUNDEN = `Kundennummer;Firma;E-Mail;Telefon;Adresse
KD-001;Müller GmbH & Co. KG;info@mueller-gmbh.de;040-123456;Hauptstr. 12, 20095 Hamburg
KD-002;Schmidt & Partner;s.partner@example.com;030-987654;Berliner Allee 5, 10115 Berlin
KD-003;Weber Technik;info@weber-technik.de;089-456789;Industriestr. 8, 80331 München
KD-004;Hansen Bau AG;h.bau@example.com;;Neue Str. 3, 22041 Hamburg`

export const DEMO_CSV_STEUER = `Belegdatum;Lieferant;Bruttobetrag;Steuerbetrag;Steuersatz;Belegnummer;Kategorie
15.04.2025;Büromaterial GmbH;238,00;38,00;19;BLG-2025-001;Bürobedarf
08.04.2025;Tanke Nord AG;480,00;76,64;19;BLG-2025-002;Fahrtkosten
18.04.2025;Lebensmittelgroßhandel;107,00;7,00;7;BLG-2025-003;Kantinenbedarf
01.04.2025;Versicherung GmbH;850,00;0,00;0;BLG-2025-004;Versicherung`

export const DEMO_CSV_BUCHUNGEN = `Buchungsdatum;Buchungstext;Betrag;Sollkonto;Habenkonto;Steuersatz
01.04.2025;Miete April;2500,00;4210;1800;0
05.04.2025;Büromaterial;238,00;6815;1576;19
08.04.2025;Diesel Firmenfahrzeug;480,00;6540;1576;19
15.04.2025;Lohn April;8500,00;6000;1790;0`
