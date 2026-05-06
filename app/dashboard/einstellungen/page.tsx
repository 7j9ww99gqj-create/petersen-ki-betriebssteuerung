'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/auth'

type NotifSettings = {
  wareneingaenge: boolean; niedrigerBestand: boolean; auftraege: boolean
  rechnungen: boolean; cloudSync: boolean; kiErkennungen: boolean
}

export default function EinstellungenPage() {
  const router = useRouter()
  const [section, setSection] = useState<'profil' | 'benachrichtigungen' | 'info'>('profil')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isDemo, setIsDemo] = useState(false)

  const [profil, setProfil] = useState({ name: '', email: '', role: 'Administrator', firma: '' })
  const [pwForm, setPwForm] = useState({ alt: '', neu: '', bestaetigung: '' })
  const [notif, setNotif] = useState<NotifSettings>({
    wareneingaenge: true, niedrigerBestand: true, auftraege: true,
    rechnungen: true, cloudSync: false, kiErkennungen: false,
  })

  useEffect(() => {
    const session = getSession()
    if (session) {
      setIsDemo(session.isDemo)
      setProfil(prev => ({
        ...prev,
        name: session.name || '',
        email: session.email || '',
        role: session.role || 'Administrator',
        firma: session.firma || '',
      }))
    }
    const savedNotif = localStorage.getItem('pk_notif')
    if (savedNotif) setNotif(JSON.parse(savedNotif))
  }, [])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  const handleProfilSave = () => {
    if (!profil.name || !profil.email) { showToast('Name und E-Mail sind Pflichtfelder', 'error'); return }
    const session = getSession()
    if (session) {
      const updated = { ...session, name: profil.name, email: profil.email, firma: profil.firma }
      localStorage.setItem('pk_user', JSON.stringify(updated))
    }
    showToast('✅ Profil wurde gespeichert')
  }

  const handlePwSave = () => {
    if (!pwForm.alt) { showToast('Bitte aktuelles Passwort eingeben', 'error'); return }
    if (pwForm.neu.length < 6) { showToast('Neues Passwort muss mindestens 6 Zeichen lang sein', 'error'); return }
    if (pwForm.neu !== pwForm.bestaetigung) { showToast('Passwörter stimmen nicht überein', 'error'); return }
    setPwForm({ alt: '', neu: '', bestaetigung: '' })
    showToast('✅ Passwort wurde geändert')
  }

  const handleNotifSave = () => {
    localStorage.setItem('pk_notif', JSON.stringify(notif))
    showToast('✅ Benachrichtigungseinstellungen gespeichert')
  }

  const handleLogout = () => {
    clearSession()
    router.push('/login')
  }

  const NavItem = ({ id, icon, label }: { id: typeof section; icon: string; label: string }) => (
    <button onClick={() => setSection(id)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
      background: section === id ? 'rgba(22,132,255,.15)' : 'transparent',
      color: section === id ? '#6cb6ff' : '#aeb9c8',
      fontWeight: section === id ? 700 : 500, fontSize: 14,
      borderLeft: section === id ? '2px solid #1684ff' : '2px solid transparent',
      transition: 'background .15s',
    }}>
      <span>{icon}</span> {label}
    </button>
  )

  const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{desc}</div>}
      </div>
      <button onClick={onChange} style={{
        width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: checked ? 'linear-gradient(135deg, #1684ff, #005bea)' : 'rgba(255,255,255,.1)',
        transition: 'background .2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 22 : 2, width: 18, height: 18,
          borderRadius: '50%', background: 'white', transition: 'left .2s',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>⚙️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Einstellungen</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Profil · Benachrichtigungen · App-Informationen</p>
        </div>
      </div>

      {toast && (
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 16,
          background: toastType === 'success' ? 'rgba(37,211,102,.12)' : 'rgba(244,63,94,.12)',
          border: `1px solid ${toastType === 'success' ? 'rgba(37,211,102,.3)' : 'rgba(244,63,94,.3)'}`,
          color: toastType === 'success' ? '#4ddb7e' : '#fb7185', fontSize: 14, fontWeight: 600,
        }}>{toast}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar Nav */}
        <div className="pk-card" style={{ padding: '10px' }}>
          <NavItem id="profil" icon="👤" label="Benutzerprofil" />
          <NavItem id="benachrichtigungen" icon="🔔" label="Benachrichtigungen" />
          <NavItem id="info" icon="ℹ️" label="App-Informationen" />
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '10px 0' }} />
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
            background: 'transparent', color: '#aeb9c8', fontSize: 14, fontWeight: 500,
            transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span>🚪</span> Abmelden
          </button>
        </div>

        {/* Content */}
        <div>
          {/* ── Profil ── */}
          {section === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>👤 Benutzerprofil</h3>

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 999,
                    background: 'linear-gradient(135deg, #1684ff, #005bea)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 900, color: 'white',
                    boxShadow: '0 0 20px rgba(22,132,255,.3)',
                  }}>
                    {profil.name ? profil.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{profil.name || '–'}</div>
                    <div style={{ color: '#aeb9c8', fontSize: 13 }}>{profil.role}</div>
                    {isDemo && (
                      <span className="badge badge-orange" style={{ marginTop: 4 }}>● Demo-Modus</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Name *</label>
                    <input className="pk-input" value={profil.name} onChange={e => setProfil(p => ({ ...p, name: e.target.value }))} placeholder="Vollständiger Name" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>E-Mail *</label>
                    <input className="pk-input" type="email" value={profil.email} onChange={e => setProfil(p => ({ ...p, email: e.target.value }))} placeholder="email@betrieb.de" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Firma</label>
                    <input className="pk-input" value={profil.firma} onChange={e => setProfil(p => ({ ...p, firma: e.target.value }))} placeholder="Firmenname" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Rolle</label>
                    <input className="pk-input" value={profil.role} disabled style={{ opacity: .5, cursor: 'not-allowed' }} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <button className="pk-btn" onClick={handleProfilSave} style={{ fontWeight: 700 }}>Profil speichern</button>
                </div>
              </div>

              <div className="pk-card">
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🔑 Passwort ändern</h3>
                <div style={{ display: 'grid', gap: 14, maxWidth: 400 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Aktuelles Passwort</label>
                    <input className="pk-input" type="password" placeholder="••••••••" value={pwForm.alt} onChange={e => setPwForm(p => ({ ...p, alt: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Neues Passwort</label>
                    <input className="pk-input" type="password" placeholder="Min. 6 Zeichen" value={pwForm.neu} onChange={e => setPwForm(p => ({ ...p, neu: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Passwort bestätigen</label>
                    <input className="pk-input" type="password" placeholder="Passwort wiederholen" value={pwForm.bestaetigung} onChange={e => setPwForm(p => ({ ...p, bestaetigung: e.target.value }))} />
                  </div>
                  <button className="pk-btn" onClick={handlePwSave} style={{ fontWeight: 700, width: 'fit-content' }}>Passwort ändern</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Benachrichtigungen ── */}
          {section === 'benachrichtigungen' && (
            <div className="pk-card">
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🔔 Benachrichtigungen</h3>
              <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14 }}>Legen Sie fest, welche System-Meldungen Sie erhalten möchten.</p>

              <Toggle checked={notif.wareneingaenge} onChange={() => setNotif(p => ({ ...p, wareneingaenge: !p.wareneingaenge }))}
                label="Wareneingänge" desc="Benachrichtigung bei neuen Wareneingängen im LagerPilot" />
              <Toggle checked={notif.niedrigerBestand} onChange={() => setNotif(p => ({ ...p, niedrigerBestand: !p.niedrigerBestand }))}
                label="Niedriger Bestand" desc="Alarm wenn Artikel unter den Mindestbestand fallen" />
              <Toggle checked={notif.auftraege} onChange={() => setNotif(p => ({ ...p, auftraege: !p.auftraege }))}
                label="Auftrags-Updates" desc="Statusänderungen bei Werkstatt-Aufträgen und Arbeitskarten" />
              <Toggle checked={notif.rechnungen} onChange={() => setNotif(p => ({ ...p, rechnungen: !p.rechnungen }))}
                label="Überfällige Rechnungen" desc="Erinnerung bei Zahlungsverzug im BüroPilot" />
              <Toggle checked={notif.cloudSync} onChange={() => setNotif(p => ({ ...p, cloudSync: !p.cloudSync }))}
                label="Cloud-Sync Status" desc="Meldungen zu Backup und Synchronisierungsstatus" />
              <Toggle checked={notif.kiErkennungen} onChange={() => setNotif(p => ({ ...p, kiErkennungen: !p.kiErkennungen }))}
                label="KI-Erkennungen" desc="Benachrichtigungen nach automatischer Dokumentenanalyse" />

              <div style={{ marginTop: 20 }}>
                <button className="pk-btn" onClick={handleNotifSave} style={{ fontWeight: 700 }}>Einstellungen speichern</button>
              </div>
            </div>
          )}

          {/* ── Info ── */}
          {section === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>ℹ️ App-Informationen</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { label: 'Anwendung', value: 'Petersen KI Betriebssteuerung' },
                    { label: 'Version', value: 'v1.0.0' },
                    { label: 'Stack', value: 'Next.js 14 · TypeScript · Tailwind CSS' },
                    { label: 'KI-Modell', value: 'Anthropic Claude (Sonnet)' },
                    { label: 'Modus', value: isDemo ? 'Demo – Beispieldaten im Browser' : 'Produktiv' },
                    { label: 'Letzter Sync', value: 'Vor 2 Minuten' },
                    { label: 'Copyright', value: '© 2025 Petersen KI' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <span style={{ width: 180, fontSize: 13, color: '#aeb9c8', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isDemo && (
                <>
                  <div style={{
                    padding: '18px 20px', borderRadius: 16,
                    background: 'rgba(255,165,0,.08)', border: '1px solid rgba(255,165,0,.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>🎯</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Demo-Modus aktiv</div>
                        <p style={{ margin: 0, fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
                          Sie sind mit dem Demo-Zugang eingeloggt. Alle Daten sind Beispieldaten und werden lokal im Browser gespeichert.
                          Für den produktiven Einsatz besuchen Sie{' '}
                          <a href="https://petersen-ki-pilot.de" target="_blank" rel="noopener noreferrer" style={{ color: '#6cb6ff', textDecoration: 'underline' }}>
                            petersen-ki-pilot.de
                          </a>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pk-card" style={{ background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.15)' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#fb7185' }}>⚠️ Demo-Daten zurücksetzen</h3>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: '#aeb9c8' }}>
                      Alle lokalen Demo-Daten und Einstellungen löschen. Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                    <button onClick={() => {
                      localStorage.clear()
                      showToast('✅ Demo-Daten wurden zurückgesetzt. Sie werden abgemeldet…')
                      setTimeout(() => router.push('/login'), 2000)
                    }} style={{
                      padding: '10px 20px', borderRadius: 999, border: '1px solid rgba(244,63,94,.3)',
                      background: 'transparent', color: '#fb7185', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>
                      🗑️ Daten zurücksetzen
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
