// Design-Prefs-System (vollständig).
// Stufenweise gewachsen:
//   M1: Boolean useDesignV2()
//   G1: 3 Themes 'classic' | 'modern' | 'glow'
//   DP1: vollständiges Prefs-Objekt mit Accent, Glow-Intensität, 7 Features
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
//   data-feat-pills      = 'on' | (fehlt wenn off)
//   data-feat-focus      = 'on'
//   data-feat-toasts     = 'on'
//   data-feat-kpi        = 'on'
//   data-feat-sticky     = 'on'
//   data-feat-sidebar    = 'on'
//   data-bg-light        = 'on'

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

export interface DesignPrefs {
  theme: DesignTheme
  accent: DesignAccent
  glowIntensity: GlowIntensity
  features: DesignFeatures
}

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
}

const LS_KEY_PREFS = 'pk_design_prefs'
const LS_KEY_THEME = 'pk_design_theme'
const LS_KEY_LEGACY = 'pk_design_v2'
const URL_KEY = 'design'

const VALID_THEMES: DesignTheme[] = ['classic', 'modern', 'glow']
const VALID_ACCENTS: DesignAccent[] = ['blue', 'cyan', 'purple', 'green', 'orange', 'red']
const VALID_INTENSITIES: GlowIntensity[] = ['off', 'subtle', 'medium', 'strong']

function normalizeTheme(value: unknown): DesignTheme | null {
  if (typeof value === 'string' && VALID_THEMES.includes(value as DesignTheme)) return value as DesignTheme
  if (value === 'v2') return 'modern'
  if (value === 'v1' || value === 'off') return 'classic'
  return null
}

function clone(p: DesignPrefs): DesignPrefs {
  return { ...p, features: { ...p.features } }
}

function sanitizePrefs(raw: unknown): DesignPrefs {
  const out = clone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  const t = normalizeTheme(r.theme)
  if (t) out.theme = t
  if (typeof r.accent === 'string' && VALID_ACCENTS.includes(r.accent as DesignAccent)) out.accent = r.accent as DesignAccent
  if (typeof r.glowIntensity === 'string' && VALID_INTENSITIES.includes(r.glowIntensity as GlowIntensity)) out.glowIntensity = r.glowIntensity as GlowIntensity
  const f = r.features as Record<string, unknown> | undefined
  if (f && typeof f === 'object') {
    for (const key of Object.keys(out.features) as (keyof DesignFeatures)[]) {
      if (typeof f[key] === 'boolean') out.features[key] = f[key] as boolean
    }
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
    window.dispatchEvent(new CustomEvent('pk-design-change', {
      detail: { prefs: sanitized, theme: sanitized.theme, v2: sanitized.theme !== 'classic' },
    }))
  } catch {
    // ignore
  }
}

export function patchDesignPrefs(patch: Partial<DesignPrefs> & { features?: Partial<DesignFeatures> }) {
  const current = readDesignPrefs()
  const next: DesignPrefs = {
    ...current,
    ...patch,
    features: { ...current.features, ...(patch.features ?? {}) },
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
}

// ─── Neuer Hook für volles Prefs-Objekt ──────────────────────────────────
export function useDesignPrefs(): DesignPrefs {
  const [prefs, setPrefs] = useState<DesignPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    const initial = readDesignPrefs()
    setPrefs(initial)
    applyBodyAttrs(initial)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && detail.prefs) {
        const next = sanitizePrefs(detail.prefs)
        setPrefs(next)
        applyBodyAttrs(next)
      } else {
        const next = readDesignPrefs()
        setPrefs(next)
        applyBodyAttrs(next)
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY_PREFS || e.key === LS_KEY_THEME || e.key === LS_KEY_LEGACY) {
        const next = readDesignPrefs()
        setPrefs(next)
        applyBodyAttrs(next)
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
