'use client'
// DP11: Vollständiges Design-Customization-Panel.
// - Theme (Klassisch / Modern / Glow)
// - Akzentfarbe (6 Optionen, nur wirksam im Glow-Theme)
// - Glow-Intensität (Aus/Dezent/Mittel/Stark, nur wirksam im Glow-Theme)
// - 7 Feinabstimmungs-Features (A5/A6/A7/P1/P2/P3/P4)
// - "Auf Standard zurücksetzen" Button

import {
  useDesignPrefs,
  patchDesignPrefs,
  writeDesignPrefs,
  DEFAULT_PREFS,
  type DesignTheme,
  type DesignAccent,
  type GlowIntensity,
  type DesignFeatures,
} from '@/lib/design-flag'

// ── Theme-Optionen ───────────────────────────────────────────────────────
const THEME_OPTIONS: Array<{ id: DesignTheme; title: string; emoji: string; description: string; gradient: string }> = [
  { id: 'classic', title: 'Klassisch', emoji: '🌑', description: 'Bewährtes Design mit Emoji-Icons, ohne Glow.', gradient: 'linear-gradient(135deg, #1a2436, #0a121e)' },
  { id: 'modern',  title: 'Modern',    emoji: '✨', description: 'Lucide-SVG-Icons, neues Logo, Illustrationen, sanfte Modals.', gradient: 'linear-gradient(135deg, #1684ff, #20c8ff)' },
  { id: 'glow',    title: 'Modern + Glow', emoji: '💎', description: 'Modern plus leuchtende Akzente: Gradient-Buttons, glühende Karten, Push-Effekt.', gradient: 'linear-gradient(135deg, #20c8ff, #1684ff 50%, #0d5cbf)' },
]

// ── Akzentfarben (CSS-Hex-Vorschau) ──────────────────────────────────────
const ACCENT_OPTIONS: Array<{ id: DesignAccent; title: string; color: string }> = [
  { id: 'blue',   title: 'Blau',   color: '#1684ff' },
  { id: 'cyan',   title: 'Cyan',   color: '#20c8ff' },
  { id: 'purple', title: 'Lila',   color: '#a78bfa' },
  { id: 'green',  title: 'Grün',   color: '#10b981' },
  { id: 'orange', title: 'Orange', color: '#f59e0b' },
  { id: 'red',    title: 'Rot',    color: '#ef4444' },
]

// ── Glow-Intensität ──────────────────────────────────────────────────────
const INTENSITY_OPTIONS: Array<{ id: GlowIntensity; title: string; description: string }> = [
  { id: 'off',    title: 'Aus',     description: 'Keine Lichteffekte' },
  { id: 'subtle', title: 'Dezent',  description: 'Leichter Schein' },
  { id: 'medium', title: 'Mittel',  description: 'Standard' },
  { id: 'strong', title: 'Stark',   description: 'Volles Leuchten' },
]

// ── Feinabstimmungs-Features ────────────────────────────────────────────
const FEATURE_OPTIONS: Array<{ id: keyof DesignFeatures; title: string; description: string; icon: string }> = [
  { id: 'statusPills',     title: 'Status-Pills statt Badges',       description: 'Status-Tags rund mit Punkt-Indikator statt klassischer Badges.', icon: '🟢' },
  { id: 'unifiedFocus',    title: 'Einheitliche Focus-Ringe',         description: 'Tastatur-Fokus überall mit gleichem akzentfarbenen Ring.',     icon: '⌨️' },
  { id: 'polishedToasts',  title: 'Polierte Toast-Animationen',       description: 'Toast-Hinweise faden mit Scale+Blur ein und aus.',             icon: '🍞' },
  { id: 'unifiedKpi',      title: 'Vereinheitlichte KPI-Karten',      description: 'Konsistentes Padding + Gradient + Hover-Lift auf Stats-Grid.', icon: '📊' },
  { id: 'stickyHeaders',   title: 'Sticky Table-Headers',             description: 'Tabellen-Köpfe bleiben beim Scrollen oben sichtbar.',           icon: '📌' },
  { id: 'smoothSidebar',   title: 'Sanfte Sidebar-Animation',          description: 'Geschmeidigeres Aus-/Einfahren der Mobile-Sidebar.',           icon: '↔️' },
  { id: 'lightBackground', title: 'Helleres Hintergrund-Schema',       description: 'Bühne wird heller, Karten bleiben dunkel — softer Übergang.',  icon: '🌗' },
]

// ── Helpers ──────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: '#aeb9c8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', margin: '20px 0 10px' }}>
      {children}
    </div>
  )
}

