'use client'
import React, { useState, useEffect } from 'react'
import { getBueroAngebote, upsertBueroAngebot, deleteBueroAngebot, getBueroDokumente, updateBueroDokument, getNextAngebotNumber, upsertBueroAuftrag, upsertBueroRechnung, getNextInvoiceNumber } from '@/lib/db'
import { generateAngebotPDF } from '@/lib/pdf'
import { genId } from '@/lib/ids'
import { PACKAGE_PRICING, EMPLOYEE_TIERS, type PackageId, type EmployeeTierId } from '@/lib/pricingConfig'
import { Toast, Modal, DeleteConfirm, StatusBadgeAngebot, labelStyle } from './shared'
import type { Kunde, Angebot, Auftrag, Rechnung, Dokument, Position, Tab } from '@/types/buero'
import { demoAngebote, demoDokumente, isDokumentAvailableForRelation, applyDokumentRelationToState, getLinkedDokument, getLocalFirmaDefaults } from '@/types/buero'

function AngeboteTab({ isDemo, kunden, auftraege, setAuftraege, initialFilterStatus, isOwner, setTab: setParentTab, setRechnungen }: { isDemo: boolean; kunden: Kunde[]; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>; initialFilterStatus?: string; isOwner?: boolean; setTab?: React.Dispatch<React.SetStateAction<Tab>>; setRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>> }) {
  const [angebote, setAngebote] = useState<Angebot[]>(isDemo ? demoAngebote : [])
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [filterErinnerung, setFilterErinnerung] = useState(false)
  const [form, setForm] = useState({ kunde: '', titel: '', betrag: '', gueltig: '', dokumentId: '', paketId: '' as PackageId | '', tier: '' as EmployeeTierId | '' })

  // Edit-Modal
  const [editAngebot, setEditAngebot] = useState<Angebot | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', titel: '', betrag: '', datum: '', gueltig: '', status: 'Entwurf' as Angebot['status'], dokumentId: '' })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Mail-Versand
  const [angebotMailTarget, setAngebotMailTarget] = useState<{ id: string; email: string } | null>(null)
  const [angebotMailSending, setAngebotMailSending] = useState(false)

  // KI-Angebotstext
  const [kiTextLoading, setKiTextLoading] = useState(false)
  const [kiText, setKiText] = useState('')

  // Positionen-Editor (Angebot Edit-Modal)
  const [editPositionen, setEditPositionen] = useState<Position[]>([])

  const handleGenerateKiText = async () => {
    if (!form.kunde && !form.titel) { showToast('Bitte zuerst Kunde und Titel ausfüllen', true); return }
    setKiTextLoading(true)
    try {
      const res = await fetch('/api/generate-angebot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kunde: form.kunde, titel: form.titel, betrag: form.betrag }),
      })
      const data = await res.json()
      if (data.text) setKiText(data.text)
      else showToast('KI-Text konnte nicht generiert werden', true)
    } catch { showToast('Fehler bei KI-Anfrage', true) }
    finally { setKiTextLoading(false) }
  }

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroAngebote(), getBueroDokumente()])
      .then(([angeboteData, dokumenteData]) => {
        setAngebote(angeboteData as Angebot[])
        setDokumente(dokumenteData as Dokument[])
      })
      .catch(() => showToast('Fehler beim Laden der Angebote', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'Entwurf', 'Erstellt', 'Versendet', 'Akzeptiert', 'Abgelehnt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus)
    }
  }, [initialFilterStatus])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleAngebotMailSend = async (email: string, angebot: Angebot) => {
    setAngebotMailSending(true)
    try {
      const subject = `Ihr Angebot ${angebot.id} von Petersen KI`
      const body = [
        'Guten Tag,',
        '',
        `anbei erhalten Sie unser Angebot ${angebot.id}.`,
        `Titel: ${angebot.titel}`,
        `Betrag: ${angebot.betrag}`,
        '',
        'Viele Gruesse',
      ].join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      const today = new Date().toISOString().split('T')[0]
      const ang = angebote.find(a => a.id === angebot.id)
      if (ang && !isDemo) {
        try { await upsertBueroAngebot({ ...ang, status: 'Versendet', verschickt_am: today }) } catch { /* silent */ }
      }
      setAngebote(prev => prev.map(a => a.id === angebot.id ? { ...a, status: 'Versendet', verschickt_am: today } : a))
      showToast(`Mailentwurf fuer ${email} geoeffnet.`)
    } catch {
      showToast('Mailentwurf konnte nicht geoeffnet werden.', true)
    } finally {
      setAngebotMailSending(false)
      setAngebotMailTarget(null)
    }
  }

  const filtered = angebote.filter(a => {
    if (filterErinnerung) return needsReminder(a)
    return filterStatus === 'Alle' || a.status === filterStatus
  })
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'angebot_id', editAngebot?.id))

  const syncDokumentVerknuepfung = async (angebot: Angebot, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { angebot_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      angebot_id: angebot.id,
      eingangsrechnung_id: null,
      rechnung_id: null,
      auftrag_id: null,
      kategorie: 'Angebot',
      bezug: angebot.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'angebot_id', angebot.id, { kategorie: 'Angebot', bezug: angebot.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'angebot_id')
          : doc
    )))
  }

  const handleSave = async () => {
    if (!form.kunde || !form.titel || !form.betrag) return
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    // Positionen aus Paket-Auswahl ableiten
    let autoPositionen: Position[] = []
    if (form.paketId && form.tier) {
      const pkg = PACKAGE_PRICING[form.paketId as PackageId]
      const price = pkg?.prices[form.tier as EmployeeTierId]
      if (pkg && price && typeof price === 'number') {
        const tierLabel = EMPLOYEE_TIERS.find(t => t.id === form.tier)?.label ?? form.tier
        autoPositionen = [{
          id: `POS-${Date.now()}`,
          beschreibung: `${pkg.name} Paket (${tierLabel}) – ${pkg.included.join(', ')}`,
          menge: 1,
          einheit: 'Abo/Monat',
          einzelpreis: price,
        }]
      }
    }
    const newAng: Angebot = {
      id: genId('ANG'),
      kunde_id: kunde?.id,
      kunde: form.kunde, titel: form.titel,
      betrag: form.betrag.includes('€') ? form.betrag : `${form.betrag} €`,
      datum: fmt(today),
      gueltig: form.gueltig || fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      status: 'Entwurf',
      positionen: autoPositionen.length > 0 ? autoPositionen : undefined,
    }
    if (!isDemo) {
      try {
        await upsertBueroAngebot(newAng)
        await syncDokumentVerknuepfung(newAng, form.dokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => [newAng, ...prev])
    setForm({ kunde: '', titel: '', betrag: '', gueltig: '', dokumentId: '', paketId: '', tier: '' })
    setShowForm(false)
    showToast(`✅ Angebot "${newAng.id}" wurde als Entwurf erstellt`)
  }

  const handleFreigeben = async (id: string) => {
    const ang = angebote.find(a => a.id === id)
    if (!ang) return
    if (!isDemo) {
      try { await upsertBueroAngebot({ ...ang, status: 'Erstellt' }) } catch { showToast('Fehler beim Freigeben', true); return }
    }
    setAngebote(prev => prev.map(a => a.id === id ? { ...a, status: 'Erstellt' } : a))
    showToast(`✅ Angebot ${id} freigegeben – bitte verschicken`)
  }

  const handleStatusChange = async (id: string, status: Angebot['status']) => {
    if (!isDemo) {
      const ang = angebote.find(a => a.id === id)
      if (ang) {
        try { await upsertBueroAngebot({ ...ang, status }) } catch { showToast('Fehler beim Speichern', true); return }
      }
    }
    setAngebote(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    showToast(`✅ Angebot ${id} wurde auf "${status}" gesetzt`)
  }

  const openEdit = (a: Angebot) => {
    setEditAngebot(a)
    setEditForm({
      kunde: a.kunde,
      titel: a.titel,
      betrag: a.betrag,
      datum: a.datum,
      gueltig: a.gueltig,
      status: a.status,
      dokumentId: getLinkedDokument(dokumente, 'angebot_id', a.id)?.id ?? '',
    })
    setEditPositionen(Array.isArray(a.positionen) ? a.positionen : [])
  }

  const handleEditSave = async () => {
    if (!editAngebot) return
    const previousDokumentId = getLinkedDokument(dokumente, 'angebot_id', editAngebot.id)?.id
    // Betrag aus Positionen berechnen, wenn vorhanden
    const positionenSumme = editPositionen.length > 0
      ? editPositionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0)
      : null
    const betragStr = positionenSumme !== null
      ? `${positionenSumme.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : (editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €`)
    const updated: Angebot = { ...editAngebot, ...editForm, betrag: betragStr, positionen: editPositionen }
    if (!isDemo) {
      try {
        await upsertBueroAngebot({ ...updated, positionen: editPositionen })
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAngebot(null)
    showToast(`✅ Angebot ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'angebot_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { angebot_id: null })
        await deleteBueroAngebot(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setAngebote(prev => prev.filter(a => a.id !== id))
    setDokumente(prev => prev.map(doc => doc.angebot_id === id ? { ...doc, angebot_id: undefined } : doc))
    showToast(`🗑️ Angebot ${id} wurde gelöscht`)
  }

  // Angebot → Auftrag konvertieren
  const handleKonvertieren = async (a: Angebot) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const newAuftrag: Auftrag = {
      id: genId('A'),
      kunde_id: a.kunde_id,
      kunde: a.kunde,
      beschreibung: a.titel,
      wert: a.betrag,
      start: fmt(today),
      ende: a.gueltig,
      status: 'AB erforderlich',
      fortschritt: 0,
      angebot_id: a.id,
      positionen: a.positionen,
    }
    if (!isDemo) {
      try {
        await upsertBueroAuftrag(newAuftrag)
        await upsertBueroAngebot({ ...a, status: 'Akzeptiert' })
      } catch { showToast('Fehler beim Erstellen des Auftrags', true); return }
    }
    setAuftraege(prev => [newAuftrag, ...prev])
    setAngebote(prev => prev.map(ang => ang.id === a.id ? { ...ang, status: 'Akzeptiert' } : ang))
    showToast(`✅ Auftrag ${newAuftrag.id} aus Angebot ${a.id} erstellt`)
    if (setParentTab) setParentTab('auftraege' as Tab)
  }

  const handleAngebotZuRechnung = async (a: Angebot) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${today.getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe = {
      id: reId, nummer,
      kunde_id: a.kunde_id,
      kunde: a.kunde,
      betrag: a.betrag,
      faellig: fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Erstellt' as const,
      positionen: a.positionen,
    }
    if (!isDemo) {
      try { await upsertBueroRechnung(newRe) } catch { showToast('Fehler beim Erstellen der Rechnung', true); return }
    }
    if (setRechnungen) {
      setRechnungen(prev => [{ ...newRe, kunde_id: newRe.kunde_id ?? undefined }, ...prev])
    }
    showToast(`✅ Rechnung ${newRe.nummer || newRe.id} erstellt – jetzt im Tab "Rechnungen" sichtbar`)
    if (setParentTab) setParentTab('rechnungen' as Tab)
  }

  const needsReminder = (a: Angebot): boolean => {
    if (a.status !== 'Versendet' || !a.verschickt_am) return false
    const days = (Date.now() - new Date(a.verschickt_am).getTime()) / (1000 * 60 * 60 * 24)
    return days >= 7
  }

  const angebotAgingDays = (a: Angebot): number | null => {
    if (a.status === 'Akzeptiert' || a.status === 'Abgelehnt') return null
    const ref = a.verschickt_am ?? a.datum
    if (!ref) return null
    let refDate: Date
    if (ref.includes('.')) {
      const [d, m, y] = ref.split('.').map(Number)
      refDate = new Date(y, m - 1, d)
    } else {
      refDate = new Date(ref)
    }
    if (isNaN(refDate.getTime())) return null
    return Math.floor((Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  const statusCounts: Record<string, number> = { Alle: angebote.length, Entwurf: 0, Erstellt: 0, Versendet: 0, Akzeptiert: 0, Abgelehnt: 0 }
  angebote.forEach(a => { statusCounts[a.status]++ })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Angebote…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAngebot && (
        <Modal title={`📋 Angebot bearbeiten – ${editAngebot.id}`} onClose={() => setEditAngebot(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" value={editForm.titel} onChange={e => setEditForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€)</label>
              <input className="pk-input" value={editForm.betrag} onChange={e => setEditForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Datum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.datum} onChange={e => setEditForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.gueltig} onChange={e => setEditForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Angebot['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Entwurf</option>
                <option>Erstellt</option>
                <option>Versendet</option>
                <option>Akzeptiert</option>
                <option>Abgelehnt</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          {/* ── Positionen-Editor ── */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#aeb9c8' }}>Positionen</label>
              <button
                onClick={() => setEditPositionen(prev => [...prev, { id: `POS-${Date.now()}`, beschreibung: '', menge: 1, einheit: 'Stk', einzelpreis: 0 }])}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.08)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}
              >
                + Position hinzufügen
              </button>
            </div>
            {editPositionen.length === 0 ? (
              <div style={{ fontSize: 12, color: '#aeb9c8', padding: '10px 0' }}>Keine Positionen – Betrag wird manuell eingegeben.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editPositionen.map((pos, idx) => (
                  <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 36px', gap: 6, alignItems: 'center' }}>
                    <input
                      className="pk-input"
                      placeholder="Beschreibung"
                      value={pos.beschreibung}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, beschreibung: e.target.value } : p))}
                    />
                    <input
                      className="pk-input"
                      placeholder="Menge"
                      type="number"
                      min={0}
                      value={pos.menge}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, menge: parseFloat(e.target.value) || 0 } : p))}
                    />
                    <select
                      className="pk-input"
                      value={pos.einheit}
                      style={{ fontSize: 12, cursor: 'pointer' }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, einheit: e.target.value } : p))}
                    >
                      {['Stk', 'h', 'm', 'm²', 'm³', 'kg', 'l', 'Psch', 'Set'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input
                      className="pk-input"
                      placeholder="Einzelpreis €"
                      type="number"
                      min={0}
                      step={0.01}
                      value={pos.einzelpreis}
                      style={{ fontSize: 12 }}
                      onChange={e => setEditPositionen(prev => prev.map((p, i) => i === idx ? { ...p, einzelpreis: parseFloat(e.target.value) || 0 } : p))}
                    />
                    <button
                      onClick={() => setEditPositionen(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 14, padding: '4px' }}
                    >🗑️</button>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#20c8ff', marginTop: 4 }}>
                  Gesamt: {editPositionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  <span style={{ color: '#aeb9c8', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>(überschreibt Betrag-Feld)</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAngebot(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {(() => {
        const today = new Date()
        const expiredOffers = angebote.filter(a => {
          if (a.status === 'Akzeptiert' || a.status === 'Abgelehnt') return false
          try {
            const [d, m, y] = a.gueltig.split('.').map(Number)
            const gueltigDate = new Date(y, m - 1, d)
            return gueltigDate < today
          } catch { return false }
        })
        const reminderOffers = angebote.filter(a => needsReminder(a))
        if (expiredOffers.length === 0 && reminderOffers.length === 0) return null
        return (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: '#fbbf24' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>⏰ Angebots-Hinweise</div>
            {expiredOffers.length > 0 && (
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>{expiredOffers.length}</strong> Angebot{expiredOffers.length > 1 ? 'e' : ''} abgelaufen (Gültigkeitsdatum überschritten)
              </div>
            )}
            {reminderOffers.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <strong>{reminderOffers.length}</strong> Angebot{reminderOffers.length > 1 ? 'e' : ''} seit 10+ Tagen ohne Rückmeldung
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Entwurf', 'Erstellt', 'Versendet', 'Akzeptiert', 'Abgelehnt'] as const).map(s => (
            <button key={s} onClick={() => { setFilterStatus(s); setFilterErinnerung(false) }} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: !filterErinnerung && filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: !filterErinnerung && filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({statusCounts[s] ?? angebote.length})</span>
            </button>
          ))}
          {(() => {
            const erinnerungCount = angebote.filter(needsReminder).length
            if (erinnerungCount === 0) return null
            return (
              <button onClick={() => setFilterErinnerung(f => !f)} style={{
                padding: '6px 14px', borderRadius: 999, border: `1px solid ${filterErinnerung ? 'rgba(245,158,11,.6)' : 'rgba(245,158,11,.3)'}`,
                background: filterErinnerung ? 'rgba(245,158,11,.2)' : 'rgba(245,158,11,.06)',
                color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                ⏰ Erinnerung fällig ({erinnerungCount})
              </button>
            )
          })()}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neues Angebot'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📋 Neues Angebot erstellen</h3>
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
                        betrag: pkg && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.betrag,
                        titel: pkg && price && price !== 'request' ? `${pkg.name} Paket (${t.label})` : p.titel,
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
                        titel: newSelected && price && price !== 'request' ? `${pkg.name} Paket${tierLabel ? ` (${tierLabel})` : ''}` : p.titel,
                        betrag: newSelected && price && typeof price === 'number' ? `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : p.betrag,
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
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsvertrag 2025" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Betrag inkl. MwSt. (€) *</label>
              <input className="pk-input" placeholder="z.B. 89,00" value={form.betrag} onChange={e => setForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.gueltig} onChange={e => setForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          {/* KI-Angebotstext */}
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: kiText ? 10 : 0 }}>
              <button
                onClick={handleGenerateKiText}
                disabled={kiTextLoading}
                style={{ padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.12)', color: '#c4b5fd', fontSize: 12, fontWeight: 700, cursor: kiTextLoading ? 'wait' : 'pointer' }}
              >
                {kiTextLoading ? '⏳ Generiere…' : '✨ KI-Angebotstext generieren'}
              </button>
              <span style={{ fontSize: 11, color: '#aeb9c8' }}>Basierend auf Kunde + Titel</span>
            </div>
            {kiText && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4, fontWeight: 700 }}>Generierter Text:</div>
                <div style={{ fontSize: 13, color: '#f8fbff', lineHeight: 1.6, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.04)', whiteSpace: 'pre-wrap' }}>{kiText}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(kiText); showToast('Text kopiert') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(167,139,250,.3)', background: 'transparent', color: '#c4b5fd', cursor: 'pointer' }}>📋 Kopieren</button>
                  <button onClick={() => setKiText('')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✕ Verwerfen</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Angebots-Nr.</th>
              <th>Kunde</th>
              <th>Leistung</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Gültig bis</th>
              <th>Dokument</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              (() => {
                const linkedDokument = getLinkedDokument(dokumente, 'angebot_id', a.id)
                return (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(a)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.nummer || a.id}</td>
                <td style={{ fontWeight: 600 }}>{a.kunde}</td>
                <td style={{ color: '#d0d9e8' }}>{a.titel}</td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.datum}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.gueltig}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{linkedDokument?.name ?? '—'}</td>
                <td><StatusBadgeAngebot status={a.status} /></td>
                <td>
                  {deleteId === a.id ? (
                    <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {a.status === 'Entwurf' && (
                        <button onClick={e => { e.stopPropagation(); handleFreigeben(a.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.4)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                          ✅ Freigeben
                        </button>
                      )}
                      {a.status === 'Erstellt' && (
                        <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAngebotMailTarget({ id: a.id, email: k?.email || '' }) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.4)', background: 'rgba(32,200,255,.12)', color: '#20c8ff', cursor: 'pointer', fontWeight: 700 }}>
                          ✉️ Verschicken
                        </button>
                      )}
                      {(() => {
                        try {
                          const [d, m, y] = a.gueltig.split('.').map(Number)
                          const gueltigDate = new Date(y, m - 1, d)
                          if (gueltigDate < new Date() && a.status !== 'Akzeptiert' && a.status !== 'Abgelehnt') {
                            return <span className="badge badge-red" style={{ fontSize: 10 }}>Abgelaufen</span>
                          }
                        } catch { /* */ }
                        return null
                      })()}
                      {a.status === 'Versendet' && (
                        <>
                          {(() => {
                            const days = angebotAgingDays(a)
                            if (days === null || days < 7) return null
                            if (days >= 14) return (
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.4)', color: '#fb7185', fontWeight: 700 }}>
                                ⚠️ {days}T offen
                              </span>
                            )
                            return (
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)', color: '#f59e0b', fontWeight: 700 }}>
                                ⏰ {days}T offen
                              </span>
                            )
                          })()}
                          <button onClick={e => { e.stopPropagation(); handleStatusChange(a.id, 'Akzeptiert') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>✅ Angenommen</button>
                          <button onClick={e => { e.stopPropagation(); handleStatusChange(a.id, 'Abgelehnt') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>✕ Abgelehnt</button>
                        </>
                      )}
                      {a.status === 'Akzeptiert' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleKonvertieren(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>
                            🔄 Auftrag erstellen
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleAngebotZuRechnung(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 700 }}>
                            📄 Rechnung erstellen
                          </button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); generateAngebotPDF(a, a.kunde) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        📄 PDF
                      </button>
                      <button onClick={e => { e.stopPropagation(); const k = kunden.find(k => k.id === a.kunde_id || k.name === a.kunde); setAngebotMailTarget({ id: a.id, email: k?.email || '' }) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        ✉️ Mail
                      </button>
                      <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/angebote/${encodeURIComponent(a.id)}` }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        ↗ Details
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(a) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(a.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
                )
              })()
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Angebote</div>

      {/* Mail-Modal Angebote */}
      {angebotMailTarget && (() => {
        const angebot = angebote.find(a => a.id === angebotMailTarget.id)
        if (!angebot) return null
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setAngebotMailTarget(null)}>
            <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✉️ Angebot per Mail senden</h3>
                <button onClick={() => setAngebotMailTarget(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{angebot.titel || angebot.id}</strong> — {angebot.kunde} — {angebot.betrag}
              </div>
              <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input
                className="pk-input"
                type="email"
                value={angebotMailTarget.email}
                onChange={e => setAngebotMailTarget({ ...angebotMailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => generateAngebotPDF(angebot, angebot.kunde)}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setAngebotMailTarget(null)} disabled={angebotMailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={angebotMailSending || !angebotMailTarget.email.includes('@')}
                  onClick={() => handleAngebotMailSend(angebotMailTarget.email, angebot)}
                >
                  {angebotMailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default AngeboteTab
