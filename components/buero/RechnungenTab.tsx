'use client'
import React, { useState, useEffect } from 'react'
import { getBueroRechnungen, upsertBueroRechnung, deleteBueroRechnung, getBueroDokumente, updateBueroDokument, getNextInvoiceNumber, getArchivPdfSignedUrl } from '@/lib/db'
import { generateRechnungPDFAuto as generateRechnungPDF } from '@/lib/pondruff-pdf'
import { genId } from '@/lib/ids'
import { Toast, Modal, DeleteConfirm, StatusBadgeRechnung, labelStyle } from './shared'
import type { Rechnung, Kunde, Dokument, Position } from '@/types/buero'
import { demoRechnungen, demoDokumente, getLinkedDokument, isDokumentAvailableForRelation, applyDokumentRelationToState, getLocalFirmaDefaults, parseBetrag } from '@/types/buero'

// ── Rechnungen-Hilfsfunktionen ──────────────────────────────────────────────

function berechneBetragAusPositionen(pos: Position[]): string {
  const sum = pos.reduce((s, p) => s + p.menge * p.einzelpreis, 0)
  return sum.toFixed(2).replace('.', ',') + ' €'
}

function PositionenEditor({ positionen, onChange }: { positionen: Position[]; onChange: (p: Position[]) => void }) {
  const addPos = () => onChange([...positionen, { id: `POS-${Date.now()}`, beschreibung: '', menge: 1, einheit: 'Stk', einzelpreis: 0 }])
  const updPos = (idx: number, field: keyof Position, value: string | number) => onChange(positionen.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  const remPos = (idx: number) => onChange(positionen.filter((_, i) => i !== idx))
  if (positionen.length === 0) {
    return <button type="button" className="pk-btn-ghost" onClick={addPos} style={{ fontSize: 12, marginTop: 4 }}>+ Positionen hinzufügen</button>
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>Positionen</div>
      {positionen.map((pos, idx) => (
        <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input className="pk-input" placeholder="Beschreibung" value={pos.beschreibung} onChange={e => updPos(idx, 'beschreibung', e.target.value)} style={{ fontSize: 12 }} />
          <input className="pk-input" type="number" placeholder="Menge" value={pos.menge} min={0} onChange={e => updPos(idx, 'menge', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
          <input className="pk-input" placeholder="Einheit" value={pos.einheit} onChange={e => updPos(idx, 'einheit', e.target.value)} style={{ fontSize: 12 }} />
          <input className="pk-input" type="number" placeholder="Preis €" value={pos.einzelpreis} min={0} step={0.01} onChange={e => updPos(idx, 'einzelpreis', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
          <button type="button" onClick={() => remPos(idx)} style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      ))}
      <button type="button" className="pk-btn-ghost" onClick={addPos} style={{ fontSize: 11, marginTop: 2 }}>+ Position</button>
    </div>
  )
}

// ── Rechnungen-Tab ──────────────────────────────────────────────────────────

function RechnungenTab({ isDemo, kunden, initialFilterStatus, sharedRechnungen, setSharedRechnungen, sharedMailTarget, setSharedMailTarget }: { isDemo: boolean; kunden: Kunde[]; initialFilterStatus?: string; sharedRechnungen?: Rechnung[]; setSharedRechnungen?: React.Dispatch<React.SetStateAction<Rechnung[]>>; sharedMailTarget?: { id: string; email: string; typ: 'rechnung' } | null; setSharedMailTarget?: React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>> }) {
  const [rechnungenLocal, setRechnungenLocal] = useState<Rechnung[]>(isDemo ? demoRechnungen : [])
  const rechnungen = sharedRechnungen ?? rechnungenLocal
  const setRechnungen: React.Dispatch<React.SetStateAction<Rechnung[]>> = setSharedRechnungen ?? setRechnungenLocal
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [form, setForm] = useState({ kunde: '', betrag: '', faellig: '', dokumentId: '' })

  // Edit-Modal
  const [editRechnung, setEditRechnung] = useState<Rechnung | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', betrag: '', faellig: '', status: 'Offen' as Rechnung['status'], dokumentId: '' })
  const [editPositionen, setEditPositionen] = useState<Position[]>([])

  // Positionen (Neu-Formular)
  const [formPositionen, setFormPositionen] = useState<Position[]>([])

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Mail-Versand
  const [mailTargetLocal, setMailTargetLocal] = useState<{ id: string; email: string; typ: 'rechnung' } | null>(null)
  const mailTarget = sharedMailTarget !== undefined ? sharedMailTarget : mailTargetLocal
  const setMailTarget = (setSharedMailTarget ?? setMailTargetLocal) as React.Dispatch<React.SetStateAction<{ id: string; email: string; typ: 'rechnung' } | null>>
  const [mailSending, setMailSending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroRechnungen(), getBueroDokumente()])
      .then(([rechnungenData, dokumenteData]) => {
        setRechnungen(rechnungenData as Rechnung[])
        setDokumente(dokumenteData as Dokument[])
      })
      .catch(() => showToast('Fehler beim Laden der Rechnungen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'Offen', 'Überfällig', 'Mahnung', 'Bezahlt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus)
    }
  }, [initialFilterStatus])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleRechnungMailSend = async (email: string, rechnung: Rechnung) => {
    setMailSending(true)
    try {
      const subject = `Ihre Rechnung ${rechnung.nummer || rechnung.id} von Petersen KI`
      const body = [
        'Guten Tag,',
        '',
        `anbei erhalten Sie die Rechnung ${rechnung.nummer || rechnung.id}.`,
        `Betrag: ${rechnung.betrag}`,
        rechnung.faellig ? `Faelligkeit: ${rechnung.faellig}` : '',
        '',
        'Viele Gruesse',
      ].filter(Boolean).join('\n')
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      showToast(`Mailentwurf fuer ${email} geoeffnet.`)
    } catch {
      showToast('Mailentwurf konnte nicht geoeffnet werden.', true)
    } finally {
      setMailSending(false)
      setMailTarget(null)
    }
  }

  const filtered = rechnungen.filter(r => filterStatus === 'Alle' || r.status === filterStatus)
  const dokumentOptionen = dokumente.filter(doc => isDokumentAvailableForRelation(doc, 'rechnung_id', editRechnung?.id))
  const counts: Record<string, number> = { Alle: rechnungen.length }
  rechnungen.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })

  // KPI-Summen
  const sumOffen = rechnungen.filter(r => r.status === 'Offen').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumBezahlt = rechnungen.filter(r => r.status === 'Bezahlt').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumUeberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  // OPOS: Fälligkeits-Aging-Buckets (offene + überfällige Rechnungen)
  const oposRechnungen = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Überfällig' || r.status === 'Mahnung')
  const oposBuckets = oposRechnungen.reduce((acc, r) => {
    if (!r.faellig) { acc.unbekannt += parseBetrag(r.betrag); return acc }
    const faelligDate = (() => {
      const parts = r.faellig.split('.')
      if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0])
      return new Date(r.faellig)
    })()
    if (isNaN(faelligDate.getTime())) { acc.unbekannt += parseBetrag(r.betrag); return acc }
    const diffDays = Math.ceil((faelligDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diffDays > 30) acc.faelligSpaeter += parseBetrag(r.betrag)
    else if (diffDays > 0) acc.faelligBald += parseBetrag(r.betrag)
    else if (diffDays > -30) acc.ueberfaellig30 += parseBetrag(r.betrag)
    else acc.ueberfaelligAlt += parseBetrag(r.betrag)
    return acc
  }, { faelligSpaeter: 0, faelligBald: 0, ueberfaellig30: 0, ueberfaelligAlt: 0, unbekannt: 0 })

  const syncDokumentVerknuepfung = async (rechnung: Rechnung, dokumentId: string, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = dokumentId || null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { rechnung_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: null,
      rechnung_id: rechnung.id,
      angebot_id: null,
      auftrag_id: null,
      kategorie: 'Rechnung',
      bezug: rechnung.kunde,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'rechnung_id', rechnung.id, { kategorie: 'Rechnung', bezug: rechnung.kunde })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'rechnung_id')
          : doc
    )))
  }

  const handleBezahlt = async (id: string) => {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo && rechnung) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Bezahlt', bezahlt_am: today }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Bezahlt', bezahltAm: today } : r))
    showToast(`✅ Rechnung ${id} als bezahlt markiert`)
  }

  const handleMahnung = async (id: string) => {
    const rechnung = rechnungen.find(r => r.id === id)
    if (!rechnung) return
    const newCount = (rechnung.mahnung_count ?? 0) + 1
    if (!isDemo) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Mahnung', mahnung_count: newCount }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Mahnung', mahnung_count: newCount } : r))
    const stufe = newCount === 1 ? '1. Mahnung' : newCount === 2 ? '2. Mahnung' : `${newCount}. Mahnung`
    const subject = `${stufe}: Rechnung ${rechnung.nummer || rechnung.id}`
    const body = [
      `Guten Tag ${rechnung.kunde},`,
      '',
      newCount === 1
        ? 'hiermit möchten wir Sie freundlich an die offene Zahlung folgender Rechnung erinnern:'
        : newCount === 2
          ? 'trotz unserer ersten Zahlungserinnerung haben wir noch keinen Zahlungseingang verzeichnen können. Wir bitten Sie dringend, folgenden Betrag zu begleichen:'
          : 'wir müssen Sie letztmalig zur Zahlung auffordern, da trotz mehrfacher Erinnerung noch kein Zahlungseingang erfolgt ist:',
      '',
      `Rechnungsnummer: ${rechnung.nummer || rechnung.id}`,
      `Betrag: ${rechnung.betrag}`,
      `Fälligkeitsdatum: ${rechnung.faellig}`,
      '',
      newCount >= 3
        ? 'Bitte überweisen Sie den ausstehenden Betrag innerhalb von 5 Werktagen. Bei weiterer Nichtzahlung behalten wir uns rechtliche Schritte vor.'
        : 'Bitte überweisen Sie den ausstehenden Betrag innerhalb von 7 Werktagen auf unser Konto.',
      '',
      'Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.',
      '',
      'Mit freundlichen Grüßen',
    ].join('\n')
    const k = kunden.find(k => k.id === rechnung.kunde_id || k.name === rechnung.kunde)
    if (k?.email) {
      window.location.href = `mailto:${encodeURIComponent(k.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
    showToast(`📮 ${stufe} für ${rechnung.nummer || id} erstellt – Mail-Entwurf vorbereitet`)
  }

  const handleNeu = async () => {
    if (isSubmitting) return
    const berechneterBetrag = formPositionen.length > 0 ? berechneBetragAusPositionen(formPositionen) : form.betrag
    if (!form.kunde || !berechneterBetrag) return
    setIsSubmitting(true)
    const today = new Date()
    const firmaDefaults = getLocalFirmaDefaults()
    const kunde = kunden.find(entry => entry.name === form.kunde)
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const reId = genId('RE')
    const nummer = isDemo
      ? `RE-${new Date().getFullYear()}-DEMO`
      : await getNextInvoiceNumber().catch(() => reId)
    const newRe: Rechnung = {
      id: reId,
      nummer,
      kunde_id: kunde?.id,
      kunde: form.kunde,
      betrag: formPositionen.length > 0 ? berechneterBetrag : (form.betrag.includes('€') ? form.betrag : `${form.betrag} €`),
      faellig: form.faellig || fmt(new Date(today.getTime() + firmaDefaults.zahlungsziel_tage * 86400000)),
      erstellt: fmt(today),
      status: 'Offen',
      positionen: formPositionen.length > 0 ? formPositionen : undefined,
    }
    if (!isDemo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { positionen: _pos1, ...newReDb } = newRe
        await upsertBueroRechnung(newReDb)
        await syncDokumentVerknuepfung(newRe, form.dokumentId)
        generateRechnungPDF(newRe, newRe.kunde, { archive: true })
          .then(() => setRechnungen(prev => prev.map(x => x.id === newRe.id ? { ...x, pdf_archived_at: new Date().toISOString() } : x)))
          .catch(() => {})
      } catch { setIsSubmitting(false); showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => [newRe, ...prev])
    setForm({ kunde: '', betrag: '', faellig: '', dokumentId: '' })
    setFormPositionen([])
    setShowForm(false)
    showToast(`✅ Rechnung ${newRe.id} wurde erstellt`)
    setIsSubmitting(false)
  }

  const openEdit = (r: Rechnung) => {
    setEditRechnung(r)
    setEditPositionen(r.positionen ?? [])
    setEditForm({
      kunde: r.kunde,
      betrag: r.betrag,
      faellig: r.faellig,
      status: r.status,
      dokumentId: getLinkedDokument(dokumente, 'rechnung_id', r.id)?.id ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editRechnung) return
    const previousDokumentId = getLinkedDokument(dokumente, 'rechnung_id', editRechnung.id)?.id
    const berechneterBetrag = editPositionen.length > 0 ? berechneBetragAusPositionen(editPositionen) : (editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €`)
    const updated: Rechnung = { ...editRechnung, ...editForm, betrag: berechneterBetrag, positionen: editPositionen.length > 0 ? editPositionen : undefined }
    if (!isDemo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { positionen: _pos2, ...updatedDb } = updated
        await upsertBueroRechnung(updatedDb)
        await syncDokumentVerknuepfung(updated, editForm.dokumentId, previousDokumentId)
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRechnung(null)
    showToast(`✅ Rechnung ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try {
        const linkedDokument = getLinkedDokument(dokumente, 'rechnung_id', id)
        if (linkedDokument) await updateBueroDokument(linkedDokument.id, { rechnung_id: null })
        await deleteBueroRechnung(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    setDokumente(prev => prev.map(doc => doc.rechnung_id === id ? { ...doc, rechnung_id: undefined } : doc))
    showToast(`🗑️ Rechnung ${id} wurde gelöscht`)
  }

  const offenCount = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Überfällig' || r.status === 'Mahnung').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Rechnungen…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editRechnung && (
        <Modal title={`💶 Rechnung bearbeiten – ${editRechnung.id}`} onClose={() => setEditRechnung(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label htmlFor="field-kunde" style={labelStyle}>Kunde</label>
              <select id="field-kunde" className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-betrag-editpositionenleng" style={labelStyle}>Betrag (€) {editPositionen.length > 0 ? '(automatisch)' : ''}</label>
              <input id="field-betrag-editpositionenleng" className="pk-input" value={editPositionen.length > 0 ? berechneBetragAusPositionen(editPositionen) : editForm.betrag} onChange={e => { if (editPositionen.length === 0) setEditForm(p => ({ ...p, betrag: e.target.value })) }} readOnly={editPositionen.length > 0} style={editPositionen.length > 0 ? { opacity: 0.6 } : {}} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <PositionenEditor positionen={editPositionen} onChange={setEditPositionen} />
            </div>
            <div>
              <label htmlFor="field-fllig-am" style={labelStyle}>Fällig am</label>
              <input id="field-fllig-am" className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.faellig} onChange={e => setEditForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="field-status" style={labelStyle}>Status</label>
              <select id="field-status" className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Rechnung['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Offen</option>
                <option>Bezahlt</option>
                <option>Überfällig</option>
                <option>Mahnung</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="field-verknpftes-dokument" style={labelStyle}>Verknüpftes Dokument</label>
              <select id="field-verknpftes-dokument" className="pk-input" value={editForm.dokumentId} onChange={e => setEditForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditRechnung(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {/* OPOS-Dashboard */}
      <div className="pk-card" style={{ marginBottom: 20, padding: 18, border: '1px solid rgba(32,200,255,.15)' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#20c8ff' }}>📊 OPOS-Dashboard (Offene Posten)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Offen', value: fmtEur(sumOffen), icon: '⏳', color: '#20c8ff', bg: 'rgba(32,200,255,.08)', border: 'rgba(32,200,255,.2)', filter: 'Offen' },
            { label: 'Überfällig/Mahnung', value: fmtEur(sumUeberfaellig), icon: '⚠️', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)', filter: 'Überfällig' },
            { label: 'Bezahlt', value: fmtEur(sumBezahlt), icon: '✅', color: '#4ddb7e', bg: 'rgba(37,211,102,.08)', border: 'rgba(37,211,102,.2)', filter: 'Bezahlt' },
          ].map(k => (
            <button key={k.label} onClick={() => setFilterStatus(k.filter as typeof filterStatus)} style={{ padding: '14px 16px', borderRadius: 12, background: k.bg, border: `1px solid ${k.border}`, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
            </button>
          ))}
        </div>
        {oposRechnungen.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fälligkeits-Aging</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {[
                { label: '> 30T (noch Zeit)', val: oposBuckets.faelligSpaeter, color: '#4ddb7e' },
                { label: '≤ 30T (bald fällig)', val: oposBuckets.faelligBald, color: '#f59e0b' },
                { label: '≤ 30T überfällig', val: oposBuckets.ueberfaellig30, color: '#fb7185' },
                { label: '> 30T überfällig', val: oposBuckets.ueberfaelligAlt, color: '#f43f5e' },
              ].filter(b => b.val > 0).map(b => (
                <div key={b.label} style={{ padding: '10px 12px', borderRadius: 10, background: b.color + '10', border: `1px solid ${b.color}30` }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: b.color, fontFamily: 'monospace' }}>{fmtEur(b.val)}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {offenCount > 0 && (
        <button onClick={() => setFilterStatus('Offen')} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ffb347' }}>
            {offenCount} offene Rechnungen – bitte prüfen und ggf. mahnen
          </span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Offen', 'Überfällig', 'Mahnung', 'Bezahlt'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Rechnung'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>💶 Neue Rechnung erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label htmlFor="field-kunde-2" style={labelStyle}>Kunde *</label>
              <select id="field-kunde-2" className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="field-betrag-formpositionenleng" style={labelStyle}>Betrag (€) {formPositionen.length > 0 ? '(automatisch)' : '*'}</label>
              <input id="field-betrag-formpositionenleng" className="pk-input" placeholder="z.B. 2.400,00" value={formPositionen.length > 0 ? berechneBetragAusPositionen(formPositionen) : form.betrag} onChange={e => { if (formPositionen.length === 0) setForm(p => ({ ...p, betrag: e.target.value })) }} readOnly={formPositionen.length > 0} style={formPositionen.length > 0 ? { opacity: 0.6 } : {}} />
            </div>
            <div>
              <label htmlFor="field-fllig-am-2" style={labelStyle}>Fällig am</label>
              <input id="field-fllig-am-2" className="pk-input" placeholder="TT.MM.JJJJ" value={form.faellig} onChange={e => setForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <PositionenEditor positionen={formPositionen} onChange={setFormPositionen} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="field-verknpftes-dokument-2" style={labelStyle}>Verknüpftes Dokument</label>
              <select id="field-verknpftes-dokument-2" className="pk-input" value={form.dokumentId} onChange={e => setForm(p => ({ ...p, dokumentId: e.target.value }))}>
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => <option key={doc.id} value={doc.id}>{doc.name} ({doc.datum})</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeu} disabled={isSubmitting}>{isSubmitting ? '⏳ Wird erstellt…' : 'Rechnung erstellen'}</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr.</th>
              <th>Kunde</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Fällig</th>
              <th>Dokument</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              (() => {
                const linkedDokument = getLinkedDokument(dokumente, 'rechnung_id', r.id)
                return (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{r.nummer || r.id}</td>
                <td style={{ fontWeight: 600 }}>{r.kunde}</td>
                <td style={{ fontWeight: 800, fontSize: 15, color: r.status === 'Bezahlt' ? '#4ddb7e' : '#f8fbff' }}>{r.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{r.erstellt}</td>
                <td style={{ color: r.status === 'Überfällig' ? '#ffb347' : '#aeb9c8', fontSize: 13, fontWeight: r.status === 'Überfällig' ? 700 : 400 }}>
                  {r.bezahltAm ? `Bezahlt: ${r.bezahltAm}` : r.faellig}
                </td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{linkedDokument?.name ?? '—'}</td>
                <td>
                  <StatusBadgeRechnung status={r.status} />
                  {r.status === 'Mahnung' && (r.mahnung_count ?? 0) > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontWeight: 700 }}>
                      {r.mahnung_count}. Mahnung
                    </span>
                  )}
                </td>
                <td>
                  {deleteId === r.id ? (
                    <DeleteConfirm label={r.id} onConfirm={() => handleDelete(r.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(r.status === 'Offen' || r.status === 'Überfällig') && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleBezahlt(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                            ✅ Bezahlt
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleMahnung(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                            📮 Mahnen
                          </button>
                        </>
                      )}
                      {r.status === 'Mahnung' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); handleBezahlt(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                            ✅ Bezahlt
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleMahnung(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                            📮 {(r.mahnung_count ?? 1) + 1}. Mahnung
                          </button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); generateRechnungPDF(r, r.kunde, { archive: true }).then(() => setRechnungen(prev => prev.map(x => x.id === r.id ? { ...x, pdf_archived_at: new Date().toISOString() } : x))) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }} title="PDF erstellen + GoBD-konform archivieren">
                        📄 PDF
                      </button>
                      {r.pdf_path && (
                        <button onClick={async e => {
                          e.stopPropagation()
                          const url = await getArchivPdfSignedUrl(r.pdf_path!)
                          if (url) window.open(url, '_blank', 'noopener')
                        }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(167,139,250,.3)', background: 'rgba(167,139,250,.08)', color: '#a78bfa', cursor: 'pointer' }} title={`Archiviert am ${r.pdf_archived_at ? new Date(r.pdf_archived_at).toLocaleDateString('de-DE') : '?'}`}>
                          📎 Archiv
                        </button>
                      )}
                      <button onClick={e => {
                        e.stopPropagation()
                        const k = kunden.find(k => k.id === r.kunde_id || k.name === r.kunde)
                        setMailTarget({ id: r.id, email: k?.email || '', typ: 'rechnung' })
                      }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.2)', background: 'rgba(32,200,255,.06)', color: '#20c8ff', cursor: 'pointer' }}>
                        ✉️ Mail
                      </button>
                      <button onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/rechnungen/${encodeURIComponent(r.id)}` }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        ↗ Details
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(r) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(r.id) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
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
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Rechnungen</div>

      {/* Mail-Modal */}
      {mailTarget && (() => {
        const rechnung = rechnungen.find(r => r.id === mailTarget.id)
        if (!rechnung) return null
        return (
          <Modal title="✉️ Rechnung per Mail senden" onClose={() => setMailTarget(null)} maxWidth={460}>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14 }}>
                <strong style={{ color: '#f8fbff' }}>{rechnung.nummer || rechnung.id}</strong> — {rechnung.kunde} — {rechnung.betrag}
              </div>
              <label htmlFor="field-e-mail-adresse-des-empfng" style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 6 }}>E-Mail-Adresse des Empfängers</label>
              <input id="field-e-mail-adresse-des-empfng"
                className="pk-input"
                type="email"
                value={mailTarget.email}
                onChange={e => setMailTarget({ ...mailTarget, email: e.target.value })}
                placeholder="kunde@beispiel.de"
                style={{ width: '100%', marginBottom: 16 }}
              />
              <button
                className="pk-btn-ghost"
                style={{ fontWeight: 700, marginBottom: 10, width: '100%' }}
                onClick={() => {
                  const r = rechnungen.find(r => r.id === mailTarget.id)
                  if (r) generateRechnungPDF(r, r.kunde, { archive: true }).then(() => setRechnungen(prev => prev.map(x => x.id === r.id ? { ...x, pdf_archived_at: new Date().toISOString() } : x)))
                }}
              >
                📄 PDF erstellen & herunterladen
              </button>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="pk-btn-ghost" onClick={() => setMailTarget(null)} disabled={mailSending}>Abbrechen</button>
                <button
                  className="pk-btn"
                  disabled={mailSending || !mailTarget.email.includes('@')}
                  onClick={() => handleRechnungMailSend(mailTarget.email, rechnung)}
                >
                  {mailSending ? '⏳ Sende…' : '✉️ Jetzt senden'}
                </button>
              </div>
          </Modal>
        )
      })()}
    </div>
  )
}

export default RechnungenTab
