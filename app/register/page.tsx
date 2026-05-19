'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { isSupabaseConfigured } from '@/lib/supabase'

const PILOTEN = [
  { id: 'lager',     label: 'LagerPilot' },
  { id: 'buero',     label: 'BüroPilot' },
  { id: 'werkstatt', label: 'WerkstattPilot' },
  { id: 'marketing', label: 'MarketingPilot' },
  { id: 'analyse',   label: 'AnalysePilot' },
  { id: 'planung',   label: 'PlanungPilot' },
  { id: 'ki',        label: 'KI-Assistent' },
  { id: 'steuer',    label: 'SteuerPilot' },
  { id: 'cloud',     label: 'Cloud & Sync' },
  { id: 'archiv',    label: 'Archiv' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [strasse, setStrasse] = useState('')
  const [plz, setPlz] = useState('')
  const [stadt, setStadt] = useState('')
  const [piloten, setPiloten] = useState<string[]>([])
  const [showPiloten, setShowPiloten] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function togglePilot(id: string) {
    setPiloten(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein.'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }
    if (!strasse || !plz || !stadt) { setError('Bitte vollständige Adresse (Straße, PLZ, Stadt) angeben.'); return }

    if (!isSupabaseConfigured()) {
      setError('Supabase ist nicht konfiguriert (Umgebungsvariablen fehlen).')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          company,
          strasse,
          plz,
          stadt,
          interessiertePiloten: piloten,
        }),
      })
      const data = await res.json().catch(() => null) as { error?: string } | null

      if (!res.ok) {
        setError(data?.error ?? 'Registrierung konnte nicht angelegt werden.')
        return
      }

      setSuccess(true)
    } catch (e) {
      setError('Verbindungsfehler. Bitte Internetverbindung prüfen.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selectedLabels = piloten.map(id => PILOTEN.find(p => p.id === id)?.label).filter(Boolean).join(', ')

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
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>Registrierung eingegangen</h2>
              <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14, lineHeight: 1.6 }}>
                Ihr Konto für <strong style={{ color: '#f8fbff' }}>{email}</strong> wurde angelegt.
              </p>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
                Der Zugang bleibt gesperrt, bis ein Inhaber Ihren Account freischaltet und Piloten zuteilt.
              </p>
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)',
                fontSize: 12, color: '#93b8ff', textAlign: 'left', lineHeight: 1.5,
              }}>
                Sie sehen nach dem Login einen Hinweis auf den Freigabestatus, bis Ihr Zugang aktiv gesetzt wurde.
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
                {/* Kontaktdaten */}
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="field-e-mail-adresse" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>E-Mail Adresse</label>
                  <input id="field-e-mail-adresse" className="pk-input" type="email" placeholder="name@betrieb.de" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="field-name" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Name</label>
                  <input id="field-name" className="pk-input" placeholder="Max Mustermann" value={fullName}
                    onChange={e => setFullName(e.target.value)} autoComplete="name" disabled={loading} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="field-firma" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Firma</label>
                  <input id="field-firma" className="pk-input" placeholder="Musterbetrieb GmbH" value={company}
                    onChange={e => setCompany(e.target.value)} autoComplete="organization" disabled={loading} />
                </div>

                {/* Adresse */}
                <div style={{ marginBottom: 6 }}>
                  <label htmlFor="field-strae-amp-hausnummer" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Straße &amp; Hausnummer</label>
                  <input id="field-strae-amp-hausnummer" className="pk-input" placeholder="Musterstraße 12" value={strasse}
                    onChange={e => setStrasse(e.target.value)} autoComplete="street-address" disabled={loading} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: '0 0 100px' }}>
                    <input className="pk-input" placeholder="PLZ" value={plz}
                      onChange={e => setPlz(e.target.value)} autoComplete="postal-code" disabled={loading}
                      style={{ marginTop: 8 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input className="pk-input" placeholder="Stadt" value={stadt}
                      onChange={e => setStadt(e.target.value)} autoComplete="address-level2" disabled={loading}
                      style={{ marginTop: 8 }} />
                  </div>
                </div>

                {/* Piloten-Interesse */}
                <div style={{ marginBottom: 14, position: 'relative' }}>
                  <span style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>
                    Interesse an Piloten <span style={{ color: '#4a5568', fontWeight: 400 }}>(optional)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPiloten(v => !v)}
                    disabled={loading}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 10, color: piloten.length ? '#f8fbff' : '#4a5568',
                      fontSize: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                      {piloten.length ? selectedLabels : 'Piloten auswählen…'}
                    </span>
                    <span style={{ color: '#aeb9c8', fontSize: 12, flexShrink: 0 }}>{showPiloten ? '▲' : '▼'}</span>
                  </button>

                  {showPiloten && (
                    <div style={{
                      position: 'absolute', zIndex: 10, top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: '#101a28', border: '1px solid rgba(22,132,255,.3)',
                      borderRadius: 10, padding: '8px 0', boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                    }}>
                      {PILOTEN.map(p => (
                        <label key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 16px', cursor: 'pointer',
                          background: piloten.includes(p.id) ? 'rgba(22,132,255,.1)' : 'transparent',
                          transition: 'background .15s',
                        }}>
                          <input
                            type="checkbox"
                            checked={piloten.includes(p.id)}
                            onChange={() => togglePilot(p.id)}
                            style={{ accentColor: '#1684ff', width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: 14, color: piloten.includes(p.id) ? '#93b8ff' : '#aeb9c8', fontWeight: piloten.includes(p.id) ? 600 : 400 }}>
                            {p.label}
                          </span>
                        </label>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 6, padding: '8px 16px 2px' }}>
                        <button type="button" onClick={() => setShowPiloten(false)}
                          style={{ background: 'none', border: 'none', color: '#1684ff', fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                          Auswahl übernehmen ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Passwort */}
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="field-passwort" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Passwort</label>
                  <input id="field-passwort" className="pk-input" type="password" placeholder="Min. 6 Zeichen" value={password}
                    onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="field-passwort-besttigen" style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Passwort bestätigen</label>
                  <input id="field-passwort-besttigen" className="pk-input" type="password" placeholder="Passwort wiederholen" value={confirm}
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
