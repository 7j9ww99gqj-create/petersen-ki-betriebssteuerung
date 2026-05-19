'use client'
import * as React from 'react'
import { hasDemoCookie } from '@/lib/auth'

/**
 * Sichtbarer Hinweis-Banner im Dashboard, wenn der User im Demo-Modus eingeloggt ist.
 * Erscheint nur, wenn das `pk_demo`-Cookie gesetzt ist (durch Login mit Demo-Account).
 * Kann temporär per X-Klick ausgeblendet werden (sessionStorage).
 */
export default function DemoBanner() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (!hasDemoCookie()) return
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('pk_demo_banner_dismissed') === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, rgba(245,158,11,.18), rgba(245,158,11,.08))',
        borderBottom: '1px solid rgba(245,158,11,.35)',
        color: '#fbbf24',
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <span>🧪</span>
      <span>
        Demo-Modus aktiv — Sie sehen Beispieldaten. Änderungen werden täglich um <strong>03:00 Uhr</strong> zurückgesetzt.
      </span>
      <button
        onClick={() => {
          window.sessionStorage.setItem('pk_demo_banner_dismissed', '1')
          setVisible(false)
        }}
        aria-label="Banner ausblenden"
        style={{
          background: 'none',
          border: 'none',
          color: '#fbbf24',
          cursor: 'pointer',
          fontSize: 16,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
