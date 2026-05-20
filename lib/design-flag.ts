// Design-Prefs-System (vollständig).
// Stufenweise gewachsen:
//   M1: Boolean useDesignV2()
//   G1: 3 Themes 'classic' | 'modern' | 'glow'
//   DP1: vollständiges Prefs-Objekt mit Accent, Glow-Intensität, 7 Features
//   DP12: Personalisierungs-Module (notifications, typography, effects, colors, icons, layout)
//         Jedes Modul hat `enabled: boolean` — bei false bleibt aktuelles Design erhalten.
//
// Alle vorherigen APIs (useDesignV2, useDesignTheme, setDesignV2, setDesignTheme,
// readDesignV2, readDesignTheme) bleiben rückwärtskompatibel.
//
// Storage:
//   localStorage 'pk_design_prefs' → JSON (DesignPrefs)
//   Legacy 'pk_design_theme' und 'pk_design_v2' werden gespiegelt.
//
// Body-Attribute (vom Hook gesetzt):
//   data-design          = 'modern' | 'glow' (oder leer bei 'classic')
//   data-accent          = 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red'
//   data-glow-intensity  = 'off' | 'subtle' | 'medium' | 'strong'
//   data-feat-pills/focus/toasts/kpi/sticky/sidebar = 'on' (oder fehlend)
//   data-bg-light        = 'on'
//   data-pers-notif/typo/effects/colors/icons/layout = 'on' (DP12, oder fehlend)
//
// CSS-Variablen (auf :root, nur wenn Modul enabled):
//   --user-toast-pos, --user-toast-duration, --user-font-base,
//   --user-heading-scale, --user-line-height, --user-letter-spacing,
//   --user-anim-speed, --user-blur, --user-shadow, --user-density-padding,
//   --user-primary, --user-secondary, --user-error, --user-success, --user-bg

'use client'

import { useEffect, useState } from 'react'

export type DesignTheme = 'classic' | 'modern' | 'glow'
export type DesignAccent = 'blue' | 'cyan' | 'purple' | 'green' | 'orange' | 'red'
export type GlowIntensity = 'off' | 'subtle' | 'medium' | 'strong'

export interface DesignFeatures {
  statusPills: boolean       // A5
  unifiedFocus: boolean      // A6
  polishedToasts: boolean    // A7
  unifiedKpi: boolean        // P1
  stickyHeaders: boolean     // P2
  smoothSidebar: boolean     // P3
  lightBackground: boolean   // P4
}

// ─── DP12: Personalisierungs-Module ───────────────────────────────────────
export type ToastPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
export type ToastAnimation = 'fade' | 'slide' | 'pop' | 'bounce'
export type ToastDuration = 3000 | 5000 | 8000 | 0  // 0 = manuell schließen
export type ToastSize = 'compact' | 'normal' | 'large'

export interface NotificationPrefs {
  enabled: boolean
  toastPosition: ToastPosition
  toastAnimation: ToastAnimation
  toastDuration: ToastDuration
  toastSize: ToastSize
  toastSound: boolean
}

export type FontBase = 12 | 14 | 16 | 18
export type HeadingScale = 0.8 | 1 | 1.2 | 1.5
export type LineHeight = 1.4 | 1.5 | 1.7 | 2
export type LetterSpacing = 0 | 0.02 | 0.05
export type ButtonFontSize = 'small' | 'normal' | 'large'

export interface TypographyPrefs {
  enabled: boolean
  baseFontSize: FontBase
  headingScale: HeadingScale
  lineHeight: LineHeight
  letterSpacing: LetterSpacing
  buttonFontSize: ButtonFontSize
}

export type AnimationSpeed = 'none' | 'slow' | 'normal' | 'fast'
export type BlurIntensity = 'off' | 'subtle' | 'medium' | 'strong'
export type ShadowDepth = 'none' | 'flat' | 'medium' | 'dramatic'
export type ScrollEffects = 'none' | 'parallax' | 'fade' | 'scale'
export type HoverAction = 'none' | 'scale' | 'lift' | 'highlight'

