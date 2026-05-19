'use client'

import { useEffect, useState } from 'react'
import { POND_FEATURE_KEYS, POND_FEATURE_LABELS, POND_USER_EMAIL, POND_DEFAULT_FEATURE_FLAGS, type PondruffFeatureFlags, type PondruffFeatureKey } from '@/lib/pondruff'

export function OwnerPondruffFeaturesPanel({
  enabled,
  showToast,
}: {
  enabled: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [flags, setFlags] = useState<PondruffFeatureFlags>({ ...POND_DEFAULT_FEATURE_FLAGS })
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<PondruffFeatureKey | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setLoadError(null)
    fetch('/api/owner/pondruff-flags', { credentials: 'include' })
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data?.error || 'Konnte Flags nicht laden.')
        if (data?.flags) setFlags(data.flags as PondruffFeatureFlags)
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Konnte Flags nicht laden.'))
      .finally(() => setLoading(false))
  }, [enabled])

  const toggle = async (key: PondruffFeatureKey, next: boolean) => {
    setSavingKey(key)
    const previous = flags[key]
    setFlags(prev => ({ ...prev, [key]: next }))
    try {
      const r = await fetch('/api/owner/pondruff-flags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Speichern fehlgeschlagen.')
      if (data?.flags) setFlags(data.flags as PondruffFeatureFlags)
      showToast(next ? `✅ ${POND_FEATURE_LABELS[key]} aktiviert` : `🚫 ${POND_FEATURE_LABELS[key]} deaktiviert`)
    } catch (err) {
      setFlags(prev => ({ ...prev, [key]: previous }))
      showToast(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  if (!enabled) return null

  return (
    <div className="pk-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>🛡️ Pondruff-Funktionen steuern</h3>
          <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>
            Schaltet die KI-Funktionen im Pondruff-Account ({POND_USER_EMAIL}) zentral ein oder aus.
            Deaktivierte Funktionen liefern dort einen klaren Hinweis statt OpenAI-Aufrufen.
          </p>
        </div>
      </div>

      {loadError && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(255,80,80,.10)', border: '1px solid rgba(255,80,80,.30)', color: '#ff8080', fontSize: 13 }}>
          {loadError}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Pondruff-Flags…</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {POND_FEATURE_KEYS.map(key => {
            const active = flags[key]
            const saving = savingKey === key
            return (
              <div
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  border: `1px solid ${active ? 'rgba(16,185,129,.25)' : 'rgba(255,255,255,.08)'}`,
                  background: active ? 'rgba(16,185,129,.04)' : 'rgba(255,255,255,.02)',
                  borderRadius: 12, padding: '12px 14px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{POND_FEATURE_LABELS[key]}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>
                    {active ? 'Funktion ist beim Pondruff-User aktiv.' : 'Funktion ist beim Pondruff-User gesperrt.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={active ? 'badge badge-green' : 'badge badge-gray'}>
                    {active ? 'An' : 'Aus'}
                  </span>
                  <button
                    className={active ? 'pk-btn-ghost' : 'pk-btn'}
                    disabled={saving}
                    onClick={() => toggle(key, !active)}
                    style={{ fontWeight: 800, minWidth: 140 }}
                  >
                    {saving ? '⏳ Speichere…' : active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
