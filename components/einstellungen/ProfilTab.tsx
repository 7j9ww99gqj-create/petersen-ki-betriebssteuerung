'use client'
import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { isDemoUser } from '@/lib/auth'
import { normalizeRole } from '@/lib/roles'

/**
 * ProfilTab — Benutzerprofil + Passwort ändern.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 1).
 *
 * Eigenständiger State: profil, pwForm.
 * Lädt eigene User-Daten beim Mount, ohne dass die Parent-Page sie kennen muss.
 */
export default function ProfilTab({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [profil, setProfil] = useState({ name: '', email: '', role: 'Administrator', firma: '' })
  const [pwForm, setPwForm] = useState({ neu: '', bestaetigung: '' })
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      const demo = isDemoUser(email)
      const resolvedRole = normalizeRole(user.app_metadata?.role ?? user.user_metadata?.role)
      setProfil({
        name: (user.user_metadata?.full_name as string) ?? email.split('@')[0] ?? '',
        email,
        role: resolvedRole,
        firma: (user.user_metadata?.firma as string) ?? '',
      })
      setIsDemo(demo)
    })
  }, [])

  const handleProfilSave = async () => {
    if (!profil.name || !profil.email) {
      showToast('Name und E-Mail sind Pflichtfelder', 'error')
      return
    }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profil.name, firma: profil.firma },
    })
    if (error) {
      showToast('Fehler beim Speichern: ' + error.message, 'error')
      return
    }
    showToast('✅ Profil wurde gespeichert')
  }

  const handlePwSave = async () => {
    if (pwForm.neu.length < 6) {
      showToast('Neues Passwort muss mindestens 6 Zeichen lang sein', 'error')
      return
    }
    if (pwForm.neu !== pwForm.bestaetigung) {
      showToast('Passwörter stimmen nicht überein', 'error')
      return
    }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.neu })
    if (error) {
      showToast('Fehler: ' + error.message, 'error')
      return
    }
    setPwForm({ neu: '', bestaetigung: '' })
    showToast('✅ Passwort wurde geändert')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pk-card">
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>👤 Benutzerprofil</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'linear-gradient(135deg, #1684ff, #005bea)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
              color: 'white',
              boxShadow: '0 0 20px rgba(22,132,255,.3)',
            }}
          >
            {profil.name ? profil.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{profil.name || '–'}</div>
            <div style={{ color: '#aeb9c8', fontSize: 13 }}>{profil.role}</div>
            {isDemo && (
              <span className="badge badge-orange" style={{ marginTop: 4 }}>
                ● Demo-Modus
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label
              htmlFor="field-name"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#aeb9c8',
                marginBottom: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Name *
            </label>
            <input
              id="field-name"
              className="pk-input"
              value={profil.name}
              onChange={e => setProfil(p => ({ ...p, name: e.target.value }))}
              placeholder="Vollständiger Name"
            />
          </div>
          <div>
            <label
              htmlFor="field-e-mail"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#aeb9c8',
                marginBottom: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              E-Mail
            </label>
            <input
              id="field-e-mail"
              className="pk-input"
              value={profil.email}
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>
          <div>
            <label
              htmlFor="field-firma"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#aeb9c8',
                marginBottom: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Firma
            </label>
            <input
              id="field-firma"
              className="pk-input"
              value={profil.firma}
              onChange={e => setProfil(p => ({ ...p, firma: e.target.value }))}
              placeholder="Firmenname"
            />
          </div>
          <div>
            <label
              htmlFor="field-rolle"
              style={{
                display: 'block',
                fontSize: 12,
                color: '#aeb9c8',
                marginBottom: 6,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Rolle
            </label>
            <input
              id="field-rolle"
              className="pk-input"
              value={profil.role}
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="pk-btn" onClick={handleProfilSave} style={{ fontWeight: 700 }}>
            Profil speichern
          </button>
        </div>
      </div>

      {!isDemo && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🔑 Passwort ändern</h3>
          <div style={{ display: 'grid', gap: 14, maxWidth: 400 }}>
            <div>
              <label
                htmlFor="field-neues-passwort"
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: '#aeb9c8',
                  marginBottom: 6,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Neues Passwort
              </label>
              <input
                id="field-neues-passwort"
                className="pk-input"
                type="password"
                placeholder="Min. 6 Zeichen"
                value={pwForm.neu}
                onChange={e => setPwForm(p => ({ ...p, neu: e.target.value }))}
              />
            </div>
            <div>
              <label
                htmlFor="field-passwort-besttigen"
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: '#aeb9c8',
                  marginBottom: 6,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Passwort bestätigen
              </label>
              <input
                id="field-passwort-besttigen"
                className="pk-input"
                type="password"
                placeholder="Passwort wiederholen"
                value={pwForm.bestaetigung}
                onChange={e => setPwForm(p => ({ ...p, bestaetigung: e.target.value }))}
              />
            </div>
            <button className="pk-btn" onClick={handlePwSave} style={{ fontWeight: 700, width: 'fit-content' }}>
              Passwort ändern
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
