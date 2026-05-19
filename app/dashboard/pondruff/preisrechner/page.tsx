'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  PRICE_COATINGS, blankPricePosition, calcPricePosition, priceDefaultFactor,
  normalizePriceCoating, normalizePriceCustomer, buildWisoPriceOrder, wisoOrderTsv,
  money, compressImageDataUrl, parseDecimal, type PricePosition, type PondShape,
} from '@/lib/pondruff'
import { usePondruffFlags } from '@/components/pondruff/usePondruffFlags'
import { DecimalInput } from '@/components/pondruff/DecimalInput'

function Pos({ pos, idx, onChange, onDelete, isFirst, globalPO, setGlobalPO }: {
  pos: PricePosition; idx: number;
  onChange: (p: PricePosition) => void; onDelete: () => void;
  isFirst: boolean; globalPO: string; setGlobalPO: (s: string) => void;
}) {
  const r = calcPricePosition(pos)
  const set = <K extends keyof PricePosition>(k: K, v: PricePosition[K]) => onChange({ ...pos, [k]: v })

  return (
    <div className="pk-card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Position {idx + 1}: {pos.description || '—'}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#aeb9c8' }}>Quelle: {pos.source}</span>
          <button className="pk-btn-ghost" onClick={onDelete} style={{ fontSize: 12 }}>🗑️ Löschen</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
        <label><div style={lblStyle}>Bezeichnung</div><input className="pk-input" value={pos.description} onChange={e => set('description', e.target.value)} /></label>
        <label><div style={lblStyle}>Artikel-Nr.</div><input className="pk-input" value={pos.article_no} onChange={e => set('article_no', e.target.value)} /></label>
        <label><div style={lblStyle}>Stückzahl</div>
          <DecimalInput value={pos.quantity} min={1} keepZero decimals={0} onChange={n => set('quantity', Math.max(1, Math.round(n) || 1))} />
        </label>
        <label><div style={lblStyle}>Form</div>
          <select className="pk-input" value={pos.shape} onChange={e => {
            const shape = e.target.value as PondShape
            onChange({ ...pos, shape, ...(shape === 'Rund' ? { width: 0, height: 0 } : { diameter: 0 }) })
          }}>
            <option value="Eckig">Eckig</option><option value="Rund">Rund</option>
          </select>
        </label>
        <label><div style={lblStyle}>Schicht</div>
          <select className="pk-input" value={pos.coating} onChange={e => {
            const c = normalizePriceCoating(e.target.value)
            onChange({ ...pos, coating: c, factor: priceDefaultFactor(c) })
          }}>
            {PRICE_COATINGS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label><div style={lblStyle}>R4-Faktor</div>
          <DecimalInput value={pos.factor} min={0} onChange={n => set('factor', n)} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
        {pos.shape === 'Rund' ? (
          <>
            <label><div style={lblStyle}>Durchmesser (mm)</div>
              <DecimalInput value={pos.diameter} min={0} onChange={n => set('diameter', n)} />
            </label>
            <label><div style={lblStyle}>Länge (mm)</div>
              <DecimalInput value={pos.length} min={0} onChange={n => set('length', n)} />
            </label>
            <Metric label="Volumenbasis" value="Rund (Ø² · π/4 · L)" />
          </>
        ) : (
          <>
            <label><div style={lblStyle}>Länge (mm)</div>
              <DecimalInput value={pos.length} min={0} onChange={n => set('length', n)} />
            </label>
            <label><div style={lblStyle}>Breite (mm)</div>
              <DecimalInput value={pos.width} min={0} onChange={n => set('width', n)} />
            </label>
            <label><div style={lblStyle}>Höhe (mm)</div>
              <DecimalInput value={pos.height} min={0} onChange={n => set('height', n)} />
            </label>
            <Metric label="Volumenbasis" value="Eckig (L · B · H)" />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
        <label><div style={lblStyle}>Rabatt %</div>
          <DecimalInput value={pos.discount} min={0} max={100} onChange={n => set('discount', n)} />
        </label>
        <label><div style={lblStyle}>Positionsnummer</div><input className="pk-input" value={pos.position_no} onChange={e => set('position_no', e.target.value)} /></label>
        <label><div style={lblStyle}>Auftrags-Nr.</div><input className="pk-input" value={pos.order_no} onChange={e => set('order_no', e.target.value)} /></label>
        <label><div style={lblStyle}>Kostenstelle</div><input className="pk-input" value={pos.cost_center} onChange={e => set('cost_center', e.target.value)} /></label>
        {isFirst ? (
          <label><div style={lblStyle}>Bestell-Nr. (global)</div>
            <input className="pk-input" value={pos.purchase_order || globalPO} onChange={e => { set('purchase_order', e.target.value); setGlobalPO(e.target.value) }} />
          </label>
        ) : (
          <div style={{ fontSize: 11, color: '#7f8da3', alignSelf: 'end' }}>Bestell-Nr. nur in der letzten Position für WISO.</div>
        )}
        <label><div style={lblStyle}>Notiz</div><input className="pk-input" value={pos.note} onChange={e => set('note', e.target.value)} /></label>
      </div>

      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 10 }}>
        Standardfaktor für {pos.coating}: {priceDefaultFactor(pos.coating).toFixed(2)} · Volumen: {r.volume.toFixed(0)} mm³
      </div>

      {pos.raw_dimension_text && (
        <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 11, color: '#fbbf24' }}>
          📝 KI-Original vom Beleg: <b style={{ color: '#fde68a' }}>{pos.raw_dimension_text}</b>
          {' '}— stimmt das mit den Werten oben überein? Wenn nicht, bitte korrigieren.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Metric label="Preis / Stk." value={`${r.unit_price.toFixed(2)} €`} />
        <Metric label="Normalpreis" value={`${r.normal_total.toFixed(2)} €`} />
        <Metric label="Rabatt" value={`${r.discount_amount.toFixed(2)} €`} />
        <Metric label="Nach Rabatt" value={`${r.final_total.toFixed(2)} €`} highlight />
      </div>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ fontSize: 10, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: highlight ? '#4ddb7e' : '#f8fbff' }}>{value}</div>
    </div>
  )
}

