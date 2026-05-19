'use client'
import React, { useState, useEffect } from 'react'
import { Toast, labelStyle } from './shared'
import type { BueroArtikel } from '@/types/buero'
import { demoBueroArtikel } from '@/types/buero'
import { genId } from '@/lib/ids'

const KATEGORIEN = ['Dienstleistung', 'Stahl', 'Kleinteile', 'Verbrauchsmaterial', 'Elektronik', 'Büro', 'Sonstiges']
const EINHEITEN = ['Stk', 'Std', 'kg', 'm', 'm²', 'm³', 'Liter', 'pauschal', 'Rolle', 'Pkg', 'Set']

const emptyForm: Omit<BueroArtikel, 'id'> = {
  artikelnummer: '', name: '', kategorie: 'Dienstleistung', einheit: 'Stk',
  einkaufspreis: undefined, verkaufspreis: undefined, mwst: 19, beschreibung: '', aktiv: true,
}

export default function ArtikelTab({ isDemo }: { isDemo: boolean }) {
  const [artikel, setArtikel] = useState<BueroArtikel[]>(isDemo ? demoBueroArtikel : [])
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [editItem, setEditItem] = useState<BueroArtikel | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  useEffect(() => {
    if (isDemo) return
    // Live: Artikel aus DB laden (wenn Tabelle vorhanden)
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleSave = () => {
    if (!form.name || !form.einheit) { showToast('Name und Einheit sind Pflichtfelder', true); return }
    if (editItem) {
      const updated: BueroArtikel = { ...editItem, ...form }
      setArtikel(prev => prev.map(a => a.id === editItem.id ? updated : a))
      setEditItem(null); setShowForm(false)
      showToast(`✅ Artikel "${updated.name}" aktualisiert`)
    } else {
      const neu: BueroArtikel = { id: genId('ART'), ...form }
      setArtikel(prev => [neu, ...prev])
      setForm({ ...emptyForm }); setShowForm(false)
      showToast(`✅ Artikel "${neu.name}" angelegt`)
    }
  }

  const handleDelete = (id: string) => {
    setArtikel(prev => prev.filter(a => a.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Artikel gelöscht')
  }

  const openEdit = (a: BueroArtikel) => {
    setEditItem(a)
    setForm({ artikelnummer: a.artikelnummer ?? '', name: a.name, kategorie: a.kategorie ?? 'Sonstiges', einheit: a.einheit, einkaufspreis: a.einkaufspreis, verkaufspreis: a.verkaufspreis, mwst: a.mwst ?? 19, beschreibung: a.beschreibung ?? '', aktiv: a.aktiv })
    setShowForm(true)
  }

  const filtered = artikel.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || (a.artikelnummer ?? '').toLowerCase().includes(q) || (a.beschreibung ?? '').toLowerCase().includes(q)
    const matchKat = !filterKat || a.kategorie === filterKat
    return matchSearch && matchKat
  })

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="🔍 Artikel suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Alle Kategorien</option>
          {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
        </select>
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(f => !f) }}>
          {showForm && !editItem ? '✕ Abbrechen' : '+ Neuer Artikel'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Artikel</span>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>
            {editItem ? `✏️ Artikel bearbeiten – ${editItem.id}` : '📦 Neuen Artikel anlegen'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="field-artikelnummer" style={labelStyle}>Artikelnummer</label>
              <input id="field-artikelnummer" className="pk-input" placeholder="z.B. 10001" value={form.artikelnummer ?? ''} onChange={e => setForm(p => ({ ...p, artikelnummer: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="field-name-bezeichnung" style={labelStyle}>Name / Bezeichnung *</label>
              <input id="field-name-bezeichnung" className="pk-input" placeholder="Artikelname" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="field-kategorie" style={labelStyle}>Kategorie</label>
              <select id="field-kategorie" className="pk-input" value={form.kategorie ?? ''} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))} style={{ cursor: 'pointer' }}>
                {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-einheit" style={labelStyle}>Einheit *</label>
              <select id="field-einheit" className="pk-input" value={form.einheit} onChange={e => setForm(p => ({ ...p, einheit: e.target.value }))} style={{ cursor: 'pointer' }}>
                {EINHEITEN.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-einkaufspreis" style={labelStyle}>Einkaufspreis (€)</label>
              <input id="field-einkaufspreis" className="pk-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.einkaufspreis ?? ''} onChange={e => setForm(p => ({ ...p, einkaufspreis: e.target.value ? parseFloat(e.target.value) : undefined }))} />
            </div>
            <div>
              <label htmlFor="field-verkaufspreis" style={labelStyle}>Verkaufspreis (€) *</label>
              <input id="field-verkaufspreis" className="pk-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.verkaufspreis ?? ''} onChange={e => setForm(p => ({ ...p, verkaufspreis: e.target.value ? parseFloat(e.target.value) : undefined }))} />
            </div>
            <div>
              <label htmlFor="field-mwst" style={labelStyle}>MwSt (%)</label>
              <select id="field-mwst" className="pk-input" value={form.mwst ?? 19} onChange={e => setForm(p => ({ ...p, mwst: parseInt(e.target.value) }))} style={{ cursor: 'pointer' }}>
                <option value={19}>19 %</option>
                <option value={7}>7 %</option>
                <option value={0}>0 %</option>
              </select>
            </div>
            <div>
              <label htmlFor="field-status" style={labelStyle}>Status</label>
              <select id="field-status" className="pk-input" value={form.aktiv ? 'aktiv' : 'inaktiv'} onChange={e => setForm(p => ({ ...p, aktiv: e.target.value === 'aktiv' }))} style={{ cursor: 'pointer' }}>
                <option value="aktiv">Aktiv</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor="field-beschreibung" style={labelStyle}>Beschreibung</label>
              <input id="field-beschreibung" className="pk-input" placeholder="Kurzbeschreibung…" value={form.beschreibung ?? ''} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditItem(null) }}>Abbrechen</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="pk-card" style={{ textAlign: 'center', padding: 48, color: '#aeb9c8' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Keine Artikel gefunden</div>
          <div style={{ fontSize: 13 }}>{search || filterKat ? 'Filter anpassen' : 'Klicke „+ Neuer Artikel", um loszulegen'}</div>
        </div>
      ) : (
        <div className="pk-card" style={{ padding: 0 }}>
          <table className="pk-table">
            <thead>
              <tr><th>Nr.</th><th>Bezeichnung</th><th>Kategorie</th><th>Einheit</th><th>EK-Preis</th><th>VK-Preis</th><th>MwSt</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.artikelnummer || a.id}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{a.name}</div>
                    {a.beschreibung && <div style={{ fontSize: 11, color: '#aeb9c8' }}>{a.beschreibung}</div>}
                  </td>
                  <td><span className="badge badge-gray">{a.kategorie}</span></td>
                  <td style={{ color: '#aeb9c8' }}>{a.einheit}</td>
                  <td style={{ color: '#aeb9c8' }}>{a.einkaufspreis != null ? a.einkaufspreis.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '—'}</td>
                  <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.verkaufspreis != null ? a.verkaufspreis.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '—'}</td>
                  <td style={{ color: '#aeb9c8' }}>{a.mwst ?? 19} %</td>
                  <td><span className={`badge ${a.aktiv ? 'badge-green' : 'badge-gray'}`}>{a.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(a)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                      {deleteConfirm === a.id ? (
                        <>
                          <button onClick={() => handleDelete(a.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(a.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
