// lib/qm-pdf.ts — QM-Prüfbericht PDF-Export
// Browser-only (jsPDF). Nie in API-Routen importieren.

import {
  ampelStatus,
  getQmFotos,
  getQmFotoSignedUrl,
  getQmMesswerte,
  getQmPruefbericht,
  getQmZeichnung,
} from './db/qm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any

const QM_RGB: [number, number, number] = [20, 184, 166]
const GRUEN_RGB: [number, number, number] = [16, 185, 129]
const ORANGE_RGB: [number, number, number] = [245, 158, 11]
const ROT_RGB: [number, number, number] = [239, 68, 68]
const GREY_RGB: [number, number, number] = [174, 185, 200]

function statusRgb(s: string): [number, number, number] {
  if (s === 'gruen')  return GRUEN_RGB
  if (s === 'orange') return ORANGE_RGB
  if (s === 'rot')    return ROT_RGB
  return GREY_RGB
}
function statusLabel(s: string): string {
  if (s === 'gruen')  return 'OK'
  if (s === 'orange') return 'Grenz'
  if (s === 'rot')    return 'Fehler'
  return 'offen'
}
function gsLabel(s: string | null): string {
  if (s === 'bestanden')    return 'BESTANDEN'
  if (s === 'nachbesserung') return 'NACHBESSERUNG'
  if (s === 'ausschuss')    return 'AUSSCHUSS'
  return 'OFFEN'
}
function gsRgb(s: string | null): [number, number, number] {
  if (s === 'bestanden')    return GRUEN_RGB
  if (s === 'nachbesserung') return ORANGE_RGB
  if (s === 'ausschuss')    return ROT_RGB
  return GREY_RGB
}
function fmtDate(iso?: string | null): string {
  if (!iso) return new Date().toLocaleDateString('de-DE')
  try { return new Date(iso).toLocaleDateString('de-DE') } catch { return iso }
}
function imgFmt(d: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (d.includes('jpeg') || d.includes('jpg')) return 'JPEG'
  if (d.includes('webp')) return 'WEBP'
  return 'PNG'
}
function getFirmenname(): string {
  if (typeof window === 'undefined') return 'Petersen KI'
  try {
    const raw = localStorage.getItem('pk_firma_einstellungen')
    if (!raw) return 'Petersen KI'
    return (JSON.parse(raw) as { firmenname?: string }).firmenname || 'Petersen KI'
  } catch { return 'Petersen KI' }
}
async function loadDataUrl(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// Simple table renderer using jsPDF drawing primitives
function drawTable(
  doc: Doc,
  startY: number,
  marginL: number,
  marginR: number,
  headers: { label: string; w: number }[],
  rows: { cells: string[]; statusIdx?: number; rgb?: [number, number, number] }[],
  rowH = 7,
): number {
  const tableW = 210 - marginL - marginR
  const headerH = 8

  // Header row
  doc.setFillColor(...QM_RGB)
  doc.rect(marginL, startY, tableW, headerH, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let cx = marginL + 2
  for (const h of headers) {
    doc.text(h.label, cx, startY + 5.5)
    cx += h.w
  }

  let y = startY + headerH
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    // Alternating bg
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250)
      doc.rect(marginL, y, tableW, rowH, 'F')
    }
    // Status cell background
    if (row.statusIdx !== undefined && row.rgb) {
      const sx = marginL + headers.slice(0, row.statusIdx).reduce((a, h) => a + h.w, 0)
      doc.setFillColor(...row.rgb)
      doc.rect(sx, y, headers[row.statusIdx].w, rowH, 'F')
    }

    cx = marginL + 2
    for (let ci = 0; ci < headers.length; ci++) {
      const cell = row.cells[ci] ?? ''
      if (ci === row.statusIdx && row.rgb) {
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setTextColor(30, 30, 30)
        doc.setFont('helvetica', 'normal')
      }
      // Clip text to column width
      const maxChars = Math.floor(headers[ci].w / 1.9)
      const txt = cell.length > maxChars ? cell.slice(0, maxChars - 1) + '…' : cell
      doc.text(txt, cx, y + rowH - 2)
      cx += headers[ci].w
    }

    // Row border
    doc.setDrawColor(220, 225, 232)
    doc.line(marginL, y + rowH, marginL + tableW, y + rowH)
    y += rowH
  }
  // Outer border
  doc.setDrawColor(180, 190, 200)
  doc.rect(marginL, startY, tableW, headerH + rows.length * rowH)
  return y + 2
}

