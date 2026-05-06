'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type SearchResult = {
  id: string; titel: string; sub: string; kategorie: string; href: string; icon: string; color: string
}

// Alle durchsuchbaren Datensätze aus allen Piloten
const searchData: SearchResult[] = [
  // Lager
  { id: 'L1', titel: 'Stahlrohr 40x40', sub: 'ART-001 · Lagerplatz A-01-03 · 142 Stk', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '📦', color: '#1684ff' },
  { id: 'L2', titel: 'Schrauben M8x30', sub: 'ART-002 · Lagerplatz B-02-01 · 1.840 Stk', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '📦', color: '#1684ff' },
  { id: 'L3', titel: 'Hydrauliköl HLP46', sub: 'ART-003 · Lagerplatz C-01-02 · NIEDRIGER BESTAND (8 Liter)', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '⚠️', color: '#f59e0b' },
  { id: 'L4', titel: 'Schweißdraht 1.0mm', sub: 'ART-004 · Lagerplatz B-03-04 · 24 Rollen', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '📦', color: '#1684ff' },
  { id: 'L5', titel: 'Aluminiumplatte 200x300', sub: 'ART-005 · Lagerplatz A-02-01 · LEER', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '❌', color: '#f43f5e' },
  { id: 'L6', titel: 'Dichtungsring 50mm', sub: 'ART-006 · Lagerplatz B-01-05 · 360 Stk', kategorie: 'LagerPilot', href: '/dashboard/lager', icon: '📦', color: '#1684ff' },
  // Kunden
  { id: 'K1', titel: 'Müller Bau GmbH', sub: 'K-001 · Thomas Müller · Hamburg · 84.200 €', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '🏢', color: '#20c8ff' },
  { id: 'K2', titel: 'Schmidt & Partner', sub: 'K-002 · Anna Schmidt · Berlin · 31.500 €', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '🏢', color: '#20c8ff' },
  { id: 'K3', titel: 'Technik Nord AG', sub: 'K-003 · Lars Brandt · Hannover · 127.800 €', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '🏢', color: '#20c8ff' },
  { id: 'K4', titel: 'Delta Logistik KG', sub: 'K-005 · Sandra Koch · Düsseldorf · 56.100 €', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '🏢', color: '#20c8ff' },
  // Aufträge / Rechnungen
  { id: 'A1', titel: 'Auftrag A-2025-034', sub: 'Technik Nord AG · Wartungsvertrag · In Bearbeitung', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '✅', color: '#20c8ff' },
  { id: 'A2', titel: 'Auftrag A-2025-033', sub: 'Müller Bau GmbH · Stahlträger Charge 1 · In Bearbeitung', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '✅', color: '#20c8ff' },
  { id: 'R1', titel: 'Rechnung RE-2025-077', sub: 'Schmidt & Partner · 2.700 € · ÜBERFÄLLIG', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '⚠️', color: '#f59e0b' },
  { id: 'R2', titel: 'Rechnung RE-2025-078', sub: 'Delta Logistik KG · 4.400 € · Offen', kategorie: 'BüroPilot', href: '/dashboard/buero', icon: '💶', color: '#20c8ff' },
  // Arbeitskarten
  { id: 'W1', titel: 'AK-2025-041 – Hydraulikpresse', sub: 'Wartung HP-Station-3 · K. Meier · In Arbeit', kategorie: 'WerkstattPilot', href: '/dashboard/werkstatt', icon: '⚙️', color: '#a78bfa' },
  { id: 'W2', titel: 'AK-2025-040 – Schweißnahtprüfung', sub: 'Stahlträger Charge 1 · M. Fischer · In Arbeit', kategorie: 'WerkstattPilot', href: '/dashboard/werkstatt', icon: '⚙️', color: '#a78bfa' },
  { id: 'W3', titel: 'AK-2025-038 – Förderband Segment 2', sub: 'Instandhaltung · K. Meier · Fertig', kategorie: 'WerkstattPilot', href: '/dashboard/werkstatt', icon: '✅', color: '#a78bfa' },
  // Dokumente
  { id: 'D1', titel: 'Wartungsvertrag_TechnikNord_2025.pdf', sub: 'Vertrag · 1,2 MB · 28.04.2025', kategorie: 'Archiv', href: '/dashboard/archiv', icon: '📝', color: '#f59e0b' },
  { id: 'D2', titel: 'Rechnung_RE-2025-078.pdf', sub: 'Rechnung · 198 KB · 10.04.2025', kategorie: 'Archiv', href: '/dashboard/archiv', icon: '💶', color: '#f59e0b' },
  { id: 'D3', titel: 'Angebot_ANG-2025-042.pdf', sub: 'Angebot · 284 KB · 02.05.2025', kategorie: 'Archiv', href: '/dashboard/archiv', icon: '📋', color: '#f59e0b' },
]

const kategorienColors: Record<string, string> = {
  LagerPilot: '#1684ff', BüroPilot: '#20c8ff', WerkstattPilot: '#a78bfa',
  AnalysePilot: '#10b981', Archiv: '#f59e0b',
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  const results = query.trim().length >= 2
    ? searchData.filter(d =>
        d.titel.toLowerCase().includes(query.toLowerCase()) ||
        d.sub.toLowerCase().includes(query.toLowerCase()) ||
        d.kategorie.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : []

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
              <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Artikel, Kunden, Aufträge, Dokumente durchsuchen…"
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
                  <div style={{ fontSize: 12, marginTop: 6 }}>Durchsucht: Artikel, Kunden, Aufträge, Rechnungen, Arbeitskarten, Dokumente</div>
                </div>
              )}

              {query.trim().length >= 2 && results.length === 0 && (
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
