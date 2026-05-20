// Pondruff PDF-Generator. Eigenständig, nutzt das Briefpapier-PNG als Hintergrund
// und schreibt den Inhalt in Rot/Schwarz darüber. Wird sowohl im Pondruff-Modul
// als auch im BüroPilot (für Pondruff-User) verwendet.

import type { PDFPosition, PDFRechnung, PDFAngebot, PDFAuftragsbestaetigung } from './pdf'
import { isPondruffUser } from './pondruff'
import { createSupabaseClient } from './supabase'

// Fallback: parsed Multi-Line-Beschreibungen im Format
//   "01. NAME (Nx PREIS €)"
// die der alte sync-Code (vor 2026-05-19) als beschreibung statt positionen
// abgelegt hat. Wenn positionen leer aber beschreibung dieses Muster hat,
// rekonstruieren wir die Positionen, damit die PDF-Tabelle nicht leer bleibt.
export function parseLegacyBeschreibungPositionen(beschreibung: string | null | undefined): PDFPosition[] {
  if (!beschreibung) return []
  const lines = beschreibung.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const re = /^(\d{1,3})[\.\)]\s*(.+?)\s*\((\d+)\s*x\s*([0-9.,]+)\s*€?\)\s*$/i
  const positionen: PDFPosition[] = []
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    const idx = m[1]
    const desc = m[2].trim()
    const menge = Number(m[3]) || 1
    const preisStr = m[4].replace(/\./g, '').replace(',', '.')
    const einzelpreis = Number.parseFloat(preisStr) || 0
    positionen.push({
      id: `L-P${idx.padStart(2, '0')}`,
      beschreibung: desc,
      menge,
      einheit: 'Stk',
      einzelpreis,
    })
  }
  return positionen
}

// Prüft den aktuell eingeloggten User. Wenn Pondruff → Pondruff-PDF, sonst Standard.
async function isCurrentPondruff(): Promise<boolean> {
  try {
    const { data: { user } } = await createSupabaseClient().auth.getUser()
    return isPondruffUser(user?.email)
  } catch { return false }
}

export async function generateRechnungPDFAuto(rechnung: PDFRechnung, kundenName: string, opts?: { archive?: boolean }) {
  const isPond = await isCurrentPondruff()
  // Archiv-Modus: PDF als Base64 generieren, in Storage uploaden, anschließend Download triggern
  if (opts?.archive) {
    const base64 = isPond
      ? await generatePondruffRechnungPDF(rechnung, kundenName, true) as string
      : await (await import('./pdf')).generateRechnungPDF(rechnung, kundenName, true) as string
    if (base64) {
      try {
        const { archiveRechnungPdf } = await import('./db')
        await archiveRechnungPdf({ rechnungId: rechnung.id, rechnungNummer: rechnung.nummer, pdfBase64: base64 })
      } catch (e) { console.warn('PDF-Archivierung fehlgeschlagen', e) }
      triggerDownloadFromBase64(base64, `Rechnung_${rechnung.nummer || rechnung.id}.pdf`)
    }
    return
  }
  if (isPond) return generatePondruffRechnungPDF(rechnung, kundenName)
  const { generateRechnungPDF } = await import('./pdf')
  return generateRechnungPDF(rechnung, kundenName)
}

export async function generateAuftragsbestaetigungPDFAuto(auftrag: PDFAuftragsbestaetigung, kundenName: string) {
  if (await isCurrentPondruff()) return generatePondruffAuftragsbestaetigungPDF(auftrag, kundenName)
  const { generateAuftragsbestaetigungPDF } = await import('./pdf')
  return generateAuftragsbestaetigungPDF(auftrag, kundenName)
}

export async function generateAngebotPDFAuto(angebot: PDFAngebot, kundenName: string, opts?: { archive?: boolean }) {
  const isPond = await isCurrentPondruff()
  if (opts?.archive) {
    const base64 = isPond
      ? await generatePondruffAngebotPDF(angebot, kundenName, true) as string
      : await (await import('./pdf')).generateAngebotPDF(angebot, kundenName, true) as string
    if (base64) {
      try {
        const { archiveAngebotPdf } = await import('./db')
        await archiveAngebotPdf({ angebotId: angebot.id, angebotNummer: (angebot as { nummer?: string }).nummer, pdfBase64: base64 })
      } catch (e) { console.warn('PDF-Archivierung fehlgeschlagen', e) }
      triggerDownloadFromBase64(base64, `Angebot_${(angebot as { nummer?: string }).nummer || angebot.id}.pdf`)
    }
    return
  }
  if (isPond) return generatePondruffAngebotPDF(angebot, kundenName)
  const { generateAngebotPDF } = await import('./pdf')
  return generateAngebotPDF(angebot, kundenName)
}

