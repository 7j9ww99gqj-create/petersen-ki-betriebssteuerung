'use client'
// Zentrale Toast-Komponente (DP12-ready).
// - Nutzt .pk-toast-Klasse → Position/Animation/Größe kommen aus User-Prefs (globals.css)
// - Bei deaktivierten Personalisierungs-Modulen bleibt der aktuelle Look (bottom-right, fade-in)
// - useToast-Hook liest die Verweildauer aus DesignPrefs, falls verfügbar

import * as React from 'react'
import { useDesignPrefs } from '@/lib/design-flag'
import { playToastSound } from '@/lib/toast-sound'

export type ToastVariant = 'success' | 'error' | 'info'

export type ToastProps = {
  msg: string
  variant?: ToastVariant
}

const STYLES: Record<ToastVariant, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(37,211,102,.12)', border: 'rgba(37,211,102,.35)', color: '#4ddb7e' },
  error:   { bg: 'rgba(255,80,80,.15)',  border: 'rgba(255,80,80,.4)',   color: '#ff8080' },
  info:    { bg: 'rgba(22,132,255,.12)', border: 'rgba(22,132,255,.35)', color: '#7fb8ff' },
}

export function Toast({ msg, variant = 'success' }: ToastProps) {
  if (!msg) return null
  const s = STYLES[variant]
  return (
    <div
      role="status"
      aria-live="polite"
      className="pk-toast"
      style={{
        // Visuelle Eigenschaften bleiben inline,
        // Position/Animation/Größe kommen aus globals.css über .pk-toast
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
      }}
    >
      {msg}
    </div>
  )
}

export function useToast(autoHideMs?: number) {
  const prefs = useDesignPrefs()
  const [state, setState] = React.useState<{ msg: string; variant: ToastVariant } | null>(null)

  const show = React.useCallback((msg: string, variant: ToastVariant = 'success') => {
    setState({ msg, variant })
    // Verweildauer: explizit übergeben > Prefs (wenn enabled) > Default 3500ms
    const duration = autoHideMs ?? (prefs.notifications.enabled ? prefs.notifications.toastDuration : 3500)
    // Sound, wenn aktiviert
    if (prefs.notifications.enabled && prefs.notifications.toastSound) {
      try { playToastSound(variant) } catch { /* ignore */ }
    }
    if (duration > 0) window.setTimeout(() => setState(null), duration)
  }, [autoHideMs, prefs.notifications.enabled, prefs.notifications.toastDuration, prefs.notifications.toastSound])

  const toast = state ? <Toast msg={state.msg} variant={state.variant} /> : null

  return { show, toast, clear: () => setState(null) }
}
