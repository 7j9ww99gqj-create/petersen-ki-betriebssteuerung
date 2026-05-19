'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { wisoOrderTsv, type WisoOrder, type WisoOrderRow } from '@/lib/pondruff'
import { generatePondruffOrderPDF, type PondPreisauftrag } from '@/lib/pondruff-pdf'
import { usePondruffFlags } from '@/components/pondruff/usePondruffFlags'

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

type SavedWE = {
  id: string
  created_at: string
  delivery_id: string | null
  customer: string | null
  operator: string | null
  status: string | null
  note: string | null
  ai_data: Record<string, unknown> | null
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { flags: pondFlags } = usePondruffFlags()
  const wisoEnabled = pondFlags.wiso_sync

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500) }

  async function load() {
    const sb = createSupabaseClient()
    const [o, we] = await Promise.all([
      sb.from('pondruff_preisauftraege').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('pondruff_wareneingaenge').select('*').order('created_at', { ascending: false }).limit(500),
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
    await sb.from('pondruff_wareneingaenge').delete().eq('id', id)
    showToast('Gelöscht'); load()
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
      </div>

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
                      {o.synced_buero_auftrag_id
                        ? <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ {o.synced_buero_auftrag_id}</span>
                        : <button className="pk-btn-ghost" disabled={busy} onClick={() => syncBueroAuftrag(o)} style={{ fontSize: 11 }}>→ BüroPilot</button>}
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
                  <th>Datum</th><th>Lieferschein</th><th>Kunde</th><th>Status</th><th>Notiz</th>
                  <th>BüroPilot</th><th>WISO</th><th>Aktion</th>
                </tr></thead>
                <tbody>{visibleWE.map(w => {
                  const wisoSynced = !!(w.ai_data as { wiso?: { synced_at?: string } } | null)?.wiso?.synced_at
                  return (
                    <tr key={w.id}>
                      <td>{new Date(w.created_at).toLocaleDateString('de-DE')}</td>
                      <td>{w.delivery_id || '—'}</td>
                      <td>{w.customer || '—'}</td>
                      <td>{w.status || 'offen'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.note || ''}</td>
                      <td>
                        {w.synced_buero_dokument_id
                          ? <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ {w.synced_buero_dokument_id}</span>
                          : <button className="pk-btn-ghost" disabled={busy} onClick={() => syncBueroWE(w)} style={{ fontSize: 11 }}>→ BüroPilot</button>}
                      </td>
                      <td>
                        {wisoSynced
                          ? <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ WISO</span>
                          : <button className="pk-btn-ghost" disabled={busy || !wisoEnabled} title={wisoEnabled ? undefined : 'WISO-Sync ist durch den Inhaber deaktiviert'} onClick={() => exportWisoWE(w)} style={{ fontSize: 11 }}>{wisoEnabled ? '→ WISO' : '🚫 WISO'}</button>}
                      </td>
                      <td>
                        <button className="pk-btn-ghost" onClick={() => delWE(w.id)} style={{ fontSize: 11 }}>🗑️</button>
                      </td>
                    </tr>
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
              <tbody>{(selected.rows || []).map((r, i) => (
                <tr key={i}>
                  <td>{r['Pos.']}</td><td>{r.Menge}</td><td>{r['Artikel-Nr.']}</td>
                  <td style={{ whiteSpace: 'pre-line' }}>{r.Beschreibung}</td>
                  <td>{r.Listenpreis}</td><td>{r['Rabatt (%)']}</td><td>{r.Einzelpreis}</td><td>{r.Gesamtpreis}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflowX: 'auto', maxHeight: 240 }}>{wisoOrderTsv(toWiso(selected))}</pre>
        </div>
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
