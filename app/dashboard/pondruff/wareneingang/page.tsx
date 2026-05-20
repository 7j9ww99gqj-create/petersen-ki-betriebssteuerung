'use client'
import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { compressImageDataUrl, WE_COATINGS } from '@/lib/pondruff'
import { usePondruffFlags } from '@/components/pondruff/usePondruffFlags'
import { useGlobalToast } from '@/components/ui/ToastProvider'
import { generateArbeitskartePDF, type ArbeitskarteData } from '@/lib/pondruff-pdf'
import type { SupabaseClient } from '@supabase/supabase-js'

const BEDINGUNGEN = ['Versand', 'Kunde holt selber ab', 'Wir liefern aus']
const EINLAGERER = ['Kevin', 'Julian', 'Frank', 'Tobi', 'Tim', 'Christian']

type WEPos = {
  position_nr: number
  menge: string
  artikelbezeichnung: string
  form: 'Rund' | 'Eckig'
  laenge: string
  breite: string
  hoehe: string
  durchmesser: string
  durchmesser_laenge: string
  raw_dimension_text: string
  weitere_infos: { key: string; value: string }[]
  polieren: 'Ja' | 'Nein'
  polieren_wo: string
  entschichtung: 'Ja' | 'Nein'
  microstrahlen: 'Ja' | 'Nein'
  laeppstrahlen: 'Ja' | 'Nein'
  polierstrahlen: 'Ja' | 'Nein'
  beschichtung: string
}

type WEEntry = {
  id: string
  created_at: string
  customer: string | null
  purchase_order: string | null
  delivery_id: string | null
  lieferbedingungen: string | null
  eingelagert_von: string | null
  eingelagert_am: string | null
  positionen: WEPos[] | null
}

function emptyPos(nr: number): WEPos {
  return {
    position_nr: nr, menge: '', artikelbezeichnung: '',
    form: 'Eckig', laenge: '', breite: '', hoehe: '',
    durchmesser: '', durchmesser_laenge: '',
    raw_dimension_text: '', weitere_infos: [],
    polieren: 'Nein', polieren_wo: '',
    entschichtung: 'Nein', microstrahlen: 'Nein',
    laeppstrahlen: 'Nein', polierstrahlen: 'Nein',
    beschichtung: 'Keine',
  }
}

function ocrToPos(p: Record<string, unknown>, idx: number): WEPos {
  return {
    position_nr: Number(p.position_nr ?? idx + 1),
    menge: String(p.menge ?? ''),
    artikelbezeichnung: String(p.artikelbezeichnung ?? ''),
    form: String(p.form ?? '') === 'Rund' ? 'Rund' : 'Eckig',
    laenge: String(p.laenge ?? ''),
    breite: String(p.breite ?? ''),
    hoehe: String(p.hoehe ?? ''),
    durchmesser: String(p.durchmesser ?? ''),
    durchmesser_laenge: String(p.durchmesser_laenge ?? ''),
    raw_dimension_text: String(p.raw_dimension_text ?? ''),
    weitere_infos: Array.isArray(p.weitere_infos)
      ? (p.weitere_infos as { key: string; value: string }[])
      : [],
    polieren: p.polieren === 'Ja' ? 'Ja' : 'Nein',
    polieren_wo: String(p.polieren_wo ?? ''),
    entschichtung: p.entschichtung === 'Ja' ? 'Ja' : 'Nein',
    microstrahlen: p.microstrahlen === 'Ja' ? 'Ja' : 'Nein',
    laeppstrahlen: p.laeppstrahlen === 'Ja' ? 'Ja' : 'Nein',
    polierstrahlen: p.polierstrahlen === 'Ja' ? 'Ja' : 'Nein',
    beschichtung: String(p.beschichtung ?? 'Keine'),
  }
}

const lbl: React.CSSProperties = { fontSize: 11, color: '#aeb9c8', marginBottom: 4 }
const sep: React.CSSProperties = { borderTop: '1px solid rgba(255,255,255,.06)', margin: '14px 0' }
const posCard: React.CSSProperties = {
  background: 'rgba(22,132,255,.04)', border: '1px solid rgba(22,132,255,.15)',
  borderRadius: 10, padding: '12px 14px', marginBottom: 10,
}