// ── Haupt-Panel ──────────────────────────────────────────────────────────
export default function DesignCustomizationPanel() {
  const prefs = useDesignPrefs()
  const isGlow = prefs.theme === 'glow'

  const reset = () => writeDesignPrefs(DEFAULT_PREFS)

  return (
    <div className="pk-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🎨 Design & Erscheinungsbild</div>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4, lineHeight: 1.5 }}>
            Stelle dein Design individuell ein — Theme, Akzentfarbe, Lichteffekte und 7 Feinjustierungen.
            Wirkt nur in deinem Browser, jederzeit zurücksetzbar.
          </div>
        </div>
        <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
          ↺ Standard
        </button>
      </div>

      {/* ── Theme ───────────────────────────────────────────────────── */}
      <SectionTitle>1) Theme</SectionTitle>
      <div role="radiogroup" aria-label="Design-Theme" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {THEME_OPTIONS.map(opt => {
          const active = prefs.theme === opt.id
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              onClick={() => patchDesignPrefs({ theme: opt.id })}
              style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: 12, borderRadius: 12,
                border: `2px solid ${active ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                background: active ? 'linear-gradient(180deg, rgba(22,132,255,.10), rgba(22,132,255,.02))' : 'rgba(255,255,255,.02)',
                boxShadow: active ? '0 6px 24px rgba(22,132,255,.18)' : 'none',
                transition: 'all .2s',
              }}
            >
              <div style={{ width: '100%', height: 32, borderRadius: 6, background: opt.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {opt.emoji}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.title}</div>
              <div style={{ fontSize: 11, color: '#aeb9c8', lineHeight: 1.4 }}>{opt.description}</div>
            </button>
          )
        })}
      </div>

      {/* ── Akzentfarbe ────────────────────────────────────────────── */}
      <SectionTitle>2) Akzentfarbe {!isGlow && <span style={{ color: '#6c7a8c', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(nur im Glow-Theme aktiv)</span>}</SectionTitle>
      <div role="radiogroup" aria-label="Akzentfarbe" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', opacity: isGlow ? 1 : .5 }}>
        {ACCENT_OPTIONS.map(opt => {
          const active = prefs.accent === opt.id
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              onClick={() => patchDesignPrefs({ accent: opt.id })}
              disabled={!isGlow}
              style={{
                all: 'unset', cursor: isGlow ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: 10, borderRadius: 10,
                border: `2px solid ${active ? opt.color : 'rgba(255,255,255,.08)'}`,
                background: active ? `${opt.color}1f` : 'rgba(255,255,255,.02)',
                boxShadow: active ? `0 4px 18px ${opt.color}40` : 'none',
                transition: 'all .15s',
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: opt.color, boxShadow: active ? `0 0 14px ${opt.color}80` : 'none' }} />
              <div style={{ fontSize: 11, fontWeight: 700 }}>{opt.title}</div>
            </button>
          )
        })}
      </div>

      {/* ── Glow-Intensität ───────────────────────────────────────── */}
      <SectionTitle>3) Lichteffekt-Intensität {!isGlow && <span style={{ color: '#6c7a8c', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(nur im Glow-Theme aktiv)</span>}</SectionTitle>
      <div role="radiogroup" aria-label="Glow-Intensität" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', opacity: isGlow ? 1 : .5 }}>
        {INTENSITY_OPTIONS.map(opt => {
          const active = prefs.glowIntensity === opt.id
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              onClick={() => patchDesignPrefs({ glowIntensity: opt.id })}
              disabled={!isGlow}
              style={{
                all: 'unset', cursor: isGlow ? 'pointer' : 'not-allowed',
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: 10, borderRadius: 10,
                border: `2px solid ${active ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                background: active ? 'rgba(22,132,255,.10)' : 'rgba(255,255,255,.02)',
                textAlign: 'center',
                transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.title}</div>
              <div style={{ fontSize: 10, color: '#aeb9c8' }}>{opt.description}</div>
            </button>
          )
        })}
      </div>

      {/* ── Feinabstimmung ───────────────────────────────────────── */}
      <SectionTitle>4) Feinabstimmung (alle einzeln schaltbar)</SectionTitle>
      <div style={{ display: 'grid', gap: 8 }}>
        {FEATURE_OPTIONS.map(opt => {
          const active = prefs.features[opt.id]
          return (
            <label
              key={opt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${active ? 'rgba(22,132,255,.30)' : 'rgba(255,255,255,.06)'}`,
                background: active ? 'rgba(22,132,255,.06)' : 'rgba(255,255,255,.02)',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fbff' }}>{opt.title}</div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, lineHeight: 1.4 }}>{opt.description}</div>
              </div>
              {/* Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={opt.title}
                onClick={() => patchDesignPrefs({ features: { [opt.id]: !active } as Partial<DesignFeatures> })}
                style={{
                  position: 'relative', width: 44, height: 24, flexShrink: 0,
                  borderRadius: 999,
                  border: `1px solid ${active ? 'rgba(22,132,255,.55)' : 'rgba(255,255,255,.18)'}`,
                  background: active ? 'rgba(22,132,255,.45)' : 'rgba(255,255,255,.06)',
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: active ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                  transition: 'left .15s',
                }} />
              </button>
            </label>
          )
        })}
      </div>

      {/* ── URL-Tipp ──────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 16, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.04)' }}>
        💡 Direkt-Umschaltung per URL: {' '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=classic</code>{', '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=modern</code>{', '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=glow</code>. Die anderen Einstellungen bleiben dabei erhalten.
      </div>
    </div>
  )
}
