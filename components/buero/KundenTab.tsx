'use client'
import React, { useState, useEffect } from 'react'
import { getBueroKunden, upsertBueroKunde, deleteBueroKunde, anonymisiereBueroKunde, checkBueroKundeDuplicate } from '@/lib/db'
import { useRole, PERMISSIONS } from '@/lib/roles'
import { genId } from '@/lib/ids'
import { Toast, Modal, StatusBadgeAngebot, StatusBadgeAuftrag, StatusBadgeRechnung, labelStyle } from './shared'
import type { Kunde, Angebot, Auftrag, Rechnung, KundeAnsprechpartner } from '@/types/buero'
import { demoKunden, demoAnsprechpartner, parseBetrag } from '@/types/buero'

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
  const [form, setForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '', website: '', strasse: '', plz: '', lieferadresse: '', rechnungsadresse: '' })
  const [cockpitTab, setCockpitTab] = useState<'angebote' | 'auftraege' | 'rechnungen' | 'ansprechpartner'>('auftraege')
  const [anonConfirm, setAnonConfirm] = useState<string | null>(null)
  const [duplikatWarnung, setDuplikatWarnung] = useState<string | null>(null)
  const [editKunde, setEditKunde] = useState<Kunde | null>(null)
  const [editKundeForm, setEditKundeForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '', status: 'Aktiv' as Kunde['status'], website: '', strasse: '', plz: '', lieferadresse: '', rechnungsadresse: '' })
  const [deleteKundeConfirm, setDeleteKundeConfirm] = useState<string | null>(null)
  const [ansprechpartner, setAnsprechpartner] = useState<KundeAnsprechpartner[]>(isDemo ? demoAnsprechpartner : [])
  const [apForm, setApForm] = useState({ name: '', email: '', telefon: '', position: '' })
  const [showApForm, setShowApForm] = useState(false)
  const [editAp, setEditAp] = useState<KundeAnsprechpartner | null>(null)
  const [deleteApConfirm, setDeleteApConfirm] = useState<string | null>(null)
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
      website: form.website || undefined,
      strasse: form.strasse || undefined,
      plz: form.plz || undefined,
      lieferadresse: form.lieferadresse || undefined,
      rechnungsadresse: form.rechnungsadresse || undefined,
    }
    if (!isDemo) {
      try { await upsertBueroKunde(newKunde) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => [newKunde, ...prev])
    setForm({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '', website: '', strasse: '', plz: '', lieferadresse: '', rechnungsadresse: '' })
    setDuplikatWarnung(null)
    setShowForm(false)
    showToast(`✅ Kunde "${newKunde.name}" wurde erfolgreich angelegt (${newKunde.id})`)
  }

  const openEditKunde = (k: Kunde) => {
    setEditKunde(k)
    setEditKundeForm({ name: k.name, typ: k.typ, ansprechpartner: k.ansprechpartner, email: k.email, telefon: k.telefon, ort: k.ort, status: k.status, website: k.website ?? '', strasse: k.strasse ?? '', plz: k.plz ?? '', lieferadresse: k.lieferadresse ?? '', rechnungsadresse: k.rechnungsadresse ?? '' })
  }

  const handleEditKundeSave = async () => {
    if (!editKunde || !editKundeForm.name || !editKundeForm.email) return
    const updated: Kunde = {
      ...editKunde, ...editKundeForm, typ: editKundeForm.typ as Kunde['typ'],
      website: editKundeForm.website || undefined,
      strasse: editKundeForm.strasse || undefined,
      plz: editKundeForm.plz || undefined,
      lieferadresse: editKundeForm.lieferadresse || undefined,
      rechnungsadresse: editKundeForm.rechnungsadresse || undefined,
    }
    if (!isDemo) {
      try { await upsertBueroKunde(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => prev.map(k => k.id === updated.id ? updated : k))
    if (selected?.id === updated.id) setSelected(updated)
    setEditKunde(null)
    showToast(`✅ Kunde "${updated.name}" wurde aktualisiert`)
  }

  const handleSaveAnsprechpartner = () => {
    if (!selected || !apForm.name) return
    if (editAp) {
      const updated: KundeAnsprechpartner = { ...editAp, ...apForm }
      setAnsprechpartner(prev => prev.map(a => a.id === editAp.id ? updated : a))
      setEditAp(null); setShowApForm(false)
      showToast('✅ Ansprechpartner aktualisiert')
    } else {
      const neu: KundeAnsprechpartner = { id: genId('AP'), kunde_id: selected.id, ...apForm }
      setAnsprechpartner(prev => [...prev, neu])
      setApForm({ name: '', email: '', telefon: '', position: '' }); setShowApForm(false)
      showToast('✅ Ansprechpartner angelegt')
    }
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
              <label style={labelStyle}>Webseite</label>
              <input className="pk-input" placeholder="https://…" value={editKundeForm.website} onChange={e => setEditKundeForm(p => ({ ...p, website: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Straße + Hausnr.</label>
              <input className="pk-input" value={editKundeForm.strasse} onChange={e => setEditKundeForm(p => ({ ...p, strasse: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input className="pk-input" value={editKundeForm.plz} onChange={e => setEditKundeForm(p => ({ ...p, plz: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" value={editKundeForm.ort} onChange={e => setEditKundeForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Lieferadresse (vollständig)</label>
              <input className="pk-input" placeholder="Str. 1, 12345 Stadt" value={editKundeForm.lieferadresse} onChange={e => setEditKundeForm(p => ({ ...p, lieferadresse: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Rechnungsadresse (vollständig)</label>
              <input className="pk-input" placeholder="Str. 1, 12345 Stadt" value={editKundeForm.rechnungsadresse} onChange={e => setEditKundeForm(p => ({ ...p, rechnungsadresse: e.target.value }))} />
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
    const kundAnsprechpartner = ansprechpartner.filter(a => a.kunde_id === selected.id)
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
          {/* Name + Kunden-Nr + Anschrift */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(32,200,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              {selected.typ === 'Firma' ? '🏢' : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-.02em' }}>{selected.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 2 }}>
                Kunden-Nr.: <strong style={{ color: '#f8fbff' }}>{selected.id}</strong> · {selected.typ}
              </div>
              {(selected.strasse || selected.ort) && (
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 2 }}>
                  📍 {[selected.strasse, selected.plz && selected.ort ? `${selected.plz} ${selected.ort}` : selected.ort].filter(Boolean).join(', ')}
                </div>
              )}
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

          {/* Kommunikation Icons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <a href={`tel:${selected.telefon}`}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.25)', color: '#4ddb7e', textDecoration: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              📞 Anrufen
            </a>
            {selected.website && (
              <a href={selected.website} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'rgba(22,132,255,.1)', border: '1px solid rgba(22,132,255,.25)', color: '#1684ff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
                🌐 Webseite
              </a>
            )}
            <a href={`mailto:${selected.email}`}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'rgba(32,200,255,.1)', border: '1px solid rgba(32,200,255,.25)', color: '#20c8ff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              ✉️ E-Mail
            </a>
          </div>

          {/* Adressen */}
          {(selected.lieferadresse || selected.rechnungsadresse) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
              {selected.lieferadresse && (
                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>📦 Lieferadresse</div>
                  <div style={{ fontSize: 14 }}>{selected.lieferadresse}</div>
                </div>
              )}
              {selected.rechnungsadresse && (
                <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>💶 Rechnungsadresse</div>
                  <div style={{ fontSize: 14 }}>{selected.rechnungsadresse}</div>
                </div>
              )}
            </div>
          )}

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
          {([['auftraege', `Aufträge (${kundAuftraege.length})`], ['angebote', `Angebote (${kundAngebote.length})`], ['rechnungen', `Rechnungen (${kundRechnungen.length})`], ['ansprechpartner', `Ansprechpartner (${kundAnsprechpartner.length})`]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setCockpitTab(t)}
              className={cockpitTab === t ? 'pk-btn' : 'pk-btn-ghost'}
              style={{ fontSize: 13, padding: '8px 14px' }}>
              {label}
            </button>
          ))}
        </div>

        <div className="pk-card" style={{ padding: cockpitTab === 'ansprechpartner' ? 20 : 0 }}>
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
          {cockpitTab === 'ansprechpartner' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>👥 Ansprechpartner für {selected.name}</h4>
                <button className="pk-btn" style={{ fontSize: 12 }}
                  onClick={() => { setEditAp(null); setApForm({ name: '', email: '', telefon: '', position: '' }); setShowApForm(f => !f) }}>
                  {showApForm && !editAp ? '✕ Abbrechen' : '+ Ansprechpartner'}
                </button>
              </div>
              {showApForm && (
                <div className="pk-card fade-in" style={{ marginBottom: 16, border: '1px solid rgba(32,200,255,.2)', padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Name *</label>
                      <input className="pk-input" placeholder="Vor- und Nachname" value={apForm.name} onChange={e => setApForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Position / Abteilung</label>
                      <input className="pk-input" placeholder="z.B. Einkauf" value={apForm.position} onChange={e => setApForm(p => ({ ...p, position: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>E-Mail</label>
                      <input className="pk-input" type="email" value={apForm.email} onChange={e => setApForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Telefon</label>
                      <input className="pk-input" value={apForm.telefon} onChange={e => setApForm(p => ({ ...p, telefon: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button className="pk-btn" onClick={handleSaveAnsprechpartner} style={{ fontSize: 13 }}>Speichern</button>
                    <button className="pk-btn-ghost" onClick={() => { setShowApForm(false); setEditAp(null) }} style={{ fontSize: 13 }}>Abbrechen</button>
                  </div>
                </div>
              )}
              {kundAnsprechpartner.length === 0 && !showApForm ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#aeb9c8', fontSize: 13 }}>
                  Noch keine weiteren Ansprechpartner angelegt.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {kundAnsprechpartner.map(ap => (
                    <div key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(32,200,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontWeight: 700 }}>{ap.name}</div>
                        {ap.position && <div style={{ fontSize: 12, color: '#aeb9c8' }}>{ap.position}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ap.telefon && (
                          <a href={`tel:${ap.telefon}`} style={{ fontSize: 12, color: '#4ddb7e', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.2)' }}>
                            📞 {ap.telefon}
                          </a>
                        )}
                        {ap.email && (
                          <a href={`mailto:${ap.email}`} style={{ fontSize: 12, color: '#20c8ff', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, background: 'rgba(32,200,255,.1)', border: '1px solid rgba(32,200,255,.2)' }}>
                            ✉️ {ap.email}
                          </a>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditAp(ap); setApForm({ name: ap.name, email: ap.email, telefon: ap.telefon, position: ap.position ?? '' }); setShowApForm(true) }}
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(32,200,255,.3)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>✏️</button>
                        {deleteApConfirm === ap.id ? (
                          <>
                            <button onClick={() => { setAnsprechpartner(prev => prev.filter(a => a.id !== ap.id)); setDeleteApConfirm(null); showToast('🗑️ Ansprechpartner gelöscht') }}
                              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                            <button onClick={() => setDeleteApConfirm(null)}
                              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteApConfirm(ap.id)}
                            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,80,80,.2)', background: 'rgba(255,80,80,.05)', color: '#ff8080', cursor: 'pointer' }}>🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              <label style={labelStyle}>Webseite</label>
              <input className="pk-input" placeholder="https://…" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Straße + Hausnr.</label>
              <input className="pk-input" placeholder="Musterstr. 1" value={form.strasse} onChange={e => setForm(p => ({ ...p, strasse: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>PLZ</label>
              <input className="pk-input" placeholder="12345" value={form.plz} onChange={e => setForm(p => ({ ...p, plz: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" placeholder="Stadt" value={form.ort} onChange={e => setForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Lieferadresse (vollständig)</label>
              <input className="pk-input" placeholder="Str. 1, 12345 Stadt" value={form.lieferadresse} onChange={e => setForm(p => ({ ...p, lieferadresse: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Rechnungsadresse (vollständig)</label>
              <input className="pk-input" placeholder="Str. 1, 12345 Stadt (leer = wie Lieferadresse)" value={form.rechnungsadresse} onChange={e => setForm(p => ({ ...p, rechnungsadresse: e.target.value }))} />
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
