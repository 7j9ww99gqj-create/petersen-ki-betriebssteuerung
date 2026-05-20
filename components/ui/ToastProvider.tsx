'use client'
import * as React from 'react'
import { Toast, type ToastVariant } from './Toast'
import { useDesignPrefs } from '@/lib/design-flag'
import { playToastSound } from '@/lib/toast-sound'

type ToastCtx = {
  show: (msg: string, variant?: ToastVariant) => void
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const Ctx = React.createContext<ToastCtx | null>(null)

export function ToastProvider({ children, autoHideMs }: { children: React.ReactNode; autoHideMs?: number }) {
  const prefs = useDesignPrefs()
  const [state, setState] = React.useState<{ msg: string; variant: ToastVariant } | null>(null)

  const show = React.useCallback((msg: string, variant: ToastVariant = 'success') => {
    setState({ msg, variant })
    // Verweildauer: explizit übergeben > User-Prefs (wenn aktiviert) > Default 3500ms
    const duration = autoHideMs ?? (prefs.notifications.enabled ? prefs.notifications.toastDuration : 3500)
    // Sound, wenn aktiviert
    if (prefs.notifications.enabled && prefs.notifications.toastSound) {
      try { playToastSound(variant) } catch { /* ignore */ }
    }
    if (duration > 0) window.setTimeout(() => setState(null), duration)
  }, [autoHideMs, prefs.notifications.enabled, prefs.notifications.toastDuration, prefs.notifications.toastSound])

  const ctx = React.useMemo<ToastCtx>(() => ({
    show,
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'error'),
    info: (m: string) => show(m, 'info'),
  }), [show])

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {state && <Toast msg={state.msg} variant={state.variant} />}
    </Ctx.Provider>
  )
}

/**
 * Globaler Toast-Helper. Funktioniert in jedem Component unter dem Provider.
 *
 * Bsp.:
 *   const toast = useGlobalToast()
 *   toast.success('Gespeichert')
 *   toast.error('Fehler beim Laden')
 */
export function useGlobalToast(): ToastCtx {
  const ctx = React.useContext(Ctx)
  if (!ctx) {
    // Fallback: kein Provider montiert → no-op (z.B. in Tests)
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    }
  }
  return ctx
}
