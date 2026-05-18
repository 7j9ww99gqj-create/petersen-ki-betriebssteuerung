'use client'
import React from 'react'
import type { Angebot, Auftrag, Rechnung, Tab } from '@/types/buero'
import { parseBetrag } from '@/types/buero'

// suppress unused import warning
void parseBetrag

function PipelineKanbanTab({ angebote, auftraege, rechnungen, setTab }: {
  angebote: Angebot[]; auftraege: Auftrag[]; rechnungen: Rechnung[]
  setTab: (t: Tab) => void
}) {
  const cols: { id: string; label: string; color: string; accent: string }[] = [
    { id: 'angebot', label: 'Angebot', color: 'rgba(99,102,241,.15)', accent: '#818cf8' },
    { id: 'auftrag', label: 'Auftrag', color: 'rgba(59,130,246,.15)', accent: '#20c8ff' },
    { id: 'in_bearbeitung', label: 'In Bearbeitung', color: 'rgba(245,158,11,.12)', accent: '#f59e0b' },
    { id: 'rechnung', label: 'Rechnung', color: 'rgba(16,185,129,.12)', accent: '#10b981' },
    { id: 'bezahlt', label: 'Bezahlt', color: 'rgba(107,114,128,.12)', accent: '#6b7280' },
  ]

  const angeboteOffen = angebote.filter(a => ['Erstellt', 'Versendet'].includes(a.status))
  const auftraegeNeu = auftraege.filter(a => ['AB erforderlich', 'AB erstellt', 'AB versendet', 'Geplant'].includes(a.status))
  const auftraegeAktiv = auftraege.filter(a => ['In Bearbeitung'].includes(a.status))
  const rechnungenOffen = rechnungen.filter(r => ['Erstellt', 'Offen', 'Mahnung', 'Überfällig'].includes(r.status))
  const rechnungenBezahlt = rechnungen.filter(r => r.status === 'Bezahlt')

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    transition: 'background .15s',
  }

  function fmt(betrag: string) {
    const n = parseFloat(betrag?.replace(',', '.') ?? '0')
    return isNaN(n) ? betrag : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  }

  const colItems = [angeboteOffen, auftraegeNeu, auftraegeAktiv, rechnungenOffen, rechnungenBezahlt]
  const colSums = [
    angeboteOffen.reduce((s, a) => s + parseFloat(a.betrag?.replace(',', '.') ?? '0'), 0),
    auftraegeNeu.reduce((s, a) => s + parseFloat(a.wert?.replace(',', '.') ?? '0'), 0),
    auftraegeAktiv.reduce((s, a) => s + parseFloat(a.wert?.replace(',', '.') ?? '0'), 0),
    rechnungenOffen.reduce((s, r) => s + parseFloat(r.betrag?.replace(',', '.') ?? '0'), 0),
    rechnungenBezahlt.reduce((s, r) => s + parseFloat(r.betrag?.replace(',', '.') ?? '0'), 0),
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🔀 Sales Pipeline</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#aeb9c8' }}>Übersicht aller offenen Deals vom Angebot bis zur Bezahlung</p>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {cols.map((col, ci) => (
          <div key={col.id} style={{ minWidth: 220, maxWidth: 260, flex: '0 0 220px', background: col.color, borderRadius: 12, padding: 12, border: `1px solid ${col.accent}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: col.accent }}>{col.label}</span>
              <span style={{ fontSize: 11, background: `${col.accent}22`, color: col.accent, borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
                {colItems[ci].length}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 10, fontWeight: 600 }}>
              Σ {colSums[ci].toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </div>
            {colItems[ci].length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4a5568', fontSize: 12 }}>Keine Einträge</div>
            )}
            {colItems[ci].map((item: Angebot | Auftrag | Rechnung) => {
              const isAngebot = ci === 0
              const isRechnung = ci >= 3
              const titel = isAngebot ? (item as Angebot).titel : isRechnung ? (item as Rechnung).kunde : (item as Auftrag).beschreibung
              const kunde = isAngebot ? (item as Angebot).kunde : isRechnung ? '' : (item as Auftrag).kunde
              const betrag = isAngebot ? (item as Angebot).betrag : isRechnung ? (item as Rechnung).betrag : (item as Auftrag).wert
              const status = (item as Angebot | Auftrag | Rechnung).status
              const targetTab: Tab = isAngebot ? 'angebote' : isRechnung ? 'rechnungen' : 'auftraege'
              return (
                <div key={item.id} style={cardStyle} onClick={() => setTab(targetTab)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)') }
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)') }
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fbff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel || '—'}</div>
                  {kunde && <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{kunde}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.accent }}>{fmt(betrag)}</span>
                    <span style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px', color: '#aeb9c8' }}>{status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PipelineKanbanTab
