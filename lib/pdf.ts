// lib/pdf.ts – PDF-Generierung mit jsPDF (dynamic import für Next.js SSR-Kompatibilität)

export type PDFRechnung = {
  id: string
  nummer?: string
  kunde: string
  betrag: string
  netto?: number
  steuerbetrag?: number
  summe?: number
  steuer_satz?: number
  faellig: string
  erstellt: string
  status: string
  internalReference?: string
  leistungszeitraum_von?: string
  leistungszeitraum_bis?: string
}

export type PDFAngebot = {
  id: string
  kunde: string
  titel: string
  betrag: string
  datum: string
  gueltig: string
  status: string
}

export type PDFTemplate = 'modern-dark' | 'classic-light' | 'elegant-minimal'

export type PDFCompanySettings = {
  firmenname?: string
  logo_url?: string
  adresse?: string
  plz?: string
  ort?: string
  land?: string
  email?: string
  telefon?: string
  website?: string
  ust_id?: string
  steuernummer?: string
  bankname?: string
  iban?: string
  bic?: string
  zahlungsziel_tage?: number
  standard_mwst?: number
  dokument_footer?: string
  briefpapier_layout?: {
    template?: PDFTemplate
    akzentfarbe?: string
    showBankdaten?: boolean
    showSteuernummer?: boolean
    showUstId?: boolean
    showWebsite?: boolean
  }
}

const FALLBACK_COMPANY: PDFCompanySettings = {
  firmenname: 'Petersen KI Betriebssteuerung',
  website: 'petersen-ki-pilot.de',
  standard_mwst: 19,
  dokument_footer: 'Vielen Dank für Ihr Vertrauen',
  briefpapier_layout: {
    template: 'modern-dark',
    akzentfarbe: '#20c8ff',
    showBankdaten: true,
    showSteuernummer: true,
    showUstId: true,
    showWebsite: true,
  },
}

