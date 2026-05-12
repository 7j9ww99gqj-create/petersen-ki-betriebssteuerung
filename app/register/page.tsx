'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }

    if (!isSupabaseConfigured()) {
      setError('Supabase ist nicht konfiguriert (Umgebungsvariablen fehlen).')
      return
    }

    setLoading(true)
    try {
      const supabase = createSupabaseClient()
      const { data, error: authError } = await supabase.auth.signUp({ email, password })

      if (authError) {
        setError(authError.message)
        return
      }

      // Session directly available → email confirmation disabled → go to dashboard
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
        return
      }

      // No session → email confirmation required
      setSuccess(true)
    } catch (e) {
      setError('Verbindungsfehler. Bitte Internetverbindung prüfen.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, margin: '0 auto 18px', overflow: 'hidden',
            border: '2px solid rgba(22,132,255,.4)',
            boxShadow: '0 0 40px rgba(22,132,255,.35), 0 0 80px rgba(22,132,255,.12)',
          }}>
            <Image src="/logo.jpg" alt="Petersen KI Logo" width={80} height={80} style={{ objectFit: 'cover' }} priority />
          </div>
          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: '-.04em', lineHeight: 1.1 }}>
            Petersen <span style={{ color: '#1684ff' }}>KI</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#aeb9c8', marginTop: 2 }}>Betriebssteuerung</div>
        </div>

        <div className="pk-card" style={{ padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>

          {success ? (
            /* ── E-Mail-Bestätigung ausstehend ── */
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>E-Mail bestätigen</h2>
              <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14, lineHeight: 1.6 }}>
                Wir haben einen Bestätigungslink an <strong style={{ color: '#f8fbff' }}>{email}</strong> gesendet.
                Bitte öffnen Sie die E-Mail und klicken Sie auf den Link.
              </p>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
                Kein E-Mail erhalten? Prüfen Sie den Spam-Ordner oder{' '}
                <button onClick={() => setSuccess(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#6cb6ff',
                  fontSize: 13, textDecoration: 'underline', padding: 0,
                }}>versuchen Sie es erneut</button>.
              </p>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)',
                fontSize: 12, color: '#93b8ff', textAlign: 'left', lineHeight: 1.5,
              }}>
                💡 <strong>Tipp für Entwickler:</strong> E-Mail-Bestätigung in Supabase unter
                Authentication → Settings → „Confirm email&quot; deaktivieren, dann ist der Login sofort möglich.
              </div>
              <button onClick={() => router.push('/login')} className="pk-btn"
                style={{ width: '100%', marginTop: 20, fontWeight: 700 }}>
                Zur Anmeldung →
              </button>
            </div>
          ) : (
            /* ── Registrierungsformular ── */
            <>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Konto erstellen</h2>
                <p style={{ margin: '6px 0 0', color: '#aeb9c8', fontSize: 14 }}>
                  Erstellen Sie Ihren Zugang zur Petersen KI Betriebssteuerung.
                </p>
              </div>

              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>E-Mail Adresse</label>
                  <input className="pk-input" type="email" placeholder="name@betrieb.de" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Passwort</label>
                  <input className="pk-input" type="password" placeholder="Min. 6 Zeichen" value={password}
                    onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Passwort bestätigen</label>
                  <input className="pk-input" type="password" placeholder="Passwort wiederholen" value={confirm}
                    onChange={e => setConfirm(e.target.value)} autoComplete="new-password" disabled={loading} />
                </div>

                {error && (
                  <div style={{
                    marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)',
                    color: '#ff8080', fontSize: 13,
                  }}>{error}</div>
                )}

                <button type="submit" className="pk-btn" disabled={loading}
                  style={{ width: '100%', fontSize: 15, fontWeight: 800, minHeight: 48 }}>
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                        Konto wird erstellt…
                      </span>
                    : 'Konto erstellen →'
                  }
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        {!success && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => router.push('/login')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#aeb9c8', fontSize: 13,
            }}>
              ← Zurück zur Anmeldung
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#4a5568' }}>
          © 2025 Petersen KI Betriebssteuerung
        </div>
      </div>
    </div>
  )
}
