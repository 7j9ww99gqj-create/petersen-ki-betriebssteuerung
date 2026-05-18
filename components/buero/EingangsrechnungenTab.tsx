'use client'
import React, { useState, useEffect } from 'react'
import { getBueroEingangsrechnungen, upsertBueroEingangsrechnung, deleteBueroEingangsrechnung, markEingangsrechnungBezahlt, updateEingangsrechnungStatus, upsertSteuerBeleg, getBueroDokumente, getEinkaufLieferanten, updateBueroDokument } from '@/lib/db'
import DocumentPreviewModal from '@/components/DocumentPreviewModal'
import { Toast, Modal, DeleteConfirm, StatusBadgeEingangsrechnung, labelStyle } from './shared'
import type { Eingangsrechnung, EingangsrechnungStatus, Dokument, Lieferant } from '@/types/buero'
import { demoEingangsrechnungen, demoDokumente, demoLieferanten, resolveDocumentViewUrl, isDokumentAvailableForRelation, applyDokumentRelationToState } from '@/types/buero'
import type { StoredDocumentLink } from '@/lib/documents'
import { genId } from '@/lib/ids'

// ── Eingangsrechnungen-Tab ───────────────────────────────────────────────────

const emptyEingangsForm = {
  lieferant: '', rechnungsnummer: '', rechnungsdatum: '', faelligkeit: '',
  betrag_netto: '', mwst: '', betrag_brutto: '', status: 'offen' as EingangsrechnungStatus,
  kategorie: '', iban: '', verwendungszweck: '', notiz: '', dokument_id: '', dokument_url: '',
}

