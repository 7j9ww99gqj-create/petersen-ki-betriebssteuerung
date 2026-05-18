'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { createSupabaseClient } from '@/lib/supabase'

type SearchResult = {
  id: string; titel: string; sub: string; kategorie: string; href: string; icon: string; color: string
}

// Static demo data (when no Supabase connection)
const staticSearchData: SearchResult[] = [
  { id: 'L1', titel: 'Stahlrohr 40x40', sub: 'ART-001 · Lagerplatz A-01-03 · 142 Stk', kategorie: '📦 Lager', href: '/dashboard/lager?tab=bestand', icon: '📦', color: '#1684ff' },
  { id: 'L2', titel: 'Schrauben M8x30', sub: 'ART-002 · Lagerplatz B-02-01 · 1.840 Stk', kategorie: '📦 Lager', href: '/dashboard/lager?tab=bestand', icon: '📦', color: '#1684ff' },
  { id: 'K1', titel: 'Müller Bau GmbH', sub: 'K-001 · Hamburg · 84.200 €', kategorie: '🧾 Büro', href: '/dashboard/buero?tab=kunden', icon: '🏢', color: '#20c8ff' },
  { id: 'K2', titel: 'Schmidt & Partner', sub: 'K-002 · Berlin · 31.500 €', kategorie: '🧾 Büro', href: '/dashboard/buero?tab=kunden', icon: '🏢', color: '#20c8ff' },
  { id: 'R1', titel: 'Rechnung RE-2025-077', sub: 'Schmidt & Partner · 2.700 € · ÜBERFÄLLIG', kategorie: '🧾 Büro', href: '/dashboard/buero?tab=rechnungen', icon: '⚠️', color: '#f59e0b' },
  { id: 'W1', titel: 'AK-2025-041 – Hydraulikpresse', sub: 'Wartung HP-Station-3 · In Arbeit', kategorie: '🔧 Werkstatt', href: '/dashboard/werkstatt', icon: '⚙️', color: '#a78bfa' },
  { id: 'D1', titel: 'Wartungsvertrag_TechnikNord_2025.pdf', sub: 'Vertrag · 28.04.2025', kategorie: 'Archiv', href: '/dashboard/archiv', icon: '📝', color: '#f59e0b' },
]

