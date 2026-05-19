'use client'
import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

type Entry = {
  id: string
  created_at: string
  delivery_id: string | null
  customer: string | null
  operator: string | null
  status: string | null
  receipt_url: string | null
  parts_url: string | null
  packaging_url: string | null
  note: string | null
}

const STATUS = ['offen', 'in Bearbeitung', 'fertig']

export default function WareneingangPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [form, setForm] = useState({
    delivery_id: '', customer: '', operator: '', status: 'offen', note: '',
  })
  const [files, setFiles] = useState<{ receipt?: File; parts?: File; packaging?: File }>({})

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('pondruff_wareneingaenge').select('*').order('created_at', { ascending: false }).limit(100)
    if (!error && data) setEntries(data as Entry[])
  }
  useEffect(() => { load() }, [])

  async function upload(supabase: SupabaseClient, userId: string, key: 'receipt' | 'parts' | 'packaging'): Promise<string | null> {
    const f = files[key]
    if (!f) return null
    const ext = f.name.split('.').pop() || 'jpg'
    const path = `${userId}/${key}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('pondruff').upload(path, f, { upsert: false })
    if (error) throw error
    return path
  }

  async function save() {
    if (!form.delivery_id.trim() && !form.customer.trim()) {
      showToast('Lieferschein-ID oder Kunde nötig', false); return
    }
    setBusy(true)
    try {
      const supabase = createSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')
      const [receipt_url, parts_url, packaging_url] = await Promise.all([
        upload(supabase, user.id, 'receipt'),
        upload(supabase, user.id, 'parts'),
        upload(supabase, user.id, 'packaging'),
      ])
      const { error } = await supabase.from('pondruff_wareneingaenge').insert({
        user_id: user.id, ...form, receipt_url, parts_url, packaging_url,
      })
      if (error) throw error
      setForm({ delivery_id: '', customer: '', operator: '', status: 'offen', note: '' })
      setFiles({})
      showToast('Wareneingang gespeichert')
      load()
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Fehler', false)
    } finally { setBusy(false) }
  }

  async function del(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const supabase = createSupabaseClient()
    await supabase.from('pondruff_wareneingaenge').delete().eq('id', id)
    load()
  }

  const lbl: React.CSSProperties = { fontSize: 11, color: '#aeb9c8', marginBottom: 4 }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Neuer Wareneingang</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <label><div style={lbl}>Lieferschein-ID</div><input className="pk-input" value={form.delivery_id} onChange={e => setForm({ ...form, delivery_id: e.target.value })} /></label>
          <label><div style={lbl}>Kunde</div><input className="pk-input" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></label>
          <label><div style={lbl}>Bediener</div><input className="pk-input" value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })} /></label>
          <label><div style={lbl}>Status</div>
            <select className="pk-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
          <label><div style={lbl}>Lieferschein-Bild</div><input type="file" accept="image/*" onChange={e => setFiles(f => ({ ...f, receipt: e.target.files?.[0] }))} /></label>
          <label><div style={lbl}>Bauteile-Bild</div><input type="file" accept="image/*" onChange={e => setFiles(f => ({ ...f, parts: e.target.files?.[0] }))} /></label>
          <label><div style={lbl}>Verpackung-Bild</div><input type="file" accept="image/*" onChange={e => setFiles(f => ({ ...f, packaging: e.target.files?.[0] }))} /></label>
        </div>

        <label style={{ display: 'block', marginTop: 10 }}>
          <div style={lbl}>Notiz</div>
          <textarea className="pk-input" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        </label>

        <button className="pk-btn" disabled={busy} onClick={save} style={{ marginTop: 10, width: '100%' }}>
          {busy ? '⏳ Speichere…' : '💾 Speichern'}
        </button>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Gespeicherte Wareneingänge ({entries.length})</h3>
        {entries.length === 0 ? (
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Wareneingänge.</div>
        ) : (
          <div className="pk-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th>Datum</th><th>Lieferschein</th><th>Kunde</th><th>Bediener</th><th>Status</th><th>Notiz</th><th></th></tr></thead>
              <tbody>{entries.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{e.delivery_id || '—'}</td>
                  <td>{e.customer || '—'}</td>
                  <td>{e.operator || '—'}</td>
                  <td>{e.status || '—'}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note || ''}</td>
                  <td><button className="pk-btn-ghost" onClick={() => del(e.id)} style={{ fontSize: 11 }}>🗑️</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

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