function EingangRechnungenTab({ isDemo, initialFilterStatus }: { isDemo: boolean; initialFilterStatus?: string }) {
  const [rechnungen, setRechnungen] = useState<Eingangsrechnung[]>(isDemo ? demoEingangsrechnungen : [])
  const [lieferantenStamm, setLieferantenStamm] = useState<Lieferant[]>(isDemo ? demoLieferanten : [])
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [loading, setLoading] = useState(!isDemo)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'Alle' | EingangsrechnungStatus>('Alle')
  const [filterLieferant, setFilterLieferant] = useState('Alle')
  const [showForm, setShowForm] = useState(false)
  const [editRechnung, setEditRechnung] = useState<Eingangsrechnung | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyEingangsForm)
  const [previewDoc, setPreviewDoc] = useState<StoredDocumentLink | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error); setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroEingangsrechnungen(), getBueroDokumente(), getEinkaufLieferanten()])
      .then(([rechnungenData, dokumenteData, lieferantenData]) => {
        setRechnungen(rechnungenData as Eingangsrechnung[])
        setDokumente(dokumenteData as Dokument[])
        setLieferantenStamm(lieferantenData as Lieferant[])
      })
      .catch(() => showToast('Fehler beim Laden der Eingangsrechnungen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (!initialFilterStatus) return
    if (['Alle', 'offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'].includes(initialFilterStatus)) {
      setFilterStatus(initialFilterStatus as 'Alle' | EingangsrechnungStatus)
    }
  }, [initialFilterStatus])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pk_doc_ai_eingangsrechnung')
      if (!raw) return
      const imported = JSON.parse(raw) as Partial<Eingangsrechnung>
      if (!imported.lieferant && !imported.rechnungsnummer) return
      setForm({
        lieferant: imported.lieferant ?? '',
        rechnungsnummer: imported.rechnungsnummer ?? '',
        rechnungsdatum: imported.rechnungsdatum ?? '',
        faelligkeit: imported.faelligkeit ?? '',
        betrag_netto: imported.betrag_netto != null ? String(imported.betrag_netto) : '',
        mwst: imported.mwst != null ? String(imported.mwst) : '',
        betrag_brutto: imported.betrag_brutto != null ? String(imported.betrag_brutto) : '',
        status: imported.status ?? 'offen',
        kategorie: imported.kategorie ?? 'Dokumenten-KI',
        iban: imported.iban ?? '',
        verwendungszweck: imported.verwendungszweck ?? imported.rechnungsnummer ?? '',
        notiz: imported.notiz ?? 'Aus Dokumenten-KI übernommen. Bitte prüfen.',
        dokument_id: imported.dokument_id ?? '',
        dokument_url: imported.dokument_url ?? '',
      })
      setShowForm(true)
      localStorage.removeItem('pk_doc_ai_eingangsrechnung')
      showToast('📄 Erkannte Rechnung aus dem KI-Assistenten vorbereitet')
    } catch {}
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (r: Eingangsrechnung) => r.status !== 'bezahlt' && !!r.faelligkeit && r.faelligkeit < today
  const withDueStatus = (r: Eingangsrechnung): Eingangsrechnung => isOverdue(r) && r.status === 'offen' ? { ...r, status: 'überfällig' } : r
  const visibleRows = rechnungen.map(withDueStatus)
  const lieferanten = ['Alle', ...Array.from(new Set(visibleRows.map(r => r.lieferant).filter(Boolean)))]
  const filtered = visibleRows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || [r.lieferant, r.rechnungsnummer, r.kategorie, r.verwendungszweck].some(v => (v ?? '').toLowerCase().includes(q))
    const matchS = filterStatus === 'Alle' || r.status === filterStatus
    const matchL = filterLieferant === 'Alle' || r.lieferant === filterLieferant
    return matchQ && matchS && matchL
  })

  const offen = visibleRows.filter(r => ['offen', 'geprüft', 'freigegeben', 'überfällig'].includes(r.status)).length
  const ueberfaellig = visibleRows.filter(r => r.status === 'überfällig').length
  const bezahlt = visibleRows.filter(r => r.status === 'bezahlt').length
  const sumOffen = visibleRows.filter(r => r.status !== 'bezahlt' && r.status !== 'abgelehnt').reduce((s, r) => s + Number(r.betrag_brutto ?? 0), 0)
  const dokumentOptionen = dokumente.filter(d => isDokumentAvailableForRelation(d, 'eingangsrechnung_id', editRechnung?.id))

  const syncDokumentVerknuepfung = async (rechnung: Eingangsrechnung, previousDokumentId?: string) => {
    if (isDemo) return
    const nextDokumentId = rechnung.dokument_id ?? null
    if (previousDokumentId && previousDokumentId !== nextDokumentId) {
      await updateBueroDokument(previousDokumentId, { eingangsrechnung_id: null })
    }
    if (!nextDokumentId) return
    await updateBueroDokument(nextDokumentId, {
      eingangsrechnung_id: rechnung.id,
      rechnung_id: null,
      angebot_id: null,
      auftrag_id: null,
      kategorie: 'Rechnung',
      bezug: rechnung.lieferant,
    })
    setDokumente(prev => prev.map(doc => (
      doc.id === nextDokumentId
        ? applyDokumentRelationToState(doc, 'eingangsrechnung_id', rechnung.id, { kategorie: 'Rechnung', bezug: rechnung.lieferant })
        : previousDokumentId && doc.id === previousDokumentId
          ? applyDokumentRelationToState(doc, 'eingangsrechnung_id')
          : doc
    )))
  }

  const openNew = () => { setEditRechnung(null); setForm(emptyEingangsForm); setShowForm(true) }
  const openEdit = (r: Eingangsrechnung) => {
    setEditRechnung(r)
    setForm({
      lieferant: r.lieferant ?? '', rechnungsnummer: r.rechnungsnummer ?? '', rechnungsdatum: r.rechnungsdatum ?? '',
      faelligkeit: r.faelligkeit ?? '', betrag_netto: String(r.betrag_netto ?? ''), mwst: String(r.mwst ?? ''),
      betrag_brutto: String(r.betrag_brutto ?? ''), status: r.status, kategorie: r.kategorie ?? '', iban: r.iban ?? '',
      verwendungszweck: r.verwendungszweck ?? '', notiz: r.notiz ?? '', dokument_id: r.dokument_id ?? '', dokument_url: r.dokument_url ?? '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.lieferant.trim()) { showToast('Lieferant ist Pflicht', true); return }
    const previousDokumentId = editRechnung?.dokument_id
    const lieferant = lieferantenStamm.find(entry => entry.name === form.lieferant.trim())
    const payload: Eingangsrechnung = {
      id: editRechnung?.id ?? genId('ER'),
      lieferant_id: lieferant?.id ?? editRechnung?.lieferant_id,
      lieferant: form.lieferant.trim(),
      rechnungsnummer: form.rechnungsnummer.trim(),
      rechnungsdatum: form.rechnungsdatum || undefined,
      faelligkeit: form.faelligkeit || undefined,
      betrag_netto: parseFloat(form.betrag_netto.replace(',', '.')) || 0,
      mwst: parseFloat(form.mwst.replace(',', '.')) || 0,
      betrag_brutto: parseFloat(form.betrag_brutto.replace(',', '.')) || 0,
      status: form.status,
      kategorie: form.kategorie,
      iban: form.iban,
      verwendungszweck: form.verwendungszweck,
      notiz: form.notiz,
      dokument_id: form.dokument_id || undefined,
      dokument_url: form.dokument_url || undefined,
      bezahlt_am: form.status === 'bezahlt' ? (editRechnung?.bezahlt_am ?? today) : undefined,
    }
    if (!isDemo) {
      try {
        await upsertBueroEingangsrechnung(payload)
        await syncDokumentVerknuepfung(payload, previousDokumentId)
      } catch {
        showToast('Fehler beim Speichern', true); return
      }
    }
    setRechnungen(prev => editRechnung ? prev.map(r => r.id === payload.id ? payload : r) : [payload, ...prev])
    setShowForm(false); setEditRechnung(null); setForm(emptyEingangsForm)
    showToast(editRechnung ? '✅ Eingangsrechnung aktualisiert' : '✅ Eingangsrechnung angelegt')
  }

  const remove = async (id: string) => {
    if (deleteId !== id) { setDeleteId(id); return }
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo) {
      try {
        if (rechnung?.dokument_id) await updateBueroDokument(rechnung.dokument_id, { eingangsrechnung_id: null })
        await deleteBueroEingangsrechnung(id)
      } catch { showToast('Fehler beim Löschen', true); return }
    }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    if (rechnung?.dokument_id) {
      setDokumente(prev => prev.map(doc => doc.id === rechnung.dokument_id ? { ...doc, eingangsrechnung_id: undefined } : doc))
    }
    setDeleteId(null)
    showToast('🗑️ Eingangsrechnung gelöscht')
  }

  const markPaid = async (id: string) => {
    if (confirmPayId !== id) { setConfirmPayId(id); return }
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo) {
      try {
        await markEingangsrechnungBezahlt(id, today)
        // Sync zu SteuerPilot: Beleg anlegen
        if (rechnung) {
          const steuersatz = rechnung.betrag_netto && rechnung.betrag_brutto && rechnung.betrag_brutto > rechnung.betrag_netto
            ? Math.round((rechnung.betrag_brutto / rechnung.betrag_netto - 1) * 100)
            : 19
          const steuerbetrag = rechnung.mwst ?? (rechnung.betrag_brutto ?? 0) - (rechnung.betrag_netto ?? 0)
          await upsertSteuerBeleg({
            id: `BLG-ER-${id}`,
            lieferant: rechnung.lieferant,
            betrag: rechnung.betrag_brutto ?? 0,
            steuerbetrag: steuerbetrag,
            steuersatz: [0, 7, 19].includes(steuersatz) ? steuersatz : 19,
            datum: rechnung.rechnungsdatum ?? today,
            status: 'geprüft',
            notiz: `Aus Eingangsrechnung ${rechnung.rechnungsnummer ?? id} (auto-sync)`,
          })
        }
      } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'bezahlt', bezahlt_am: today } : r))
    setConfirmPayId(null)
    showToast('💚 Eingangsrechnung als bezahlt markiert — Beleg in SteuerPilot angelegt')
  }

  const changeStatus = async (id: string, status: EingangsrechnungStatus) => {
    if (!isDemo) {
      try { await updateEingangsrechnungStatus(id, status) } catch { showToast('Fehler beim Status-Update', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const openLinkedDocument = async (rechnung: Eingangsrechnung) => {
    if (isDemo) {
      showToast('Demo: Für verknüpfte Dokumente ist keine echte Datei hinterlegt.', true)
      return
    }

    const docLink: StoredDocumentLink = {
      id: rechnung.id,
      name: rechnung.rechnungsnummer || rechnung.id,
      typ: 'PDF',
      dokument_id: rechnung.dokument_id,
      dokument_url: rechnung.dokument_url,
    }

    setPreviewDoc(docLink)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl('')

    try {
      setPreviewUrl(await resolveDocumentViewUrl(docLink))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Eingangsrechnungen…</div>

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          url={previewUrl}
          loading={previewLoading}
          error={previewError}
          onClose={() => {
            setPreviewDoc(null)
            setPreviewUrl('')
            setPreviewError(null)
          }}
          onRetry={async () => {
            if (!previewDoc) return
            setPreviewLoading(true)
            setPreviewError(null)
            setPreviewUrl('')
            try {
              setPreviewUrl(await resolveDocumentViewUrl(previewDoc))
            } catch (err) {
              setPreviewError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
            } finally {
              setPreviewLoading(false)
            }
          }}
          onOpenExternal={previewUrl ? () => window.open(previewUrl, '_blank', 'noopener,noreferrer') : undefined}
        />
      )}
      {ueberfaellig > 0 && (
        <button onClick={() => setFilterStatus('überfällig')} style={{ width: '100%', marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.28)', color: '#fda4af', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
          ⚠️ {ueberfaellig} Eingangsrechnung{ueberfaellig !== 1 ? 'en sind' : ' ist'} überfällig und sollte geprüft werden.
        </button>
      )}

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Offen', value: String(offen), icon: '⏳', color: '#f59e0b' },
          { label: 'Überfällig', value: String(ueberfaellig), icon: '⚠️', color: ueberfaellig ? '#f43f5e' : '#10b981' },
          { label: 'Bezahlt', value: String(bezahlt), icon: '💚', color: '#10b981' },
          { label: 'Summe offen', value: sumOffen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }), icon: '💶', color: '#20c8ff' },
        ].map(s => (
          <button key={s.label} className="pk-card" onClick={() => setFilterStatus(s.label === 'Offen' ? 'offen' : s.label === 'Überfällig' ? 'überfällig' : s.label === 'Bezahlt' ? 'bezahlt' : 'Alle')} style={{ textAlign: 'center', padding: '14px 10px', cursor: 'pointer', color: 'inherit' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8' }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="pk-btn" onClick={openNew} style={{ fontWeight: 700 }}>+ Eingangsrechnung</button>
        <input className="pk-input" placeholder="Suche Lieferant, Nr., Kategorie…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <select className="pk-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'Alle' | EingangsrechnungStatus)} style={{ maxWidth: 180 }}>
          {(['Alle', 'offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'] as const).map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="pk-input" value={filterLieferant} onChange={e => setFilterLieferant(e.target.value)} style={{ maxWidth: 220 }}>
          {lieferanten.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      {showForm && (
        <Modal title={editRechnung ? `📥 Eingangsrechnung bearbeiten – ${editRechnung.id}` : '📥 Eingangsrechnung hinzufügen'} onClose={() => { setShowForm(false); setEditRechnung(null) }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div><label style={labelStyle}>Lieferant *</label><input className="pk-input" value={form.lieferant} onChange={e => setForm(p => ({ ...p, lieferant: e.target.value }))} /></div>
            <div><label style={labelStyle}>Rechnungsnummer</label><input className="pk-input" value={form.rechnungsnummer} onChange={e => setForm(p => ({ ...p, rechnungsnummer: e.target.value }))} /></div>
            <div><label style={labelStyle}>Rechnungsdatum</label><input className="pk-input" type="date" value={form.rechnungsdatum} onChange={e => setForm(p => ({ ...p, rechnungsdatum: e.target.value }))} /></div>
            <div><label style={labelStyle}>Fälligkeit</label><input className="pk-input" type="date" value={form.faelligkeit} onChange={e => setForm(p => ({ ...p, faelligkeit: e.target.value }))} /></div>
            <div><label style={labelStyle}>Netto</label><input className="pk-input" type="number" step="0.01" value={form.betrag_netto} onChange={e => setForm(p => ({ ...p, betrag_netto: e.target.value }))} /></div>
            <div><label style={labelStyle}>MwSt</label><input className="pk-input" type="number" step="0.01" value={form.mwst} onChange={e => setForm(p => ({ ...p, mwst: e.target.value }))} /></div>
            <div><label style={labelStyle}>Brutto</label><input className="pk-input" type="number" step="0.01" value={form.betrag_brutto} onChange={e => setForm(p => ({ ...p, betrag_brutto: e.target.value }))} /></div>
            <div><label style={labelStyle}>Status</label><select className="pk-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as EingangsrechnungStatus }))}>{(['offen', 'geprüft', 'freigegeben', 'bezahlt', 'überfällig', 'abgelehnt'] as const).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={labelStyle}>Kategorie</label><input className="pk-input" value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))} /></div>
            <div><label style={labelStyle}>IBAN</label><input className="pk-input" value={form.iban} onChange={e => setForm(p => ({ ...p, iban: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Verknüpftes Dokument</label>
              <select
                className="pk-input"
                value={form.dokument_id}
                onChange={e => setForm(p => ({ ...p, dokument_id: e.target.value, dokument_url: '' }))}
              >
                <option value="">Kein Dokument verknüpft</option>
                {dokumentOptionen.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} ({doc.datum})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Verwendungszweck</label><input className="pk-input" value={form.verwendungszweck} onChange={e => setForm(p => ({ ...p, verwendungszweck: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notiz</label><textarea className="pk-input" rows={3} value={form.notiz} onChange={e => setForm(p => ({ ...p, notiz: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button className="pk-btn-ghost" onClick={() => { setShowForm(false); setEditRechnung(null) }}>Abbrechen</button>
            <button className="pk-btn" onClick={save} style={{ fontWeight: 700 }}>Speichern</button>
          </div>
        </Modal>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr><th>Nr.</th><th>Lieferant</th><th>Fälligkeit</th><th>Brutto</th><th>Status</th><th>Kategorie</th><th>Aktionen</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>Keine Eingangsrechnungen gefunden.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(r)}>
                  <td><div style={{ fontFamily: 'monospace', color: '#6cb6ff', fontSize: 12 }}>{r.rechnungsnummer || r.id}</div><div style={{ color: '#aeb9c8', fontSize: 11 }}>{r.rechnungsdatum || '—'}</div></td>
                  <td style={{ fontWeight: 700 }}>{r.lieferant}</td>
                  <td style={{ color: isOverdue(r) ? '#f43f5e' : '#aeb9c8', fontWeight: isOverdue(r) ? 700 : 500 }}>{r.faelligkeit || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{Number(r.betrag_brutto ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                  <td><StatusBadgeEingangsrechnung status={r.status} /></td>
                  <td><span className="badge badge-gray">{r.kategorie || '—'}</span></td>
                  <td>
                    {deleteId === r.id ? <DeleteConfirm label={r.rechnungsnummer || r.id} onConfirm={() => remove(r.id)} onCancel={() => setDeleteId(null)} /> : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(r.dokument_url || r.dokument_id) && (
                          <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); openLinkedDocument(r) }} style={{ fontSize: 11, padding: '4px 9px' }}>
                            Dokument
                          </button>
                        )}
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/buero/eingangsrechnungen/${encodeURIComponent(r.id)}` }} style={{ fontSize: 11, padding: '4px 9px' }}>
                          Details
                        </button>
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); openEdit(r) }} style={{ fontSize: 11, padding: '4px 9px' }}>Bearbeiten</button>
                        {r.status !== 'bezahlt' && (
                          confirmPayId === r.id ? (
                            <>
                              <button onClick={e => { e.stopPropagation(); markPaid(r.id) }} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(37,211,102,.35)', background: 'rgba(37,211,102,.14)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>Ja, bezahlt</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmPayId(null) }} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                            </>
                          ) : <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); markPaid(r.id) }} style={{ fontSize: 11, padding: '4px 9px', color: '#4ddb7e' }}>Bezahlt</button>
                        )}
                        {r.status === 'offen' && <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); changeStatus(r.id, 'geprüft') }} style={{ fontSize: 11, padding: '4px 9px' }}>Prüfen</button>}
                        <button className="pk-btn-ghost" onClick={e => { e.stopPropagation(); remove(r.id) }} style={{ fontSize: 11, padding: '4px 9px', color: '#ff8080' }}>Löschen</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 10, color: '#aeb9c8', fontSize: 12 }}>{filtered.length} von {rechnungen.length} Eingangsrechnungen</div>
    </div>
  )
}

export default EingangRechnungenTab
