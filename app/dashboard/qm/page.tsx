'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { generateQmPruefberichtPDF } from '@/lib/qm-pdf'
import {
  getQmPruefberichte,
  type QmGesamtstatus,
  type QmPruefbericht,
} from '@/lib/db/qm'

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

type Tab = 'dashboard' | 'zeichnungen' | 'archiv' | 'statistiken'

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function QMPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const isDemo = hasDemoCookie()

  const [berichte, setBerichte] = useState<QmPruefbericht[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Archiv filters
  const [search, setSearch] = useState('')
  const [filterPruefer, setFilterPruefer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // PDF generation state
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

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
      } else {
        const rows = await getQmPruefberichte()
        setBerichte(rows)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
      if (isDemo) setBerichte(DEMO_BERICHTE)
    } finally {
      setLoading(false)
    }
  }, [isDemo])

  useEffect(() => { void loadBerichte() }, [loadBerichte])

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
                                <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                                  {badge.label}
                                </span>
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
                            <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                              {badge.label}
                            </span>
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
        const gesamt = berichte.length
        const bestandenGes = berichte.filter(b => b.gesamtstatus === 'bestanden').length
        const nachGes = berichte.filter(b => b.gesamtstatus === 'nachbesserung').length
        const ausschussGes = berichte.filter(b => b.gesamtstatus === 'ausschuss').length
        const bestandenPct = gesamt > 0 ? Math.round(bestandenGes / gesamt * 100) : 0
        const nachPct = gesamt > 0 ? Math.round(nachGes / gesamt * 100) : 0
        const ausschussPct = gesamt > 0 ? Math.round(ausschussGes / gesamt * 100) : 0

        // Prüfer performance
        const prueферStats: Record<string, { berichte: number; fehler: number }> = {}
        for (const b of berichte) {
          const p = b.pruefer_name ?? 'Unbekannt'
          if (!prueферStats[p]) prueферStats[p] = { berichte: 0, fehler: 0 }
          prueферStats[p].berichte++
          if (b.gesamtstatus === 'nachbesserung' || b.gesamtstatus === 'ausschuss') prueферStats[p].fehler++
        }
        const prueферList = Object.entries(prueферStats)
          .map(([name, s]) => ({ name, berichte: s.berichte, fehlerquote: s.berichte > 0 ? (s.fehler / s.berichte * 100).toFixed(1) + '%' : '0%' }))
          .sort((a, b) => b.berichte - a.berichte)

        return (
          <div>
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              {[
                { label: 'Prüfberichte gesamt', value: String(gesamt), icon: '📋', color: QM_COLOR },
                { label: 'Bestanden gesamt', value: String(bestandenGes), icon: '✅', color: '#10b981' },
                { label: 'Nachbesserung', value: String(nachGes), icon: '⚠️', color: '#f59e0b' },
                { label: 'Ausschuss', value: String(ausschussGes), icon: '❌', color: '#ef4444' },
              ].map(k => (
                <div key={k.label} className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📊 Status-Verteilung</div>
                {[
                  { label: 'Bestanden', pct: bestandenPct, color: '#10b981' },
                  { label: 'Nachbesserung', pct: nachPct, color: '#f59e0b' },
                  { label: 'Ausschuss', pct: ausschussPct, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 700 }}>{s.pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)' }}>
                      <div style={{ height: 6, borderRadius: 3, background: s.color, width: `${s.pct}%`, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pk-card">
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>🏆 Prüfer-Performance</div>
                {prueферList.length === 0 ? (
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Berichte.</div>
                ) : prueферList.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: `${QM_COLOR}20`, border: `1px solid ${QM_COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: QM_COLOR }}>
                      {p.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#aeb9c8' }}>{p.berichte} Berichte</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: parseFloat(p.fehlerquote) < 5 ? '#10b981' : '#f59e0b' }}>{p.fehlerquote}</div>
                      <div style={{ fontSize: 11, color: '#aeb9c8' }}>Fehlerquote</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