function triggerDownloadFromBase64(base64: string, filename: string) {
  if (typeof window === 'undefined') return
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
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

async function loadImage(path: string): Promise<string | null> {
  try {
    const r = await fetch(path)
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
    ? 'Vielen Dank für Ihren Auftrag.'
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

  // Wichtig: doc.output('datauristring') liefert "data:application/pdf;base64,XXX".
  // Aufrufer (archiveRechnungPdf, triggerDownloadFromBase64) erwarten reines Base64
  // ohne Prefix — wie bei lib/pdf.ts. Den Prefix abschneiden, sonst wirft atob()
  // DOMException und das archivierte PDF ist kaputt (leere Seite / 404 beim Öffnen).
  if (returnBase64) return doc.output('datauristring').split(',')[1] || ''
  doc.save(filename)
}

export async function generatePondruffRechnungPDF(rechnung: PDFRechnung, kundenName: string, returnBase64?: boolean): Promise<string | void> {
  const raw = rechnung.positionen || []
  const positionen = raw.length > 0
    ? raw
    : parseLegacyBeschreibungPositionen((rechnung as { beschreibung?: string }).beschreibung)
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
  const raw = auftrag.positionen || []
  const positionen = raw.length > 0 ? raw : parseLegacyBeschreibungPositionen(auftrag.beschreibung)
  const netto = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0) || parseMoney(auftrag.wert) / 1.19
  const satz = 19
  const steuer = Math.round(netto * satz) / 100
  const brutto = netto + steuer
  return buildPdf({
    docType: 'AUFTRAGSBESTÄTIGUNG',
    docNummer: auftrag.ab_nummer || auftrag.id,
    kundenName,
    introText: 'wir bestätigen hiermit den oben genannten Auftrag und beginnen mit der Bearbeitung.',
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
  const positionen: PDFPosition[] = (o.rows || []).map(r => {
    const artNr = r['Artikel-Nr.']
    const desc = artNr ? `Art.-Nr.: ${artNr}\n${r.Beschreibung}` : r.Beschreibung
    return {
      id: r['Pos.'],
      beschreibung: desc,
      menge: Number(r.Menge) || 1,
      einheit: 'Stk.',
      einzelpreis: parseMoney(r.Einzelpreis),
    }
  })
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
      introText: `wir bestätigen hiermit den oben genannten Auftrag${o.purchase_order ? ` zu Ihrer Bestell-Nr. ${o.purchase_order}` : ''} und beginnen mit der Bearbeitung.`,
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

// ─── ARBEITSKARTE ─────────────────────────────────────────────────────────────

export type ArbeitskartePosition = {
  position_nr: number
  artikelnummer?: string
  menge: string
  artikelbezeichnung: string
  form: string
  laenge?: string
  breite?: string
  hoehe?: string
  durchmesser?: string
  durchmesser_laenge?: string
  raw_dimension_text?: string
  weitere_infos?: { key: string; value: string }[]
  polieren?: string
  polieren_wo?: string
  polier_kosten?: string
  entschichtung?: string
  microstrahlen?: string
  laeppstrahlen?: string
  polierstrahlen?: string
  beschichtung?: string
}

export type ArbeitskarteData = {
  id: string
  customer: string | null
  purchase_order: string | null
  delivery_id: string | null
  lieferbedingungen: string | null
  eingelagert_am: string | null
  eingelagert_von: string | null
  positionen: ArbeitskartePosition[] | null
}

const BANNER_PATH = '/pondruff/banner.png'
const BANNER_W_PX = 1152
const BANNER_H_PX = 317
const A5_W = 210
const A5_H = 148
const HEADER_H = 22
const BANNER_DISPLAY_H = HEADER_H
const BANNER_DISPLAY_W = BANNER_DISPLAY_H * (BANNER_W_PX / BANNER_H_PX)
const MARGIN = 8
const CONTENT_W = A5_W - MARGIN * 2

function drawArbeitskartePage(doc: DocLike, banner: string | null) {
  doc.setFillColor(20, 20, 20)
  doc.rect(0, 0, A5_W, HEADER_H, 'F')
  if (banner) {
    doc.addImage(banner, 'PNG', 0, 0, BANNER_DISPLAY_W, BANNER_DISPLAY_H)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(229, 9, 9)
  doc.text('ARBEITSKARTE', A5_W - MARGIN, 14, { align: 'right' })
  doc.setDrawColor(229, 9, 9)
  doc.setLineWidth(0.8)
  doc.line(0, HEADER_H, A5_W, HEADER_H)
  doc.setLineWidth(0.3)
  doc.setDrawColor(60, 60, 60)
}

// ─── Kompakter Meta-Label (1 Zeile, mehrere Spalten) ────────────────────
function drawCompactMeta(doc: DocLike, label: string, value: string, x: number, y: number, colW: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(20, 20, 20)
  const lines = doc.splitTextToSize(value || '—', colW - 1)
  doc.text(lines[0] || '—', x, y + 3.5)
}

// ─── Mini-Checkbox für die kompakten Positions-Zellen ───────────────────
function drawMiniCheck(doc: DocLike, checked: boolean, label: string, x: number, y: number, maxW: number) {
  const bx = x, by = y - 2.4, bsize = 2.8
  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.25)
  doc.rect(bx, by, bsize, bsize)
  if (checked) {
    doc.setDrawColor(229, 9, 9)
    doc.setLineWidth(0.55)
    doc.line(bx + 0.35, by + 1.4, bx + 1.1, by + bsize - 0.3)
    doc.line(bx + 1.1, by + bsize - 0.3, bx + bsize - 0.2, by + 0.35)
  }
  doc.setFont('helvetica', checked ? 'bold' : 'normal')
  doc.setFontSize(7)
  doc.setTextColor(checked ? 20 : 100, checked ? 20 : 100, checked ? 20 : 100)
  const labelLines = doc.splitTextToSize(label, Math.max(8, maxW - bsize - 2))
  doc.text(labelLines[0] || label, bx + bsize + 1.2, y)
}

// ─── Positions-Zelle: 2 Spalten Services nach User-Wunsch ────────────────
// Header: Pos.X | Menge × Artikelbezeichnung [Beschichtung rechts]
// Maße:   Maße: 50×30×15mm
// LEFT:   Polieren / Läppstrahlen / Wo polieren / Zusatzinfos
// RIGHT:  Entschichtung / Polierstrahlen / Microstrahlen
function drawPositionCell(doc: DocLike, p: ArbeitskartePosition, x: number, y: number, w: number, h: number) {
  // Zellen-Rahmen
  doc.setDrawColor(215, 215, 215)
  doc.setLineWidth(0.3)
  doc.rect(x, y, w, h)

  // Header-Leiste
  doc.setFillColor(236, 236, 236)
  doc.rect(x, y, w, 5.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(229, 9, 9)
  doc.text(`Pos. ${p.position_nr}`, x + 1.5, y + 4)

  // Beschichtung rechts-aligned im Header
  const beschichtung = p.beschichtung && p.beschichtung !== 'Keine' ? p.beschichtung : 'Keine'
  const isCoated = beschichtung !== 'Keine'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  if (isCoated) doc.setTextColor(229, 9, 9)
  else doc.setTextColor(140, 140, 140)
  doc.text(beschichtung, x + w - 1.5, y + 4, { align: 'right' })
  const beschichtungW = doc.getTextWidth(beschichtung) + 2

  // Menge × Artikelbezeichnung (zwischen Pos und Beschichtung)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.8)
  doc.setTextColor(20, 20, 20)
  const nameStr = `${p.menge ? p.menge + '× ' : ''}${p.artikelbezeichnung || '—'}`
  const nameMaxW = w - 13 - beschichtungW - 2
  const nameLines = doc.splitTextToSize(nameStr, Math.max(20, nameMaxW))
  doc.text(nameLines[0] || '', x + 11, y + 4)

  // Artikelnummer (wenn gesetzt) und Maße
  let cy = y + 8
  if (p.artikelnummer) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(40, 40, 40)
    const artLines = doc.splitTextToSize(`Art.-Nr.: ${p.artikelnummer}`, w - 3)
    doc.text(artLines[0] || '', x + 1.5, cy)
    cy += 3.2
  }
  const masse = p.form === 'Rund'
    ? `Ø${p.durchmesser || '?'}×${p.durchmesser_laenge || '?'}mm`
    : `${p.laenge || '?'}×${p.breite || '?'}×${p.hoehe || '?'}mm`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  doc.text(`Maße: ${masse}`, x + 1.5, cy)
  cy += 3.5

  // Services in 2 Spalten — Layout nach User-Wunsch
  const colWInner = (w - 4) / 2
  const leftX = x + 1.5
  const rightX = x + 1.5 + colWInner + 2
  const lineH = 3.3

  // LEFT COLUMN
  // Zeile 1: Polieren
  drawMiniCheck(doc, p.polieren === 'Ja', 'Polieren', leftX, cy, colWInner - 1)
  // Zeile 2: Läppstrahlen
  drawMiniCheck(doc, p.laeppstrahlen === 'Ja', 'Läppstrahlen', leftX, cy + lineH, colWInner - 1)
  // Zeile 3: Wo polieren (nur wenn polieren=Ja und polieren_wo gesetzt)
  if (p.polieren === 'Ja' && p.polieren_wo) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(90, 90, 90)
    const polLines = doc.splitTextToSize(`Wo polieren: ${p.polieren_wo}`, colWInner - 1)
    doc.text(polLines[0] || '', leftX, cy + 2 * lineH)
  }
  // Zeile 4: Zusatzinfos — nur wenn innerhalb der Zelle Platz ist
  const zusatzY = cy + 3 * lineH
  if (Array.isArray(p.weitere_infos) && p.weitere_infos.length > 0 && zusatzY < y + h - 0.5) {
    const wiText = p.weitere_infos.filter(w => w.key).map(w => `${w.key}: ${w.value}`).join(' · ')
    if (wiText) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.3)
      doc.setTextColor(110, 110, 110)
      const wiLines = doc.splitTextToSize(wiText, colWInner - 1)
      doc.text(wiLines[0] || '', leftX, zusatzY)
    }
  }

  // RIGHT COLUMN
  // Zeile 1: Entschichtung
  drawMiniCheck(doc, p.entschichtung === 'Ja', 'Entschichtung', rightX, cy, colWInner - 1)
  // Zeile 2: Polierstrahlen
  drawMiniCheck(doc, p.polierstrahlen === 'Ja', 'Polierstrahlen', rightX, cy + lineH, colWInner - 1)
  // Zeile 3: Microstrahlen
  drawMiniCheck(doc, p.microstrahlen === 'Ja', 'Microstrahlen', rightX, cy + 2 * lineH, colWInner - 1)
}

// ─── Kompakter Meta-Header (1 Zeile, 5 Spalten) ─────────────────────────
function drawCompactMetaBlock(doc: DocLike, we: ArbeitskarteData, dateStr: string) {
  const y = HEADER_H + 4
  const col5W = CONTENT_W / 5
  drawCompactMeta(doc, 'Kunde', we.customer || '—', MARGIN, y, col5W)
  drawCompactMeta(doc, 'Bestell-Nr.', we.purchase_order || we.delivery_id || '—', MARGIN + col5W, y, col5W)
  drawCompactMeta(doc, 'Eingelagert am', dateStr, MARGIN + col5W * 2, y, col5W)
  drawCompactMeta(doc, 'Lieferbedingungen', we.lieferbedingungen || '—', MARGIN + col5W * 3, y, col5W)
  drawCompactMeta(doc, 'Eingelagert von', we.eingelagert_von || '—', MARGIN + col5W * 4, y, col5W)
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y + 7, A5_W - MARGIN, y + 7)
}

