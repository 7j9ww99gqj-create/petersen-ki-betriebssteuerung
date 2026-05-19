'use client'

import * as React from 'react'

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
      style={{
        position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
        padding: '14px 20px', borderRadius: 12, maxWidth: 380,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 14, fontWeight: 600,
        boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        animation: 'fadeIn .2s ease',
      }}
    >
      {msg}
    </div>
  )
}

export function useToast(autoHideMs = 3500) {
  const [state, setState] = React.useState<{ msg: string; variant: ToastVariant } | null>(null)

  const show = React.useCallback((msg: string, variant: ToastVariant = 'success') => {
    setState({ msg, variant })
    if (autoHideMs > 0) window.setTimeout(() => setState(null), autoHideMs)
  }, [autoHideMs])

  const toast = state ? <Toast msg={state.msg} variant={state.variant} /> : null

  return { show, toast, clear: () => setState(null) }
}
