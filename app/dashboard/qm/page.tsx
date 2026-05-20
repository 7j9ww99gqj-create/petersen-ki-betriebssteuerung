'use client'
import { useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'

const QM_COLOR = '#14b8a6'

const DEMO_BERICHTE = [
  { id: 'PB-2026-012', bauteil: 'Stempel-B', zeichnung: 'ZN-2041', datum: '19.05.2026', pruefer: 'Kevin', status: 'bestanden' },
  { id: 'PB-2026-011', bauteil: 'Flansch-A', zeichnung: 'ZN-2039', datum: '18.05.2026', pruefer: 'Maria', status: 'nachbesserung' },
  { id: 'PB-2026-010', bauteil: 'Welle-C',   zeichnung: 'ZN-2037', datum: '17.05.2026', pruefer: 'Frank', status: 'bestanden' },
  { id: 'PB-2026-009', bauteil: 'Buchse-D',  zeichnung: 'ZN-2035', datum: '16.05.2026', pruefer: 'Kevin', status: 'ausschuss' },
  { id: 'PB-2026-008', bauteil: 'Stempel-A', zeichnung: 'ZN-2041', datum: '14.05.2026', pruefer: 'Maria', status: 'bestanden' },
]

const DEMO_ZEICHNUNGEN = [
  { id: 'ZN-2043', name: 'Halter-E Rev.A', material: 'Stahl C45', datum: '20.05.2026', status: 'neu' },
  { id: 'ZN-2042', name: 'Buchse-E Rev.B', material: 'Aluminium', datum: '19.05.2026', status: 'neu' },
]

type Tab = 'dashboard' | 'zeichnungen' | 'archiv' | 'statistiken'

const statusBadge = (status: string) => {
  if (status === 'bestanden')    return { label: '✅ Bestanden',    bg: 'rgba(16,185,129,.15)', color: '#10b981' }
  if (status === 'nachbesserung') return { label: '⚠️ Nachbesserung', bg: 'rgba(245,158,11,.15)', color: '#f59e0b' }
  if (status === 'ausschuss')    return { label: '❌ Ausschuss',    bg: 'rgba(239,68,68,.15)',  color: '#ef4444' }
  if (status === 'neu')          return { label: '🆕 Neu',          bg: 'rgba(20,184,166,.15)', color: '#14b8a6' }
  return { label: status, bg: 'rgba(174,185,200,.1)', color: '#aeb9c8' }
}

export default function QMPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const isDemo = hasDemoCookie()

  const kpis = [
    { label: 'Prüfberichte (Woche)', value: '12', icon: '📋', color: QM_COLOR },
    { label: 'Bestanden', value: '10', icon: '✅', color: '#10b981' },
    { label: 'Nachbesserung', value: '2', icon: '⚠️', color: '#f59e0b' },
    { label: 'Fehlerquote', value: '2,5%', icon: '📊', color: '#aeb9c8' },
  ]

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard',    label: 'Dashboard',    icon: '📊' },
    { id: 'zeichnungen',  label: 'Zeichnungen',  icon: '🖼️' },
    { id: 'archiv',       label: 'Archiv',       icon: '📁' },
    { id: 'statistiken',  label: 'Statistiken',  icon: '📈' },
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
          <button className="pk-btn-ghost" style={{ fontSize: 13, padding: '8px 14px' }}
            onClick={() => alert('Zeichnungs-Upload — kommt in Phase 1')}>
            📤 Zeichnung hochladen
          </button>
          <button className="pk-btn" style={{ fontSize: 13, padding: '8px 14px', background: QM_COLOR, border: 'none' }}
            onClick={() => alert('Prüfbericht-Wizard — kommt in Phase 1')}>
            📋 Prüfbericht starten
          </button>
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

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div>
          {/* KPI-Karten */}
          <div className="stats-grid" style={{ marginBottom: 22 }}>
            {kpis.map(k => (
              <div key={k.label} className="pk-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Wartende Zeichnungen */}
          {DEMO_ZEICHNUNGEN.length > 0 && (
            <div className="pk-card" style={{ marginBottom: 18, border: `1px solid ${QM_COLOR}25` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>🖼️</span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Neue Zeichnungen — warten auf Prüfung</span>
                <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: `${QM_COLOR}20`, color: QM_COLOR, fontSize: 11, fontWeight: 700 }}>
                  {DEMO_ZEICHNUNGEN.length} neu
                </span>
              </div>
              {DEMO_ZEICHNUNGEN.map(z => {
                const badge = statusBadge(z.status)
                return (
                  <div key={z.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 18 }}>📐</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{z.name}</div>
                      <div style={{ fontSize: 12, color: '#aeb9c8' }}>{z.id} · {z.material} · {z.datum}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    <button className="pk-btn" style={{ fontSize: 12, padding: '6px 12px', background: QM_COLOR, border: 'none' }}
                      onClick={() => alert('Prüfbericht-Wizard — kommt in Phase 1')}>
                      Prüfen →
                    </button>
                  </div>
                )
              })}
            </div>
          )}

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
                  {DEMO_BERICHTE.slice(0, 5).map(b => {
                    const badge = statusBadge(b.status)
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: QM_COLOR, fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                        <td style={{ fontWeight: 600 }}>{b.bauteil}</td>
                        <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                        <td style={{ fontSize: 13 }}>{b.pruefer}</td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => alert('PDF-Export — kommt in Phase 1')}>
                            📥 PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Zeichnungen Tab */}
      {tab === 'zeichnungen' && (
        <div>
          {/* Upload-Zone */}
          <div className="pk-card" style={{ marginBottom: 20, border: `2px dashed ${QM_COLOR}40`, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Zeichnung hochladen</div>
            <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 18 }}>
              PDF, PNG, JPG, DXF · max. 20 MB · KI analysiert automatisch Maße & Toleranzen
            </div>
            <button className="pk-btn" style={{ background: QM_COLOR, border: 'none' }}
              onClick={() => alert('Zeichnungs-Upload mit KI-Analyse — kommt in Phase 1')}>
              📂 Datei auswählen
            </button>
          </div>

          {/* Zeichnungs-Bibliothek */}
          <div className="pk-card">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>📚 Zeichnungs-Bibliothek</div>
            {[...DEMO_ZEICHNUNGEN, { id: 'ZN-2041', name: 'Stempel-B Rev.A', material: 'C45', datum: '10.05.2026', status: 'aktiv' }, { id: 'ZN-2039', name: 'Flansch-A Rev.C', material: 'V2A', datum: '08.05.2026', status: 'aktiv' }].map(z => {
              const badge = statusBadge(z.status === 'aktiv' ? 'bestanden' : z.status)
              return (
                <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${QM_COLOR}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📐</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{z.name}</div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>{z.id} · Material: {z.material} · {z.datum}</div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  <button className="pk-btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={() => alert('Zeichnungs-Detail — kommt in Phase 1')}>Details</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Archiv Tab */}
      {tab === 'archiv' && (
        <div>
          <div className="pk-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <input className="pk-input" placeholder="Bauteil-ID, Zeichnungsnr. suchen…" style={{ flex: 1, minWidth: 200 }} readOnly />
              <select className="pk-input" style={{ width: 140 }}>
                <option>Alle Prüfer</option>
                <option>Kevin</option>
                <option>Maria</option>
                <option>Frank</option>
              </select>
              <select className="pk-input" style={{ width: 160 }}>
                <option>Alle Status</option>
                <option>Bestanden</option>
                <option>Nachbesserung</option>
                <option>Ausschuss</option>
              </select>
            </div>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Bericht-Nr.</th>
                    <th>Bauteil</th>
                    <th>Zeichnung</th>
                    <th>Datum</th>
                    <th>Prüfer</th>
                    <th>Status</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_BERICHTE.map(b => {
                    const badge = statusBadge(b.status)
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => alert(`Prüfbericht ${b.id} — Detail-Ansicht kommt in Phase 1`)}>
                        <td style={{ fontWeight: 700, color: QM_COLOR, fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                        <td style={{ fontWeight: 600 }}>{b.bauteil}</td>
                        <td style={{ fontSize: 12, color: '#aeb9c8' }}>{b.zeichnung}</td>
                        <td style={{ fontSize: 13, color: '#aeb9c8' }}>{b.datum}</td>
                        <td style={{ fontSize: 13 }}>{b.pruefer}</td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="pk-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => alert('PDF-Export — kommt in Phase 1')}>
                            📥
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Statistiken Tab */}
      {tab === 'statistiken' && (
        <div>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Prüfberichte gesamt', value: '48', icon: '📋', color: QM_COLOR },
              { label: 'Bestanden gesamt', value: '43', icon: '✅', color: '#10b981' },
              { label: 'Nachbesserung', value: '4', icon: '⚠️', color: '#f59e0b' },
              { label: 'Ausschuss', value: '1', icon: '❌', color: '#ef4444' },
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
                { label: 'Bestanden', pct: 90, color: '#10b981' },
                { label: 'Nachbesserung', pct: 8, color: '#f59e0b' },
                { label: 'Ausschuss', pct: 2, color: '#ef4444' },
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
              {[
                { name: 'Kevin', berichte: 22, fehler: '1,2%' },
                { name: 'Maria', berichte: 18, fehler: '3,8%' },
                { name: 'Frank', berichte: 8, fehler: '2,1%' },
              ].map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: `${QM_COLOR}20`, border: `1px solid ${QM_COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: QM_COLOR }}>
                    {p.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>{p.berichte} Berichte</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: parseFloat(p.fehler) < 2 ? '#10b981' : '#f59e0b' }}>{p.fehler}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>Fehlerquote</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pk-card">
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>⚠️ Häufigste Abweichungen</div>
              {[
                { name: 'Höhe außerhalb Toleranz', count: 8 },
                { name: 'Rauheit zu hoch',          count: 4 },
                { name: 'Durchmesser Grenzbereich', count: 3 },
                { name: 'Oberflächenkratzer',        count: 2 },
              ].map((a, i) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aeb9c8', width: 16 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                  <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>{a.count}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Banner */}
      <div style={{
        marginTop: 28, padding: '16px 20px', borderRadius: 14,
        background: `${QM_COLOR}08`, border: `1px solid ${QM_COLOR}25`,
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🚀</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: QM_COLOR }}>QM-Pilot — Phase 1 in Entwicklung</div>
          <div style={{ fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
            Dieses Dashboard zeigt eine Vorschau mit Demo-Daten. Die vollständige Implementierung bringt:
            Zeichnungs-Upload mit KI-Analyse · Prüfbericht-Wizard mit Messwert-Ampel · Foto-Dokumentation · PDF-Export · Team-Management
          </div>
        </div>
      </div>
    </div>
  )
}