// ─── Bottom-Section: Versandfertig + großes Notizfeld ───────────────────
function drawVersandUndNotizen(doc: DocLike, y: number) {
  // Trennlinie oben
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, A5_W - MARGIN, y)

  const sectionBottom = A5_H - 5
  const sectionH = sectionBottom - y
  const leftW = CONTENT_W * 0.42
  const gap = 4
  const rightX = MARGIN + leftW + gap
  const notizW = CONTENT_W - leftW - gap

  // LEFT: Versandfertig gepackt von
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  doc.text('Versandfertig gepackt von:', MARGIN, y + 5)

  // Signaturlinie
  doc.setDrawColor(120, 120, 120)
  doc.setLineWidth(0.35)
  const sigLineY = y + sectionH / 2 + 3
  doc.line(MARGIN, sigLineY, MARGIN + leftW - 2, sigLineY)

  // RIGHT: Notizen (großes Feld)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  doc.text('Notizen:', rightX, y + 5)

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.35)
  const notizBoxTop = y + 6.5
  const notizBoxH = sectionH - 8
  doc.rect(rightX, notizBoxTop, notizW, notizBoxH)
  // Innere horizontale Hilfslinien (handschriftliche Notizen leichter)
  doc.setDrawColor(225, 225, 225)
  doc.setLineWidth(0.2)
  const innerLines = Math.floor(notizBoxH / 5)
  for (let i = 1; i < innerLines; i++) {
    const ly = notizBoxTop + i * (notizBoxH / innerLines)
    doc.line(rightX + 1, ly, rightX + notizW - 1, ly)
  }
}

