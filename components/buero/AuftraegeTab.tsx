'use client'
import React, { useState, useEffect } from 'react'
import { getBueroDokumente, upsertBueroAuftrag, deleteBueroAuftrag, updateBueroDokument, upsertBueroRechnung, getNextInvoiceNumber } from '@/lib/db'
import { generateAuftragsbestaetigungPDFAuto as generateAuftragsbestaetigungPDF } from '@/lib/pondruff-pdf'
import { genId } from '@/lib/ids'
import { PACKAGE_PRICING, EMPLOYEE_TIERS, type PackageId, type EmployeeTierId } from '@/lib/pricingConfig'
import { Toast, Modal, DeleteConfirm, StatusBadgeAuftrag, ProgressBar, labelStyle } from './shared'
import type { Auftrag, Kunde, Rechnung, Dokument, Tab } from '@/types/buero'
import { demoDokumente, getLinkedDokument, isDokumentAvailableForRelation, applyDokumentRelationToState, getLocalFirmaDefaults } from '@/types/buero'

function AuftraegeTab({ isDemo, auftraege, setAuftraege, kunden, setTab, setRechnungen: setSharedRechnungen, setMailTarget: setSharedMailTarget }: { isDemo: boolean; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>; kunden: Kunde[]; setTab: (t: Tab) => void; setRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>>; setMailTarget?: React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>> }) {
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', dokumentId: '', paketId: '' as PackageId | '', tier: '' as EmployeeTierId | '' })

  // Edit-Modal
  const [editAuftrag, setEditAuftrag] = useState<Auftrag | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', status: 'AB erforderlich' as Auftrag['status'], fortschritt: 0, dokumentId: '' })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // AB Mail
  const [auftragMailTarget, setAuftragMailTarget] = useState<{ id: string; email: string; typ: 'ab' } | null>(null)
  const [auftragMailSending, setAuftragMailSending] = useState(false)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  useEffect(() => {
    if (isDemo) return
    getBueroDokumente()
      .then(data => setDokumente(data as Dokument[]))
      .catch(() => showToast('Fehler beim Laden der Dokumente', true))
  }, [isDemo])

  const filtered = auftraege.filter(a => filterStatus === 'Alle' || a.status === filterStatus)
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'auftrag_id', editAuftrag?.id))

  const statusColor: Record<string, string> = {
    'AB erforderlich': '#f59e0b',
    'AB erstellt': '#1684ff',
    'AB versendet': '#25d366',
    'In Bearbeitung': '#1684ff',
    Abgeschlossen: '#25d366',
    Geplant: '#aeb9c8',
    Pausiert: '#f59e0b',
  }

  const syncDokumentVerknuepfung = async (auftrag: Auftrag, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { auftrag_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: null,
      rechnung_id: null,
      angebot_id: null,
      auftrag_id: auftrag.id,
      kategorie: 'Vertrag',
      bezug: auftrag.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'auftrag_id', auftrag.id, { kategorie: 'Vertrag', bezug: auftrag.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'auftrag_id')
          : doc
    )))
  }

  const getNextABNumber = (): string => {
    const year = new Date().getFullYear()
    const existing = auftraege
      .map(a => a.ab_nummer)
      .filter(Boolean)
      .filter(n => n?.startsWith(`AB-${year}-`))
      .map(n => parseInt(n!.replace(`AB-${year}-`, ''), 10))
      .filter(n => !isNaN(n))
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
    return `AB-${year}-${String(next).padStart(3, '0')}`
  }

  const handleAbschliessen = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!isDemo && auftrag) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'Abgeschlossen', fortschritt: 100 }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'Abgeschlossen', fortschritt: 100 } : a))
    showToast(`✅ Auftrag ${id} wurde als abgeschlossen markiert`)
  }

  const handleABErstellen = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!auftrag) return
    const abNummer = isDemo ? `AB-${new Date().getFullYear()}-DEMO` : getNextABNumber()
    if (!isDemo) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'AB erstellt', ab_nummer: abNummer }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'AB erstellt', ab_nummer: abNummer } : a))
    showToast(`📋 Auftragsbestätigung ${abNummer} erstellt – bitte verschicken`)
  }

  const handleABStarten = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!isDemo && auftrag) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'In Bearbeitung', fortschritt: 10 }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'In Bearbeitung', fortschritt: 10 } : a))
    showToast(`▶ Auftrag ${id} gestartet`)
  }

  const handleABMailSend = async (email: string, auftrag: Auftrag) => {
    setAuftragMailSending(true)
    try {
      const subject = `Auftragsbestätigung ${auftrag.ab_nummer || auftrag.id}`
      const body = ['Guten Tag,', '', `anbei erhalten Sie die Auftragsbestätigung für Auftrag ${auftrag.id}.`, `Beschreibung: ${auftrag.beschreibung}`, `Wert: ${auftrag.wert}`, '', 'Viele Grüße'].join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      const today = new Date().toISOString().split('T')[0]
      if (!isDemo) {
        try { await upsertBueroAuftrag({ ...auftrag, status: 'AB versendet', ab_verschickt_am: today }) } catch { /* silent */ }
      }
      setAuftraege(prev => prev.map(a => a.id === auftrag.id ? { ...a, status: 'AB versendet', ab_verschickt_am: today } : a))
      showToast(`✉️ Auftragsbestätigung verschickt`)
    } catch {
      showToast('Mailentwurf konnte nicht geöffnet werden.', true)
    } finally {
      setAuftragMailSending(false)
      setAuftragMailTarget(null)
    }
  }

  const handleAuftragZuRechnung = async (auftrag: Auftrag) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${today.getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe = {
      id: reId,
      nummer,
      kunde_id: auftrag.kunde_id,
      kunde: auftrag.kunde,
      betrag: auftrag.wert,
      faellig: fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Erstellt' as const,
      positionen: auftrag.positionen,
    }
    if (!isDemo) {
      try { await upsertBueroRechnung(newRe) } catch { showToast('Fehler beim Erstellen der Rechnung', true); return }
    }
    if (setSharedRechnungen) {
      setSharedRechnungen(prev => [{ ...newRe, kunde_id: newRe.kunde_id ?? undefined }, ...prev])
    }
    showToast(`✅ Rechnung ${newRe.nummer || newRe.id} erstellt – jetzt im Tab "Rechnungen" sichtbar`)
    setTab('rechnungen' as Tab)
  }

  const handleNeuSave = async () => {
    if (!form.kunde || !form.beschreibung || !form.wert) return
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const newA: Auftrag = {
      id: genId('A'),
      kunde_id: kunde?.id,
      kunde: form.kunde, beschreibung: form.beschreibung,
      wert: form.wert.includes('€') ? form.wert : `${form.wert} €`,
      start: form.start || fmt(today),
      ende: form.ende || fmt(new Date(today.getTime() + 30 * 86400000)),
      status: 'AB erforderlich', fortschritt: 0,
    }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(newA)
        await syncDokumentVerknuepfung(newA, form.dokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => [newA, ...prev])
    setForm({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', dokumentId: '', paketId: '', tier: '' })
    setShowForm(false)
    showToast(`✅ Auftrag ${newA.id} wurde angelegt`)
  }

  const openEdit = (a: Auftrag) => {
    setEditAuftrag(a)
    setEditForm({
      kunde: a.kunde,
      beschreibung: a.beschreibung,
      wert: a.wert,
      start: a.start,
      ende: a.ende,
      status: a.status,
      fortschritt: a.fortschritt,
      dokumentId: getLinkedDokument(dokumente, 'auftrag_id', a.id)?.id ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editAuftrag) return
    const previousDokumentId = getLinkedDokument(dokumente, 'auftrag_id', editAuftrag.id)?.id
    const updated: Auftrag = { ...editAuftrag, ...editForm, wert: editForm.wert.includes('€') ? editForm.wert : `${editForm.wert} €` }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(updated)
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAuftrag(null)
    showToast(`✅ Auftrag ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'auftrag_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { auftrag_id: null })
        await deleteBueroAuftrag(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setAuftraege(prev => prev.filter(a => a.id !== id))
    setDokumente(prev => prev.map(doc => doc.auftrag_id === id ? { ...doc, auftrag_id: undefined } : doc))
    showToast(`🗑️ Auftrag ${id} wurde gelöscht`)
  }

  const counts: Record<string, number> = { Alle: auftraege.length }
  auftraege.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAuftrag && (
        <Modal title={`✅ Auftrag bearbeiten – ${editAuftrag.id}`} onClose={() => setEditAuftrag(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" value={editForm.beschreibung} onChange={e => setEditForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Wert (€)</label>
              <input className="pk-input" value={editForm.wert} onChange={e => setEditForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.start} onChange={e => setEditForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.ende} onChange={e => setEditForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Auftrag['status'] }))} style={{ cursor: 'pointer' }}>
                <option>AB erforderlich</option>
                <option>AB erstellt</option>
                <option>AB versendet</option>
                <option>Geplant</option>
                <option>In Bearbeitung</option>
                <option>Pausiert</option>
                <option>Abgeschlossen</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fortschritt: {editForm.fortschritt}%</label>
              <input type="range" min={0} max={100} value={editForm.fortschritt} onChange={e => setEditForm(p => ({ ...p, fortschritt: Number(e.target.value) }))} style={{ width: '100%', cursor: 'pointer', accentColor: '#20c8ff' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAuftrag(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {(['Alle', 'AB erforderlich', 'AB erstellt', 'AB versendet', 'In Bearbeitung', 'Geplant', 'Pausiert', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13 }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Auftrag'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>✅ Neuen Auftrag anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', padding: '14px 16px', borderRadius: 12, background: 'rgba(32,200,255,.05)', border: '1px solid rgba(32,200,255,.18)' }}>
              <div style={{ fontSize: 12, color: '#20c8ff', fontWeight: 700, marginBottom: 12 }}>📦 Paket auswählen (optional)</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>1. Mitarbeiterstaffel wählen</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {EMPLOYEE_TIERS.map(t => (
                    <button type="button" key={t.id} onClick={() => {
                      const pkg = form.paketId ? PACKAGE_PRICING[form.paketId as PackageId] : null
                      const price = pkg ? pkg.prices[t.id] : null
                      setForm(p => ({
                        ...p,
                        tier: t.id,
                        wert: pkg && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.wert,
                        beschreibung: pkg && price && price !== 'request' ? `${pkg.name} Paket (${t.label})` : p.beschreibung,
                      }))
                    }} style={{
                      padding: '6px 14px', borderRadius: 999,
                      border: `1px solid ${form.tier === t.id ? '#20c8ff' : 'rgba(255,255,255,.12)'}`,
                      background: form.tier === t.id ? 'rgba(32,200,255,.18)' : 'transparent',
                      color: form.tier === t.id ? '#20c8ff' : '#aeb9c8',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 7, fontWeight: 600 }}>2. Paket anklicken</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {Object.values(PACKAGE_PRICING).map(pkg => {
                  const price = form.tier ? pkg.prices[form.tier as EmployeeTierId] : null
                  const isSelected = form.paketId === pkg.id
                  return (
                    <div key={pkg.id} onClick={() => {
                      const tierLabel = EMPLOYEE_TIERS.find(t => t.id === form.tier)?.label ?? ''
                      const newSelected = !isSelected
                      setForm(p => ({
                        ...p,
                        paketId: newSelected ? pkg.id : '',
                        beschreibung: newSelected && price && price !== 'request' ? `${pkg.name} Paket${tierLabel ? ` (${tierLabel})` : ''}` : p.beschreibung,
                        wert: newSelected && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.wert,
                      }))
                    }} style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${isSelected ? '#20c8ff' : 'rgba(255,255,255,.08)'}`,
                      background: isSelected ? 'rgba(32,200,255,.12)' : 'rgba(255,255,255,.02)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: isSelected ? '#20c8ff' : '#f8fbff', marginBottom: 3 }}>{pkg.icon} {pkg.name}</div>
                      <div style={{ fontSize: 12, color: isSelected ? '#7ee8ff' : '#aeb9c8', fontWeight: 700 }}>
                        {price !== null ? (typeof price === 'number' ? `${price} €/Monat` : 'Auf Anfrage') : '— Staffel wählen'}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7a8d', marginTop: 5, lineHeight: 1.4 }}>
                        {pkg.included.slice(0, 3).join(' · ')}{pkg.included.length > 3 ? ' …' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsarbeiten Q3" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Wert (€) *</label>
              <input className="pk-input" placeholder="z.B. 3.500,00" value={form.wert} onChange={e => setForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.ende} onChange={e => setForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeuSave}>Auftrag anlegen</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(a => (
          (() => {
            const linkedDokument = getLinkedDokument(dokumente, 'auftrag_id', a.id)
            return (
          <div key={a.id} className="pk-card" style={{ border: `1px solid ${statusColor[a.status]}20`, cursor: 'pointer' }} onClick={() => openEdit(a)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.id}</span>
                  <StatusBadgeAuftrag status={a.status} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{a.beschreibung}</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>🏢 {a.kunde}</div>
                {a.ab_nummer && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.3)', color: '#1684ff', fontFamily: 'monospace' }}>
                      AB: {a.ab_nummer}
                    </span>
                  </div>
                )}
                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>Dokument: {linkedDokument?.name ?? '—'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#20c8ff' }}>{a.wert}</div>
                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{a.start} – {a.ende}</div>
              </div>
            </div>
            <ProgressBar value={a.fortschritt} color={statusColor[a.status]} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {a.status === 'AB erforderlich' && (
                <button onClick={e => { e.stopPropagation(); handleABErstellen(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.1)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                  📋 AB erstellen
                </button>
              )}
              {a.status === 'AB erstellt' && (
                <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAuftragMailTarget({ id: a.id, email: k?.email || '', typ: 'ab' }) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.1)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}>
                  ✉️ AB verschicken
                </button>
              )}
              {a.status === 'AB versendet' && (
                <button onClick={e => { e.stopPropagation(); handleABStarten(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>
                  ▶ Auftrag starten
                </button>
              )}
              {a.ab_nummer && (
                <button onClick={e => { e.stopPropagation(); generateAuftragsbestaetigungPDF(a, a.kunde) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(32,200,255,.25)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                  📄 AB-PDF
                </button>
              )}
              {(a.status === 'In Bearbeitung' || a.status === 'Abgeschlossen') && (
                <button onClick={e => { e.stopPropagation(); handleAuftragZuRechnung(a) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                  → Rechnung erstellen
                </button>
              )}
              {a.status === 'In Bearbeitung' && (
                <button onClick={e => { e.stopPropagation(); handleAbschliessen(a.id) }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                  ✅ Abschließen
                </button>
              )}
              {(a.status === 'In Bearbeitung' || a.status === 'AB erstellt') && (
                <button onClick={e => {
                  e.stopPropagation()
                  const params = new URLSearchParams({ new: '1', auftragsnr: a.ab_nummer || a.id, kunde: a.kunde || '', titel: a.beschreibung || '' })
                  window.open(`/dashboard/werkstatt?${params.toString()}`, '_blank')
                }} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(167,139,250,.35)', background: 'rgba(167,139,250,.1)', color: '#a78bfa', cursor: 'pointer', fontWeight: 700 }}>
                  🛠️ Arbeitskarte erstellen
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); openEdit(a) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                ✏️ Bearbeiten
              </button>
              <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/auftraege/${encodeURIComponent(a.id)}` }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                ↗ Details
              </button>
              {deleteId === a.id ? (
                <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
              ) : (
                <button onClick={e => { e.stopPropagation(); setDeleteId(a.id) }} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                  🗑️ Löschen
                </button>
              )}
            </div>
          </div>
            )
          })()
        ))}
      </div>

      {auftragMailTarget && (() => {
        const auftrag = auftraege.find(a => a.id === auftragMailTarget.id)
        if (!auftrag) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAuftragMailTarget(null)}>
            <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✉️ Auftragsbestätigung senden</h3>
                <button onClick={() => setAuftragMailTarget(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{auftrag.ab_nummer || auftrag.id}</strong> — {auftrag.kunde} — {auftrag.wert}
              </div>
              <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input
                className="pk-input"
                type="email"
                value={auftragMailTarget.email}
                onChange={e => setAuftragMailTarget({ ...auftragMailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => generateAuftragsbestaetigungPDF(auftrag, auftrag.kunde)}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setAuftragMailTarget(null)} disabled={auftragMailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={auftragMailSending || !auftragMailTarget.email.includes('@')}
                  onClick={() => handleABMailSend(auftragMailTarget.email, auftrag)}
                >
                  {auftragMailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default AuftraegeTab
