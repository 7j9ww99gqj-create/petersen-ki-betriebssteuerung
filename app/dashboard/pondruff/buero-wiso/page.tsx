'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import {
  wisoOrderTsv, type WisoOrder, type WisoOrderRow,
  calcPricePosition, buildWisoPriceOrder, parseDecimal,
  priceDefaultFactor, normalizePriceCoating, getPriceConfig, money,
  type PricePosition,
} from '@/lib/pondruff'
import { generatePondruffOrderPDF, generateArbeitskartePDF, type PondPreisauftrag, type ArbeitskarteData } from '@/lib/pondruff-pdf'
import { usePondruffFlags } from '@/components/pondruff/usePondruffFlags'
import { useGlobalToast } from '@/components/ui/ToastProvider'

type Saved = {
  id: string
  created_at: string
  order_id: string | null
  customer: string | null
  project: string | null
  purchase_order: string | null
  total: number | null
  positions: unknown
  rows: WisoOrderRow[]
  status: string | null
  synced_buero_auftrag_id: string | null
  synced_buero_at: string | null
  synced_wiso_at: string | null
}

type WEPosEntry = {
  position_nr: number
  menge: string
  artikelbezeichnung: string
  form: string
  laenge?: string
  breite?: string
  hoehe?: string
  durchmesser?: string
  durchmesser_laenge?: string
  raw_dimension_text?: string
  weitere_infos?: { key: string; value: string }[]
  polieren?: string
  polieren_wo?: string
  entschichtung?: string
  microstrahlen?: string
  laeppstrahlen?: string
  polierstrahlen?: string
  beschichtung?: string
}

type SavedWE = {
  id: string
  created_at: string
  delivery_id: string | null
  customer: string | null
  purchase_order: string | null
  operator: string | null
  status: string | null
  note: string | null
  ai_data: Record<string, unknown> | null
  positionen: WEPosEntry[] | null
  lieferbedingungen: string | null
  eingelagert_am: string | null
  eingelagert_von: string | null
  synced_buero_dokument_id: string | null
  synced_buero_at: string | null
}

type Section = 'auftraege' | 'wareneingaenge'

function toWiso(o: Saved): WisoOrder {
  return {
    id: o.order_id || o.id,
    created_at: new Date(o.created_at).toLocaleString('de-DE'),
    customer: o.customer || '',
    project: o.project || '',
    purchase_order: o.purchase_order || '',
    name: o.project || `Auftrag ${o.order_id}`,
    total: Number(o.total || 0),
    rows: o.rows || [],
  }
}

