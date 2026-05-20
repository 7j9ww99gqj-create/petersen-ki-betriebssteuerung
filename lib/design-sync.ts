// DP12 — Multi-Device-Sync für Design-Prefs.
// Lokales localStorage bleibt primärer Cache (Offline-Fähigkeit + sofortige Anwendung).
// Sync ist OPT-IN über localStorage-Flag 'pk_design_cloud_sync'.
//
// Verwendung:
//   useCloudDesignSync()  → Hook in app/dashboard/layout.tsx einbauen
//   isCloudSyncEnabled() / setCloudSyncEnabled(b)  → Panel-Toggle

'use client'

import { useEffect, useRef } from 'react'
import { readDesignPrefs, writeDesignPrefs, type DesignPrefs } from './design-flag'
import { getUserDesignPrefs, saveUserDesignPrefs } from './db'

const LS_FLAG = 'pk_design_cloud_sync'

export function isCloudSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(LS_FLAG) === '1'
}

export function setCloudSyncEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  if (enabled) {
    window.localStorage.setItem(LS_FLAG, '1')
  } else {
    window.localStorage.removeItem(LS_FLAG)
  }
  window.dispatchEvent(new CustomEvent('pk-design-cloud-sync-toggle', { detail: { enabled } }))
}

// Manueller Sync — vom Cloud → lokal (z.B. nach Login)
export async function pullPrefsFromCloud(): Promise<DesignPrefs | null> {
  try {
    const remote = await getUserDesignPrefs()
    if (!remote || !remote.prefs) return null
    // writeDesignPrefs sanitized das Objekt selbst
    writeDesignPrefs(remote.prefs as DesignPrefs)
    return remote.prefs as DesignPrefs
  } catch {
    return null
  }
}

// Manueller Sync — lokal → Cloud (z.B. beim Aktivieren)
export async function pushPrefsToCloud(): Promise<{ ok: boolean; error?: string }> {
  try {
    const prefs = readDesignPrefs()
    return await saveUserDesignPrefs(prefs)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

// React-Hook: Automatischer Sync bei aktiviertem Cloud-Sync
export function useCloudDesignSync() {
  const debounceRef = useRef<number | null>(null)
  const syncEnabledRef = useRef<boolean>(false)

  useEffect(() => {
    syncEnabledRef.current = isCloudSyncEnabled()

    // 1) Beim Mount: Cloud → lokal (nur wenn sync enabled)
    if (syncEnabledRef.current) {
      void pullPrefsFromCloud()
    }

    // 2) Listener für Pref-Changes → debounced zu Supabase pushen
    const onChange = () => {
      if (!syncEnabledRef.current) return
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        void pushPrefsToCloud()
      }, 1200) // debounce: Nutzer soll nicht für jede Mini-Änderung pushen
    }
    window.addEventListener('pk-design-change', onChange)

    // 3) Listener für Sync-Toggle (AN → sofort pushen, damit erste Sync aktiv ist)
    const onSyncToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as { enabled: boolean } | undefined
      if (!detail) return
      syncEnabledRef.current = detail.enabled
      if (detail.enabled) {
        void pushPrefsToCloud()
      }
    }
    window.addEventListener('pk-design-cloud-sync-toggle', onSyncToggle)

    return () => {
      window.removeEventListener('pk-design-change', onChange)
      window.removeEventListener('pk-design-cloud-sync-toggle', onSyncToggle)
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [])
}
