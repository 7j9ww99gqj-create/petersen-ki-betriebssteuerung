'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { wisoClipboardPlainTsv, wisoClipboardTsv, wisoOrderTsv, type WisoOrder, type WisoOrderRow } from '@/lib/pondruff'

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
}

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
  const [orders, setOrders] = useState<Saved[]>([])
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [delConfirm, setDelConfirm] = useState<string | null>(null)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  async function load() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('pondruff_preisauftraege').select('*').order('created_at', { ascending: false }).limit(200)
    if (!error && data) setOrders(data as Saved[])
  }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return orders
    return orders.filter(o => [o.customer, o.project, o.purchase_order, o.order_id].some(x => (x || '').toLowerCase().includes(q)))
  }, [orders, filter])

  const selected = orders.find(o => o.id === selectedId)

  async function copyWiso(o: Saved) {
    const order = toWiso(o)
    const tsv = wisoClipboardTsv(order)
    const plain = wisoClipboardPlainTsv(order)
    try {
      if (typeof window !== 'undefined' && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        })])
      } else {
        await navigator.clipboard.writeText(plain)
      }
      showToast('WISO-Daten kopiert')
    } catch {
      await navigator.clipboard.writeText(plain).catch(() => showToast('Kopieren fehlgeschlagen', false))
    }
  }

  function downloadCsv(o: Saved) {
    const order = toWiso(o)
    const tsv = wisoOrderTsv(order)
    const blob = new Blob(['﻿' + tsv], { type: 'text/tab-separated-values;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${order.id}.tsv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  function downloadAllCsv() {
    if (!visible.length) return
    const headers = ['Auftrag','Datum','Kunde','Projekt','Bestell-Nr.','Pos.','Menge','Artikel-Nr.','Beschreibung','Listenpreis','Rabatt %','Einzelpreis','Gesamtpreis']
    const lines = [headers.join('\t')]
    for (const o of visible) {
      const order = toWiso(o)
      for (const r of order.rows) {
        const desc = String(r.Beschreibung).replace(/\r\n|\n/g, ' / ')
        lines.push([order.id, order.created_at, order.customer, order.project, order.purchase_order, r['Pos.'], r.Menge, r['Artikel-Nr.'], desc, r.Listenpreis, r['Rabatt (%)'], r.Einzelpreis, r.Gesamtpreis].join('\t'))
      }
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `pondruff-auftraege.tsv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  async function del(id: string) {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('pondruff_preisauftraege').delete().eq('id', id)
    if (error) showToast(error.message, false)
    else { showToast('Gelöscht'); load() }
    setDelConfirm(null)
  }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Suche Kunde / Projekt / Bestell-Nr." value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <button className="pk-btn-ghost" onClick={downloadAllCsv} disabled={!visible.length}>⬇️ Alle als TSV</button>
        <button className="pk-btn-ghost" onClick={load}>🔄 Neu laden</button>
      </div>

      <div className="pk-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Preisaufträge ({visible.length})</h3>
        {visible.length === 0 ? (
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Aufträge. Im Preisrechner einen Auftrag speichern.</div>
        ) : (
          <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th>Datum</th><th>Auftrag</th><th>Kunde</th><th>Projekt</th><th>Bestell-Nr.</th><th>Pos.</th><th>Gesamt</th><th></th></tr></thead>
              <tbody>{visible.map(o => (
                <tr key={o.id} style={{ background: selectedId === o.id ? 'rgba(22,132,255,.08)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}>
                  <td>{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{o.order_id || '—'}</td>
                  <td>{o.customer || '—'}</td>
                  <td>{o.project || '—'}</td>
                  <td>{o.purchase_order || '—'}</td>
                  <td>{(o.rows || []).length}</td>
                  <td>{Number(o.total || 0).toFixed(2)} €</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="pk-btn-ghost" onClick={() => copyWiso(o)} style={{ fontSize: 11 }} title="WISO Copy">📋</button>
                      <button className="pk-btn-ghost" onClick={() => downloadCsv(o)} style={{ fontSize: 11 }} title="TSV">⬇️</button>
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

      {selected && (
        <div className="pk-card">
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
