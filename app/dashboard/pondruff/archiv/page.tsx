'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'

type Kind = 'wareneingang' | 'preisauftrag' | 'auftragsbestaetigung' | 'rechnung' | 'bauteil'

type Item = {
  id: string
  kind: Kind
  created_at: string
  title: string
  customer: string | null
  meta: string
  href: string
  image?: string
  syncedBuero?: boolean
  syncedWiso?: boolean
}

const KIND_META: Record<Kind, { icon: string; label: string; color: string }> = {
  wareneingang: { icon: '📥', label: 'Wareneingang', color: '#1684ff' },
  preisauftrag: { icon: '💶', label: 'Preisauftrag', color: '#20c8ff' },
  auftragsbestaetigung: { icon: '📋', label: 'Auftragsbestätigung', color: '#f59e0b' },
  rechnung: { icon: '🧾', label: 'Rechnung', color: '#10b981' },
  bauteil: { icon: '🔍', label: 'Bauteil', color: '#a78bfa' },
}

export default function ArchivPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [filter, setFilter] = useState('')
  const [kind, setKind] = useState<Kind | 'alle'>('alle')

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createSupabaseClient()
    const [we, pa, bt] = await Promise.all([
      sb.from('pondruff_wareneingaenge').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('pondruff_preisauftraege').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('pondruff_bauteile').select('*').order('created_at', { ascending: false }).limit(200),
    ])
    const arr: Item[] = []
    ;(we.data || []).forEach(r => arr.push({
      id: r.id, kind: 'wareneingang', created_at: r.created_at,
      title: r.delivery_id || `Wareneingang ${new Date(r.created_at).toLocaleDateString('de-DE')}`,
      customer: r.customer,
      meta: [r.operator, r.status].filter(Boolean).join(' · '),
      href: '/dashboard/pondruff/wareneingang',
      syncedBuero: !!r.synced_buero_dokument_id,
    }))
    ;(pa.data || []).forEach(r => {
      const k: Kind = r.status === 'rechnung' ? 'rechnung' : r.status === 'auftragsbestaetigung' ? 'auftragsbestaetigung' : 'preisauftrag'
      arr.push({
        id: r.id, kind: k, created_at: r.created_at,
        title: k === 'rechnung' ? `Rechnung ${r.invoice_no || ''}` : (r.order_id || r.project || 'Auftrag'),
        customer: r.customer,
        meta: `${Number(r.total || 0).toFixed(2)} € · ${(r.rows || []).length} Pos.`,
        href: '/dashboard/pondruff/buero-wiso',
        syncedBuero: !!r.synced_buero_auftrag_id,
        syncedWiso: !!r.synced_wiso_at,
      })
    })
    ;(bt.data || []).forEach(r => arr.push({
      id: r.id, kind: 'bauteil', created_at: r.created_at,
      title: r.article_no || r.description || 'Bauteil',
      customer: r.customer, meta: r.delivery_id || '',
      href: '/dashboard/pondruff/ki-suche',
    }))
    arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
    setItems(arr)
  }

  const visible = useMemo(() => {
    const q = filter.toLowerCase().trim()
    return items.filter(it => {
      if (kind !== 'alle' && it.kind !== kind) return false
      if (!q) return true
      return [it.title, it.customer, it.meta].some(x => (x || '').toLowerCase().includes(q))
    })
  }, [items, filter, kind])

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Suche Kunde / Beleg-Nr. / Beschreibung" value={filter} onChange={e => setFilter(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <button className="pk-btn-ghost" onClick={load}>🔄 Neu laden</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['alle', 'wareneingang', 'preisauftrag', 'auftragsbestaetigung', 'rechnung', 'bauteil'] as const).map(k => (
          <button key={k} onClick={() => setKind(k)}
            style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              border: '1px solid rgba(229,9,9,.3)',
              background: kind === k ? 'rgba(229,9,9,.2)' : 'transparent',
              color: kind === k ? '#ff6b6b' : '#aeb9c8',
            }}>
            {k === 'alle' ? 'Alle' : KIND_META[k as Kind].icon + ' ' + KIND_META[k as Kind].label}
            <span style={{ marginLeft: 6, opacity: .7 }}>({k === 'alle' ? items.length : items.filter(i => i.kind === k).length})</span>
          </button>
        ))}
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>Archiv ({visible.length})</h3>
        {visible.length === 0 ? (
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Einträge — alles, was du im Pondruff-Modul speicherst, erscheint hier.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {visible.map(it => {
              const km = KIND_META[it.kind]
              return (
                <button key={`${it.kind}-${it.id}`} onClick={() => router.push(it.href)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    display: 'flex', gap: 12, padding: 12, borderRadius: 10,
                    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
                  }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: km.color + '20', border: `1px solid ${km.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{km.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                      <div style={{ fontSize: 11, color: '#aeb9c8' }}>{new Date(it.created_at).toLocaleDateString('de-DE')}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>
                      {it.customer || '—'} {it.meta ? '· ' + it.meta : ''} · <span style={{ color: km.color }}>{km.label}</span>
                    </div>
                    {(it.syncedBuero || it.syncedWiso) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {it.syncedBuero && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(32,200,255,.12)', color: '#20c8ff', border: '1px solid rgba(32,200,255,.3)' }}>
                            → Büro ✓
                          </span>
                        )}
                        {it.syncedWiso && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
                            → WISO ✓
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