const lblStyle: React.CSSProperties = { fontSize: 11, color: '#aeb9c8', marginBottom: 4 }

export default function PreisrechnerPage() {
  const sp = useSearchParams()
  const [positions, setPositions] = useState<PricePosition[]>([])
  const [customer, setCustomer] = useState('')
  const [project, setProject] = useState('')
  const [globalPO, setGlobalPO] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [ocrNote, setOcrNote] = useState('')
  const { flags: pondFlags } = usePondruffFlags()
  const ocrEnabled = pondFlags.ocr_preisrechner

  type OcrReview = {
    positions: PricePosition[]
    enabled: boolean[]
    customer: string
    delivery_id: string
    purchase_order: string
    ocr_note: string
  }
  const [review, setReview] = useState<OcrReview | null>(null)

  useEffect(() => {
    if (sp.get('prefill') !== '1' || typeof window === 'undefined') return
    const raw = sessionStorage.getItem('pondruff_prefill')
    if (!raw) return
    try {
      const pf = JSON.parse(raw) as { customer?: string; delivery_id?: string; positions?: Record<string, unknown>[]; ai_data?: Record<string, unknown> }
      if (pf.customer) setCustomer(normalizePriceCustomer(pf.customer))
      if (pf.delivery_id) setProject(pf.delivery_id)
      const ad = pf.ai_data as Record<string, unknown> | undefined
      if (ad?.purchase_order) setGlobalPO(String(ad.purchase_order))
      if (Array.isArray(pf.positions) && pf.positions.length) {
        const arr: PricePosition[] = pf.positions.map((raw, i) => {
          const p = raw as Partial<PricePosition> & { raw_dimension_text?: unknown }
          const base = blankPricePosition(p.shape === 'Rund' ? 'Rund' : 'Eckig')
          const c = normalizePriceCoating(String(p.coating || 'TiCN'))
          return {
            ...base, ...p,
            quantity: Math.max(1, Math.round(parseDecimal(p.quantity ?? 1)) || 1),
            diameter: parseDecimal(p.diameter),
            length: parseDecimal(p.length),
            width: parseDecimal(p.width),
            height: parseDecimal(p.height),
            discount: parseDecimal(p.discount),
            coating: c, factor: priceDefaultFactor(c),
            raw_dimension_text: typeof p.raw_dimension_text === 'string' ? p.raw_dimension_text : undefined,
            purchase_order: i === 0 ? String(p.purchase_order || ad?.purchase_order || '') : '', source: 'ki',
          } as PricePosition
        })
        setPositions(arr)
      }
      sessionStorage.removeItem('pondruff_prefill')
      setToast({ msg: `${pf.positions?.length || 0} Position(en) aus Wareneingang übernommen`, ok: true })
      setTimeout(() => setToast(null), 3500)
    } catch {}
  }, [sp])

  const totals = useMemo(() => {
    let n = 0, f = 0
    positions.forEach(p => {
      const r = calcPricePosition(p)
      n += r.normal_total; f += r.final_total
    })
    const net = money(f)
    const vat = money(net * 0.19)
    return { normal: money(n), final: net, discount: money(n - f), net, vat, gross: money(net + vat) }
  }, [positions])

  const wiso = useMemo(() => buildWisoPriceOrder(customer, project, positions, globalPO), [customer, project, positions, globalPO])

  function addPos(shape: PondShape) {
    const p = blankPricePosition(shape)
    p.discount = globalDiscount
    setPositions(prev => [...prev, p])
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  async function runOcr() {
    if (!files.length) { showToast('Bitte Datei(en) hochladen', false); return }
    setBusy(true)
    try {
      const images = await Promise.all(files.map(f => compressImageDataUrl(f)))
      const resp = await fetch('/api/pondruff/ocr-price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        const msg = [data?.error, data?.detail].filter(Boolean).join(' — ')
        throw new Error(msg || 'OCR fehlgeschlagen')
      }
      const arr: PricePosition[] = (data.positions || []).map((raw: Record<string, unknown>, i: number) => {
        const p = raw as Partial<PricePosition>
        const base = blankPricePosition(p.shape === 'Rund' ? 'Rund' : 'Eckig')
        const c = normalizePriceCoating(String(p.coating || 'TiCN'))
        return {
          ...base, ...p,
          quantity: Math.max(1, Math.round(parseDecimal(p.quantity ?? 1)) || 1),
          diameter: parseDecimal(p.diameter),
          length: parseDecimal(p.length),
          width: parseDecimal(p.width),
          height: parseDecimal(p.height),
          coating: c,
          factor: priceDefaultFactor(c),
          discount: globalDiscount,
          purchase_order: i === 0 ? (String(p.purchase_order || data.purchase_order || '')) : '',
          raw_dimension_text: typeof raw.raw_dimension_text === 'string' ? raw.raw_dimension_text : undefined,
          source: 'ki',
        } as PricePosition
      })
      setReview({
        positions: arr,
        enabled: arr.map(() => true),
        customer: normalizePriceCustomer(String(data.customer || '')),
        delivery_id: String(data.delivery_id || ''),
        purchase_order: String(data.purchase_order || ''),
        ocr_note: String(data.ocr_note || ''),
      })
      showToast(`${arr.length} Position(en) erkannt — bitte pruefen`)
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'OCR-Fehler', false)
    } finally { setBusy(false) }
  }

  async function saveOrder() {
    if (!positions.length) { showToast('Keine Positionen', false); return }
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')
      const { error } = await supabase.from('pondruff_preisauftraege').insert({
        user_id: user.id,
        order_id: wiso.id,
        customer: wiso.customer,
        project: wiso.project,
        purchase_order: wiso.purchase_order,
        total: wiso.total,
        positions,
        rows: wiso.rows,
        status: 'preisauftrag',
      })
      if (error) throw error
      showToast('Auftrag in Büro/WISO gespeichert. Dort kannst du nach BüroPilot oder WISO exportieren.')
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Speichern fehlgeschlagen', false)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <div style={lblStyle}>Dokumente hochladen (PNG/JPG)</div>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 6 }}>{files.length} Datei(en) bereit</div>}
            <label style={{ display: 'block', marginTop: 10 }}>
              <div style={lblStyle}>Rabatt % für alle Positionen</div>
              <DecimalInput value={globalDiscount} min={0} max={100} onChange={setGlobalDiscount} />
            </label>
            <button className="pk-btn" disabled={busy || !ocrEnabled} onClick={runOcr} style={{ marginTop: 10, width: '100%' }}>
              {busy ? '⏳ Läuft…' : ocrEnabled ? '🤖 GPT-4 Positionen auslesen' : '🚫 Funktion deaktiviert'}
            </button>
            {!ocrEnabled && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: 8 }}>
                ℹ️ Positionen-OCR ist aktuell durch den Inhaber deaktiviert. Positionen können weiterhin manuell angelegt werden.
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Kunde / Projekt</div>
            <label style={{ display: 'block', marginBottom: 8 }}><div style={lblStyle}>Kunde / Firma</div><input className="pk-input" value={customer} onChange={e => setCustomer(normalizePriceCustomer(e.target.value))} /></label>
            <label style={{ display: 'block', marginBottom: 8 }}><div style={lblStyle}>Projekt / Lieferschein</div><input className="pk-input" value={project} onChange={e => setProject(e.target.value)} /></label>
            <label style={{ display: 'block', marginBottom: 8 }}><div style={lblStyle}>Bestell-Nr.</div><input className="pk-input" value={globalPO} onChange={e => setGlobalPO(e.target.value)} /></label>
            <button className="pk-btn-ghost" style={{ width: '100%' }} onClick={() => addPos('Eckig')}>+ Position manuell anlegen</button>
          </div>
        </div>

        {ocrNote && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.25)', fontSize: 12 }}>ℹ️ {ocrNote}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="pk-btn-ghost" onClick={() => addPos('Rund')}>+ Runde Position</button>
        <button className="pk-btn-ghost" onClick={() => addPos('Eckig')}>+ Eckige Position</button>
        <button className="pk-btn-ghost" onClick={() => { setPositions([]); setOcrNote('') }}>🧹 Positionen leeren</button>
      </div>

      {positions.length === 0 && (
        <div className="pk-card" style={{ color: '#aeb9c8' }}>Noch keine Positionen vorhanden. Manuell anlegen oder Dokument auslesen lassen.</div>
      )}

      {positions.map((p, i) => (
        <Pos key={i} pos={p} idx={i}
          onChange={np => setPositions(prev => prev.map((x, j) => j === i ? np : x))}
          onDelete={() => setPositions(prev => prev.filter((_, j) => j !== i))}
          isFirst={i === 0} globalPO={globalPO} setGlobalPO={setGlobalPO} />
      ))}

      {positions.length > 0 && (
        <>
          <div className="pk-card" style={{ marginTop: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Gesamt</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              <Metric label="Normalpreis" value={`${totals.normal.toFixed(2)} €`} />
              <Metric label="Rabatt gesamt" value={`${totals.discount.toFixed(2)} €`} />
              <Metric label="Positionen" value={String(positions.length)} />
              <Metric label="Netto" value={`${totals.net.toFixed(2)} €`} />
              <Metric label="MwSt. 19%" value={`${totals.vat.toFixed(2)} €`} />
              <Metric label="Brutto" value={`${totals.gross.toFixed(2)} €`} highlight />
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>WISO-Vorschau</h3>
            <div className="pk-table-wrap" style={{ overflowX: 'auto', marginBottom: 10 }}>
              <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr>{['Pos.','Menge','Artikel-Nr.','Beschreibung','Listenpreis','Rabatt %','Einzelpreis','Gesamtpreis'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{wiso.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r['Pos.']}</td><td>{r.Menge}</td><td>{r['Artikel-Nr.']}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>{r.Beschreibung}</td>
                    <td>{r.Listenpreis}</td><td>{r['Rabatt (%)']}</td><td>{r.Einzelpreis}</td><td>{r.Gesamtpreis}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflowX: 'auto', maxHeight: 200 }}>{wisoOrderTsv(wiso)}</pre>

            <button className="pk-btn" disabled={busy || !positions.length} onClick={saveOrder} style={{ width: '100%', marginTop: 10 }}>
              {busy ? '⏳ Speichere…' : '💾 Auftrag speichern (Büro/WISO)'}
            </button>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 6 }}>
              Der Auftrag wird in <b>Büro/WISO</b> abgelegt — von dort kannst du ihn nach <b>BüroPilot</b> oder <b>WISO MeinBüro</b> exportieren.
            </div>
          </div>
        </>
      )}

      {review && (
        <OcrReviewModal
          review={review}
          onChange={setReview}
          onCancel={() => setReview(null)}
          onAccept={() => {
            const picked = review.positions.filter((_, i) => review.enabled[i])
            setPositions(picked)
            if (review.customer) setCustomer(review.customer)
            if (review.delivery_id) setProject(review.delivery_id)
            if (review.purchase_order) setGlobalPO(review.purchase_order)
            setOcrNote(review.ocr_note)
            setReview(null)
            showToast(`${picked.length} Position(en) übernommen`)
          }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 9999, padding: '14px 20px', borderRadius: 12, maxWidth: 380,
          background: toast.ok ? 'rgba(37,211,102,.12)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.35)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080', fontSize: 14, fontWeight: 600,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

type OcrReviewState = {
  positions: PricePosition[]
  enabled: boolean[]
  customer: string
  delivery_id: string
  purchase_order: string
  ocr_note: string
}

function OcrReviewModal({
  review, onChange, onAccept, onCancel,
}: {
  review: OcrReviewState
  onChange: (r: OcrReviewState) => void
  onAccept: () => void
  onCancel: () => void
}) {
  const [matches, setMatches] = useState<Array<{ id: string; name: string; score: number }>>([])
  useEffect(() => {
    if (!review.customer.trim()) { setMatches([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch('/api/pondruff/match-kunde', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: review.customer }), signal: ctrl.signal,
      })
        .then(r => r.json())
        .then(d => setMatches(Array.isArray(d.matches) ? d.matches : []))
        .catch(() => {})
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [review.customer])

  const setPos = (i: number, patch: Partial<PricePosition>) => {
    onChange({
      ...review,
      positions: review.positions.map((p, j) => j === i ? { ...p, ...patch } : p),
    })
  }
  const toggle = (i: number) => {
    onChange({ ...review, enabled: review.enabled.map((e, j) => j === i ? !e : e) })
  }
  const selectedCount = review.enabled.filter(Boolean).length
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onCancel}>
      <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>🤖 OCR-Ergebnis prüfen</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 10 }}>
          Korrigiere erkannte Werte hier <b>bevor</b> sie in den Preisrechner übernommen werden. Häkchen entfernen blendet Positionen aus.
        </div>

        {review.ocr_note && (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.25)', fontSize: 12 }}>
            ℹ️ {review.ocr_note}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 4 }}>
          <label><div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Kunde</div>
            <input className="pk-input" value={review.customer} onChange={e => onChange({ ...review, customer: e.target.value })} />
          </label>
          <label><div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Lieferschein</div>
            <input className="pk-input" value={review.delivery_id} onChange={e => onChange({ ...review, delivery_id: e.target.value })} />
          </label>
          <label><div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Bestell-Nr.</div>
            <input className="pk-input" value={review.purchase_order} onChange={e => onChange({ ...review, purchase_order: e.target.value })} />
          </label>
        </div>
        {matches.length > 0 && !matches.some(m => m.name === review.customer) && (
          <div style={{ marginBottom: 14, padding: 10, borderRadius: 10, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.25)' }}>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 6 }}>
              💡 Existierende Kunden in BüroPilot — verhindert Duplikate:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {matches.map(m => (
                <button key={m.id}
                  className="pk-btn-ghost"
                  onClick={() => onChange({ ...review, customer: m.name })}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {m.name} <span style={{ color: '#4ddb7e', marginLeft: 4 }}>{m.score}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {matches.length === 0 || !matches.some(m => m.name === review.customer)
          ? null
          : (
            <div style={{ marginBottom: 14, fontSize: 11, color: '#4ddb7e' }}>
              ✓ Kunde bereits in BüroPilot vorhanden
            </div>
          )
        }

        <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
          {review.positions.map((p, i) => (
            <div key={i} style={{
              padding: 12, borderRadius: 10,
              border: `1px solid ${review.enabled[i] ? 'rgba(229,9,9,.25)' : 'rgba(255,255,255,.08)'}`,
              background: review.enabled[i] ? 'rgba(229,9,9,.04)' : 'rgba(255,255,255,.02)',
              opacity: review.enabled[i] ? 1 : .6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800 }}>
                  <input type="checkbox" checked={review.enabled[i]} onChange={() => toggle(i)} />
                  Position {i + 1}
                </label>
                <span style={{ fontSize: 11, color: '#aeb9c8' }}>{p.shape} · {p.coating}</span>
              </div>
              {p.raw_dimension_text && (
                <div style={{ marginBottom: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 11, color: '#fbbf24' }}>
                  📝 KI las vom Beleg: <b style={{ color: '#fde68a' }}>{p.raw_dimension_text}</b>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Bezeichnung</div>
                  <input className="pk-input" value={p.description} onChange={e => setPos(i, { description: e.target.value })} />
                </label>
                <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Artikel-Nr.</div>
                  <input className="pk-input" value={p.article_no} onChange={e => setPos(i, { article_no: e.target.value })} />
                </label>
                <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Menge</div>
                  <DecimalInput value={p.quantity} min={1} keepZero decimals={0} onChange={n => setPos(i, { quantity: Math.max(1, Math.round(n) || 1) })} />
                </label>
                <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Schicht</div>
                  <select className="pk-input" value={p.coating} onChange={e => {
                    const c = normalizePriceCoating(e.target.value)
                    setPos(i, { coating: c, factor: priceDefaultFactor(c) })
                  }}>
                    {PRICE_COATINGS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                {p.shape === 'Rund' ? (
                  <>
                    <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Ø (mm)</div>
                      <DecimalInput value={p.diameter} min={0} onChange={n => setPos(i, { diameter: n })} />
                    </label>
                    <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>Länge (mm)</div>
                      <DecimalInput value={p.length} min={0} onChange={n => setPos(i, { length: n })} />
                    </label>
                  </>
                ) : (
                  <>
                    <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>L (mm)</div>
                      <DecimalInput value={p.length} min={0} onChange={n => setPos(i, { length: n })} />
                    </label>
                    <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>B (mm)</div>
                      <DecimalInput value={p.width} min={0} onChange={n => setPos(i, { width: n })} />
                    </label>
                    <label><div style={{ fontSize: 10, color: '#aeb9c8' }}>H (mm)</div>
                      <DecimalInput value={p.height} min={0} onChange={n => setPos(i, { height: n })} />
                    </label>
                  </>
                )}
              </div>
            </div>
          ))}
          {review.positions.length === 0 && (
            <div style={{ color: '#aeb9c8', fontSize: 13, textAlign: 'center', padding: 20 }}>
              Keine Positionen erkannt. Trag sie manuell im Preisrechner ein.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, position: 'sticky', bottom: 0, background: 'var(--card)', paddingTop: 10 }}>
          <button className="pk-btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Verwerfen</button>
          <button className="pk-btn" onClick={onAccept} disabled={selectedCount === 0} style={{ flex: 2 }}>
            ✓ {selectedCount} Position(en) übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}
