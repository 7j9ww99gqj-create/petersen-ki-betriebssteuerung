'use client'

import { useCallback, useEffect, useState } from 'react'

type AuditEntry = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_email: string | null
  action: string
  target_user_id: string | null
  target_email: string | null
  details: Record<string, unknown>
}

const ACTION_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  'customer.unlock':        { label: 'Software freigeschaltet',   color: '#4ddb7e', emoji: '🔓' },
  'customer.suspend':       { label: 'Software gesperrt',          color: '#f43f5e', emoji: '🔒' },
  'customer.status_change': { label: 'Buchungsstatus geändert',    color: '#1684ff', emoji: '🔄' },
  'pondruff_flag.toggle':   { label: 'Pondruff-Feature-Flag',      color: '#a78bfa', emoji: '🚩' },
  'invoice.create':         { label: 'Rechnung erstellt',          color: '#fbbf24', emoji: '🧾' },
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function summarizeDetails(action: string, details: Record<string, unknown>): string {
  if (!details || typeof details !== 'object') return ''
  if (action === 'pondruff_flag.toggle') {
    return `${String(details.flag ?? '')}: ${String(details.previousValue)} → ${String(details.newValue)}`
  }
  if (action === 'customer.unlock' || action === 'customer.suspend') {
    return `Status ${String(details.previousStatus ?? '?')} → ${String(details.status ?? '?')}`
  }
  if (action === 'customer.status_change') {
    return `${String(details.previousStatus ?? '?')} → ${String(details.status ?? '?')}`
  }
  if (action === 'invoice.create') {
    const num = details.invoiceNumber ?? details.invoiceId
    const amount = typeof details.grossAmount === 'number' ? `${(details.grossAmount as number).toFixed(2)} €` : ''
    return [num ? `Rechnung ${num}` : '', amount].filter(Boolean).join(' · ')
  }
  return ''
}

export function OwnerAuditLogPanel({ enabled }: { enabled: boolean }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/owner/audit-log?limit=20', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Audit-Log konnte nicht geladen werden')
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit-Log konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  if (!enabled) return null

  return (
    <div className="pk-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>📜 Letzte Inhaber-Aktionen</h3>
          <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>
            Audit-Log der letzten 20 Inhaber-Aktionen (Freischaltungen, Sperren, Flags, Rechnungen).
          </p>
        </div>
        <button className="pk-btn-ghost" onClick={() => void load()} disabled={loading} style={{ fontWeight: 700 }}>
          {loading ? '⏳ Lädt…' : '🔄 Aktualisieren'}
        </button>
      </div>

      {error ? (
        <div style={{ color: '#ff8080', fontSize: 13 }}>{error}</div>
      ) : loading && entries.length === 0 ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Audit-Log wird geladen…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Aktionen protokolliert.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {entries.map(entry => {
            const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: '#aeb9c8', emoji: 'ℹ️' }
            const summary = summarizeDetails(entry.action, entry.details)
            return (
              <div
                key={entry.id}
                style={{
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10, padding: 10,
                  background: 'rgba(255,255,255,.03)',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                    <span style={{ fontWeight: 800, color: meta.color }}>{meta.label}</span>
                  </div>
                  <span style={{ color: '#aeb9c8', fontSize: 12 }}>{formatDate(entry.created_at)}</span>
                </div>
                <div style={{ marginTop: 6, color: '#dbe4ef', fontSize: 12 }}>
                  {entry.target_email ? (
                    <span>Ziel: <strong>{entry.target_email}</strong></span>
                  ) : entry.target_user_id ? (
                    <span style={{ color: '#aeb9c8' }}>Ziel-ID: {entry.target_user_id}</span>
                  ) : null}
                  {summary && (
                    <span style={{ display: 'block', color: '#aeb9c8', marginTop: 2 }}>{summary}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
