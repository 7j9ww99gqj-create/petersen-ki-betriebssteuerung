// Pondruff-Modul: isoliert, nur sichtbar fuer info@pondruffpolierservice.de.
// Port der Preislogik aus dem Streamlit-Tool (app.py).

export const POND_USER_EMAIL = 'info@pondruffpolierservice.de'
export const POND_USER_ID = '7eb541ca-ca2e-4890-9c20-51ee20a00b43'

export function isPondruffUser(email: string | null | undefined): boolean {
  return (email || '').toLowerCase() === POND_USER_EMAIL
}

export type PondruffFeatureKey = 'ocr_wareneingang' | 'ocr_preisrechner' | 'ki_bauteilsuche' | 'wiso_sync'

export const POND_FEATURE_KEYS: PondruffFeatureKey[] = [
  'ocr_wareneingang', 'ocr_preisrechner', 'ki_bauteilsuche', 'wiso_sync',
]

export const POND_FEATURE_LABELS: Record<PondruffFeatureKey, string> = {
  ocr_wareneingang: 'Wareneingang Lieferschein-OCR',
  ocr_preisrechner: 'Preisrechner Positionen-OCR',
  ki_bauteilsuche: 'KI-Bauteilsuche (Foto-Vergleich)',
  wiso_sync: 'WISO MeinBüro Direkt-Export',
}

export type PondruffFeatureFlags = Record<PondruffFeatureKey, boolean>

export const POND_DEFAULT_FEATURE_FLAGS: PondruffFeatureFlags = {
  ocr_wareneingang: true,
  ocr_preisrechner: true,
  ki_bauteilsuche: true,
  wiso_sync: true,
}

import priceConfig from './pondruff-price-config.json'

export const PRICE_BASE_COATING_MULTIPLIER = priceConfig.base_coating_multiplier
export const PRICE_EXCEL_PI = priceConfig.excel_pi

export const PRICE_COATING_FACTORS: Record<string, number> = priceConfig.coating_factors
export const PRICE_COATINGS = Object.keys(PRICE_COATING_FACTORS)

export const PRICE_TABLE: [number, number][] = priceConfig.price_table as [number, number][]

export type PondShape = 'Eckig' | 'Rund'

export interface PricePosition {
  description: string
  article_no: string
  position_no: string
  order_no: string
  cost_center: string
  purchase_order: string
  quantity: number
  shape: PondShape
  coating: string
  factor: number
  diameter: number
  length: number
  width: number
  height: number
  discount: number
  note: string
  source: string
}

export function priceDefaultFactor(coating: string): number {
  return PRICE_COATING_FACTORS[coating] ?? 1.0
}

export function priceLookupRate(volume: number): number {
  if (volume <= 0) return 0
  let rate = PRICE_TABLE[0][1]
  for (const [threshold, candidate] of PRICE_TABLE) {
    if (volume >= threshold) rate = candidate
    else break
  }
  return rate
}

export function money(value: number): number {
  return Math.round(((value || 0) + 1e-12) * 100) / 100
}

export function moneyDe(value: number): string {
  return money(value).toFixed(2).replace('.', ',')
}