function getCompanySettings(): PDFCompanySettings {
  if (typeof window === 'undefined') return FALLBACK_COMPANY
  try {
    const raw = localStorage.getItem('pk_firma_einstellungen')
    return raw ? { ...FALLBACK_COMPANY, ...JSON.parse(raw) } : FALLBACK_COMPANY
  } catch {
    return FALLBACK_COMPANY
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function loadImageDataUrl(url?: string): Promise<string | null> {
  if (!url || typeof window === 'undefined') return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG'
  if (dataUrl.includes('image/webp')) return 'WEBP'
  return 'PNG'
}

function heuteFormatiert(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEuro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocType = any

// ── Document style helpers ────────────────────────────────────────────────────

type HintStyle = {
  bg: [number, number, number]
  borderMode: 'none' | 'stroke'
  accentBar: [number, number, number] | null
  titleColor: [number, number, number] | null  // null = use accent
  textColor: [number, number, number]
  subtextColor: [number, number, number]
}

function getHintStyle(template: PDFTemplate, accent: [number, number, number]): HintStyle {
  switch (template) {
    case 'classic-light': return {
      bg: [230, 241, 255],
      borderMode: 'none',
      accentBar: accent,
      titleColor: [20, 40, 85],
      textColor: [35, 60, 105],
      subtextColor: [75, 105, 155],
    }
    case 'elegant-minimal': return {
      bg: [252, 253, 255],
      borderMode: 'stroke',
      accentBar: accent,
      titleColor: null,
      textColor: [45, 60, 80],
      subtextColor: [95, 115, 140],
    }
    default: return {
      bg: [12, 22, 36],
      borderMode: 'none',
      accentBar: accent,
      titleColor: null,
      textColor: [170, 185, 205],
      subtextColor: [130, 150, 170],
    }
  }
}

// ── Template 1: Modern Dark ───────────────────────────────────────────────────

function drawHeaderModernDark(doc: DocType, company: PDFCompanySettings, logoData: string | null, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  doc.setFillColor(10, 18, 30)
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setFillColor(...accent)
  doc.rect(0, 25, pageW, 1, 'F')

  if (logoData) {
    try { doc.addImage(logoData, imageFormat(logoData), margin, 4, 17, 17) } catch {}
  }
  const nameX = logoData ? margin + 20 : margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...accent)
  doc.text((company.firmenname || FALLBACK_COMPANY.firmenname!).toUpperCase(), nameX, 12)

  const contactParts: string[] = []
  if (company.website) contactParts.push(company.website)
  if (company.email) contactParts.push(company.email)
  if (company.telefon) contactParts.push(company.telefon)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(150, 170, 190)
  if (contactParts.length) doc.text(contactParts.join('  ·  '), pageW - margin, 12, { align: 'right' })

  const adressParts: string[] = []
  if (company.adresse) adressParts.push(company.adresse)
  if (company.plz || company.ort) adressParts.push([company.plz, company.ort].filter(Boolean).join(' '))
  if (adressParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(120, 140, 160)
    doc.text(adressParts.join(', '), nameX, 19)
  }

  const taxParts: string[] = []
  if (company.briefpapier_layout?.showUstId !== false && company.ust_id) taxParts.push(`USt-ID: ${company.ust_id}`)
  if (company.briefpapier_layout?.showSteuernummer !== false && company.steuernummer) taxParts.push(`St.-Nr.: ${company.steuernummer}`)
  if (taxParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(120, 140, 160)
    doc.text(taxParts.join('  ·  '), pageW - margin, 19, { align: 'right' })
  }
}

function drawFooterModernDark(doc: DocType, company: PDFCompanySettings, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  doc.setFillColor(10, 18, 30)
  doc.rect(0, 268, pageW, 29, 'F')
  doc.setFillColor(...accent)
  doc.rect(0, 268, pageW, 1, 'F')

  const parts: string[] = []
  if (company.dokument_footer) parts.push(company.dokument_footer)
  if (company.briefpapier_layout?.showWebsite !== false && company.website) parts.push(company.website)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bankname) parts.push(company.bankname)
  if (company.briefpapier_layout?.showBankdaten !== false && company.iban) parts.push(`IBAN ${company.iban}`)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bic) parts.push(`BIC ${company.bic}`)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 140, 160)
  if (parts.length) doc.text(parts.join('  ·  '), pageW / 2, 276, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(80, 100, 115)
  doc.text(`Seite 1  ·  erstellt am ${heuteFormatiert()}`, pageW / 2, 283, { align: 'center' })
}

// ── Template 2: Classic Professional ─────────────────────────────────────────

function drawHeaderClassicLight(doc: DocType, company: PDFCompanySettings, logoData: string | null, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  // Deep navy header bar
  doc.setFillColor(22, 42, 88)
  doc.rect(0, 0, pageW, 28, 'F')
  // Accent bottom line
  doc.setFillColor(...accent)
  doc.rect(0, 27.2, pageW, 1.2, 'F')

  if (logoData) {
    try { doc.addImage(logoData, imageFormat(logoData), margin, 5, 17, 17) } catch {}
  }
  const nameX = logoData ? margin + 21 : margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text((company.firmenname || FALLBACK_COMPANY.firmenname!).toUpperCase(), nameX, 13.5)

  const contactParts: string[] = []
  if (company.website) contactParts.push(company.website)
  if (company.email) contactParts.push(company.email)
  if (company.telefon) contactParts.push(company.telefon)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(175, 200, 235)
  if (contactParts.length) doc.text(contactParts.join('  ·  '), pageW - margin, 13.5, { align: 'right' })

  const adressParts: string[] = []
  if (company.adresse) adressParts.push(company.adresse)
  if (company.plz || company.ort) adressParts.push([company.plz, company.ort].filter(Boolean).join(' '))
  if (adressParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(145, 170, 210)
    doc.text(adressParts.join(', '), nameX, 21)
  }

  const taxParts: string[] = []
  if (company.briefpapier_layout?.showUstId !== false && company.ust_id) taxParts.push(`USt-ID: ${company.ust_id}`)
  if (company.briefpapier_layout?.showSteuernummer !== false && company.steuernummer) taxParts.push(`St.-Nr.: ${company.steuernummer}`)
  if (taxParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(145, 170, 210)
    doc.text(taxParts.join('  ·  '), pageW - margin, 21, { align: 'right' })
  }
}