export async function generateArbeitskartePDF(we: ArbeitskarteData): Promise<void> {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' }) as unknown as DocLike

  const banner = await loadImage(BANNER_PATH)
  drawArbeitskartePage(doc, banner)

  const pos = Array.isArray(we.positionen) ? we.positionen : []
  const dateStr = we.eingelagert_am
    ? new Date(we.eingelagert_am).toLocaleDateString('de-DE')
    : new Date().toLocaleDateString('de-DE')

  drawCompactMetaBlock(doc, we, dateStr)

  // ── Positionen im 2×3 Grid (6 pro Seite, Pos 7 → neue Seite) ──────────
  const BOTTOM_H = 28                // Versand+Notizen-Bereich (etwas schlanker)
  const POS_PER_PAGE = 6
  const COLS = 2
  const ROWS = 3
  const GAP_X = 2                    // horizontaler Abstand zwischen Pos. 1 und 2
  const GAP_Y = 4                    // vertikaler Abstand zwischen Reihen — deutlich mehr Luft
  const POS_TOP = HEADER_H + 13            // = 35
  const POS_BOTTOM = A5_H - BOTTOM_H - 2   // = 118
  const cellW = (CONTENT_W - GAP_X * (COLS - 1)) / COLS
  const cellH = (POS_BOTTOM - POS_TOP - GAP_Y * (ROWS - 1)) / ROWS

  if (pos.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text('Keine Positionen erfasst.', MARGIN, POS_TOP + 10)
  }

  for (let i = 0; i < pos.length; i++) {
    const onPageIdx = i % POS_PER_PAGE
    const col = onPageIdx % COLS
    const row = Math.floor(onPageIdx / COLS)

    if (i > 0 && onPageIdx === 0) {
      doc.addPage()
      drawArbeitskartePage(doc, banner)
      drawCompactMetaBlock(doc, we, dateStr)
    }

    const cx = MARGIN + col * (cellW + GAP_X)
    const cy = POS_TOP + row * (cellH + GAP_Y)
    drawPositionCell(doc, pos[i], cx, cy, cellW, cellH)
  }

  // ── Versand + Notizen am unteren Rand jeder Seite ─────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg)
    // Versand+Notizen NUR auf der letzten Seite
    if (pg === pageCount) {
      drawVersandUndNotizen(doc, A5_H - BOTTOM_H)
    }
    // Footer auf allen Seiten
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text('Pondruff Polier- & Beschichtungsservice', MARGIN, A5_H - 2)
    doc.text(`Seite ${pg} / ${pageCount}`, A5_W - MARGIN, A5_H - 2, { align: 'right' })
  }

  const filename = `Arbeitskarte_${(we.customer || 'Pondruff').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${(we.purchase_order || we.delivery_id || we.id?.slice(0, 8) || 'WE').replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`
  doc.save(filename)
}
