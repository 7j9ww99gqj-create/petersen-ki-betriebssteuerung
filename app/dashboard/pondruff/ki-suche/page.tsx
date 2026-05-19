'use client'
import { useState } from 'react'
import { compressImageDataUrl } from '@/lib/pondruff'
import { usePondruffFlags } from '@/components/pondruff/usePondruffFlags'

type Match = {
  index: number
  score: number
  reason: string
  bauteil: {
    id: string
    customer: string | null
    delivery_id: string | null
    description: string | null
    signed: string
  }
}

export default function KiSuchePage() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [backfillBusy, setBackfillBusy] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [note, setNote] = useState('')
  const [queryDesc, setQueryDesc] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const { flags: pondFlags } = usePondruffFlags()
  const kiEnabled = pondFlags.ki_bauteilsuche

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  async function runBackfill() {
    setBackfillBusy(true)
    try {
      let total = 0
      // Bis zu 5 Runden à 10 Bauteile
      for (let i = 0; i < 5; i++) {
        const r = await fetch('/api/pondruff/embed-backfill', { method: 'POST' })
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error || 'Backfill-Fehler')
        total += d.processed || 0
        if (!d.remaining) break
      }
      showToast(`Backfill fertig: ${total} Bauteile`)
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'Backfill-Fehler', false)
    } finally { setBackfillBusy(false) }
  }

  async function run() {
    if (!file) { showToast('Bitte Foto auswählen', false); return }
    setBusy(true); setMatches([]); setNote('')
    try {
      const image = await compressImageDataUrl(file)
      const resp = await fetch('/api/pondruff/bauteil-suche', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Fehler')
      setMatches(data.matches || [])
      setNote(data.note || (data.fallback ? 'Live-Vergleich (Embeddings noch nicht generiert)' : ''))
      setQueryDesc(data.query_description || '')
      showToast(`${(data.matches || []).length} Treffer`)
    } catch (e) {
      showToast((e instanceof Error ? e.message : String(e)) || 'KI-Fehler', false)
    } finally { setBusy(false) }
  }

  const lbl: React.CSSProperties = { fontSize: 11, color: '#aeb9c8', marginBottom: 4 }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>🤖 Bauteil-KI Bildersuche</h3>
        <div style={{ color: '#aeb9c8', fontSize: 12, marginBottom: 10 }}>
          Foto vom unbekannten Bauteil hochladen — die KI vergleicht mit allen gespeicherten Bauteilen aus Wareneingängen.
        </div>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={lbl}>Such-Foto</div>
          <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
        <button className="pk-btn" disabled={busy || !file || !kiEnabled} onClick={run} style={{ width: '100%' }}>
          {busy ? '⏳ KI vergleicht…' : kiEnabled ? '🔍 Bauteil suchen' : '🚫 Funktion deaktiviert'}
        </button>
        <button className="pk-btn-ghost" disabled={backfillBusy || !kiEnabled} onClick={runBackfill} style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
          {backfillBusy ? '⏳ Backfill läuft…' : '⚙️ Embeddings für alte Bauteile nachgenerieren'}
        </button>
        {!kiEnabled && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: 8 }}>
            ℹ️ KI-Bauteilsuche ist aktuell durch den Inhaber deaktiviert.
          </div>
        )}
      </div>

      {(note || queryDesc) && <div className="pk-card" style={{ marginBottom: 14, color: '#aeb9c8', fontSize: 13 }}>
        {queryDesc && <div style={{ marginBottom: note ? 6 : 0 }}><b>KI-Beschreibung:</b> {queryDesc}</div>}
        {note && <div>ℹ️ {note}</div>}
      </div>}

      {matches.length > 0 && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Treffer ({matches.length})</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {matches.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(229,9,9,.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.bauteil.signed} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{m.bauteil.customer || '—'}</div>
                    <div style={{ padding: '2px 10px', borderRadius: 999, background: m.score >= 70 ? 'rgba(37,211,102,.2)' : m.score >= 50 ? 'rgba(245,158,11,.2)' : 'rgba(170,170,170,.15)', color: m.score >= 70 ? '#4ddb7e' : m.score >= 50 ? '#f59e0b' : '#aeb9c8', fontSize: 12, fontWeight: 800 }}>
                      {m.score}% Match
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#aeb9c8' }}>
                    Lieferschein: {m.bauteil.delivery_id || '—'}
                  </div>
                  {m.bauteil.description && <div style={{ fontSize: 12, marginTop: 4 }}>{m.bauteil.description}</div>}
                  <div style={{ fontSize: 11, color: '#7f8da3', marginTop: 4, fontStyle: 'italic' }}>{m.reason}</div>
                </div>
              </div>
            ))}
          </div>
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
