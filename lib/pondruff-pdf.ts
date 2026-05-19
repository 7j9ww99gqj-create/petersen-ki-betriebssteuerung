// Pondruff PDF-Generator. Eigenständig, nutzt das Briefpapier-PNG als Hintergrund
// und schreibt den Inhalt in Rot/Schwarz darüber. Wird sowohl im Pondruff-Modul
// als auch im BüroPilot (für Pondruff-User) verwendet.

import type { PDFPosition, PDFRechnung, PDFAngebot, PDFAuftragsbestaetigung } from './pdf'
import { isPondruffUser } from './pondruff'
import { createSupabaseClient } from './supabase'

// Prüft den aktuell eingeloggten User. Wenn Pondruff → Pondruff-PDF, sonst Standard.
async function isCurrentPondruff(): Promise<boolean> {
  try {
    const { data: { user } } = await createSupabaseClient().auth.getUser()
    return isPondruffUser(user?.email)
  } catch { return false }
}

export async function generateRechnungPDFAuto(rechnung: PDFRechnung, kundenName: string) {
  if (await isCurrentPondruff()) return generatePondruffRechnungPDF(rechnung, kundenName)
  const { generateRechnungPDF } = await import('./pdf')
  return generateRechnungPDF(rechnung, kundenName)
}

export async function generateAuftragsbestaetigungPDFAuto(auftrag: PDFAuftragsbestaetigung, kundenName: string) {
  if (await isCurrentPondruff()) return generatePondruffAuftragsbestaetigungPDF(auftrag, kundenName)
  const { generateAuftragsbestaetigungPDF } = await import('./pdf')
  return generateAuftragsbestaetigungPDF(auftrag, kundenName)
}

export async function generateAngebotPDFAuto(angebot: PDFAngebot, kundenName: string) {
  if (await isCurrentPondruff()) return generatePondruffAngebotPDF(angebot, kundenName)
  const { generateAngebotPDF } = await import('./pdf')
  return generateAngebotPDF(angebot, kundenName)
}

const POND_RED: [number, number, number] = [229, 9, 9]
const POND_DARK: [number, number, number] = [20, 20, 20]
const POND_GREY: [number, number, number] = [85, 85, 85]
const POND_LIGHT: [number, number, number] = [240, 240, 240]
const POND_BRIEFPAPIER = '/pondruff/briefpapier.png'

