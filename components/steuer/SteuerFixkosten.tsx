'use client'
import { useEffect, useRef, useState } from 'react'
import { genId } from '@/lib/ids'
import { createSupabaseClient } from '@/lib/supabase'
import {
  getSteuerFixkosten, upsertSteuerFixkosten, deleteSteuerFixkosten, uploadSteuerDokument,
} from '@/lib/db'
import {
  STEUER_COLOR, FIXKOSTEN_KATEGORIEN, ZAHLUNGSINTERVALLE,
  Fixkosten, fmt, calcMonatlichAnteil, calcVorsteuerbetrag, calcNetto,
  Toast, Modal, StatusBadge, SectionHeader, EmptyState, LoadingSpinner,
  FormField, FormRow, NettoBruttoVorschau,
} from './shared'

// ── Demo-Daten ─────────────────────────────────────────────────────────────────

const DEMO_FIXKOSTEN: Fixkosten[] = [
  { id: 'FK-001', titel: 'Internetvertrag Business', kategorie: 'Internet', betrag_netto: 33.61, steuersatz: 19, betrag_brutto: 39.99, zahlungsintervall: 'monatlich', anbieter: 'Telekom', aktiv: true },
  { id: 'FK-002', titel: 'Büromiete', kategorie: 'Büromiete', betrag_netto: 420.17, steuersatz: 19, betrag_brutto: 499.99, zahlungsintervall: 'monatlich', anbieter: 'Immobilien GmbH', aktiv: true },
  { id: 'FK-003', titel: 'Cloud-Speicher (Google Workspace)', kategorie: 'Cloud-Speicher', betrag_netto: 10.08, steuersatz: 19, betrag_brutto: 11.99, zahlungsintervall: 'monatlich', anbieter: 'Google', aktiv: true },
  { id: 'FK-004', titel: 'Buchhaltungssoftware', kategorie: 'Buchhaltungssoftware', betrag_netto: 21.00, steuersatz: 19, betrag_brutto: 24.99, zahlungsintervall: 'monatlich', anbieter: 'DATEV', aktiv: true },
  { id: 'FK-005', titel: 'Betriebshaftpflicht', kategorie: 'Versicherungen', betrag_netto: 850.00, steuersatz: 0, betrag_brutto: 850.00, zahlungsintervall: 'jährlich', anbieter: 'Allianz', aktiv: true },
  { id: 'FK-006', titel: 'IHK Mitgliedsbeitrag', kategorie: 'IHK / Mitgliedschaften', betrag_netto: 220.00, steuersatz: 0, betrag_brutto: 220.00, zahlungsintervall: 'jährlich', anbieter: 'IHK München', aktiv: true },
]

// ── Typen ──────────────────────────────────────────────────────────────────────

type EditFixkosten = Partial<Fixkosten>

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function monatlicheSumme(list: Fixkosten[]): number {
  return list.filter(f => f.aktiv).reduce((s, f) => s + calcMonatlichAnteil(f.betrag_brutto, f.zahlungsintervall), 0)
}

function monatlicheVorsteuer(list: Fixkosten[]): number {
  return list.filter(f => f.aktiv).reduce((s, f) => {
    const anteil = calcMonatlichAnteil(f.betrag_netto, f.zahlungsintervall)
    const steuer = calcVorsteuerbetrag(calcMonatlichAnteil(f.betrag_brutto, f.zahlungsintervall), f.steuersatz)
    return s + steuer - (anteil - calcMonatlichAnteil(f.betrag_netto, f.zahlungsintervall)) + steuer
  }, 0)
}

function monatlicheVorsteuerKorrekt(list: Fixkosten[]): number {
  return list.filter(f => f.aktiv).reduce((s, f) => {
    return s + calcVorsteuerbetrag(calcMonatlichAnteil(f.betrag_brutto, f.zahlungsintervall), f.steuersatz)
  }, 0)
}

function kategorieSum(list: Fixkosten[], kat: string): number {
  return list.filter(f => f.aktiv && f.kategorie === kat).reduce((s, f) => s + calcMonatlichAnteil(f.betrag_brutto, f.zahlungsintervall), 0)
}