export interface EffectsPrefs {
  enabled: boolean
  animationSpeed: AnimationSpeed
  blurIntensity: BlurIntensity
  shadowDepth: ShadowDepth
  glassmorphism: boolean
  scrollEffects: ScrollEffects
  hoverAction: HoverAction
}

export type BackgroundColor = 'ultra-dark' | 'standard' | 'warm' | 'warm-tint'

export interface ColorPrefs {
  enabled: boolean
  primaryAccent: string   // Hex
  secondaryAccent: string
  errorColor: string
  successColor: string
  backgroundColor: BackgroundColor
}

export type IconStyle = 'emoji' | 'svg' | 'text'
export type IconSize = 'small' | 'normal' | 'large'
export type StatusIndicator = 'dot' | 'circle' | 'dot-text' | 'icon'

export interface IconPrefs {
  enabled: boolean
  style: IconStyle
  size: IconSize
  statusIndicator: StatusIndicator
}

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious'

export interface LayoutPrefs {
  enabled: boolean
  density: LayoutDensity
}

export interface DesignPrefs {
  theme: DesignTheme
  accent: DesignAccent
  glowIntensity: GlowIntensity
  features: DesignFeatures
  // DP12 — Personalisierungs-Module (jedes mit eigenem enabled-Master-Toggle)
  notifications: NotificationPrefs
  typography: TypographyPrefs
  effects: EffectsPrefs
  colors: ColorPrefs
  icons: IconPrefs
  layout: LayoutPrefs
}

// ─── Defaults — alle Module DISABLED ──────────────────────────────────────
// Wichtig: Defaults sind so gewählt, dass auch bei `enabled: true` der aktuelle
// Look erhalten bleibt (z.B. baseFontSize 14, animation normal etc.).
// Reset → alles enabled:false → 100% aktueller Stand.
export const DEFAULT_PREFS: DesignPrefs = {
  theme: 'classic',
  accent: 'blue',
  glowIntensity: 'medium',
  features: {
    statusPills: false,
    unifiedFocus: false,
    polishedToasts: false,
    unifiedKpi: false,
    stickyHeaders: false,
    smoothSidebar: false,
    lightBackground: false,
  },
  notifications: {
    enabled: false,
    toastPosition: 'bottom-right',
    toastAnimation: 'fade',
    toastDuration: 5000,
    toastSize: 'normal',
    toastSound: false,
  },
  typography: {
    enabled: false,
    baseFontSize: 14,
    headingScale: 1,
    lineHeight: 1.5,
    letterSpacing: 0,
    buttonFontSize: 'normal',
  },
  effects: {
    enabled: false,
    animationSpeed: 'normal',
    blurIntensity: 'medium',
    shadowDepth: 'medium',
    glassmorphism: false,
    scrollEffects: 'none',
    hoverAction: 'none',
  },
  colors: {
    enabled: false,
    primaryAccent: '#1684ff',
    secondaryAccent: '#20c8ff',
    errorColor: '#ff5050',
    successColor: '#25d366',
    backgroundColor: 'standard',
  },
  icons: {
    enabled: false,
    style: 'emoji',
    size: 'normal',
    statusIndicator: 'dot',
  },
  layout: {
    enabled: false,
    density: 'comfortable',
  },
}

const LS_KEY_PREFS = 'pk_design_prefs'
const LS_KEY_THEME = 'pk_design_theme'
const LS_KEY_LEGACY = 'pk_design_v2'
const URL_KEY = 'design'

const VALID_THEMES: DesignTheme[] = ['classic', 'modern', 'glow']
const VALID_ACCENTS: DesignAccent[] = ['blue', 'cyan', 'purple', 'green', 'orange', 'red']
const VALID_INTENSITIES: GlowIntensity[] = ['off', 'subtle', 'medium', 'strong']

