'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase'
import { isPondruffUser } from '@/lib/pondruff'

const TABS = [
  { href: '/dashboard/pondruff/wareneingang', icon: '📥', label: 'Wareneingang' },
  { href: '/dashboard/pondruff/preisrechner', icon: '💶', label: 'Preisrechner' },
  { href: '/dashboard/pondruff/buero-wiso', icon: '🧾', label: 'Büro / WISO' },
]

export default function PondruffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    createSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!isPondruffUser(user?.email)) {
        router.replace('/dashboard')
      } else {
        setOk(true)
      }
    }).catch(() => router.replace('/dashboard'))
  }, [router])

  if (!ok) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#e50909,#b80000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff' }}>P</div>
        <div>
          <div style={{ fontSize: 12, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pondruff Polier-Service</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Wareneingang · Preisrechner · WISO</div>
        </div>
      </div>
      <div className="pk-tab-bar" style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto' }}>
        {TABS.map(t => (
          <Link key={t.href} href={t.href} className="pk-btn-ghost" style={{ whiteSpace: 'nowrap' }}>
            <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