// Lade Briefpapier-PNG als DataURL (Browser-Kontext)
async function loadBriefpapier(): Promise<string | null> {
  try {
    const r = await fetch(POND_BRIEFPAPIER)
    if (!r.ok) return null
    const blob = await r.blob()
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = rej
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

function de(n: number) { return n.toFixed(2).replace('.', ',') }

function parseMoney(s: string | number | undefined): number {
  if (typeof s === 'number') return s
  if (!s) return 0
  const cleaned = String(s).replace(/[^\d,\.\-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

type DocLike = {
  setFillColor: (r: number, g: number, b: number) => void
  setTextColor: (r: number, g: number, b: number) => void
  setDrawColor: (r: number, g: number, b: number) => void
  setLineWidth: (w: number) => void
  setFont: (family: string, style?: string) => void
  setFontSize: (sz: number) => void
  text: (text: string | string[], x: number, y: number, opts?: { align?: string }) => void
  rect: (x: number, y: number, w: number, h: number, style?: string) => void
  line: (x1: number, y1: number, x2: number, y2: number) => void
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void
  addPage: () => void
  setPage: (n: number) => void
  getNumberOfPages: () => number
  getTextWidth: (s: string) => number
  splitTextToSize: (s: string, w: number) => string[]
  save: (name: string) => void
  output: (type: string) => string
}

interface ContentBlock {
  docType: 'RECHNUNG' | 'AUFTRAGSBESTÄTIGUNG' | 'ANGEBOT'
  docNummer: string
  kundenName: string
  introText: string
  metaRows: [string, string][]
  positionen: PDFPosition[]
  nettoVal: number
  mwstSatz: number
  steuerVal: number
  bruttoVal: number
  summenLabel: string
}

// Zeichnet alle Inhalte ohne Header/Footer. Briefpapier-PNG ist der Hintergrund.
function drawPondruffContent(doc: DocLike, c: ContentBlock) {
  const pageW = 210
  const margin = 20
  const rightEdge = 190
  // Briefpapier-Header reicht bis ca. 50mm, Footer beginnt bei ca. 245mm
  const topY = 70
  const bottomY = 240
  let y = topY

  // Info-Box rechts oben
  const boxW = 70, boxX = pageW - 12 - boxW
  const rowH = 7
  const boxH = c.metaRows.length * rowH + 10
  const boxStartY = topY - 12

  doc.setFillColor(...POND_LIGHT)
  doc.rect(boxX, boxStartY, boxW, boxH, 'F')
  doc.setDrawColor(...POND_RED)
  doc.setLineWidth(0.6)
  doc.rect(boxX, boxStartY, boxW, boxH, 'S')

  c.metaRows.forEach(([label, value], i) => {
    const rowY = boxStartY + 7 + i * rowH
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...POND_GREY)
    doc.text(label, boxX + 5, rowY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...POND_DARK)
    doc.text(value, boxX + boxW - 5, rowY, { align: 'right' })
  })

  // Titel
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...POND_RED)
  doc.text(c.docType, margin, y)
  const tw = doc.getTextWidth(c.docType)
  doc.setFillColor(...POND_RED)
  doc.rect(margin, y + 3, Math.min(tw, 100), 1.2, 'F')

  y = Math.max(y + 16, boxStartY + boxH + 8)

  // Kunde
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...POND_DARK)
  doc.text(c.kundenName, margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...POND_DARK)
  doc.text('Sehr geehrte Damen und Herren,', margin, y)
  y += 6

  const introLines = doc.splitTextToSize(c.introText, rightEdge - margin)
  doc.setTextColor(...POND_GREY)
  doc.text(introLines, margin, y)
  y += introLines.length * 5 + 8

  // Tabelle
  const tableW = rightEdge - margin
  const colPosW = 11
  const colMengeW = 16
  const colPreisW = 26
  const colSumW = 28
  const colDescX = margin + colPosW
  const colMengeX = rightEdge - colSumW - colPreisW - colMengeW
  const colPreisX = rightEdge - colSumW - colPreisW
  const colSumX = rightEdge

  // Header-Zeile schwarz mit rotem Akzent
  doc.setFillColor(...POND_DARK)
  doc.rect(margin, y, tableW, 9, 'F')
  doc.setFillColor(...POND_RED)
  doc.rect(margin, y, 3, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Pos.', margin + 4, y + 6)
  doc.text('Beschreibung', colDescX, y + 6)
  doc.text('Menge', colMengeX + colMengeW - 1, y + 6, { align: 'right' })
  doc.text('Einzelpreis', colPreisX + colPreisW - 1, y + 6, { align: 'right' })
  doc.text('Gesamt', colSumX - 1, y + 6, { align: 'right' })
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  c.positionen.forEach((p, i) => {
    if (y > bottomY - 30) {
      // Neue Seite
      doc.addPage()
      y = topY
    }
    const lines = doc.splitTextToSize(p.beschreibung || '', colPreisX - colDescX - 4)
    const rowH = Math.max(7, lines.length * 4.5 + 2)
    doc.setFillColor(i % 2 === 0 ? 252 : 246, i % 2 === 0 ? 252 : 246, 252)
    doc.rect(margin, y, tableW, rowH, 'F')
    doc.setTextColor(...POND_DARK)
    doc.text(String(i + 1).padStart(2, '0'), margin + 4, y + 5)
    doc.text(lines, colDescX, y + 5)
    doc.text(String(p.menge), colMengeX + colMengeW - 1, y + 5, { align: 'right' })
    doc.text(de(p.einzelpreis) + ' €', colPreisX + colPreisW - 1, y + 5, { align: 'right' })
    doc.text(de(p.menge * p.einzelpreis) + ' €', colSumX - 1, y + 5, { align: 'right' })
    y += rowH
  })

  // Strich
  doc.setDrawColor(...POND_RED)
  doc.setLineWidth(0.4)
  doc.line(margin, y + 1, rightEdge, y + 1)
  y += 6

  // Summenblock
  const sumX = rightEdge - 70
  const sumValX = rightEdge
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...POND_DARK)
  doc.text(`Netto`, sumX, y)
  doc.text(de(c.nettoVal) + ' €', sumValX, y, { align: 'right' })
  y += 5
  doc.text(`MwSt. ${c.mwstSatz}%`, sumX, y)
  doc.text(de(c.steuerVal) + ' €', sumValX, y, { align: 'right' })
  y += 5
  // Brutto-Zeile rot hervorgehoben
  doc.setFillColor(...POND_RED)
  doc.rect(sumX - 4, y - 4, 78, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(c.summenLabel, sumX, y + 2)
  doc.text(de(c.bruttoVal) + ' €', sumValX, y + 2, { align: 'right' })
  y += 14

  // Schlusstext
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...POND_DARK)
  const closing = c.docType === 'RECHNUNG'
    ? 'Wir bitten um Begleichung des Rechnungsbetrags innerhalb der vereinbarten Zahlungsfrist.\nVielen Dank für das Vertrauen in Pondruff Polier- & Beschichtungsservice.'
    : c.docType === 'AUFTRAGSBESTÄTIGUNG'
    ? 'Wir bestätigen hiermit den oben genannten Auftrag und beginnen mit der Bearbeitung.\nVielen Dank für Ihren Auftrag.'
    : 'Über Ihren Auftrag würden wir uns sehr freuen.\nMit freundlichen Grüßen — Pondruff Polier- & Beschichtungsservice'
  const closingLines = doc.splitTextToSize(closing, rightEdge - margin)
  doc.text(closingLines, margin, y)
}

async function buildPdf(c: ContentBlock, filename: string, returnBase64?: boolean): Promise<string | void> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' }) as unknown as DocLike

  // Briefpapier als ganzseitiges Hintergrundbild
  const briefpapier = await loadBriefpapier()
  if (briefpapier) {
    doc.addImage(briefpapier, 'PNG', 0, 0, 210, 297)
  } else {
    // Fallback: einfacher roter Streifen oben/unten
    doc.setFillColor(...POND_DARK)
    doc.rect(0, 0, 210, 8, 'F')
    doc.setFillColor(...POND_RED)
    doc.rect(0, 8, 210, 1.5, 'F')
    doc.setFillColor(...POND_DARK)
    doc.rect(0, 287, 210, 10, 'F')
  }

  drawPondruffContent(doc, c)

  // Auch auf späteren Seiten Briefpapier-Hintergrund
  const pageCount = doc.getNumberOfPages()
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)
    if (briefpapier) doc.addImage(briefpapier, 'PNG', 0, 0, 210, 297)
  }

  if (returnBase64) return doc.output('datauristring')
  doc.save(filename)
}

