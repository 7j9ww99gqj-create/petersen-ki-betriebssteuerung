'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { hasDemoCookie } from '@/lib/auth'
import { compressImage } from '@/lib/image-compress'
import {
  ampelStatus,
  getQmZeichnungen,
  insertQmFoto,
  nextQmPruefberichtNummer,
  uploadQmFoto,
  upsertQmMesswert,
  upsertQmPruefbericht,
  type QmFotoTyp,
  type QmGesamtstatus,
  type QmMesswertStatus,
  type QmZeichnung,
} from '@/lib/db/qm'

const QM_COLOR = '#14b8a6'

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

type MwRow = {
  _id: string
  messstelle: string
  sollwert: string
  toleranz_plus: string
  toleranz_minus: string
  istwert: string
  einheit: string
  pruefmittel: string
  status: QmMesswertStatus
}

const FOTO_SLOTS: { key: string; label: string; typ: QmFotoTyp }[] = [
  { key: 'gesamt',     label: 'Gesamt',     typ: 'gesamt' },
  { key: 'detail1',    label: 'Detail 1',   typ: 'detail' },
  { key: 'detail2',    label: 'Detail 2',   typ: 'detail' },
  { key: 'oberflaeche',label: 'Oberfläche', typ: 'oberflaeche' },
  { key: 'referenz',   label: 'Referenz',   typ: 'referenz' },
]

type FotoSlot = { key: string; typ: QmFotoTyp; file: File | null; preview: string | null }

type SichtEntgratung = 'ja' | 'nein' | 'nicht_erforderlich'
type SichtBeschaedigung = 'ja' | 'nein'
type SichtErgebnis = 'ok' | 'mangelhaft' | 'ausschuss' | ''

const DEMO_ZEICHNUNGEN: QmZeichnung[] = [
  {
    id: 'demo-1', user_id: 'demo', name: 'Stempel-B Rev.A',
    zeichnungsnummer: 'ZN-2041', revision: 'A', datei_pfad: null,
    material: 'C45', oberflaeche_anforderung: 'Ra 0.8', beschichtung: null,
    sonderanforderungen: ['entgraten'], ki_konfidenz: 92,
    erkannte_masse: [
      { name: 'Länge', wert: 150, einheit: 'mm', toleranz_plus: 0.1, toleranz_minus: 0.1, kritisch: false, konfidenz: 95 },
      { name: 'Ø Bohrung', wert: 12, einheit: 'mm', toleranz_plus: 0.02, toleranz_minus: 0.02, kritisch: true, konfidenz: 88 },
      { name: 'Breite', wert: 40, einheit: 'mm', toleranz_plus: 0.2, toleranz_minus: 0.2, kritisch: false, konfidenz: 91 },
    ],
    erstellt_am: '2026-05-19T08:00:00Z',
  },
  {
    id: 'demo-2', user_id: 'demo', name: 'Flansch-A Rev.C',
    zeichnungsnummer: 'ZN-2039', revision: 'C', datei_pfad: null,
    material: 'V2A', oberflaeche_anforderung: null, beschichtung: 'verzinkt',
    sonderanforderungen: null, ki_konfidenz: 87, erkannte_masse: null,
    erstellt_am: '2026-05-18T10:30:00Z',
  },
]

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function ampelColor(s: QmMesswertStatus): { bg: string; color: string; label: string } {
  if (s === 'gruen')  return { bg: 'rgba(16,185,129,.15)',  color: '#10b981', label: '🟢 OK' }
  if (s === 'orange') return { bg: 'rgba(245,158,11,.15)',  color: '#f59e0b', label: '🟡 Grenz' }
  if (s === 'rot')    return { bg: 'rgba(239,68,68,.15)',   color: '#ef4444', label: '🔴 Fehler' }
  return { bg: 'rgba(174,185,200,.1)', color: '#aeb9c8', label: '— offen' }
}

