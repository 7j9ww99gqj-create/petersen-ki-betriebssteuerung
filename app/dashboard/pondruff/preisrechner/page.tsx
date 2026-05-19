'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  PRICE_COATINGS, blankPricePosition, calcPricePosition, priceDefaultFactor,
  normalizePriceCoating, normalizePriceCustomer, buildWisoPriceOrder, wisoOrderTsv,
  money, type PricePosition, type PondShape,
} from '@/lib/pondruff'

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
        <label><div style={lblStyle}>Stückzahl</div><input className="pk-input" type="number" min={1} value={pos.quantity} onChange={e => set('quantity', Math.max(1, parseInt(e.target.value) || 1))} /></label>
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
        <label><div style={lblStyle}>R4-Faktor</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.factor} onChange={e => set('factor', parseFloat(e.target.value) || 0)} /></label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
        {pos.shape === 'Rund' ? (
          <>
            <label><div style={lblStyle}>Durchmesser (mm)</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.diameter} onChange={e => set('diameter', parseFloat(e.target.value) || 0)} /></label>
            <label><div style={lblStyle}>Länge (mm)</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.length} onChange={e => set('length', parseFloat(e.target.value) || 0)} /></label>
            <Metric label="Volumenbasis" value="Rund (Ø² · π/4 · L)" />
          </>
        ) : (
          <>
            <label><div style={lblStyle}>Länge (mm)</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.length} onChange={e => set('length', parseFloat(e.target.value) || 0)} /></label>
            <label><div style={lblStyle}>Breite (mm)</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.width} onChange={e => set('width', parseFloat(e.target.value) || 0)} /></label>
            <label><div style={lblStyle}>Höhe (mm)</div><input className="pk-input" type="number" step="0.1" min={0} value={pos.height} onChange={e => set('height', parseFloat(e.target.value) || 0)} /></label>
            <Metric label="Volumenbasis" value="Eckig (L · B · H)" />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
        <label><div style={lblStyle}>Rabatt %</div><input className="pk-input" type="number" step="1" min={0} max={100} value={pos.discount} onChange={e => set('discount', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} /></label>
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
  const [expected, setExpected] = useState({ positions: 0, coatings: 0, polishing: 0, stripping: 0 })

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
          const p = raw as Partial<PricePosition>
          const base = blankPricePosition(p.shape === 'Rund' ? 'Rund' : 'Eckig')
          const c = normalizePriceCoating(String(p.coating || 'TiCN'))
          return { ...base, ...p, coating: c, factor: priceDefaultFactor(c),
            purchase_order: i === 0 ? String(p.purchase_order || ad?.purchase_order || '') : '', source: 'ki' } as PricePosition
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
      const images = await Promise.all(files.map(f => new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f)
      })))
      const resp = await fetch('/api/pondruff/ocr-price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'OCR fehlgeschlagen')
      const arr: PricePosition[] = (data.positions || []).map((raw: Record<string, unknown>, i: number) => {
        const p = raw as Partial<PricePosition>
        const base = blankPricePosition(p.shape === 'Rund' ? 'Rund' : 'Eckig')
        const c = normalizePriceCoating(String(p.coating || 'TiCN'))
        return {
          ...base, ...p,
          coating: c,
          factor: priceDefaultFactor(c),
          discount: globalDiscount,
          purchase_order: i === 0 ? (String(p.purchase_order || data.purchase_order || '')) : '',
          source: 'ki',
        } as PricePosition
      })
      setPositions(arr)
      if (data.customer) setCustomer(normalizePriceCustomer(data.customer))
      if (data.delivery_id) setProject(data.delivery_id)
      if (data.purchase_order) setGlobalPO(data.purchase_order)
      setOcrNote(data.ocr_note || '')
      showToast(`${arr.length} Position(en) erkannt`)
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'OCR-Fehler', false)
    } finally { setBusy(false) }
  }

  async function saveOrder(status: 'preisauftrag' | 'auftragsbestaetigung' = 'preisauftrag') {
    if (!positions.length) { showToast('Keine Positionen', false); return }
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')
      const payload: Record<string, unknown> = {
        user_id: user.id,
        order_id: wiso.id,
        customer: wiso.customer,
        project: wiso.project,
        purchase_order: wiso.purchase_order,
        total: wiso.total,
        positions,
        rows: wiso.rows,
        status,
      }
      if (status === 'auftragsbestaetigung') payload.confirmed_at = new Date().toISOString()
      const { error } = await supabase.from('pondruff_preisauftraege').insert(payload)
      if (error) throw error
      showToast(status === 'auftragsbestaetigung' ? 'Auftragsbestätigung erstellt. Siehe Büro/WISO.' : 'WISO-Auftrag gespeichert. Siehe Büro/WISO.')
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Speichern fehlgeschlagen', false)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14, background: 'rgba(245,158,11,.06)', borderColor: 'rgba(245,158,11,.25)' }}>
        <strong>Regeln:</strong> Polierpreise handschriftlich auf dem LS/Pos notieren mit <b>Pol</b> + Preis z. B. <b>Pol35</b>. Entschichten mit <b>Ent</b> + Preis z. B. <b>Ent20</b>.
      </div>

      <div className="pk-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <div style={lblStyle}>Dokumente hochladen (PNG/JPG)</div>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 6 }}>{files.length} Datei(en) bereit</div>}
            <label style={{ display: 'block', marginTop: 10 }}>
              <div style={lblStyle}>Rabatt % für alle Positionen</div>
              <input className="pk-input" type="number" min={0} max={100} step={1} value={globalDiscount} onChange={e => setGlobalDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
            </label>
            <button className="pk-btn" disabled={busy} onClick={runOcr} style={{ marginTop: 10, width: '100%' }}>
              {busy ? '⏳ Läuft…' : '🤖 GPT-4 Positionen auslesen'}
            </button>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Prüftabelle (manuell)</div>
            {(['positions','coatings','polishing','stripping'] as const).map(k => (
              <label key={k} style={{ display: 'block', marginBottom: 6 }}>
                <div style={lblStyle}>{k === 'positions' ? 'Positionen' : k === 'coatings' ? 'Beschichtungen' : k === 'polishing' ? 'Polieren' : 'Entschichten'}</div>
                <input className="pk-input" type="number" min={0} step={1} value={expected[k]} onChange={e => setExpected(prev => ({ ...prev, [k]: Math.max(0, parseInt(e.target.value) || 0) }))} />
              </label>
            ))}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <button className="pk-btn-ghost" disabled={busy || !positions.length} onClick={() => saveOrder('preisauftrag')}>
                {busy ? '⏳…' : '💾 Als Preisauftrag speichern'}
              </button>
              <button className="pk-btn" disabled={busy || !positions.length} onClick={() => saveOrder('auftragsbestaetigung')}>
                {busy ? '⏳…' : '📋 Auftragsbestätigung erstellen'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 6 }}>
              Preisauftrag = nur Kalkulation/WISO-Übergabe. Auftragsbestätigung = verbindlich, kann später in Rechnung gewandelt werden.
            </div>
          </div>
        </>
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
