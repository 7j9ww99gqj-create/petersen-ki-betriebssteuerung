'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import SupportButton from '@/components/SupportButton'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie } from '@/lib/auth'
import { ROLE_LABELS, type AppRole } from '@/lib/roles'

// Bottom-Nav Einträge (Mobile)
const bottomNavItems = [
  { href: '/dashboard',             icon: '⊞',  label: 'Start' },
  { href: '/dashboard/lager',       icon: '📦', label: 'Lager' },
  { href: '/dashboard/buero',       icon: '🧾', label: 'Büro' },
  { href: '/dashboard/werkstatt',   icon: '🛠️', label: 'Werkstatt' },
  { href: '/dashboard/ki-erkennung',icon: '🧠', label: 'KI' },
  { href: '#menu',                  icon: '☰',  label: 'Menü' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRoleState] = useState<AppRole>('Admin')

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Read role from localStorage (Demo always Admin)
  useEffect(() => {
    const stored = hasDemoCookie()
      ? 'Admin'
      : ((localStorage.getItem('pk_role') as AppRole) || 'Admin')
    setRoleState(stored)
  }, [pathname])

  // Auth check
  useEffect(() => {
    if (hasDemoCookie()) { setUserName('Demo'); setChecked(true); return }
    if (!isSupabaseConfigured()) { router.push('/login'); return }

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const supabase = createSupabaseClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { router.push('/login'); return }
        setUserName((session.user.email ?? '').split('@')[0])
        setChecked(true)
      }).catch(() => router.push('/login'))

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) router.push('/login')
      })
      subscription = data.subscription
    } catch { router.push('/login') }

    return () => subscription?.unsubscribe()
  }, [router])

  if (!checked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#aeb9c8', fontSize: 14 }}>Laden…</div>
        </div>
      </div>
    )
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <div style={{ display: 'flex' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dashboard-main">
        {/* Top bar */}
        <div
          className="topbar"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'linear-gradient(180deg, rgba(5,7,11,.97), rgba(5,7,11,.92))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(255,255,255,.07)',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          {/* Hamburger – only visible on desktop (mobile uses bottom-nav "Menü") */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menü öffnen"
            style={{
              display: 'none',
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 5, flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <GlobalSearch />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <NotificationBell />
            {/* Role badge – hide on very small screens via inline media */}
            <span
              className="role-badge-desktop"
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 999,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                color: '#aeb9c8', fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              {ROLE_LABELS[role]}
            </span>
            <button
              onClick={() => router.push('/dashboard/einstellungen')}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #1684ff22, #20c8ff22)',
                border: '1px solid rgba(22,132,255,.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 15, color: '#6cb6ff',
                transition: 'border-color .15s, background .15s',
                touchAction: 'manipulation',
              }}
              title="Einstellungen"
            >
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </button>
          </div>
        </div>

        <main className="main-inner">
          {children}
        </main>
      </div>

      {/* ── Bottom Navigation (Mobile) ── */}
      <nav className="bottom-nav" role="navigation" aria-label="Hauptnavigation">
        {bottomNavItems.map(item => {
          const active = item.href !== '#menu' && isActive(item.href)
          return (
            <button
              key={item.href}
              className={`bottom-nav-item${active ? ' active' : ''}`}
              onClick={() => {
                if (item.href === '#menu') {
                  setSidebarOpen(o => !o)
                } else {
                  router.push(item.href)
                }
              }}
              aria-label={item.label}
            >
              <span className="bn-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <SupportButton />
    </div>
  )
}
