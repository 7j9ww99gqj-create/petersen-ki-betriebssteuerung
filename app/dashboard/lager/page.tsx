'use client'
import { useState } from 'react'

const initialArtikel = [
  { id: 'ART-001', name: 'Stahlrohr 40x40', kategorie: 'Rohstoffe', bestand: 142, einheit: 'Stk', lagerplatz: 'A-01-03', status: 'ok' },
  { id: 'ART-002', name: 'Schrauben M8x30', kategorie: 'Kleinteile', bestand: 1840, einheit: 'Stk', lagerplatz: 'B-02-01', status: 'ok' },
  { id: 'ART-003', name: 'Hydrauliköl HLP46', kategorie: 'Betriebsstoffe', bestand: 8, einheit: 'Liter', lagerplatz: 'C-01-02', status: 'niedrig' },
  { id: 'ART-004', name: 'Schweißdraht 1.0mm', kategorie: 'Verbrauchsmaterial', bestand: 24, einheit: 'Rollen', lagerplatz: 'B-03-04', status: 'ok' },
  { id: 'ART-005', name: 'Aluminiumplatte 200x300', kategorie: 'Rohstoffe', bestand: 0, einheit: 'Stk', lagerplatz: 'A-02-01', status: 'leer' },
  { id: 'ART-006', name: 'Dichtungsring 50mm', kategorie: 'Kleinteile', bestand: 360, einheit: 'Stk', lagerplatz: 'B-01-05', status: 'ok' },
]

