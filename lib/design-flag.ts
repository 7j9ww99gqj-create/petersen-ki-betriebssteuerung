// Design-Flag-System.
// Ursprünglich (M1): Boolean useDesignV2().
// Erweitert (G1): drei Themes 'classic' | 'modern' | 'glow'.
// useDesignV2() bleibt rückwärtskompatibel — true wenn Theme NICHT 'classic'.
//
// Quellen (Priorität absteigend):
//   1. URL-Parameter ?design=classic|modern|glow|v1|v2
//   2. localStorage 'pk_design_theme' = 'classic'|'modern'|'glow'
//   3. localStorage 'pk_design_v2' = '1'|'0' (Legacy-Schlüssel aus M1)
//   4. Default = 'classic'
//
// Body bekommt data-design="modern" oder "glow"; bei classic kein Attribut.

'use client'

import { useEffect, useState } from 'react'

export type DesignTheme = 'classic' | 'modern' | 'glow'

const LS_KEY_THEME = 'pk_design_theme'
const LS_KEY_LEGACY = 'pk_design_v2'
const URL_KEY = 'design'

function normalizeTheme(value: unknown): DesignTheme | null {
  if (value === 'classic' || value === 'modern' || value === 'glow') return value
  if (value === 'v2') return 'modern'
  if (value === 'v1' || value === 'off') return 'classic'
  return null
}

export function readDesignTheme(): DesignTheme {
  if (typeof window === 'undefined') return 'classic'
  try {
    // 1. URL-Param
    const params = new URLSearchParams(window.location.search)
    const fromUrl = normalizeTheme(params.get(URL_KEY))
    if (fromUrl) {
      window.localStorage.setItem(LS_KEY_THEME, fromUrl)
      // Legacy-Key spiegeln, damit alter Code (useDesignV2) konsistent bleibt
      window.localStorage.setItem(LS_KEY_LEGACY, fromUrl === 'classic' ? '0' : '1')
      return fromUrl
    }
    // 2. Neuer Theme-Key
    const fromTheme = normalizeTheme(window.localStorage.getItem(LS_KEY_THEME))
    if (fromTheme) return fromTheme
    // 3. Legacy Boolean
    const legacy = window.localStorage.getItem(LS_KEY_LEGACY)
    if (legacy === '1') return 'modern'
    return 'classic'
  } catch {
    return 'classic'
  }
}

export function setDesignTheme(theme: DesignTheme) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY_THEME, theme)
    window.localStorage.setItem(LS_KEY_LEGACY, theme === 'classic' ? '0' : '1')
    applyBodyAttr(theme)
    window.dispatchEvent(new CustomEvent('pk-design-change', { detail: { theme, v2: theme !== 'classic' } }))
  } catch {
    // ignore
  }
}

function applyBodyAttr(theme: DesignTheme) {
  if (typeof document === 'undefined') return
  if (theme === 'classic') {
    document.body.removeAttribute('data-design')
  } else {
    document.body.setAttribute('data-design', theme)
  }
}

// ─── Legacy-API (M1) — bleibt erhalten ─────────────────────────────────────
export function readDesignV2(): boolean {
  return readDesignTheme() !== 'classic'
}

export function setDesignV2(enabled: boolean) {
  setDesignTheme(enabled ? 'modern' : 'classic')
}

/**
 * Hook für das neue 3-Wege-Theme-System.
 */
export function useDesignTheme(): DesignTheme {
  const [theme, setTheme] = useState<DesignTheme>('classic')

  useEffect(() => {
    const initial = readDesignTheme()
    setTheme(initial)
    applyBodyAttr(initial)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.theme === 'string') {
        const next = normalizeTheme(detail.theme) ?? 'classic'
        setTheme(next)
        applyBodyAttr(next)
      } else if (detail && typeof detail.v2 === 'boolean') {
        // Legacy-Event-Format aus älterem Code
        const next: DesignTheme = detail.v2 ? 'modern' : 'classic'
        setTheme(next)
        applyBodyAttr(next)
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY_THEME || e.key === LS_KEY_LEGACY) {
        const next = readDesignTheme()
        setTheme(next)
        applyBodyAttr(next)
      }
    }
    window.addEventListener('pk-design-change', onChange as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('pk-design-change', onChange as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return theme
}

/**
 * Legacy-Hook (M1) — bleibt rückwärtskompatibel.
 * true, wenn Theme NICHT 'classic'.
 */
export function useDesignV2(): boolean {
  const theme = useDesignTheme()
  return theme !== 'classic'
}