export default function BueroWisoPage() {
  const [section, setSection] = useState<Section>('auftraege')
  const [orders, setOrders] = useState<Saved[]>([])
  const [wareneingaenge, setWareneingaenge] = useState<SavedWE[]>([])
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const toast = useGlobalToast()
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [resyncConfirm, setResyncConfirm] = useState<string | null>(null)
  const [selectedWeId, setSelectedWeId] = useState<string | null>(null)
  const [weDelConfirm, setWeDelConfirm] = useState<string | null>(null)
  const [weArchiveConfirm, setWeArchiveConfirm] = useState<string | null>(null)
  const [weConvertConfirm, setWeConvertConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wisoDebug, setWisoDebug] = useState<Record<string, unknown> | null>(null)
  const [wisoDebugBusy, setWisoDebugBusy] = useState(false)
  const { flags: pondFlags } = usePondruffFlags()
  const wisoEnabled = pondFlags.wiso_sync

  async function runWisoDebug() {
    setWisoDebugBusy(true)
    setWisoDebug(null)
    try {
      const r = await fetch('/api/pondruff/wiso-debug', { method: 'POST' })
      const d = await r.json()
      setWisoDebug(d)
    } catch (e) {
      setWisoDebug({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setWisoDebugBusy(false)
    }
  }

  function showToast(msg: string, ok = true) { if (ok) toast.success(msg); else toast.error(msg) }

  async function load() {
    const sb = createSupabaseClient()
    const [o, we] = await Promise.all([
      sb.from('pondruff_preisauftraege').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('pondruff_wareneingaenge').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(500),
    ])
    if (!o.error && o.data) setOrders(o.data as Saved[])
    if (!we.error && we.data) setWareneingaenge(we.data as SavedWE[])
  }
  useEffect(() => { load() }, [])

  const visibleAuftraege = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return orders
    return orders.filter(o => [o.customer, o.project, o.purchase_order, o.order_id].some(x => (x || '').toLowerCase().includes(q)))
  }, [orders, filter])

  const visibleWE = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return wareneingaenge
    return wareneingaenge.filter(w => [w.delivery_id, w.customer, w.note, w.operator].some(x => (x || '').toLowerCase().includes(q)))
  }, [wareneingaenge, filter])

  const selected = orders.find(o => o.id === selectedId)

  async function syncBueroAuftrag(o: Saved) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/sync-buero-auftrag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Fehler')
      showToast(`→ BüroPilot Auftrag ${d.buero_auftrag_id} erstellt`)
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function exportWisoAuftrag(o: Saved) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/wiso-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Fehler')
      showToast('✓ Auftrag in WISO MeinBüro angelegt')
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function syncBueroWE(w: SavedWE) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/sync-buero-wareneingang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Fehler')
      showToast(`→ BüroPilot Dokument ${d.buero_dokument_id} erstellt`)
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function exportWisoWE(w: SavedWE) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/wiso-export-wareneingang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Fehler')
      showToast('✓ Wareneingang in WISO angelegt')
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function del(id: string) {
    const sb = createSupabaseClient()
    await sb.from('pondruff_preisauftraege').delete().eq('id', id)
    showToast('Gelöscht'); load(); setDelConfirm(null)
  }

  async function delWE(id: string) {
    const sb = createSupabaseClient()
    const { error } = await sb.from('pondruff_wareneingaenge').delete().eq('id', id)
    if (error) { showToast('Löschen fehlgeschlagen', false); return }
    showToast('Gelöscht'); load(); setWeDelConfirm(null)
  }

  async function archiveWE(id: string) {
    const sb = createSupabaseClient()
    const { error } = await sb.from('pondruff_wareneingaenge')
      .update({ archived_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast('Archivieren fehlgeschlagen', false); return }
    showToast('✓ Archiviert — im Pondruff-Archiv gespeichert')
    load(); setWeArchiveConfirm(null)
  }

  async function weToAuftrag(w: SavedWE) {
    setBusy(true)
    try {
      const sb = createSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')
      const cfg = await getPriceConfig(user.id)

      const pricePositions: PricePosition[] = (w.positionen || []).map((p, idx) => {
        const isRund = p.form === 'Rund'
        const rawCoating = p.beschichtung && p.beschichtung !== 'Keine' ? p.beschichtung : 'TiCN'
        const coating = normalizePriceCoating(rawCoating)
        const services = [
          p.polieren === 'Ja' && `Polieren${p.polieren_wo ? ` (${p.polieren_wo})` : ''}`,
          p.entschichtung === 'Ja' && 'Entschichtung',
          p.microstrahlen === 'Ja' && 'Microstrahlen',
          p.laeppstrahlen === 'Ja' && 'Läppstrahlen',
          p.polierstrahlen === 'Ja' && 'Polierstrahlen',
        ].filter(Boolean).join(', ')
        return {
          description: [p.artikelbezeichnung || 'Beschichtung', services].filter(Boolean).join(' · '),
          article_no: '', position_no: String(p.position_nr || idx + 1),
          order_no: '', cost_center: '',
          purchase_order: w.purchase_order || w.delivery_id || '',
          quantity: Math.max(1, parseDecimal(p.menge) || 1),
          shape: (isRund ? 'Rund' : 'Eckig') as 'Rund' | 'Eckig',
          coating,
          factor: cfg.coating_factors[coating] ?? priceDefaultFactor(coating),
          diameter: isRund ? parseDecimal(p.durchmesser) : 0,
          length: isRund ? parseDecimal(p.durchmesser_laenge) : parseDecimal(p.laenge),
          width: isRund ? 0 : parseDecimal(p.breite),
          height: isRund ? 0 : parseDecimal(p.hoehe),
          discount: 0, note: '', source: 'wareneingang',
          raw_dimension_text: p.raw_dimension_text,
        }
      })

      const globalPO = w.purchase_order || w.delivery_id || ''
      // Build rows with user's price config
      const rows: WisoOrderRow[] = pricePositions.map((pos, i) => {
        const result = calcPricePosition(pos, cfg)
        const qty = Math.max(1, Math.floor(parseDecimal(pos.quantity) || 1))
        const singleAfter = money(result.final_total / qty)
        return {
          'Pos.': String(i + 1).padStart(2, '0'),
          Menge: qty,
          'Artikel-Nr.': pos.article_no || '',
          Einheit: '',
          Beschreibung: pos.description,
          Liefertermin: '',
          Listenpreis: result.unit_price.toFixed(2),
          'Rabatt (%)': '0',
          Einzelpreis: singleAfter.toFixed(2),
          Gesamtpreis: result.final_total.toFixed(2),
        }
      })
      const total = money(rows.reduce((s, r) => s + parseFloat(r.Gesamtpreis), 0))
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const orderId = `AB-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`

      const { data: ins, error } = await sb.from('pondruff_preisauftraege').insert({
        user_id: user.id,
        order_id: orderId,
        customer: w.customer || null,
        project: w.purchase_order || w.delivery_id || null,
        purchase_order: w.purchase_order || w.delivery_id || null,
        total,
        positions: pricePositions,
        rows,
        status: 'auftragsbestaetigung',
        confirmed_at: now.toISOString(),
      }).select().single()
      if (error) throw error

      // Link WE → Auftrag
      await sb.from('pondruff_wareneingaenge').update({
        ai_data: { ...(w.ai_data || {}), converted_to_auftrag_id: ins.id, converted_at: now.toISOString() },
      }).eq('id', w.id)

      showToast(`✓ Auftragsbestätigung ${orderId} erstellt — ${total.toFixed(2)} € Netto`)
      setWeConvertConfirm(null)
      load()
      setSection('auftraege')
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false)
    } finally { setBusy(false) }
  }

  function downloadHtmlReport(o: Saved) {
    const order = toWiso(o)
    const label = `Auftrag ${o.order_id || ''}`
    const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const net = order.total; const vat = Math.round(net * 19) / 100; const gross = Math.round((net + vat) * 100) / 100
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${esc(label)}</title>
<style>body{font-family:Arial;color:#222;max-width:900px;margin:30px auto;padding:0 20px}h1{color:#b80000}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}</style></head><body>
<h1>${esc(label)}</h1>
<div>Kunde: <b>${esc(order.customer)}</b><br>Projekt: ${esc(order.project)}<br>${order.purchase_order ? 'Bestell-Nr.: ' + esc(order.purchase_order) + '<br>' : ''}Datum: ${order.created_at}</div>
<table><thead><tr><th>Pos.</th><th>Menge</th><th>Artikel-Nr.</th><th>Beschreibung</th><th>Einzelpreis</th><th>Gesamt</th></tr></thead><tbody>
${order.rows.map(r => `<tr><td>${esc(r['Pos.'])}</td><td>${r.Menge}</td><td>${esc(r['Artikel-Nr.'])}</td><td>${esc(r.Beschreibung).replace(/\n/g, '<br>')}</td><td>${esc(r.Einzelpreis)} €</td><td>${esc(r.Gesamtpreis)} €</td></tr>`).join('')}
</tbody></table><div style="margin-top:14px"><div>Netto: ${net.toFixed(2)} €</div><div>MwSt. 19%: ${vat.toFixed(2)} €</div><div style="font-weight:700;color:#b80000">Brutto: ${gross.toFixed(2)} €</div></div></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${label.replace(/[^a-zA-Z0-9-_]/g, '_')}.html`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['auftraege', 'wareneingaenge'] as const).map(s => (
          <button key={s} onClick={() => { setSection(s); setSelectedId(null) }}
            style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14,
              border: `1px solid ${section === s ? 'rgba(229,9,9,.6)' : 'rgba(255,255,255,.08)'}`,
              background: section === s ? 'linear-gradient(180deg,#e50909,#b80000)' : 'rgba(255,255,255,.03)',
              color: section === s ? '#fff' : '#aeb9c8',
            }}>
            {s === 'auftraege' ? `💶 Aufträge (${orders.length})` : `📥 Wareneingänge (${wareneingaenge.length})`}
          </button>
        ))}
      </div>

      <div className="pk-card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Suche Kunde / Projekt / Lieferschein" value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <button className="pk-btn-ghost" onClick={load}>🔄 Neu laden</button>
        <button className="pk-btn-ghost" onClick={runWisoDebug} disabled={wisoDebugBusy} title="Prüft alle WISO Auth-Pfade und zeigt Server-Antworten">
          {wisoDebugBusy ? '⏳ teste…' : '🔍 WISO-Verbindung testen'}
        </button>
      </div>

      {wisoDebug && (
        <div className="pk-card" style={{ marginBottom: 14, background: 'rgba(0,0,0,.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: wisoDebug.ok ? '#4ddb7e' : '#ff8080' }}>
              {wisoDebug.ok ? '✅ WISO-Auth erfolgreich' : '❌ WISO-Auth scheitert'}
            </h4>
            <button onClick={() => setWisoDebug(null)} className="pk-btn-ghost" style={{ fontSize: 11 }}>schließen ✕</button>
          </div>
          {wisoDebug.env != null && (
            <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>
              <b>Env in Vercel:</b>
              <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 8, borderRadius: 6, marginTop: 4 }}>{JSON.stringify(wisoDebug.env, null, 2)}</pre>
            </div>
          )}
          {wisoDebug.hint != null && (
            <div style={{ fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>💡 {String(wisoDebug.hint)}</div>
          )}
          {Array.isArray(wisoDebug.attempts) && (
            <div>
              <b style={{ fontSize: 12, color: '#aeb9c8' }}>Token-Versuche ({wisoDebug.attempts.length}):</b>
              <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 6 }}>
                {(wisoDebug.attempts as Array<Record<string, unknown>>).map((a, i) => (
                  <div key={i} style={{
                    background: a.hasToken ? 'rgba(37,211,102,.08)' : a.ok ? 'rgba(251,191,36,.06)' : 'rgba(255,80,80,.05)',
                    border: `1px solid ${a.hasToken ? 'rgba(37,211,102,.3)' : a.ok ? 'rgba(251,191,36,.2)' : 'rgba(255,80,80,.15)'}`,
                    padding: 8, borderRadius: 6, marginBottom: 6, fontSize: 11,
                  }}>
                    <div style={{ fontWeight: 700, color: a.hasToken ? '#4ddb7e' : '#ff8080' }}>
                      {a.hasToken ? '✅' : '❌'} HTTP {String(a.status)} — {String(a.label)}
                    </div>
                    <div style={{ color: '#aeb9c8', marginTop: 4, fontFamily: 'monospace' }}>{String(a.url)}</div>
                    {a.bodyPreview ? <div style={{ color: '#aeb9c8', marginTop: 2 }}>Body: <code>{String(a.bodyPreview)}</code></div> : null}
                    <div style={{ color: '#fbbf24', marginTop: 4 }}>Antwort: <code>{String(a.responseBody).slice(0, 300)}</code></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'auftraege' && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Aufträge ({visibleAuftraege.length})</h3>
          {visibleAuftraege.length === 0 ? (
            <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Aufträge. Im Preisrechner speichern.</div>
          ) : (
            <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr>
                  <th>Datum</th><th>Auftrag</th><th>Kunde</th><th>Projekt</th><th>Bestell-Nr.</th><th>Pos.</th><th>Gesamt</th>
                  <th>BüroPilot</th><th>WISO</th><th>Aktionen</th>
                </tr></thead>
                <tbody>{visibleAuftraege.map(o => (
                  <tr key={o.id} style={{ background: selectedId === o.id ? 'rgba(229,9,9,.08)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}>
                    <td>{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                    <td>{o.order_id || '—'}</td>
                    <td>{o.customer || '—'}</td>
                    <td>{o.project || '—'}</td>
                    <td>{o.purchase_order || '—'}</td>
                    <td>{(o.rows || []).length}</td>
                    <td>{Number(o.total || 0).toFixed(2)} €</td>
                    <td onClick={e => e.stopPropagation()}>
                      {o.synced_buero_auftrag_id ? (
                        resyncConfirm === o.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#fbbf24' }}>Überschreiben?</span>
                            <button onClick={() => { setResyncConfirm(null); syncBueroAuftrag(o) }} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Ja</button>
                            <button onClick={() => setResyncConfirm(null)} style={{ background: 'transparent', color: '#aeb9c8', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>X</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ {o.synced_buero_auftrag_id}</span>
                            <button onClick={() => setResyncConfirm(o.id)} title="Erneut synchronisieren (überschreibt Auftrag)" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}>🔄</button>
                          </div>
                        )
                      ) : (
                        <button className="pk-btn-ghost" disabled={busy} onClick={() => syncBueroAuftrag(o)} style={{ fontSize: 11 }}>→ BüroPilot</button>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {o.synced_wiso_at
                        ? <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ {new Date(o.synced_wiso_at).toLocaleDateString('de-DE')}</span>
                        : <button className="pk-btn-ghost" disabled={busy || !wisoEnabled} title={wisoEnabled ? undefined : 'WISO-Sync ist durch den Inhaber deaktiviert'} onClick={() => exportWisoAuftrag(o)} style={{ fontSize: 11 }}>{wisoEnabled ? '→ WISO' : '🚫 WISO'}</button>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="pk-btn-ghost" onClick={() => generatePondruffOrderPDF(o as unknown as PondPreisauftrag)} style={{ fontSize: 11 }} title="PDF">PDF</button>
                        <button className="pk-btn-ghost" onClick={() => downloadHtmlReport(o)} style={{ fontSize: 11 }} title="HTML">📄</button>
                        {delConfirm === o.id ? (
                          <>
                            <button onClick={() => del(o.id)} style={{ background: '#e50909', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Ja</button>
                            <button onClick={() => setDelConfirm(null)} style={{ background: 'transparent', color: '#aeb9c8', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>X</button>
                          </>
                        ) : (
                          <button className="pk-btn-ghost" onClick={() => setDelConfirm(o.id)} style={{ fontSize: 11 }}>🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {section === 'wareneingaenge' && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Wareneingänge ({visibleWE.length})</h3>
          {visibleWE.length === 0 ? (
            <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Wareneingänge. Über das Pondruff-Menü → Wareneingang erfassen.</div>
          ) : (
            <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr>
                  <th>Datum</th><th>Bestell-Nr.</th><th>Kunde</th><th>Pos.</th>
                  <th>Lieferbedingungen</th><th>Eingelagert von</th><th>Aktion</th>
                </tr></thead>
                <tbody>{visibleWE.map(w => {
                  const posCount = Array.isArray(w.positionen) ? w.positionen.length : 0
                  const converted = !!(w.ai_data as { converted_to_auftrag_id?: string } | null)?.converted_to_auftrag_id
                  const btnStyle = { background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, padding: '3px 7px', fontSize: 11, cursor: 'pointer', color: '#aeb9c8' }
                  const confirmYes = { background: '#e50909', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }
                  const confirmNo = { background: 'transparent', color: '#aeb9c8', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }
                  return (
                    <>
                      <tr key={w.id}
                        style={{ background: selectedWeId === w.id ? 'rgba(22,132,255,.07)' : undefined, cursor: 'pointer' }}
                        onClick={() => setSelectedWeId(selectedWeId === w.id ? null : w.id)}>
                        <td>{new Date(w.created_at).toLocaleDateString('de-DE')}</td>
                        <td>{w.purchase_order || w.delivery_id || '—'}</td>
                        <td>{w.customer || '—'}</td>
                        <td>{posCount > 0 ? <span style={{ color: '#20c8ff' }}>{posCount}</span> : '—'}</td>
                        <td>{w.lieferbedingungen || '—'}</td>
                        <td>{w.eingelagert_von || w.operator || '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          {weConvertConfirm === w.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#fbbf24' }}>→ AB erstellen?</span>
                              <button onClick={() => weToAuftrag(w)} disabled={busy} style={{ ...confirmYes, background: '#16a34a' }}>Ja</button>
                              <button onClick={() => setWeConvertConfirm(null)} style={confirmNo}>X</button>
                            </div>
                          ) : weArchiveConfirm === w.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#fbbf24' }}>Archivieren?</span>
                              <button onClick={() => archiveWE(w.id)} style={{ ...confirmYes, background: '#f59e0b' }}>Ja</button>
                              <button onClick={() => setWeArchiveConfirm(null)} style={confirmNo}>X</button>
                            </div>
                          ) : weDelConfirm === w.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: '#fbbf24' }}>Löschen?</span>
                              <button onClick={() => delWE(w.id)} style={confirmYes}>Ja</button>
                              <button onClick={() => setWeDelConfirm(null)} style={confirmNo}>X</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button style={{ ...btnStyle, color: converted ? '#4ddb7e' : '#f59e0b', borderColor: converted ? 'rgba(77,219,126,.3)' : 'rgba(245,158,11,.3)' }}
                                onClick={() => setWeConvertConfirm(w.id)}
                                title={converted ? 'Bereits in Auftrag umgewandelt — erneut konvertieren?' : '→ Auftragsbestätigung erstellen (Preis aus Maßen berechnen)'}>
                                {converted ? '✓ AB' : '💶 AB'}
                              </button>
                              <button style={btnStyle} onClick={() => generateArbeitskartePDF(w as unknown as ArbeitskarteData)} title="Arbeitskarte A5 drucken">🖨️</button>
                              <button style={{ ...btnStyle, color: '#f59e0b', borderColor: 'rgba(245,158,11,.3)' }}
                                onClick={() => setWeArchiveConfirm(w.id)} title="Archivieren (aus aktiver Liste entfernen)">📦</button>
                              <button style={{ ...btnStyle, color: '#ff8080', borderColor: 'rgba(255,80,80,.3)' }}
                                onClick={() => setWeDelConfirm(w.id)}>🗑️</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {selectedWeId === w.id && (
                        <tr key={`${w.id}-detail`}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{ padding: '12px 16px', background: 'rgba(22,132,255,.04)', borderTop: '1px solid rgba(22,132,255,.12)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12, fontSize: 12 }}>
                                <div><span style={{ color: '#aeb9c8' }}>Kunde:</span> <b>{w.customer || '—'}</b></div>
                                <div><span style={{ color: '#aeb9c8' }}>Bestell-Nr.:</span> <b>{w.purchase_order || w.delivery_id || '—'}</b></div>
                                <div><span style={{ color: '#aeb9c8' }}>Lieferbedingungen:</span> <b>{w.lieferbedingungen || '—'}</b></div>
                                <div><span style={{ color: '#aeb9c8' }}>Eingelagert am:</span> <b>{w.eingelagert_am ? new Date(w.eingelagert_am).toLocaleDateString('de-DE') : '—'}</b></div>
                                <div><span style={{ color: '#aeb9c8' }}>Eingelagert von:</span> <b>{w.eingelagert_von || w.operator || '—'}</b></div>
                              </div>
                              {posCount > 0 && (
                                <div style={{ overflowX: 'auto' }}>
                                  <table className="pk-table" style={{ width: '100%', fontSize: 11 }}>
                                    <thead>
                                      <tr>
                                        <th>Pos.</th><th>Menge</th><th>Artikel</th><th>Maße</th>
                                        <th>Polieren</th><th>Entschichtung</th><th>Micro</th><th>Läpp</th><th>Polierstr.</th><th>Beschichtung</th><th>Weitere Infos</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(w.positionen as WEPosEntry[]).map((p, pi) => {
                                        const masse = p.form === 'Rund'
                                          ? `Ø${p.durchmesser || '?'} × ${p.durchmesser_laenge || '?'} mm`
                                          : `${p.laenge || '?'} × ${p.breite || '?'} × ${p.hoehe || '?'} mm`
                                        const weitereStr = Array.isArray(p.weitere_infos)
                                          ? p.weitere_infos.map(wi => `${wi.key}: ${wi.value}`).join(', ')
                                          : ''
                                        return (
                                          <tr key={pi}>
                                            <td>{p.position_nr}</td>
                                            <td>{p.menge}</td>
                                            <td>{p.artikelbezeichnung || '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                              {masse}
                                              {p.raw_dimension_text && <div style={{ color: '#fbbf24', fontSize: 10 }}>📝 {p.raw_dimension_text}</div>}
                                            </td>
                                            <td>{p.polieren === 'Ja' ? <span style={{ color: '#4ddb7e' }}>✓{p.polieren_wo ? ` (${p.polieren_wo})` : ''}</span> : '—'}</td>
                                            <td>{p.entschichtung === 'Ja' ? <span style={{ color: '#4ddb7e' }}>✓</span> : '—'}</td>
                                            <td>{p.microstrahlen === 'Ja' ? <span style={{ color: '#4ddb7e' }}>✓</span> : '—'}</td>
                                            <td>{p.laeppstrahlen === 'Ja' ? <span style={{ color: '#4ddb7e' }}>✓</span> : '—'}</td>
                                            <td>{p.polierstrahlen === 'Ja' ? <span style={{ color: '#4ddb7e' }}>✓</span> : '—'}</td>
                                            <td>{p.beschichtung || '—'}</td>
                                            <td style={{ maxWidth: 180, wordBreak: 'break-word' }}>{weitereStr || '—'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {posCount === 0 && (
                                <div style={{ color: '#aeb9c8', fontSize: 12 }}>
                                  {w.note || 'Keine Positionsdaten (alter Wareneingang)'}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="pk-card" style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Auftrag {selected.order_id} · Detail</h3>
          <div className="pk-table-wrap" style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>{['Pos.','Menge','Artikel-Nr.','Beschreibung','Listenpreis','Rabatt %','Einzelpreis','Gesamt'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{(selected.rows || []).map((r, i) => {
                const posArr = Array.isArray(selected.positions) ? selected.positions as Record<string, unknown>[] : []
                const rawDim = typeof posArr[i]?.raw_dimension_text === 'string' ? String(posArr[i].raw_dimension_text) : ''
                return (
                  <tr key={i}>
                    <td>{r['Pos.']}</td><td>{r.Menge}</td><td>{r['Artikel-Nr.']}</td>
                    <td style={{ whiteSpace: 'pre-line' }}>
                      {r.Beschreibung}
                      {rawDim && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#fbbf24' }}>📝 KI las vom Beleg: <b>{rawDim}</b></div>
                      )}
                    </td>
                    <td>{r.Listenpreis}</td><td>{r['Rabatt (%)']}</td><td>{r.Einzelpreis}</td><td>{r.Gesamtpreis}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflowX: 'auto', maxHeight: 240 }}>{wisoOrderTsv(toWiso(selected))}</pre>
        </div>
      )}

    </div>
  )
}
