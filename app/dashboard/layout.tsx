'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // No Supabase → show dashboard without auth (dev mode)
      setChecked(true)
      return
    }

    let subscription: { unsubscribe: () => void } | null = null

    try {
      const supabase = createSupabaseClient()

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.push('/login')
          return
        }
        const email = session.user.email ?? ''
        setUserName(email.split('@')[0] || email)
        setChecked(true)
      }).catch(() => {
        router.push('/login')
      })

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/login')
        }
      })
      subscription = data.subscription
    } catch {
      router.push('/login')
    }

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
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 240, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'linear-gradient(180deg, rgba(5,7,11,.96), rgba(5,7,11,.90))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,.07)',
          padding: '10px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <GlobalSearch />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(22,132,255,.2)'
                e.currentTarget.style.borderColor = 'rgba(22,132,255,.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1684ff22, #20c8ff22)'
                e.currentTarget.style.borderColor = 'rgba(22,132,255,.3)'
              }}
              title="Einstellungen"
            >
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </button>
          </div>
        </div>
        <main style={{ flex: 1, padding: '28px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
