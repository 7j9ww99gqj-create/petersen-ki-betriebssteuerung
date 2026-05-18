'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { getAccessProfile, getAccessStatusMessage } from '@/lib/access'
import { performLogout } from '@/lib/auth'

type ApprovalView = {
  email: string
  message: string
  status: 'pending' | 'suspended' | 'expired' | 'active'
  allowedPilots: string[]
}

export default function ApprovalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [fallbackStatus, setFallbackStatus] = useState('')
  const [view, setView] = useState<ApprovalView>({
    email: '',
    message: 'Ihr Account wird gerade geprüft.',
    status: 'pending',
    allowedPilots: [],
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFallbackStatus(new URLSearchParams(window.location.search).get('status') ?? '')
    }
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    createSupabaseClient().auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) {
          setLoading(false)
          return
        }

        const profile = getAccessProfile(user)
        if (profile.canAccessDashboard) {
          router.replace('/dashboard')
          return
        }

        const status = profile.isExpired
          ? 'expired'
          : profile.status === 'suspended'
            ? 'suspended'
            : profile.canAccessDashboard
              ? 'active'
              : 'pending'

        setView({
          email: user.email ?? '',
          message: getAccessStatusMessage(profile),
          status,
          allowedPilots: profile.allowedPilotIds,
        })
      })
      .finally(() => setLoading(false))
  }, [router])

  const status = view.status === 'pending' && (fallbackStatus === 'expired' || fallbackStatus === 'suspended')
    ? fallbackStatus
    : view.status

  const icon = status === 'expired' ? '⌛' : status === 'suspended' ? '⛔' : '⏳'
  const title = status === 'expired'
    ? 'Zugang abgelaufen'
    : status === 'suspended'
      ? 'Zugang gesperrt'
      : 'Freischaltung ausstehend'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'radial-gradient(circle at 20% 20%, rgba(22,132,255,.18), transparent 40%), radial-gradient(circle at 80% 80%, rgba(32,200,255,.1), transparent 40%), linear-gradient(180deg,#05070b,#07101a)',
    }}>
      <div className="pk-card" style={{ width: 'min(560px, 100%)', padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>{icon}</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{title}</h1>
          <p style={{ margin: '10px 0 0', color: '#aeb9c8', fontSize: 14, lineHeight: 1.6 }}>
            {loading ? 'Freigabestatus wird geladen…' : view.message}
          </p>
        </div>

        {view.email && (
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            fontSize: 13,
            color: '#dbe4ef',
          }}>
            Konto: <strong>{view.email}</strong>
          </div>
        )}

        {view.allowedPilots.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(22,132,255,.08)',
            border: '1px solid rgba(22,132,255,.18)',
            fontSize: 13,
            color: '#cfe5ff',
          }}>
            Bereits zugewiesen: {view.allowedPilots.join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="pk-btn" onClick={() => router.refresh()} style={{ flex: 1, minWidth: 180 }}>
            Status aktualisieren
          </button>
          <Link href="/login" className="pk-btn-ghost" style={{ flex: 1, minWidth: 180, textDecoration: 'none', textAlign: 'center', paddingTop: 12, paddingBottom: 12 }}>
            Zur Anmeldung
          </Link>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/register" style={{ color: '#6cb6ff', textDecoration: 'none', fontSize: 13 }}>
            Neues Konto anlegen
          </Link>
          <button
            onClick={() => void performLogout()}
            style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 13 }}
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}
