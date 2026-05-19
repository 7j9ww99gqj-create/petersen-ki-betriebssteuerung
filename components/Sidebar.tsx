'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie, performLogout } from '@/lib/auth'
import { getAccessProfile } from '@/lib/access'

const pilots = [
  { id: 'lager',     label: 'LagerPilot',     icon: '📦', href: '/dashboard/lager' },
  { id: 'buero',     label: 'BüroPilot',      icon: '🧾', href: '/dashboard/buero' },
  { id: 'werkstatt', label: 'WerkstattPilot', icon: '🛠️', href: '/dashboard/werkstatt' },
  { id: 'marketing', label: 'MarketingPilot', icon: '📣', href: '/dashboard/marketing' },
  { id: 'analyse',   label: 'AnalysePilot',   icon: '📊', href: '/dashboard/analyse' },
  { id: 'planung',   label: 'PlanungPilot',   icon: '📅', href: '/dashboard/planung' },
  { id: 'steuer',    label: 'SteuerPilot',    icon: '🧾', href: '/dashboard/steuer' },
]

const navItems = [
  { label: 'Dashboard',     icon: '⊞', href: '/dashboard' },
  { label: 'KI-Assistent',  icon: '🧠', href: '/dashboard/ki-erkennung' },
  { label: 'Cloud/Sync & Backup',  icon: '☁️', href: '/dashboard/cloud' },
  { label: 'Archiv',        icon: '🗂️', href: '/dashboard/archiv' },
  { label: 'Einstellungen', icon: '⚙️', href: '/dashboard/einstellungen' },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isDemo, setIsDemo] = useState(false)
  const [allowedPilotIds, setAllowedPilotIds] = useState<string[]>(pilots.map(pilot => pilot.id))

  useEffect(() => {
    if (hasDemoCookie()) { setIsDemo(true); setAllowedPilotIds(pilots.map(pilot => pilot.id)); return }
    if (!isSupabaseConfigured()) return
    try {
      createSupabaseClient().auth.getUser().then(({ data: { user } }) => {
        setIsDemo((user?.email ?? '').toLowerCase() === 'demo@petersen-ki.de')
        if (user) {
          const profile = getAccessProfile(user)
          setAllowedPilotIds(profile.allowedPilotIds)
        }
      }).catch(() => {})
    } catch {}
  }, [])

  const navigate = (href: string) => {
    router.push(href)
    onClose?.()
  }

  const logout = () => performLogout()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const hasAnyPilotAccess = allowedPilotIds.length > 0
  const visiblePilots = pilots.filter(pilot => allowedPilotIds.includes(pilot.id))
  const visibleNavItems = navItems.filter(item => {
    if (item.href === '/dashboard' || item.href === '/dashboard/einstellungen') return true
    return hasAnyPilotAccess
  })

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: active ? 'rgba(22,132,255,.15)' : 'transparent',
    color: active ? '#6cb6ff' : '#aeb9c8',
    fontSize: 13, fontWeight: active ? 700 : 500,
    textAlign: 'left', transition: 'background .15s, color .15s',
    borderLeft: active ? '2px solid #1684ff' : '2px solid transparent',
  })

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      {/* Logo */}
      <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(22,132,255,.35)', boxShadow: '0 0 16px rgba(22,132,255,.25)' }}>
            <Image src="/logo.png" alt="Petersen KI Logo" width={42} height={42} style={{ objectFit: 'cover', borderRadius: 12 }} priority />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.1, color: '#f8fbff' }}>Petersen <span style={{ color: '#1684ff' }}>KI</span></div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>Betriebssteuerung</div>
          </div>
        </button>
        {isDemo && (
          <div style={{ marginTop: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.25)', fontSize: 10, color: '#ffb347', fontWeight: 700, textAlign: 'center', letterSpacing: '.05em' }}>
            ● DEMO-MODUS · BEISPIELDATEN
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 10px 4px' }}>
        <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px', marginBottom: 4 }}>Navigation</div>
        {visibleNavItems.map(item => (
          <button key={item.href} onClick={() => navigate(item.href)} style={navBtnStyle(isActive(item.href))}
            onMouseEnter={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)' }}
            onMouseLeave={e => { if (!isActive(item.href)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      {/* Pilots */}
      <div style={{ padding: '4px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#4a5568', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, padding: '4px 8px', marginBottom: 4 }}>KI-Piloten</div>
        {visiblePilots.map(pilot => (
          <button key={pilot.id} onClick={() => navigate(pilot.href)}
            style={{ ...navBtnStyle(isActive(pilot.href)), color: isActive(pilot.href) ? '#6cb6ff' : '#d0d9e8' }}
            onMouseEnter={e => { if (!isActive(pilot.href)) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.05)' }}
            onMouseLeave={e => { if (!isActive(pilot.href)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
            <span style={{ fontSize: 15 }}>{pilot.icon}</span>{pilot.label}
          </button>
        ))}
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: '#aeb9c8', fontSize: 13, textAlign: 'left', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,80,80,.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
          <span style={{ fontSize: 16 }}>🚪</span> Abmelden
        </button>
      </div>
    </aside>
  )
}
