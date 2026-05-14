// lib/pdf.ts – PDF-Generierung mit jsPDF (dynamic import für Next.js SSR-Kompatibilität)

export type PDFRechnung = {
  id: string
  nummer?: string
  kunde: string
  betrag: string
  faellig: string
  erstellt: string
  status: string
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
  briefpapier_layout: { akzentfarbe: '#20c8ff', showBankdaten: true, showSteuernummer: true, showUstId: true, showWebsite: true },
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

export async function generateRechnungPDF(rechnung: PDFRechnung, kundenName: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const company = getCompanySettings()
  const accent = hexToRgb(company.briefpapier_layout?.akzentfarbe || '#20c8ff')
  const logoData = await loadImageDataUrl(company.logo_url)

  const pageW = 210
  const margin = 20
  const companyTextX = logoData ? margin + 24 : margin

  // ── Header ─────────────────────────────────────────────────────────────
  if (logoData) {
    try { doc.addImage(logoData, imageFormat(logoData), margin, 8, 18, 18) } catch {}
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 120, 140)
  doc.text((company.firmenname || FALLBACK_COMPANY.firmenname!).toUpperCase(), companyTextX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Datum: ${heuteFormatiert()}`, pageW - margin, 16, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.5)
  doc.line(margin, 20, pageW - margin, 20)

  // ── Dokumenttyp ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(20, 20, 30)
  doc.text('RECHNUNG', margin, 38)

  // Rechnungsnummer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(80, 100, 120)
  doc.text(`Rechnungsnummer: ${rechnung.nummer || rechnung.id}`, margin, 48)

  // ── Empfänger-Block ─────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 250)
  doc.roundedRect(margin, 56, 80, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 120, 140)
  doc.text('AN', margin + 4, 63)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 30)
  doc.text(kundenName, margin + 4, 71)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  doc.text('Sehr geehrte Damen und Herren,', margin + 4, 78)

  // ── Metadaten rechts ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  const metaX = pageW - margin - 60
  doc.text(`Erstellt am:`, metaX, 63)
  doc.text(`Fällig am:`, metaX, 70)
  doc.text(`Status:`, metaX, 77)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 30)
  doc.text(rechnung.erstellt, metaX + 28, 63)
  doc.text(rechnung.faellig, metaX + 28, 70)
  doc.text(rechnung.status, metaX + 28, 77)

  // ── Einleitungstext ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 50)
  doc.text('vielen Dank fuer Ihr Vertrauen. Fuer Ihr gebuchtes Petersen-KI-Paket stellen wir Ihnen folgende Leistung in Rechnung:', margin, 96)

  // ── Tabelle ─────────────────────────────────────────────────────────────
  const tableY = 104
  // Tabellen-Header
  doc.setFillColor(32, 200, 255)
  doc.rect(margin, tableY, pageW - 2 * margin, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Pos.', margin + 3, tableY + 5.5)
  doc.text('Bezeichnung', margin + 20, tableY + 5.5)
  doc.text('Betrag (netto)', pageW - margin - 3, tableY + 5.5, { align: 'right' })

  // Zeile 1
  const row1Y = tableY + 8
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, row1Y, pageW - 2 * margin, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 50)
  doc.text('1', margin + 3, row1Y + 6.5)
  doc.text('Petersen KI Betriebssoftware - Abo / Leistungszeitraum', margin + 20, row1Y + 6.5)
  doc.text(rechnung.betrag, pageW - margin - 3, row1Y + 6.5, { align: 'right' })

  // Zeile 2 (MwSt)
  const row2Y = row1Y + 10
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, row2Y, pageW - 2 * margin, 10, 'F')
  const betragNetto = parseFloat(rechnung.betrag.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
  const mwstSatz = Number(company.standard_mwst ?? 19)
  const mwst = betragNetto * (mwstSatz / 100)
  const brutto = betragNetto + mwst
  const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  doc.setTextColor(80, 100, 120)
  doc.text('', margin + 3, row2Y + 6.5)
  doc.text(`Zzgl. ${mwstSatz}% MwSt.`, margin + 20, row2Y + 6.5)
  doc.text(fmtNum(mwst), pageW - margin - 3, row2Y + 6.5, { align: 'right' })

  // Gesamtbetrag
  const totalY = row2Y + 10
  doc.setFillColor(20, 30, 40)
  doc.rect(margin, totalY, pageW - 2 * margin, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...accent)
  doc.text('GESAMTBETRAG (brutto)', margin + 3, totalY + 8)
  doc.text(fmtNum(brutto), pageW - margin - 3, totalY + 8, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(200, 210, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, totalY + 18, pageW - margin, totalY + 18)

  // ── Zahlungshinweis ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  doc.text(`Bitte begleichen Sie den Gesamtbetrag bis zum ${rechnung.faellig}.`, margin, totalY + 26)
  if (company.iban && company.briefpapier_layout?.showBankdaten !== false) {
    doc.text(`${company.bankname ? company.bankname + ' · ' : ''}IBAN ${company.iban}${company.bic ? ' · BIC ' + company.bic : ''}`, margin, totalY + 31)
  }
  doc.setTextColor(...accent)
  doc.setFont('helvetica', 'bold')
  doc.text('Petersen KI Betriebssteuerung', margin, totalY + 34)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 100, 120)
  doc.text('Digitale Betriebssteuerung fuer moderne Unternehmen.', margin, totalY + 39)

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.4)
  doc.line(margin, 272, pageW - margin, 272)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 140, 160)
  const footerParts = [
    company.dokument_footer || FALLBACK_COMPANY.dokument_footer,
    company.briefpapier_layout?.showWebsite !== false ? company.website : '',
    company.briefpapier_layout?.showUstId !== false ? company.ust_id : '',
    company.briefpapier_layout?.showSteuernummer !== false ? company.steuernummer : '',
  ].filter(Boolean)
  doc.text(footerParts.join('  ·  '), pageW / 2, 277, { align: 'center' })

  doc.save(`Rechnung_${rechnung.id}.pdf`)
}

export async function generateAngebotPDF(angebot: PDFAngebot, kundenName: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const company = getCompanySettings()
  const accent = hexToRgb(company.briefpapier_layout?.akzentfarbe || '#20c8ff')
  const logoData = await loadImageDataUrl(company.logo_url)

  const pageW = 210
  const margin = 20
  const companyTextX = logoData ? margin + 24 : margin

  // ── Header ─────────────────────────────────────────────────────────────
  if (logoData) {
    try { doc.addImage(logoData, imageFormat(logoData), margin, 8, 18, 18) } catch {}
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 120, 140)
  doc.text((company.firmenname || FALLBACK_COMPANY.firmenname!).toUpperCase(), companyTextX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Datum: ${heuteFormatiert()}`, pageW - margin, 16, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.5)
  doc.line(margin, 20, pageW - margin, 20)

  // ── Dokumenttyp ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(20, 20, 30)
  doc.text('ANGEBOT', margin, 38)

  // Angebotsnummer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(80, 100, 120)
  doc.text(`Angebotsnummer: ${angebot.id}`, margin, 48)

  // ── Empfänger-Block ─────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 250)
  doc.roundedRect(margin, 56, 80, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 120, 140)
  doc.text('AN', margin + 4, 63)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 30)
  doc.text(kundenName, margin + 4, 71)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  doc.text('Sehr geehrte Damen und Herren,', margin + 4, 78)

  // ── Metadaten rechts ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  const metaX = pageW - margin - 60
  doc.text(`Erstellt am:`, metaX, 63)
  doc.text(`Gültig bis:`, metaX, 70)
  doc.text(`Status:`, metaX, 77)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 30)
  doc.text(angebot.datum, metaX + 28, 63)
  doc.text(angebot.gueltig, metaX + 28, 70)
  doc.text(angebot.status, metaX + 28, 77)

  // ── Einleitungstext ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(40, 40, 50)
  doc.text('wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen:', margin, 96)

  // ── Tabelle ─────────────────────────────────────────────────────────────
  const tableY = 104
  doc.setFillColor(32, 200, 255)
  doc.rect(margin, tableY, pageW - 2 * margin, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Pos.', margin + 3, tableY + 5.5)
  doc.text('Leistung / Bezeichnung', margin + 20, tableY + 5.5)
  doc.text('Betrag (netto)', pageW - margin - 3, tableY + 5.5, { align: 'right' })

  // Zeile 1
  const row1Y = tableY + 8
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, row1Y, pageW - 2 * margin, 10, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 50)
  doc.text('1', margin + 3, row1Y + 6.5)
  // Titel ggf. kürzen
  const titelText = angebot.titel.length > 60 ? angebot.titel.substring(0, 57) + '...' : angebot.titel
  doc.text(titelText, margin + 20, row1Y + 6.5)
  doc.text(angebot.betrag, pageW - margin - 3, row1Y + 6.5, { align: 'right' })

  // Zeile 2 (MwSt)
  const row2Y = row1Y + 10
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, row2Y, pageW - 2 * margin, 10, 'F')
  const betragNetto = parseFloat(angebot.betrag.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
  const mwstSatz = Number(company.standard_mwst ?? 19)
  const mwst = betragNetto * (mwstSatz / 100)
  const brutto = betragNetto + mwst
  const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  doc.setTextColor(80, 100, 120)
  doc.text(`Zzgl. ${mwstSatz}% MwSt.`, margin + 20, row2Y + 6.5)
  doc.text(fmtNum(mwst), pageW - margin - 3, row2Y + 6.5, { align: 'right' })

  // Gesamtbetrag
  const totalY = row2Y + 10
  doc.setFillColor(20, 30, 40)
  doc.rect(margin, totalY, pageW - 2 * margin, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...accent)
  doc.text('GESAMTBETRAG (brutto)', margin + 3, totalY + 8)
  doc.text(fmtNum(brutto), pageW - margin - 3, totalY + 8, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(200, 210, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, totalY + 18, pageW - margin, totalY + 18)

  // ── Gültigkeitshinweis ────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 100, 120)
  doc.text(`Dieses Angebot ist gültig bis zum ${angebot.gueltig}.`, margin, totalY + 26)
  doc.text('Wir freuen uns auf Ihren Auftrag!', margin, totalY + 34)

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.4)
  doc.line(margin, 272, pageW - margin, 272)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 140, 160)
  const footerParts = [
    company.dokument_footer || FALLBACK_COMPANY.dokument_footer,
    company.briefpapier_layout?.showWebsite !== false ? company.website : '',
    company.briefpapier_layout?.showUstId !== false ? company.ust_id : '',
    company.briefpapier_layout?.showSteuernummer !== false ? company.steuernummer : '',
  ].filter(Boolean)
  doc.text(footerParts.join('  ·  '), pageW / 2, 277, { align: 'center' })

  doc.save(`Angebot_${angebot.id}.pdf`)
}