function gesamtstatusCalc(rows: MwRow[], sicht: SichtErgebnis): QmGesamtstatus {
  if (sicht === 'ausschuss') return 'ausschuss'
  if (rows.some(r => r.status === 'rot')) return 'ausschuss'
  if (sicht === 'mangelhaft') return 'nachbesserung'
  if (rows.some(r => r.status === 'orange')) return 'nachbesserung'
  if (rows.some(r => r.status === 'offen') || rows.length === 0) return 'offen'
  if (sicht === '' || sicht === null) return 'offen'
  return 'bestanden'
}

function gesamtstatusBadge(s: QmGesamtstatus) {
  if (s === 'bestanden')    return { bg: 'rgba(16,185,129,.15)', color: '#10b981', label: '✅ Bestanden' }
  if (s === 'nachbesserung') return { bg: 'rgba(245,158,11,.15)', color: '#f59e0b', label: '⚠️ Nachbesserung' }
  if (s === 'ausschuss')    return { bg: 'rgba(239,68,68,.15)',  color: '#ef4444', label: '❌ Ausschuss' }
  return { bg: 'rgba(174,185,200,.1)', color: '#aeb9c8', label: '— offen' }
}

function makeMwRow(overrides: Partial<MwRow> = {}): MwRow {
  return {
    _id: crypto.randomUUID(),
    messstelle: '',
    sollwert: '',
    toleranz_plus: '',
    toleranz_minus: '',
    istwert: '',
    einheit: 'mm',
    pruefmittel: '',
    status: 'offen',
    ...overrides,
  }
}

function recomputeStatus(row: MwRow): MwRow {
  const soll = row.sollwert === '' ? null : Number(row.sollwert)
  const ist  = row.istwert  === '' ? null : Number(row.istwert)
  const tp   = row.toleranz_plus   === '' ? null : Number(row.toleranz_plus)
  const tm   = row.toleranz_minus  === '' ? null : Number(row.toleranz_minus)
  return { ...row, status: ampelStatus({ sollwert: soll, istwert: ist, toleranz_plus: tp, toleranz_minus: tm }) }
}

