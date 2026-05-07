'use client'
import { useState, useEffect, useRef } from 'react'

const WA_LINK = 'https://wa.me/4917656392975?text=Hallo%2C%20ich%20ben%C3%B6tige%20Support%20f%C3%BCr%20Petersen%20KI%20Betriebssteuerung.'
const EMAIL_LINK = 'mailto:info@petersen-ki-pilot.de?subject=Support%20%E2%80%93%20Petersen%20KI%20Betriebssteuerung&body=Hallo%2C%0D%0A%0D%0Aich%20ben%C3%B6tige%20Hilfe%20bei%20folgendem%20Thema%3A%0D%0A%0D%0A'
const PHONE_LINK = 'tel:+4917656392975'

const OPTIONS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    sublabel: 'Direktnachricht senden',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    color: '#25d366',
    bg: 'rgba(37,211,102,.12)',
    border: 'rgba(37,211,102,.3)',
    href: WA_LINK,
    external: true,
  },
  {
    id: 'email',
    label: 'E-Mail schreiben',
    sublabel: 'info@petersen-ki-pilot.de',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    ),
    color: '#6cb6ff',
    bg: 'rgba(22,132,255,.12)',
    border: 'rgba(22,132,255,.3)',
    href: EMAIL_LINK,
    external: false,
  },
  {
    id: 'phone',
    label: 'Anrufen',
    sublabel: '+49 176 56392975',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.9 2 2 0 0 1 3.59 2.72h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    color: '#a78bfa',
    bg: 'rgba(167,139,250,.12)',
    border: 'rgba(167,139,250,.3)',
    href: PHONE_LINK,
    external: false,
  },
]

export default function SupportButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Schließen beim Klick außerhalb
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Schließen bei Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}>
      {/* Optionen-Menü */}
      {open && (
        <div
          className="fade-in-scale"
          style={{
            position: 'absolute',
            bottom: 68,
            right: 0,
            width: 280,
            background: 'linear-gradient(180deg, rgba(11,20,32,.98), rgba(6,10,18,.98))',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 18,
            boxShadow: '0 24px 80px rgba(0,0,0,.6)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fbff' }}>💬 Support kontaktieren</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>Wähle eine Kontaktmöglichkeit</div>
          </div>

          {/* Optionen */}
          <div style={{ padding: '8px' }}>
            {OPTIONS.map(opt => (
              <a
                key={opt.id}
                href={opt.href}
                target={opt.external ? '_blank' : undefined}
                rel={opt.external ? 'noopener noreferrer' : undefined}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  transition: 'background .15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: opt.bg, border: `1px solid ${opt.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: opt.color,
                }}>
                  {opt.icon}
                </div>
                {/* Text */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 1 }}>{opt.sublabel}</div>
                </div>
                {/* Pfeil */}
                <div style={{ marginLeft: 'auto', color: '#4a5568', fontSize: 16 }}>›</div>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 18px 14px', borderTop: '1px solid rgba(255,255,255,.07)', fontSize: 11, color: '#4a5568', textAlign: 'center' }}>
            Mo–Fr 8–18 Uhr · Reaktionszeit &lt; 1 Stunde
          </div>
        </div>
      )}

      {/* Haupt-Button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Support"
        style={{
          width: 54, height: 54,
          borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg, #1684ff, #005bea)'
            : 'linear-gradient(135deg, rgba(22,132,255,.2), rgba(0,91,234,.2))',
          border: `2px solid ${open ? 'rgba(22,132,255,.6)' : 'rgba(22,132,255,.35)'}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open
            ? '0 8px 32px rgba(22,132,255,.5)'
            : '0 4px 20px rgba(0,0,0,.4)',
          transition: 'all .2s cubic-bezier(.16,1,.3,1)',
          transform: open ? 'scale(1.05)' : 'scale(1)',
          color: open ? '#fff' : '#6cb6ff',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(22,132,255,.35), rgba(0,91,234,.35))'
            e.currentTarget.style.borderColor = 'rgba(22,132,255,.55)'
            e.currentTarget.style.transform = 'scale(1.08)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(22,132,255,.2), rgba(0,91,234,.2))'
            e.currentTarget.style.borderColor = 'rgba(22,132,255,.35)'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
      >
        {open ? (
          // X Icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          // Support Icon (Fragezeichen + Headset)
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Pulsierender Ring wenn geschlossen */}
      {!open && (
        <span style={{
          position: 'absolute', inset: -4,
          borderRadius: '50%',
          border: '2px solid rgba(22,132,255,.3)',
          animation: 'pulse-glow 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}
