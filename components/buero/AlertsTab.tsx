'use client'
import React from 'react'
import type { Kunde, Rechnung, Auftrag } from '@/types/buero'
import { StatusBadgeRechnung } from './shared'

function AlertsTab({ kunden, rechnungen, auftraege }: { kunden: Kunde[]; rechnungen: Rechnung[]; auftraege: Auftrag[] }) {
  function parseDE(s?: string): Date | null {
    if (!s) return null
    const p = s.split('.')
    if (p.length !== 3) return null
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  const now = Date.now()
  const day = 86400000

  // Überfällige + Mahnung
  const ueberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung')
    .map(r => {
      const d = parseDE(r.faellig)
      const tage = d ? Math.floor((now - d.getTime()) / day) : 0
      return { ...r, tageUeberfaellig: tage }
    })
    .sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig)

  // Bald fällig (offen, in 14 Tagen)
  const baldFaellig = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Erstellt')
    .map(r => {
      const d = parseDE(r.faellig)
      const tage = d ? Math.floor((d.getTime() - now) / day) : 999
      return { ...r, tageBisFaellig: tage }
    })
    .filter(r => r.tageBisFaellig >= 0 && r.tageBisFaellig <= 14)
    .sort((a, b) => a.tageBisFaellig - b.tageBisFaellig)

  // Inaktive Kunden (kein Auftrag + keine Rechnung in letzten 90 Tagen)
  const inaktiveKunden = kunden.filter(k => {
    if (k.status === 'Inaktiv') return true
    const alleAuftraege = auftraege.filter(a => a.kunde === k.name || a.kunde_id === k.id)
    const alleRechnungen = rechnungen.filter(r => r.kunde === k.name || r.kunde_id === k.id)
    const letzteAktivitaet = [...alleAuftraege.map(a => parseDE(a.start)), ...alleRechnungen.map(r => parseDE(r.erstellt))]
      .filter(Boolean)
      .map(d => d!.getTime())
    if (letzteAktivitaet.length === 0) return true
    return (now - Math.max(...letzteAktivitaet)) > 90 * day
  }).slice(0, 10)

  const rowStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Überfällig */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#ff6060', fontWeight: 800 }}>🔴 Überfällig / Mahnung ({ueberfaellig.length})</span>
        </div>
        {ueberfaellig.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Keine überfälligen Rechnungen ✅</div>
        ) : ueberfaellig.map(r => (
          <div key={r.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kunde}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{r.nummer || r.id} · Fällig: {r.faellig} · {r.tageUeberfaellig > 0 ? `${r.tageUeberfaellig} Tage überfällig` : 'heute fällig'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 900, color: '#ff6060' }}>{r.betrag}</span>
              <StatusBadgeRechnung status={r.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Bald fällig */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ color: '#f59e0b', fontWeight: 800 }}>⚠️ Fällig in ≤ 14 Tagen ({baldFaellig.length})</span>
        </div>
        {baldFaellig.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Keine dringenden Fälligkeiten</div>
        ) : baldFaellig.map(r => (
          <div key={r.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.kunde}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{r.nummer || r.id} · Fällig: {r.faellig} · in {r.tageBisFaellig} Tag{r.tageBisFaellig !== 1 ? 'en' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontWeight: 900, color: '#f59e0b' }}>{r.betrag}</span>
              <StatusBadgeRechnung status={r.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Inaktive Kunden */}
      <div className="pk-card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span style={{ color: '#aeb9c8', fontWeight: 800 }}>💤 Inaktive Kunden &gt;90 Tage ({inaktiveKunden.length})</span>
        </div>
        {inaktiveKunden.length === 0 ? (
          <div style={{ padding: '20px 16px', color: '#aeb9c8', fontSize: 13 }}>Alle Kunden aktiv</div>
        ) : inaktiveKunden.map(k => (
          <div key={k.id} style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{k.typ === 'Firma' ? '🏢' : '👤'} {k.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12 }}>{k.id} · {k.ort} · {k.ansprechpartner}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ color: '#aeb9c8', fontSize: 13 }}>{k.umsatz}</span>
              <span className={`badge ${k.status === 'Aktiv' ? 'badge-gray' : 'badge-red'}`}>{k.status === 'Aktiv' ? 'Keine Aktivität' : 'Inaktiv'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AlertsTab