const STEPS = [
  { n: 1, label: 'Zeichnung' },
  { n: 2, label: 'Bauteil' },
  { n: 3, label: 'Messwerte' },
  { n: 4, label: 'Fotos' },
  { n: 5, label: 'Sichtprüfung' },
  { n: 6, label: 'Abschluss' },
]

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function PruefeWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = hasDemoCookie()

  // ── Wizard step
  const [step, setStep] = useState(1)

  // ── Step 1 state
  const [zeichnungen, setZeichnungen] = useState<QmZeichnung[]>([])
  const [loadingZ, setLoadingZ] = useState(true)
  const [selectedZ, setSelectedZ] = useState<string>('')
  const [zeichnung, setZeichnung] = useState<QmZeichnung | null>(null)

  // ── Step 2 state
  const [bauteilId, setBauteilId] = useState('')
  const [zeichnungsnr, setZeichnungsnr] = useState('')
  const [revision, setRevision] = useState('')
  const [charge, setCharge] = useState('')
  const [anzahl, setAnzahl] = useState('1')

  // ── Step 3 state
  const [messwerte, setMesswerte] = useState<MwRow[]>([])

  // ── Step 4 state
  const [fotos, setFotos] = useState<FotoSlot[]>(
    FOTO_SLOTS.map(s => ({ key: s.key, typ: s.typ, file: null, preview: null }))
  )
  const fotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Step 5 state
  const [sichtEntgratung, setSichtEntgratung] = useState<SichtEntgratung>('ja')
  const [sichtBeschaedigung, setSichtBeschaedigung] = useState<SichtBeschaedigung>('nein')
  const [sichtBeschaedigungText, setSichtBeschaedigungText] = useState('')
  const [sichtErgebnis, setSichtErgebnis] = useState<SichtErgebnis>('')

  // ── Step 6 state
  const [pruefer, setPruefer] = useState('')
  const [initialen, setInitialen] = useState('')
  const [bemerkungen, setBemerkungen] = useState('')
  const [gesperrt, setGesperrt] = useState(false)

  // ── Save state
  const [saving, setSaving] = useState(false)
  const [savedBerichtId, setSavedBerichtId] = useState<string | null>(null)
  const [savedNr, setSavedNr] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load zeichnungen
  const loadZeichnungen = useCallback(async () => {
    setLoadingZ(true)
    try {
      if (isDemo) {
        setZeichnungen(DEMO_ZEICHNUNGEN)
      } else {
        const rows = await getQmZeichnungen()
        setZeichnungen(rows)
      }
    } catch {
      setZeichnungen(isDemo ? DEMO_ZEICHNUNGEN : [])
    } finally {
      setLoadingZ(false)
    }
  }, [isDemo])

  useEffect(() => { void loadZeichnungen() }, [loadZeichnungen])

  // Pre-select zeichnung from URL query param
  useEffect(() => {
    const qid = searchParams?.get('zeichnung')
    if (qid) setSelectedZ(qid)
  }, [searchParams])

  // When zeichnung is selected, pre-fill step 2 + step 3
  useEffect(() => {
    if (!selectedZ) { setZeichnung(null); return }
    const z = zeichnungen.find(x => x.id === selectedZ) ?? null
    setZeichnung(z)
    if (z) {
      if (z.zeichnungsnummer) setZeichnungsnr(z.zeichnungsnummer)
      if (z.revision) setRevision(z.revision)
      // Pre-fill messwerte from erkannte_masse
      const masse = z.erkannte_masse ?? []
      setMesswerte(masse.map(m => recomputeStatus(makeMwRow({
        messstelle: m.name,
        sollwert: String(m.wert ?? ''),
        toleranz_plus: m.toleranz_plus !== null && m.toleranz_plus !== undefined ? String(m.toleranz_plus) : '',
        toleranz_minus: m.toleranz_minus !== null && m.toleranz_minus !== undefined ? String(m.toleranz_minus) : '',
        einheit: m.einheit ?? 'mm',
      }))))
    }
  }, [selectedZ, zeichnungen])

  // ── Messwert helpers
  function updateMw(id: string, patch: Partial<MwRow>) {
    setMesswerte(prev => prev.map(r => {
      if (r._id !== id) return r
      const updated = { ...r, ...patch }
      return recomputeStatus(updated)
    }))
  }

  function addMw() {
    setMesswerte(prev => [...prev, makeMwRow()])
  }

  function removeMw(id: string) {
    setMesswerte(prev => prev.filter(r => r._id !== id))
  }

  // ── Foto helpers
  async function handleFotoFile(key: string, file: File) {
    let toUse: File | Blob = file
    let preview = URL.createObjectURL(file)
    try {
      const r = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8, mimeType: 'image/jpeg' })
      toUse = new File([r.blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
      const prev2 = URL.createObjectURL(r.blob)
      URL.revokeObjectURL(preview)
      preview = prev2
    } catch { /* keep original */ }
    setFotos(prev => prev.map(s =>
      s.key === key ? { ...s, file: toUse as File, preview } : s
    ))
  }

  function removeFoto(key: string) {
    setFotos(prev => prev.map(s =>
      s.key === key ? { ...s, file: null, preview: null } : s
    ))
  }

  // ── Computed gesamtstatus
  const gesamtstatus = gesamtstatusCalc(messwerte, sichtErgebnis)

  // ── Validation per step
  function canProceed(): boolean {
    if (step === 1) return !!selectedZ
    if (step === 2) return anzahl !== '' && Number(anzahl) >= 1
    if (step === 5) return sichtErgebnis !== ''
    return true
  }

  // ── Save
  async function handleSave() {
    if (isDemo) { showToast('Demo-Modus: Speichern deaktiviert', false); return }
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const nr = await nextQmPruefberichtNummer()
      const bericht = await upsertQmPruefbericht({
        pruefbericht_nr: nr,
        zeichnung_id: selectedZ || null,
        bauteil_id: bauteilId.trim() || null,
        chargennummer: charge.trim() || null,
        anzahl_geprueft: anzahl !== '' ? Number(anzahl) : 1,
        pruef_datum: new Date().toISOString().slice(0, 10),
        pruefer_name: pruefer.trim() || null,
        gesamtstatus,
        bemerkungen: bemerkungen.trim() || null,
        unterschrift_initialen: initialen.trim() || null,
        gesperrt,
      })
      // Save messwerte
      for (let i = 0; i < messwerte.length; i++) {
        const mw = messwerte[i]
        await upsertQmMesswert({
          pruefbericht_id: bericht.id,
          messstelle: mw.messstelle,
          sollwert: mw.sollwert !== '' ? Number(mw.sollwert) : null,
          toleranz_plus: mw.toleranz_plus !== '' ? Number(mw.toleranz_plus) : null,
          toleranz_minus: mw.toleranz_minus !== '' ? Number(mw.toleranz_minus) : null,
          istwert: mw.istwert !== '' ? Number(mw.istwert) : null,
          einheit: mw.einheit || 'mm',
          status: mw.status,
          pruefmittel: mw.pruefmittel.trim() || null,
          reihenfolge: i,
        })
      }
      // Upload + save fotos
      for (const slot of fotos) {
        const slotMeta = FOTO_SLOTS.find(s => s.key === slot.key)
        if (!slot.file || !slotMeta) continue
        const path = await uploadQmFoto(slot.file, bericht.id, `${slot.key}_${slot.file.name}`)
        await insertQmFoto({
          pruefbericht_id: bericht.id,
          typ: slotMeta.typ,
          datei_pfad: path,
          beschreibung: slotMeta.label,
        })
      }
      setSavedBerichtId(bericht.id)
      setSavedNr(nr)
      showToast(`✅ Prüfbericht ${nr} gespeichert`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Speichern fehlgeschlagen'
      setError(msg)
      showToast(msg, false)
    } finally {
      setSaving(false)
    }
  }

  // ── Render
  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${QM_COLOR}18`, border: `1px solid ${QM_COLOR}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>📋</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-.03em' }}>Prüfbericht erstellen</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>QM-Pilot · 6-Schritte-Assistent</p>
        </div>
        {isDemo && (
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.25)', color: '#ffb347', fontWeight: 700 }}>
            ● DEMO
          </span>
        )}
        <Link href="/dashboard/qm" className="pk-btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
          ← QM-Pilot
        </Link>
      </div>

      {/* ── Progress Bar */}
      <div className="pk-card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                  background: step === s.n ? QM_COLOR : step > s.n ? `${QM_COLOR}40` : 'rgba(255,255,255,.08)',
                  color: step >= s.n ? (step === s.n ? '#fff' : QM_COLOR) : '#aeb9c8',
                  border: step === s.n ? 'none' : `1.5px solid ${step > s.n ? QM_COLOR + '60' : 'rgba(255,255,255,.12)'}`,
                  transition: 'all .2s',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 10, color: step === s.n ? QM_COLOR : '#aeb9c8', fontWeight: step === s.n ? 700 : 500, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? `${QM_COLOR}50` : 'rgba(255,255,255,.08)', margin: '0 4px', marginBottom: 18, transition: 'background .2s' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,.4)', color: '#ff8080' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Steps ── */}

      {/* Step 1: Zeichnung auswählen */}
      {step === 1 && (
        <div className="pk-card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>📐 Schritt 1 — Zeichnung auswählen</div>

          {loadingZ ? (
            <div style={{ padding: 20, color: '#aeb9c8' }}>Lade Zeichnungen…</div>
          ) : zeichnungen.length === 0 ? (
            <div style={{ padding: 20, color: '#aeb9c8' }}>
              Noch keine Zeichnungen vorhanden.{' '}
              <Link href="/dashboard/qm/zeichnungen" style={{ color: QM_COLOR }}>Jetzt hochladen →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {zeichnungen.map(z => (
                <div
                  key={z.id}
                  onClick={() => setSelectedZ(z.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${selectedZ === z.id ? QM_COLOR : 'rgba(255,255,255,.08)'}`,
                    background: selectedZ === z.id ? `${QM_COLOR}10` : 'rgba(255,255,255,.03)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 22, flexShrink: 0 }}>📐</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{z.name}</div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>
                      {[z.zeichnungsnummer, z.revision && `Rev. ${z.revision}`, z.material].filter(Boolean).join(' · ')}
                    </div>
                    {z.ki_konfidenz !== null && z.ki_konfidenz !== undefined && (
                      <div style={{ fontSize: 11, marginTop: 2, color: z.ki_konfidenz >= 85 ? '#10b981' : z.ki_konfidenz >= 70 ? '#f59e0b' : '#ef4444' }}>
                        KI {z.ki_konfidenz}% · {(z.erkannte_masse ?? []).length} Maße erkannt
                      </div>
                    )}
                  </div>
                  {selectedZ === z.id && (
                    <div style={{ color: QM_COLOR, fontSize: 20, fontWeight: 900 }}>✓</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <Link href="/dashboard/qm/zeichnungen" style={{ color: QM_COLOR, fontSize: 13, textDecoration: 'none' }}>
              + Neue Zeichnung hochladen
            </Link>
          </div>
        </div>
      )}

      {/* Step 2: Bauteil-Infos */}
      {step === 2 && (
        <div className="pk-card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>🏷️ Schritt 2 — Bauteil-Informationen</div>
          {zeichnung && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: `${QM_COLOR}10`, border: `1px solid ${QM_COLOR}25`, fontSize: 13 }}>
              📐 {zeichnung.name} · {zeichnung.material}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Bauteil-ID">
              <input className="pk-input" value={bauteilId} onChange={e => setBauteilId(e.target.value)} placeholder="z.B. BT-2026-001" />
            </Field>
            <Field label="Zeichnungs-Nr.">
              <input className="pk-input" value={zeichnungsnr} onChange={e => setZeichnungsnr(e.target.value)} />
            </Field>
            <Field label="Revision">
              <input className="pk-input" value={revision} onChange={e => setRevision(e.target.value)} placeholder="z.B. A" />
            </Field>
            <Field label="Chargennummer (optional)">
              <input className="pk-input" value={charge} onChange={e => setCharge(e.target.value)} placeholder="z.B. CH-2026-04" />
            </Field>
            <Field label="Anzahl geprüfte Stücke *">
              <input type="number" min="1" className="pk-input" value={anzahl} onChange={e => setAnzahl(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {/* Step 3: Messwerte + Ampel */}
      {step === 3 && (
        <div className="pk-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>📏 Schritt 3 — Messwerte</span>
            <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 999, background: `${QM_COLOR}20`, color: QM_COLOR, fontSize: 11, fontWeight: 700 }}>
              {messwerte.length} Messstellen
            </span>
          </div>
          {messwerte.length === 0 ? (
            <div style={{ padding: '20px 0', color: '#aeb9c8', textAlign: 'center' }}>
              Keine Messstellen aus Zeichnung erkannt — füge manuell hinzu.
            </div>
          ) : (
            <div className="pk-table-wrap">
              <table className="pk-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Messstelle</th>
                    <th style={{ width: 80 }}>Soll</th>
                    <th style={{ width: 70 }}>Tol +</th>
                    <th style={{ width: 70 }}>Tol −</th>
                    <th style={{ width: 80 }}>Istwert</th>
                    <th style={{ width: 60 }}>Einheit</th>
                    <th style={{ width: 100 }}>Prüfmittel</th>
                    <th style={{ width: 90 }}>Ampel</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {messwerte.map(mw => {
                    const amp = ampelColor(mw.status)
                    return (
                      <tr key={mw._id} style={{ background: mw.istwert !== '' ? `${amp.bg}` : undefined, transition: 'background .2s' }}>
                        <td>
                          <input className="pk-input" value={mw.messstelle} onChange={e => updateMw(mw._id, { messstelle: e.target.value })} style={{ minWidth: 120 }} />
                        </td>
                        <td>
                          <input type="number" step="any" className="pk-input" value={mw.sollwert} onChange={e => updateMw(mw._id, { sollwert: e.target.value })} style={{ width: 75 }} />
                        </td>
                        <td>
                          <input type="number" step="any" className="pk-input" value={mw.toleranz_plus} onChange={e => updateMw(mw._id, { toleranz_plus: e.target.value })} style={{ width: 65 }} />
                        </td>
                        <td>
                          <input type="number" step="any" className="pk-input" value={mw.toleranz_minus} onChange={e => updateMw(mw._id, { toleranz_minus: e.target.value })} style={{ width: 65 }} />
                        </td>
                        <td>
                          <input type="number" step="any" className="pk-input" value={mw.istwert} onChange={e => updateMw(mw._id, { istwert: e.target.value })}
                            style={{ width: 75, border: mw.istwert !== '' ? `1.5px solid ${amp.color}60` : undefined }} />
                        </td>
                        <td>
                          <input className="pk-input" value={mw.einheit} onChange={e => updateMw(mw._id, { einheit: e.target.value })} style={{ width: 55 }} />
                        </td>
                        <td>
                          <input className="pk-input" value={mw.pruefmittel} onChange={e => updateMw(mw._id, { pruefmittel: e.target.value })} placeholder="Messschieber" style={{ width: 95 }} />
                        </td>
                        <td>
                          <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: amp.bg, color: amp.color, whiteSpace: 'nowrap' }}>
                            {amp.label}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => removeMw(mw._id)} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button className="pk-btn-ghost" onClick={addMw} style={{ marginTop: 12, fontSize: 12, padding: '6px 12px' }}>
            + Messstelle hinzufügen
          </button>

          {/* Live Gesamtstatus preview */}
          {messwerte.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aeb9c8' }}>Vorläufiger Gesamtstatus:</span>
              {(() => { const b = gesamtstatusBadge(gesamtstatusCalc(messwerte, sichtErgebnis)); return (
                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: b.bg, color: b.color }}>{b.label}</span>
              )})()}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Foto-Upload */}
      {step === 4 && (
        <div className="pk-card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>📷 Schritt 4 — Fotos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {FOTO_SLOTS.map(slot => {
              const fSlot = fotos.find(f => f.key === slot.key)!
              return (
                <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#aeb9c8' }}>{slot.label}</span>
                  {fSlot.preview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={fSlot.preview} alt={slot.label} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 10, border: `1.5px solid ${QM_COLOR}40` }} />
                      <button
                        onClick={() => removeFoto(slot.key)}
                        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 999, color: '#fff', cursor: 'pointer', width: 24, height: 24, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✕</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fotoInputRefs.current[slot.key]?.click()}
                      style={{
                        width: '100%', aspectRatio: '4/3', borderRadius: 10,
                        border: `2px dashed ${QM_COLOR}40`, background: `${QM_COLOR}08`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', gap: 6, transition: 'all .15s',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>📷</span>
                      <span style={{ fontSize: 11, color: '#aeb9c8' }}>Tippen / ablegen</span>
                    </div>
                  )}
                  <input
                    ref={el => { fotoInputRefs.current[slot.key] = el }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) void handleFotoFile(slot.key, f)
                      e.target.value = ''
                    }}
                  />
                </div>
              )
            })}
          </div>
          <p style={{ marginTop: 14, fontSize: 12, color: '#aeb9c8' }}>
            Fotos werden auf max. 1200 px komprimiert. Auf dem Handy öffnet sich direkt die Kamera.
          </p>
        </div>
      )}

      {/* Step 5: Sichtprüfung */}
      {step === 5 && (
        <div className="pk-card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>👁️ Schritt 5 — Sichtprüfung</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Entgratung *">
              <select className="pk-input" value={sichtEntgratung} onChange={e => setSichtEntgratung(e.target.value as SichtEntgratung)}>
                <option value="ja">Ja — ordnungsgemäß entgratet</option>
                <option value="nein">Nein — Grate vorhanden</option>
                <option value="nicht_erforderlich">Nicht erforderlich</option>
              </select>
            </Field>
            <Field label="Beschädigungen sichtbar? *">
              <div style={{ display: 'flex', gap: 10 }}>
                {(['nein', 'ja'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setSichtBeschaedigung(v)}
                    style={{
                      padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${sichtBeschaedigung === v ? (v === 'nein' ? '#10b981' : '#ef4444') : 'rgba(255,255,255,.12)'}`,
                      background: sichtBeschaedigung === v ? (v === 'nein' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)') : 'transparent',
                      color: sichtBeschaedigung === v ? (v === 'nein' ? '#10b981' : '#ef4444') : '#aeb9c8',
                    }}
                  >
                    {v === 'nein' ? 'Nein' : 'Ja'}
                  </button>
                ))}
              </div>
            </Field>
            {sichtBeschaedigung === 'ja' && (
              <Field label="Beschreibung der Beschädigung">
                <textarea className="pk-input" value={sichtBeschaedigungText} onChange={e => setSichtBeschaedigungText(e.target.value)} rows={3} placeholder="Art und Position der Beschädigung beschreiben…" />
              </Field>
            )}
            <Field label="Sichtprüfungs-Ergebnis *">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([
                  { v: 'ok', label: '✅ OK', bg: 'rgba(16,185,129,.15)', color: '#10b981', border: '#10b981' },
                  { v: 'mangelhaft', label: '⚠️ Mangelhaft', bg: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '#f59e0b' },
                  { v: 'ausschuss', label: '❌ Ausschuss', bg: 'rgba(239,68,68,.15)', color: '#ef4444', border: '#ef4444' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setSichtErgebnis(opt.v as SichtErgebnis)}
                    style={{
                      padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      border: `1.5px solid ${sichtErgebnis === opt.v ? opt.border : 'rgba(255,255,255,.12)'}`,
                      background: sichtErgebnis === opt.v ? opt.bg : 'transparent',
                      color: sichtErgebnis === opt.v ? opt.color : '#aeb9c8',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            {/* Phase 2 KI-Button */}
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(174,185,200,.05)', border: '1px solid rgba(174,185,200,.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="pk-btn-ghost" disabled style={{ fontSize: 13, opacity: 0.5, cursor: 'not-allowed' }}>
                🔍 KI-Sichtprüfung starten
              </button>
              <span style={{ fontSize: 12, color: '#aeb9c8' }}>Kommt in Phase 2 — Foto-Analyse mit OpenAI Vision</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Abschluss */}
      {step === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Zusammenfassung Messwerte */}
          <div className="pk-card">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>📊 Zusammenfassung Messwerte</div>
            {messwerte.length === 0 ? (
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Messwerte erfasst.</div>
            ) : (
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr><th>Messstelle</th><th>Soll</th><th>Istwert</th><th>Toleranz</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {messwerte.map(mw => {
                      const amp = ampelColor(mw.status)
                      return (
                        <tr key={mw._id}>
                          <td style={{ fontWeight: 600 }}>{mw.messstelle || '—'}</td>
                          <td>{mw.sollwert || '—'} {mw.einheit}</td>
                          <td style={{ fontWeight: 700, color: amp.color }}>{mw.istwert || '—'} {mw.istwert ? mw.einheit : ''}</td>
                          <td style={{ fontSize: 12, color: '#aeb9c8' }}>+{mw.toleranz_plus || '?'} / -{mw.toleranz_minus || '?'}</td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: amp.bg, color: amp.color }}>{amp.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Gesamtstatus */}
          <div className="pk-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Gesamtstatus:</span>
            {(() => { const b = gesamtstatusBadge(gesamtstatus); return (
              <span style={{ padding: '6px 18px', borderRadius: 999, fontSize: 14, fontWeight: 800, background: b.bg, color: b.color }}>{b.label}</span>
            )})()}
          </div>

          {/* Abzeichnung */}
          <div className="pk-card">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>✍️ Abzeichnung</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Prüfer-Name *">
                <input className="pk-input" value={pruefer} onChange={e => setPruefer(e.target.value)} placeholder="Vollständiger Name" />
              </Field>
              <Field label="Initialen (max. 4 Zeichen) *">
                <input className="pk-input" value={initialen} onChange={e => setInitialen(e.target.value.slice(0, 4).toUpperCase())} placeholder="KP" maxLength={4} style={{ textTransform: 'uppercase' }} />
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Bemerkungen">
                <textarea className="pk-input" value={bemerkungen} onChange={e => setBemerkungen(e.target.value)} rows={3} placeholder="Optionale Bemerkungen zum Prüfbericht…" />
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={gesperrt} onChange={e => setGesperrt(e.target.checked)} />
              <span style={{ fontSize: 13, color: '#aeb9c8' }}>Bericht nach Speicherung sperren (nicht mehr änderbar)</span>
            </label>
          </div>

          {/* Save Button */}
          {!savedBerichtId ? (
            <button
              className="pk-btn"
              disabled={saving || !pruefer.trim() || !initialen.trim()}
              onClick={() => void handleSave()}
              style={{ background: QM_COLOR, border: 'none', fontSize: 15, padding: '14px 28px' }}
            >
              {saving ? '⏳ Speichere…' : '💾 Speichern & PDF erzeugen'}
            </button>
          ) : (
            <div className="pk-card" style={{ border: `1px solid ${QM_COLOR}40`, textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: QM_COLOR, marginBottom: 6 }}>
                Prüfbericht {savedNr} gespeichert!
              </div>
              <div style={{ color: '#aeb9c8', fontSize: 13, marginBottom: 18 }}>
                Der Bericht wurde in der Datenbank gesichert.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href={`/api/qm/pdf/${savedBerichtId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pk-btn"
                  style={{ background: QM_COLOR, border: 'none', fontSize: 13, textDecoration: 'none' }}
                >
                  📥 PDF herunterladen
                </a>
                <button
                  className="pk-btn-ghost"
                  onClick={() => router.push('/dashboard/qm')}
                  style={{ fontSize: 13 }}
                >
                  ← Zurück zum QM-Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Nav Buttons */}
      {!savedBerichtId && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button
            className="pk-btn-ghost"
            disabled={step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1) as typeof step)}
            style={{ fontSize: 13 }}
          >
            ← Zurück
          </button>
          {step < 6 && (
            <button
              className="pk-btn"
              disabled={!canProceed()}
              onClick={() => setStep(s => Math.min(6, s + 1) as typeof step)}
              style={{ background: QM_COLOR, border: 'none', fontSize: 13 }}
            >
              Weiter →
            </button>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
          padding: '14px 20px', borderRadius: 12, maxWidth: 380,
          background: toast.ok ? 'rgba(37,211,102,.12)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.35)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
          fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#aeb9c8', fontWeight: 700, letterSpacing: '.03em' }}>{label}</span>
      {children}
    </label>
  )
}
