'use client'
import { useState } from 'react'

const archivData = [
  { id: 'DOC-001', name: 'Lieferschein LS-2025-08847', typ: 'Lieferschein', pilot: 'LagerPilot', datum: '06.05.2025', groesse: '124 KB', tags: ['Eingang', 'Metallbau GmbH'] },
  { id: 'DOC-002', name: 'Rechnung RE-2025-1123', typ: 'Rechnung', pilot: 'BüroPilot', datum: '05.05.2025', groesse: '89 KB', tags: ['Ausgang', 'Kunde'] },
  { id: 'DOC-003', name: 'Arbeitsauftrag AA-2025-034', typ: 'Arbeitsauftrag', pilot: 'WerkstattPilot', datum: '05.05.2025', groesse: '56 KB', tags: ['Werkstatt', 'Offen'] },
  { id: 'DOC-004', name: 'Inventurliste April 2025', typ: 'Inventur', pilot: 'LagerPilot', datum: '30.04.2025', groesse: '312 KB', tags: ['Inventur', 'Abgeschlossen'] },
  { id: 'DOC-005', name: 'KI-Erkennungsprotokoll Woche 18', typ: 'KI-Protokoll', pilot: 'KI Erkennung', datum: '04.05.2025', groesse: '45 KB', tags: ['KI', 'Automatisch'] },
  { id: 'DOC-006', name: 'Lieferschein LS-2025-08800', typ: 'Lieferschein', pilot: 'LagerPilot', datum: '02.05.2025', groesse: '98 KB', tags: ['Eingang'] },
]

export default function ArchivPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Alle')

  const typen = ['Alle', 'Lieferschein', 'Rechnung', 'Arbeitsauftrag', 'Inventur', 'KI-Protokoll']

  const filtered = archivData.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'Alle' || d.typ === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🗂️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Archiv</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Alle gespeicherten Dokumente & Vorgänge</p>
        </div>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{archivData.length} Dokumente</span>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="pk-input"
          placeholder="🔍 Dokument suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {typen.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: filter === t ? 'rgba(22,132,255,.2)' : 'rgba(255,255,255,.06)',
                color: filter === t ? '#6cb6ff' : '#aeb9c8',
                border: filter === t ? '1px solid rgba(22,132,255,.4)' : '1px solid rgba(255,255,255,.08)',
                transition: 'all .15s',
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Docs list */}
      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Dokument</th>
              <th>Typ</th>
              <th>Pilot</th>
              <th>Datum</th>
              <th>Größe</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'monospace' }}>{d.id}</div>
                </td>
                <td><span className="badge badge-gray">{d.typ}</span></td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.pilot}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.datum}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.groesse}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.tags.map(tag => (
                      <span key={tag} className="badge badge-blue" style={{ fontSize: 10 }}>{tag}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="pk-btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
                    Öffnen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aeb9c8' }}>
            Keine Dokumente gefunden.
          </div>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>
        {filtered.length} von {archivData.length} Dokumenten angezeigt
      </div>
    </div>
  )
}
