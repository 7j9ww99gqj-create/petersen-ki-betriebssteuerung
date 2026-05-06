'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 900))
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.')
      setLoading(false)
      return
    }
    localStorage.setItem('pk_user', JSON.stringify({
      name: email.split('@')[0] || 'Demo User',
      email,
      role: 'Demo Admin',
      pilots: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung'],
    }))
    router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      background: 'radial-gradient(circle at 20% 20%, rgba(22,132,255,.22), transparent 40%), radial-gradient(circle at 80% 80%, rgba(32,200,255,.12), transparent 40%), linear-gradient(180deg,#05070b,#07101a)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(22,132,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(22,132,255,.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }} className="fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: '0 auto 18px',
            overflow: 'hidden', position: 'relative',
            border: '2px solid rgba(22,132,255,.4)',
            boxShadow: '0 0 40px rgba(22,132,255,.35), 0 0 80px rgba(22,132,255,.12)',
          }}>
            <Image
              src="/logo.jpg"
              alt="Petersen KI Logo"
              width={80}
              height={80}
              style={{ objectFit: 'cover' }}
              priority
            />
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

        {/* Login card */}
        <div className="pk-card" style={{ padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Anmelden</h2>
            <p style={{ margin: '6px 0 0', color: '#aeb9c8', fontSize: 14 }}>
              Willkommen zurück. Melden Sie sich an, um fortzufahren.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>
                E-Mail Adresse
              </label>
              <input
                className="pk-input"
                type="email"
                placeholder="name@betrieb.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>
                Passwort
              </label>
              <input
                className="pk-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)',
                color: '#ff8080', fontSize: 13,
              }}>{error}</div>
            )}

            <button
              type="submit"
              className="pk-btn"
              disabled={loading}
              style={{ width: '100%', fontSize: 15, fontWeight: 800, minHeight: 48 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Anmeldung läuft…
                </span>
              ) : 'Anmelden →'}
            </button>
          </form>

          <div style={{
            marginTop: 20, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)',
            fontSize: 13, color: '#93b8ff',
          }}>
            <strong>🎯 Demo-Modus:</strong> Beliebige E-Mail + Passwort eingeben, um die Demo zu starten.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#4a5568' }}>
          © 2025 Petersen KI Betriebssteuerung · Demo Version
        </div>
      </div>
    </div>
  )
}
