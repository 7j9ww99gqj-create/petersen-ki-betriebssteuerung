'use client'
import { useEffect, useState, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { hasDemoCookie } from '@/lib/auth'

type ActivityEntry = {
  id: string
  created_at: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
}

const DEMO_ENTRIES: ActivityEntry[] = [
  { id: '1', created_at: new Date(Date.now() - 3600000).toISOString(), action: 'delete', entity_type: 'Artikel', entity_id: 'ART-001', details: { name: 'Stahlrohr 40x40' } },
  { id: '2', created_at: new Date(Date.now() - 7200000).toISOString(), action: 'delete', entity_type: 'Rechnung', entity_id: 'RE-2025-043', details: { nummer: 'RE-2025-043', betrag: '1.200,00' } },
  { id: '3', created_at: new Date(Date.now() - 86400000).toISOString(), action: 'delete', entity_type: 'Kunde', entity_id: 'K-008', details: { name: 'Mustermann GmbH' } },
]

const ACTION_ICONS: Record<string, string> = {
  delete: '🗑️',
  anonymize: '🔒',
  update: '✏️',
  create: '➕',
}

const ENTITY_COLORS: Record<string, string> = {
  Artikel: '#1684ff',
  Rechnung: '#f59e0b',
  Angebot: '#20c8ff',
  Auftrag: '#a78bfa',
  Kunde: '#10b981',
  Beleg: '#f43f5e',
  WerkstattKarte: '#7c3aed',
  Eingangsrechnung: '#fb923c',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildLabel(entry: ActivityEntry): string {
  const d = entry.details ?? {}
  const name = d.name ?? d.nummer ?? d.auftragsnr ?? entry.entity_id ?? ''
  switch (entry.action) {
    case 'delete': return `${entry.entity_type ?? 'Eintrag'} "${name}" gelöscht`
    case 'anonymize': return `${entry.entity_type ?? 'Eintrag'} anonymisiert`
    default: return `${entry.action} · ${entry.entity_type ?? ''} ${name}`
  }
}

type Props = { maxItems?: number; compact?: boolean }

export default function ActivityLog({ maxItems = 50, compact = false }: Props) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('Alle')
  const isDemo = typeof window !== 'undefined' ? hasDemoCookie() : false

  const load = useCallback(async () => {
    setLoading(true)
    if (isDemo) {
      setEntries(DEMO_ENTRIES)
      setLoading(false)
      return
    }
    try {
      const supabase = createSupabaseClient()
      const { data } = await supabase
        .from('user_audit_log')
        .select('id,created_at,action,entity_type,entity_id,details')
        .order('created_at', { ascending: false })
        .limit(maxItems)
      setEntries((data ?? []) as ActivityEntry[])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [isDemo, maxItems])

  useEffect(() => { load() }, [load])

  const entityTypes = ['Alle', ...Array.from(new Set(entries.map(e => e.entity_type ?? 'Sonstige')))]
  const filtered = filter === 'Alle' ? entries : entries.filter(e => (e.entity_type ?? 'Sonstige') === filter)

  if (loading) {
    return (
      <div style={{ padding: compact ? '12px 0' : 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 44, background: 'rgba(255,255,255,.04)', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {!compact && entityTypes.length > 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {entityTypes.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={filter === t ? 'pk-btn' : 'pk-btn-ghost'}
              style={{ padding: '4px 12px', fontSize: 12, minHeight: 28 }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#aeb9c8', fontSize: 13 }}>
          Noch keine Aktivitäten protokolliert.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
          {filtered.map(entry => {
            const color = ENTITY_COLORS[entry.entity_type ?? ''] ?? '#aeb9c8'
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: compact ? '8px 10px' : '10px 14px',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.06)',
                borderRadius: 8,
              }}>
                <span style={{ fontSize: compact ? 14 : 16, flexShrink: 0 }}>
                  {ACTION_ICONS[entry.action] ?? '📋'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: compact ? 12 : 13, color: '#f8fbff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {buildLabel(entry)}
                  </div>
                  {!compact && (
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>
                      {formatDate(entry.created_at)}
                    </div>
                  )}
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 700,
                  color, background: `${color}18`,
                  border: `1px solid ${color}33`,
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  {entry.entity_type ?? 'Sonstige'}
                </span>
                {compact && (
                  <span style={{ fontSize: 10, color: '#aeb9c8', flexShrink: 0 }}>
                    {formatDate(entry.created_at)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
