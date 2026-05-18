'use client'
import React, { useState, useEffect } from 'react'
import { getEinkaufLieferanten, upsertEinkaufLieferant, deleteEinkaufLieferant, getEinkaufBestellungen, upsertEinkaufBestellung, getEinkaufWareneingaenge, insertEinkaufWareneingang } from '@/lib/db'
import { Toast, Modal, DeleteConfirm, labelStyle } from './shared'
import type { Lieferant, EinkaufsBestellung, Wareneingang, EinkaufSubTab } from '@/types/buero'
import { demoLieferanten, demoEinkaufsBestellungen, demoWareneingaenge } from '@/types/buero'
import { genId } from '@/lib/ids'

function EinkaufTab({ isDemo }: { isDemo: boolean }) {
  const [subTab, setSubTab] = useState<EinkaufSubTab>('lieferanten')
  const [lieferanten, setLieferanten] = useState<Lieferant[]>(isDemo ? demoLieferanten : [])
  const [bestellungen, setBestellungen] = useState<EinkaufsBestellung[]>(isDemo ? demoEinkaufsBestellungen : [])
  const [wareneingaenge, setWareneingaenge] = useState<Wareneingang[]>(isDemo ? demoWareneingaenge : [])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editLieferant, setEditLieferant] = useState<Lieferant | null>(null)
  const [selectedBestellung, setSelectedBestellung] = useState<EinkaufsBestellung | null>(null)
  const [loading, setLoading] = useState(!isDemo)

  // Lieferant-Formular
  const [lfForm, setLfForm] = useState({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' })
  // Bestellung-Formular
  const [bsForm, setBsForm] = useState({ lieferant: '', artikel: '', menge: '', einheit: 'Stk', einkaufspreis: '', erwartet_am: '', notiz: '' })
  // Wareneingang-Formular
  const [weForm, setWeForm] = useState({ bestellung_id: '', lieferant: '', artikel: '', menge: '', einheit: 'Stk', qualitaet: 'OK' as Wareneingang['qualitaet'], mitarbeiter: '' })

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }
  const heute = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  useEffect(() => {
    if (isDemo) return
    Promise.all([getEinkaufLieferanten(), getEinkaufBestellungen(), getEinkaufWareneingaenge()])
      .then(([l, b, w]) => {
        setLieferanten(l as Lieferant[])
        setBestellungen(b as EinkaufsBestellung[])
        setWareneingaenge(w as Wareneingang[])
      })
      .catch(() => showToast('Einkaufsdaten konnten nicht geladen werden', true))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  // ── Lieferanten CRUD ──────────────────────────────────────────────────────

  const handleLieferantSave = async () => {
    if (!lfForm.name || !lfForm.email) return
    if (editLieferant) {
      const updated: Lieferant = { ...editLieferant, ...lfForm, bewertung: editLieferant.bewertung }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(updated) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => prev.map(l => l.id === editLieferant.id ? updated : l))
      setEditLieferant(null)
      showToast(`✅ Lieferant "${updated.name}" aktualisiert`)
    } else {
      const neu: Lieferant = {
        id: genId('LF'),
        ...lfForm, status: 'Aktiv', bewertung: 4,
      }
      if (!isDemo) {
        try { await upsertEinkaufLieferant(neu) } catch { showToast('Fehler beim Speichern', true); return }
      }
      setLieferanten(prev => [neu, ...prev])
      showToast(`✅ Lieferant "${neu.name}" wurde angelegt`)
    }
    setLfForm({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' })
    setShowForm(false)
  }

  const openEditLieferant = (l: Lieferant) => {
    setEditLieferant(l)
    setLfForm({ name: l.name, kontakt: l.kontakt, email: l.email, telefon: l.telefon, ort: l.ort, kategorie: l.kategorie, zahlungsziel: l.zahlungsziel })
    setShowForm(true)
    setSubTab('lieferanten')
  }

  // ── Bestellung anlegen ─────────────────────────────────────────────────────

  const handleBestellungSave = async () => {
    if (!bsForm.lieferant || !bsForm.artikel || !bsForm.menge || !bsForm.einkaufspreis) return
    const menge = parseFloat(bsForm.menge) || 0
    const ep = parseFloat(bsForm.einkaufspreis.replace(',', '.')) || 0
    const gesamt = (menge * ep).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'
    const lieferant = lieferanten.find(l => l.name === bsForm.lieferant)
    const neu: EinkaufsBestellung = {
      id: genId('EB'),
      lieferant_id: lieferant?.id,
      lieferant: bsForm.lieferant, artikel: bsForm.artikel, menge, einheit: bsForm.einheit,
      einkaufspreis: bsForm.einkaufspreis.includes('€') ? bsForm.einkaufspreis : `${bsForm.einkaufspreis} €`,
      gesamt, status: 'Entwurf', bestellt_am: heute(), erwartet_am: bsForm.erwartet_am || '',
      notiz: bsForm.notiz || undefined,
    }
    if (!isDemo) {
      try { await upsertEinkaufBestellung(neu) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => [neu, ...prev])
    setBsForm({ lieferant: '', artikel: '', menge: '', einheit: 'Stk', einkaufspreis: '', erwartet_am: '', notiz: '' })
    setShowForm(false)
    showToast(`✅ Bestellung "${neu.id}" wurde als Entwurf gespeichert`)
  }

  const handleBestellungAusloesen = async (id: string) => {
    const bestellung = bestellungen.find(b => b.id === id)
    if (!isDemo && bestellung) {
      try { await upsertEinkaufBestellung({ ...bestellung, status: 'Bestellt' }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => prev.map(b => b.id === id ? { ...b, status: 'Bestellt' } : b))
    showToast(`📤 Bestellung ${id} wurde ausgelöst`)
  }

  const handleBestellungGeliefert = async (id: string) => {
    const bestellung = bestellungen.find(b => b.id === id)
    if (!isDemo && bestellung) {
      try { await upsertEinkaufBestellung({ ...bestellung, status: 'Geliefert', geliefert_am: heute() }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBestellungen(prev => prev.map(b => b.id === id ? { ...b, status: 'Geliefert', geliefert_am: heute() } : b))
    showToast(`✅ Bestellung ${id} als geliefert markiert`)
  }

  // ── Wareneingang buchen ───────────────────────────────────────────────────

  const handleWareneingangSave = async () => {
    if (!weForm.bestellung_id || !weForm.artikel || !weForm.menge) return
    const bestellung = bestellungen.find(b => b.id === weForm.bestellung_id)
    const neu: Wareneingang = {
      id: `WE-${String(wareneingaenge.length + 4).padStart(3, '0')}`,
      bestellung_id: weForm.bestellung_id,
      lieferant: bestellung?.lieferant || weForm.lieferant,
      artikel: weForm.artikel, menge: parseFloat(weForm.menge) || 0,
      einheit: weForm.einheit, datum: heute(),
      qualitaet: weForm.qualitaet, mitarbeiter: weForm.mitarbeiter || '—',
    }
    if (!isDemo) {
      try { await insertEinkaufWareneingang(neu) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setWareneingaenge(prev => [neu, ...prev])
    if (bestellung && bestellung.menge === neu.menge) {
      setBestellungen(prev => prev.map(b => b.id === neu.bestellung_id ? { ...b, status: 'Geliefert', geliefert_am: heute() } : b))
    } else if (bestellung) {
      setBestellungen(prev => prev.map(b => b.id === neu.bestellung_id ? { ...b, status: 'Teillieferung' } : b))
    }
    setWeForm({ bestellung_id: '', lieferant: '', artikel: '', menge: '', einheit: 'Stk', qualitaet: 'OK', mitarbeiter: '' })
    setShowForm(false)
    showToast(`✅ Wareneingang "${neu.id}" gebucht – ${neu.menge} ${neu.einheit} "${neu.artikel}"`)
  }

  const handleLieferantDelete = async (id: string) => {
    if (!isDemo) {
      try { await deleteEinkaufLieferant(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setLieferanten(prev => prev.filter(l => l.id !== id))
    setDeleteId(null)
    showToast('🗑️ Lieferant gelöscht')
  }

  // KPIs
  const gesamtBestellwert = bestellungen.reduce((s, b) => {
    const n = parseFloat(b.gesamt.replace(/[^\d,]/g, '').replace(',', '.')) || 0
    return s + n
  }, 0)
  const offeneBs = bestellungen.filter(b => b.status === 'Entwurf' || b.status === 'Bestellt').length
  const aktLieferanten = lieferanten.filter(l => l.status === 'Aktiv').length

  const bsStatusColor: Record<string, string> = {
    Entwurf: 'badge-gray', Bestellt: 'badge-blue', Teillieferung: 'badge-orange', Geliefert: 'badge-green', Storniert: 'badge-red',
  }
  const weQualColor: Record<string, string> = { OK: 'badge-green', Mängel: 'badge-orange', Abgelehnt: 'badge-red' }
  const KATEGORIEN_LF = ['Rohstoffe', 'Kleinteile', 'Betriebsstoffe', 'Verbrauchsmaterial', 'Werkzeug', 'Schutzausrüstung', 'Büromaterial', 'Sonstiges']
  const EINHEITEN_LF = ['Stk', 'Liter', 'kg', 'Meter', 'Rollen', 'Paar', 'Karton', 'Palette']

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Einkaufsdaten…</div>

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* KPI-Zeile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aktive Lieferanten', value: String(aktLieferanten), icon: '🏭', color: '#20c8ff' },
          { label: 'Offene Bestellungen', value: String(offeneBs), icon: '🛒', color: '#f59e0b' },
          { label: 'Wareneingänge', value: String(wareneingaenge.length), icon: '📥', color: '#10b981' },
          { label: 'Ges. Bestellwert', value: gesamtBestellwert.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €', icon: '💶', color: '#1684ff' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {([
          { id: 'lieferanten', label: '🏭 Lieferanten' },
          { id: 'bestellungen', label: `🛒 Bestellungen${offeneBs > 0 ? ` (${offeneBs})` : ''}` },
          { id: 'wareneingaenge', label: '📥 Wareneingänge' },
        ] as { id: EinkaufSubTab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setShowForm(false) }} style={{
            padding: '9px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: subTab === t.id ? '2px solid #20c8ff' : '2px solid transparent',
            color: subTab === t.id ? '#20c8ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── LIEFERANTEN ── */}
      {subTab === 'lieferanten' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="pk-btn" onClick={() => { setEditLieferant(null); setLfForm({ name: '', kontakt: '', email: '', telefon: '', ort: '', kategorie: 'Rohstoffe', zahlungsziel: '30 Tage netto' }); setShowForm(f => !f) }} style={{ fontSize: 13 }}>
              {showForm && !editLieferant ? '✕ Abbrechen' : '+ Neuer Lieferant'}
            </button>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>
                {editLieferant ? `✏️ Lieferant bearbeiten: ${editLieferant.name}` : '🏭 Neuen Lieferanten anlegen'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Name *</label><input className="pk-input" placeholder="Firmenname" value={lfForm.name} onChange={e => setLfForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label style={labelStyle}>Ansprechpartner</label><input className="pk-input" placeholder="Vor- und Nachname" value={lfForm.kontakt} onChange={e => setLfForm(p => ({ ...p, kontakt: e.target.value }))} /></div>
                <div><label style={labelStyle}>E-Mail *</label><input className="pk-input" type="email" placeholder="email@lieferant.de" value={lfForm.email} onChange={e => setLfForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div><label style={labelStyle}>Telefon</label><input className="pk-input" placeholder="040 12345" value={lfForm.telefon} onChange={e => setLfForm(p => ({ ...p, telefon: e.target.value }))} /></div>
                <div><label style={labelStyle}>Ort</label><input className="pk-input" placeholder="Stadt" value={lfForm.ort} onChange={e => setLfForm(p => ({ ...p, ort: e.target.value }))} /></div>
                <div><label style={labelStyle}>Kategorie</label>
                  <select className="pk-input" value={lfForm.kategorie} onChange={e => setLfForm(p => ({ ...p, kategorie: e.target.value }))}>
                    {KATEGORIEN_LF.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Zahlungsziel</label>
                  <select className="pk-input" value={lfForm.zahlungsziel} onChange={e => setLfForm(p => ({ ...p, zahlungsziel: e.target.value }))}>
                    {['Sofort', '7 Tage netto', '14 Tage 2% Skonto', '21 Tage netto', '30 Tage netto', '60 Tage netto'].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button className="pk-btn" onClick={handleLieferantSave} style={{ fontWeight: 700 }}>
                  {editLieferant ? 'Speichern' : 'Lieferanten anlegen'}
                </button>
                <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditLieferant(null) }} style={{ fontSize: 13 }}>Abbrechen</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Kategorie</th><th>Ansprechpartner</th><th>E-Mail</th><th>Ort</th><th>Zahlungsziel</th><th>Bewertung</th><th>Status</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {lieferanten.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🏭 Noch keine Lieferanten angelegt.</td></tr>
                  ) : lieferanten.map(l => (
                    <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => openEditLieferant(l)}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{l.id}</td>
                      <td style={{ fontWeight: 700 }}>{l.name}</td>
                      <td><span className="badge badge-gray">{l.kategorie}</span></td>
                      <td style={{ color: '#d0d9e8' }}>{l.kontakt}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 12 }}>{l.email}</td>
                      <td style={{ color: '#aeb9c8' }}>{l.ort}</td>
                      <td style={{ fontSize: 12, color: '#aeb9c8' }}>{l.zahlungsziel}</td>
                      <td style={{ color: '#f59e0b' }}>{'★'.repeat(l.bewertung)}{'☆'.repeat(5 - l.bewertung)}</td>
                      <td><span className={`badge ${l.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{l.status}</span></td>
                      <td>
                        {deleteId === l.id ? (
                          <DeleteConfirm label={l.name} onConfirm={() => handleLieferantDelete(l.id)} onCancel={() => setDeleteId(null)} />
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); openEditLieferant(l) }} style={{ background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13 }}>✏️</button>
                            <button onClick={e => { e.stopPropagation(); setBsForm(p => ({ ...p, lieferant: l.name })); setSubTab('bestellungen'); setShowForm(true) }} title="Bestellung anlegen" style={{ background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#4ddb7e', fontSize: 13 }}>🛒</button>
                            <button onClick={e => { e.stopPropagation(); setDeleteId(l.id) }} style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BESTELLUNGEN ── */}
      {subTab === 'bestellungen' && (
        <div>
          {selectedBestellung && (
            <Modal title={`🛒 Bestellung ${selectedBestellung.id}`} onClose={() => setSelectedBestellung(null)}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Lieferant</label><div className="pk-input">{selectedBestellung.lieferant}</div></div>
                <div><label style={labelStyle}>Artikel</label><div className="pk-input">{selectedBestellung.artikel}</div></div>
                <div><label style={labelStyle}>Menge</label><div className="pk-input">{selectedBestellung.menge} {selectedBestellung.einheit}</div></div>
                <div><label style={labelStyle}>Status</label><div className="pk-input">{selectedBestellung.status}</div></div>
                <div><label style={labelStyle}>EK-Preis</label><div className="pk-input">{selectedBestellung.einkaufspreis}</div></div>
                <div><label style={labelStyle}>Gesamt</label><div className="pk-input">{selectedBestellung.gesamt}</div></div>
                <div><label style={labelStyle}>Bestellt am</label><div className="pk-input">{selectedBestellung.bestellt_am}</div></div>
                <div><label style={labelStyle}>Erwartet</label><div className="pk-input">{selectedBestellung.erwartet_am || '—'}</div></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><div className="pk-input">{selectedBestellung.notiz || '—'}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                {selectedBestellung.status === 'Entwurf' && <button className="pk-btn" onClick={() => { handleBestellungAusloesen(selectedBestellung.id); setSelectedBestellung(null) }}>Auslösen</button>}
                {(selectedBestellung.status === 'Bestellt' || selectedBestellung.status === 'Teillieferung') && <button className="pk-btn" onClick={() => { setWeForm(p => ({ ...p, bestellung_id: selectedBestellung.id, lieferant: selectedBestellung.lieferant, artikel: selectedBestellung.artikel, menge: String(selectedBestellung.menge), einheit: selectedBestellung.einheit })); setSelectedBestellung(null); setSubTab('wareneingaenge'); setShowForm(true) }}>Wareneingang öffnen</button>}
                {selectedBestellung.status === 'Bestellt' && <button className="pk-btn-ghost" onClick={() => { handleBestellungGeliefert(selectedBestellung.id); setSelectedBestellung(null) }}>Als geliefert markieren</button>}
              </div>
            </Modal>
          )}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="pk-btn" onClick={() => setShowForm(f => !f)} style={{ fontSize: 13 }}>
              {showForm ? '✕ Abbrechen' : '+ Neue Bestellung'}
            </button>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{bestellungen.length} Bestellungen gesamt</span>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🛒 Neue Einkaufsbestellung</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Lieferant *</label>
                  <select className="pk-input" value={bsForm.lieferant} onChange={e => setBsForm(p => ({ ...p, lieferant: e.target.value }))}>
                    <option value="">Lieferant wählen…</option>
                    {lieferanten.filter(l => l.status === 'Aktiv').map(l => <option key={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Artikel *</label><input className="pk-input" placeholder="z.B. Stahlrohr 40x40" value={bsForm.artikel} onChange={e => setBsForm(p => ({ ...p, artikel: e.target.value }))} /></div>
                <div><label style={labelStyle}>Menge *</label><input className="pk-input" type="number" min="1" placeholder="100" value={bsForm.menge} onChange={e => setBsForm(p => ({ ...p, menge: e.target.value }))} /></div>
                <div><label style={labelStyle}>Einheit</label>
                  <select className="pk-input" value={bsForm.einheit} onChange={e => setBsForm(p => ({ ...p, einheit: e.target.value }))}>
                    {EINHEITEN_LF.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>EK-Preis / Einheit *</label><input className="pk-input" placeholder="z.B. 8,50" value={bsForm.einkaufspreis} onChange={e => setBsForm(p => ({ ...p, einkaufspreis: e.target.value }))} /></div>
                <div><label style={labelStyle}>Erwartet am</label><input className="pk-input" placeholder="TT.MM.JJJJ" value={bsForm.erwartet_am} onChange={e => setBsForm(p => ({ ...p, erwartet_am: e.target.value }))} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><input className="pk-input" placeholder="Optionale Hinweise…" value={bsForm.notiz} onChange={e => setBsForm(p => ({ ...p, notiz: e.target.value }))} /></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="pk-btn" onClick={handleBestellungSave} style={{ fontWeight: 700 }}>Als Entwurf speichern</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Best.-Nr.</th><th>Lieferant</th><th>Artikel</th><th>Menge</th><th>EK-Preis</th><th>Gesamt</th><th>Bestellt am</th><th>Erwartet</th><th>Status</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {bestellungen.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🛒 Noch keine Bestellungen.</td></tr>
                  ) : bestellungen.map(b => (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBestellung(b)}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{b.id}</td>
                      <td style={{ fontWeight: 600 }}>{b.lieferant}</td>
                      <td style={{ color: '#d0d9e8' }}>{b.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{b.menge} {b.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.einkaufspreis}</td>
                      <td style={{ fontWeight: 700, color: '#20c8ff' }}>{b.gesamt}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.bestellt_am}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.erwartet_am || '—'}</td>
                      <td><span className={`badge ${bsStatusColor[b.status] || 'badge-gray'}`}>{b.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {b.status === 'Entwurf' && (
                            <button onClick={e => { e.stopPropagation(); handleBestellungAusloesen(b.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'rgba(22,132,255,.08)', color: '#6cb6ff', cursor: 'pointer', fontWeight: 700 }}>📤 Auslösen</button>
                          )}
                          {(b.status === 'Bestellt' || b.status === 'Teillieferung') && (
                            <button onClick={e => { e.stopPropagation(); setWeForm(p => ({ ...p, bestellung_id: b.id, lieferant: b.lieferant, artikel: b.artikel, menge: String(b.menge), einheit: b.einheit })); setSubTab('wareneingaenge'); setShowForm(true) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>📥 WE buchen</button>
                          )}
                          {b.status === 'Bestellt' && (
                            <button onClick={e => { e.stopPropagation(); handleBestellungGeliefert(b.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(16,185,129,.3)', background: 'transparent', color: '#34d399', cursor: 'pointer' }}>✅ Geliefert</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENEINGÄNGE ── */}
      {subTab === 'wareneingaenge' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="pk-btn" onClick={() => setShowForm(f => !f)} style={{ fontSize: 13 }}>
              {showForm ? '✕ Abbrechen' : '+ Wareneingang buchen'}
            </button>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{wareneingaenge.length} Wareneingänge</span>
          </div>

          {showForm && (
            <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📥 Wareneingang buchen</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div><label style={labelStyle}>Bestellung *</label>
                  <select className="pk-input" value={weForm.bestellung_id} onChange={e => {
                    const b = bestellungen.find(x => x.id === e.target.value)
                    setWeForm(p => ({ ...p, bestellung_id: e.target.value, lieferant: b?.lieferant || '', artikel: b?.artikel || '', menge: String(b?.menge || ''), einheit: b?.einheit || 'Stk' }))
                  }}>
                    <option value="">Bestellung wählen…</option>
                    {bestellungen.filter(b => b.status !== 'Geliefert' && b.status !== 'Storniert').map(b => (
                      <option key={b.id} value={b.id}>{b.id} – {b.artikel} ({b.lieferant})</option>
                    ))}
                  </select>
                </div>
                <div><label style={labelStyle}>Artikel</label><input className="pk-input" value={weForm.artikel} onChange={e => setWeForm(p => ({ ...p, artikel: e.target.value }))} placeholder="Artikelname" /></div>
                <div><label style={labelStyle}>Gelieferte Menge *</label><input className="pk-input" type="number" min="1" value={weForm.menge} onChange={e => setWeForm(p => ({ ...p, menge: e.target.value }))} /></div>
                <div><label style={labelStyle}>Einheit</label>
                  <select className="pk-input" value={weForm.einheit} onChange={e => setWeForm(p => ({ ...p, einheit: e.target.value }))}>
                    {EINHEITEN_LF.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Qualität</label>
                  <select className="pk-input" value={weForm.qualitaet} onChange={e => setWeForm(p => ({ ...p, qualitaet: e.target.value as Wareneingang['qualitaet'] }))}>
                    <option>OK</option><option>Mängel</option><option>Abgelehnt</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Mitarbeiter</label><input className="pk-input" placeholder="Name" value={weForm.mitarbeiter} onChange={e => setWeForm(p => ({ ...p, mitarbeiter: e.target.value }))} /></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button className="pk-btn" onClick={handleWareneingangSave} style={{ fontWeight: 700 }}>📥 Wareneingang buchen</button>
              </div>
            </div>
          )}

          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>WE-Nr.</th><th>Bestellung</th><th>Lieferant</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Qualität</th><th>Mitarbeiter</th></tr>
                </thead>
                <tbody>
                  {wareneingaenge.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>📥 Noch keine Wareneingänge.</td></tr>
                  ) : wareneingaenge.map(w => (
                    <tr key={w.id}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{w.id}</td>
                      <td style={{ color: '#6cb6ff', fontFamily: 'monospace', fontSize: 12 }}>{w.bestellung_id}</td>
                      <td style={{ fontWeight: 600 }}>{w.lieferant}</td>
                      <td style={{ color: '#d0d9e8' }}>{w.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{w.menge} {w.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{w.datum}</td>
                      <td><span className={`badge ${weQualColor[w.qualitaet] || 'badge-gray'}`}>{w.qualitaet}</span></td>
                      <td style={{ color: '#aeb9c8' }}>{w.mitarbeiter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EinkaufTab
