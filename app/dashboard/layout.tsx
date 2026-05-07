'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import SupportButton from '@/components/SupportButton'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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

  return (
    <div style={{ display: 'flex' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dashboard-main">
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'linear-gradient(180deg, rgba(5,7,11,.96), rgba(5,7,11,.90))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,.07)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Hamburger – only visible on mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menü öffnen"
            style={{
              display: 'none', // shown via CSS on mobile
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 5, flexShrink: 0,
            }}
          >
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
          </button>

          <div style={{ flex: 1 }}>
            <GlobalSearch />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <NotificationBell />
            <button
              onClick={() => router.push('/dashboard/einstellungen')}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #1684ff22, #20c8ff22)',
                border: '1px solid rgba(22,132,255,.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 15, color: '#6cb6ff',
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(22,132,255,.2)'; e.currentTarget.style.borderColor = 'rgba(22,132,255,.5)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #1684ff22, #20c8ff22)'; e.currentTarget.style.borderColor = 'rgba(22,132,255,.3)' }}
              title="Einstellungen"
            >
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </button>
          </div>
        </div>

        <main style={{ flex: 1, padding: '24px' }} className="main-inner">
          {children}
        </main>
      </div>

      <SupportButton />
    </div>
  )
}
