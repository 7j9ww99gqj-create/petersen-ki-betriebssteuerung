// Pondruff-Modul: isoliert, nur sichtbar fuer info@pondruffpolierservice.de.
// Port der Preislogik aus dem Streamlit-Tool (app.py).

export const POND_USER_EMAIL = 'info@pondruffpolierservice.de'

export function isPondruffUser(email: string | null | undefined): boolean {
  return (email || '').toLowerCase() === POND_USER_EMAIL
}

export const PRICE_BASE_COATING_MULTIPLIER = 1.2
export const PRICE_EXCEL_PI = 3.141

export const PRICE_COATING_FACTORS: Record<string, number> = {
  'Duplex Meta-VA': 1.40,
  'Duplex Meta-CAX': 1.50,
  'Meta-S': 1.40,
  'AlCrN': 1.40,
  'TiCN': 1.10,
  'TiN': 1.10,
  'CrN': 1.10,
  'CrN-RB': 1.40,
  'CrN-DLC': 1.60,
  'TiaLN': 1.40,
}
export const PRICE_COATINGS = Object.keys(PRICE_COATING_FACTORS)

export const PRICE_TABLE: [number, number][] = [
  [1000, 2.55645940598109], [2000, 1.27822970299055],
  [3000, 0.971454574272815], [6000, 0.843631603973761],
  [10000, 0.81806700991395], [15000, 0.766937821794328],
  [20000, 0.715808633674706], [25000, 0.664679445555084],
  [30000, 0.613550257435462], [40000, 0.511291881196219],
  [50000, 0.460162693076597], [60000, 0.429485180204824],
  [70000, 0.409033504956975], [80000, 0.342565560401466],
  [150000, 0.32722680396558], [200000, 0.306775128717731],
  [250000, 0.301662209905769], [300000, 0.296549291093807],
  [400000, 0.291436372281845], [500000, 0.28121053465792],
  [600000, 0.270984697033996], [700000, 0.265871778222034],
  [800000, 0.245420102974185], [900000, 0.235194265350261],
  [950000, 0.230081346538298], [1000000, 0.214742590102412],
  [1100000, 0.199403833666525], [1200000, 0.189177996042601],
  [1300000, 0.178952158418676], [1400000, 0.168726320794752],
  [1500000, 0.16361340198279], [1600000, 0.153387564358866],
  [1700000, 0.143161726734941], [1800000, 0.138048807922979],
  [1900000, 0.132935889111017], [2000000, 0.11759713267513],
  [2500000, 0.102258376239244], [3000000, 0.0971454574272815],
  [3500000, 0.0869196198033572], [4000000, 0.081806700991395],
  [4500000, 0.0766937821794328], [5000000, 0.0715808633674706],
  [6500000, 0.0664679445555084], [7500000, 0.0613550257435462],
  [10000000, 0.056242106931584], [35000000, 0.0511291881196219],
]

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
  const factor = Number(pos.factor) || priceDefaultFactor(coating)
  const quantity = Math.max(1, Math.floor(Number(pos.quantity) || 1))
  const discount = Math.max(0, Math.min(100, Number(pos.discount) || 0))
  const shape = pos.shape === 'Rund' ? 'Rund' : 'Eckig'

  let volume = 0
  if (shape === 'Rund') {
    const d = Number(pos.diameter) || 0
    const l = Number(pos.length) || 0
    volume = (d * d) * PRICE_EXCEL_PI / 4 * l
  } else {
    const l = Number(pos.length) || 0
    const w = Number(pos.width) || 0
    const h = Number(pos.height) || 0
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
  if (pos.shape === 'Rund') {
    return `Ø${Number(pos.diameter) || 0}x${Number(pos.length) || 0}mm`
  }
  return `${Number(pos.length) || 0}x${Number(pos.width) || 0}x${Number(pos.height) || 0}mm`
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
    const qty = Math.max(1, Math.floor(Number(pos.quantity) || 1))
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
      'Rabatt (%)': String(Number(pos.discount) || 0),
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
