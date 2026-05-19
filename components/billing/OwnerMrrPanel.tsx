'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type MrrStats = {
  activeSubscriptions: number
  mrr: number
  arr: number
  churnedThisMonth: number
  newThisMonth: number
  totalRevenue: number
  activeUsers30d: number
}

const EMPTY: MrrStats = {
  activeSubscriptions: 0, mrr: 0, arr: 0,
  churnedThisMonth: 0, newThisMonth: 0, totalRevenue: 0, activeUsers30d: 0,
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function EUR(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })
}

export function OwnerMrrPanel({ enabled }: { enabled: boolean }) {
  const [stats, setStats] = useState<MrrStats>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    async function load() {
      try {
        const res = await fetch('/api/owner/mrr-stats')
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json() as MrrStats
        setStats(data)
      } catch {
        setStats(EMPTY)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [enabled])

  if (!enabled) return null

  const kpis = [
    { label: 'Aktive Abos', value: loading ? '…' : String(stats.activeSubscriptions), icon: '📋', color: '#1684ff' },
    { label: 'MRR', value: loading ? '…' : EUR(stats.mrr), icon: '💶', color: '#10b981' },
    { label: 'ARR', value: loading ? '…' : EUR(stats.arr), icon: '📈', color: '#20c8ff' },
    { label: 'Neue Abos (30d)', value: loading ? '…' : `+${stats.newThisMonth}`, icon: '🆕', color: '#a78bfa' },
    { label: 'Gekündigt (30d)', value: loading ? '…' : String(stats.churnedThisMonth), icon: '📉', color: stats.churnedThisMonth > 0 ? '#f43f5e' : '#aeb9c8' },
    { label: 'Aktive User (30d)', value: loading ? '…' : String(stats.activeUsers30d), icon: '👥', color: '#f59e0b' },
  ]

  return (
    <div className="pk-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>MRR & Wachstum</div>
          <div style={{ fontSize: 11, color: '#aeb9c8' }}>Live-Metriken aus Abo-Daten</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {!loading && stats.mrr === 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
          Keine aktiven Abos gefunden. Abos im Kundenverwaltungs-Panel aktivieren.
        </div>
      )}
    </div>
  )
}
