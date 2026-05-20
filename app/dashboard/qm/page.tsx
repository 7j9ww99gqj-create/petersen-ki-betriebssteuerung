'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { generateQmPruefberichtPDF } from '@/lib/qm-pdf'
import {
  getQmPruefberichte,
  getQmPruefberichtIdsMitKiAnalyse,
  getQmMesswerte,
  getQmTeamMitglieder,
  deleteQmTeamMitglied,
  upsertQmTeamMitglied,
  getQmStatusVerteilung,
  getQmFehlerquoteTrend,
  getQmHaeufigsteAbweichungen,
  getQmPrueferPerformance,
  getQmMessmittel,
  upsertQmMessmittel,
  deleteQmMessmittel,
  type QmGesamtstatus,
  type QmPruefbericht,
  type QmTeamMitglied,
  type QmTeamRolle,
  type QmStatistikZeitraum,
  type QmStatusVerteilung,
  type QmFehlerquoteTrend,
  type QmHaeufigsteAbweichung,
  type QmPrueferPerformance,
  type QmMessmittel,
  type QmMessmittelTyp,
} from '@/lib/db/qm'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ReferenceLine,
} from 'recharts'

const QM_COLOR = '#14b8a6'

// ─────────────────────────────────────────────────────────────────────
// Demo data
// ─────────────────────────────────────────────────────────────────────

const DEMO_BERICHTE: QmPruefbericht[] = [
  {
    id: 'PB-2026-012', user_id: 'demo', zeichnung_id: null,
    pruefbericht_nr: 'PB-2026-012', bauteil_id: 'Stempel-B',
    chargennummer: null, anzahl_geprueft: 1,
    pruef_datum: '2026-05-19', pruefer_name: 'Kevin',
    gesamtstatus: 'bestanden', bemerkungen: null,
    unterschrift_initialen: 'KP', gesperrt: false,
    erstellt_am: '2026-05-19T08:00:00Z',
  },
  {
    id: 'PB-2026-011', user_id: 'demo', zeichnung_id: null,
    pruefbericht_nr: 'PB-2026-011', bauteil_id: 'Flansch-A',
    chargennummer: null, anzahl_geprueft: 2,
    pruef_datum: '2026-05-18', pruefer_name: 'Maria',
    gesamtstatus: 'nachbesserung', bemerkungen: null,
    unterschrift_initialen: 'MK', gesperrt: false,
    erstellt_am: '2026-05-18T10:30:00Z',
  },
  {
    id: 'PB-2026-010', user_id: 'demo', zeichnung_id: null,
    pruefbericht_nr: 'PB-2026-010', bauteil_id: 'Welle-C',
    chargennummer: null, anzahl_geprueft: 1,
    pruef_datum: '2026-05-17', pruefer_name: 'Frank',
    gesamtstatus: 'bestanden', bemerkungen: null,
    unterschrift_initialen: 'FW', gesperrt: true,
    erstellt_am: '2026-05-17T14:00:00Z',
  },
  {
    id: 'PB-2026-009', user_id: 'demo', zeichnung_id: null,
    pruefbericht_nr: 'PB-2026-009', bauteil_id: 'Buchse-D',
    chargennummer: null, anzahl_geprueft: 1,
    pruef_datum: '2026-05-16', pruefer_name: 'Kevin',
    gesamtstatus: 'ausschuss', bemerkungen: null,
    unterschrift_initialen: 'KP', gesperrt: true,
    erstellt_am: '2026-05-16T09:15:00Z',
  },
  {
    id: 'PB-2026-008', user_id: 'demo', zeichnung_id: null,
    pruefbericht_nr: 'PB-2026-008', bauteil_id: 'Stempel-A',
    chargennummer: null, anzahl_geprueft: 3,
    pruef_datum: '2026-05-14', pruefer_name: 'Maria',
    gesamtstatus: 'bestanden', bemerkungen: null,
    unterschrift_initialen: 'MK', gesperrt: false,
    erstellt_am: '2026-05-14T11:00:00Z',
  },
]

const DEMO_MESSMITTEL: QmMessmittel[] = [
  {
    id: 'MM-001', user_id: 'demo', name: 'Schieblehre digital #1', seriennummer: 'SN-4892', hersteller: 'Mitutoyo',
    typ: 'Schieblehre', messbereich: '0-150mm', aufloesung: '0,01mm',
    kalibriert_am: '2025-05-20', kalibrierung_faellig_am: '2026-06-15',
    kalibrierungs_intervall_tage: 365, status: 'ok', notiz: null, aktiv: true, erstellt_am: '2025-05-20T10:00:00Z',
  },
  {
    id: 'MM-002', user_id: 'demo', name: 'Mikrometer 0-25mm', seriennummer: 'SN-7231', hersteller: 'Mahr',
    typ: 'Mikrometer', messbereich: '0-25mm', aufloesung: '0,001mm',
    kalibriert_am: '2025-11-20', kalibrierung_faellig_am: '2026-05-30',
    kalibrierungs_intervall_tage: 180, status: 'faellig', notiz: null, aktiv: true, erstellt_am: '2025-11-20T10:00:00Z',
  },
  {
    id: 'MM-003', user_id: 'demo', name: 'Rauheitsmessgerät Surftest', seriennummer: 'SN-1055', hersteller: 'Mitutoyo',
    typ: 'Rauheitsmesser', messbereich: null, aufloesung: null,
    kalibriert_am: '2025-03-01', kalibrierung_faellig_am: '2026-03-01',
    kalibrierungs_intervall_tage: 365, status: 'ueberfaellig', notiz: 'Kalibrierung abgelaufen!', aktiv: true, erstellt_am: '2025-03-01T10:00:00Z',
  },
]

// ─────────────────────────────────────────────────────────────────────
// SPC types & demo data
// ─────────────────────────────────────────────────────────────────────

type SpcRow = {
  istwert: number
  sollwert: number
  toleranz_plus: number
  toleranz_minus: number
  status: string
  pruef_datum: string
  pruefbericht_nr: string
}

type SpcResult = {
  n: number
  mean: number
  stddev: number
  cp: number | null
  cpk: number | null
  cpu: number | null
  cpl: number | null
  usl: number
  lsl: number
  trend: string
  trendSlope: number
}

