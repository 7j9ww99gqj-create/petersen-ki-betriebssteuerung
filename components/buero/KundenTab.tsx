'use client'
import React, { useState, useEffect } from 'react'
import { getBueroKunden, upsertBueroKunde, deleteBueroKunde, anonymisiereBueroKunde, checkBueroKundeDuplicate } from '@/lib/db'
import { useRole, PERMISSIONS } from '@/lib/roles'
import { genId } from '@/lib/ids'
import { Toast, Modal, StatusBadgeAngebot, StatusBadgeAuftrag, StatusBadgeRechnung, labelStyle } from './shared'
import type { Kunde, Angebot, Auftrag, Rechnung } from '@/types/buero'
import { demoKunden, parseBetrag } from '@/types/buero'

function KundenTab({ isDemo, auftraege, rechnungen, angebote }: { isDemo: boolean; auftraege: Auftrag[]; rechnungen: Rechnung[]; angebote: Angebot[] }) {
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Kunde | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [form, setForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })
  const [cockpitTab, setCockpitTab] = useState<'angebote' | 'auftraege' | 'rechnungen'>('auftraege')
  const [anonConfirm, setAnonConfirm] = useState<string | null>(null)
  const [duplikatWarnung, setDuplikatWarnung] = useState<string | null>(null)
  const [editKunde, setEditKunde] = useState<Kunde | null>(null)
  const [editKundeForm, setEditKundeForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '', status: 'Aktiv' as Kunde['status'] })
  const [deleteKundeConfirm, setDeleteKundeConfirm] = useState<string | null>(null)
  const { role } = useRole()

  useEffect(() => {
    if (isDemo) return
    setLoading(true); setLoadError('')
    getBueroKunden()
      .then(data => setKunden(data as Kunde[]))
      .catch(() => setLoadError('Kunden konnten nicht geladen werden. Bitte Verbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [isDemo, retryKey])

  const filtered = kunden.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.id.toLowerCase().includes(search.toLowerCase()) ||
    k.ort.toLowerCase().includes(search.toLowerCase())
  )

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleEmailChange = async (email: string) => {
    setForm(p => ({ ...p, email }))
    setDuplikatWarnung(null)
    if (!email || isDemo) return
    try {
      const dup = await checkBueroKundeDuplicate(email)
      if (dup) setDuplikatWarnung(`⚠️ Kunde mit dieser E-Mail existiert bereits: ${dup.name}`)
    } catch { /* ignorieren */ }
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return
    const newKunde: Kunde = {
      id: genId('K'),
      name: form.name, typ: form.typ as Kunde['typ'],
      ansprechpartner: form.ansprechpartner || form.name,
      email: form.email, telefon: form.telefon, ort: form.ort,
      umsatz: '0 €', status: 'Aktiv',
    }
    if (!isDemo) {
      try { await upsertBueroKunde(newKunde) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => [newKunde, ...prev])
    setForm({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })
    setDuplikatWarnung(null)
    setShowForm(false)
    showToast(`✅ Kunde "${newKunde.name}" wurde erfolgreich angelegt (${newKunde.id})`)
  }

  const openEditKunde = (k: Kunde) => {
    setEditKunde(k)
    setEditKundeForm({ name: k.name, typ: k.typ, ansprechpartner: k.ansprechpartner, email: k.email, telefon: k.telefon, ort: k.ort, status: k.status })
  }

  const handleEditKundeSave = async () => {
    if (!editKunde || !editKundeForm.name || !editKundeForm.email) return
    const updated: Kunde = { ...editKunde, ...editKundeForm, typ: editKundeForm.typ as Kunde['typ'] }
    if (!isDemo) {
      try { await upsertBueroKunde(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => prev.map(k => k.id === updated.id ? updated : k))
    if (selected?.id === updated.id) setSelected(updated)
    setEditKunde(null)
    showToast(`✅ Kunde "${updated.name}" wurde aktualisiert`)
  }

  const handleDeleteKunde = async (id: string) => {
    setDeleteKundeConfirm(null)
    if (!isDemo) {
      try { await deleteBueroKunde(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setKunden(prev => prev.filter(k => k.id !== id))
    if (selected?.id === id) setSelected(null)
    showToast('🗑️ Kunde wurde gelöscht')
  }

  const handleAnonymize = async (id: string) => {
    if (isDemo) {
      setKunden(prev => prev.map(k => k.id === id ? { ...k, name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' } : k))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' } : null)
      setAnonConfirm(null); showToast('🔒 Kunde anonymisiert'); return
    }
    try {
      await anonymisiereBueroKunde(id)
      const anon: Partial<Kunde> = { name: '[Anonym]', email: 'anonym@geloescht.de', telefon: '', ansprechpartner: '', ort: '' }
      setKunden(prev => prev.map(k => k.id === id ? { ...k, ...anon } : k))
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...anon } as Kunde : null)
      setAnonConfirm(null); showToast('🔒 Kunde DSGVO-konform anonymisiert')
    } catch { showToast('Fehler beim Anonymisieren', true) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Kunden…</div>
      </div>
    </div>
  )

  if (loadError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div className="pk-card" style={{ textAlign: 'center', padding: 36, maxWidth: 420 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#f8fbff' }}>Laden fehlgeschlagen</div>
        <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 18 }}>{loadError}</div>
        <button onClick={() => setRetryKey(k => k + 1)} className="pk-btn" style={{ fontSize: 13 }}>↺ Erneut laden</button>
      </div>
    </div>
  )

  if (editKunde) {
    return (
      <div>
        <Toast msg={toast} error={toastError} />
        <Modal title={`👤 Kunde bearbeiten – ${editKunde.id}`} onClose={() => setEditKunde(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" value={editKundeForm.name} onChange={e => setEditKundeForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select className="pk-input" value={editKundeForm.typ} onChange={e => setEditKundeForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option>Firma</option>
                <option>Privat</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" value={editKundeForm.ansprechpartner} onChange={e => setEditKundeForm(p => ({ ...p, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" type="email" value={editKundeForm.email} onChange={e => setEditKundeForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" value={editKundeForm.telefon} onChange={e => setEditKundeForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" value={editKundeForm.ort} onChange={e => setEditKundeForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editKundeForm.status} onChange={e => setEditKundeForm(p => ({ ...p, status: e.target.value as Kunde['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Aktiv</option>
                <option>Inaktiv</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditKundeSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditKunde(null)}>Abbrechen</button>
          </div>
        </Modal>
      </div>
    )
  }

  if (selected) {
    const matchKunde = (item: { kunde_id?: string; kunde?: string }) =>
      (item.kunde_id && item.kunde_id === selected.id) || item.kunde === selected.name
    const kundAngebote = angebote.filter(matchKunde)
    const kundAuftraege = auftraege.filter(matchKunde)
    const kundRechnungen = rechnungen.filter(matchKunde)
    const umsatzBezahlt = kundRechnungen
      .filter(r => r.status === 'Bezahlt')
      .reduce((s, r) => s + parseBetrag(r.betrag), 0)
    const offeneReCount = kundRechnungen.filter(r => r.status !== 'Bezahlt').length

    return (
      <div className="fade-in">
        <Toast msg={toast} error={toastError} />
        <button className="pk-btn-ghost" onClick={() => setSelected(null)} style={{ marginBottom: 16, fontSize: 13 }}>
          ← Zurück zur Übersicht
        </button>

        {/* Cockpit Header */}
        <div className="pk-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(32,200,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {selected.typ === 'Firma' ? '🏢' : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>{selected.id} · {selected.typ} · {selected.ort}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{selected.ansprechpartner} · {selected.email} · {selected.telefon}</div>
            </div>
            <span className={`badge ${selected.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{selected.status}</span>
            {PERMISSIONS.canEdit(role) && (
              <button onClick={() => openEditKunde(selected)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.08)', color: '#20c8ff', cursor: 'pointer', fontWeight: 600 }}>✏️ Bearbeiten</button>
            )}
            {PERMISSIONS.canDelete(role) && (
              deleteKundeConfirm === selected.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#ff8080' }}>Wirklich löschen?</span>
                  <button onClick={() => handleDeleteKunde(selected.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja, löschen</button>
                  <button onClick={() => setDeleteKundeConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                </div>
              ) : (
                <button onClick={() => setDeleteKundeConfirm(selected.id)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: 'pointer', fontWeight: 600 }}>🗑️ Löschen</button>
              )
            )}
            {PERMISSIONS.canDelete(role) && (
              anonConfirm === selected.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#f59e0b' }}>Wirklich anonymisieren?</span>
                  <button onClick={() => handleAnonymize(selected.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja, anonymisieren</button>
                  <button onClick={() => setAnonConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                </div>
              ) : (
                <button onClick={() => setAnonConfirm(selected.id)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: 'pointer', fontWeight: 600 }}>🔒 Anonymisieren</button>
              )
            )}
          </div>
          {/* KPI-Zeile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 16 }}>
            {[
              { label: 'Umsatz (bezahlt)', value: umsatzBezahlt.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €', color: '#25d366' },
              { label: 'Angebote', value: String(kundAngebote.length), color: '#1684ff' },
              { label: 'Aufträge', value: String(kundAuftraege.length), color: '#20c8ff' },
              { label: 'Offene Rechnungen', value: String(offeneReCount), color: offeneReCount > 0 ? '#f59e0b' : '#aeb9c8' },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cockpit Tabs */}
        <div className="pk-tab-bar" style={{ marginBottom: 14 }}>
          {([['auftraege', `Aufträge (${kundAuftraege.length})`], ['angebote', `Angebote (${kundAngebote.length})`], ['rechnungen', `Rechnungen (${kundRechnungen.length})`]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setCockpitTab(t)}
              className={cockpitTab === t ? 'pk-btn' : 'pk-btn-ghost'}
              style={{ fontSize: 13, padding: '8px 14px' }}>
              {label}
            </button>
          ))}
        </div>

        <div className="pk-card" style={{ padding: 0 }}>
          {cockpitTab === 'angebote' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Titel</th><th>Betrag</th><th>Datum</th><th>Status</th></tr></thead>
              <tbody>
                {kundAngebote.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Angebote vorhanden</td></tr>
                ) : kundAngebote.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.nummer || a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.titel}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.betrag}</td>
                    <td style={{ color: '#aeb9c8' }}>{a.datum}</td>
                    <td><StatusBadgeAngebot status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cockpitTab === 'auftraege' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Beschreibung</th><th>Wert</th><th>Zeitraum</th><th>Status</th></tr></thead>
              <tbody>
                {kundAuftraege.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Aufträge vorhanden</td></tr>
                ) : kundAuftraege.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.id}</td>
                    <td style={{ fontWeight: 600 }}>{a.beschreibung}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.wert}</td>
                    <td style={{ color: '#aeb9c8', fontSize: 12 }}>{a.start} – {a.ende}</td>
                    <td><StatusBadgeAuftrag status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cockpitTab === 'rechnungen' && (
            <table className="pk-table">
              <thead><tr><th>Nr.</th><th>Betrag</th><th>Erstellt</th><th>Fällig</th><th>Status</th></tr></thead>
              <tbody>
                {kundRechnungen.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#aeb9c8', textAlign: 'center', padding: 24 }}>Keine Rechnungen vorhanden</td></tr>
                ) : kundRechnungen.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{r.nummer || r.id}</td>
                    <td style={{ fontWeight: 700, color: '#20c8ff' }}>{r.betrag}</td>
                    <td style={{ color: '#aeb9c8' }}>{r.erstellt}</td>
                    <td style={{ color: '#aeb9c8' }}>{r.faellig}</td>
                    <td><StatusBadgeRechnung status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Kunden suchen (Name, Nummer, Ort)…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Kunde'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>👥 Neuen Kunden anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" placeholder="z.B. Müller GmbH" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option>Firma</option>
                <option>Privat</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" placeholder="Vor- und Nachname" value={form.ansprechpartner} onChange={e => setForm(p => ({ ...p, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" placeholder="email@beispiel.de" type="email" value={form.email} onChange={e => handleEmailChange(e.target.value)} />
              {duplikatWarnung && (
                <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: '#f59e0b', fontSize: 12 }}>{duplikatWarnung}</div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" placeholder="040 123456" value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" placeholder="Stadt" value={form.ort} onChange={e => setForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleSave} style={{ fontWeight: 700 }}>Kunden anlegen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Kd.-Nr.</th>
              <th>Name</th>
              <th>Ansprechpartner</th>
              <th>Ort</th>
              <th>Typ</th>
              <th>Umsatz</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(k => (
              <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(k)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{k.id}</td>
                <td style={{ fontWeight: 700 }}>{k.typ === 'Firma' ? '🏢' : '👤'} {k.name}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ansprechpartner}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ort}</td>
                <td><span className="badge badge-gray">{k.typ}</span></td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{k.umsatz}</td>
                <td><span className={`badge ${k.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{k.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {PERMISSIONS.canEdit(role) && (
                      <button onClick={() => openEditKunde(k)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                    )}
                    {PERMISSIONS.canDelete(role) && (
                      deleteKundeConfirm === k.id ? (
                        <>
                          <button onClick={() => handleDeleteKunde(k.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                          <button onClick={() => setDeleteKundeConfirm(null)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteKundeConfirm(k.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                      )
                    )}
                    <span style={{ color: '#aeb9c8', fontSize: 16 }}>›</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {kunden.length} Kunden</div>
    </div>
  )
}

export default KundenTab