export async function generatePondruffRechnungPDF(rechnung: PDFRechnung, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const positionen = rechnung.positionen || []
  const netto = typeof rechnung.netto === 'number' ? rechnung.netto : positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0)
  const satz = typeof rechnung.steuer_satz === 'number' ? rechnung.steuer_satz : 19
  const steuer = typeof rechnung.steuerbetrag === 'number' ? rechnung.steuerbetrag : Math.round(netto * satz) / 100
  const brutto = typeof rechnung.summe === 'number' ? rechnung.summe : netto + steuer
  return buildPdf({
    docType: 'RECHNUNG',
    docNummer: rechnung.nummer || rechnung.id,
    kundenName,
    introText: 'für die erbrachten Beschichtungs-Leistungen stellen wir Ihnen folgende Positionen in Rechnung:',
    metaRows: [
      ['Rechnung-Nr.', rechnung.nummer || rechnung.id],
      ['Datum', rechnung.erstellt],
      ['Fällig', rechnung.faellig || ''],
      ...(rechnung.internalReference ? [['Ihre Ref.', rechnung.internalReference] as [string, string]] : []),
    ],
    positionen,
    nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
    summenLabel: 'Rechnungsbetrag brutto',
  }, `Rechnung_${rechnung.nummer || rechnung.id}_Pondruff.pdf`, returnBase64)
}

export async function generatePondruffAuftragsbestaetigungPDF(auftrag: PDFAuftragsbestaetigung, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const positionen = auftrag.positionen || []
  const netto = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0) || parseMoney(auftrag.wert) / 1.19
  const satz = 19
  const steuer = Math.round(netto * satz) / 100
  const brutto = netto + steuer
  return buildPdf({
    docType: 'AUFTRAGSBESTÄTIGUNG',
    docNummer: auftrag.ab_nummer || auftrag.id,
    kundenName,
    introText: auftrag.beschreibung || 'wir bestätigen hiermit den folgenden Auftrag:',
    metaRows: [
      ['AB-Nr.', auftrag.ab_nummer || auftrag.id],
      ['Datum', auftrag.ab_verschickt_am || new Date().toLocaleDateString('de-DE')],
      ['Start', auftrag.start || '—'],
      ['Ende', auftrag.ende || '—'],
    ],
    positionen,
    nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
    summenLabel: 'Auftragssumme brutto',
  }, `Auftragsbestaetigung_${auftrag.ab_nummer || auftrag.id}_Pondruff.pdf`, returnBase64)
}