// DP12 — Validierungs-Sets
const VALID_TOAST_POSITIONS: ToastPosition[] = ['top-right', 'top-center', 'bottom-right', 'bottom-center']
const VALID_TOAST_ANIMS: ToastAnimation[] = ['fade', 'slide', 'pop', 'bounce']
const VALID_TOAST_DURATIONS: ToastDuration[] = [3000, 5000, 8000, 0]
const VALID_TOAST_SIZES: ToastSize[] = ['compact', 'normal', 'large']
const VALID_FONT_BASES: FontBase[] = [12, 14, 16, 18]
const VALID_HEADING_SCALES: HeadingScale[] = [0.8, 1, 1.2, 1.5]
const VALID_LINE_HEIGHTS: LineHeight[] = [1.4, 1.5, 1.7, 2]
const VALID_LETTER_SPACINGS: LetterSpacing[] = [0, 0.02, 0.05]
const VALID_BUTTON_SIZES: ButtonFontSize[] = ['small', 'normal', 'large']
const VALID_ANIM_SPEEDS: AnimationSpeed[] = ['none', 'slow', 'normal', 'fast']
const VALID_BLURS: BlurIntensity[] = ['off', 'subtle', 'medium', 'strong']
const VALID_SHADOWS: ShadowDepth[] = ['none', 'flat', 'medium', 'dramatic']
const VALID_SCROLL_EFFECTS: ScrollEffects[] = ['none', 'parallax', 'fade', 'scale']
const VALID_HOVER_ACTIONS: HoverAction[] = ['none', 'scale', 'lift', 'highlight']
const VALID_BG_COLORS: BackgroundColor[] = ['ultra-dark', 'standard', 'warm', 'warm-tint']
const VALID_ICON_STYLES: IconStyle[] = ['emoji', 'svg', 'text']
const VALID_ICON_SIZES: IconSize[] = ['small', 'normal', 'large']
const VALID_STATUS_INDICATORS: StatusIndicator[] = ['dot', 'circle', 'dot-text', 'icon']
const VALID_DENSITIES: LayoutDensity[] = ['compact', 'comfortable', 'spacious']

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function normalizeTheme(value: unknown): DesignTheme | null {
  if (typeof value === 'string' && VALID_THEMES.includes(value as DesignTheme)) return value as DesignTheme
  if (value === 'v2') return 'modern'
  if (value === 'v1' || value === 'off') return 'classic'
  return null
}

function clone(p: DesignPrefs): DesignPrefs {
  return {
    ...p,
    features: { ...p.features },
    notifications: { ...p.notifications },
    typography: { ...p.typography },
    effects: { ...p.effects },
    colors: { ...p.colors },
    icons: { ...p.icons },
    layout: { ...p.layout },
  }
}

function pickEnum<T>(value: unknown, valid: readonly T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback
}

function pickHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback
}

