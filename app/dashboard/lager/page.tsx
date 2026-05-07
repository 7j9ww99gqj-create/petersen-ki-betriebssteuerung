'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getLagerArtikel, getLagerBewegungen,
  upsertLagerArtikel, insertLagerBewegung, deleteLagerArtikel,
} from '@/lib/db'

// ── Demo-Daten (nur für Demo-Modus) ─────────────────────────────────────────

const demoArtikel = [
  { id: 'ART-001', name: 'Stahlrohr 40x40', kategorie: 'Rohstoffe', bestand: 142, einheit: 'Stk', lagerplatz: 'A-01-03', status: 'ok' },
  { id: 'ART-002', name: 'Schrauben M8x30', kategorie: 'Kleinteile', bestand: 1840, einheit: 'Stk', lagerplatz: 'B-02-01', status: 'ok' },
  { id: 'ART-003', name: 'Hydrauliköl HLP46', kategorie: 'Betriebsstoffe', bestand: 8, einheit: 'Liter', lagerplatz: 'C-01-02', status: 'niedrig' },
  { id: 'ART-004', name: 'Schweißdraht 1.0mm', kategorie: 'Verbrauchsmaterial', bestand: 24, einheit: 'Rollen', lagerplatz: 'B-03-04', status: 'ok' },
  { id: 'ART-005', name: 'Aluminiumplatte 200x300', kategorie: 'Rohstoffe', bestand: 0, einheit: 'Stk', lagerplatz: 'A-02-01', status: 'leer' },
  { id: 'ART-006', name: 'Dichtungsring 50mm', kategorie: 'Kleinteile', bestand: 360, einheit: 'Stk', lagerplatz: 'B-01-05', status: 'ok' },
]

