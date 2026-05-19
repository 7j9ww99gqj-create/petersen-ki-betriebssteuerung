'use client'
import React, { useState, useEffect } from 'react'
import { getEinkaufLieferanten, upsertEinkaufLieferant, deleteEinkaufLieferant } from '@/lib/db'
import { Toast, DeleteConfirm, labelStyle } from './shared'
import type { Lieferant } from '@/types/buero'
import { demoLieferanten } from '@/types/buero'
import { genId } from '@/lib/ids'

const emptyForm = { name: '', kontakt: '', email: '', telefon: '', ort: '', website: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto', notiz: '' }

export default function LieferantenTab({ isDemo }: { isDemo: boolean }) {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>(isDemo ? demoLieferanten : [])
  const [loading, setLoading] = useState(!isDemo)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editItem, setEditItem] = useState<Lieferant | null>(null)
  const [selected, setSelected] = useState<Lieferant | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  useEffect(() => {
    if (isDemo) return
    setLoading(true)
    getEinkaufLieferanten()
      .then(data => setLieferanten(data as Lieferant[]))
      .catch(() => showToast('Lieferanten konnten nicht geladen werden', true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) { showToast('Name und E-Mail sind Pflichtfelder', true); return }
    if (editItem) {
      const updated: Lieferant = { ...editItem, ...form }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(updated) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => prev.map(l => l.id === editItem.id ? updated : l))
      if (selected?.id === editItem.id) setSelected(updated)
      setEditItem(null); setShowForm(false)
      showToast(`✅ Lieferant "${updated.name}" aktualisiert`)
    } else {
      const neu: Lieferant = { id: genId('LF'), ...form, status: 'Aktiv', bewertung: 3 }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(neu) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => [neu, ...prev])
      setForm(emptyForm); setShowForm(false)
      showToast(`✅ Lieferant "${neu.name}" angelegt`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try { await deleteEinkaufLieferant(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setLieferanten(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeleteId(null)
    showToast('🗑️ Lieferant gelöscht')
  }

  const openEdit = (l: Lieferant) => {
    setEditItem(l)
    setForm({ name: l.name, kontakt: l.kontakt, email: l.email, telefon: l.telefon, ort: l.ort, website: (l as Lieferant & { website?: string }).website ?? '', kategorie: l.kategorie, zahlungsziel: l.zahlungsziel, notiz: '' })
    setShowForm(true)
    setSelected(null)
  }

  const filtered = lieferanten.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.kategorie.toLowerCase().includes(search.toLowerCase()) ||
    l.ort.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Lieferanten…</div>
      </div>
    </div>
  )

  if (selected) {
    return (
      <div className="fade-in">
        <Toast msg={toast} error={toastError} />
        <button className="pk-btn-ghost" onClick={() => setSelected(null)} style={{ marginBottom: 16, fontSize: 13 }}>← Zurück zur Übersicht</button>
        <div className="pk-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(32,200,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏭</div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>{selected.id} · {selected.kategorie} · {selected.ort}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{selected.kontakt}</div>
            </div>
            <span className={`badge ${selected.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{selected.status}</span>
            <button onClick={() => openEdit(selected)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.08)', color: '#20c8ff', cursor: 'pointer', fontWeight: 600 }}>✏️ Bearbeiten</button>
          </div>

          {/* Kommunikation Icons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <a href={`tel:${selected.telefon}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.2)', color: '#4ddb7e', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              📞 Anrufen
            </a>
            <a href={`mailto:${selected.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(32,200,255,.1)', border: '1px solid rgba(32,200,255,.2)', color: '#20c8ff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              ✉️ E-Mail
            </a>
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Ansprechpartner', value: selected.kontakt },
              { label: 'E-Mail', value: selected.email },
              { label: 'Telefon', value: selected.telefon },
              { label: 'Ort', value: selected.ort },
              { label: 'Zahlungsziel', value: selected.zahlungsziel },
              { label: 'Bewertung', value: '★'.repeat(selected.bewertung) + '☆'.repeat(5 - selected.bewertung) },
            ].map(d => (
              <div key={d.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>{d.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{d.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="🔍 Lieferanten suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => { setEditItem(null); setForm(emptyForm); setShowForm(f => !f) }}>
          {showForm && !editItem ? '✕ Abbrechen' : '+ Neuer Lieferant'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>
            {editItem ? `✏️ Lieferant bearbeiten – ${editItem.id}` : '🏭 Neuen Lieferanten anlegen'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" placeholder="Lieferant GmbH" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" placeholder="Vor- und Nachname" value={form.kontakt} onChange={e => setForm(p => ({ ...p, kontakt: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" value={form.ort} onChange={e => setForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Webseite</label>
              <input className="pk-input" placeholder="https://…" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kategorie</label>
              <select className="pk-input" value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Rohstoffe', 'Kleinteile', 'Betriebsstoffe', 'Büro', 'Schutzausrüstung', 'IT', 'Dienstleistung', 'Sonstiges'].map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Zahlungsziel</label>
              <select className="pk-input" value={form.zahlungsziel} onChange={e => setForm(p => ({ ...p, zahlungsziel: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['sofort', '7 Tage netto', '14 Tage 2% Skonto', '14 Tage netto', '21 Tage netto', '30 Tage netto', '60 Tage netto'].map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Notiz</label>
              <input className="pk-input" placeholder="Interne Notiz…" value={form.notiz} onChange={e => setForm(p => ({ ...p, notiz: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditItem(null) }}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0 }}>
        <table className="pk-table">
          <thead>
            <tr><th>Nr.</th><th>Name</th><th>Ansprechpartner</th><th>Ort</th><th>Kategorie</th><th>Bewertung</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#aeb9c8', padding: 36 }}>
                {search ? 'Keine Treffer' : 'Noch keine Lieferanten angelegt'}
              </td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(l)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{l.id}</td>
                <td style={{ fontWeight: 700 }}>🏭 {l.name}</td>
                <td style={{ color: '#aeb9c8' }}>{l.kontakt}</td>
                <td style={{ color: '#aeb9c8' }}>{l.ort}</td>
                <td><span className="badge badge-gray">{l.kategorie}</span></td>
                <td style={{ color: '#f59e0b' }}>{'★'.repeat(l.bewertung)}</td>
                <td><span className={`badge ${l.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{l.status}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(l)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                    {deleteId === l.id ? (
                      <DeleteConfirm label={l.name} onConfirm={() => handleDelete(l.id)} onCancel={() => setDeleteId(null)} />
                    ) : (
                      <button onClick={() => setDeleteId(l.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {lieferanten.length} Lieferanten</div>
    </div>
  )
}