function sanitizePrefs(raw: unknown): DesignPrefs {
  const out = clone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>

  // Basis
  const t = normalizeTheme(r.theme)
  if (t) out.theme = t
  if (typeof r.accent === 'string' && VALID_ACCENTS.includes(r.accent as DesignAccent)) out.accent = r.accent as DesignAccent
  if (typeof r.glowIntensity === 'string' && VALID_INTENSITIES.includes(r.glowIntensity as GlowIntensity)) out.glowIntensity = r.glowIntensity as GlowIntensity

  // Features
  const f = r.features as Record<string, unknown> | undefined
  if (f && typeof f === 'object') {
    for (const key of Object.keys(out.features) as (keyof DesignFeatures)[]) {
      if (typeof f[key] === 'boolean') out.features[key] = f[key] as boolean
    }
  }

  // DP12 — Notifications
  const n = r.notifications as Record<string, unknown> | undefined
  if (n && typeof n === 'object') {
    if (typeof n.enabled === 'boolean') out.notifications.enabled = n.enabled
    out.notifications.toastPosition = pickEnum(n.toastPosition, VALID_TOAST_POSITIONS, out.notifications.toastPosition)
    out.notifications.toastAnimation = pickEnum(n.toastAnimation, VALID_TOAST_ANIMS, out.notifications.toastAnimation)
    out.notifications.toastDuration = pickEnum(n.toastDuration, VALID_TOAST_DURATIONS, out.notifications.toastDuration)
    out.notifications.toastSize = pickEnum(n.toastSize, VALID_TOAST_SIZES, out.notifications.toastSize)
    if (typeof n.toastSound === 'boolean') out.notifications.toastSound = n.toastSound
  }

  // DP12 — Typography
  const ty = r.typography as Record<string, unknown> | undefined
  if (ty && typeof ty === 'object') {
    if (typeof ty.enabled === 'boolean') out.typography.enabled = ty.enabled
    out.typography.baseFontSize = pickEnum(ty.baseFontSize, VALID_FONT_BASES, out.typography.baseFontSize)
    out.typography.headingScale = pickEnum(ty.headingScale, VALID_HEADING_SCALES, out.typography.headingScale)
    out.typography.lineHeight = pickEnum(ty.lineHeight, VALID_LINE_HEIGHTS, out.typography.lineHeight)
    out.typography.letterSpacing = pickEnum(ty.letterSpacing, VALID_LETTER_SPACINGS, out.typography.letterSpacing)
    out.typography.buttonFontSize = pickEnum(ty.buttonFontSize, VALID_BUTTON_SIZES, out.typography.buttonFontSize)
  }

  // DP12 — Effects
  const ef = r.effects as Record<string, unknown> | undefined
  if (ef && typeof ef === 'object') {
    if (typeof ef.enabled === 'boolean') out.effects.enabled = ef.enabled
    out.effects.animationSpeed = pickEnum(ef.animationSpeed, VALID_ANIM_SPEEDS, out.effects.animationSpeed)
    out.effects.blurIntensity = pickEnum(ef.blurIntensity, VALID_BLURS, out.effects.blurIntensity)
    out.effects.shadowDepth = pickEnum(ef.shadowDepth, VALID_SHADOWS, out.effects.shadowDepth)
    if (typeof ef.glassmorphism === 'boolean') out.effects.glassmorphism = ef.glassmorphism
    out.effects.scrollEffects = pickEnum(ef.scrollEffects, VALID_SCROLL_EFFECTS, out.effects.scrollEffects)
    out.effects.hoverAction = pickEnum(ef.hoverAction, VALID_HOVER_ACTIONS, out.effects.hoverAction)
  }

  // DP12 — Colors
  const co = r.colors as Record<string, unknown> | undefined
  if (co && typeof co === 'object') {
    if (typeof co.enabled === 'boolean') out.colors.enabled = co.enabled
    out.colors.primaryAccent = pickHex(co.primaryAccent, out.colors.primaryAccent)
    out.colors.secondaryAccent = pickHex(co.secondaryAccent, out.colors.secondaryAccent)
    out.colors.errorColor = pickHex(co.errorColor, out.colors.errorColor)
    out.colors.successColor = pickHex(co.successColor, out.colors.successColor)
    out.colors.backgroundColor = pickEnum(co.backgroundColor, VALID_BG_COLORS, out.colors.backgroundColor)
  }

  // DP12 — Icons
  const ic = r.icons as Record<string, unknown> | undefined
  if (ic && typeof ic === 'object') {
    if (typeof ic.enabled === 'boolean') out.icons.enabled = ic.enabled
    out.icons.style = pickEnum(ic.style, VALID_ICON_STYLES, out.icons.style)
    out.icons.size = pickEnum(ic.size, VALID_ICON_SIZES, out.icons.size)
    out.icons.statusIndicator = pickEnum(ic.statusIndicator, VALID_STATUS_INDICATORS, out.icons.statusIndicator)
  }

  // DP12 — Layout
  const la = r.layout as Record<string, unknown> | undefined
  if (la && typeof la === 'object') {
    if (typeof la.enabled === 'boolean') out.layout.enabled = la.enabled
    out.layout.density = pickEnum(la.density, VALID_DENSITIES, out.layout.density)
  }

  return out
}

