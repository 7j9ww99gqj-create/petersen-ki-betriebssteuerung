'use client'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { wisoClipboardPlainTsv, wisoClipboardTsv, wisoOrderTsv, type WisoOrder, type WisoOrderRow } from '@/lib/pondruff'

type Status = 'preisauftrag' | 'auftragsbestaetigung' | 'rechnung'

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
  status: Status | null
  parent_id: string | null
  confirmed_at: string | null
  invoice_no: string | null
  invoice_date: string | null
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
  receipt_url: string | null
  parts_url: string | null
  packaging_url: string | null
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

const TABS: { key: Status; label: string; icon: string; color: string }[] = [
  { key: 'preisauftrag', label: 'Preisaufträge', icon: '💶', color: '#1684ff' },
  { key: 'auftragsbestaetigung', label: 'Auftragsbestätigungen', icon: '📋', color: '#f59e0b' },
  { key: 'rechnung', label: 'Rechnungen', icon: '🧾', color: '#10b981' },
]

export default function BueroWisoPage() {
  const [section, setSection] = useState<Section>('auftraege')
  const [orders, setOrders] = useState<Saved[]>([])
  const [wareneingaenge, setWareneingaenge] = useState<SavedWE[]>([])
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<Status>('preisauftrag')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  async function load() {
    const supabase = createSupabaseClient()
    const [o, we] = await Promise.all([
      supabase.from('pondruff_preisauftraege').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('pondruff_wareneingaenge').select('*').order('created_at', { ascending: false }).limit(500),
    ])
    if (!o.error && o.data) setOrders(o.data as Saved[])
    if (!we.error && we.data) setWareneingaenge(we.data as SavedWE[])
  }
  useEffect(() => { load() }, [])

  async function syncToBueroAuftrag(o: Saved) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/sync-buero-auftrag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Sync fehlgeschlagen')
      showToast(`→ BüroPilot Auftrag ${data.buero_auftrag_id} erstellt`)
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function syncToBueroWareneingang(w: SavedWE) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/sync-buero-wareneingang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Sync fehlgeschlagen')
      showToast(`→ BüroPilot Dokument ${data.buero_dokument_id} erstellt`)
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function exportToWiso(o: Saved) {
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/wiso-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'WISO-Export fehlgeschlagen')
      showToast('✓ An WISO MeinBüro übergeben')
      load()
    } catch (e) { showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false) }
    finally { setBusy(false) }
  }

  async function delWE(id: string) {
    const sb = createSupabaseClient()
    await sb.from('pondruff_wareneingaenge').delete().eq('id', id)
    showToast('Gelöscht'); load()
  }

  const visible = useMemo(() => {
    const q = filter.toLowerCase().trim()
    const inTab = orders.filter(o => (o.status || 'preisauftrag') === tab)
    if (!q) return inTab
    return inTab.filter(o => [o.customer, o.project, o.purchase_order, o.order_id, o.invoice_no].some(x => (x || '').toLowerCase().includes(q)))
  }, [orders, filter, tab])

  const counts = useMemo(() => ({
    preisauftrag: orders.filter(o => (o.status || 'preisauftrag') === 'preisauftrag').length,
    auftragsbestaetigung: orders.filter(o => o.status === 'auftragsbestaetigung').length,
    rechnung: orders.filter(o => o.status === 'rechnung').length,
  }), [orders])

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

  function downloadHtmlReport(o: Saved) {
    const order = toWiso(o)
    const label = o.status === 'rechnung' ? `Rechnung ${o.invoice_no || ''}` : o.status === 'auftragsbestaetigung' ? `Auftragsbestätigung ${o.order_id || ''}` : `Preisauftrag ${o.order_id || ''}`
    const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const net = order.total
    const vat = Math.round(net * 19) / 100
    const gross = Math.round((net + vat) * 100) / 100
    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(label)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#222;max-width:900px;margin:30px auto;padding:0 20px}
  h1{color:#b80000;margin-bottom:0}
  .meta{color:#666;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
  th{background:#f5f5f5}
  .totals{margin-top:14px;font-size:14px}
  .totals .row{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{font-weight:700;border-top:2px solid #b80000;padding-top:8px;margin-top:6px;color:#b80000}
  .footer{margin-top:30px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px}
</style></head><body>
<h1>${escapeHtml(label)}</h1>
<div class="meta">
  Kunde: <b>${escapeHtml(order.customer)}</b><br>
  Projekt: ${escapeHtml(order.project)}<br>
  ${order.purchase_order ? 'Bestell-Nr.: ' + escapeHtml(order.purchase_order) + '<br>' : ''}
  ${o.invoice_date ? 'Rechnungsdatum: ' + new Date(o.invoice_date).toLocaleDateString('de-DE') + '<br>' : ''}
  Erstellt: ${order.created_at}
</div>
<table><thead><tr>
  <th>Pos.</th><th>Menge</th><th>Artikel-Nr.</th><th>Beschreibung</th>
  <th>Listenpreis</th><th>Rabatt %</th><th>Einzelpreis</th><th>Gesamt</th>
</tr></thead><tbody>
${order.rows.map(r => `<tr>
  <td>${escapeHtml(r['Pos.'])}</td><td>${r.Menge}</td><td>${escapeHtml(r['Artikel-Nr.'])}</td>
  <td>${escapeHtml(r.Beschreibung).replace(/\n/g, '<br>')}</td>
  <td>${escapeHtml(r.Listenpreis)} €</td><td>${escapeHtml(r['Rabatt (%)'])}</td>
  <td>${escapeHtml(r.Einzelpreis)} €</td><td>${escapeHtml(r.Gesamtpreis)} €</td>
</tr>`).join('')}
</tbody></table>
<div class="totals">
  <div class="row"><span>Netto</span><span>${net.toFixed(2)} €</span></div>
  <div class="row"><span>MwSt. 19%</span><span>${vat.toFixed(2)} €</span></div>
  <div class="row grand"><span>Brutto</span><span>${gross.toFixed(2)} €</span></div>
</div>
<div class="footer">Pondruff Polier-Service · erzeugt mit Petersen KI Betriebssteuerung · ${new Date().toLocaleString('de-DE')}</div>
</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${label.replace(/[^a-zA-Z0-9-_]/g, '_')}.html`
    a.click(); URL.revokeObjectURL(a.href)
  }

  function downloadAllCsv() {
    if (!visible.length) return
    const headers = ['Status','Auftrag','Rechnung-Nr.','Datum','Kunde','Projekt','Bestell-Nr.','Pos.','Menge','Artikel-Nr.','Beschreibung','Listenpreis','Rabatt %','Einzelpreis','Gesamtpreis']
    const lines = [headers.join('\t')]
    for (const o of visible) {
      const order = toWiso(o)
      for (const r of order.rows) {
        const desc = String(r.Beschreibung).replace(/\r\n|\n/g, ' / ')
        lines.push([o.status || 'preisauftrag', order.id, o.invoice_no || '', order.created_at, order.customer, order.project, order.purchase_order, r['Pos.'], r.Menge, r['Artikel-Nr.'], desc, r.Listenpreis, r['Rabatt (%)'], r.Einzelpreis, r.Gesamtpreis].join('\t'))
      }
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `pondruff-${tab}.tsv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  async function del(id: string) {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('pondruff_preisauftraege').delete().eq('id', id)
    if (error) showToast(error.message, false)
    else { showToast('Gelöscht'); load() }
    setDelConfirm(null)
  }

  async function confirmOrder(o: Saved) {
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.from('pondruff_preisauftraege')
        .update({ status: 'auftragsbestaetigung', confirmed_at: new Date().toISOString() })
        .eq('id', o.id)
      if (error) throw error
      showToast('Zu Auftragsbestätigung gewandelt')
      load()
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false)
    } finally { setBusy(false) }
  }

  async function makeInvoice(o: Saved) {
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')
      const year = new Date().getFullYear()
      // Naechste Rechnungs-Nr. via Zaehler aus bestehenden Rechnungen
      const { data: existing } = await supabase.from('pondruff_preisauftraege')
        .select('invoice_no').eq('user_id', user.id).eq('status', 'rechnung').not('invoice_no', 'is', null)
      let max = 0
      ;(existing || []).forEach((row: { invoice_no: string | null }) => {
        const m = String(row.invoice_no || '').match(/-(\d+)$/)
        if (m) max = Math.max(max, parseInt(m[1], 10))
      })
      const next = String(max + 1).padStart(4, '0')
      const invoiceNo = `RE-${year}-${next}`
      const { error } = await supabase.from('pondruff_preisauftraege')
        .update({ status: 'rechnung', invoice_no: invoiceNo, invoice_date: new Date().toISOString().slice(0, 10) })
        .eq('id', o.id)
      if (error) throw error
      showToast(`Rechnung ${invoiceNo} erstellt`)
      load()
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false)
    } finally { setBusy(false) }
  }

  async function revertStatus(o: Saved) {
    const back: Status = o.status === 'rechnung' ? 'auftragsbestaetigung' : 'preisauftrag'
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const upd: Record<string, unknown> = { status: back, invoice_no: null, invoice_date: null }
      const { error } = await supabase.from('pondruff_preisauftraege').update(upd).eq('id', o.id)
      if (error) throw error
      showToast(`Zurückgesetzt auf ${back}`)
      load()
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false)
    } finally { setBusy(false) }
  }

  const visibleWE = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return wareneingaenge
    return wareneingaenge.filter(w => [w.delivery_id, w.customer, w.note, w.operator].some(x => (x || '').toLowerCase().includes(q)))
  }, [wareneingaenge, filter])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['auftraege', 'wareneingaenge'] as const).map(s => (
          <button key={s} onClick={() => { setSection(s); setSelectedId(null) }}
            style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14,
              border: `1px solid ${section === s ? 'rgba(229,9,9,.6)' : 'rgba(255,255,255,.08)'}`,
              background: section === s ? 'linear-gradient(180deg,#e50909,#b80000)' : 'rgba(255,255,255,.03)',
              color: section === s ? '#fff' : '#aeb9c8',
            }}>
            {s === 'auftraege' ? `💶 Aufträge (${orders.length})` : `📥 Wareneingänge (${wareneingaenge.length})`}
          </button>
        ))}
      </div>

      <div className="pk-card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Suche Kunde / Projekt / Rechnung-Nr." value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        {section === 'auftraege' && <button className="pk-btn-ghost" onClick={downloadAllCsv} disabled={!visible.length}>⬇️ TSV-Export</button>}
        <button className="pk-btn-ghost" onClick={load}>🔄 Neu laden</button>
      </div>

      {section === 'wareneingaenge' && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Wareneingänge ({visibleWE.length})</h3>
          {visibleWE.length === 0 ? (
            <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Wareneingänge. Über das Pondruff-Menü → Wareneingang erfassen.</div>
          ) : (
            <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
                <thead><tr><th>Datum</th><th>Lieferschein</th><th>Kunde</th><th>Status</th><th>Notiz</th><th>BüroPilot</th><th>Aktion</th></tr></thead>
                <tbody>{visibleWE.map(w => (
                  <tr key={w.id}>
                    <td>{new Date(w.created_at).toLocaleDateString('de-DE')}</td>
                    <td>{w.delivery_id || '—'}</td>
                    <td>{w.customer || '—'}</td>
                    <td>{w.status || 'offen'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.note || ''}</td>
                    <td>
                      {w.synced_buero_dokument_id
                        ? <span style={{ color: '#4ddb7e', fontSize: 11 }}>✓ {w.synced_buero_dokument_id}</span>
                        : <span style={{ color: '#7f8da3', fontSize: 11 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!w.synced_buero_dokument_id && (
                          <button className="pk-btn-ghost" disabled={busy} onClick={() => syncToBueroWareneingang(w)} style={{ fontSize: 11 }} title="In BüroPilot übernehmen">→ Petersen KI</button>
                        )}
                        <button className="pk-btn-ghost" onClick={() => delWE(w.id)} style={{ fontSize: 11 }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {section === 'auftraege' && <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedId(null) }}
            style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1px solid ${tab === t.key ? t.color + '70' : 'rgba(255,255,255,.08)'}`,
              background: tab === t.key ? t.color + '20' : 'rgba(255,255,255,.03)',
              color: tab === t.key ? t.color : '#aeb9c8',
            }}>
            {t.icon} {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="pk-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
          {TABS.find(x => x.key === tab)?.label} ({visible.length})
        </h3>
        {visible.length === 0 ? (
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>
            {tab === 'preisauftrag' && 'Keine Preisaufträge. Im Preisrechner speichern.'}
            {tab === 'auftragsbestaetigung' && 'Keine Auftragsbestätigungen. Im Preisrechner "Auftragsbestätigung erstellen" oder hier aus einem Preisauftrag wandeln.'}
            {tab === 'rechnung' && 'Keine Rechnungen. In einer Auftragsbestätigung "In Rechnung wandeln" klicken.'}
          </div>
        ) : (
          <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr>
                <th>Datum</th>
                {tab === 'rechnung' ? <th>Rechnung-Nr.</th> : <th>Auftrag</th>}
                <th>Kunde</th><th>Projekt</th><th>Bestell-Nr.</th><th>Pos.</th><th>Gesamt</th><th>Aktionen</th>
              </tr></thead>
              <tbody>{visible.map(o => (
                <tr key={o.id} style={{ background: selectedId === o.id ? 'rgba(22,132,255,.08)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}>
                  <td>{new Date(o.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{tab === 'rechnung' ? (o.invoice_no || '—') : (o.order_id || '—')}</td>
                  <td>{o.customer || '—'}</td>
                  <td>{o.project || '—'}</td>
                  <td>{o.purchase_order || '—'}</td>
                  <td>{(o.rows || []).length}</td>
                  <td>{Number(o.total || 0).toFixed(2)} €</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {tab === 'preisauftrag' && (
                        <button className="pk-btn-ghost" disabled={busy} onClick={() => confirmOrder(o)} style={{ fontSize: 11 }} title="Zu Auftragsbestätigung">📋 Auftrag</button>
                      )}
                      {tab === 'auftragsbestaetigung' && (
                        <button className="pk-btn-ghost" disabled={busy} onClick={() => makeInvoice(o)} style={{ fontSize: 11 }} title="In Rechnung wandeln">🧾 Rechnung</button>
                      )}
                      {(tab === 'auftragsbestaetigung' || tab === 'rechnung') && (
                        <button className="pk-btn-ghost" disabled={busy} onClick={() => revertStatus(o)} style={{ fontSize: 11 }} title="Zurück setzen">↩️</button>
                      )}
                      <button className="pk-btn-ghost" onClick={() => copyWiso(o)} style={{ fontSize: 11 }} title="WISO Copy">📋</button>
                      <button className="pk-btn-ghost" onClick={() => downloadCsv(o)} style={{ fontSize: 11 }} title="TSV">⬇️</button>
                      <button className="pk-btn-ghost" onClick={() => downloadHtmlReport(o)} style={{ fontSize: 11 }} title="HTML Bericht">📄</button>
                      {o.synced_buero_auftrag_id
                        ? <span style={{ fontSize: 11, color: '#4ddb7e', alignSelf: 'center' }}>✓ KI</span>
                        : <button className="pk-btn-ghost" disabled={busy} onClick={() => syncToBueroAuftrag(o)} style={{ fontSize: 11 }} title="In BüroPilot übernehmen">→ Petersen KI</button>}
                      {o.synced_wiso_at
                        ? <span style={{ fontSize: 11, color: '#4ddb7e', alignSelf: 'center' }}>✓ WISO</span>
                        : <button className="pk-btn-ghost" disabled={busy} onClick={() => exportToWiso(o)} style={{ fontSize: 11 }} title="An WISO MeinBüro übergeben">→ WISO API</button>}
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
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
            {selected.status === 'rechnung' ? `Rechnung ${selected.invoice_no}` : selected.status === 'auftragsbestaetigung' ? `Auftragsbestätigung ${selected.order_id}` : `Preisauftrag ${selected.order_id}`}
          </h3>
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
      </>}

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