const bewegungen = [
  { id: 1, typ: 'Eingang', artikel: 'Stahlrohr 40x40', menge: 50, datum: '06.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 2, typ: 'Ausgang', artikel: 'Schrauben M8x30', menge: 200, datum: '06.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 3, typ: 'Eingang', artikel: 'Hydrauliköl HLP46', menge: 20, datum: '05.05.2025', mitarbeiter: 'K. Petersen', status: 'KI erkannt' },
  { id: 4, typ: 'Ausgang', artikel: 'Schweißdraht 1.0mm', menge: 6, datum: '05.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
]

export default function LagerPilotPage() {
  const [tab, setTab] = useState<'bestand' | 'bewegungen' | 'eingang' | 'ausgang'>('bestand')
  const [search, setSearch] = useState('')
  const [artikel] = useState(initialArtikel)
  const [newEingang, setNewEingang] = useState({ artikel: '', menge: '', lagerplatz: '' })
  const [savedMsg, setSavedMsg] = useState('')

  const filtered = artikel.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    a.lagerplatz.toLowerCase().includes(search.toLowerCase())
  )

  const handleEingang = () => {
    if (!newEingang.artikel || !newEingang.menge) return
    setSavedMsg(`✅ Wareneingang "${newEingang.artikel}" (${newEingang.menge} Stk) erfolgreich gebucht!`)
    setNewEingang({ artikel: '', menge: '', lagerplatz: '' })
    setTimeout(() => setSavedMsg(''), 4000)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>📦</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>LagerPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Wareneingang · Warenausgang · Bestände · Inventur</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Artikel gesamt', value: '1.248', icon: '📦', color: '#1684ff' },
          { label: 'Niedrig Bestand', value: '3', icon: '⚠️', color: '#f59e0b' },
          { label: 'Heute Eingang', value: '4', icon: '📥', color: '#10b981' },
          { label: 'Heute Ausgang', value: '2', icon: '📤', color: '#f43f5e' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0 }}>
        {[
          { id: 'bestand', label: '📦 Bestand' },
          { id: 'bewegungen', label: '🔄 Bewegungen' },
          { id: 'eingang', label: '📥 Wareneingang' },
          { id: 'ausgang', label: '📤 Warenausgang' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            style={{
              padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'transparent', borderBottom: tab === t.id ? '2px solid #1684ff' : '2px solid transparent',
              color: tab === t.id ? '#6cb6ff' : '#aeb9c8',
              marginBottom: -1, transition: 'color .15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Bestand tab */}
      {tab === 'bestand' && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <input
              className="pk-input"
              placeholder="🔍 Artikel suchen (Name, Artikelnummer oder Lagerplatz)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 400 }}
            />
          </div>
          <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Art.-Nr.</th>
                  <th>Bezeichnung</th>
                  <th>Kategorie</th>
                  <th>Bestand</th>
                  <th>Lagerplatz</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td><span className="badge badge-gray">{a.kategorie}</span></td>
                    <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : a.status === 'niedrig' ? '#f59e0b' : '#f8fbff' }}>
                      {a.bestand} {a.einheit}
                    </td>
                    <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 13 }}>{a.lagerplatz}</td>
                    <td>
                      <span className={`badge ${a.status === 'ok' ? 'badge-green' : a.status === 'niedrig' ? 'badge-orange' : 'badge-gray'}`}>
                        {a.status === 'ok' ? 'In Ordnung' : a.status === 'niedrig' ? 'Niedrig' : 'Leer'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>
            {filtered.length} von {artikel.length} Artikel angezeigt
          </div>
        </div>
      )}

      {/* Bewegungen tab */}
      {tab === 'bewegungen' && (
        <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="pk-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Artikel</th>
                <th>Menge</th>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bewegungen.map(b => (
                <tr key={b.id}>
                  <td>
                    <span className={`badge ${b.typ === 'Eingang' ? 'badge-green' : 'badge-orange'}`}>
                      {b.typ === 'Eingang' ? '📥' : '📤'} {b.typ}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.artikel}</td>
                  <td style={{ fontWeight: 700 }}>{b.menge} Stk</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                  <td style={{ color: '#aeb9c8' }}>{b.mitarbeiter}</td>
                  <td>
                    <span className={`badge ${b.status === 'KI erkannt' ? 'badge-blue' : 'badge-green'}`}>
                      {b.status === 'KI erkannt' ? '🧠 ' : '✅ '}{b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Wareneingang tab */}
      {tab === 'eingang' && (
        <div style={{ maxWidth: 540 }}>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📥 Neuer Wareneingang erfassen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel</label>
                <input className="pk-input" placeholder="Artikelname oder Nummer" value={newEingang.artikel} onChange={e => setNewEingang(p => ({ ...p, artikel: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge</label>
                <input className="pk-input" placeholder="Stückzahl" type="number" value={newEingang.menge} onChange={e => setNewEingang(p => ({ ...p, menge: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
                <input className="pk-input" placeholder="z.B. A-01-03" value={newEingang.lagerplatz} onChange={e => setNewEingang(p => ({ ...p, lagerplatz: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleEingang} style={{ fontWeight: 700 }}>
                Wareneingang buchen
              </button>
            </div>
          </div>
          {savedMsg && (
            <div style={{
              padding: '14px 18px', borderRadius: 12,
              background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)',
              color: '#4ddb7e', fontSize: 14, fontWeight: 600,
            }}>{savedMsg}</div>
          )}
          <div className="pk-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🧠</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>KI-Erkennung verfügbar</div>
                <div style={{ fontSize: 12, color: '#aeb9c8' }}>Lieferschein fotografieren → Daten werden automatisch erkannt</div>
              </div>
            </div>
            <button className="pk-btn-ghost" onClick={() => window.location.href = '/dashboard/ki-erkennung'} style={{ fontSize: 13 }}>
              📸 KI Erkennung öffnen
            </button>
          </div>
        </div>
      )}

      {/* Warenausgang tab */}
      {tab === 'ausgang' && (
        <div style={{ maxWidth: 540 }}>
          <div className="pk-card">
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📤 Warenausgang erfassen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel</label>
                <input className="pk-input" placeholder="Artikelname oder Nummer" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge</label>
                <input className="pk-input" placeholder="Stückzahl" type="number" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Empfänger / Auftrag</label>
                <input className="pk-input" placeholder="z.B. Auftrag #A-2025-034" />
              </div>
              <button className="pk-btn" style={{ fontWeight: 700 }}>
                Warenausgang buchen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
