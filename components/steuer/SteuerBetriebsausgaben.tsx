'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { genId } from '@/lib/ids'
import { createSupabaseClient } from '@/lib/supabase'
import { getSteuerBetriebsausgaben, upsertSteuerBetriebsausgabe, deleteSteuerBetriebsausgabe, uploadSteuerDokument } from '@/lib/db'
import {
  STEUER_COLOR, BETRIEBSAUSGABEN_KATEGORIEN,
  Betriebsausgabe, fmt, currentMonthStr, monthLabel, calcVorsteuerbetrag, calcNetto,
  Toast, Modal, StatusBadge, SectionHeader, EmptyState, LoadingSpinner,
  FormField, FormRow, NettoBruttoVorschau, MonthSelector,
} from './shared'

// ── Demo-Daten ─────────────────────────────────────────────────────────────────

function getMonthStr(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const DEMO_AUSGABEN: Betriebsausgabe[] = [
  { id: 'BA-001', titel: 'Druckerpapier A4', kategorie: 'Druckerpapier / Tinte', betrag_netto: 25.21, steuersatz: 19, betrag_brutto: 29.99, datum: `${getMonthStr()}-05`, anbieter: 'Staples' },
  { id: 'BA-002', titel: 'Bahnticket Berlin', kategorie: 'Bahntickets', betrag_netto: 49.58, steuersatz: 19, betrag_brutto: 59.00, datum: `${getMonthStr()}-08`, anbieter: 'Deutsche Bahn' },
  { id: 'BA-003', titel: 'Fachliteratur Steuerrecht', kategorie: 'Fachbücher', betrag_netto: 28.40, steuersatz: 7, betrag_brutto: 30.39, datum: `${getMonthStr()}-12`, anbieter: 'Amazon' },
  { id: 'BA-004', titel: 'Freelancer Grafikdesign', kategorie: 'Freelancer / Subunternehmer', betrag_netto: 420.00, steuersatz: 0, betrag_brutto: 420.00, datum: `${getMonthStr()}-15`, anbieter: 'Design Studio UG' },
  { id: 'BA-005', titel: 'Tanken Firmenfahrzeug', kategorie: 'Tanken', betrag_netto: 84.03, steuersatz: 19, betrag_brutto: 100.00, datum: `${getMonthStr(-1)}-22`, anbieter: 'Aral' },
  { id: 'BA-006', titel: 'Fortbildung AWS Cloud', kategorie: 'Fortbildungen', betrag_netto: 253.78, steuersatz: 19, betrag_brutto: 302.00, datum: `${getMonthStr(-1)}-10`, anbieter: 'Udemy' },
]

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export default function SteuerBetriebsausgabenTab({
  isDemo, showToast,
}: {
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [items, setItems] = useState<Betriebsausgabe[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Betriebsausgabe> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('Alle')
  const [selectedMonat, setSelectedMonat] = useState(currentMonthStr())
  const [viewMode, setViewMode] = useState<'tabelle' | 'karten'>('tabelle')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const fileRef = useRef<HTMLInputElement>(null)

  const toast_ = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3500)
    showToast(msg, type)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (isDemo) { setItems(DEMO_AUSGABEN); setLoading(false); return }
      try { setItems((await getSteuerBetriebsausgaben()) as Betriebsausgabe[]) }
      catch { toast_('Laden fehlgeschlagen', 'error') }
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const months = useMemo(() => {
    const ms = Array.from(new Set([currentMonthStr(), ...items.map(i => i.datum.slice(0, 7))])).sort().reverse()
    if (!ms.includes(selectedMonat)) setSelectedMonat(ms[0] ?? currentMonthStr())
    return ms
  }, [items, selectedMonat])

  const filtered = items.filter(i => {
    const matchMonat = i.datum.startsWith(selectedMonat)
    const matchSearch = !search || i.titel.toLowerCase().includes(search.toLowerCase()) || (i.anbieter ?? '').toLowerCase().includes(search.toLowerCase())
    const matchKat = filterKat === 'Alle' || i.kategorie === filterKat
    return matchMonat && matchSearch && matchKat
  })

  const monatsTotal = filtered.reduce((s, i) => s + i.betrag_brutto, 0)
  const monatsVst = filtered.reduce((s, i) => s + calcVorsteuerbetrag(i.betrag_brutto, i.steuersatz), 0)
  const monatsNetto = filtered.reduce((s, i) => s + i.betrag_netto, 0)

  const handleSave = async () => {
    if (!edit?.titel || !edit?.kategorie || !edit?.betrag_brutto || !edit?.datum) {
      toast_('Bitte Pflichtfelder ausfüllen', 'error'); return
    }
    setSaving(true)
    const toSave: Betriebsausgabe = {
      id: edit.id ?? genId('BA'),
      titel: edit.titel!,
      kategorie: edit.kategorie!,
      betrag_netto: Number(edit.betrag_netto ?? 0),
      steuersatz: Number(edit.steuersatz ?? 19),
      betrag_brutto: Number(edit.betrag_brutto ?? 0),
      datum: edit.datum!,
      anbieter: edit.anbieter,
      notiz: edit.notiz,
      datei_url: edit.datei_url,
    }
    if (isDemo) {
      setItems(prev => prev.some(f => f.id === toSave.id) ? prev.map(f => f.id === toSave.id ? toSave : f) : [toSave, ...prev])
      toast_('Ausgabe gespeichert')
      setEdit(null); setSaving(false); return
    }
    try {
      if (uploadFile) {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        toSave.datei_url = await uploadSteuerDokument(uploadFile, session?.user.id ?? 'anon', 'betriebsausgaben')
        setUploadFile(null)
      }
      await upsertSteuerBetriebsausgabe(toSave)
      setItems((await getSteuerBetriebsausgaben()) as Betriebsausgabe[])
      toast_('Ausgabe gespeichert')
      setEdit(null)
    } catch { toast_('Fehler beim Speichern', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (isDemo) { setItems(prev => prev.filter(f => f.id !== id)); setDeleteConfirm(null); toast_('Gelöscht'); return }
    try {
      await deleteSteuerBetriebsausgabe(id)
      setItems(prev => prev.filter(f => f.id !== id))
      setDeleteConfirm(null); toast_('Gelöscht')
    } catch { toast_('Fehler beim Löschen', 'error') }
  }

  if (loading) return <LoadingSpinner />

  const brutto = Number(edit?.betrag_brutto ?? 0)
  const satz = Number(edit?.steuersatz ?? 19)
  const netto = calcNetto(brutto, satz)
  const steuer = calcVorsteuerbetrag(brutto, satz)

  return (
    <div>
      {/* Monat + KPIs */}
      <div style={{ marginBottom: 16 }}>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Monat</label>
        <MonthSelector value={selectedMonat} onChange={setSelectedMonat} months={months} />
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Brutto gesamt" value={fmt(monatsTotal)} sub={`${filtered.length} Belege`} color={STEUER_COLOR} />
        <KpiCard label="Netto gesamt" value={fmt(monatsNetto)} sub="abzugsfähig" color="#f8fbff" />
        <KpiCard label="Vorsteuer (VSt)" value={fmt(monatsVst)} sub="erstattungsfähig" color="#4ddb7e" />
        <KpiCard label="Belege gesamt" value={String(items.length)} sub="alle Monate" />
      </div>

      {/* Toolbar */}
      <SectionHeader
        title={`Betriebsausgaben — ${monthLabel(selectedMonat)} (${filtered.length})`}
        sub="Variable Einzelausgaben für den Betrieb"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="pk-btn-ghost"
              onClick={() => setViewMode(v => v === 'tabelle' ? 'karten' : 'tabelle')}
              style={{ fontSize: 12 }}
            >
              {viewMode === 'tabelle' ? '⊞ Karten' : '☰ Tabelle'}
            </button>
            <button className="pk-btn" onClick={() => setEdit({ datum: new Date().toISOString().split('T')[0], steuersatz: 19 })} style={{ fontSize: 13 }}>
              + Ausgabe erfassen
            </button>
          </div>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="Alle">Alle Kategorien</option>
          {BETRIEBSAUSGABEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧾" title={`Keine Ausgaben im ${monthLabel(selectedMonat)}`} sub="Erfasse deine ersten variablen Betriebsausgaben" />
      ) : viewMode === 'tabelle' ? (
        <div className="pk-card" style={{ padding: 0 }}>
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Datum</th><th>Titel</th><th>Kategorie</th><th>Anbieter</th>
                  <th>Brutto</th><th>VSt</th><th>Satz</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontSize: 12 }}>{new Date(i.datum).toLocaleDateString('de-DE')}</td>
                    <td style={{ fontWeight: 600 }}>
                      {i.titel}
                      {i.datei_url && <a href={i.datei_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#1684ff' }}>📎</a>}
                    </td>
                    <td><span className="badge badge-gray">{i.kategorie}</span></td>
                    <td style={{ fontSize: 12, color: '#aeb9c8' }}>{i.anbieter ?? '—'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{fmt(i.betrag_brutto)}</td>
                    <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(calcVorsteuerbetrag(i.betrag_brutto, i.steuersatz))}</td>
                    <td><span className="badge badge-blue">{i.steuersatz}%</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEdit(i)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>✏️</button>
                        {deleteConfirm === i.id ? (
                          <>
                            <button onClick={() => handleDelete(i.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                            <button onClick={() => setDeleteConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Nein</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(i.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(245,158,11,.06)', fontWeight: 700 }}>
                  <td colSpan={4}>Summe {monthLabel(selectedMonat)}</td>
                  <td style={{ fontFamily: 'monospace', color: STEUER_COLOR }}>{fmt(monatsTotal)}</td>
                  <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(monatsVst)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(i => (
            <div key={i.id} className="pk-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{i.titel}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEdit(i)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}>✏️</button>
                  {deleteConfirm === i.id ? (
                    <>
                      <button onClick={() => handleDelete(i.id)} style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                      <button onClick={() => setDeleteConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}>✕</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(i.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}>🗑️</button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="badge badge-gray">{i.kategorie}</span>
                <span className="badge badge-blue">{i.steuersatz}%</span>
                {i.datei_url && <a href={i.datei_url} target="_blank" rel="noreferrer" className="badge badge-blue">📎 Beleg</a>}
              </div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>{new Date(i.datum).toLocaleDateString('de-DE')} · {i.anbieter ?? '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: STEUER_COLOR }}>{fmt(i.betrag_brutto)}</span>
                <span style={{ fontSize: 12, color: '#4ddb7e', fontWeight: 600 }}>VSt {fmt(calcVorsteuerbetrag(i.betrag_brutto, i.steuersatz))}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit-Modal */}
      {edit !== null && (
        <Modal title={edit.id ? 'Ausgabe bearbeiten' : 'Neue Betriebsausgabe'} onClose={() => setEdit(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Titel" required>
              <input className="pk-input" placeholder="z.B. Druckerpapier A4" value={edit.titel ?? ''} onChange={e => setEdit(p => ({ ...p, titel: e.target.value }))} />
            </FormField>
            <FormRow>
              <FormField label="Kategorie" required>
                <select className="pk-input" value={edit.kategorie ?? 'Sonstiges'} onChange={e => setEdit(p => ({ ...p, kategorie: e.target.value }))}>
                  {BETRIEBSAUSGABEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FormField>
              <FormField label="Datum" required>
                <input className="pk-input" type="date" value={edit.datum ?? new Date().toISOString().split('T')[0]} onChange={e => setEdit(p => ({ ...p, datum: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Bruttobetrag (€)" required>
                <input className="pk-input" type="number" step="0.01" min="0" placeholder="29.99" value={edit.betrag_brutto ?? ''} onChange={e => {
                  const b = parseFloat(e.target.value) || 0
                  const s = Number(edit.steuersatz ?? 19)
                  setEdit(p => ({ ...p, betrag_brutto: b, betrag_netto: calcNetto(b, s) }))
                }} />
              </FormField>
              <FormField label="Steuersatz">
                <select className="pk-input" value={edit.steuersatz ?? 19} onChange={e => {
                  const s = Number(e.target.value)
                  const b = Number(edit.betrag_brutto ?? 0)
                  setEdit(p => ({ ...p, steuersatz: s, betrag_netto: calcNetto(b, s) }))
                }}>
                  {[0, 7, 19].map(s => <option key={s} value={s}>{s}%</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Anbieter">
                <input className="pk-input" placeholder="z.B. Amazon" value={edit.anbieter ?? ''} onChange={e => setEdit(p => ({ ...p, anbieter: e.target.value }))} />
              </FormField>
              <FormField label="Beleg (PDF/Bild)">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="pk-input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                {edit.datei_url && !uploadFile && <a href={edit.datei_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1684ff', display: 'block', marginTop: 4 }}>Beleg ansehen →</a>}
              </FormField>
            </FormRow>
            <FormField label="Notiz">
              <input className="pk-input" placeholder="Kommentar" value={edit.notiz ?? ''} onChange={e => setEdit(p => ({ ...p, notiz: e.target.value }))} />
            </FormField>
            <NettoBruttoVorschau netto={netto} steuer={steuer} brutto={brutto} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="pk-btn-ghost" onClick={() => setEdit(null)} style={{ fontSize: 13 }}>Abbrechen</button>
              <button className="pk-btn" onClick={handleSave} disabled={saving} style={{ fontSize: 13 }}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast msg={toast} type={toastType} />
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pk-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f8fbff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