// Akzeptiert deutsche ("4,4") und englische ("4.4") Schreibweise.
// Strip Tausender-Punkte/Leerzeichen, danach Komma -> Punkt.
// Gibt 0 zurück bei leer/ungültig.
export function parseDecimal(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  let s = String(value).trim()
  if (!s) return 0
  s = s.replace(/\s+/g, '').replace(/[€%]/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // "1.234,56" -> "1234.56"   /   "1,234.56" -> "1234.56"
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// Anzeige-Format: 4.4 -> "4,4"  /  4 -> "4"  /  0 -> ""
export function formatDecimalDe(n: number, opts?: { keepZero?: boolean; decimals?: number }): string {
  if (!Number.isFinite(n)) return ''
  if (!n && !opts?.keepZero) return ''
  if (typeof opts?.decimals === 'number') {
    return n.toFixed(opts.decimals).replace('.', ',')
  }
  // Knapp halten: keine überflüssigen Nullen
  const s = String(n)
  return s.replace('.', ',')
}

export function normalizePriceCoating(value: string): string {
  if (!value) return 'TiCN'
  const v = String(value).trim().toLowerCase()
  const map: Record<string, string> = {
    'meta-s': 'Meta-S', 'metas': 'Meta-S',
    'crn': 'CrN', 'crn-rb': 'CrN-RB', 'crn rb': 'CrN-RB',
    'crn-dlc': 'CrN-DLC', 'crn dlc': 'CrN-DLC',
    'duplex meta-va': 'Duplex Meta-VA', 'duplex meta va': 'Duplex Meta-VA',
    'duplex meta-cax': 'Duplex Meta-CAX', 'duplex meta cax': 'Duplex Meta-CAX',
    'duplex cax': 'Duplex Meta-CAX',
    'alcrn': 'AlCrN', 'tin': 'TiN', 'ticn': 'TiCN', 'tialn': 'TiaLN',
  }
  return map[v] || (PRICE_COATINGS.includes(value) ? value : 'TiCN')
}

export function normalizePriceCustomer(value: string): string {
  const c = (value || '').trim()
  if (c.toLowerCase().includes('pondruff')) return ''
  return c
}

export function blankPricePosition(shape: PondShape = 'Eckig'): PricePosition {
  return {
    description: '', article_no: '', position_no: '', order_no: '',
    cost_center: '', purchase_order: '', quantity: 1, shape, coating: 'TiCN',
    factor: priceDefaultFactor('TiCN'),
    diameter: 0, length: 0, width: 0, height: 0,
    discount: 0, note: '', source: 'manuell',
  }
}

export interface PriceResult {
  volume: number
  unit_price: number
  normal_total: number
  final_total: number
  discount_amount: number
}

export function calcPricePosition(pos: PricePosition): PriceResult {
  const coating = normalizePriceCoating(pos.coating)
  const factor = parseDecimal(pos.factor) || priceDefaultFactor(coating)
  const quantity = Math.max(1, Math.floor(parseDecimal(pos.quantity) || 1))
  const discount = Math.max(0, Math.min(100, parseDecimal(pos.discount)))
  const shape = pos.shape === 'Rund' ? 'Rund' : 'Eckig'

  let volume = 0
  if (shape === 'Rund') {
    const d = parseDecimal(pos.diameter)
    const l = parseDecimal(pos.length)
    volume = (d * d) * PRICE_EXCEL_PI / 4 * l
  } else {
    const l = parseDecimal(pos.length)
    const w = parseDecimal(pos.width)
    const h = parseDecimal(pos.height)
    volume = l * w * h
  }

  const multiplier = coating === 'TiN' ? 1.0 : PRICE_BASE_COATING_MULTIPLIER
  const unit_price = volume > 0 && factor > 0
    ? priceLookupRate(volume) * volume / 1000 * multiplier * factor
    : 0
  const normal_total = money(unit_price * quantity)
  const final_total = money(normal_total * (1 - discount / 100))
  return {
    volume,
    unit_price: money(unit_price),
    normal_total,
    final_total,
    discount_amount: money(normal_total - final_total),
  }
}

// --- WISO ---

export function wisoCompactDimensionText(pos: PricePosition): string {
  const fmt = (v: unknown) => {
    const n = parseDecimal(v)
    return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
  }
  if (pos.shape === 'Rund') {
    return `Ø${fmt(pos.diameter)}x${fmt(pos.length)}mm`
  }
  return `${fmt(pos.length)}x${fmt(pos.width)}x${fmt(pos.height)}mm`
}

export function wisoShortDescriptionText(pos: PricePosition): string {
  let d = (pos.description || 'Beschichtung').trim()
  d = d.replace(/^pondr?uff[-\s]*[^\s,]+\s*/i, '')
  d = d.replace(/^beschichtung\s*/i, '')
  d = d.split(/,?\s*material\s*:/i)[0].trim()
  d = d.split(/,?\s*ma[ßs]e\s*:/i)[0].trim()
  return d || 'Beschichtung'
}

function wisoPurchaseOrderValue(pos: PricePosition, globalPO: string): string {
  const local = (pos.purchase_order || '').trim()
  const global = (globalPO || '').trim()
  const vals = [local, global].filter(Boolean)
  if (!vals.length) return ''
  return vals.reduce((a, b) => (b.length > a.length ? b : a))
}

export function wisoDescriptionForPricePosition(pos: PricePosition, isLast: boolean, globalPO: string): string {
  const coating = normalizePriceCoating(pos.coating)
  const lines = [`${wisoShortDescriptionText(pos)} ${wisoCompactDimensionText(pos)} ${coating} beschichtet.`]
  if (pos.order_no) lines.push(`Auftrags.-Nr. ${pos.order_no}`)
  if (pos.cost_center) lines.push(`Kostenstelle: ${pos.cost_center}`)
  const po = isLast ? wisoPurchaseOrderValue(pos, globalPO) : ''
  if (po) lines.push(`Ihre Bestell.-Nr. ${po}`)
  return lines.join('\n')
}

export interface WisoOrderRow {
  'Pos.': string
  Menge: number
  'Artikel-Nr.': string
  Einheit: string
  Beschreibung: string
  Liefertermin: string
  Listenpreis: string
  'Rabatt (%)': string
  Einzelpreis: string
  Gesamtpreis: string
}

export interface WisoOrder {
  id: string
  created_at: string
  customer: string
  project: string
  purchase_order: string
  name: string
  total: number
  rows: WisoOrderRow[]
}

export function buildWisoPriceOrder(customer: string, project: string, positions: PricePosition[], globalPO: string): WisoOrder {
  const rows: WisoOrderRow[] = positions.map((pos, i) => {
    const result = calcPricePosition(pos)
    const qty = Math.max(1, Math.floor(parseDecimal(pos.quantity) || 1))
    const singleAfter = money(result.final_total / qty)
    const idx = i + 1
    return {
      'Pos.': String(idx).padStart(2, '0'),
      Menge: qty,
      'Artikel-Nr.': pos.article_no || '',
      Einheit: '',
      Beschreibung: wisoDescriptionForPricePosition(pos, idx === positions.length, globalPO),
      Liefertermin: '',
      Listenpreis: result.unit_price.toFixed(2),
      'Rabatt (%)': String(parseDecimal(pos.discount)),
      Einzelpreis: singleAfter.toFixed(2),
      Gesamtpreis: result.final_total.toFixed(2),
    }
  })
  const total = money(rows.reduce((s, r) => s + parseFloat(r.Gesamtpreis), 0))
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return {
    id: `PREIS-${stamp}`,
    created_at: now.toLocaleString('de-DE'),
    customer, project, purchase_order: globalPO,
    name: project || `Preisauftrag ${now.toLocaleString('de-DE')}`,
    total, rows,
  }
}

export function wisoOrderTsv(order: WisoOrder): string {
  const headers: (keyof WisoOrderRow)[] = ['Pos.', 'Menge', 'Artikel-Nr.', 'Einheit', 'Beschreibung', 'Liefertermin', 'Listenpreis', 'Rabatt (%)', 'Einzelpreis', 'Gesamtpreis']
  const lines = [headers.join('\t')]
  for (const row of order.rows) {
    lines.push(headers.map(h => String(row[h] ?? '')).join('\t'))
  }
  return lines.join('\n')
}

const WISO_CLIPBOARD_COLUMNS: (keyof WisoOrderRow)[] = ['Menge', 'Artikel-Nr.', 'Einheit', 'Beschreibung', 'Liefertermin', 'Listenpreis', 'Rabatt (%)', 'Einzelpreis', 'Gesamtpreis']

function wisoClipboardValue(row: WisoOrderRow, col: keyof WisoOrderRow): string {
  const v = row[col]
  if (col === 'Listenpreis' || col === 'Einzelpreis' || col === 'Gesamtpreis') {
    return String(v).replace('.', ',')
  }
  return String(v ?? '')
}

function tsvCell(v: string): string {
  const text = String(v ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[\t\n"]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function wisoClipboardTsv(order: WisoOrder): string {
  return order.rows
    .map(row => WISO_CLIPBOARD_COLUMNS.map(c => tsvCell(wisoClipboardValue(row, c))).join('\t'))
    .join('\r\n')
}

export function wisoClipboardPlainTsv(order: WisoOrder): string {
  return order.rows
    .map(row =>
      WISO_CLIPBOARD_COLUMNS.map(c => {
        let v = wisoClipboardValue(row, c)
        if (c === 'Beschreibung') v = v.replace(/\r\n|\r|\n/g, ' / ')
        return v.replace(/\t/g, ' ')
      }).join('\t'),
    )
    .join('\r\n')
}

// Client-side: Bild auf maxSide skalieren + als JPEG mit quality re-encodieren.
// Smartphone-Fotos (4-6 MB) werden so auf ~300-800 KB reduziert → Vercel 4.5 MB
// Body-Limit wird auch bei mehreren Bildern eingehalten.
export async function compressImageDataUrl(file: File, maxSide = 2000, quality = 0.85): Promise<string> {
  if (typeof window === 'undefined') throw new Error('compressImageDataUrl: nur im Browser')
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('FileReader-Fehler'))
    r.readAsDataURL(file)
  })
  if (!dataUrl.startsWith('data:image/')) return dataUrl
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Bild konnte nicht geladen werden'))
    i.src = dataUrl
  })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return dataUrl
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, tw, th)
  try {
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}
