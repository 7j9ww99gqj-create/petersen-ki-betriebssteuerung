'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie, clearDemoCookie } from '@/lib/auth'

const pilots = [
  { id: 'lager', label: 'LagerPilot', icon: '📦', href: '/dashboard/lager' },
  { id: 'buero', label: 'BüroPilot', icon: '🧾', href: '/dashboard/buero' },
  { id: 'werkstatt', label: 'WerkstattPilot', icon: '🛠️', href: '/dashboard/werkstatt' },
  { id: 'marketing', label: 'MarketingPilot', icon: '📣', href: '/dashboard/marketing' },
  { id: 'analyse', label: 'AnalysePilot', icon: '📊', href: '/dashboard/analyse' },
  { id: 'planung', label: 'PlanungPilot', icon: '📅', href: '/dashboard/planung' },
]

const navItems = [
  { label: 'Dashboard', icon: '⊞', href: '/dashboard' },
  { label: 'KI Erkennung', icon: '🧠', href: '/dashboard/ki-erkennung' },
  { label: 'Cloud & Sync', icon: '☁️', href: '/dashboard/cloud' },
  { label: 'Archiv', icon: '🗂️', href: '/dashboard/archiv' },
  { label: 'Einstellungen', icon: '⚙️', href: '/dashboard/einstellungen' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    if (hasDemoCookie()) { setIsDemo(true); return }
    if (!isSupabaseConfigured()) return
    try {
      const supabase = createSupabaseClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        const email = session?.user?.email ?? ''
        setIsDemo(email.toLowerCase() === 'demo@petersen-ki.de')
      }).catch(() => {})
    } catch {}
  }, [])

  const logout = async () => {
    clearDemoCookie()
    try {
      if (isSupabaseConfigured()) {
        const supabase = createSupabaseClient()
        await supabase.auth.signOut()
      }
    } catch {}
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="sidebar">
      <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <button onClick={() => router.push('/dashboard')} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
            border: '1px solid rgba(22,132,255,.35)', boxShadow: '0 0 16px rgba(22,132,255,.25)',
          }}>
            <Image src="/logo.jpg" alt="Petersen KI Logo" width={42} height={42}
              style={{ objectFit: 'cover', borderRadius: 12 }} priority />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.1, color: '#f8fbff' }}>
              Petersen <span style={{ color: '#1684ff' }}>KI</span>
            </div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>Betriebssteuerung</div>
          </div>
        </button>

        {isDemo && (
          <div style={{
            marginTop: 10, padding: '4px 8px', borderRadius: 6,
            background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.25)',
            fontSize: 10, color: '#ffb347', fontWeight: 700, textAlign: 'center', letterSpacing: '.05em',
          }}>
            ● DEMO-MODUS · BEISPIELDATEN
          </div>
        )}
      </div>

      <div style={{ padding: '10px 10px 4px' }}>
        <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px', marginBottom: 4 }}>Navigation</div>
        {navItems.map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: isActive(item.href) ? 'rgba(22,132,255,.15)' : 'transparent',
            color: isActive(item.href) ? '#6cb6ff' : '#aeb9c8',
            fontSize: 13, fontWeight: isActive(item.href) ? 700 : 500, textAlign: 'left',
            transition: 'background .15s, color .15s',
            borderLeft: isActive(item.href) ? '2px solid #1684ff' : '2px solid transparent',
          }}
            onMouseEnter={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)' }}
            onMouseLeave={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '4px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px', marginBottom: 4 }}>KI-Piloten</div>
        {pilots.map(pilot => (
          <button key={pilot.id} onClick={() => router.push(pilot.href)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: isActive(pilot.href) ? 'rgba(22,132,255,.15)' : 'transparent',
            color: isActive(pilot.href) ? '#6cb6ff' : '#d0d9e8',
            fontSize: 13, fontWeight: isActive(pilot.href) ? 700 : 500, textAlign: 'left',
            transition: 'background .15s',
            borderLeft: isActive(pilot.href) ? '2px solid #1684ff' : '2px solid transparent',
          }}
            onMouseEnter={e => { if (!isActive(pilot.href)) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)' }}
            onMouseLeave={e => { if (!isActive(pilot.href)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 15 }}>{pilot.icon}</span>{pilot.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <button onClick={logout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#aeb9c8', fontSize: 13, textAlign: 'left', transition: 'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
          <span style={{ fontSize: 16 }}>🚪</span> Abmelden
        </button>
      </div>
    </aside>
  )
}