export function readDesignPrefs(): DesignPrefs {
  if (typeof window === 'undefined') return clone(DEFAULT_PREFS)
  try {
    // URL-Param überschreibt das Theme
    const params = new URLSearchParams(window.location.search)
    const urlTheme = normalizeTheme(params.get(URL_KEY))

    // Bestehende Prefs aus JSON laden
    const raw = window.localStorage.getItem(LS_KEY_PREFS)
    let prefs: DesignPrefs
    if (raw) {
      try { prefs = sanitizePrefs(JSON.parse(raw)) } catch { prefs = clone(DEFAULT_PREFS) }
    } else {
      // Migration aus Legacy-Keys
      prefs = clone(DEFAULT_PREFS)
      const legacyTheme = normalizeTheme(window.localStorage.getItem(LS_KEY_THEME))
      if (legacyTheme) prefs.theme = legacyTheme
      else if (window.localStorage.getItem(LS_KEY_LEGACY) === '1') prefs.theme = 'modern'
    }

    if (urlTheme) {
      prefs.theme = urlTheme
      // URL-Override sofort persistieren
      try { window.localStorage.setItem(LS_KEY_PREFS, JSON.stringify(prefs)) } catch {}
    }
    return prefs
  } catch {
    return clone(DEFAULT_PREFS)
  }
}

export function writeDesignPrefs(prefs: DesignPrefs) {
  if (typeof window === 'undefined') return
  try {
    const sanitized = sanitizePrefs(prefs)
    window.localStorage.setItem(LS_KEY_PREFS, JSON.stringify(sanitized))
    // Legacy-Keys spiegeln für Rückwärtskompat
    window.localStorage.setItem(LS_KEY_THEME, sanitized.theme)
    window.localStorage.setItem(LS_KEY_LEGACY, sanitized.theme === 'classic' ? '0' : '1')
    applyBodyAttrs(sanitized)
    applyCssVars(sanitized)
    window.dispatchEvent(new CustomEvent('pk-design-change', {
      detail: { prefs: sanitized, theme: sanitized.theme, v2: sanitized.theme !== 'classic' },
    }))
  } catch {
    // ignore
  }
}

export function patchDesignPrefs(
  patch: Partial<Omit<DesignPrefs, 'features' | 'notifications' | 'typography' | 'effects' | 'colors' | 'icons' | 'layout'>> & {
    features?: Partial<DesignFeatures>
    notifications?: Partial<NotificationPrefs>
    typography?: Partial<TypographyPrefs>
    effects?: Partial<EffectsPrefs>
    colors?: Partial<ColorPrefs>
    icons?: Partial<IconPrefs>
    layout?: Partial<LayoutPrefs>
  },
) {
  const current = readDesignPrefs()
  const next: DesignPrefs = {
    ...current,
    ...patch,
    features: { ...current.features, ...(patch.features ?? {}) },
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    typography: { ...current.typography, ...(patch.typography ?? {}) },
    effects: { ...current.effects, ...(patch.effects ?? {}) },
    colors: { ...current.colors, ...(patch.colors ?? {}) },
    icons: { ...current.icons, ...(patch.icons ?? {}) },
    layout: { ...current.layout, ...(patch.layout ?? {}) },
  }
  writeDesignPrefs(next)
}

