'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [form, setForm] = useState({
    delivery_id: '', customer: '', operator: '', status: 'offen', note: '',
  })
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [files, setFiles] = useState<{ parts?: File; packaging?: File }>({})
  const [ocrBusy, setOcrBusy] = useState(false)
  const [aiData, setAiData] = useState<Record<string, unknown> | null>(null)
  const [aiPositions, setAiPositions] = useState<Record<string, unknown>[]>([])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('pondruff_wareneingaenge').select('*').order('created_at', { ascending: false }).limit(100)
    if (!error && data) setEntries(data as Entry[])
  }
  useEffect(() => { load() }, [])

  async function runOcr() {
    if (!receiptFiles.length) { showToast('Bitte mindestens ein Lieferschein-Bild auswählen', false); return }
    setOcrBusy(true)
    try {
      const images = await Promise.all(receiptFiles.map(f => new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f)
      })))
      // Bei mehreren Bildern: nutzen die Preis-OCR (Multi-File-fähig + Positionen)
      const endpoint = images.length > 1 ? '/api/pondruff/ocr-price' : '/api/pondruff/ocr-lieferschein'
      const body = images.length > 1 ? { images } : { image: images[0] }
      const resp = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'OCR fehlgeschlagen')
      setAiData(data)
      const positions = Array.isArray(data.positions) ? data.positions : []
      setAiPositions(positions)
      setForm(f => ({
        ...f,
        delivery_id: f.delivery_id || String(data.id || data.delivery_id || ''),
        customer: f.customer || String(data.customer || ''),
        note: f.note || String(data.description || data.ocr_note || ''),
      }))
      const detail = positions.length ? `${positions.length} Position(en)` : (data.article_no || '—')
      showToast(`Erkannt: ${data.customer || '—'} · ${detail}`)
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'OCR-Fehler', false)
    } finally { setOcrBusy(false) }
  }

  function openInPriceCalc() {
    // Stellt OCR-Daten in sessionStorage und navigiert zum Preisrechner
    if (typeof window === 'undefined') return
    sessionStorage.setItem('pondruff_prefill', JSON.stringify({
      customer: form.customer,
      delivery_id: form.delivery_id,
      positions: aiPositions,
      ai_data: aiData,
    }))
    router.push('/dashboard/pondruff/preisrechner?prefill=1')
  }

  async function uploadFile(supabase: SupabaseClient, userId: string, folder: string, f: File): Promise<string | null> {
    if (!f) return null
    const ext = f.name.split('.').pop() || 'jpg'
    const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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
      const [receiptPaths, parts_url, packaging_url] = await Promise.all([
        Promise.all(receiptFiles.map(f => uploadFile(supabase, user.id, 'receipt', f))),
        files.parts ? uploadFile(supabase, user.id, 'parts', files.parts) : Promise.resolve(null),
        files.packaging ? uploadFile(supabase, user.id, 'packaging', files.packaging) : Promise.resolve(null),
      ])
      const receipt_url = receiptPaths.filter(Boolean).join('|') || null
      const { data: ins, error } = await supabase.from('pondruff_wareneingaenge').insert({
        user_id: user.id, ...form, receipt_url, parts_url, packaging_url, ai_data: { ...aiData, positions: aiPositions },
      }).select().single()
      if (error) throw error
      // Bauteil-Asset speichern (für KI-Suche) + Embedding generieren
      if (parts_url && ins) {
        const { data: bt } = await supabase.from('pondruff_bauteile').insert({
          user_id: user.id,
          customer: form.customer || null,
          delivery_id: form.delivery_id || null,
          article_no: String((aiData as Record<string, unknown> | null)?.article_no || ''),
          description: String((aiData as Record<string, unknown> | null)?.description || form.note || ''),
          image_url: parts_url,
          wareneingang_id: ins.id,
          note: form.note || null,
        }).select().single()
        if (bt?.id) {
          // Embedding im Hintergrund — Fehler nicht aufhalten lassen
          fetch('/api/pondruff/embed-bauteil', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: bt.id }),
          }).catch(() => {})
        }
      }
      setForm({ delivery_id: '', customer: '', operator: '', status: 'offen', note: '' })
      setReceiptFiles([])
      setFiles({})
      setAiData(null)
      setAiPositions([])
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
          <label><div style={lbl}>Lieferschein-Bild(er) — mehrere möglich</div><input type="file" accept="image/*" multiple onChange={e => setReceiptFiles(Array.from(e.target.files || []))} /></label>
          <label><div style={lbl}>Bauteile-Bild</div><input type="file" accept="image/*" onChange={e => setFiles(f => ({ ...f, parts: e.target.files?.[0] }))} /></label>
          <label><div style={lbl}>Verpackung-Bild</div><input type="file" accept="image/*" onChange={e => setFiles(f => ({ ...f, packaging: e.target.files?.[0] }))} /></label>
        </div>
        {receiptFiles.length > 0 && <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 6 }}>{receiptFiles.length} Lieferschein-Bild(er) ausgewählt</div>}

        <div style={{ display: 'grid', gridTemplateColumns: aiPositions.length ? '1fr 1fr' : '1fr', gap: 10, marginTop: 10 }}>
          <button className="pk-btn-ghost" disabled={ocrBusy || !receiptFiles.length} onClick={runOcr} style={{ width: '100%' }}>
            {ocrBusy ? '⏳ GPT-4 liest…' : `🤖 GPT-4 Lieferschein auslesen${receiptFiles.length > 1 ? ' (mehrere)' : ''}`}
          </button>
          {aiPositions.length > 0 && (
            <button className="pk-btn" onClick={openInPriceCalc} style={{ width: '100%', background: 'linear-gradient(180deg,#e50909,#b80000)', border: '1px solid rgba(229,9,9,.6)' }}>
              💶 In Preisrechner öffnen ({aiPositions.length} Pos.)
            </button>
          )}
        </div>
        {aiData && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.25)', fontSize: 11 }}>
            <b>KI-Erkennung:</b> Kunde <b>{String(aiData.customer || '—')}</b>
            {aiPositions.length > 0
              ? <> · {aiPositions.length} Positionen erkannt</>
              : <> · Artikel-Nr. {String(aiData.article_no || '—')}{aiData.description ? ' · ' + String(aiData.description) : ''}</>}
            {aiData.ocr_note ? <div style={{ marginTop: 4, color: '#aeb9c8' }}>ℹ️ {String(aiData.ocr_note)}</div> : null}
          </div>
        )}

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