export async function generatePondruffAngebotPDF(angebot: PDFAngebot, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const positionen = angebot.positionen || []
  const netto = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0) || parseMoney(angebot.betrag) / 1.19
  const satz = 19
  const steuer = Math.round(netto * satz) / 100
  const brutto = netto + steuer
  return buildPdf({
    docType: 'ANGEBOT',
    docNummer: angebot.id,
    kundenName,
    introText: 'wir danken für Ihre Anfrage und unterbreiten Ihnen folgendes Angebot:',
    metaRows: [
      ['Angebot-Nr.', angebot.id],
      ['Datum', angebot.datum],
      ['Gültig bis', angebot.gueltig || ''],
    ],
    positionen,
    nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
    summenLabel: 'Angebotssumme brutto',
  }, `Angebot_${angebot.id}_Pondruff.pdf`, returnBase64)
}

// Generischer Helfer für Pondruff-eigene Aufträge aus pondruff_preisauftraege:
// nimmt die rows-Struktur (WisoOrderRow) und baut direkt eine Rechnung / AB.
export type PondPreisauftrag = {
  order_id: string | null
  customer: string | null
  project: string | null
  purchase_order: string | null
  total: number | null
  rows: { 'Pos.': string; Menge: number; 'Artikel-Nr.': string; Beschreibung: string; Listenpreis: string; 'Rabatt (%)': string; Einzelpreis: string; Gesamtpreis: string }[]
  status: string | null
  invoice_no: string | null
  invoice_date: string | null
  created_at: string
  confirmed_at: string | null
}

export async function generatePondruffOrderPDF(o: PondPreisauftrag, returnBase64?: boolean): Promise<string | void> {
  const positionen: PDFPosition[] = (o.rows || []).map(r => ({
    id: r['Pos.'],
    beschreibung: r.Beschreibung,
    menge: Number(r.Menge) || 1,
    einheit: 'Stk.',
    einzelpreis: parseMoney(r.Einzelpreis),
  }))
  const netto = parseMoney(String(o.total || ''))
  const satz = 19
  const steuer = Math.round(netto * satz) / 100
  const brutto = netto + steuer

  if (o.status === 'rechnung' && o.invoice_no) {
    return buildPdf({
      docType: 'RECHNUNG',
      docNummer: o.invoice_no,
      kundenName: o.customer || '—',
      introText: `für den Auftrag ${o.order_id || ''}${o.purchase_order ? ` (Ihre Bestell-Nr. ${o.purchase_order})` : ''} stellen wir Ihnen folgende Leistungen in Rechnung:`,
      metaRows: [
        ['Rechnung-Nr.', o.invoice_no],
        ['Datum', o.invoice_date || new Date().toLocaleDateString('de-DE')],
        ['Auftrag', o.order_id || ''],
        ...(o.purchase_order ? [['Bestell-Nr.', o.purchase_order] as [string, string]] : []),
      ],
      positionen, nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
      summenLabel: 'Rechnungsbetrag brutto',
    }, `Rechnung_${o.invoice_no}_Pondruff.pdf`, returnBase64)
  }

  if (o.status === 'auftragsbestaetigung') {
    return buildPdf({
      docType: 'AUFTRAGSBESTÄTIGUNG',
      docNummer: o.order_id || '',
      kundenName: o.customer || '—',
      introText: `wir bestätigen hiermit den folgenden Auftrag${o.purchase_order ? ` zu Ihrer Bestell-Nr. ${o.purchase_order}` : ''}.`,
      metaRows: [
        ['AB-Nr.', o.order_id || ''],
        ['Datum', o.confirmed_at ? new Date(o.confirmed_at).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')],
        ...(o.purchase_order ? [['Bestell-Nr.', o.purchase_order] as [string, string]] : []),
      ],
      positionen, nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
      summenLabel: 'Auftragssumme brutto',
    }, `Auftragsbestaetigung_${o.order_id || 'pondruff'}.pdf`, returnBase64)
  }

  return buildPdf({
    docType: 'ANGEBOT',
    docNummer: o.order_id || '',
    kundenName: o.customer || '—',
    introText: 'wir danken für Ihre Anfrage und unterbreiten Ihnen folgendes Angebot:',
    metaRows: [
      ['Angebot-Nr.', o.order_id || ''],
      ['Datum', new Date(o.created_at).toLocaleDateString('de-DE')],
      ...(o.purchase_order ? [['Bestell-Nr.', o.purchase_order] as [string, string]] : []),
    ],
    positionen, nettoVal: netto, mwstSatz: satz, steuerVal: steuer, bruttoVal: brutto,
    summenLabel: 'Angebotssumme brutto',
  }, `Angebot_${o.order_id || 'pondruff'}.pdf`, returnBase64)
}