const INTERVALL_LABEL: Record<string, string> = {
  monatlich: 'mtl.', quartalsweise: 'quartalsw.', halbjährlich: 'halbj.', jährlich: 'jährl.',
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export default function SteuerFixkostenTab({
  isDemo, showToast,
}: {
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [items, setItems] = useState<Fixkosten[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<EditFixkosten | null>(null)
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
      if (isDemo) { setItems(DEMO_FIXKOSTEN); setLoading(false); return }
      try { setItems((await getSteuerFixkosten()) as Fixkosten[]) }
      catch { toast_('Laden fehlgeschlagen', 'error') }
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const filtered = items.filter(f => {
    const matchSearch = !search || f.titel.toLowerCase().includes(search.toLowerCase()) || (f.anbieter ?? '').toLowerCase().includes(search.toLowerCase())
    const matchKat = filterKat === 'Alle' || f.kategorie === filterKat
    return matchSearch && matchKat
  })

  const handleSave = async () => {
    if (!edit?.titel || !edit?.kategorie || !edit?.betrag_brutto) {
      toast_('Bitte Pflichtfelder ausfüllen', 'error'); return
    }
    setSaving(true)
    const toSave: Fixkosten = {
      id: edit.id ?? genId('FK'),
      titel: edit.titel!,
      kategorie: edit.kategorie!,
      betrag_netto: Number(edit.betrag_netto ?? 0),
      steuersatz: Number(edit.steuersatz ?? 19),
      betrag_brutto: Number(edit.betrag_brutto ?? 0),
      zahlungsintervall: edit.zahlungsintervall ?? 'monatlich',
      naechste_zahlung: edit.naechste_zahlung,
      anbieter: edit.anbieter,
      notiz: edit.notiz,
      datei_url: edit.datei_url,
      aktiv: edit.aktiv ?? true,
    }
    if (isDemo) {
      setItems(prev => prev.some(f => f.id === toSave.id) ? prev.map(f => f.id === toSave.id ? toSave : f) : [toSave, ...prev])
      toast_('Fixkosten gespeichert')
      setEdit(null); setSaving(false); return
    }
    try {
      if (uploadFile) {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        toSave.datei_url = await uploadSteuerDokument(uploadFile, session?.user.id ?? 'anon', 'fixkosten')
        setUploadFile(null)
      }
      await upsertSteuerFixkosten(toSave)
      setItems((await getSteuerFixkosten()) as Fixkosten[])
      toast_('Fixkosten gespeichert')
      setEdit(null)
    } catch { toast_('Fehler beim Speichern', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (isDemo) { setItems(prev => prev.filter(f => f.id !== id)); setDeleteConfirm(null); toast_('Gelöscht'); return }
    try {
      await deleteSteuerFixkosten(id)
      setItems(prev => prev.filter(f => f.id !== id))
      setDeleteConfirm(null)
      toast_('Gelöscht')
    } catch { toast_('Fehler beim Löschen', 'error') }
  }

  const handleToggleAktiv = async (item: Fixkosten) => {
    const updated = { ...item, aktiv: !item.aktiv }
    if (isDemo) { setItems(prev => prev.map(f => f.id === item.id ? updated : f)); return }
    try { await upsertSteuerFixkosten(updated); setItems(prev => prev.map(f => f.id === item.id ? updated : f)) }
    catch { toast_('Fehler', 'error') }
  }

  const monatlichGes = monatlicheSumme(items)
  const monatlichVst = monatlicheVorsteuerKorrekt(items)
  const jahresGes = monatlichGes * 12
  const katTop = FIXKOSTEN_KATEGORIEN.filter(k => items.some(f => f.aktiv && f.kategorie === k)).slice(0, 5)

  if (loading) return <LoadingSpinner />

  const brutto = Number(edit?.betrag_brutto ?? 0)
  const satz = Number(edit?.steuersatz ?? 19)
  const netto = edit?.betrag_netto != null ? Number(edit.betrag_netto) : calcNetto(brutto, satz)
  const steuer = calcVorsteuerbetrag(brutto, satz)

  return (
    <div>
      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <KpiCard label="Monatliche Fixkosten" value={fmt(monatlichGes)} sub={`${items.filter(f => f.aktiv).length} aktive Positionen`} color={STEUER_COLOR} />
        <KpiCard label="Vorsteuer monatlich" value={fmt(monatlichVst)} sub="abzugsfähige VSt" color="#4ddb7e" />
        <KpiCard label="Jahresbelastung" value={fmt(jahresGes)} sub="alle aktiven Fixkosten" color="#ff8080" />
        <KpiCard label="Positionen gesamt" value={String(items.length)} sub={`${items.filter(f => !f.aktiv).length} inaktiv`} />
      </div>

      {/* Kategorien-Übersicht */}
      {katTop.length > 0 && (
        <div className="pk-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: STEUER_COLOR }}>Top-Kategorien (monatlich)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {katTop.map(k => {
              const sum = kategorieSum(items, k)
              const pct = monatlichGes > 0 ? (sum / monatlichGes) * 100 : 0
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 120, fontSize: 12, color: '#aeb9c8', flexShrink: 0 }}>{k}</div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: STEUER_COLOR, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{fmt(sum)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <SectionHeader
        title={`Fixkosten (${filtered.length})`}
        sub="Monatliche Dauerverpflichtungen und wiederkehrende Kosten"
        action={
          <button className="pk-btn" onClick={() => setEdit({})} style={{ fontSize: 13 }}>+ Fixkosten hinzufügen</button>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="Alle">Alle Kategorien</option>
          {FIXKOSTEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* Tabelle */}
      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="Keine Fixkosten gefunden" sub="Füge deine ersten monatlichen Fixkosten hinzu" />
      ) : (
        <div className="pk-card" style={{ padding: 0 }}>
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Titel</th><th>Kategorie</th><th>Anbieter</th>
                  <th>Brutto</th><th>VSt</th><th>Intervall</th>
                  <th>Mtl. Anteil</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const mtl = calcMonatlichAnteil(f.betrag_brutto, f.zahlungsintervall)
                  const vst = calcVorsteuerbetrag(mtl, f.steuersatz)
                  return (
                    <tr key={f.id} style={{ opacity: f.aktiv ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>
                        {f.titel}
                        {f.datei_url && (
                          <a href={f.datei_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#1684ff' }}>📎</a>
                        )}
                      </td>
                      <td><span className="badge badge-gray">{f.kategorie}</span></td>
                      <td style={{ fontSize: 12, color: '#aeb9c8' }}>{f.anbieter ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmt(f.betrag_brutto)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(vst)}</td>
                      <td><span className="badge badge-blue">{INTERVALL_LABEL[f.zahlungsintervall] ?? f.zahlungsintervall}</span></td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmt(mtl)}</td>
                      <td>
                        <button
                          onClick={() => handleToggleAktiv(f)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: f.aktiv ? '#4ddb7e' : '#aeb9c8', fontWeight: 600 }}
                        >
                          {f.aktiv ? '● Aktiv' : '○ Inaktiv'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEdit(f)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>✏️</button>
                          {deleteConfirm === f.id ? (
                            <>
                              <button onClick={() => handleDelete(f.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                              <button onClick={() => setDeleteConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Nein</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteConfirm(f.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>🗑️</button>
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

      {/* Edit-Modal */}
      {edit !== null && (
        <Modal title={edit.id ? 'Fixkosten bearbeiten' : 'Neue Fixkosten'} onClose={() => setEdit(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Titel" required>
              <input className="pk-input" placeholder="z.B. Internetvertrag Business" value={edit.titel ?? ''} onChange={e => setEdit(p => ({ ...p, titel: e.target.value }))} />
            </FormField>
            <FormRow>
              <FormField label="Kategorie" required>
                <select className="pk-input" value={edit.kategorie ?? 'Sonstiges'} onChange={e => setEdit(p => ({ ...p, kategorie: e.target.value }))}>
                  {FIXKOSTEN_KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FormField>
              <FormField label="Anbieter">
                <input className="pk-input" placeholder="z.B. Telekom" value={edit.anbieter ?? ''} onChange={e => setEdit(p => ({ ...p, anbieter: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Bruttobetrag (€)" required>
                <input className="pk-input" type="number" step="0.01" min="0" placeholder="39.99" value={edit.betrag_brutto ?? ''} onChange={e => {
                  const b = parseFloat(e.target.value) || 0
                  const s = Number(edit.steuersatz ?? 19)
                  setEdit(p => ({ ...p, betrag_brutto: b, betrag_netto: calcNetto(b, s), steuerbetrag: calcVorsteuerbetrag(b, s) }))
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
              <FormField label="Zahlungsintervall">
                <select className="pk-input" value={edit.zahlungsintervall ?? 'monatlich'} onChange={e => setEdit(p => ({ ...p, zahlungsintervall: e.target.value }))}>
                  {ZAHLUNGSINTERVALLE.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>
              </FormField>
              <FormField label="Nächste Zahlung">
                <input className="pk-input" type="date" value={edit.naechste_zahlung ?? ''} onChange={e => setEdit(p => ({ ...p, naechste_zahlung: e.target.value }))} />
              </FormField>
            </FormRow>
            <FormField label="Beleg (PDF/Bild)">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="pk-input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
              {edit.datei_url && !uploadFile && <a href={edit.datei_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1684ff', display: 'block', marginTop: 4 }}>Aktueller Beleg ansehen →</a>}
            </FormField>
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

// re-export for page.tsx
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pk-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f8fbff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
