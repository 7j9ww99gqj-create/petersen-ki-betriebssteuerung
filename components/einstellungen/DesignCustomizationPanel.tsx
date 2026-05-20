'use client'
// DP11: Vollständiges Design-Customization-Panel.
// DP12: Erweitert um 6 Personalisierungs-Module mit Master-Toggle pro Modul.
//   - Allgemein (Theme/Akzent/Glow/Features) — DP11 bleibt erhalten
//   - Benachrichtigungen (Toast-Stil, Position, Animation, Dauer, Sound)
//   - Typografie (Schriftgröße, Zeilenhöhe, Letter-Spacing, Button-Größe)
//   - Effekte (Animation-Speed, Blur, Schatten, Glassmorphism, Hover, Scroll)
//   - Farben (Primär/Sekundär/Error/Success + BG-Variante)
//   - Icons & Layout (Icon-Style/Size/Status + Layout-Dichte)
// Jedes Modul hat eigenen Master-Toggle „Aktivieren" → bei AUS bleibt aktuelles
// Design erhalten. „↺ Standard" setzt alle Module zurück (alle disabled).

import { useEffect, useState } from 'react'
import { pushAppToast } from '@/components/AppToast'
import { isCloudSyncEnabled, setCloudSyncEnabled, pushPrefsToCloud, pullPrefsFromCloud } from '@/lib/design-sync'
import {
  useDesignPrefs,
  patchDesignPrefs,
  writeDesignPrefs,
  DEFAULT_PREFS,
  type DesignPrefs,
  type DesignTheme,
  type DesignAccent,
  type GlowIntensity,
  type DesignFeatures,
  type ToastPosition,
  type ToastAnimation,
  type ToastDuration,
  type ToastSize,
  type FontBase,
  type FontFamily,
  type HeadingScale,
  type LineHeight,
  type LetterSpacing,
  type ButtonFontSize,
  type AnimationSpeed,
  type BlurIntensity,
  type ShadowDepth,
  type ScrollEffects,
  type HoverAction,
  type BackgroundColor,
  type IconStyle,
  type IconSize,
  type StatusIndicator,
  type LayoutDensity,
} from '@/lib/design-flag'

// ── Theme-Optionen (inkl. Hell + Auto) ──────────────────────────────────
const THEME_OPTIONS: Array<{ id: DesignTheme; title: string; emoji: string; description: string; gradient: string }> = [
  { id: 'classic', title: 'Klassisch',     emoji: '🌑', description: 'Bewährtes Dark-Design mit Emoji-Icons, ohne Glow.',           gradient: 'linear-gradient(135deg, #1a2436, #0a121e)' },
  { id: 'modern',  title: 'Modern',        emoji: '✨', description: 'Lucide-Icons, sanfte Modals, dezente Akzente.',                gradient: 'linear-gradient(135deg, #1684ff, #20c8ff)' },
  { id: 'glow',    title: 'Glow',          emoji: '💎', description: 'Modern + leuchtende Akzente, Gradient-Buttons.',              gradient: 'linear-gradient(135deg, #20c8ff, #1684ff 50%, #0d5cbf)' },
  { id: 'light',   title: 'Hell',          emoji: '☀️', description: 'Helles Layout — ideal für Tageslicht und helle Monitore.',    gradient: 'linear-gradient(135deg, #e8eef6, #f0f4f8)' },
]

// ── Farb-Presets ─────────────────────────────────────────────────────────
type ColorPreset = { id: string; label: string; emoji: string; primary: string; secondary: string; error: string; success: string; bg: BackgroundColor }
const COLOR_PRESETS: ColorPreset[] = [
  { id: 'default', label: 'Standard',  emoji: '🔵', primary: '#1684ff', secondary: '#20c8ff', error: '#ff5050', success: '#25d366', bg: 'standard'   },
  { id: 'emerald', label: 'Smaragd',   emoji: '🟢', primary: '#10b981', secondary: '#34d399', error: '#ef4444', success: '#6ee7b7', bg: 'standard'   },
  { id: 'purple',  label: 'Lila',      emoji: '💜', primary: '#a78bfa', secondary: '#c4b5fd', error: '#f87171', success: '#34d399', bg: 'standard'   },
  { id: 'sunset',  label: 'Sunset',    emoji: '🟠', primary: '#f97316', secondary: '#fb923c', error: '#ef4444', success: '#22c55e', bg: 'warm-tint'  },
  { id: 'arctic',  label: 'Arktis',    emoji: '🩵', primary: '#0ea5e9', secondary: '#38bdf8', error: '#f43f5e', success: '#4ade80', bg: 'ultra-dark' },
  { id: 'rose',    label: 'Rose',      emoji: '🌸', primary: '#f43f5e', secondary: '#fb7185', error: '#dc2626', success: '#22c55e', bg: 'standard'   },
]

// ── WCAG-Kontrastprüfung gegen Weiß ──────────────────────────────────────
function wcagContrastVsWhite(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 21
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin(parseInt(m[1], 16)) + 0.7152 * lin(parseInt(m[2], 16)) + 0.0722 * lin(parseInt(m[3], 16))
  return parseFloat(((1.05) / (L + 0.05)).toFixed(2))
}

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

// ── DP12: Tab-Definition ─────────────────────────────────────────────────
type PanelTab = 'allgemein' | 'benachrichtigungen' | 'typografie' | 'effekte' | 'farben' | 'icons-layout'