function drawFooterClassicLight(doc: DocType, company: PDFCompanySettings, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  // Light gray footer background
  doc.setFillColor(242, 246, 252)
  doc.rect(0, 268, pageW, 29, 'F')
  // Thin border at top
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.5)
  doc.line(0, 268.5, pageW, 268.5)

  const parts: string[] = []
  if (company.dokument_footer) parts.push(company.dokument_footer)
  if (company.briefpapier_layout?.showWebsite !== false && company.website) parts.push(company.website)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bankname) parts.push(company.bankname)
  if (company.briefpapier_layout?.showBankdaten !== false && company.iban) parts.push(`IBAN ${company.iban}`)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bic) parts.push(`BIC ${company.bic}`)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(55, 80, 130)
  if (parts.length) doc.text(parts.join('  ·  '), pageW / 2, 277, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(120, 140, 175)
  doc.text(`Seite 1  ·  erstellt am ${heuteFormatiert()}`, pageW / 2, 284, { align: 'center' })
}

// ── Template 3: Elegant Minimal ───────────────────────────────────────────────

function drawHeaderElegantMinimal(doc: DocType, company: PDFCompanySettings, logoData: string | null, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  // Slim accent bar at very top
  doc.setFillColor(...accent)
  doc.rect(0, 0, pageW, 2.5, 'F')

  if (logoData) {
    try { doc.addImage(logoData, imageFormat(logoData), margin, 6, 16, 16) } catch {}
  }
  const nameX = logoData ? margin + 20 : margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(22, 32, 52)
  doc.text((company.firmenname || FALLBACK_COMPANY.firmenname!).toUpperCase(), nameX, 14)

  const contactParts: string[] = []
  if (company.website) contactParts.push(company.website)
  if (company.email) contactParts.push(company.email)
  if (company.telefon) contactParts.push(company.telefon)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(135, 150, 170)
  if (contactParts.length) doc.text(contactParts.join('  ·  '), pageW - margin, 14, { align: 'right' })

  const adressParts: string[] = []
  if (company.adresse) adressParts.push(company.adresse)
  if (company.plz || company.ort) adressParts.push([company.plz, company.ort].filter(Boolean).join(' '))
  if (adressParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(155, 168, 185)
    doc.text(adressParts.join(', '), nameX, 20.5)
  }

  const taxParts: string[] = []
  if (company.briefpapier_layout?.showUstId !== false && company.ust_id) taxParts.push(`USt-ID: ${company.ust_id}`)
  if (company.briefpapier_layout?.showSteuernummer !== false && company.steuernummer) taxParts.push(`St.-Nr.: ${company.steuernummer}`)
  if (taxParts.length) {
    doc.setFontSize(7.5)
    doc.setTextColor(155, 168, 185)
    doc.text(taxParts.join('  ·  '), pageW - margin, 20.5, { align: 'right' })
  }

  // Clean separator line
  doc.setDrawColor(215, 222, 232)
  doc.setLineWidth(0.3)
  doc.line(margin, 26, pageW - margin, 26)
}

