'use client'
import { useEffect, useState } from 'react'

const CURRENT_VERSION = '2.1.0'
const STORAGE_KEY = 'pk_last_seen_version'

const CHANGELOG: { version: string; date: string; items: { icon: string; text: string }[] }[] = [
  {
    version: '2.1.0',
    date: '19.05.2026',
    items: [
      { icon: '🔐', text: 'Audit-Logs: alle Lösch- und Anonymisier-Aktionen werden protokolliert' },
      { icon: '💰', text: 'KI-Kostentracking: Verbrauch pro User und Route in Echtzeit' },
      { icon: '📦', text: 'Nightly-Backup: automatische DB-Sicherung in sicheren Storage-Bucket' },
      { icon: '🔍', text: 'Globale Suche: Live-Suche über Lager, Kunden, Rechnungen, Werkstatt' },
      { icon: '📱', text: 'Swipe-Navigation: Tabs per Wischen wechseln (Mobile)' },
      { icon: '⚡', text: 'Performance: 23 Datenbank-Indizes für schnellere Ladezeiten' },
      { icon: '🛡️', text: 'Rate-Limiting & Zod-Validation auf alle KI-Routen' },
    ],
  },
  {
    version: '2.0.0',
    date: '18.05.2026',
    items: [
      { icon: '🤖', text: 'KI-Tagesbericht mit Aktionsvorschlägen im Lager-Pilot' },
      { icon: '📍', text: 'Stellplatz-Management mit KPI-Karten und Optimierungsvorschlägen' },
      { icon: '↔️', text: 'Umlagerungs-Workflow: 4-Schritt Transaktion mit Protokoll' },
      { icon: '🧺', text: 'Kommissionierungs-Tab mit route-optimierter Pickliste' },
      { icon: '📊', text: 'Analyse-Pilot: Live-Daten aus Supabase mit Demo-Fallback' },
    ],
  },
]

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== CURRENT_VERSION) setOpen(true)
  }, [])

  function close() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={close}
    >
      <div
        className="pk-card fade-in"
        style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#1684ff', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Was ist neu
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fbff' }}>Petersen KI Updates</h2>
          </div>
          <button
            onClick={close}
            style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1 }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {CHANGELOG.map((release, ri) => (
          <div key={release.version} style={{ marginBottom: ri < CHANGELOG.length - 1 ? 24 : 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.06)',
            }}>
              <span style={{
                background: ri === 0 ? 'rgba(22,132,255,.15)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${ri === 0 ? 'rgba(22,132,255,.4)' : 'rgba(255,255,255,.1)'}`,
                color: ri === 0 ? '#1684ff' : '#aeb9c8',
                borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                v{release.version}
              </span>
              <span style={{ color: '#aeb9c8', fontSize: 12 }}>{release.date}</span>
              {ri === 0 && (
                <span style={{
                  marginLeft: 'auto', background: 'rgba(16,185,129,.15)',
                  border: '1px solid rgba(16,185,129,.4)', color: '#10b981',
                  borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                }}>
                  AKTUELL
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {release.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: '#c8d4e0', lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <button className="pk-btn" onClick={close} style={{ width: '100%' }}>
            Verstanden — weiter zur App
          </button>
        </div>
      </div>
    </div>
  )
}
