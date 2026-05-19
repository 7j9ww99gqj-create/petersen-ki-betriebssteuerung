'use client'
import React, { useState, useEffect } from 'react'
import { Toast, Modal, labelStyle } from './shared'
import type { BueroZeiterfassung, Kunde } from '@/types/buero'
import { demoBueroZeiterfassung } from '@/types/buero'
import { genId } from '@/lib/ids'

function calcStunden(von: string, bis: string): number {
  if (!von || !bis) return 0
  const [vh, vm] = von.split(':').map(Number)
  const [bh, bm] = bis.split(':').map(Number)
  const diff = (bh * 60 + bm) - (vh * 60 + vm)
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0
}

function heute() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const emptyForm = { kunde_id: '', datum: heute(), von: '', bis: '', stundensatz: 95, beschreibung: '' }

export default function ZeiterfassungTab({ isDemo, kunden }: { isDemo: boolean; kunden: Kunde[] }) {
  const [eintraege, setEintraege] = useState<BueroZeiterfassung[]>(isDemo ? demoBueroZeiterfassung : [])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editItem, setEditItem] = useState<BueroZeiterfassung | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [filterKunde, setFilterKunde] = useState('')

  useEffect(() => {
    if (isDemo) return
    // Live: Zeiterfassungseinträge laden (wenn DB-Tabelle vorhanden)
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleSave = () => {
    const { kunde_id, datum, von, bis, stundensatz } = form
    if (!datum || !von || !bis) { showToast('Datum, Von und Bis sind Pflichtfelder', true); return }
    const stunden = calcStunden(von, bis)
    if (stunden <= 0) { showToast('Bis-Zeit muss nach Von-Zeit liegen', true); return }
    const kunde = kunden.find(k => k.id === kunde_id)
    if (editItem) {
      const updated: BueroZeiterfassung = { ...editItem, ...form, kunde: kunde?.name, stundensatz: Number(stundensatz) }
      setEintraege(prev => prev.map(e => e.id === editItem.id ? updated : e))
      setEditItem(null); setShowForm(false)
      showToast('✅ Zeiteintrag aktualisiert')
    } else {
      const neu: BueroZeiterfassung = {
        id: genId('ZE'), ...form, stundensatz: Number(stundensatz),
        kunde: kunde?.name, erstellt_am: new Date().toISOString(),
      }
      setEintraege(prev => [neu, ...prev])
      setForm(emptyForm); setShowForm(false)
      showToast('✅ Zeiteintrag gespeichert')
    }
  }

  const handleEdit = (item: BueroZeiterfassung) => {
    setEditItem(item)
    setForm({ kunde_id: item.kunde_id ?? '', datum: item.datum, von: item.von, bis: item.bis, stundensatz: item.stundensatz, beschreibung: item.beschreibung ?? '' })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setEintraege(prev => prev.filter(e => e.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Zeiteintrag gelöscht')
  }

  const filtered = filterKunde ? eintraege.filter(e => e.kunde_id === filterKunde || e.kunde === filterKunde) : eintraege

  const totalStunden = filtered.reduce((s, e) => s + calcStunden(e.von, e.bis), 0)
  const totalBetrag = filtered.reduce((s, e) => s + calcStunden(e.von, e.bis) * e.stundensatz, 0)

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Header + Aktionen */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="pk-input" value={filterKunde} onChange={e => setFilterKunde(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Alle Kunden</option>
          {kunden.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => { setEditItem(null); setForm(emptyForm); setShowForm(f => !f) }}>
          {showForm && !editItem ? '✕ Abbrechen' : '+ Zeit erfassen'}
        </button>
        {filtered.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#aeb9c8' }}>Gesamt: <strong style={{ color: '#20c8ff' }}>{totalStunden.toFixed(2)} Std</strong></span>
            <span style={{ fontSize: 13, color: '#aeb9c8' }}>Betrag: <strong style={{ color: '#25d366' }}>{totalBetrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</strong></span>
          </div>
        )}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(167,139,250,.25)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>
            {editItem ? '✏️ Zeiteintrag bearbeiten' : '🕐 Zeit erfassen'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="field-kunde" style={labelStyle}>Kunde</label>
              <select id="field-kunde" className="pk-input" value={form.kunde_id} onChange={e => setForm(p => ({ ...p, kunde_id: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">— Kein Kunde —</option>
                {kunden.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-datum" style={labelStyle}>Datum *</label>
              <input id="field-datum" className="pk-input" placeholder="TT.MM.JJJJ" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="field-von" style={labelStyle}>Von *</label>
              <input id="field-von" className="pk-input" type="time" value={form.von} onChange={e => setForm(p => ({ ...p, von: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="field-bis" style={labelStyle}>Bis *</label>
              <input id="field-bis" className="pk-input" type="time" value={form.bis} onChange={e => setForm(p => ({ ...p, bis: e.target.value }))} />
              {form.von && form.bis && (
                <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>
                  = {calcStunden(form.von, form.bis).toFixed(2)} Std
                </div>
              )}
            </div>
            <div>
              <label htmlFor="field-stundensatz" style={labelStyle}>Stundensatz (€)</label>
              <input id="field-stundensatz" className="pk-input" type="number" min="0" step="0.01" value={form.stundensatz} onChange={e => setForm(p => ({ ...p, stundensatz: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label htmlFor="field-beschreibung" style={labelStyle}>Beschreibung</label>
              <input id="field-beschreibung" className="pk-input" placeholder="Tätigkeitsbeschreibung…" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
          </div>
          {form.von && form.bis && form.stundensatz > 0 && calcStunden(form.von, form.bis) > 0 && (
            <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)', fontSize: 13, color: '#a78bfa' }}>
              Betrag: <strong>{(calcStunden(form.von, form.bis) * form.stundensatz).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</strong> ({calcStunden(form.von, form.bis).toFixed(2)} Std × {form.stundensatz} €/Std)
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditItem(null) }}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="pk-card" style={{ textAlign: 'center', padding: 48, color: '#aeb9c8' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🕐</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Noch keine Zeiteinträge</div>
          <div style={{ fontSize: 13 }}>Klicke &quot;+ Zeit erfassen&quot;, um den ersten Eintrag anzulegen</div>
        </div>
      ) : (
        <div className="pk-card" style={{ padding: 0 }}>
          <table className="pk-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Kunde</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Stunden</th>
                <th>Satz</th>
                <th>Betrag</th>
                <th>Beschreibung</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const std = calcStunden(e.von, e.bis)
                const betrag = std * e.stundensatz
                return (
                  <tr key={e.id}>
                    <td style={{ color: '#aeb9c8', whiteSpace: 'nowrap' }}>{e.datum}</td>
                    <td style={{ fontWeight: 600 }}>{e.kunde ?? '—'}</td>
                    <td>{e.von}</td>
                    <td>{e.bis}</td>
                    <td style={{ color: '#a78bfa', fontWeight: 700 }}>{std.toFixed(2)}</td>
                    <td style={{ color: '#aeb9c8' }}>{e.stundensatz} €</td>
                    <td style={{ fontWeight: 700, color: '#25d366' }}>{betrag.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                    <td style={{ color: '#aeb9c8', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.beschreibung}</td>
                    <td>
                      <div role="presentation" style={{ display: 'flex', gap: 4 }} onClick={ev => ev.stopPropagation()} onKeyDown={ev => ev.stopPropagation()}>
                        <button onClick={() => handleEdit(e)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                        {deleteConfirm === e.id ? (
                          <>
                            <button onClick={() => handleDelete(e.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(e.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Einträge</div>
    </div>
  )
}
