'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/auth'

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'E-Mail oder Passwort ist falsch.',
  'Email not confirmed': 'Bitte bestätigen Sie Ihre E-Mail-Adresse.',
  'Too many requests': 'Zu viele Anmeldeversuche. Bitte warten Sie kurz.',
}

function toGerman(msg: string): string {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg.includes(key)) return val
  }
  return 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')

  async function signIn(loginEmail: string, loginPassword: string, isDemo = false) {
    isDemo ? setDemoLoading(true) : setLoading(true)
    setError('')

    if (!isSupabaseConfigured()) {
      setError('Supabase ist nicht konfiguriert. Bitte Umgebungsvariablen prüfen.')
      isDemo ? setDemoLoading(false) : setLoading(false)
      return
    }

    try {
      const supabase = createSupabaseClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })

      if (authError) {
        setError(toGerman(authError.message))
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setError('Verbindungsfehler. Bitte Internetverbindung prüfen.')
      console.error(e)
    } finally {
      isDemo ? setDemoLoading(false) : setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return }
    await signIn(email, password)
  }

  const handleDemo = () => signIn(DEMO_EMAIL, DEMO_PASSWORD, true)

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      background: 'radial-gradient(circle at 20% 20%, rgba(22,132,255,.22), transparent 40%), radial-gradient(circle at 80% 80%, rgba(32,200,255,.12), transparent 40%), linear-gradient(180deg,#05070b,#07101a)',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(22,132,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(22,132,255,.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: '0 auto 18px',
            overflow: 'hidden', position: 'relative',
            border: '2px solid rgba(22,132,255,.4)',
            boxShadow: '0 0 40px rgba(22,132,255,.35), 0 0 80px rgba(22,132,255,.12)',
          }}>
            <Image src="/logo.jpg" alt="Petersen KI Logo" width={80} height={80} style={{ objectFit: 'cover' }} priority />
          </div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: '-.04em', lineHeight: 1.1 }}>
            Petersen <span style={{ color: '#1684ff' }}>KI</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#aeb9c8', letterSpacing: '-.01em', marginTop: 2 }}>
            Betriebssteuerung
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            KI-unterstütztes Warenwirtschaftssystem
          </div>
        </div>

        <div className="pk-card" style={{ padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Anmelden</h2>
            <p style={{ margin: '6px 0 0', color: '#aeb9c8', fontSize: 14 }}>
              Melden Sie sich an, um auf Ihre Petersen KI Betriebssteuerung zuzugreifen.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>E-Mail Adresse</label>
              <input className="pk-input" type="email" placeholder="name@betrieb.de" value={email}
                onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading || demoLoading} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Passwort</label>
              <input className="pk-input" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={loading || demoLoading} />
            </div>

            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)',
                color: '#ff8080', fontSize: 13,
              }}>{error}</div>
            )}

            <button type="submit" className="pk-btn" disabled={loading || demoLoading}
              style={{ width: '100%', fontSize: 15, fontWeight: 800, minHeight: 48 }}>
              {loading ? <Spinner text="Anmeldung läuft…" /> : 'Anmelden →'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
            <span style={{ fontSize: 12, color: '#4a5568' }}>oder</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
          </div>

          <button onClick={handleDemo} disabled={loading || demoLoading} className="pk-btn-ghost"
            style={{ width: '100%', minHeight: 44, fontWeight: 700, fontSize: 14 }}>
            {demoLoading ? <Spinner text="Demo wird geladen…" /> : '🎯 Demo-Zugang verwenden'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#4a5568' }}>
          © 2025 Petersen KI Betriebssteuerung
        </div>
      </div>
    </div>
  )
}

function Spinner({ text }: { text: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{
        width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)',
        borderTopColor: 'white', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite', display: 'inline-block',
      }} />
      {text}
    </span>
  )
}
