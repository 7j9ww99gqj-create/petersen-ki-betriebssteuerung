'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { generateQmPruefberichtPDF } from '@/lib/qm-pdf'
import {
  getQmPruefberichte,
  getQmPruefberichtIdsMitKiAnalyse,
  getQmTeamMitglieder,
  deleteQmTeamMitglied,
  upsertQmTeamMitglied,
  getQmStatusVerteilung,
  getQmFehlerquoteTrend,
  getQmHaeufigsteAbweichungen,
  getQmPrueferPerformance,
  type QmGesamtstatus,
  type QmPruefbericht,
  type QmTeamMitglied,
  type QmTeamRolle,
  type QmStatistikZeitraum,
  type QmStatusVerteilung,
  type QmFehlerquoteTrend,
  type QmHaeufigsteAbweichung,
  type QmPrueferPerformance,
} from '@/lib/db/qm'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
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

type Tab = 'dashboard' | 'zeichnungen' | 'archiv' | 'statistiken' | 'team'

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
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
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