export default function WareneingangPage() {
  const toast = useGlobalToast()
  const { flags: pondFlags } = usePondruffFlags()
  const ocrEnabled = pondFlags.ocr_wareneingang

  const [mode, setMode] = useState<'ki' | 'manual' | null>(null)
  const [ocrDone, setOcrDone] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [partsFile, setPartsFile] = useState<File | null>(null)
  const [packagingFile, setPackagingFile] = useState<File | null>(null)

  const [kunde, setKunde] = useState('')
  const [bestellnummer, setBestellnummer] = useState('')
  const [positionen, setPositionen] = useState<WEPos[]>([])
  const [lieferbedingungen, setLieferbedingungen] = useState('')
  const [eingelagert_am, setEingelagert_am] = useState(new Date().toISOString().slice(0, 10))
  const [eingelagert_von, setEingelagert_von] = useState('')

  const [savedWe, setSavedWe] = useState<ArbeitskarteData | null>(null)
  const [entries, setEntries] = useState<WEEntry[]>([])
  const [weDelConfirm, setWeDelConfirm] = useState<string | null>(null)

  const canSave = !!lieferbedingungen && !!eingelagert_von

  async function deleteEntry(id: string) {
    const sb = createSupabaseClient()
    await sb.from('pondruff_wareneingaenge').delete().eq('id', id)
    setWeDelConfirm(null)
    loadEntries()
    toast.success('Wareneingang gelöscht')
  }

  async function loadEntries() {
    const sb = createSupabaseClient()
    const { data } = await sb
      .from('pondruff_wareneingaenge')
      .select('id, created_at, customer, purchase_order, delivery_id, lieferbedingungen, eingelagert_von, eingelagert_am, positionen')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setEntries(data as WEEntry[])
  }
  useEffect(() => { loadEntries() }, [])

  function resetForm() {
    setMode(null); setOcrDone(false)
    setReceiptFiles([]); setPartsFile(null); setPackagingFile(null)
    setKunde(''); setBestellnummer(''); setPositionen([])
    setLieferbedingungen(''); setEingelagert_am(new Date().toISOString().slice(0, 10))
    setEingelagert_von('')
  }

  function updatePos(idx: number, patch: Partial<WEPos>) {
    setPositionen(ps => ps.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }
  function addPos() {
    setPositionen(ps => [...ps, emptyPos(ps.length + 1)])
  }
  function removePos(idx: number) {
    setPositionen(ps => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, position_nr: i + 1 })))
  }
  function updateWeitereInfo(posIdx: number, infoIdx: number, key: string, value: string) {
    setPositionen(ps => ps.map((p, i) => {
      if (i !== posIdx) return p
      const wi = [...p.weitere_infos]; wi[infoIdx] = { key, value }
      return { ...p, weitere_infos: wi }
    }))
  }
  function addWeitereInfo(posIdx: number) {
    setPositionen(ps => ps.map((p, i) =>
      i !== posIdx ? p : { ...p, weitere_infos: [...p.weitere_infos, { key: '', value: '' }] }
    ))
  }
  function removeWeitereInfo(posIdx: number, infoIdx: number) {
    setPositionen(ps => ps.map((p, i) =>
      i !== posIdx ? p : { ...p, weitere_infos: p.weitere_infos.filter((_, j) => j !== infoIdx) }
    ))
  }

  async function runOcr() {
    if (!receiptFiles.length) { toast.error('Bitte mindestens ein Lieferschein-Bild auswählen'); return }
    setOcrBusy(true)
    try {
      const images = await Promise.all(receiptFiles.map(f => compressImageDataUrl(f)))
      const body = images.length === 1 ? { image: images[0] } : { images }
      const resp = await fetch('/api/pondruff/ocr-wareneingang', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'OCR fehlgeschlagen')
      setKunde(String(data.kunde || ''))
      setBestellnummer(String(data.bestellnummer || ''))
      const pos = Array.isArray(data.positionen)
        ? (data.positionen as Record<string, unknown>[]).map(ocrToPos)
        : [emptyPos(1)]
      setPositionen(pos)
      setOcrDone(true)
      toast.success(`Erkannt: ${data.kunde || '—'} · ${pos.length} Position(en)`)
    } catch (e) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'OCR-Fehler')
    } finally { setOcrBusy(false) }
  }

  async function uploadFile(supabase: SupabaseClient, userId: string, folder: string, f: File): Promise<string | null> {
    const ext = f.name.split('.').pop() || 'jpg'
    const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('pondruff').upload(path, f, { upsert: false })
    if (error) throw error
    return path
  }

  async function save() {
    setSaveBusy(true)
    const snapPositionen = [...positionen]
    const snapKunde = kunde
    const snapBestellnummer = bestellnummer
    const snapLieferbedingungen = lieferbedingungen
    const snapEingelagert_am = eingelagert_am
    const snapEingelagert_von = eingelagert_von
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')

      const [receiptPaths, parts_url, packaging_url] = await Promise.all([
        Promise.all(receiptFiles.map(f => uploadFile(supabase, user.id, 'receipt', f))),
        partsFile ? uploadFile(supabase, user.id, 'parts', partsFile) : Promise.resolve(null),
        packagingFile ? uploadFile(supabase, user.id, 'packaging', packagingFile) : Promise.resolve(null),
      ])
      const receipt_url = receiptPaths.filter(Boolean).join('|') || null

      const { data: ins, error } = await supabase.from('pondruff_wareneingaenge').insert({
        user_id: user.id,
        customer: snapKunde || null,
        purchase_order: snapBestellnummer || null,
        delivery_id: snapBestellnummer || null,
        positionen: snapPositionen,
        lieferbedingungen: snapLieferbedingungen || null,
        eingelagert_am: snapEingelagert_am || null,
        eingelagert_von: snapEingelagert_von || null,
        receipt_url, parts_url, packaging_url,
        status: 'offen',
        ai_data: { ocr_mode: mode === 'ki' ? 'ki-wareneingang' : 'manual' },
      }).select().single()
      if (error) throw error

      if (parts_url && ins) {
        const { data: bt } = await supabase.from('pondruff_bauteile').insert({
          user_id: user.id,
          customer: snapKunde || null,
          delivery_id: snapBestellnummer || null,
          article_no: snapPositionen[0]?.artikelbezeichnung || '',
          description: snapPositionen.map(p => p.artikelbezeichnung).filter(Boolean).join(', '),
          image_url: parts_url,
          wareneingang_id: ins.id,
        }).select().single()
        if (bt?.id) {
          fetch('/api/pondruff/embed-bauteil', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: bt.id }),
          }).catch(() => {})
        }
      }

      setSavedWe({
        id: ins.id,
        customer: snapKunde || null,
        purchase_order: snapBestellnummer || null,
        delivery_id: snapBestellnummer || null,
        lieferbedingungen: snapLieferbedingungen || null,
        eingelagert_am: snapEingelagert_am || null,
        eingelagert_von: snapEingelagert_von || null,
        positionen: snapPositionen,
      })
      toast.success('Wareneingang gespeichert')
      resetForm()
      loadEntries()
    } catch (e) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Fehler')
    } finally { setSaveBusy(false) }
  }

  // ── Moduswahl ────────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div>
        {savedWe && (
          <div className="pk-card fade-in" style={{ marginBottom: 16, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Wareneingang gespeichert</div>
                <div style={{ fontSize: 12, color: '#aeb9c8' }}>{savedWe.customer || '—'} · {savedWe.purchase_order || '—'} · {Array.isArray(savedWe.positionen) ? savedWe.positionen.length : 0} Pos.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="pk-btn" onClick={() => generateArbeitskartePDF(savedWe)}
                style={{ background: 'linear-gradient(180deg,#e50909,#b80000)', border: '1px solid rgba(229,9,9,.5)' }}>
                🖨️ Arbeitskarte jetzt drucken
              </button>
              <button className="pk-btn-ghost" onClick={() => setSavedWe(null)}>✕ Schließen</button>
            </div>
          </div>
        )}

        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>Neuer Wareneingang</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
          <button
            onClick={() => { if (ocrEnabled) { setSavedWe(null); setMode('ki') } else toast.error('OCR ist durch den Inhaber deaktiviert') }}
            style={{
              background: ocrEnabled ? 'linear-gradient(135deg, rgba(22,132,255,.18), rgba(32,200,255,.1))' : 'rgba(255,255,255,.04)',
              border: `2px solid ${ocrEnabled ? 'rgba(22,132,255,.5)' : 'rgba(255,255,255,.08)'}`,
              borderRadius: 16, padding: '32px 24px', cursor: ocrEnabled ? 'pointer' : 'not-allowed',
              color: ocrEnabled ? '#f8fbff' : '#aeb9c8', textAlign: 'left',
            }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>KI-Wareneingang</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.5 }}>
              {ocrEnabled ? 'Lieferschein hochladen — KI liest alle Daten automatisch aus (mehrere Bilder möglich)' : 'Funktion aktuell durch den Inhaber deaktiviert'}
            </div>
          </button>
          <button
            onClick={() => { setSavedWe(null); setMode('manual'); setPositionen([emptyPos(1)]) }}
            style={{
              background: 'rgba(255,255,255,.03)', border: '2px solid rgba(255,255,255,.12)',
              borderRadius: 16, padding: '32px 24px', cursor: 'pointer',
              color: '#f8fbff', textAlign: 'left',
            }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✍️</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Wareneingang manuell erfassen</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.5 }}>Alle Felder leer — manuell ausfüllen</div>
          </button>
        </div>

        <div className="pk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Letzte Wareneingänge ({entries.length})</h3>
            <button className="pk-btn-ghost" onClick={loadEntries} style={{ fontSize: 11 }}>🔄</button>
          </div>
          {entries.length === 0 ? (
            <div style={{ color: '#aeb9c8', fontSize: 12 }}>Noch keine Wareneingänge.</div>
          ) : (
            <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ width: '100%', fontSize: 11 }}>
                <thead>
                  <tr><th>Datum</th><th>Kunde</th><th>Bestell-Nr.</th><th>Pos.</th><th>Lieferbedingungen</th><th>Eingelagert von</th><th></th></tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td>{new Date(e.created_at).toLocaleDateString('de-DE')}</td>
                      <td>{e.customer || '—'}</td>
                      <td>{e.purchase_order || e.delivery_id || '—'}</td>
                      <td>{Array.isArray(e.positionen) ? e.positionen.length : '—'}</td>
                      <td>{e.lieferbedingungen || '—'}</td>
                      <td>{e.eingelagert_von || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="pk-btn-ghost" style={{ fontSize: 10 }}
                            onClick={() => generateArbeitskartePDF(e as unknown as ArbeitskarteData)}
                            title="Arbeitskarte drucken">🖨️</button>
                          {weDelConfirm === e.id ? (
                            <>
                              <button onClick={() => deleteEntry(e.id)}
                                style={{ background: '#e50909', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }}>Ja</button>
                              <button onClick={() => setWeDelConfirm(null)}
                                style={{ background: 'transparent', color: '#aeb9c8', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }}>X</button>
                            </>
                          ) : (
                            <button className="pk-btn-ghost" style={{ fontSize: 10, color: '#ff8080' }}
                              onClick={() => setWeDelConfirm(e.id)}
                              title="Wareneingang löschen">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const showForm = mode === 'manual' || (mode === 'ki' && ocrDone)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 13 }}>
          ← Zurück
        </button>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
          {mode === 'ki' ? '🤖 KI-Wareneingang' : '✍️ Wareneingang manuell erfassen'}
        </h3>
      </div>

      {mode === 'ki' && !ocrDone && (
        <div className="pk-card">
          <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Schritt 1 — Dokument hochladen</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <label>
              <div style={lbl}>Lieferschein (Pflicht) — mehrere Bilder möglich</div>
              <input type="file" accept="image/*" capture="environment" multiple
                onChange={e => setReceiptFiles(Array.from(e.target.files || []))} />
              {receiptFiles.length > 0 && (
                <div style={{ fontSize: 10, color: '#4ddb7e', marginTop: 4 }}>
                  ✓ {receiptFiles.length} Bild{receiptFiles.length > 1 ? 'er' : ''} ausgewählt
                </div>
              )}
            </label>
            <label>
              <div style={lbl}>Bauteil-Foto (optional)</div>
              <input type="file" accept="image/*" capture="environment"
                onChange={e => setPartsFile(e.target.files?.[0] ?? null)} />
            </label>
            <label>
              <div style={lbl}>Verpackung-Foto (optional)</div>
              <input type="file" accept="image/*" capture="environment"
                onChange={e => setPackagingFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button className="pk-btn" disabled={ocrBusy || !receiptFiles.length}
            onClick={runOcr} style={{ marginTop: 14, width: '100%' }}>
            {ocrBusy
              ? `⏳ KI liest ${receiptFiles.length > 1 ? receiptFiles.length + ' Bilder' : 'Lieferschein'} aus…`
              : `🤖 Lieferschein auslesen${receiptFiles.length > 1 ? ` (${receiptFiles.length} Bilder)` : ''}`}
          </button>
        </div>
      )}

      {showForm && (
        <div className="pk-card">
          {mode === 'ki' && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)', fontSize: 12, color: '#4ddb7e' }}>
              ✓ Lieferschein ausgelesen — alle Felder prüfen und ggf. korrigieren
            </div>
          )}

          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Kopfdaten</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
            <label>
              <div style={lbl}>Kunde (Firmenname)</div>
              <input className="pk-input" value={kunde} onChange={e => setKunde(e.target.value)} />
            </label>
            <label>
              <div style={lbl}>Bestell-/Auftrags-/Lieferschein-Nr.</div>
              <input className="pk-input" value={bestellnummer} onChange={e => setBestellnummer(e.target.value)} />
            </label>
            <label>
              <div style={lbl}>Anzahl Positionen</div>
              <input className="pk-input" value={positionen.length} readOnly style={{ background: 'rgba(255,255,255,.04)', cursor: 'default' }} />
            </label>
          </div>

          <div style={sep} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Positionen ({positionen.length})</h4>
            <button className="pk-btn-ghost" onClick={addPos} style={{ fontSize: 12 }}>+ Position hinzufügen</button>
          </div>

          {positionen.map((pos, idx) => (
            <div key={idx} style={posCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#20c8ff' }}>Position {pos.position_nr}</span>
                {positionen.length > 1 && (
                  <button onClick={() => removePos(idx)}
                    style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 12 }}>✕</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                <label>
                  <div style={lbl}>Menge</div>
                  <input className="pk-input" value={pos.menge} onChange={e => updatePos(idx, { menge: e.target.value })} />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  <div style={lbl}>Artikelbezeichnung</div>
                  <input className="pk-input" value={pos.artikelbezeichnung} onChange={e => updatePos(idx, { artikelbezeichnung: e.target.value })} />
                </label>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={lbl}>Form / Maße</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {(['Eckig', 'Rund'] as const).map(f => (
                    <button key={f} onClick={() => updatePos(idx, { form: f })}
                      style={{
                        padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        border: `1px solid ${pos.form === f ? 'rgba(22,132,255,.6)' : 'rgba(255,255,255,.12)'}`,
                        background: pos.form === f ? 'rgba(22,132,255,.18)' : 'rgba(255,255,255,.03)',
                        color: pos.form === f ? '#20c8ff' : '#aeb9c8',
                      }}>{f}</button>
                  ))}
                </div>
                {pos.form === 'Eckig' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <label><div style={lbl}>Länge (mm)</div><input className="pk-input" value={pos.laenge} onChange={e => updatePos(idx, { laenge: e.target.value })} /></label>
                    <label><div style={lbl}>Breite (mm)</div><input className="pk-input" value={pos.breite} onChange={e => updatePos(idx, { breite: e.target.value })} /></label>
                    <label><div style={lbl}>Höhe (mm)</div><input className="pk-input" value={pos.hoehe} onChange={e => updatePos(idx, { hoehe: e.target.value })} /></label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <label><div style={lbl}>Durchmesser (mm)</div><input className="pk-input" value={pos.durchmesser} onChange={e => updatePos(idx, { durchmesser: e.target.value })} /></label>
                    <label><div style={lbl}>Länge (mm)</div><input className="pk-input" value={pos.durchmesser_laenge} onChange={e => updatePos(idx, { durchmesser_laenge: e.target.value })} /></label>
                  </div>
                )}
                {pos.raw_dimension_text && (
                  <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 4 }}>
                    📝 KI las vom Beleg: <b>{pos.raw_dimension_text}</b>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={lbl}>Weitere Informationen</div>
                  <button onClick={() => addWeitereInfo(idx)} style={{ background: 'none', border: 'none', color: '#1684ff', cursor: 'pointer', fontSize: 11 }}>+ Feld</button>
                </div>
                {pos.weitere_infos.map((wi, wi_idx) => (
                  <div key={wi_idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 4 }}>
                    <input className="pk-input" placeholder="Schlüssel" value={wi.key} style={{ fontSize: 12 }}
                      onChange={e => updateWeitereInfo(idx, wi_idx, e.target.value, wi.value)} />
                    <input className="pk-input" placeholder="Wert" value={wi.value} style={{ fontSize: 12 }}
                      onChange={e => updateWeitereInfo(idx, wi_idx, wi.key, e.target.value)} />
                    <button onClick={() => removeWeitereInfo(idx, wi_idx)}
                      style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 }}>
                {([
                  { key: 'polieren', label: 'Polieren?' },
                  { key: 'entschichtung', label: 'Entschichtung?' },
                  { key: 'microstrahlen', label: 'Microstrahlen?' },
                  { key: 'laeppstrahlen', label: 'Läppstrahlen?' },
                  { key: 'polierstrahlen', label: 'Polierstrahlen?' },
                ] as { key: keyof WEPos; label: string }[]).map(({ key, label }) => (
                  <label key={key}>
                    <div style={lbl}>{label}</div>
                    <select className="pk-input" value={pos[key] as string}
                      onChange={e => updatePos(idx, { [key]: e.target.value as 'Ja' | 'Nein' })}>
                      <option value="Nein">Nein</option>
                      <option value="Ja">Ja</option>
                    </select>
                  </label>
                ))}
              </div>

              {pos.polieren === 'Ja' && (
                <label style={{ display: 'block', marginBottom: 10 }}>
                  <div style={lbl}>Wo polieren?</div>
                  <input className="pk-input" value={pos.polieren_wo} onChange={e => updatePos(idx, { polieren_wo: e.target.value })} />
                </label>
              )}

              <label>
                <div style={lbl}>Welche Beschichtung?</div>
                <select className="pk-input" value={pos.beschichtung} onChange={e => updatePos(idx, { beschichtung: e.target.value })}>
                  {WE_COATINGS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
          ))}

          {mode === 'manual' && (
            <>
              <div style={sep} />
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Fotos (optional)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                <label>
                  <div style={lbl}>Lieferschein-Foto</div>
                  <input type="file" accept="image/*" capture="environment" multiple
                    onChange={e => setReceiptFiles(Array.from(e.target.files || []))} />
                </label>
                <label>
                  <div style={lbl}>Bauteil-Foto</div>
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => setPartsFile(e.target.files?.[0] ?? null)} />
                </label>
                <label>
                  <div style={lbl}>Verpackung-Foto</div>
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => setPackagingFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </>
          )}

          <div style={sep} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
            <label>
              <div style={lbl}>Lieferbedingungen <span style={{ color: '#ff8080' }}>*</span></div>
              <select className="pk-input" value={lieferbedingungen} onChange={e => setLieferbedingungen(e.target.value)}>
                <option value="">— bitte wählen —</option>
                {BEDINGUNGEN.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label>
              <div style={lbl}>Eingelagert am</div>
              <input type="date" className="pk-input" value={eingelagert_am} onChange={e => setEingelagert_am(e.target.value)} />
            </label>
            <label>
              <div style={lbl}>Eingelagert von <span style={{ color: '#ff8080' }}>*</span></div>
              <select className="pk-input" value={eingelagert_von} onChange={e => setEingelagert_von(e.target.value)}>
                <option value="">— bitte wählen —</option>
                {EINLAGERER.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          {!canSave && (
            <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
              ⚠️ Pflichtfelder: Lieferbedingungen und Eingelagert von
            </div>
          )}

          <button className="pk-btn" disabled={saveBusy || !canSave} onClick={save}
            style={{ width: '100%', opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {saveBusy ? '⏳ Speichere…' : '💾 Wareneingang erfassen & speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
