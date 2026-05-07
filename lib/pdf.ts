// lib/pdf.ts – PDF-Generierung mit jsPDF (dynamic import für Next.js SSR-Kompatibilität)

export type PDFRechnung = {
  id: string
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

function heuteFormatiert(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function generateRechnungPDF(rechnung: PDFRechnung, kundenName: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210
  const margin = 20

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 120, 140)
  doc.text('PETERSEN KI BETRIEBSSTEUERUNG', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Datum: ${heuteFormatiert()}`, pageW - margin, 16, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(32, 200, 255)
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
  doc.text(`Rechnungsnummer: ${rechnung.id}`, margin, 48)

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
  doc.text('wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:', margin, 96)

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
  doc.text('Erbrachte Leistungen gemäß Auftrag', margin + 20, row1Y + 6.5)
  doc.text(rechnung.betrag, pageW - margin - 3, row1Y + 6.5, { align: 'right' })

  // Zeile 2 (MwSt)
  const row2Y = row1Y + 10
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, row2Y, pageW - 2 * margin, 10, 'F')
  const betragNetto = parseFloat(rechnung.betrag.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
  const mwst = betragNetto * 0.19
  const brutto = betragNetto + mwst
  const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  doc.setTextColor(80, 100, 120)
  doc.text('', margin + 3, row2Y + 6.5)
  doc.text('Zzgl. 19% MwSt.', margin + 20, row2Y + 6.5)
  doc.text(fmtNum(mwst), pageW - margin - 3, row2Y + 6.5, { align: 'right' })

  // Gesamtbetrag
  const totalY = row2Y + 10
  doc.setFillColor(20, 30, 40)
  doc.rect(margin, totalY, pageW - 2 * margin, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(32, 200, 255)
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
  doc.text(`Bitte überweisen Sie den Gesamtbetrag bis zum ${rechnung.faellig} auf unser Konto.`, margin, totalY + 26)
  doc.text('Vielen Dank für Ihren Auftrag!', margin, totalY + 34)

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setDrawColor(32, 200, 255)
  doc.setLineWidth(0.4)
  doc.line(margin, 272, pageW - margin, 272)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 140, 160)
  doc.text('Vielen Dank für Ihr Vertrauen  ·  petersen-ki-pilot.de', pageW / 2, 277, { align: 'center' })

  doc.save(`Rechnung_${rechnung.id}.pdf`)
}

export async function generateAngebotPDF(angebot: PDFAngebot, kundenName: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210
  const margin = 20

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 120, 140)
  doc.text('PETERSEN KI BETRIEBSSTEUERUNG', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Datum: ${heuteFormatiert()}`, pageW - margin, 16, { align: 'right' })

  // Trennlinie
  doc.setDrawColor(32, 200, 255)
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
  const mwst = betragNetto * 0.19
  const brutto = betragNetto + mwst
  const fmtNum = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  doc.setTextColor(80, 100, 120)
  doc.text('Zzgl. 19% MwSt.', margin + 20, row2Y + 6.5)
  doc.text(fmtNum(mwst), pageW - margin - 3, row2Y + 6.5, { align: 'right' })

  // Gesamtbetrag
  const totalY = row2Y + 10
  doc.setFillColor(20, 30, 40)
  doc.rect(margin, totalY, pageW - 2 * margin, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(32, 200, 255)
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
  doc.setDrawColor(32, 200, 255)
  doc.setLineWidth(0.4)
  doc.line(margin, 272, pageW - margin, 272)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 140, 160)
  doc.text('Vielen Dank für Ihr Vertrauen  ·  petersen-ki-pilot.de', pageW / 2, 277, { align: 'center' })

  doc.save(`Angebot_${angebot.id}.pdf`)
}