function drawFooterElegantMinimal(doc: DocType, company: PDFCompanySettings, accent: [number, number, number]): void {
  const pageW = 210
  const margin = 20

  // Thin accent separator
  doc.setFillColor(...accent)
  doc.rect(margin, 268, pageW - 2 * margin, 0.5, 'F')

  const parts: string[] = []
  if (company.dokument_footer) parts.push(company.dokument_footer)
  if (company.briefpapier_layout?.showWebsite !== false && company.website) parts.push(company.website)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bankname) parts.push(company.bankname)
  if (company.briefpapier_layout?.showBankdaten !== false && company.iban) parts.push(`IBAN ${company.iban}`)
  if (company.briefpapier_layout?.showBankdaten !== false && company.bic) parts.push(`BIC ${company.bic}`)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(155, 168, 185)
  if (parts.length) doc.text(parts.join('  ·  '), pageW / 2, 277, { align: 'center' })

  doc.setFontSize(7)
  doc.setTextColor(180, 190, 205)
  doc.text(`Seite 1  ·  erstellt am ${heuteFormatiert()}`, pageW / 2, 284, { align: 'center' })
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function drawHeader(doc: DocType, company: PDFCompanySettings, logoData: string | null, accent: [number, number, number]): void {
  const t = company.briefpapier_layout?.template ?? 'modern-dark'
  if (t === 'classic-light') return drawHeaderClassicLight(doc, company, logoData, accent)
  if (t === 'elegant-minimal') return drawHeaderElegantMinimal(doc, company, logoData, accent)
  return drawHeaderModernDark(doc, company, logoData, accent)
}

function drawFooter(doc: DocType, company: PDFCompanySettings, accent: [number, number, number]): void {
  const t = company.briefpapier_layout?.template ?? 'modern-dark'
  if (t === 'classic-light') return drawFooterClassicLight(doc, company, accent)
  if (t === 'elegant-minimal') return drawFooterElegantMinimal(doc, company, accent)
  return drawFooterModernDark(doc, company, accent)
}