const DEMO_SPC_DATEN: SpcRow[] = [
  { istwert: 150.02, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-01', pruefbericht_nr: 'PB-2026-001' },
  { istwert: 149.97, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-02', pruefbericht_nr: 'PB-2026-002' },
  { istwert: 150.03, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-03', pruefbericht_nr: 'PB-2026-003' },
  { istwert: 149.98, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-04', pruefbericht_nr: 'PB-2026-004' },
  { istwert: 150.01, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-05', pruefbericht_nr: 'PB-2026-005' },
  { istwert: 149.99, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-06', pruefbericht_nr: 'PB-2026-006' },
  { istwert: 150.02, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-07', pruefbericht_nr: 'PB-2026-007' },
  { istwert: 150.04, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-08', pruefbericht_nr: 'PB-2026-008' },
  { istwert: 149.96, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-09', pruefbericht_nr: 'PB-2026-009' },
  { istwert: 150.00, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-10', pruefbericht_nr: 'PB-2026-010' },
  { istwert: 150.01, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-11', pruefbericht_nr: 'PB-2026-011' },
  { istwert: 149.97, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-12', pruefbericht_nr: 'PB-2026-012' },
  { istwert: 150.03, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-13', pruefbericht_nr: 'PB-2026-013' },
  { istwert: 149.99, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-14', pruefbericht_nr: 'PB-2026-014' },
  { istwert: 150.00, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-15', pruefbericht_nr: 'PB-2026-015' },
  { istwert: 150.02, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-16', pruefbericht_nr: 'PB-2026-016' },
  { istwert: 149.96, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-17', pruefbericht_nr: 'PB-2026-017' },
  { istwert: 150.04, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-18', pruefbericht_nr: 'PB-2026-018' },
  { istwert: 149.98, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-19', pruefbericht_nr: 'PB-2026-019' },
  { istwert: 150.01, sollwert: 150, toleranz_plus: 0.1, toleranz_minus: 0.1, status: 'gruen', pruef_datum: '2026-05-20', pruefbericht_nr: 'PB-2026-020' },
]

function calculateSPC(
  messwerte: number[],
  sollwert: number,
  toleranz_plus: number,
  toleranz_minus: number,
): SpcResult {
  const n = messwerte.length
  const usl = sollwert + toleranz_plus
  const lsl = sollwert - toleranz_minus
  const mean = messwerte.reduce((s, x) => s + x, 0) / n
  const stddev = n > 1
    ? Math.sqrt(messwerte.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
    : 0

  let cp: number | null = null
  let cpu: number | null = null
  let cpl: number | null = null
  let cpk: number | null = null

  if (stddev > 0) {
    cp  = (usl - lsl) / (6 * stddev)
    cpu = (usl - mean) / (3 * stddev)
    cpl = (mean - lsl) / (3 * stddev)
    cpk = Math.min(cpu, cpl)
  }

  const xi = messwerte.map((_, i) => i)
  const sumX  = xi.reduce((s, x) => s + x, 0)
  const sumY  = messwerte.reduce((s, y) => s + y, 0)
  const sumXY = xi.reduce((s, x, i) => s + x * messwerte[i], 0)
  const sumX2 = xi.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0

  const trend =
    slope > 0.001  ? 'steigend ↗ (möglicher Werkzeugverschleiß)' :
    slope < -0.001 ? 'fallend ↘' : 'stabil →'

  return { n, mean, stddev, cp, cpk, cpu, cpl, usl, lsl, trend, trendSlope: slope }
}

function spcKpiColor(val: number | null): string {
  if (val === null) return '#aeb9c8'
  if (val >= 1.33) return '#10b981'
  if (val >= 1.0)  return '#f59e0b'
  return '#ef4444'
}

function spcKpiLabel(val: number | null): string {
  if (val === null) return '—'
  if (val >= 1.67) return '🟢 Sehr gut'
  if (val >= 1.33) return '🟢 Gut'
  if (val >= 1.0)  return '🟡 Akzeptabel'
  return '🔴 Kritisch'
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function statusBadge(status: QmGesamtstatus | null) {
  if (status === 'bestanden')    return { label: '✅ Bestanden',     bg: 'rgba(16,185,129,.15)',  color: '#10b981' }
  if (status === 'nachbesserung') return { label: '⚠️ Nachbesserung', bg: 'rgba(245,158,11,.15)', color: '#f59e0b' }
  if (status === 'ausschuss')    return { label: '❌ Ausschuss',     bg: 'rgba(239,68,68,.15)',   color: '#ef4444' }
  return { label: '— Offen', bg: 'rgba(174,185,200,.1)', color: '#aeb9c8' }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('de-DE') } catch { return iso }
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────
// KPI computation
// ─────────────────────────────────────────────────────────────────────

type KpiData = {
  woche: number
  bestanden: number
  nachbesserung: number
  ausschuss: number
  fehlerquote: string
}

function computeKpis(berichte: QmPruefbericht[]): KpiData {
  const weekStart = getWeekStart()
  const wochenBerichte = berichte.filter(b => (b.pruef_datum ?? b.erstellt_am.slice(0, 10)) >= weekStart)
  const woche = wochenBerichte.length
  const bestanden = wochenBerichte.filter(b => b.gesamtstatus === 'bestanden').length
  const nachbesserung = wochenBerichte.filter(b => b.gesamtstatus === 'nachbesserung').length
  const ausschuss = wochenBerichte.filter(b => b.gesamtstatus === 'ausschuss').length
  const fehler = nachbesserung + ausschuss
  const fehlerquote = woche > 0 ? ((fehler / woche) * 100).toFixed(1) + '%' : '0%'
  return { woche, bestanden, nachbesserung, ausschuss, fehlerquote }
}

type Tab = 'dashboard' | 'zeichnungen' | 'archiv' | 'statistiken' | 'team' | 'messmittel'

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function QMPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const isDemo = hasDemoCookie()

  const [berichte, setBerichte] = useState<QmPruefbericht[]>([])
  const [kiBerichtIds, setKiBerichtIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Archiv filters
  const [search, setSearch] = useState('')
  const [filterPruefer, setFilterPruefer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // PDF generation state
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  // CSV export state
  const [csvLoadingBericht, setCsvLoadingBericht] = useState<string | null>(null)

  // Email state
  const [emailModal, setEmailModal] = useState<QmPruefbericht | null>(null)
  const [emailAddr, setEmailAddr] = useState('')
  const [emailName, setEmailName] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [resendConfigured, setResendConfigured] = useState<boolean | null>(null)

  // Statistik state
  const [statsZeitraum, setStatsZeitraum] = useState<QmStatistikZeitraum>('monat')
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsVerteilung, setStatsVerteilung] = useState<QmStatusVerteilung>([])
  const [statsTrend, setStatsTrend] = useState<QmFehlerquoteTrend>([])
  const [statsAbweichungen, setStatsAbweichungen] = useState<QmHaeufigsteAbweichung>([])
  const [statsPruefer, setStatsPruefer] = useState<QmPrueferPerformance>([])

  // Team state
  const [team, setTeam] = useState<QmTeamMitglied[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<string | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [teamForm, setTeamForm] = useState<{ name: string; email: string; rolle: QmTeamRolle }>({ name: '', email: '', rolle: 'pruefer' })
  const [teamSaving, setTeamSaving] = useState(false)

  // Messmittel state
  const [messmittel, setMessmittel] = useState<QmMessmittel[]>([])
  const [messmittelLoading, setMessmittelLoading] = useState(false)
  const [deleteConfirmMM, setDeleteConfirmMM] = useState<string | null>(null)
  const [showMMModal, setShowMMModal] = useState(false)
  const [editingMM, setEditingMM] = useState<QmMessmittel | null>(null)
  const [mmForm, setMmForm] = useState<{
    name: string; seriennummer: string; hersteller: string; typ: string
    messbereich: string; aufloesung: string; kalibriert_am: string; kalibrierung_faellig_am: string
    kalibrierungs_intervall_tage: string; notiz: string
  }>({ name: '', seriennummer: '', hersteller: '', typ: 'Schieblehre', messbereich: '', aufloesung: '', kalibriert_am: '', kalibrierung_faellig_am: '', kalibrierungs_intervall_tage: '365', notiz: '' })
  const [mmSaving, setMmSaving] = useState(false)

  // SPC state
  const [spcBauteilId, setSpcBauteilId] = useState<string>('')
  const [spcMessstelle, setSpcMessstelle] = useState<string>('')
  const [spcData, setSpcData] = useState<SpcRow[] | null>(null)
  const [spcLoading, setSpcLoading] = useState(false)
  const [spcMessstellen, setSpcMessstellen] = useState<string[]>([])
  const [spcMsLoading, setSpcMsLoading] = useState(false)
  const [spcCpkWarnung, setSpcCpkWarnung] = useState<{ bauteil_id: string; messstelle: string; cpk: number } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadBerichte = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDemo) {
        setBerichte(DEMO_BERICHTE)
        setKiBerichtIds(new Set(['PB-2026-011']))
      } else {
        const [rows, kiIds] = await Promise.all([
          getQmPruefberichte(),
          getQmPruefberichtIdsMitKiAnalyse().catch(() => [] as string[]),
        ])
        setBerichte(rows)
        setKiBerichtIds(new Set(kiIds))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
      if (isDemo) setBerichte(DEMO_BERICHTE)
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => { void loadBerichte() }, [loadBerichte])

  const loadTeam = useCallback(async () => {
    if (isDemo) return
    setTeamLoading(true)
    try { setTeam(await getQmTeamMitglieder()) } catch { /* ignore */ } finally { setTeamLoading(false) }
  }, [isDemo])

  useEffect(() => { if (tab === 'team') void loadTeam() }, [tab, loadTeam])

  const loadMessmittel = useCallback(async () => {
    setMessmittelLoading(true)
    try {
      if (isDemo) setMessmittel(DEMO_MESSMITTEL)
      else setMessmittel(await getQmMessmittel())
    } catch { /* ignore */ } finally { setMessmittelLoading(false) }
  }, [isDemo])

  useEffect(() => { if (tab === 'messmittel' || tab === 'dashboard') void loadMessmittel() }, [tab, loadMessmittel])

  useEffect(() => {
    if (tab !== 'dashboard' || isDemo) return
    fetch('/api/qm/spc-daten?mode=warnung')
      .then(r => r.json())
      .then((d: { bauteil_id: string; messstelle: string; cpk: number } | null) => {
        if (d && d.cpk < 1.0) setSpcCpkWarnung(d)
      })
      .catch(() => { /* ignore */ })
  }, [tab, isDemo])

  const loadStats = useCallback(async (zeitraum: QmStatistikZeitraum) => {
    if (isDemo) return
    setStatsLoading(true)
    try {
      const [verteilung, trend, abweichungen, pruefer] = await Promise.all([
        getQmStatusVerteilung(zeitraum),
        getQmFehlerquoteTrend(),
        getQmHaeufigsteAbweichungen(zeitraum),
        getQmPrueferPerformance(zeitraum),
      ])
      setStatsVerteilung(verteilung)
      setStatsTrend(trend)
      setStatsAbweichungen(abweichungen)
      setStatsPruefer(pruefer)
    } catch { /* ignore */ } finally {
      setStatsLoading(false)
    }
  }, [isDemo])

  useEffect(() => {
    if (tab === 'statistiken') void loadStats(statsZeitraum)
  }, [tab, statsZeitraum, loadStats])

  async function handlePdf(b: QmPruefbericht) {
    if (isDemo) { showToast('Demo-Modus: PDF-Export deaktiviert', false); return }
    setPdfLoading(b.id)
    try {
      await generateQmPruefberichtPDF(b.id)
      showToast(`PDF ${b.pruefbericht_nr} heruntergeladen`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PDF fehlgeschlagen', false)
    } finally {
      setPdfLoading(null)
    }
  }

  function exportCsvBerichte() {
    if (filteredBerichte.length === 0) return
    const rows = filteredBerichte.map(b => ({
      'Bericht-Nr': b.pruefbericht_nr,
      'Bauteil-ID': b.bauteil_id ?? '',
      'Zeichnung': b.zeichnung_id ?? '',
      'Datum': b.pruef_datum ?? '',
      'Prüfer': b.pruefer_name ?? '',
      'Status': b.gesamtstatus ?? '',
      'Charge': b.chargennummer ?? '',
      'Anzahl geprüft': String(b.anzahl_geprueft),
      'Bemerkungen': b.bemerkungen ?? '',
    }))
    const header = Object.keys(rows[0]).join(';')
    const lines = rows.map(r => Object.values(r).map(v => `"${v.replace(/"/g, '""')}"`).join(';'))
    const csv = [header, ...lines].join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qm-pruefberichte-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportCsvMesswerte(b: QmPruefbericht) {
    if (isDemo) { showToast('Demo: Keine Messwerte verfügbar', false); return }
    setCsvLoadingBericht(b.id)
    try {
      const messwerte = await getQmMesswerte(b.id)
      if (messwerte.length === 0) { showToast('Keine Messwerte für diesen Bericht', false); return }
      const rows = messwerte.map(m => ({
        'Messstelle': m.messstelle,
        'Sollwert': String(m.sollwert ?? ''),
        'Tol+': String(m.toleranz_plus ?? ''),
        'Tol-': String(m.toleranz_minus ?? ''),
        'Istwert': String(m.istwert ?? ''),
        'Abweichung': String(m.abweichung ?? ''),
        'Status': m.status ?? '',
        'Prüfmittel': m.pruefmittel ?? '',
      }))
      const header = Object.keys(rows[0]).join(';')
      const lines = rows.map(r => Object.values(r).map(v => `"${v.replace(/"/g, '""')}"`).join(';'))
      const csv = [header, ...lines].join('\r\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `messwerte-${b.pruefbericht_nr}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'CSV-Export fehlgeschlagen', false)
    } finally {
      setCsvLoadingBericht(null)
    }
  }

  useEffect(() => {
    fetch('/api/qm/send-pdf')
      .then(r => r.json())
      .then((d: { configured?: boolean }) => setResendConfigured(!!d.configured))
      .catch(() => setResendConfigured(false))
  }, [])

  async function handleSendEmail() {
    if (!emailModal) return
    if (isDemo) {
      showToast('E-Mail würde jetzt versendet (Demo)', true)
      setEmailModal(null)
      return
    }
    if (!emailAddr.trim()) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/qm/send-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bericht_id: emailModal.id,
          recipient_email: emailAddr.trim(),
          recipient_name: emailName.trim() || undefined,
          pruefbericht_nr: emailModal.pruefbericht_nr,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) {
        showToast(`E-Mail an ${emailAddr} versendet`)
        setEmailModal(null)
        setEmailAddr('')
        setEmailName('')
      } else {
        showToast(data.error ?? 'Fehler beim Versand', false)
      }
    } catch {
      showToast('Netzwerkfehler', false)
    } finally {
      setEmailSending(false)
    }
  }

  function getMailtoLink(b: QmPruefbericht): string {
    const subject = encodeURIComponent(`Prüfbericht ${b.pruefbericht_nr} — ${b.bauteil_id ?? ''}`)
    const body = encodeURIComponent(
      `Sehr geehrte Damen und Herren,\n\nanbei finden Sie den Prüfbericht ${b.pruefbericht_nr} (Bauteil: ${b.bauteil_id ?? '—'}, Datum: ${fmtDate(b.pruef_datum)}, Status: ${b.gesamtstatus ?? '—'}).\n\nDas PDF können Sie separat herunterladen.\n\nMit freundlichen Grüßen`
    )
    return `mailto:?subject=${subject}&body=${body}`
  }

  function openMMModal(m?: QmMessmittel) {
    setEditingMM(m ?? null)
    setMmForm(m ? {
      name: m.name, seriennummer: m.seriennummer ?? '', hersteller: m.hersteller ?? '',
      typ: m.typ ?? 'Schieblehre', messbereich: m.messbereich ?? '', aufloesung: m.aufloesung ?? '',
      kalibriert_am: m.kalibriert_am ?? '', kalibrierung_faellig_am: m.kalibrierung_faellig_am ?? '',
      kalibrierungs_intervall_tage: String(m.kalibrierungs_intervall_tage ?? 365), notiz: m.notiz ?? '',
    } : { name: '', seriennummer: '', hersteller: '', typ: 'Schieblehre', messbereich: '', aufloesung: '', kalibriert_am: '', kalibrierung_faellig_am: '', kalibrierungs_intervall_tage: '365', notiz: '' })
    setShowMMModal(true)
  }

  async function handleSaveMM() {
    if (!mmForm.name.trim()) return
    if (isDemo) { showToast('Demo: Änderungen werden nicht gespeichert'); setShowMMModal(false); return }
    setMmSaving(true)
    try {
      await upsertQmMessmittel({
        id: editingMM?.id,
        name: mmForm.name.trim(),
        seriennummer: mmForm.seriennummer.trim() || null,
        hersteller: mmForm.hersteller.trim() || null,
        typ: mmForm.typ || null,
        messbereich: mmForm.messbereich.trim() || null,
        aufloesung: mmForm.aufloesung.trim() || null,
        kalibriert_am: mmForm.kalibriert_am || null,
        kalibrierung_faellig_am: mmForm.kalibrierung_faellig_am || null,
        kalibrierungs_intervall_tage: parseInt(mmForm.kalibrierungs_intervall_tage) || 365,
        notiz: mmForm.notiz.trim() || null,
      })
      setShowMMModal(false)
      await loadMessmittel()
      showToast(editingMM ? 'Messmittel aktualisiert' : 'Messmittel hinzugefügt')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', false)
    } finally {
      setMmSaving(false)
    }
  }

  async function handleDeleteMM(id: string) {
    if (isDemo) { showToast('Demo: Löschen nicht verfügbar'); setDeleteConfirmMM(null); return }
    try {
      await deleteQmMessmittel(id)
      setDeleteConfirmMM(null)
      await loadMessmittel()
      showToast('Messmittel gelöscht')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Fehler', false)
    }
  }

  // ── Computed
  const kpis = computeKpis(berichte)

  // ── All unique Prüfer for dropdown
  const allPruefer = Array.from(new Set(berichte.map(b => b.pruefer_name).filter(Boolean))) as string[]

  // ── Filtered berichte for archiv
  const filteredBerichte = berichte.filter(b => {
    if (search && !(
      (b.bauteil_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      b.pruefbericht_nr.toLowerCase().includes(search.toLowerCase()) ||
      (b.pruefer_name ?? '').toLowerCase().includes(search.toLowerCase())
    )) return false
    if (filterPruefer && b.pruefer_name !== filterPruefer) return false
    if (filterStatus && b.gesamtstatus !== filterStatus) return false
    return true
  })

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard',   label: 'Dashboard',   icon: '📊' },
    { id: 'zeichnungen', label: 'Zeichnungen', icon: '🖼️' },
    { id: 'archiv',      label: 'Archiv',      icon: '📁' },
    { id: 'statistiken', label: 'Statistiken', icon: '📈' },
    { id: 'team',        label: 'Team',        icon: '👥' },
    { id: 'messmittel',  label: 'Messmittel',  icon: '🔧' },
  ]

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${QM_COLOR}18`, border: `1px solid ${QM_COLOR}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>🔬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-.03em' }}>
            QM-Pilot <span style={{ color: QM_COLOR }}>·</span> Qualitätsmanagement
          </h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
            Zeichnungsanalyse · Prüfberichte · Messwerterfassung · Archiv
          </p>
        </div>
        {isDemo && (
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.25)', color: '#ffb347', fontWeight: 700, letterSpacing: '.05em' }}>
            ● DEMO
          </span>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/qm/zeichnungen" className="pk-btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
            📤 Zeichnung hochladen
          </Link>
          <Link href="/dashboard/qm/pruefen" className="pk-btn" style={{ fontSize: 13, padding: '8px 14px', background: QM_COLOR, border: 'none', textDecoration: 'none' }}>
            📋 Prüfbericht starten
          </Link>
        </div>
      </div>

      {/* Tab-Bar */}
      <div className="pk-tab-bar" style={{ marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tab === t.id ? `${QM_COLOR}20` : 'transparent',
              color: tab === t.id ? QM_COLOR : '#aeb9c8',
              fontWeight: tab === t.id ? 700 : 500,
              fontSize: 13, whiteSpace: 'nowrap',
              outline: tab === t.id ? `1.5px solid ${QM_COLOR}50` : 'none',
              transition: 'all .15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,.4)', color: '#ff8080' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ─── Dashboard Tab ─── */}
      {tab === 'dashboard' && (
        <div>
          {loading ? (
            <div className="pk-card" style={{ padding: 30, textAlign: 'center', color: '#aeb9c8' }}>Lade Daten…</div>
          ) : (
            <>
              {/* KPI-Karten — echte DB-Daten */}
              <div className="stats-grid" style={{ marginBottom: 22 }}>
                <div className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: QM_COLOR }}>{kpis.woche}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>Prüfberichte (Woche)</div>
                </div>
                <div className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{kpis.bestanden}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>Bestanden</div>
                </div>
                <div className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>⚠️</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{kpis.nachbesserung}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>Nachbesserung</div>
                </div>
                <div className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#aeb9c8' }}>{kpis.fehlerquote}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>Fehlerquote</div>
                </div>
              </div>

              {/* Messmittel-Warnung */}
              {(() => {
                const ueberfaellig = messmittel.filter(m => m.status === 'ueberfaellig').length
                const faellig = messmittel.filter(m => m.status === 'faellig').length
                if (ueberfaellig === 0 && faellig === 0) return null
                return (
                  <div className="pk-card" style={{ marginBottom: 16, border: `1px solid ${ueberfaellig > 0 ? 'rgba(239,68,68,.4)' : 'rgba(245,158,11,.4)'}`, cursor: 'pointer' }}
                    onClick={() => setTab('messmittel')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{ueberfaellig > 0 ? '❌' : '⚠️'}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: ueberfaellig > 0 ? '#ef4444' : '#f59e0b' }}>
                          {ueberfaellig > 0
                            ? `${ueberfaellig} Messmittel überfällig — Kalibrierung prüfen`
                            : `${faellig} Messmittel bald fällig — Kalibrierung planen`}
                        </div>
                        <div style={{ fontSize: 11, color: '#aeb9c8' }}>Klicken für Details → Messmittel-Tab</div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* SPC Cpk-Warnung */}
              {(spcCpkWarnung || isDemo) && (() => {
                const w = isDemo
                  ? { bauteil_id: 'Stempel-B', messstelle: 'Länge', cpk: 0.87 }
                  : spcCpkWarnung!
                return (
                  <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,.4)', cursor: 'pointer' }}
                    onClick={() => setTab('statistiken')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>⚠️</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>
                          Prozess kritisch: {w.bauteil_id} / {w.messstelle} — Cpk {w.cpk.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: '#aeb9c8' }}>Klicken für SPC-Analyse → Statistiken-Tab</div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Letzte Prüfberichte */}
              <div className="pk-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Letzte Prüfberichte</span>
                  <button className="pk-btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setTab('archiv')}>
                    Alle anzeigen →
                  </button>
                </div>
                {berichte.length === 0 ? (
                  <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>
                    Noch keine Prüfberichte.{' '}
                    <Link href="/dashboard/qm/pruefen" style={{ color: QM_COLOR }}>Ersten Bericht erstellen →</Link>
                  </div>
                ) : (
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Bericht-Nr.</th>
                          <th>Bauteil</th>
                          <th>Datum</th>
                          <th>Prüfer</th>
                          <th>Status</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {berichte.slice(0, 5).map(b => {
                          const badge = statusBadge(b.gesamtstatus)
                          return (
                            <tr key={b.id}>
                              <td style={{ fontWeight: 700, color: QM_COLOR, fontFamily: 'monospace', fontSize: 12 }}>{b.pruefbericht_nr}</td>
                              <td style={{ fontWeight: 600 }}>{b.bauteil_id ?? '—'}</td>
                              <td style={{ color: '#aeb9c8', fontSize: 13 }}>{fmtDate(b.pruef_datum)}</td>
                              <td style={{ fontSize: 13 }}>{b.pruefer_name ?? '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                                    {badge.label}
                                  </span>
                                  {kiBerichtIds.has(b.id) && (
                                    <span title="KI-Sichtprüfung durchgeführt" style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${QM_COLOR}20`, color: QM_COLOR }}>
                                      🤖 KI
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <button
                                  className="pk-btn-ghost"
                                  disabled={pdfLoading === b.id}
                                  onClick={() => void handlePdf(b)}
                                  style={{ fontSize: 11, padding: '4px 8px' }}
                                >
                                  {pdfLoading === b.id ? '⏳' : '📥 PDF'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Zeichnungen Tab (redirect to dedicated page) ─── */}
      {tab === 'zeichnungen' && (
        <div className="pk-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🖼️</div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Zeichnungs-Bibliothek</div>
          <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 20 }}>
            Upload, KI-Analyse und Verwaltung aller Zeichnungen auf der Bibliotheks-Seite.
          </div>
          <Link href="/dashboard/qm/zeichnungen" className="pk-btn" style={{ background: QM_COLOR, border: 'none', textDecoration: 'none' }}>
            📂 Zur Zeichnungs-Bibliothek →
          </Link>
        </div>
      )}

      {/* ─── Archiv Tab — echte DB ─── */}
      {tab === 'archiv' && (
        <div>
          <div className="pk-card" style={{ marginBottom: 14 }}>
            {/* Filter-Row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
              <input
                className="pk-input"
                placeholder="Bauteil-ID, Bericht-Nr., Prüfer suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select
                className="pk-input"
                value={filterPruefer}
                onChange={e => setFilterPruefer(e.target.value)}
                style={{ width: 150 }}
              >
                <option value="">Alle Prüfer</option>
                {allPruefer.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                className="pk-input"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="">Alle Status</option>
                <option value="bestanden">Bestanden</option>
                <option value="nachbesserung">Nachbesserung</option>
                <option value="ausschuss">Ausschuss</option>
                <option value="offen">Offen</option>
              </select>
              <button
                className="pk-btn-ghost"
                onClick={exportCsvBerichte}
                disabled={filteredBerichte.length === 0}
                title="Gefilterte Berichte als CSV exportieren"
                style={{ fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}
              >
                📥 CSV Export
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>Lade Berichte…</div>
            ) : filteredBerichte.length === 0 ? (
              <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>
                {berichte.length === 0
                  ? <>Noch keine Berichte. <Link href="/dashboard/qm/pruefen" style={{ color: QM_COLOR }}>Ersten Bericht erstellen →</Link></>
                  : 'Keine Berichte für diese Filter-Kombination.'}
              </div>
            ) : (
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Bericht-Nr.</th>
                      <th>Bauteil</th>
                      <th>Datum</th>
                      <th>Prüfer</th>
                      <th>Status</th>
                      <th>PDF</th>
                      <th>CSV</th>
                      <th>Mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBerichte.map(b => {
                      const badge = statusBadge(b.gesamtstatus)
                      return (
                        <tr
                          key={b.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/dashboard/qm/pruefen?bericht=${b.id}`)}
                        >
                          <td style={{ fontWeight: 700, color: QM_COLOR, fontFamily: 'monospace', fontSize: 12 }}>{b.pruefbericht_nr}</td>
                          <td style={{ fontWeight: 600 }}>{b.bauteil_id ?? '—'}</td>
                          <td style={{ fontSize: 12, color: '#aeb9c8' }}>{fmtDate(b.pruef_datum)}</td>
                          <td style={{ fontSize: 13 }}>{b.pruefer_name ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                                {badge.label}
                              </span>
                              {kiBerichtIds.has(b.id) && (
                                <span title="KI-Sichtprüfung durchgeführt" style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${QM_COLOR}20`, color: QM_COLOR }}>
                                  🤖 KI
                                </span>
                              )}
                            </div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="pk-btn-ghost"
                              disabled={pdfLoading === b.id}
                              onClick={() => void handlePdf(b)}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                            >
                              {pdfLoading === b.id ? '⏳' : '📥'}
                            </button>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="pk-btn-ghost"
                              disabled={csvLoadingBericht === b.id}
                              onClick={() => void exportCsvMesswerte(b)}
                              title="Messwerte als CSV exportieren"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                            >
                              {csvLoadingBericht === b.id ? '⏳' : '📊'}
                            </button>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="pk-btn-ghost"
                              onClick={() => { setEmailModal(b); setEmailAddr(''); setEmailName('') }}
                              title="Per E-Mail senden"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                            >
                              📧
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div style={{ color: '#aeb9c8', fontSize: 12, textAlign: 'right' }}>
            {filteredBerichte.length} von {berichte.length} Berichten
          </div>
        </div>
      )}

      {/* ─── Statistiken Tab ─── */}
      {tab === 'statistiken' && (() => {
        // Demo-Fallback
        const DEMO_VERTEILUNG = [{ gesamtstatus: 'bestanden', anzahl: 8 }, { gesamtstatus: 'nachbesserung', anzahl: 2 }, { gesamtstatus: 'ausschuss', anzahl: 1 }]
        const DEMO_TREND = [
          { woche: '2026-03-30', fehler: 1, gesamt: 5 }, { woche: '2026-04-06', fehler: 0, gesamt: 4 },
          { woche: '2026-04-13', fehler: 2, gesamt: 6 }, { woche: '2026-04-20', fehler: 1, gesamt: 3 },
          { woche: '2026-04-27', fehler: 0, gesamt: 5 }, { woche: '2026-05-04', fehler: 1, gesamt: 4 },
          { woche: '2026-05-11', fehler: 2, gesamt: 7 }, { woche: '2026-05-18', fehler: 1, gesamt: 5 },
        ]
        const DEMO_ABWEICHUNGEN = [{ messstelle: 'Länge', anzahl: 4 }, { messstelle: 'Ø Bohrung', anzahl: 3 }, { messstelle: 'Breite', anzahl: 2 }]
        const DEMO_PRUEFER = [
          { pruefer_name: 'Kevin', gesamt: 8, bestanden: 7 },
          { pruefer_name: 'Maria', gesamt: 6, bestanden: 5 },
        ]

        const verteilung = isDemo ? DEMO_VERTEILUNG : statsVerteilung
        const trend = isDemo ? DEMO_TREND : statsTrend
        const abweichungen = isDemo ? DEMO_ABWEICHUNGEN : statsAbweichungen
        const pruefer = isDemo ? DEMO_PRUEFER : statsPruefer

        const COLORS: Record<string, string> = { bestanden: '#10b981', nachbesserung: '#f59e0b', ausschuss: '#ef4444', offen: '#aeb9c8' }
        const totalVerteilung = verteilung.reduce((s, v) => s + v.anzahl, 0)

        const zeitraeume: { id: QmStatistikZeitraum; label: string }[] = [
          { id: 'woche', label: 'Woche' },
          { id: 'monat', label: 'Monat' },
          { id: 'quartal', label: 'Quartal' },
          { id: 'gesamt', label: 'Gesamt' },
        ]

        return (
          <div>
            {/* Zeitraum-Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aeb9c8' }}>Zeitraum:</span>
              {zeitraeume.map(z => (
                <button key={z.id}
                  onClick={() => setStatsZeitraum(z.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
                    background: statsZeitraum === z.id ? `${QM_COLOR}20` : 'transparent',
                    color: statsZeitraum === z.id ? QM_COLOR : '#aeb9c8',
                    fontWeight: statsZeitraum === z.id ? 700 : 500,
                    outline: statsZeitraum === z.id ? `1.5px solid ${QM_COLOR}50` : 'none',
                  }}>
                  {z.label}
                </button>
              ))}
              {statsLoading && <span style={{ fontSize: 12, color: '#aeb9c8' }}>⏳ Lade…</span>}
            </div>

            {/* KPI-Karten */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              {[
                { label: 'Berichte gesamt', value: totalVerteilung, icon: '📋', color: QM_COLOR },
                { label: 'Bestanden', value: verteilung.find(v => v.gesamtstatus === 'bestanden')?.anzahl ?? 0, icon: '✅', color: '#10b981' },
                { label: 'Nachbesserung', value: verteilung.find(v => v.gesamtstatus === 'nachbesserung')?.anzahl ?? 0, icon: '⚠️', color: '#f59e0b' },
                { label: 'Ausschuss', value: verteilung.find(v => v.gesamtstatus === 'ausschuss')?.anzahl ?? 0, icon: '❌', color: '#ef4444' },
              ].map(k => (
                <div key={k.label} className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {/* Status-Verteilung PieChart */}
              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📊 Status-Verteilung</div>
                {verteilung.length === 0 ? (
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Daten.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={verteilung} dataKey="anzahl" nameKey="gesamtstatus" cx="50%" cy="50%" outerRadius={80} label={(p: { name?: string; percent?: number }) => `${p.name ?? ''} ${((p.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {verteilung.map((entry, i) => (
                          <Cell key={i} fill={COLORS[entry.gesamtstatus] ?? '#aeb9c8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}`, 'Anzahl']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Fehlerquote-Trend LineChart */}
              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📉 Fehlerquote (8 Wochen)</div>
                {trend.length === 0 ? (
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Daten.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trend.map(t => ({ ...t, quote: t.gesamt > 0 ? parseFloat((t.fehler / t.gesamt * 100).toFixed(1)) : 0, woche: t.woche.slice(5) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                      <XAxis dataKey="woche" tick={{ fill: '#aeb9c8', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#aeb9c8', fontSize: 10 }} unit="%" />
                      <Tooltip formatter={(v) => [`${v}%`, 'Fehlerquote']} />
                      <Line type="monotone" dataKey="quote" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Häufigste Abweichungen BarChart */}
              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>🔴 Häufigste Abweichungen</div>
                {abweichungen.length === 0 ? (
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine roten Messwerte.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={abweichungen} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                      <XAxis type="number" tick={{ fill: '#aeb9c8', fontSize: 10 }} />
                      <YAxis type="category" dataKey="messstelle" tick={{ fill: '#aeb9c8', fontSize: 11 }} width={90} />
                      <Tooltip formatter={(v) => [`${v}×`, 'Abweichungen']} />
                      <Bar dataKey="anzahl" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Prüfer-Performance Tabelle */}
              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>🏆 Prüfer-Performance</div>
                {pruefer.length === 0 ? (
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Daten.</div>
                ) : (
                  <table className="pk-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Prüfer</th>
                        <th style={{ textAlign: 'right' }}>Berichte</th>
                        <th style={{ textAlign: 'right' }}>Bestanden</th>
                        <th style={{ textAlign: 'right' }}>Quote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pruefer.map(p => {
                        const pct = p.gesamt > 0 ? Math.round(p.bestanden / p.gesamt * 100) : 0
                        return (
                          <tr key={p.pruefer_name}>
                            <td style={{ fontWeight: 700 }}>{p.pruefer_name}</td>
                            <td style={{ textAlign: 'right' }}>{p.gesamt}</td>
                            <td style={{ textAlign: 'right' }}>{p.bestanden}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444' }}>{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── SPC-Analyse-Panel ── */}
            {(() => {
              // Bauteil-IDs from loaded berichte
              const bauteilIds = Array.from(new Set(berichte.map(b => b.bauteil_id).filter(Boolean))) as string[]

              async function loadSpcMessstellen(bId: string) {
                setSpcMessstellen([])
                setSpcMessstelle('')
                if (isDemo) {
                  setSpcMessstellen(['Länge', 'Ø Bohrung', 'Breite'])
                  return
                }
                setSpcMsLoading(true)
                try {
                  const r = await fetch(`/api/qm/spc-daten?mode=messstellen&bauteil_id=${encodeURIComponent(bId)}`)
                  const ms = await r.json() as string[]
                  setSpcMessstellen(ms)
                } catch { /* ignore */ } finally { setSpcMsLoading(false) }
              }

              async function runSpcAnalyse() {
                if (!spcBauteilId || !spcMessstelle) return
                if (isDemo) {
                  setSpcData(DEMO_SPC_DATEN)
                  return
                }
                setSpcLoading(true)
                setSpcData(null)
                try {
                  const r = await fetch(`/api/qm/spc-daten?messstelle=${encodeURIComponent(spcMessstelle)}&bauteil_id=${encodeURIComponent(spcBauteilId)}&limit=50`)
                  const rows = await r.json() as SpcRow[]
                  setSpcData(Array.isArray(rows) ? rows : [])
                } catch { setSpcData([]) } finally { setSpcLoading(false) }
              }

              // Compute SPC if data available
              const spcRows = spcData ?? []
              const validRows = spcRows.filter(r => r.istwert != null && r.sollwert != null)
              const spcResult: SpcResult | null = validRows.length >= 2
                ? calculateSPC(
                    validRows.map(r => r.istwert),
                    validRows[0].sollwert,
                    validRows[0].toleranz_plus ?? 0,
                    validRows[0].toleranz_minus ?? 0,
                  )
                : null

              const chartData = validRows.map((r, i) => ({
                idx: i + 1,
                datum: r.pruef_datum?.slice(5) ?? '',
                wert: r.istwert,
                status: r.status,
              }))

              const dotColor = (status: string) =>
                status === 'rot' ? '#ef4444' : status === 'orange' ? '#f59e0b' : '#10b981'

              return (
                <div className="pk-card" style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: QM_COLOR }}>📐</span> Prozessfähigkeit (SPC)
                  </div>

                  {/* Auswahl */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Bauteil-ID</div>
                      <select
                        className="pk-input"
                        value={spcBauteilId}
                        onChange={e => { setSpcBauteilId(e.target.value); void loadSpcMessstellen(e.target.value) }}
                        style={{ minWidth: 160 }}
                      >
                        <option value="">— Bauteil wählen —</option>
                        {(isDemo ? ['Stempel-B', 'Flansch-A', 'Welle-C'] : bauteilIds).map(id => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>
                        Messstelle {spcMsLoading && <span>⏳</span>}
                      </div>
                      <select
                        className="pk-input"
                        value={spcMessstelle}
                        onChange={e => setSpcMessstelle(e.target.value)}
                        disabled={!spcBauteilId}
                        style={{ minWidth: 160 }}
                      >
                        <option value="">— Messstelle wählen —</option>
                        {spcMessstellen.map(ms => (
                          <option key={ms} value={ms}>{ms}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="pk-btn"
                      disabled={!spcBauteilId || !spcMessstelle || spcLoading}
                      onClick={() => void runSpcAnalyse()}
                      style={{ background: QM_COLOR, border: 'none', padding: '8px 20px' }}
                    >
                      {spcLoading ? '⏳ Lädt…' : '▶ Analyse starten'}
                    </button>
                  </div>

                  {spcData === null && !spcLoading && (
                    <div style={{ color: '#aeb9c8', fontSize: 13, padding: '12px 0' }}>
                      Bauteil und Messstelle wählen, dann &quot;Analyse starten&quot; klicken.
                    </div>
                  )}

                  {spcData !== null && validRows.length === 0 && (
                    <div style={{ color: '#aeb9c8', fontSize: 13, padding: '12px 0' }}>
                      Keine Messwerte für diese Kombination gefunden.
                    </div>
                  )}

                  {spcResult && (
                    <>
                      {/* Hinweis wenn n < 10 */}
                      {spcResult.n < 10 && (
                        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', fontSize: 13 }}>
                          ⚠️ Mindestens 10 Messungen für aussagekräftige SPC empfohlen (aktuell: {spcResult.n})
                        </div>
                      )}

                      {/* KPI-Karten */}
                      <div className="stats-grid" style={{ marginBottom: 16 }}>
                        <div className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                          <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Cp</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: spcKpiColor(spcResult.cp) }}>
                            {spcResult.cp !== null ? spcResult.cp.toFixed(2) : '—'}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 4 }}>{spcKpiLabel(spcResult.cp)}</div>
                        </div>
                        <div className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                          <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Cpk</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: spcKpiColor(spcResult.cpk) }}>
                            {spcResult.cpk !== null ? spcResult.cpk.toFixed(2) : '—'}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 4 }}>{spcKpiLabel(spcResult.cpk)}</div>
                        </div>
                        <div className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                          <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Ø Wert</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: QM_COLOR }}>
                            {spcResult.mean.toFixed(3)}
                          </div>
                          <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>mm (n={spcResult.n})</div>
                        </div>
                        <div className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                          <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Trend</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: spcResult.trendSlope > 0.001 ? '#f59e0b' : spcResult.trendSlope < -0.001 ? '#f59e0b' : '#10b981', marginTop: 4 }}>
                            {spcResult.trend}
                          </div>
                        </div>
                      </div>

                      {/* Cp/Cpk Legende (klappbar) */}
                      <details style={{ marginBottom: 16 }}>
                        <summary style={{ fontSize: 12, color: '#aeb9c8', cursor: 'pointer', userSelect: 'none' }}>
                          ℹ️ Cp/Cpk Bewertungsskala
                        </summary>
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {[
                            { label: '≥ 1.67', desc: 'Sehr gut (Six Sigma)', color: '#10b981' },
                            { label: '≥ 1.33', desc: 'Gut (ISO 9001)', color: '#10b981' },
                            { label: '1.00–1.33', desc: 'Akzeptabel (überwachen)', color: '#f59e0b' },
                            { label: '< 1.00', desc: 'Kritisch (verbessern)', color: '#ef4444' },
                          ].map(e => (
                            <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                              <strong style={{ color: e.color }}>{e.label}</strong>
                              <span style={{ color: '#aeb9c8' }}>{e.desc}</span>
                            </div>
                          ))}
                        </div>
                      </details>

                      {/* LineChart: Messwerte über Zeit */}
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                        📈 Messwert-Verlauf — {spcBauteilId} / {spcMessstelle}
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                          <XAxis dataKey="datum" tick={{ fill: '#aeb9c8', fontSize: 10 }} />
                          <YAxis
                            tick={{ fill: '#aeb9c8', fontSize: 10 }}
                            domain={[
                              (dataMin: number) => Math.min(dataMin, spcResult.lsl) - 0.02,
                              (dataMax: number) => Math.max(dataMax, spcResult.usl) + 0.02,
                            ]}
                            tickFormatter={(v: number) => v.toFixed(2)}
                          />
                          <Tooltip
                            formatter={(v) => [`${Number(v).toFixed(3)} mm`, 'Istwert']}
                            contentStyle={{ background: '#0b1420', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, fontSize: 12 }}
                          />
                          <ReferenceLine y={spcResult.usl} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'USL', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={spcResult.lsl} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'LSL', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={validRows[0].sollwert} stroke="rgba(174,185,200,.5)" strokeDasharray="4 2" label={{ value: 'Soll', fill: '#aeb9c8', fontSize: 10 }} />
                          <ReferenceLine y={spcResult.mean} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Ø', fill: '#f59e0b', fontSize: 10 }} />
                          <Line
                            type="monotone"
                            dataKey="wert"
                            stroke={QM_COLOR}
                            strokeWidth={2}
                            dot={(props: { cx?: number; cy?: number; payload?: { status: string }; index?: number }) => {
                              const { cx = 0, cy = 0, payload, index } = props
                              return (
                                <circle
                                  key={index}
                                  cx={cx}
                                  cy={cy}
                                  r={4}
                                  fill={dotColor(payload?.status ?? '')}
                                  stroke="none"
                                />
                              )
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ─── Team Tab ─── */}
      {tab === 'team' && (() => {
        function rolleBadge(rolle: QmTeamRolle) {
          if (rolle === 'admin')   return { label: 'Admin',  bg: 'rgba(22,132,255,.15)',  color: '#1684ff' }
          if (rolle === 'pruefer') return { label: 'Prüfer', bg: 'rgba(20,184,166,.15)',  color: '#14b8a6' }
          return                         { label: 'Viewer', bg: 'rgba(174,185,200,.1)',   color: '#aeb9c8' }
        }

        async function handleAddMitglied() {
          if (!teamForm.name.trim()) return
          setTeamSaving(true)
          try {
            await upsertQmTeamMitglied({ name: teamForm.name.trim(), email: teamForm.email.trim() || null, rolle: teamForm.rolle, aktiv: true })
            setShowTeamModal(false)
            setTeamForm({ name: '', email: '', rolle: 'pruefer' })
            await loadTeam()
            showToast('Mitglied hinzugefügt')
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Fehler', false)
          } finally {
            setTeamSaving(false)
          }
        }

        async function handleDeleteMitglied(id: string) {
          try {
            await deleteQmTeamMitglied(id)
            setDeleteConfirmTeam(null)
            await loadTeam()
            showToast('Mitglied gelöscht')
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'Fehler', false)
          }
        }

        return (
          <div>
            {isDemo && (
              <div className="pk-card" style={{ marginBottom: 14, border: '1px solid rgba(255,165,0,.3)', color: '#ffb347', fontSize: 13 }}>
                ● Demo-Modus: Team-Verwaltung nicht verfügbar.
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>👥 Team-Mitglieder</span>
              {!isDemo && (
                <button className="pk-btn" style={{ marginLeft: 'auto', background: QM_COLOR, border: 'none', fontSize: 13, padding: '8px 16px' }}
                  onClick={() => setShowTeamModal(true)}>
                  + Mitglied hinzufügen
                </button>
              )}
            </div>

            <div className="pk-card">
              {teamLoading ? (
                <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>Lade…</div>
              ) : team.length === 0 ? (
                <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>
                  {isDemo ? 'Keine Demo-Daten.' : 'Noch keine Mitglieder. Klicke "+ Mitglied hinzufügen".'}
                </div>
              ) : (
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map(m => {
                        const rb = rolleBadge(m.rolle)
                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 700 }}>{m.name}</td>
                            <td style={{ color: '#aeb9c8', fontSize: 13 }}>{m.email ?? '—'}</td>
                            <td>
                              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color }}>
                                {rb.label}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: m.aktiv ? '#10b981' : '#aeb9c8' }}>
                                {m.aktiv ? '● Aktiv' : '○ Inaktiv'}
                              </span>
                            </td>
                            <td>
                              {deleteConfirmTeam === m.id ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }}
                                    onClick={() => void handleDeleteMitglied(m.id)}>Ja, löschen</button>
                                  <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                    onClick={() => setDeleteConfirmTeam(null)}>Abbrechen</button>
                                </div>
                              ) : (
                                <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                  onClick={() => setDeleteConfirmTeam(m.id)}>🗑️</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add Modal */}
            {showTeamModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={() => setShowTeamModal(false)}>
                <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Mitglied hinzufügen</h3>
                    <button onClick={() => setShowTeamModal(false)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Name *</div>
                      <input className="pk-input" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="Max Mustermann" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>E-Mail</div>
                      <input className="pk-input" type="email" value={teamForm.email} onChange={e => setTeamForm(f => ({ ...f, email: e.target.value }))} placeholder="max@firma.de" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Rolle</div>
                      <select className="pk-input" value={teamForm.rolle} onChange={e => setTeamForm(f => ({ ...f, rolle: e.target.value as QmTeamRolle }))}>
                        <option value="admin">Admin</option>
                        <option value="pruefer">Prüfer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <button className="pk-btn" disabled={teamSaving || !teamForm.name.trim()}
                      onClick={() => void handleAddMitglied()}
                      style={{ background: QM_COLOR, border: 'none', marginTop: 8 }}>
                      {teamSaving ? '⏳ Speichere…' : '💾 Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ─── Messmittel Tab ─── */}
      {tab === 'messmittel' && (() => {
        function mmStatusBadge(status: string) {
          if (status === 'ueberfaellig') return { label: '❌ Überfällig', bg: 'rgba(239,68,68,.15)', color: '#ef4444' }
          if (status === 'faellig')      return { label: '⚠️ Bald fällig', bg: 'rgba(245,158,11,.15)', color: '#f59e0b' }
          return                              { label: '✓ OK',            bg: 'rgba(16,185,129,.15)', color: '#10b981' }
        }

        const TYPEN: QmMessmittelTyp[] = ['Schieblehre', 'Mikrometer', 'Rauheitsmesser', 'Lehrdorn', 'Sonstiges']

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>🔧 Messmittel-Kalibrierung</span>
              <span style={{ fontSize: 11, color: '#aeb9c8' }}>ISO 9001 §7.1.5</span>
              <button className="pk-btn" style={{ marginLeft: 'auto', background: QM_COLOR, border: 'none', fontSize: 13, padding: '8px 16px' }}
                onClick={() => openMMModal()}>
                + Messmittel hinzufügen
              </button>
            </div>

            <div className="pk-card">
              {messmittelLoading ? (
                <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>Lade…</div>
              ) : messmittel.length === 0 ? (
                <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>
                  Noch keine Messmittel erfasst. Klicke &quot;+ Messmittel hinzufügen&quot;.
                </div>
              ) : (
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Typ</th>
                        <th>Serien-Nr.</th>
                        <th>Kalibriert am</th>
                        <th>Fällig am</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {messmittel.map(m => {
                        const badge = mmStatusBadge(m.status)
                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 700 }}>{m.name}</td>
                            <td style={{ color: '#aeb9c8', fontSize: 13 }}>{m.typ ?? '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.seriennummer ?? '—'}</td>
                            <td style={{ fontSize: 13 }}>{fmtDate(m.kalibriert_am)}</td>
                            <td style={{ fontSize: 13, color: m.status !== 'ok' ? badge.color : undefined }}>{fmtDate(m.kalibrierung_faellig_am)}</td>
                            <td>
                              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                                {badge.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                  onClick={() => openMMModal(m)}>✏️</button>
                                {deleteConfirmMM === m.id ? (
                                  <>
                                    <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }}
                                      onClick={() => void handleDeleteMM(m.id)}>Ja</button>
                                    <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                      onClick={() => setDeleteConfirmMM(null)}>Nein</button>
                                  </>
                                ) : (
                                  <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                    onClick={() => setDeleteConfirmMM(m.id)}>🗑️</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add/Edit Modal */}
            {showMMModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={() => setShowMMModal(false)}>
                <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{editingMM ? 'Messmittel bearbeiten' : 'Neues Messmittel'}</h3>
                    <button onClick={() => setShowMMModal(false)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Name *</div>
                      <input className="pk-input" value={mmForm.name} onChange={e => setMmForm(f => ({ ...f, name: e.target.value }))} placeholder="Schieblehre digital #1" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Typ</div>
                      <select className="pk-input" value={mmForm.typ} onChange={e => setMmForm(f => ({ ...f, typ: e.target.value }))}>
                        {TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Seriennummer</div>
                      <input className="pk-input" value={mmForm.seriennummer} onChange={e => setMmForm(f => ({ ...f, seriennummer: e.target.value }))} placeholder="SN-12345" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Hersteller</div>
                      <input className="pk-input" value={mmForm.hersteller} onChange={e => setMmForm(f => ({ ...f, hersteller: e.target.value }))} placeholder="Mitutoyo" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Messbereich</div>
                      <input className="pk-input" value={mmForm.messbereich} onChange={e => setMmForm(f => ({ ...f, messbereich: e.target.value }))} placeholder="0-150mm" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Auflösung</div>
                      <input className="pk-input" value={mmForm.aufloesung} onChange={e => setMmForm(f => ({ ...f, aufloesung: e.target.value }))} placeholder="0,01mm" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Kalibriert am</div>
                      <input className="pk-input" type="date" value={mmForm.kalibriert_am} onChange={e => setMmForm(f => ({ ...f, kalibriert_am: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Kalibrierung fällig am</div>
                      <input className="pk-input" type="date" value={mmForm.kalibrierung_faellig_am} onChange={e => setMmForm(f => ({ ...f, kalibrierung_faellig_am: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Intervall (Tage)</div>
                      <input className="pk-input" type="number" value={mmForm.kalibrierungs_intervall_tage} onChange={e => setMmForm(f => ({ ...f, kalibrierungs_intervall_tage: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Notiz</div>
                      <textarea className="pk-input" value={mmForm.notiz} onChange={e => setMmForm(f => ({ ...f, notiz: e.target.value }))} rows={2} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <button className="pk-btn" disabled={mmSaving || !mmForm.name.trim()}
                        onClick={() => void handleSaveMM()}
                        style={{ background: QM_COLOR, border: 'none', width: '100%' }}>
                        {mmSaving ? '⏳ Speichere…' : '💾 Speichern'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Email Modal */}
      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEmailModal(null)}>
          <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📧 Prüfbericht per E-Mail</h3>
              <button onClick={() => setEmailModal(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ color: '#aeb9c8', fontSize: 12, marginBottom: 14 }}>
              {emailModal.pruefbericht_nr} · {emailModal.bauteil_id ?? '—'} · {fmtDate(emailModal.pruef_datum)}
            </div>

            {resendConfigured === false && !isDemo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', fontSize: 13 }}>
                  ⚠️ E-Mail-Versand nicht konfiguriert — PDF manuell herunterladen.
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>E-Mail-Adresse (für mailto-Link)</div>
                  <input className="pk-input" type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} placeholder="kunde@firma.de" />
                </div>
                <a
                  href={emailAddr ? `mailto:${emailAddr}&${getMailtoLink(emailModal).slice(7)}` : getMailtoLink(emailModal)}
                  className="pk-btn"
                  style={{ background: QM_COLOR, border: 'none', textDecoration: 'none', textAlign: 'center', padding: '12px 20px' }}
                  onClick={() => setEmailModal(null)}
                >
                  📧 E-Mail vorbereiten
                </a>
                <div style={{ fontSize: 11, color: '#aeb9c8' }}>
                  Kein Anhang via mailto möglich — PDF bitte separat herunterladen und anhängen.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Empfänger E-Mail *</div>
                  <input className="pk-input" type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} placeholder="kunde@firma.de" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Empfänger Name (optional)</div>
                  <input className="pk-input" value={emailName} onChange={e => setEmailName(e.target.value)} placeholder="Max Mustermann" />
                </div>
                <button
                  className="pk-btn"
                  disabled={emailSending || !emailAddr.trim()}
                  onClick={() => void handleSendEmail()}
                  style={{ background: QM_COLOR, border: 'none', padding: '12px 20px' }}
                >
                  {emailSending ? '⏳ Sendet…' : '📧 Per E-Mail senden'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
          padding: '14px 20px', borderRadius: 12, maxWidth: 380,
          background: toast.ok ? 'rgba(37,211,102,.12)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.35)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
          fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
