'use client'
import { useEffect, useRef, useState } from 'react'
import { genId } from '@/lib/ids'
import { createSupabaseClient } from '@/lib/supabase'
import { getSteuerAnschaffungen, upsertSteuerAnschaffung, deleteSteuerAnschaffung, uploadSteuerDokument } from '@/lib/db'
import {
  STEUER_COLOR, ANSCHAFFUNGEN_KATEGORIEN,
  Anschaffung, fmt, calcVorsteuerbetrag, calcNetto, isGWG,
  Toast, Modal, SectionHeader, EmptyState, LoadingSpinner,
  FormField, FormRow, NettoBruttoVorschau,
} from './shared'

// ── Demo-Daten ─────────────────────────────────────────────────────────────────

const DEMO_ANSCHAFFUNGEN: Anschaffung[] = [
  { id: 'ANS-001', titel: 'MacBook Pro 14"', kategorie: 'Laptop', betrag_netto: 2100.00, steuersatz: 19, betrag_brutto: 2499.00, kaufdatum: '2026-02-10', lieferant: 'Apple Store', seriennummer: 'C02X1234', garantie_bis: '2029-02-10', gwg: false },
  { id: 'ANS-002', titel: 'Dell 27" Monitor', kategorie: 'Monitor', betrag_netto: 420.17, steuersatz: 19, betrag_brutto: 499.99, kaufdatum: '2026-03-15', lieferant: 'Alternate', gwg: false },
  { id: 'ANS-003', titel: 'Bürostuhl Ergonomic', kategorie: 'Bürostuhl', betrag_netto: 630.25, steuersatz: 19, betrag_brutto: 749.99, kaufdatum: '2026-01-20', lieferant: 'Ikea Business', gwg: false },
  { id: 'ANS-004', titel: 'Multifunktionsdrucker', kategorie: 'Drucker', betrag_netto: 210.08, steuersatz: 19, betrag_brutto: 249.99, kaufdatum: '2026-04-05', lieferant: 'MediaMarkt', gwg: true },
  { id: 'ANS-005', titel: 'iPhone 15 Pro (dienstlich)', kategorie: 'Smartphone', betrag_netto: 1091.60, steuersatz: 19, betrag_brutto: 1299.00, kaufdatum: '2026-04-12', lieferant: 'Apple Store', garantie_bis: '2027-04-12', gwg: false },
]

// ── Abschreibungs-Hilfsfunktionen ──────────────────────────────────────────────

const NUTZUNGSDAUER: Record<string, number> = {
  'Laptop': 3, 'Monitor': 3, 'Smartphone': 5, 'Kamera': 5,
  'Drucker': 3, 'Schreibtisch': 13, 'Bürostuhl': 13,
  'Werkzeuge': 5, 'Maschinen': 5, 'Firmenwagen': 6, 'Sonstiges': 5,
}

function jahresAfa(a: Anschaffung): number {
  const nd = NUTZUNGSDAUER[a.kategorie] ?? 5
  return a.betrag_netto / nd
}