export async function generateQmPruefberichtPDF(berichtId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: jsPDF } = await import('jspdf') as any

  const [bericht, messwerte, fotos] = await Promise.all([
    getQmPruefbericht(berichtId),
    getQmMesswerte(berichtId),
    getQmFotos(berichtId),
  ])
  if (!bericht) throw new Error('Prüfbericht nicht gefunden')

  let zeichnungName = ''
  if (bericht.zeichnung_id) {
    const z = await getQmZeichnung(bericht.zeichnung_id).catch(() => null)
    zeichnungName = z?.name ?? ''
  }

  // Load foto data URLs (max 4)
  const fotoData: { label: string; dataUrl: string }[] = []
  for (const foto of fotos.slice(0, 4)) {
    const url = await getQmFotoSignedUrl(foto.datei_pfad).catch(() => null)
    if (!url) continue
    const dataUrl = await loadDataUrl(url)
    if (dataUrl) fotoData.push({ label: foto.beschreibung ?? foto.typ ?? '', dataUrl })
  }

  const doc: Doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 14
  const today = new Date().toLocaleDateString('de-DE')
  const firmenname = getFirmenname()

  // ────────────────────────────────────────────────────────────────
  // PAGE 1
  // ────────────────────────────────────────────────────────────────

  // Header bar
  doc.setFillColor(...QM_RGB)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('QM-Prüfbericht', margin, 12)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(firmenname, pageW - margin, 12, { align: 'right' })

  // Bericht-Nr
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...QM_RGB)
  doc.text(bericht.pruefbericht_nr, margin, 30)

  // Gesamtstatus badge
  const rgb = gsRgb(bericht.gesamtstatus)
  doc.setFillColor(...rgb)
  doc.rect(pageW - margin - 42, 22, 42, 11, 'F')
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(gsLabel(bericht.gesamtstatus), pageW - margin - 21, 28.5, { align: 'center' })

  // Kopfdaten
  let y = 40
  const col2 = 110
  const kvPairs: [string, string, string, string][] = [
    ['Bauteil-ID', bericht.bauteil_id ?? '—', 'Charge', bericht.chargennummer ?? '—'],
    ['Zeichnung', zeichnungName || '—', 'Anzahl geprüft', String(bericht.anzahl_geprueft ?? 1)],
    ['Prüfdatum', fmtDate(bericht.pruef_datum), 'Prüfer', bericht.pruefer_name ?? '—'],
    ['Erstellt', today, 'Initialen', bericht.unterschrift_initialen ?? '—'],
  ]
  doc.setFont('helvetica', 'normal')
  for (const [l1, v1, l2, v2] of kvPairs) {
    doc.setFontSize(7.5)
    doc.setTextColor(130, 140, 155)
    doc.text(l1, margin, y)
    doc.setTextColor(20, 20, 20)
    doc.text(v1, margin + 28, y)
    doc.setTextColor(130, 140, 155)
    doc.text(l2, col2, y)
    doc.setTextColor(20, 20, 20)
    doc.text(v2, col2 + 28, y)
    y += 6
  }

  // Separator
  y += 2
  doc.setDrawColor(200, 210, 220)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // Section title
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...QM_RGB)
  doc.text('Messwerte', margin, y)
  y += 4

  // Build messwert table rows
  const mwHeaders = [
    { label: 'Messstelle', w: 36 },
    { label: 'Sollwert',   w: 24 },
    { label: 'Toleranz',   w: 26 },
    { label: 'Istwert',    w: 24 },
    { label: 'Prüfmittel', w: 36 },
    { label: 'Status',     w: 36 },
  ]
  const mwRows = messwerte.map(mw => {
    const st = ampelStatus({ sollwert: mw.sollwert, istwert: mw.istwert, toleranz_plus: mw.toleranz_plus, toleranz_minus: mw.toleranz_minus })
    return {
      cells: [
        mw.messstelle,
        mw.sollwert !== null ? `${mw.sollwert} ${mw.einheit ?? 'mm'}` : '—',
        mw.toleranz_plus !== null ? `+${mw.toleranz_plus} /-${mw.toleranz_minus ?? '?'}` : '—',
        mw.istwert !== null ? `${mw.istwert} ${mw.einheit ?? 'mm'}` : '—',
        mw.pruefmittel ?? '—',
        statusLabel(st),
      ],
      statusIdx: 5,
      rgb: statusRgb(st),
    }
  })

  if (mwRows.length > 0) {
    y = drawTable(doc, y, margin, margin, mwHeaders, mwRows)
  } else {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 160, 175)
    doc.text('Keine Messwerte erfasst.', margin, y + 5)
    y += 12
  }

  // ────────────────────────────────────────────────────────────────
  // PAGE 2
  // ────────────────────────────────────────────────────────────────
  doc.addPage()

  // Header bar
  doc.setFillColor(...QM_RGB)
  doc.rect(0, 0, pageW, 14, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(`${bericht.pruefbericht_nr} · Sichtprüfung & Fotos`, margin, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(firmenname, pageW - margin, 10, { align: 'right' })

  y = 22

  // Fotos
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...QM_RGB)
  doc.text('Fotos', margin, y)
  y += 4

  if (fotoData.length > 0) {
    const gridW = (pageW - margin * 2 - 6) / 2
    const gridH = gridW * 0.75
    for (let i = 0; i < Math.min(fotoData.length, 4); i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const fx = margin + col * (gridW + 6)
      const fy = y + row * (gridH + 8)
      try {
        doc.addImage(fotoData[i].dataUrl, imgFmt(fotoData[i].dataUrl), fx, fy, gridW, gridH)
      } catch { /* skip broken image */ }
      doc.setFontSize(7)
      doc.setTextColor(100, 115, 130)
      doc.setFont('helvetica', 'normal')
      if (fotoData[i].label) doc.text(fotoData[i].label, fx + 1, fy + gridH + 4)
    }
    y += Math.ceil(Math.min(fotoData.length, 4) / 2) * (gridH + 8) + 6
  } else {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 160, 175)
    doc.text('Keine Fotos hinterlegt.', margin, y + 4)
    y += 12
  }

  // Bemerkungen
  if (bericht.bemerkungen) {
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...QM_RGB)
    doc.text('Bemerkungen', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)
    // Simple word wrap
    const maxW = 85
    const words = bericht.bemerkungen.split(' ')
    let line = ''
    for (const word of words) {
      if ((line + word).length > maxW) {
        doc.text(line.trim(), margin, y); y += 5; line = ''
      }
      line += word + ' '
    }
    if (line.trim()) { doc.text(line.trim(), margin, y); y += 5 }
  }

  // Abzeichnung footer
  y = Math.max(y + 8, 242)
  doc.setDrawColor(200, 210, 220)
  doc.line(margin, y, pageW - margin, y)
  y += 5

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Gesamtstatus:', margin, y)
  doc.setTextColor(...gsRgb(bericht.gesamtstatus))
  doc.text(gsLabel(bericht.gesamtstatus), margin + 34, y)
  doc.setTextColor(30, 30, 30)
  doc.text(`Prüfer: ${bericht.pruefer_name ?? '—'}`, pageW / 2, y, { align: 'center' })
  doc.text(`Initialen: ${bericht.unterschrift_initialen ?? '—'}`, pageW - margin, y, { align: 'right' })

  if (bericht.gesperrt) {
    y += 5
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(239, 68, 68)
    doc.text('BERICHT GESPERRT', margin, y)
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 170, 185)
    doc.text(
      `Seite ${p} / ${totalPages}  ·  ${today}  ·  Erstellt mit Petersen KI QM-Pilot`,
      pageW / 2, 290, { align: 'center' }
    )
  }

  doc.save(`${bericht.pruefbericht_nr}.pdf`)
}