const demoBewegungen = [
  { id: 1, typ: 'Eingang', artikel: 'Stahlrohr 40x40', menge: 50, datum: '06.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 2, typ: 'Ausgang', artikel: 'Schrauben M8x30', menge: 200, datum: '06.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 3, typ: 'Eingang', artikel: 'Hydrauliköl HLP46', menge: 20, datum: '05.05.2025', mitarbeiter: 'K. Petersen', status: 'KI erkannt' },
  { id: 4, typ: 'Ausgang', artikel: 'Schweißdraht 1.0mm', menge: 6, datum: '05.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
]

// ── Typen ────────────────────────────────────────────────────────────────────

type Artikel = {
  id: string; name: string; kategorie: string; bestand: number
  einheit: string; lagerplatz: string; status: string
}
type Bewegung = {
  id: number | string; typ: string; artikel: string; menge: number
  datum: string; mitarbeiter: string; status: string
}

// ── Hilfsfunktion für IDs ────────────────────────────────────────────────────

function nextArtikelId(liste: Artikel[]) {
  const nums = liste.map(a => parseInt(a.id.replace('ART-', '')) || 0)
  const max = nums.length ? Math.max(...nums) : 0
  return `ART-${String(max + 1).padStart(3, '0')}`
}

export default function LagerPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<'bestand' | 'bewegungen' | 'eingang' | 'ausgang'>('bestand')
  const [search, setSearch] = useState('')
  const [artikel, setArtikel] = useState<Artikel[]>(isDemo ? demoArtikel : [])
  const [bewegungen, setBewegungen] = useState<Bewegung[]>(isDemo ? demoBewegungen : [])
  const [loading, setLoading] = useState(!isDemo)
  const [newEingang, setNewEingang] = useState({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
  const [newAusgang, setNewAusgang] = useState({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
  const [savedMsg, setSavedMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Daten laden (nur für echte Nutzer)
  useEffect(() => {
    if (isDemo) return
    Promise.all([getLagerArtikel(), getLagerBewegungen()])
      .then(([a, b]) => { setArtikel(a as Artikel[]); setBewegungen(b as Bewegung[]) })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const filtered = artikel.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.id.toLowerCase().includes(search.toLowerCase()) ||
    (a.lagerplatz ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const toast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg); else setSavedMsg(msg)
    setTimeout(() => { setSavedMsg(''); setErrorMsg('') }, 4000)
  }

  const handleEingang = async () => {
    if (!newEingang.artikel || !newEingang.menge) return
    const menge = parseInt(newEingang.menge)
    if (isDemo) {
      // Demo: nur lokale Anzeige
      setBewegungen(prev => [{ id: Date.now(), typ: 'Eingang', artikel: newEingang.artikel, menge, datum: new Date().toLocaleDateString('de-DE'), mitarbeiter: newEingang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
      toast(`✅ Wareneingang "${newEingang.artikel}" (${menge}) gebucht!`)
      setNewEingang({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
      return
    }
    try {
      await insertLagerBewegung({ typ: 'Eingang', artikel: newEingang.artikel, menge, mitarbeiter: newEingang.mitarbeiter || '—' })
      // Bestand aktualisieren falls Artikel vorhanden
      const existing = artikel.find(a => a.name === newEingang.artikel || a.id === newEingang.artikel)
      if (existing) {
        const updated = { ...existing, bestand: existing.bestand + menge }
        await upsertLagerArtikel(updated)
        setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
      }
      const b = await getLagerBewegungen()
      setBewegungen(b as Bewegung[])
      toast(`✅ Wareneingang "${newEingang.artikel}" (${menge}) gebucht!`)
      setNewEingang({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
    } catch { toast('Fehler beim Speichern', true) }
  }

  const handleAusgang = async () => {
    if (!newAusgang.artikel || !newAusgang.menge) return
    const menge = parseInt(newAusgang.menge)
    if (isDemo) {
      setBewegungen(prev => [{ id: Date.now(), typ: 'Ausgang', artikel: newAusgang.artikel, menge, datum: new Date().toLocaleDateString('de-DE'), mitarbeiter: newAusgang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
      toast(`✅ Warenausgang "${newAusgang.artikel}" (${menge}) gebucht!`)
      setNewAusgang({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
      return
    }
    try {
      await insertLagerBewegung({ typ: 'Ausgang', artikel: newAusgang.artikel, menge, mitarbeiter: newAusgang.mitarbeiter || '—' })
      const existing = artikel.find(a => a.name === newAusgang.artikel || a.id === newAusgang.artikel)
      if (existing) {
        const updated = { ...existing, bestand: Math.max(0, existing.bestand - menge) }
        await upsertLagerArtikel(updated)
        setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
      }
      const b = await getLagerBewegungen()
      setBewegungen(b as Bewegung[])
      toast(`✅ Warenausgang "${newAusgang.artikel}" (${menge}) gebucht!`)
      setNewAusgang({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
    } catch { toast('Fehler beim Speichern', true) }
  }

  const handleAddArtikel = async (neu: Omit<Artikel, 'id'>) => {
    const id = nextArtikelId(artikel)
    const a = { id, ...neu }
    if (!isDemo) {
      try { await upsertLagerArtikel(a) } catch { toast('Fehler beim Speichern', true); return }
    }
    setArtikel(prev => [...prev, a])
  }

  const handleDeleteArtikel = async (id: string) => {
    if (!isDemo) {
      try { await deleteLagerArtikel(id) } catch { toast('Fehler beim Löschen', true); return }
    }
    setArtikel(prev => prev.filter(a => a.id !== id))
  }

  const statsNiedrig = artikel.filter(a => a.status === 'niedrig' || a.status === 'leer').length
  const heuteEingang = bewegungen.filter(b => b.typ === 'Eingang').slice(0, 5).length
  const heuteAusgang = bewegungen.filter(b => b.typ === 'Ausgang').slice(0, 5).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Lagerdaten…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📦</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>LagerPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Wareneingang · Warenausgang · Bestände · Inventur</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Artikel gesamt', value: String(artikel.length), icon: '📦', color: '#1684ff' },
          { label: 'Niedrig / Leer', value: String(statsNiedrig), icon: '⚠️', color: '#f59e0b' },
          { label: 'Letzte Eingänge', value: String(heuteEingang), icon: '📥', color: '#10b981' },
          { label: 'Letzte Ausgänge', value: String(heuteAusgang), icon: '📤', color: '#f43f5e' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {[
          { id: 'bestand', label: '📦 Bestand' },
          { id: 'bewegungen', label: '🔄 Bewegungen' },
          { id: 'eingang', label: '📥 Wareneingang' },
          { id: 'ausgang', label: '📤 Warenausgang' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{ padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', borderBottom: tab === t.id ? '2px solid #1684ff' : '2px solid transparent', color: tab === t.id ? '#6cb6ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Bestand */}
      {tab === 'bestand' && (
        <div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="pk-input" placeholder="🔍 Artikel suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
            {!isDemo && (
              <button className="pk-btn" style={{ fontSize: 13 }} onClick={() => {
                const id = nextArtikelId(artikel)
                const name = prompt('Artikelname:')
                if (!name) return
                handleAddArtikel({ name, kategorie: '', bestand: 0, einheit: 'Stk', lagerplatz: '', status: 'ok' })
              }}>+ Artikel anlegen</button>
            )}
          </div>
          <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Art.-Nr.</th><th>Bezeichnung</th><th>Kategorie</th><th>Bestand</th><th>Lagerplatz</th><th>Status</th>
                  {!isDemo && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#aeb9c8' }}>
                    {artikel.length === 0 ? 'Noch keine Artikel. Lege deinen ersten Artikel an.' : 'Keine Artikel gefunden.'}
                  </td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td><span className="badge badge-gray">{a.kategorie}</span></td>
                    <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : a.status === 'niedrig' ? '#f59e0b' : '#f8fbff' }}>{a.bestand} {a.einheit}</td>
                    <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 13 }}>{a.lagerplatz}</td>
                    <td><span className={`badge ${a.status === 'ok' ? 'badge-green' : a.status === 'niedrig' ? 'badge-orange' : 'badge-gray'}`}>{a.status === 'ok' ? 'In Ordnung' : a.status === 'niedrig' ? 'Niedrig' : 'Leer'}</span></td>
                    {!isDemo && <td><button onClick={() => handleDeleteArtikel(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', fontSize: 16 }}>🗑</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {artikel.length} Artikel</div>
        </div>
      )}

      {/* Bewegungen */}
      {tab === 'bewegungen' && (
        <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="pk-table">
            <thead>
              <tr><th>Typ</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Mitarbeiter</th><th>Status</th></tr>
            </thead>
            <tbody>
              {bewegungen.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#aeb9c8' }}>Noch keine Bewegungen.</td></tr>
              ) : bewegungen.map(b => (
                <tr key={b.id}>
                  <td><span className={`badge ${b.typ === 'Eingang' ? 'badge-green' : 'badge-orange'}`}>{b.typ === 'Eingang' ? '📥' : '📤'} {b.typ}</span></td>
                  <td style={{ fontWeight: 600 }}>{b.artikel}</td>
                  <td style={{ fontWeight: 700 }}>{b.menge} Stk</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                  <td style={{ color: '#aeb9c8' }}>{b.mitarbeiter}</td>
                  <td><span className={`badge ${b.status === 'KI erkannt' ? 'badge-blue' : 'badge-green'}`}>{b.status === 'KI erkannt' ? '🧠 ' : '✅ '}{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Wareneingang */}
      {tab === 'eingang' && (
        <div style={{ maxWidth: 540 }}>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📥 Neuer Wareneingang erfassen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel</label>
                <input className="pk-input" placeholder="Artikelname oder Nummer" value={newEingang.artikel} onChange={e => setNewEingang(p => ({ ...p, artikel: e.target.value }))} list="artikel-list" />
                <datalist id="artikel-list">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge</label>
                <input className="pk-input" placeholder="Stückzahl" type="number" min="1" value={newEingang.menge} onChange={e => setNewEingang(p => ({ ...p, menge: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
                <input className="pk-input" placeholder="z.B. A-01-03" value={newEingang.lagerplatz} onChange={e => setNewEingang(p => ({ ...p, lagerplatz: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name" value={newEingang.mitarbeiter} onChange={e => setNewEingang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleEingang} style={{ fontWeight: 700 }}>Wareneingang buchen</button>
            </div>
          </div>
          {savedMsg && <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#4ddb7e', fontSize: 14, fontWeight: 600 }}>{savedMsg}</div>}
        </div>
      )}

      {/* Warenausgang */}
      {tab === 'ausgang' && (
        <div style={{ maxWidth: 540 }}>
          <div className="pk-card">
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📤 Warenausgang erfassen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel</label>
                <input className="pk-input" placeholder="Artikelname oder Nummer" value={newAusgang.artikel} onChange={e => setNewAusgang(p => ({ ...p, artikel: e.target.value }))} list="artikel-list2" />
                <datalist id="artikel-list2">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge</label>
                <input className="pk-input" placeholder="Stückzahl" type="number" min="1" value={newAusgang.menge} onChange={e => setNewAusgang(p => ({ ...p, menge: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Empfänger / Auftrag</label>
                <input className="pk-input" placeholder="z.B. Auftrag #A-2025-034" value={newAusgang.empfaenger} onChange={e => setNewAusgang(p => ({ ...p, empfaenger: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name" value={newAusgang.mitarbeiter} onChange={e => setNewAusgang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleAusgang} style={{ fontWeight: 700 }}>Warenausgang buchen</button>
            </div>
          </div>
          {savedMsg && <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 12, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#4ddb7e', fontSize: 14, fontWeight: 600 }}>{savedMsg}</div>}
        </div>
      )}
    </div>
  )
}
