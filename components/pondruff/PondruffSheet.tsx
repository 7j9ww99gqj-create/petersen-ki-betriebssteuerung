'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ITEMS = [
  { href: '/dashboard/pondruff/wareneingang', icon: '📥', label: 'Wareneingang', desc: 'Lieferschein fotografieren & erfassen' },
  { href: '/dashboard/pondruff/preisrechner', icon: '💶', label: 'Preisrechner', desc: 'Positionen kalkulieren' },
  { href: '/dashboard/pondruff/buero-wiso',   icon: '🧾', label: 'Büro / WISO', desc: 'Aufträge & Wareneingänge übergeben' },
  { href: '/dashboard/pondruff/ki-suche',     icon: '🤖', label: 'KI-Suche', desc: 'Bauteil per Foto wiederfinden' },
  { href: '/dashboard/pondruff/archiv',       icon: '🗂️', label: 'Archiv', desc: 'Alles durchsuchbar' },
]

export default function PondruffSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  if (!open) return null
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      />
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
          background: 'linear-gradient(180deg, #1a0606 0%, #0a0303 100%)',
          borderTop: '2px solid #e50909',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 14,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
          paddingLeft: 16, paddingRight: 16,
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 -12px 48px rgba(229,9,9,.35)',
          animation: 'pondruff-slideup .25s ease-out',
        }}
      >
        <style>{`@keyframes pondruff-slideup { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,.2)', borderRadius: 2, margin: '0 auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Image src="/pondruff/icon.png" alt="Pondruff" width={48} height={48} style={{ borderRadius: 12 }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.02em' }}>Pondruff <span style={{ color: '#e50909' }}>/ WE</span></div>
            <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Wareneingangs-Tool</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {ITEMS.map(it => (
            <button
              key={it.href}
              onClick={() => { router.push(it.href); onClose() }}
              style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 14,
                background: 'linear-gradient(180deg, rgba(229,9,9,.16), rgba(229,9,9,.04))',
                border: '1px solid rgba(229,9,9,.35)',
                transition: 'transform .12s, border-color .15s',
              }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(.98)' }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
            >
              <div style={{ fontSize: 28, width: 44, textAlign: 'center' }}>{it.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{it.label}</div>
                <div style={{ fontSize: 12, color: '#f5d4d4' }}>{it.desc}</div>
              </div>
              <div style={{ color: '#e50909', fontSize: 22 }}>›</div>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="pk-btn-ghost" style={{ marginTop: 14, width: '100%' }}>Schließen</button>
      </div>
    </>
  )
}
