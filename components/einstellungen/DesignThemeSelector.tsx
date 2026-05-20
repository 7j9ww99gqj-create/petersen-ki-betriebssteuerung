'use client'
// G4: Design-Theme-Selector mit 3 Optionen (classic / modern / glow).
// Ersetzt visuell den alten DesignV2Toggle in der Einstellungs-Seite, lässt
// den Toggle aber bestehen — der wird einfach nicht mehr gerendert.

import { useDesignTheme, setDesignTheme, type DesignTheme } from '@/lib/design-flag'

interface ThemeOption {
  id: DesignTheme
  title: string
  description: string
  emoji: string
  accent: string
  gradient: string
}

const OPTIONS: ThemeOption[] = [
  {
    id: 'classic',
    title: 'Klassisch',
    description: 'Bewährtes Design mit Emoji-Icons. Standard für alle bestehenden User.',
    emoji: '🌑',
    accent: '#aeb9c8',
    gradient: 'linear-gradient(135deg, #1a2436, #0a121e)',
  },
  {
    id: 'modern',
    title: 'Modern',
    description: 'Professionelle Lucide-SVG-Icons, neues Vektor-Logo, illustrierte Leerzustände und sanfte Modal-Animationen.',
    emoji: '✨',
    accent: '#6cb6ff',
    gradient: 'linear-gradient(135deg, #1684ff, #20c8ff)',
  },
  {
    id: 'glow',
    title: 'Modern + Glow',
    description: 'Modernes Design plus leuchtende Blau-Akzente: Gradient-Buttons, glühende Karten, Push-Effekt auf Menüpunkten und Bottom-Nav. Stärkstes Branding.',
    emoji: '💎',
    accent: '#20c8ff',
    gradient: 'linear-gradient(135deg, #20c8ff, #1684ff 50%, #0d5cbf)',
  },
]

export default function DesignThemeSelector() {
  const current = useDesignTheme()

  return (
    <div className="pk-card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
          ✨ Design auswählen
        </div>
        <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.55 }}>
          Wähle dein bevorzugtes Erscheinungsbild. Die Einstellung gilt nur für deinen
          Browser und kann jederzeit gewechselt werden — bestehende Daten und Funktionen
          bleiben in allen Designs identisch.
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Design-Theme"
        style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        {OPTIONS.map(opt => {
          const active = current === opt.id
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              onClick={() => setDesignTheme(opt.id)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 14,
                borderRadius: 14,
                border: `2px solid ${active ? opt.accent : 'rgba(255,255,255,.08)'}`,
                background: active
                  ? `linear-gradient(180deg, rgba(22,132,255,.10), rgba(22,132,255,.02))`
                  : 'rgba(255,255,255,.02)',
                boxShadow: active
                  ? `0 6px 24px rgba(22,132,255,.18), 0 0 0 4px rgba(22,132,255,.08)`
                  : 'none',
                transition: 'border-color .2s, background .2s, box-shadow .2s, transform .15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.18)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.08)' }}
            >
              {/* Preview-Streifen mit Gradient */}
              <div style={{
                width: '100%',
                height: 40,
                borderRadius: 8,
                background: opt.gradient,
                boxShadow: opt.id !== 'classic' ? `0 4px 18px ${opt.accent}33` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: '#fff',
              }}>
                {opt.emoji}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#f8fbff' }}>
                  {opt.title}
                </div>
                <div
                  aria-hidden
                  style={{
                    width: 18, height: 18,
                    borderRadius: '50%',
                    border: `2px solid ${active ? opt.accent : 'rgba(255,255,255,.20)'}`,
                    background: active ? opt.accent : 'transparent',
                    boxShadow: active ? `0 0 10px ${opt.accent}80` : 'none',
                    flexShrink: 0,
                    transition: 'all .2s',
                  }}
                />
              </div>

              <div style={{ fontSize: 11, color: '#aeb9c8', lineHeight: 1.45 }}>
                {opt.description}
              </div>

              {active && (
                <div style={{ fontSize: 10, color: opt.accent, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  ● Aktiv
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 12 }}>
        Tipp: Direkt per URL umschaltbar mit{' '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=classic</code>{', '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=modern</code>{' oder '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=glow</code>.
      </div>
    </div>
  )
}