const PANEL_TABS: Array<{ id: PanelTab; label: string; icon: string }> = [
  { id: 'allgemein',          label: 'Allgemein',         icon: '🎨' },
  { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: '🔔' },
  { id: 'typografie',         label: 'Typografie',         icon: '🔤' },
  { id: 'effekte',            label: 'Effekte',            icon: '✨' },
  { id: 'farben',             label: 'Farben',             icon: '🌈' },
  { id: 'icons-layout',       label: 'Icons & Layout',     icon: '📐' },
]

// ── Font-Family-Optionen ─────────────────────────────────────────────────
const FONT_OPTIONS: Array<{ id: FontFamily; label: string; sub: string; sample: string }> = [
  { id: 'system',  label: 'System',  sub: 'Standard',   sample: 'Aa' },
  { id: 'inter',   label: 'Inter',   sub: 'Modern',     sample: 'Aa' },
  { id: 'roboto',  label: 'Roboto',  sub: 'Rund',       sample: 'Aa' },
  { id: 'mono',    label: 'Mono',    sub: 'Code-Stil',  sample: 'Aa' },
  { id: 'georgia', label: 'Georgia', sub: 'Serif',      sample: 'Aa' },
]

const FONT_FAMILY_PREVIEW: Record<FontFamily, string> = {
  system:  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter:   '"Inter", system-ui, sans-serif',
  roboto:  '"Roboto", system-ui, sans-serif',
  mono:    '"JetBrains Mono", Consolas, monospace',
  georgia: 'Georgia, serif',
}

// ── Live-Vorschau-Karte ───────────────────────────────────────────────────
function LivePreview({ prefs }: { prefs: DesignPrefs }) {
  const isLight = prefs.theme === 'light' ||
    (prefs.autoTheme && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches)
  const bgOuter   = isLight ? '#e8eef6'  : 'rgba(255,255,255,.03)'
  const bgCard    = isLight ? '#ffffff'  : '#101a28'
  const borderC   = isLight ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.07)'
  const textMain  = isLight ? '#1a2436'  : '#f8fbff'
  const textMuted = isLight ? '#5a6a7e'  : '#aeb9c8'
  const primary   = prefs.colors.enabled ? prefs.colors.primaryAccent   : '#1684ff'
  const success   = prefs.colors.enabled ? prefs.colors.successColor    : '#25d366'
  const error     = prefs.colors.enabled ? prefs.colors.errorColor      : '#ff5050'
  const fSize     = prefs.typography.enabled ? prefs.typography.baseFontSize : 14
  const fontFam   = prefs.typography.enabled ? FONT_FAMILY_PREVIEW[prefs.typography.fontFamily] : 'inherit'
  return (
    <div style={{ padding: 12, borderRadius: 10, background: bgOuter, border: `1px solid ${borderC}`, marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
        ◉ Live-Vorschau
      </div>
      <div style={{ background: bgCard, borderRadius: 8, padding: 14, border: `1px solid ${borderC}`, fontFamily: fontFam }}>
        <div style={{ fontSize: fSize + 2, fontWeight: 800, color: textMain, marginBottom: 4 }}>Beispiel-Karte</div>
        <div style={{ fontSize: Math.max(fSize - 1, 11), color: textMuted, marginBottom: 12, lineHeight: 1.5 }}>
          So sehen Text und Elemente in deiner App aus.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ padding: '6px 14px', borderRadius: 8, background: primary, color: '#fff', fontSize: Math.max(fSize - 2, 11), fontWeight: 700, cursor: 'default', boxShadow: `0 4px 14px ${primary}40` }}>
            Primär-Button
          </div>
          <span style={{ padding: '3px 8px', borderRadius: 6, background: `${success}22`, color: success, fontSize: 11, fontWeight: 700 }}>● Aktiv</span>
          <span style={{ padding: '3px 8px', borderRadius: 6, background: `${error}22`,   color: error,   fontSize: 11, fontWeight: 700 }}>● Fehler</span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: '#aeb9c8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', margin: '20px 0 10px' }}>
      {children}
    </div>
  )
}

function Toggle({
  checked, onChange, label, desc,
}: { checked: boolean; onChange: () => void; label: string; desc?: string }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        border: `1px solid ${checked ? 'rgba(22,132,255,.30)' : 'rgba(255,255,255,.06)'}`,
        background: checked ? 'rgba(22,132,255,.06)' : 'rgba(255,255,255,.02)',
        cursor: 'pointer', transition: 'all .15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fbff' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={onChange}
        style={{
          position: 'relative', width: 44, height: 24, flexShrink: 0,
          borderRadius: 999,
          border: `1px solid ${checked ? 'rgba(22,132,255,.55)' : 'rgba(255,255,255,.18)'}`,
          background: checked ? 'rgba(22,132,255,.45)' : 'rgba(255,255,255,.06)',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.3)',
          transition: 'left .15s',
        }} />
      </button>
    </label>
  )
}

// Master-Toggle für ein ganzes Modul
function ModuleMasterToggle({
  enabled, onToggle, title, description,
}: { enabled: boolean; onToggle: () => void; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '14px 16px', borderRadius: 12,
      background: enabled ? 'linear-gradient(180deg, rgba(22,132,255,.12), rgba(22,132,255,.04))' : 'rgba(255,255,255,.02)',
      border: `2px solid ${enabled ? 'rgba(22,132,255,.40)' : 'rgba(255,255,255,.08)'}`,
      marginBottom: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: enabled ? '#6cb6ff' : '#f8fbff' }}>
          {enabled ? '✅ ' : ''}{title}
        </div>
        <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4, lineHeight: 1.5 }}>{description}</div>
      </div>
      <button
        type="button" role="switch" aria-checked={enabled}
        onClick={onToggle}
        style={{
          position: 'relative', width: 52, height: 28, flexShrink: 0,
          borderRadius: 999,
          border: `1px solid ${enabled ? 'rgba(22,132,255,.7)' : 'rgba(255,255,255,.2)'}`,
          background: enabled ? 'rgba(22,132,255,.55)' : 'rgba(255,255,255,.06)',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: enabled ? 26 : 2,
          width: 22, height: 22, borderRadius: '50%',
          background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.3)',
          transition: 'left .15s',
        }} />
      </button>
    </div>
  )
}

