// Design-V2 Feature-Flag (M1).
// Schaltet zwischen klassischem Emoji-UI (Standard) und neuem Lucide/SVG-Design um.
// Quellen (Priorität absteigend):
//   1. URL-Parameter ?design=v2 / ?design=v1
//   2. localStorage 'pk_design_v2' = '1' | '0'
//   3. Default = false (klassisches Design)
//
// Body bekommt zusätzlich data-design="v2", damit CSS-Regeln greifen können.

'use client'

import { useEffect, useState } from 'react'

const LS_KEY = 'pk_design_v2'
const URL_KEY = 'design'

export function readDesignV2(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const param = params.get(URL_KEY)
    if (param === 'v2') {
      window.localStorage.setItem(LS_KEY, '1')
      return true
    }
    if (param === 'v1' || param === 'off') {
      window.localStorage.setItem(LS_KEY, '0')
      return false
    }
    return window.localStorage.getItem(LS_KEY) === '1'
  } catch {
    return false
  }
}

export function setDesignV2(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, enabled ? '1' : '0')
    applyBodyAttr(enabled)
    window.dispatchEvent(new CustomEvent('pk-design-change', { detail: { v2: enabled } }))
  } catch {
    // ignore
  }
}

function applyBodyAttr(enabled: boolean) {
  if (typeof document === 'undefined') return
  if (enabled) document.body.setAttribute('data-design', 'v2')
  else document.body.removeAttribute('data-design')
}

/**
 * React-Hook: liefert aktuellen Flag-Wert und reagiert auf:
 *  - Mount (initial-Wert)
 *  - 'pk-design-change' Custom-Event (für Toggle)
 *  - 'storage' Event (Tab-übergreifend synchron)
 */
export function useDesignV2(): boolean {
  const [v2, setV2] = useState(false)

  useEffect(() => {
    const initial = readDesignV2()
    setV2(initial)
    applyBodyAttr(initial)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.v2 === 'boolean') {
        setV2(detail.v2)
        applyBodyAttr(detail.v2)
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) {
        const next = e.newValue === '1'
        setV2(next)
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

  return v2
}