export async function generateRechnungPDF(rechnung: PDFRechnung, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const company = getCompanySettings()
  const accent = hexToRgb(company.briefpapier_layout?.akzentfarbe || '#20c8ff')
  const template: PDFTemplate = company.briefpapier_layout?.template ?? 'modern-dark'
  const logoData = await loadImageDataUrl(company.logo_url)
  const hint = getHintStyle(template, accent)
  const pageW = 210
  const margin = 20

  drawHeader(doc, company, logoData, accent)
  drawFooter(doc, company, accent)

  // Absenderzeile (DIN-5008)
  const senderLine = [
    company.firmenname || FALLBACK_COMPANY.firmenname,
    company.adresse,
    [company.plz, company.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 155, 170)
  doc.text(senderLine, margin, 38)
  doc.setDrawColor(180, 195, 210)
  doc.setLineWidth(0.2)
  doc.line(margin, 39.5, margin + 80, 39.5)

  // Empfänger
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 25, 35)
  doc.text(kundenName, margin, 47)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 105, 120)
  doc.text('Sehr geehrte Damen und Herren,', margin, 53)

  // Metadaten rechts
  const metaX = 130
  const metaLabelW = 28
  const metaRows: [string, string][] = [
    ['Datum:', heuteFormatiert()],
    ['Rechnungs-Nr.:', rechnung.nummer || rechnung.id],
    ['Fällig am:', rechnung.faellig],
    ['Status:', rechnung.status],
  ]
  if (rechnung.leistungszeitraum_von && rechnung.leistungszeitraum_bis) {
    metaRows.push(['Leistungszeit.:', `${rechnung.leistungszeitraum_von} – ${rechnung.leistungszeitraum_bis}`])
  }
  metaRows.forEach(([label, value], i) => {
    const y = 38 + i * 6.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 115, 130)
    doc.text(label, metaX, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 25, 35)
    doc.text(value, metaX + metaLabelW, y)
  })

  // Titel
  const titleY = 68
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(10, 16, 26)
  doc.text('RECHNUNG', margin, titleY)
  doc.setFillColor(...accent)
  doc.rect(margin, titleY + 2, 40, 0.8, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(40, 48, 60)
  doc.text('vielen Dank für Ihr Vertrauen. Nachfolgend stellen wir Ihnen die folgende Leistung in Rechnung:', margin, 80, { maxWidth: 170 })

  // Tabelle
  const tableY = 90
  doc.setFillColor(10, 18, 30)
  doc.rect(margin, tableY, pageW - 2 * margin, 8.5, 'F')
  doc.setFillColor(...accent)
  doc.rect(margin, tableY, 2, 8.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 215, 230)
  doc.text('Pos.', margin + 4, tableY + 5.8)
  doc.text('Bezeichnung', margin + 16, tableY + 5.8)
  doc.text('Menge', pageW - margin - 58, tableY + 5.8)
  doc.text('Einzelpreis', pageW - margin - 40, tableY + 5.8)
  doc.text('Betrag (netto)', pageW - margin - 3, tableY + 5.8, { align: 'right' })

  const betragRaw = parseFloat(rechnung.betrag.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
  const mwstSatz = rechnung.steuer_satz ?? Number(company.standard_mwst ?? 19)
  const nettoVal = rechnung.netto ?? (rechnung.summe ? rechnung.summe / (1 + mwstSatz / 100) : betragRaw)
  const steuerVal = rechnung.steuerbetrag ?? (nettoVal * mwstSatz / 100)
  const bruttoVal = rechnung.summe ?? (nettoVal + steuerVal)

  const row1Y = tableY + 8.5
  doc.setFillColor(248, 251, 254)
  doc.rect(margin, row1Y, pageW - 2 * margin, 11, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 38, 50)
  doc.text('1', margin + 4, row1Y + 7)
  doc.text('Petersen KI Betriebssoftware – monatliches Abonnement', margin + 16, row1Y + 7)
  doc.text('1', pageW - margin - 55, row1Y + 7)
  doc.text(fmtEuro(nettoVal), pageW - margin - 38, row1Y + 7)
  doc.text(fmtEuro(nettoVal), pageW - margin - 3, row1Y + 7, { align: 'right' })

  // Summen-Block
  const sumY = row1Y + 11
  const sumX = pageW - margin - 70
  const sumW = 70
  const sumRowsData: [string, string][] = [
    ['Nettobetrag', fmtEuro(nettoVal)],
    [`zzgl. ${mwstSatz}% MwSt.`, fmtEuro(steuerVal)],
  ]
  sumRowsData.forEach(([label, value], i) => {
    const y = sumY + 6 + i * 6.5
    doc.setFillColor(i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 248 : 252, 255)
    doc.rect(sumX, y - 4.5, sumW, 6.5, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(90, 105, 120)
    doc.text(label, sumX + 3, y)
    doc.setTextColor(20, 28, 40)
    doc.text(value, sumX + sumW - 3, y, { align: 'right' })
  })

  const totalY = sumY + 6 + sumRowsData.length * 6.5 + 1
  doc.setFillColor(10, 18, 30)
  doc.rect(sumX, totalY - 4.5, sumW, 9, 'F')
  doc.setFillColor(...accent)
  doc.rect(sumX, totalY - 4.5, 2, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(200, 215, 230)
  doc.text('Gesamtbetrag', sumX + 4, totalY + 1)
  doc.setTextColor(...accent)
  doc.text(fmtEuro(bruttoVal), sumX + sumW - 3, totalY + 1, { align: 'right' })

  // Zahlungshinweis-Box
  const hasRef = !!rechnung.internalReference
  const hinweisH = company.iban ? (hasRef ? 24 : 18) : (hasRef ? 18 : 14)
  const hinweisY = totalY + 14

  doc.setFillColor(...hint.bg)
  doc.roundedRect(margin, hinweisY, pageW - 2 * margin, hinweisH, 3, 3, 'F')
  if (hint.borderMode === 'stroke') {
    doc.setDrawColor(...accent)
    doc.setLineWidth(0.5)
    doc.roundedRect(margin, hinweisY, pageW - 2 * margin, hinweisH, 3, 3, 'S')
  }
  if (hint.accentBar) {
    doc.setFillColor(...hint.accentBar)
    doc.roundedRect(margin, hinweisY, 3, hinweisH, 1.5, 1.5, 'F')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  if (hint.titleColor) doc.setTextColor(...hint.titleColor)
  else doc.setTextColor(...accent)
  doc.text('Zahlungshinweis', margin + 6, hinweisY + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...hint.textColor)
  doc.text(`Bitte überweisen Sie ${fmtEuro(bruttoVal)} bis zum ${rechnung.faellig}.`, margin + 6, hinweisY + 12.5)

  let bankLineY = hinweisY + 18
  if (company.iban && company.briefpapier_layout?.showBankdaten !== false) {
    const bankLine = [
      company.bankname,
      `IBAN ${company.iban}`,
      company.bic ? `BIC ${company.bic}` : '',
    ].filter(Boolean).join('  ·  ')
    doc.setFontSize(8)
    doc.setTextColor(...hint.subtextColor)
    doc.text(bankLine, margin + 6, bankLineY)
    bankLineY += 5.5
  }

  if (hasRef) {
    doc.setFontSize(7.5)
    doc.setTextColor(...hint.subtextColor)
    doc.text(`Verwendungszweck: ${rechnung.internalReference}`, margin + 6, bankLineY)
  }

  // Signatur
  const signY = hinweisY + hinweisH + 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 75, 90)
  doc.text('Mit freundlichen Grüßen', margin, signY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...accent)
  doc.text(company.firmenname || FALLBACK_COMPANY.firmenname!, margin, signY + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 115, 130)
  doc.text('Digitale Betriebssteuerung für moderne Unternehmen', margin, signY + 13)

  if (returnBase64) return doc.output('datauristring').split(',')[1]
  doc.save(`Rechnung_${rechnung.nummer || rechnung.id}.pdf`)
}

export async function generateAngebotPDF(angebot: PDFAngebot, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const company = getCompanySettings()
  const accent = hexToRgb(company.briefpapier_layout?.akzentfarbe || '#20c8ff')
  const template: PDFTemplate = company.briefpapier_layout?.template ?? 'modern-dark'
  const logoData = await loadImageDataUrl(company.logo_url)
  const hint = getHintStyle(template, accent)
  const pageW = 210
  const margin = 20

  drawHeader(doc, company, logoData, accent)
  drawFooter(doc, company, accent)

  // Absenderzeile
  const senderLine = [
    company.firmenname || FALLBACK_COMPANY.firmenname,
    company.adresse,
    [company.plz, company.ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 155, 170)
  doc.text(senderLine, margin, 38)
  doc.setDrawColor(180, 195, 210)
  doc.setLineWidth(0.2)
  doc.line(margin, 39.5, margin + 80, 39.5)

  // Empfänger
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 25, 35)
  doc.text(kundenName, margin, 47)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 105, 120)
  doc.text('Sehr geehrte Damen und Herren,', margin, 53)

  // Metadaten rechts
  const metaX = 130
  const metaLabelW = 28
  const metaRows: [string, string][] = [
    ['Datum:', heuteFormatiert()],
    ['Angebots-Nr.:', angebot.id],
    ['Gültig bis:', angebot.gueltig],
    ['Status:', angebot.status],
  ]
  metaRows.forEach(([label, value], i) => {
    const y = 38 + i * 6.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 115, 130)
    doc.text(label, metaX, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 25, 35)
    doc.text(value, metaX + metaLabelW, y)
  })

  // Titel
  const titleY = 68
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(10, 16, 26)
  doc.text('ANGEBOT', margin, titleY)
  doc.setFillColor(...accent)
  doc.rect(margin, titleY + 2, 30, 0.8, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(40, 48, 60)
  doc.text('wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen:', margin, 80)

  // Tabelle
  const tableY = 90
  doc.setFillColor(10, 18, 30)
  doc.rect(margin, tableY, pageW - 2 * margin, 8.5, 'F')
  doc.setFillColor(...accent)
  doc.rect(margin, tableY, 2, 8.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 215, 230)
  doc.text('Pos.', margin + 4, tableY + 5.8)
  doc.text('Leistung / Bezeichnung', margin + 16, tableY + 5.8)
  doc.text('Betrag (netto)', pageW - margin - 3, tableY + 5.8, { align: 'right' })

  const row1Y = tableY + 8.5
  doc.setFillColor(248, 251, 254)
  doc.rect(margin, row1Y, pageW - 2 * margin, 11, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 38, 50)
  doc.text('1', margin + 4, row1Y + 7)
  const titelText = angebot.titel.length > 70 ? angebot.titel.substring(0, 67) + '…' : angebot.titel
  doc.text(titelText, margin + 16, row1Y + 7)
  doc.text(angebot.betrag, pageW - margin - 3, row1Y + 7, { align: 'right' })

  // Summen-Block
  const betragNetto = parseFloat(angebot.betrag.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
  const mwstSatz = Number(company.standard_mwst ?? 19)
  const mwst = betragNetto * (mwstSatz / 100)
  const brutto = betragNetto + mwst

  const sumY = row1Y + 11
  const sumX = pageW - margin - 70
  const sumW = 70
  const sumRowsData: [string, string][] = [
    ['Nettobetrag', fmtEuro(betragNetto)],
    [`zzgl. ${mwstSatz}% MwSt.`, fmtEuro(mwst)],
  ]
  sumRowsData.forEach(([label, value], i) => {
    const y = sumY + 6 + i * 6.5
    doc.setFillColor(i % 2 === 0 ? 245 : 250, i % 2 === 0 ? 248 : 252, 255)
    doc.rect(sumX, y - 4.5, sumW, 6.5, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(90, 105, 120)
    doc.text(label, sumX + 3, y)
    doc.setTextColor(20, 28, 40)
    doc.text(value, sumX + sumW - 3, y, { align: 'right' })
  })

  const totalY = sumY + 6 + sumRowsData.length * 6.5 + 1
  doc.setFillColor(10, 18, 30)
  doc.rect(sumX, totalY - 4.5, sumW, 9, 'F')
  doc.setFillColor(...accent)
  doc.rect(sumX, totalY - 4.5, 2, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(200, 215, 230)
  doc.text('Gesamtbetrag', sumX + 4, totalY + 1)
  doc.setTextColor(...accent)
  doc.text(fmtEuro(brutto), sumX + sumW - 3, totalY + 1, { align: 'right' })

  // Gültigkeitshinweis-Box
  const hinweisY = totalY + 14
  const hinweisH = 15

  doc.setFillColor(...hint.bg)
  doc.roundedRect(margin, hinweisY, pageW - 2 * margin, hinweisH, 3, 3, 'F')
  if (hint.borderMode === 'stroke') {
    doc.setDrawColor(...accent)
    doc.setLineWidth(0.5)
    doc.roundedRect(margin, hinweisY, pageW - 2 * margin, hinweisH, 3, 3, 'S')
  }
  if (hint.accentBar) {
    doc.setFillColor(...hint.accentBar)
    doc.roundedRect(margin, hinweisY, 3, hinweisH, 1.5, 1.5, 'F')
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  if (hint.titleColor) doc.setTextColor(...hint.titleColor)
  else doc.setTextColor(...accent)
  doc.text('Hinweis', margin + 6, hinweisY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...hint.textColor)
  doc.text(`Dieses Angebot ist gültig bis zum ${angebot.gueltig}. Wir freuen uns auf Ihren Auftrag!`, margin + 6, hinweisY + 11.5)

  // Signatur
  const signY = hinweisY + 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 75, 90)
  doc.text('Mit freundlichen Grüßen', margin, signY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...accent)
  doc.text(company.firmenname || FALLBACK_COMPANY.firmenname!, margin, signY + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 115, 130)
  doc.text('Digitale Betriebssteuerung für moderne Unternehmen', margin, signY + 13)

  if (returnBase64) return doc.output('datauristring').split(',')[1]
  doc.save(`Angebot_${angebot.id}.pdf`)
}