// Radio-Group im Pill-Stil
function PillRadio<T extends string | number>({
  value, options, onChange, disabled = false, minWidth = 90,
}: {
  value: T
  options: Array<{ id: T; label: string; sub?: string }>
  onChange: (v: T) => void
  disabled?: boolean
  minWidth?: number
}) {
  return (
    <div role="radiogroup" style={{
      display: 'grid', gap: 8,
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
      opacity: disabled ? .45 : 1,
    }}>
      {options.map(opt => {
        const active = value === opt.id
        return (
          <button
            key={String(opt.id)}
            role="radio" aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            style={{
              all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '10px 12px', borderRadius: 10,
              border: `2px solid ${active ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
              background: active ? 'rgba(22,132,255,.10)' : 'rgba(255,255,255,.02)',
              textAlign: 'center', transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800 }}>{opt.label}</div>
            {opt.sub && <div style={{ fontSize: 10, color: '#aeb9c8' }}>{opt.sub}</div>}
          </button>
        )
      })}
    </div>
  )
}

// Color-Picker (nativ + Hex-Input)
function ColorField({
  label, value, onChange, disabled = false,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 14px', borderRadius: 10,
      border: '1px solid rgba(255,255,255,.08)',
      background: 'rgba(255,255,255,.02)', opacity: disabled ? .5 : 1,
    }}>
      <div style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13, fontWeight: 700 }}>{label}</div>
      <input
        type="color" value={value} onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: 38, height: 32, padding: 0, border: 'none', borderRadius: 6, background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
      />
      <input
        type="text" value={value} onChange={e => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
        disabled={disabled}
        className="pk-input"
        style={{ width: 90, fontFamily: 'monospace', fontSize: 12, textAlign: 'center', flexShrink: 0 }}
      />
    </div>
  )
}

// ── Haupt-Panel ──────────────────────────────────────────────────────────
export default function DesignCustomizationPanel() {
  const prefs = useDesignPrefs()
  const isGlow = prefs.theme === 'glow'
  const [tab, setTab] = useState<PanelTab>('allgemein')

  // DP12 — Cloud-Sync State
  const [cloudSync, setCloudSync] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  useEffect(() => { setCloudSync(isCloudSyncEnabled()) }, [])

  async function handleCloudSyncToggle() {
    const next = !cloudSync
    setSyncBusy(true)
    setCloudSyncEnabled(next)
    setCloudSync(next)
    if (next) {
      const res = await pushPrefsToCloud()
      if (res.ok) pushAppToast('☁️ Cloud-Sync aktiviert — Einstellungen wurden gesichert', 'success')
      else        pushAppToast(`❌ Sync-Fehler: ${res.error ?? 'unbekannt'}`, 'error')
    } else {
      pushAppToast('☁️ Cloud-Sync deaktiviert — lokale Einstellungen bleiben erhalten', 'info')
    }
    setSyncBusy(false)
  }

  async function handlePullFromCloud() {
    setSyncBusy(true)
    const result = await pullPrefsFromCloud()
    setSyncBusy(false)
    if (result) pushAppToast('☁️ Einstellungen aus der Cloud geladen', 'success')
    else        pushAppToast('Keine Cloud-Einstellungen gefunden oder nicht eingeloggt', 'info')
  }

  const reset = () => writeDesignPrefs(DEFAULT_PREFS)

  return (
    <div className="pk-card design-custom-panel" style={{ padding: 'clamp(12px, 4vw, 20px)', overflow: 'hidden' }}>
      {/* Kopfzeile */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🎨 Design & Erscheinungsbild</div>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4, lineHeight: 1.5 }}>
            Alle Module sind <strong>einzeln ein-/ausschaltbar</strong> — bei AUS bleibt der aktuelle Look erhalten.
          </div>
        </div>
        <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
          ↺ Alles zurücksetzen
        </button>
      </div>

      {/* Live-Vorschau */}
      <LivePreview prefs={prefs} />

      {/* Tabs — Mobile: natives Select, Desktop: Pill-Grid */}
      {/* Native Select für Mobile (≤640px) — keine Scroll-Probleme */}
      <div className="design-panel-tabs-mobile" style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, color: '#aeb9c8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
          Bereich wählen
        </label>
        <select
          value={tab}
          onChange={e => setTab(e.target.value as PanelTab)}
          className="pk-input"
          style={{
            width: '100%',
            fontSize: 14, fontWeight: 700,
            padding: '12px 14px',
            appearance: 'none',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%236cb6ff\' d=\'M6 8L0 0h12z\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 16px center',
            backgroundSize: '10px',
            paddingRight: 40,
          }}
        >
          {PANEL_TABS.map(t => {
            const moduleEnabled =
              t.id === 'benachrichtigungen' ? prefs.notifications.enabled :
              t.id === 'typografie' ? prefs.typography.enabled :
              t.id === 'effekte' ? prefs.effects.enabled :
              t.id === 'farben' ? prefs.colors.enabled :
              t.id === 'icons-layout' ? (prefs.icons.enabled || prefs.layout.enabled) :
              false
            return (
              <option key={t.id} value={t.id}>
                {t.icon} {t.label}{moduleEnabled && t.id !== 'allgemein' ? ' ●' : ''}
              </option>
            )
          })}
        </select>
      </div>

      {/* Pill-Tabs für Desktop (>640px) */}
      <div className="design-panel-tabs-desktop" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 6,
        marginBottom: 16,
      }}>
        {PANEL_TABS.map(t => {
          const active = tab === t.id
          const moduleEnabled =
            t.id === 'benachrichtigungen' ? prefs.notifications.enabled :
            t.id === 'typografie' ? prefs.typography.enabled :
            t.id === 'effekte' ? prefs.effects.enabled :
            t.id === 'farben' ? prefs.colors.enabled :
            t.id === 'icons-layout' ? (prefs.icons.enabled || prefs.layout.enabled) :
            false
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                all: 'unset', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 12px', borderRadius: 10,
                background: active ? 'rgba(22,132,255,.18)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${active ? 'rgba(22,132,255,.45)' : 'rgba(255,255,255,.06)'}`,
                color: active ? '#6cb6ff' : '#aeb9c8',
                fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {moduleEnabled && t.id !== 'allgemein' && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25d366', boxShadow: '0 0 6px #25d366' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Tab: Allgemein (DP11 — bestehender Inhalt) ─────────────────── */}
      {tab === 'allgemein' && (
        <div>
          <SectionTitle>1) Theme</SectionTitle>
          <div role="radiogroup" aria-label="Design-Theme" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
            {THEME_OPTIONS.map(opt => {
              const active = prefs.theme === opt.id
              return (
                <button
                  key={opt.id} role="radio" aria-checked={active}
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

          <SectionTitle>2) Auto-Theme (System)</SectionTitle>
          <Toggle
            checked={prefs.autoTheme}
            onChange={() => patchDesignPrefs({ autoTheme: !prefs.autoTheme })}
            label="Folgt dem Betriebssystem"
            desc={`Bei aktiviertem Dunkelmodus → Klassisch (dunkel). Sonst → Hell. Überschreibt die manuelle Theme-Wahl. Aktuell: ${
              (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '🌑 Dunkelmodus erkannt' : '☀️ Hellmodus erkannt'
            }`}
          />

          <SectionTitle>3) Akzentfarbe {!isGlow && <span style={{ color: '#6c7a8c', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(nur im Glow-Theme aktiv)</span>}</SectionTitle>
          <div role="radiogroup" aria-label="Akzentfarbe" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', opacity: isGlow ? 1 : .5 }}>
            {ACCENT_OPTIONS.map(opt => {
              const active = prefs.accent === opt.id
              return (
                <button
                  key={opt.id} role="radio" aria-checked={active}
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

          <SectionTitle>4) Lichteffekt-Intensität {!isGlow && <span style={{ color: '#6c7a8c', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(nur im Glow-Theme aktiv)</span>}</SectionTitle>
          <div role="radiogroup" aria-label="Glow-Intensität" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', opacity: isGlow ? 1 : .5 }}>
            {INTENSITY_OPTIONS.map(opt => {
              const active = prefs.glowIntensity === opt.id
              return (
                <button
                  key={opt.id} role="radio" aria-checked={active}
                  onClick={() => patchDesignPrefs({ glowIntensity: opt.id })}
                  disabled={!isGlow}
                  style={{
                    all: 'unset', cursor: isGlow ? 'pointer' : 'not-allowed',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: 10, borderRadius: 10,
                    border: `2px solid ${active ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                    background: active ? 'rgba(22,132,255,.10)' : 'rgba(255,255,255,.02)',
                    textAlign: 'center', transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{opt.title}</div>
                  <div style={{ fontSize: 10, color: '#aeb9c8' }}>{opt.description}</div>
                </button>
              )
            })}
          </div>

          <SectionTitle>5) Feinabstimmung (alle einzeln schaltbar)</SectionTitle>
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
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fbff' }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, lineHeight: 1.4 }}>{opt.description}</div>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={active} aria-label={opt.title}
                    onClick={() => patchDesignPrefs({ features: { [opt.id]: !active } as Partial<DesignFeatures> })}
                    style={{
                      position: 'relative', width: 44, height: 24, flexShrink: 0,
                      borderRadius: 999,
                      border: `1px solid ${active ? 'rgba(22,132,255,.55)' : 'rgba(255,255,255,.18)'}`,
                      background: active ? 'rgba(22,132,255,.45)' : 'rgba(255,255,255,.06)',
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: active ? 22 : 2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                      transition: 'left .15s',
                    }} />
                  </button>
                </label>
              )
            })}
          </div>

          {/* ── DP12: Cloud-Sync ─────────────────────────────────── */}
          <SectionTitle>6) ☁️ Cloud-Sync (Multi-Device)</SectionTitle>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: cloudSync ? 'linear-gradient(180deg, rgba(22,132,255,.10), rgba(22,132,255,.02))' : 'rgba(255,255,255,.02)',
            border: `1px solid ${cloudSync ? 'rgba(22,132,255,.35)' : 'rgba(255,255,255,.06)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: cloudSync ? '#6cb6ff' : '#f8fbff' }}>
                  {cloudSync ? '✅ Cloud-Sync aktiv' : 'Cloud-Sync aktivieren'}
                </div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4, lineHeight: 1.5 }}>
                  Speichert deine Design-Einstellungen auf allen Geräten. Lokale Einstellungen bleiben primärer Cache (offline funktioniert weiter).
                </div>
              </div>
              <button
                type="button" role="switch" aria-checked={cloudSync}
                onClick={handleCloudSyncToggle}
                disabled={syncBusy}
                style={{
                  position: 'relative', width: 52, height: 28, flexShrink: 0,
                  borderRadius: 999,
                  border: `1px solid ${cloudSync ? 'rgba(22,132,255,.7)' : 'rgba(255,255,255,.2)'}`,
                  background: cloudSync ? 'rgba(22,132,255,.55)' : 'rgba(255,255,255,.06)',
                  cursor: syncBusy ? 'wait' : 'pointer', transition: 'all .15s',
                  opacity: syncBusy ? .6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: cloudSync ? 26 : 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.3)',
                  transition: 'left .15s',
                }} />
              </button>
            </div>
            {cloudSync && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="pk-btn-ghost" onClick={handlePullFromCloud} disabled={syncBusy} style={{ fontSize: 12, padding: '6px 12px' }}>
                  ⬇️ Aus Cloud laden
                </button>
                <button className="pk-btn-ghost" onClick={() => { void pushPrefsToCloud().then(r => pushAppToast(r.ok ? '☁️ Erfolgreich hochgeladen' : `Fehler: ${r.error}`, r.ok ? 'success' : 'error')) }} disabled={syncBusy} style={{ fontSize: 12, padding: '6px 12px' }}>
                  ⬆️ Manuell hochladen
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 16, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.04)' }}>
            💡 Direkt-Umschaltung per URL:{' '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=classic</code>{', '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=modern</code>{', '}
            <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=glow</code>.
          </div>
        </div>
      )}

      {/* ─── Tab: Benachrichtigungen ─────────────────────────────────────── */}
      {tab === 'benachrichtigungen' && (() => {
        const n = prefs.notifications
        const set = (patch: Partial<typeof n>) => patchDesignPrefs({ notifications: patch })
        const reset = () => patchDesignPrefs({ notifications: { ...DEFAULT_PREFS.notifications } })
        return (
          <div>
            <ModuleMasterToggle
              enabled={n.enabled}
              onToggle={() => set({ enabled: !n.enabled })}
              title="Benachrichtigungs-Design aktivieren"
              description="Wenn AUS: aktuelles Toast-Design bleibt unverändert. Wenn AN: Position, Animation, Dauer und Größe sind individuell einstellbar."
            />

            <SectionTitle>Position</SectionTitle>
            <PillRadio<ToastPosition>
              value={n.toastPosition} disabled={!n.enabled} minWidth={120}
              options={[
                { id: 'top-right',     label: '↗ Oben rechts' },
                { id: 'top-center',    label: '↑ Oben mitte' },
                { id: 'bottom-right',  label: '↘ Unten rechts' },
                { id: 'bottom-center', label: '↓ Unten mitte' },
              ]}
              onChange={v => set({ toastPosition: v })}
            />

            <SectionTitle>Animation</SectionTitle>
            <PillRadio<ToastAnimation>
              value={n.toastAnimation} disabled={!n.enabled} minWidth={90}
              options={[
                { id: 'fade',   label: 'Fade-In' },
                { id: 'slide',  label: 'Slide-In' },
                { id: 'pop',    label: 'Pop' },
                { id: 'bounce', label: 'Bounce' },
              ]}
              onChange={v => set({ toastAnimation: v })}
            />

            <SectionTitle>Verweildauer</SectionTitle>
            <PillRadio<ToastDuration>
              value={n.toastDuration} disabled={!n.enabled} minWidth={90}
              options={[
                { id: 3000, label: '3 Sek.' },
                { id: 5000, label: '5 Sek.' },
                { id: 8000, label: '8 Sek.' },
                { id: 0,    label: 'Manuell' },
              ]}
              onChange={v => set({ toastDuration: v })}
            />

            <SectionTitle>Größe</SectionTitle>
            <PillRadio<ToastSize>
              value={n.toastSize} disabled={!n.enabled} minWidth={100}
              options={[
                { id: 'compact', label: 'Kompakt', sub: 'Klein' },
                { id: 'normal',  label: 'Normal',  sub: 'Standard' },
                { id: 'large',   label: 'Groß',    sub: 'Auffällig' },
              ]}
              onChange={v => set({ toastSize: v })}
            />

            <SectionTitle>Sound</SectionTitle>
            <div style={{ opacity: n.enabled ? 1 : .45, pointerEvents: n.enabled ? 'auto' : 'none' }}>
              <Toggle
                checked={n.toastSound}
                onChange={() => set({ toastSound: !n.toastSound })}
                label="Sound bei Benachrichtigung"
                desc="Spielt einen kurzen Ton ab, wenn ein Toast erscheint (nur in unterstützten Browsern)."
              />
            </div>

            <SectionTitle>🔔 Live-Vorschau</SectionTitle>
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(22,132,255,.05)', border: '1px solid rgba(22,132,255,.15)',
            }}>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 10, lineHeight: 1.5 }}>
                Teste deine Einstellungen — Position, Animation, Größe, Dauer und Sound werden direkt angewendet.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="pk-btn-ghost"
                  onClick={() => pushAppToast('✅ Aktion erfolgreich ausgeführt', 'success')}
                  style={{ fontSize: 12, padding: '8px 14px', borderColor: 'rgba(37,211,102,.4)', color: '#4ddb7e' }}
                >
                  ✅ Erfolg testen
                </button>
                <button
                  className="pk-btn-ghost"
                  onClick={() => pushAppToast('⚠️ Fehler — Bitte erneut versuchen', 'error')}
                  style={{ fontSize: 12, padding: '8px 14px', borderColor: 'rgba(255,80,80,.4)', color: '#ff8080' }}
                >
                  ⚠️ Fehler testen
                </button>
                <button
                  className="pk-btn-ghost"
                  onClick={() => pushAppToast('ℹ️ Information zur Benachrichtigung', 'info')}
                  style={{ fontSize: 12, padding: '8px 14px', borderColor: 'rgba(22,132,255,.4)', color: '#6cb6ff' }}
                >
                  ℹ️ Info testen
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Modul zurücksetzen
              </button>
            </div>
          </div>
        )
      })()}

      {/* ─── Tab: Typografie ─────────────────────────────────────────────── */}
      {tab === 'typografie' && (() => {
        const ty = prefs.typography
        const set = (patch: Partial<typeof ty>) => patchDesignPrefs({ typography: patch })
        const reset = () => patchDesignPrefs({ typography: { ...DEFAULT_PREFS.typography } })
        return (
          <div>
            <ModuleMasterToggle
              enabled={ty.enabled}
              onToggle={() => set({ enabled: !ty.enabled })}
              title="Typografie-Anpassung aktivieren"
              description="Wenn AUS: aktuelle Schriftgrößen bleiben unverändert (14px Base). Wenn AN: alle Werte werden global angewendet."
            />

            <SectionTitle>Basis-Schriftgröße</SectionTitle>
            <PillRadio<FontBase>
              value={ty.baseFontSize} disabled={!ty.enabled} minWidth={80}
              options={[
                { id: 12, label: '12px', sub: 'Klein' },
                { id: 14, label: '14px', sub: 'Standard' },
                { id: 16, label: '16px', sub: 'Groß' },
                { id: 18, label: '18px', sub: 'Sehr groß' },
              ]}
              onChange={v => set({ baseFontSize: v })}
            />

            <SectionTitle>Überschriften-Skalierung</SectionTitle>
            <PillRadio<HeadingScale>
              value={ty.headingScale} disabled={!ty.enabled} minWidth={90}
              options={[
                { id: 0.8, label: '0.8×', sub: 'Kleiner' },
                { id: 1,   label: '1×',   sub: 'Standard' },
                { id: 1.2, label: '1.2×', sub: 'Größer' },
                { id: 1.5, label: '1.5×', sub: 'XL' },
              ]}
              onChange={v => set({ headingScale: v })}
            />

            <SectionTitle>Zeilenhöhe</SectionTitle>
            <PillRadio<LineHeight>
              value={ty.lineHeight} disabled={!ty.enabled} minWidth={90}
              options={[
                { id: 1.4, label: '1.4',  sub: 'Eng' },
                { id: 1.5, label: '1.5',  sub: 'Standard' },
                { id: 1.7, label: '1.7',  sub: 'Locker' },
                { id: 2,   label: '2.0',  sub: 'Sehr locker' },
              ]}
              onChange={v => set({ lineHeight: v })}
            />

            <SectionTitle>Buchstaben-Abstand</SectionTitle>
            <PillRadio<LetterSpacing>
              value={ty.letterSpacing} disabled={!ty.enabled} minWidth={90}
              options={[
                { id: 0,    label: '0',    sub: 'Eng' },
                { id: 0.02, label: '0.02', sub: 'Standard' },
                { id: 0.05, label: '0.05', sub: 'Weit' },
              ]}
              onChange={v => set({ letterSpacing: v })}
            />

            <SectionTitle>Button-Textgröße</SectionTitle>
            <PillRadio<ButtonFontSize>
              value={ty.buttonFontSize} disabled={!ty.enabled} minWidth={100}
              options={[
                { id: 'small',  label: 'Klein',   sub: '12px' },
                { id: 'normal', label: 'Normal',  sub: '14px' },
                { id: 'large',  label: 'Groß',    sub: '16px' },
              ]}
              onChange={v => set({ buttonFontSize: v })}
            />

            <SectionTitle>Schriftfamilie</SectionTitle>
            <div role="radiogroup" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', opacity: !ty.enabled ? .45 : 1 }}>
              {FONT_OPTIONS.map(opt => {
                const active = ty.fontFamily === opt.id
                return (
                  <button
                    key={opt.id} role="radio" aria-checked={active}
                    disabled={!ty.enabled}
                    onClick={() => set({ fontFamily: opt.id })}
                    style={{
                      all: 'unset', cursor: !ty.enabled ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                      border: `2px solid ${active ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                      background: active ? 'rgba(22,132,255,.10)' : 'rgba(255,255,255,.02)',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 18, fontFamily: FONT_FAMILY_PREVIEW[opt.id], fontWeight: 700, color: active ? '#6cb6ff' : '#f8fbff' }}>
                      {opt.sample}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: '#aeb9c8' }}>{opt.sub}</div>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Modul zurücksetzen
              </button>
            </div>
          </div>
        )
      })()}

      {/* ─── Tab: Effekte ────────────────────────────────────────────────── */}
      {tab === 'effekte' && (() => {
        const ef = prefs.effects
        const set = (patch: Partial<typeof ef>) => patchDesignPrefs({ effects: patch })
        const reset = () => patchDesignPrefs({ effects: { ...DEFAULT_PREFS.effects } })
        return (
          <div>
            <ModuleMasterToggle
              enabled={ef.enabled}
              onToggle={() => set({ enabled: !ef.enabled })}
              title="Effekte & Animationen aktivieren"
              description="Wenn AUS: aktuelle Animationen bleiben. Wenn AN: Geschwindigkeit, Blur, Schatten und Hover-Effekte werden gesteuert."
            />

            <SectionTitle>Animations-Geschwindigkeit</SectionTitle>
            <PillRadio<AnimationSpeed>
              value={ef.animationSpeed} disabled={!ef.enabled} minWidth={90}
              options={[
                { id: 'none',   label: 'Aus',     sub: '0ms' },
                { id: 'slow',   label: 'Langsam', sub: '400ms' },
                { id: 'normal', label: 'Normal',  sub: '200ms' },
                { id: 'fast',   label: 'Schnell', sub: '100ms' },
              ]}
              onChange={v => set({ animationSpeed: v })}
            />

            <SectionTitle>Blur-Effekt (Modals, Backdrop)</SectionTitle>
            <PillRadio<BlurIntensity>
              value={ef.blurIntensity} disabled={!ef.enabled} minWidth={90}
              options={[
                { id: 'off',    label: 'Aus',     sub: '0px' },
                { id: 'subtle', label: 'Dezent',  sub: '2px' },
                { id: 'medium', label: 'Mittel',  sub: '6px' },
                { id: 'strong', label: 'Stark',   sub: '12px' },
              ]}
              onChange={v => set({ blurIntensity: v })}
            />

            <SectionTitle>Schatten-Tiefe</SectionTitle>
            <PillRadio<ShadowDepth>
              value={ef.shadowDepth} disabled={!ef.enabled} minWidth={100}
              options={[
                { id: 'none',     label: 'Kein',      sub: '–' },
                { id: 'flat',     label: 'Flach',     sub: 'Dezent' },
                { id: 'medium',   label: 'Mittel',    sub: 'Standard' },
                { id: 'dramatic', label: 'Dramatisch', sub: 'Stark' },
              ]}
              onChange={v => set({ shadowDepth: v })}
            />

            <SectionTitle>Hover-Aktion</SectionTitle>
            <PillRadio<HoverAction>
              value={ef.hoverAction} disabled={!ef.enabled} minWidth={100}
              options={[
                { id: 'none',      label: 'Keine' },
                { id: 'scale',     label: 'Vergrößern' },
                { id: 'lift',      label: 'Anheben' },
                { id: 'highlight', label: 'Hervorheben' },
              ]}
              onChange={v => set({ hoverAction: v })}
            />

            <SectionTitle>Scroll-Effekte</SectionTitle>
            <PillRadio<ScrollEffects>
              value={ef.scrollEffects} disabled={!ef.enabled} minWidth={100}
              options={[
                { id: 'none',     label: 'Keine' },
                { id: 'parallax', label: 'Parallax' },
                { id: 'fade',     label: 'Fade-In' },
                { id: 'scale',    label: 'Scale-In' },
              ]}
              onChange={v => set({ scrollEffects: v })}
            />

            <SectionTitle>Glasmorphismus</SectionTitle>
            <div style={{ opacity: ef.enabled ? 1 : .45, pointerEvents: ef.enabled ? 'auto' : 'none' }}>
              <Toggle
                checked={ef.glassmorphism}
                onChange={() => set({ glassmorphism: !ef.glassmorphism })}
                label="Frosted-Glass auf Karten"
                desc="Karten bekommen einen Milchglas-Effekt (Performance-intensiv auf älteren Geräten)."
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Modul zurücksetzen
              </button>
            </div>
          </div>
        )
      })()}

      {/* ─── Tab: Farben ─────────────────────────────────────────────────── */}
      {tab === 'farben' && (() => {
        const co = prefs.colors
        const set = (patch: Partial<typeof co>) => patchDesignPrefs({ colors: patch })
        const reset = () => patchDesignPrefs({ colors: { ...DEFAULT_PREFS.colors } })
        return (
          <div>
            <ModuleMasterToggle
              enabled={co.enabled}
              onToggle={() => set({ enabled: !co.enabled })}
              title="Farbschema aktivieren"
              description="Wenn AUS: Standard-Farben (#1684ff usw.) bleiben. Wenn AN: deine eigenen Farben werden für Akzente und Status-Indikatoren genutzt."
            />

            <SectionTitle>Schnell-Presets</SectionTitle>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', opacity: !co.enabled ? .45 : 1 }}>
              {COLOR_PRESETS.map(preset => {
                const isActive = co.primaryAccent === preset.primary && co.backgroundColor === preset.bg
                return (
                  <button
                    key={preset.id}
                    disabled={!co.enabled}
                    onClick={() => set({ primaryAccent: preset.primary, secondaryAccent: preset.secondary, errorColor: preset.error, successColor: preset.success, backgroundColor: preset.bg })}
                    style={{
                      all: 'unset', cursor: !co.enabled ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                      border: `2px solid ${isActive ? preset.primary : 'rgba(255,255,255,.08)'}`,
                      background: isActive ? `${preset.primary}18` : 'rgba(255,255,255,.02)',
                      boxShadow: isActive ? `0 4px 14px ${preset.primary}30` : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 3 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: preset.primary }} />
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: preset.secondary }} />
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: preset.success }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{preset.label}</div>
                  </button>
                )
              })}
            </div>

            <SectionTitle>Eigene Akzent-Farben</SectionTitle>
            <div style={{ display: 'grid', gap: 8 }}>
              <ColorField label="Primär (Aktionen, Buttons)" value={co.primaryAccent}   disabled={!co.enabled} onChange={v => set({ primaryAccent: v })} />
              <ColorField label="Sekundär (Info, Hervorhebung)" value={co.secondaryAccent} disabled={!co.enabled} onChange={v => set({ secondaryAccent: v })} />
              <ColorField label="Fehler / Warnung"            value={co.errorColor}     disabled={!co.enabled} onChange={v => set({ errorColor: v })} />
              <ColorField label="Erfolg / Bestätigung"        value={co.successColor}   disabled={!co.enabled} onChange={v => set({ successColor: v })} />
            </div>

            {/* Kontrast-Warnung — WCAG AA (4.5:1 für Normal-Text) */}
            {co.enabled && (() => {
              const ratio = wcagContrastVsWhite(co.primaryAccent)
              const ok = ratio >= 4.5
              return !ok ? (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255,150,0,.10)', border: '1px solid rgba(255,150,0,.35)',
                  fontSize: 12, color: '#f59e0b', lineHeight: 1.5,
                }}>
                  ⚠️ <strong>Kontrast-Warnung:</strong> Die Primärfarbe hat nur {ratio}:1 Kontrast zu Weiß
                  (WCAG AA benötigt 4.5:1 für Fließtext). Button-Beschriftungen könnten schwer lesbar sein.
                </div>
              ) : null
            })()}

            <SectionTitle>Hintergrund-Variante</SectionTitle>
            <PillRadio<BackgroundColor>
              value={co.backgroundColor} disabled={!co.enabled} minWidth={110}
              options={[
                { id: 'ultra-dark', label: 'Ultra-Dunkel', sub: 'OLED' },
                { id: 'standard',   label: 'Standard',     sub: 'Aktuell' },
                { id: 'warm',       label: 'Warm-Dunkel',  sub: 'Sanft' },
                { id: 'warm-tint',  label: 'Warm-Tint',    sub: 'Gelblich' },
              ]}
              onChange={v => set({ backgroundColor: v })}
            />

            <div style={{ marginTop: 16 }}>
              <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Modul zurücksetzen
              </button>
            </div>
          </div>
        )
      })()}

      {/* ─── Tab: Icons & Layout ─────────────────────────────────────────── */}
      {tab === 'icons-layout' && (() => {
        const ic = prefs.icons
        const la = prefs.layout
        const setIc = (patch: Partial<typeof ic>) => patchDesignPrefs({ icons: patch })
        const setLa = (patch: Partial<typeof la>) => patchDesignPrefs({ layout: patch })
        const resetIc = () => patchDesignPrefs({ icons: { ...DEFAULT_PREFS.icons } })
        const resetLa = () => patchDesignPrefs({ layout: { ...DEFAULT_PREFS.layout } })
        return (
          <div>
            <ModuleMasterToggle
              enabled={ic.enabled}
              onToggle={() => setIc({ enabled: !ic.enabled })}
              title="Icon-Anpassung aktivieren"
              description="Wenn AUS: Emoji-Icons (Standard) bleiben. Wenn AN: Stil, Größe und Status-Indikatoren werden global angewendet."
            />

            <SectionTitle>Icon-Stil</SectionTitle>
            <PillRadio<IconStyle>
              value={ic.style} disabled={!ic.enabled} minWidth={100}
              options={[
                { id: 'emoji', label: 'Emoji',  sub: '📦 🧾 🛠️' },
                { id: 'svg',   label: 'SVG',    sub: 'Lucide-Icons' },
                { id: 'text',  label: 'Text',   sub: 'LG / BR / WS' },
              ]}
              onChange={v => setIc({ style: v })}
            />

            <SectionTitle>Icon-Größe</SectionTitle>
            <PillRadio<IconSize>
              value={ic.size} disabled={!ic.enabled} minWidth={100}
              options={[
                { id: 'small',  label: 'Klein',  sub: '14px' },
                { id: 'normal', label: 'Normal', sub: '18px' },
                { id: 'large',  label: 'Groß',   sub: '22px' },
              ]}
              onChange={v => setIc({ size: v })}
            />

            <SectionTitle>Status-Indikator</SectionTitle>
            <PillRadio<StatusIndicator>
              value={ic.statusIndicator} disabled={!ic.enabled} minWidth={100}
              options={[
                { id: 'dot',      label: 'Punkt',       sub: '●' },
                { id: 'circle',   label: 'Kreis',       sub: '○' },
                { id: 'dot-text', label: 'Punkt+Text',  sub: '● ok' },
                { id: 'icon',     label: 'Icon',        sub: '✓ / ✕' },
              ]}
              onChange={v => setIc({ statusIndicator: v })}
            />

            <div style={{ marginTop: 12 }}>
              <button className="pk-btn-ghost" onClick={resetIc} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Icons zurücksetzen
              </button>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '24px 0' }} />

            <ModuleMasterToggle
              enabled={la.enabled}
              onToggle={() => setLa({ enabled: !la.enabled })}
              title="Layout-Dichte aktivieren"
              description="Wenn AUS: aktuelles Layout bleibt. Wenn AN: Padding und Abstände werden angepasst."
            />

            <SectionTitle>Dichte</SectionTitle>
            <PillRadio<LayoutDensity>
              value={la.density} disabled={!la.enabled} minWidth={120}
              options={[
                { id: 'compact',     label: 'Kompakt',     sub: 'Mehr Daten' },
                { id: 'comfortable', label: 'Komfortabel', sub: 'Standard' },
                { id: 'spacious',    label: 'Geräumig',    sub: 'Lesbarer' },
              ]}
              onChange={v => setLa({ density: v })}
            />

            <div style={{ marginTop: 16 }}>
              <button className="pk-btn-ghost" onClick={resetLa} style={{ fontSize: 12, padding: '6px 12px' }}>
                ↺ Layout zurücksetzen
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
