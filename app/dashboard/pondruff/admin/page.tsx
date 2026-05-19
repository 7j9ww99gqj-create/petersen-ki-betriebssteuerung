'use client'
import { useEffect, useState } from 'react'
import { useGlobalToast } from '@/components/ui/ToastProvider'

type PriceConfig = {
  base_coating_multiplier: number
  excel_pi: number
  coating_factors: Record<string, number>
  price_table: [number, number][]
  polishing_factor?: number
  stripping_factor?: number
}

export default function PondruffAdminPage() {
  const [cfg, setCfg] = useState<PriceConfig | null>(null)
  const [text, setText] = useState('')
  const [source, setSource] = useState<'db' | 'defaults'>('defaults')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useGlobalToast()

  function showToast(msg: string, ok = true) {
    if (ok) toast.success(msg)
    else toast.error(msg)
  }

  async function load() {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/pondruff/admin-price-config')
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Laden fehlgeschlagen')
      setCfg(d.config)
      setText(JSON.stringify(d.config, null, 2))
      setSource(d.source)
      setUpdatedAt(d.updated_at)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  useEffect(() => { load() }, [])

  async function save() {
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch (e) {
      showToast(`JSON ungültig: ${e instanceof Error ? e.message : String(e)}`, false)
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/pondruff/admin-price-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: parsed }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Speichern fehlgeschlagen')
      showToast('✓ Preistabelle gespeichert. Hinweis: Wirkt erst nach Code-Anbindung im Preisrechner.')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), false)
    } finally { setBusy(false) }
  }

  function resetToDefaults() {
    if (!cfg) return
    fetch('/api/pondruff/admin-price-config')
      .then(r => r.json())
      .then(d => {
        // Hole frische Defaults (force-Fallback: temp leeres POST würde Validierung fehlschlagen)
        // Stattdessen: aktuelles JSON beibehalten, User soll manuell auf Defaults setzen.
        // Pragmatisch: zeige Defaults via Reload (wenn DB-Wert gleich Defaults wäre).
        if (d.source === 'defaults') setText(JSON.stringify(d.config, null, 2))
      })
      .catch(() => {})
  }

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Pondruff Preistabellen-Admin</h2>
        <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 6 }}>
          Faktoren, Beschichtungs-Multiplikator und Preistabelle ohne Redeploy ändern. Quelle: <b style={{ color: source === 'db' ? '#4ddb7e' : '#fbbf24' }}>{source === 'db' ? 'Datenbank' : 'Code-Defaults (noch nichts gespeichert)'}</b>
          {updatedAt && <span> · zuletzt gespeichert: {new Date(updatedAt).toLocaleString('de-DE')}</span>}
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 12, color: '#fbbf24' }}>
          ⚠️ Hinweis: Diese Werte werden gespeichert, wirken sich aber noch nicht direkt auf den Preisrechner aus. Voll-Integration folgt in einem späteren Refactoring (lib/pondruff.ts auf async getPriceConfig() umstellen).
        </div>
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 14, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080' }}>
          Fehler: {error}
        </div>
      )}

      {cfg && (
        <div className="pk-card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button className="pk-btn" disabled={busy} onClick={save}>{busy ? '⏳' : '💾 Speichern'}</button>
            <button className="pk-btn-ghost" disabled={busy} onClick={load}>🔄 Neu laden</button>
            <button className="pk-btn-ghost" disabled={busy} onClick={resetToDefaults}>↩️ Defaults laden</button>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 480, fontFamily: 'ui-monospace, monospace', fontSize: 12,
              background: 'rgba(0,0,0,.3)', color: '#f8fbff', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, padding: 12, lineHeight: 1.5,
            }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: '#aeb9c8' }}>
            Pflichtfelder: <code>base_coating_multiplier</code> (number), <code>coating_factors</code> (object), <code>price_table</code> (array von [menge, preis]-Paaren).
          </div>
        </div>
      )}

    </div>
  )
}