function applyBodyAttrs(prefs: DesignPrefs) {
  if (typeof document === 'undefined') return
  const b = document.body
  // Theme
  if (prefs.theme === 'classic') b.removeAttribute('data-design')
  else b.setAttribute('data-design', prefs.theme)
  // Accent
  b.setAttribute('data-accent', prefs.accent)
  // Glow-Intensität
  b.setAttribute('data-glow-intensity', prefs.glowIntensity)
  // Features
  const set = (attr: string, on: boolean) => on ? b.setAttribute(attr, 'on') : b.removeAttribute(attr)
  set('data-feat-pills', prefs.features.statusPills)
  set('data-feat-focus', prefs.features.unifiedFocus)
  set('data-feat-toasts', prefs.features.polishedToasts)
  set('data-feat-kpi', prefs.features.unifiedKpi)
  set('data-feat-sticky', prefs.features.stickyHeaders)
  set('data-feat-sidebar', prefs.features.smoothSidebar)
  set('data-bg-light', prefs.features.lightBackground)

  // DP12 — Personalisierungs-Module Master-Toggles
  set('data-pers-notif',  prefs.notifications.enabled)
  set('data-pers-typo',   prefs.typography.enabled)
  set('data-pers-effects', prefs.effects.enabled)
  set('data-pers-colors', prefs.colors.enabled)
  set('data-pers-icons',  prefs.icons.enabled)
  set('data-pers-layout', prefs.layout.enabled)

  // Sub-Werte als Daten-Attribute (für CSS-Selektoren)
  if (prefs.notifications.enabled) {
    b.setAttribute('data-toast-pos',  prefs.notifications.toastPosition)
    b.setAttribute('data-toast-anim', prefs.notifications.toastAnimation)
    b.setAttribute('data-toast-size', prefs.notifications.toastSize)
  } else {
    b.removeAttribute('data-toast-pos')
    b.removeAttribute('data-toast-anim')
    b.removeAttribute('data-toast-size')
  }
  if (prefs.effects.enabled) {
    b.setAttribute('data-anim-speed', prefs.effects.animationSpeed)
    b.setAttribute('data-blur',       prefs.effects.blurIntensity)
    b.setAttribute('data-shadow',     prefs.effects.shadowDepth)
    b.setAttribute('data-hover',      prefs.effects.hoverAction)
    b.setAttribute('data-scroll-fx',  prefs.effects.scrollEffects)
    set('data-glass', prefs.effects.glassmorphism)
  } else {
    b.removeAttribute('data-anim-speed')
    b.removeAttribute('data-blur')
    b.removeAttribute('data-shadow')
    b.removeAttribute('data-hover')
    b.removeAttribute('data-scroll-fx')
    b.removeAttribute('data-glass')
  }
  if (prefs.colors.enabled) {
    b.setAttribute('data-bg-variant', prefs.colors.backgroundColor)
  } else {
    b.removeAttribute('data-bg-variant')
  }
  if (prefs.icons.enabled) {
    b.setAttribute('data-icon-style', prefs.icons.style)
    b.setAttribute('data-icon-size',  prefs.icons.size)
    b.setAttribute('data-status-ind', prefs.icons.statusIndicator)
  } else {
    b.removeAttribute('data-icon-style')
    b.removeAttribute('data-icon-size')
    b.removeAttribute('data-status-ind')
  }
  if (prefs.layout.enabled) {
    b.setAttribute('data-density', prefs.layout.density)
  } else {
    b.removeAttribute('data-density')
  }
}

