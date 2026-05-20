'use client'
// Globaler Toast-Container.
// - Wird einmal in app/dashboard/layout.tsx gerendert
// - Empfängt Toasts via Custom-Event 'pk-app-toast'
// - Nutzt .pk-toast-Klasse → Position/Animation/Größe kommen aus User-Prefs
// - Spielt Sound, wenn notifications.toastSound aktiviert ist
// - Auto-Dismiss nach prefs.notifications.toastDuration
//   (0 = manuell schließen, Default 5000ms wenn Prefs nicht initialisiert)
//
// Verwendung (von überall):
//   import { pushAppToast } from '@/components/AppToast'
//   pushAppToast('Aktion erfolgreich', 'success')

import { useEffect, useState, useCallback } from 'react'
import { useDesignPrefs } from '@/lib/design-flag'
import { playToastSound, type ToastSoundType } from '@/lib/toast-sound'

export type AppToastType = 'success' | 'error' | 'info'

interface AppToastItem {
  id: number
  msg: string
  type: AppToastType
}

const EVENT = 'pk-app-toast'

// Public API — von jeder Komponente aufrufbar
export function pushAppToast(msg: string, type: AppToastType = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { msg, type } }))
}

let counter = 0

export default function AppToast() {
  const prefs = useDesignPrefs()
  const [toasts, setToasts] = useState<AppToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { msg: string; type: AppToastType } | undefined
      if (!detail || typeof detail.msg !== 'string') return
      const id = ++counter
      const type = detail.type ?? 'info'
      setToasts(prev => [...prev, { id, msg: detail.msg, type }])

      // Sound, wenn aktiviert
      if (prefs.notifications.enabled && prefs.notifications.toastSound) {
        const soundType: ToastSoundType =
          type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'
        try { playToastSound(soundType) } catch { /* ignore */ }
      }

      // Auto-Dismiss
      const duration = prefs.notifications.enabled ? prefs.notifications.toastDuration : 5000
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
    }
    window.addEventListener(EVENT, handler as EventListener)
    return () => window.removeEventListener(EVENT, handler as EventListener)
  }, [prefs.notifications.enabled, prefs.notifications.toastSound, prefs.notifications.toastDuration, dismiss])

  if (toasts.length === 0) return null

  return (
    <div aria-live="polite" aria-atomic="true">
      {toasts.map((t, idx) => {
        const isErr = t.type === 'error'
        const isInfo = t.type === 'info'
        // Mehrere gleichzeitig: leicht versetzt stapeln
        const offset = idx * 8
        return (
          <div
            key={t.id}
            className="pk-toast"
            style={{
              // Visuelle Eigenschaften (Farbe etc.) bleiben inline,
              // Position/Animation/Größe kommen aus globals.css via .pk-toast
              marginBottom: offset,
              background: isErr
                ? 'rgba(255,80,80,.15)'
                : isInfo
                  ? 'rgba(22,132,255,.12)'
                  : 'rgba(37,211,102,.12)',
              border: `1px solid ${
                isErr ? 'rgba(255,80,80,.4)'
                : isInfo ? 'rgba(22,132,255,.4)'
                : 'rgba(37,211,102,.35)'
              }`,
              color: isErr ? '#ff8080' : isInfo ? '#6cb6ff' : '#4ddb7e',
              cursor: 'pointer',
            }}
            onClick={() => dismiss(t.id)}
            role="status"
          >
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}