const kategorienColors: Record<string, string> = {
  '📦 Lager': '#1684ff', '🧾 Büro': '#20c8ff', '🔧 Werkstatt': '#a78bfa',
  'AnalysePilot': '#10b981', 'Archiv': '#f59e0b',
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDemo = typeof window !== 'undefined' ? hasDemoCookie() : false

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }

    if (isDemo) {
      const lower = q.toLowerCase()
      setResults(staticSearchData.filter(d =>
        d.titel.toLowerCase().includes(lower) || d.sub.toLowerCase().includes(lower)
      ).slice(0, 12))
      return
    }

    setSearching(true)
    try {
      const supabase = createSupabaseClient()
      const lower = `%${q}%`
      const MAX = 3

      const [artikelRes, kundenRes, rechnungenRes, kartenRes] = await Promise.allSettled([
        supabase.from('lager_artikel').select('id,name,kategorie,lagerplatz,bestand,einheit,status').or(`name.ilike.${lower},kategorie.ilike.${lower},lagerplatz.ilike.${lower}`).limit(MAX),
        supabase.from('buero_kunden').select('id,name,email,status').or(`name.ilike.${lower},email.ilike.${lower}`).limit(MAX),
        supabase.from('buero_rechnungen').select('id,nummer,kunde,betrag,status').or(`nummer.ilike.${lower},kunde.ilike.${lower}`).limit(MAX),
        supabase.from('werkstatt_karten').select('id,auftragsnr,titel,beschreibung,status').or(`titel.ilike.${lower},beschreibung.ilike.${lower},auftragsnr.ilike.${lower}`).limit(MAX),
      ])

      const found: SearchResult[] = []

      if (artikelRes.status === 'fulfilled' && artikelRes.value.data) {
        for (const a of artikelRes.value.data) {
          const statusIcon = a.status === 'leer' ? '❌' : a.status === 'niedrig' ? '⚠️' : '📦'
          found.push({
            id: `a-${a.id}`, titel: a.name,
            sub: `${a.kategorie || ''}${a.lagerplatz ? ' · ' + a.lagerplatz : ''} · ${a.bestand ?? 0} ${a.einheit || 'Stk'}`,
            kategorie: '📦 Lager',
            href: `/dashboard/lager?tab=bestand&search=${encodeURIComponent(a.name)}`,
            icon: statusIcon, color: '#1684ff',
          })
        }
      }

      if (kundenRes.status === 'fulfilled' && kundenRes.value.data) {
        for (const k of kundenRes.value.data) {
          found.push({
            id: `k-${k.id}`, titel: k.name,
            sub: k.email || '',
            kategorie: '🧾 Büro',
            href: '/dashboard/buero?tab=kunden',
            icon: '🏢', color: '#20c8ff',
          })
        }
      }

      if (rechnungenRes.status === 'fulfilled' && rechnungenRes.value.data) {
        for (const r of rechnungenRes.value.data) {
          const icon = r.status === 'Überfällig' ? '⚠️' : '💶'
          found.push({
            id: `r-${r.id}`, titel: r.nummer || r.id,
            sub: `${r.kunde || ''} · ${r.betrag || ''} · ${r.status || ''}`,
            kategorie: '🧾 Büro',
            href: '/dashboard/buero?tab=rechnungen',
            icon, color: '#20c8ff',
          })
        }
      }

      if (kartenRes.status === 'fulfilled' && kartenRes.value.data) {
        for (const w of kartenRes.value.data) {
          const icon = w.status === 'Fertig' ? '✅' : '⚙️'
          found.push({
            id: `w-${w.id}`, titel: w.auftragsnr ? `${w.auftragsnr} – ${w.titel || ''}` : (w.titel || w.id),
            sub: `${w.beschreibung ? w.beschreibung.slice(0, 60) : ''} · ${w.status || ''}`,
            kategorie: '🔧 Werkstatt',
            href: '/dashboard/werkstatt',
            icon, color: '#a78bfa',
          })
        }
      }

      setResults(found)
    } catch {
      // Fallback to static
      const lower = q.toLowerCase()
      setResults(staticSearchData.filter(d =>
        d.titel.toLowerCase().includes(lower) || d.sub.toLowerCase().includes(lower)
      ).slice(0, 12))
    } finally {
      setSearching(false)
    }
  }, [isDemo])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void doSearch(query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.kategorie]) acc[r.kategorie] = []
    acc[r.kategorie].push(r)
    return acc
  }, {})

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      {/* Search Button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,.1)',
          background: 'rgba(255,255,255,.05)',
          color: '#aeb9c8', cursor: 'pointer', fontSize: 13,
          transition: 'background .15s, border-color .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,.08)'
          e.currentTarget.style.borderColor = 'rgba(22,132,255,.3)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,.05)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'
        }}
      >
        <span style={{ fontSize: 15 }}>🔍</span>
        <span>Suchen…</span>
        <span style={{
          padding: '1px 7px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)',
          background: 'rgba(255,255,255,.04)', fontSize: 11, fontFamily: 'monospace', color: '#4a5568',
        }}>⌘K</span>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '10vh',
          animation: 'fadeIn .15s ease',
        }}>
          <div ref={ref} style={{
            width: '100%', maxWidth: 600, margin: '0 16px',
            background: 'linear-gradient(180deg, #0d1e30, #080e18)',
            border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 40px 100px rgba(0,0,0,.7)',
          }}>
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{searching ? '⏳' : '🔍'}</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Artikel, Kunden, Rechnungen, Arbeitskarten…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f8fbff', fontSize: 16, fontWeight: 500,
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'transparent', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
              )}
              <kbd style={{
                padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.04)', fontSize: 11, color: '#4a5568',
              }}>Esc</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {query.trim().length < 2 && (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#4a5568' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 14 }}>Mindestens 2 Zeichen eingeben…</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Durchsucht: Artikel, Kunden, Rechnungen, Arbeitskarten</div>
                </div>
              )}

              {query.trim().length >= 2 && !searching && results.length === 0 && (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#4a5568' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
                  <div style={{ fontSize: 14 }}>Keine Ergebnisse für &quot;{query}&quot;</div>
                </div>
              )}

              {Object.entries(grouped).map(([kat, items]) => (
                <div key={kat}>
                  <div style={{
                    padding: '8px 20px 4px', fontSize: 11,
                    color: kategorienColors[kat] || '#aeb9c8',
                    fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em',
                    borderBottom: `1px solid ${kategorienColors[kat] || '#aeb9c8'}18`,
                  }}>{kat}</div>
                  {items.map(r => (
                    <button
                      key={r.id}
                      onClick={() => navigate(r.href)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px', border: 'none', cursor: 'pointer',
                        background: 'transparent', textAlign: 'left',
                        borderBottom: '1px solid rgba(255,255,255,.04)',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: r.color + '18', border: `1px solid ${r.color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>{r.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fbff', marginBottom: 2 }}>{r.titel}</div>
                        <div style={{ fontSize: 12, color: '#aeb9c8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#4a5568', flexShrink: 0 }}>›</span>
                    </button>
                  ))}
                </div>
              ))}

              {results.length > 0 && (
                <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: 12, color: '#4a5568', textAlign: 'center' }}>
                  {results.length} Ergebnis{results.length !== 1 ? 'se' : ''} gefunden
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