// ─── DP12: CSS-Variablen dynamisch setzen ────────────────────────────────
// Nur wenn Modul enabled → sonst werden Variablen entfernt → Default-CSS gilt.
function applyCssVars(prefs: DesignPrefs) {
  if (typeof document === 'undefined') return
  const r = document.documentElement.style

  // Typography
  if (prefs.typography.enabled) {
    r.setProperty('--user-font-base', `${prefs.typography.baseFontSize}px`)
    r.setProperty('--user-heading-scale', String(prefs.typography.headingScale))
    r.setProperty('--user-line-height', String(prefs.typography.lineHeight))
    r.setProperty('--user-letter-spacing', `${prefs.typography.letterSpacing}em`)
    const btnPx = prefs.typography.buttonFontSize === 'small' ? '12px'
              : prefs.typography.buttonFontSize === 'large' ? '16px' : '14px'
    r.setProperty('--user-btn-font-size', btnPx)
  } else {
    r.removeProperty('--user-font-base')
    r.removeProperty('--user-heading-scale')
    r.removeProperty('--user-line-height')
    r.removeProperty('--user-letter-spacing')
    r.removeProperty('--user-btn-font-size')
  }

  // Effects
  if (prefs.effects.enabled) {
    const speedMs = prefs.effects.animationSpeed === 'none' ? '0ms'
                : prefs.effects.animationSpeed === 'slow' ? '400ms'
                : prefs.effects.animationSpeed === 'fast' ? '100ms' : '200ms'
    r.setProperty('--user-anim-speed', speedMs)
    const blurPx = prefs.effects.blurIntensity === 'off' ? '0px'
                : prefs.effects.blurIntensity === 'subtle' ? '2px'
                : prefs.effects.blurIntensity === 'strong' ? '12px' : '6px'
    r.setProperty('--user-blur', blurPx)
    const shadow = prefs.effects.shadowDepth === 'none' ? 'none'
                : prefs.effects.shadowDepth === 'flat' ? '0 1px 2px rgba(0,0,0,.2)'
                : prefs.effects.shadowDepth === 'dramatic' ? '0 16px 48px rgba(0,0,0,.6)'
                : '0 8px 24px rgba(0,0,0,.4)'
    r.setProperty('--user-shadow', shadow)
  } else {
    r.removeProperty('--user-anim-speed')
    r.removeProperty('--user-blur')
    r.removeProperty('--user-shadow')
  }

  // Colors
  if (prefs.colors.enabled) {
    r.setProperty('--user-primary', prefs.colors.primaryAccent)
    r.setProperty('--user-secondary', prefs.colors.secondaryAccent)
    r.setProperty('--user-error', prefs.colors.errorColor)
    r.setProperty('--user-success', prefs.colors.successColor)
    const bg = prefs.colors.backgroundColor === 'ultra-dark' ? '#020409'
            : prefs.colors.backgroundColor === 'warm' ? '#0f1015'
            : prefs.colors.backgroundColor === 'warm-tint' ? '#11100c'
            : '#05070b'
    r.setProperty('--user-bg', bg)
  } else {
    r.removeProperty('--user-primary')
    r.removeProperty('--user-secondary')
    r.removeProperty('--user-error')
    r.removeProperty('--user-success')
    r.removeProperty('--user-bg')
  }

  // Layout-Dichte
  if (prefs.layout.enabled) {
    const pad = prefs.layout.density === 'compact' ? '10px'
            : prefs.layout.density === 'spacious' ? '24px' : '16px'
    r.setProperty('--user-density-padding', pad)
    const gap = prefs.layout.density === 'compact' ? '8px'
            : prefs.layout.density === 'spacious' ? '20px' : '12px'
    r.setProperty('--user-density-gap', gap)
  } else {
    r.removeProperty('--user-density-padding')
    r.removeProperty('--user-density-gap')
  }

  // Icon-Größe
  if (prefs.icons.enabled) {
    const sz = prefs.icons.size === 'small' ? '14px'
            : prefs.icons.size === 'large' ? '22px' : '18px'
    r.setProperty('--user-icon-size', sz)
  } else {
    r.removeProperty('--user-icon-size')
  }

  // Toast-Duration als CSS-Variable
  if (prefs.notifications.enabled) {
    r.setProperty('--user-toast-duration', `${prefs.notifications.toastDuration}ms`)
  } else {
    r.removeProperty('--user-toast-duration')
  }
}

// ─── Neuer Hook für volles Prefs-Objekt ──────────────────────────────────
export function useDesignPrefs(): DesignPrefs {
  const [prefs, setPrefs] = useState<DesignPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    const initial = readDesignPrefs()
    setPrefs(initial)
    applyBodyAttrs(initial)
    applyCssVars(initial)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && detail.prefs) {
        const next = sanitizePrefs(detail.prefs)
        setPrefs(next)
        applyBodyAttrs(next)
        applyCssVars(next)
      } else {
        const next = readDesignPrefs()
        setPrefs(next)
        applyBodyAttrs(next)
        applyCssVars(next)
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY_PREFS || e.key === LS_KEY_THEME || e.key === LS_KEY_LEGACY) {
        const next = readDesignPrefs()
        setPrefs(next)
        applyBodyAttrs(next)
        applyCssVars(next)
      }
    }
    window.addEventListener('pk-design-change', onChange as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('pk-design-change', onChange as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return prefs
}

// ─── Legacy-APIs (G1) — bleiben erhalten ──────────────────────────────────
export function readDesignTheme(): DesignTheme {
  return readDesignPrefs().theme
}
export function setDesignTheme(theme: DesignTheme) {
  patchDesignPrefs({ theme })
}
export function useDesignTheme(): DesignTheme {
  return useDesignPrefs().theme
}

// ─── Legacy-APIs (M1) — bleiben erhalten ──────────────────────────────────
export function readDesignV2(): boolean {
  return readDesignTheme() !== 'classic'
}
export function setDesignV2(enabled: boolean) {
  setDesignTheme(enabled ? 'modern' : 'classic')
}
export function useDesignV2(): boolean {
  return useDesignTheme() !== 'classic'
}