function restbuchwert(a: Anschaffung): number {
  const nd = NUTZUNGSDAUER[a.kategorie] ?? 5
  const jahre = (Date.now() - new Date(a.kaufdatum).getTime()) / (1000 * 60 * 60 * 24 * 365)
  return Math.max(0, a.betrag_netto - (a.betrag_netto / nd) * jahre)
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export default function SteuerAnschaffungenTab({
  isDemo, showToast,
}: {
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [items, setItems] = useState<Anschaffung[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Anschaffung> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('Alle')
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
      if (isDemo) { setItems(DEMO_ANSCHAFFUNGEN); setLoading(false); return }
      try { setItems((await getSteuerAnschaffungen()) as Anschaffung[]) }
      catch { toast_('Laden fehlgeschlagen', 'error') }
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const filtered = items.filter(i => {
    const matchSearch = !search || i.titel.toLowerCase().includes(search.toLowerCase()) || (i.lieferant ?? '').toLowerCase().includes(search.toLowerCase())
    const matchKat = filterKat === 'Alle' || i.kategorie === filterKat
    return matchSearch && matchKat
  })

  const gesamtNetto = items.reduce((s, i) => s + i.betrag_netto, 0)
  const gesamtVst = items.reduce((s, i) => s + calcVorsteuerbetrag(i.betrag_brutto, i.steuersatz), 0)
  const gwgItems = items.filter(i => i.gwg || isGWG(i.betrag_netto))
  const jahresAfaGes = items.filter(i => !i.gwg && !isGWG(i.betrag_netto)).reduce((s, i) => s + jahresAfa(i), 0)

  const handleSave = async () => {
    if (!edit?.titel || !edit?.kategorie || !edit?.betrag_brutto || !edit?.kaufdatum) {
      toast_('Bitte Pflichtfelder ausfüllen', 'error'); return
    }
    setSaving(true)
    const gwg = isGWG(Number(edit.betrag_netto ?? 0))
    const toSave: Anschaffung = {
      id: edit.id ?? genId('ANS'),
      titel: edit.titel!,
      kategorie: edit.kategorie!,
      betrag_netto: Number(edit.betrag_netto ?? 0),
      steuersatz: Number(edit.steuersatz ?? 19),
      betrag_brutto: Number(edit.betrag_brutto ?? 0),
      kaufdatum: edit.kaufdatum!,
      lieferant: edit.lieferant,
      seriennummer: edit.seriennummer,
      garantie_bis: edit.garantie_bis,
      notiz: edit.notiz,
      datei_url: edit.datei_url,
      gwg,
    }
    if (isDemo) {
      setItems(prev => prev.some(f => f.id === toSave.id) ? prev.map(f => f.id === toSave.id ? toSave : f) : [toSave, ...prev])
      toast_('Anschaffung gespeichert')
      setEdit(null); setSaving(false); return
    }
    try {
      if (uploadFile) {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        toSave.datei_url = await uploadSteuerDokument(uploadFile, session?.user.id ?? 'anon', 'anschaffungen')
        setUploadFile(null)
      }
      await upsertSteuerAnschaffung(toSave)
      setItems((await getSteuerAnschaffungen()) as Anschaffung[])
      toast_('Anschaffung gespeichert')
      setEdit(null)
    } catch { toast_('Fehler beim Speichern', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (isDemo) { setItems(prev => prev.filter(f => f.id !== id)); setDeleteConfirm(null); toast_('Gelöscht'); return }
    try {
      await deleteSteuerAnschaffung(id)
      setItems(prev => prev.filter(f => f.id !== id))
      setDeleteConfirm(null); toast_('Gelöscht')
    } catch { toast_('Fehler beim Löschen', 'error') }
  }

  if (loading) return <LoadingSpinner />

  const brutto = Number(edit?.betrag_brutto ?? 0)
  const satz = Number(edit?.steuersatz ?? 19)
  const netto = calcNetto(brutto, satz)
  const steuer = calcVorsteuerbetrag(brutto, satz)
  const editIsGWG = isGWG(netto)

  return (
    <div>
      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Investitionen gesamt" value={fmt(gesamtNetto)} sub={`${items.length} Positionen netto`} color={STEUER_COLOR} />
        <KpiCard label="Vorsteuer gesamt" value={fmt(gesamtVst)} sub="einmalig abziehbar" color="#4ddb7e" />
        <KpiCard label="Jährl. Abschreibung" value={fmt(jahresAfaGes)} sub="für lineare AfA" color="#1684ff" />
        <KpiCard label="GWG (≤ 800 € netto)" value={String(gwgItems.length)} sub="sofort abzugsfähig" color="#a78bfa" />
      </div>

      {/* Hinweis GWG */}
      {gwgItems.length > 0 && (
        <div className="pk-card" style={{ padding: 14, marginBottom: 16, border: '1px solid rgba(167,139,250,.3)', background: 'rgba(167,139,250,.06)' }}>
          <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>💡 GWG erkannt</div>
          <div style={{ fontSize: 12, color: '#aeb9c8' }}>
            {gwgItems.length} Anschaffung(en) unter 800 € netto sind als geringwertige Wirtschaftsgüter (GWG) sofort im Kaufjahr als Betriebsausgabe abzugsfähig.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <SectionHeader
        title={`Anschaffungen (${filtered.length})`}
        sub="Wirtschaftsgüter, Investitionen und Betriebsmittel"
        action={
          <button className="pk-btn" onClick={() => setEdit({ kaufdatum: new Date().toISOString().split('T')[0], steuersatz: 19 })} style={{ fontSize: 13 }}>
            + Anschaffung erfassen
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="Alle">Alle Kategorien</option>
          {ANSCHAFFUNGEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🖥️" title="Keine Anschaffungen gefunden" sub="Erfasse deine Betriebsanschaffungen und Investitionen" />
      ) : (
        <div className="pk-card" style={{ padding: 0 }}>
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Titel</th><th>Kategorie</th><th>Kaufdatum</th><th>Netto</th>
                  <th>VSt</th><th>Jährl. AfA</th><th>Restbuchwert</th><th>Typ</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const gwgItem = i.gwg || isGWG(i.betrag_netto)
                  return (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>
                        {i.titel}
                        {i.datei_url && <a href={i.datei_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#1684ff' }}>📎</a>}
                        {i.seriennummer && <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2 }}>SN: {i.seriennummer}</div>}
                      </td>
                      <td><span className="badge badge-gray">{i.kategorie}</span></td>
                      <td style={{ fontSize: 12 }}>{new Date(i.kaufdatum).toLocaleDateString('de-DE')}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmt(i.betrag_netto)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(calcVorsteuerbetrag(i.betrag_brutto, i.steuersatz))}</td>
                      <td style={{ fontFamily: 'monospace', color: gwgItem ? '#aeb9c8' : '#1684ff' }}>
                        {gwgItem ? '—' : fmt(jahresAfa(i))}
                      </td>
                      <td style={{ fontFamily: 'monospace', color: gwgItem ? '#aeb9c8' : '#f8fbff' }}>
                        {gwgItem ? 'sofort' : fmt(restbuchwert(i))}
                      </td>
                      <td>
                        {gwgItem
                          ? <span className="badge badge-purple">GWG</span>
                          : <span className="badge badge-blue">AfA {NUTZUNGSDAUER[i.kategorie] ?? 5}J</span>
                        }
                        {i.garantie_bis && new Date(i.garantie_bis) > new Date() && (
                          <span className="badge badge-green" style={{ marginLeft: 4 }}>Garantie</span>
                        )}
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AfA-Hinweis */}
      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', fontSize: 12, color: '#ffb347' }}>
        ⚠️ Die AfA-Berechnung dient als Orientierungshilfe (lineare Abschreibung nach amtlicher Tabelle). Bitte mit dem Steuerberater abstimmen. GWG-Grenze 2024: 800 € netto.
      </div>

      {/* Edit-Modal */}
      {edit !== null && (
        <Modal title={edit.id ? 'Anschaffung bearbeiten' : 'Neue Anschaffung'} onClose={() => setEdit(null)} maxWidth={600}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Bezeichnung" required>
              <input className="pk-input" placeholder="z.B. MacBook Pro 14&quot;" value={edit.titel ?? ''} onChange={e => setEdit(p => ({ ...p, titel: e.target.value }))} />
            </FormField>
            <FormRow>
              <FormField label="Kategorie" required>
                <select className="pk-input" value={edit.kategorie ?? 'Sonstiges'} onChange={e => setEdit(p => ({ ...p, kategorie: e.target.value }))}>
                  {ANSCHAFFUNGEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FormField>
              <FormField label="Kaufdatum" required>
                <input className="pk-input" type="date" value={edit.kaufdatum ?? new Date().toISOString().split('T')[0]} onChange={e => setEdit(p => ({ ...p, kaufdatum: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Bruttobetrag (€)" required>
                <input className="pk-input" type="number" step="0.01" min="0" placeholder="2499.00" value={edit.betrag_brutto ?? ''} onChange={e => {
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
            {editIsGWG && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.3)', fontSize: 13, color: '#a78bfa' }}>
                ✓ GWG-Erkennung: Netto ≤ 800 € → sofort vollständig absetzbar im Kaufjahr
              </div>
            )}
            <FormRow>
              <FormField label="Lieferant">
                <input className="pk-input" placeholder="z.B. Apple Store" value={edit.lieferant ?? ''} onChange={e => setEdit(p => ({ ...p, lieferant: e.target.value }))} />
              </FormField>
              <FormField label="Seriennummer">
                <input className="pk-input" placeholder="optional" value={edit.seriennummer ?? ''} onChange={e => setEdit(p => ({ ...p, seriennummer: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Garantie bis">
                <input className="pk-input" type="date" value={edit.garantie_bis ?? ''} onChange={e => setEdit(p => ({ ...p, garantie_bis: e.target.value }))} />
              </FormField>
              <FormField label="Rechnung (PDF/Bild)">
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="pk-input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                {edit.datei_url && !uploadFile && <a href={edit.datei_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1684ff', display: 'block', marginTop: 4 }}>Rechnung ansehen →</a>}
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
