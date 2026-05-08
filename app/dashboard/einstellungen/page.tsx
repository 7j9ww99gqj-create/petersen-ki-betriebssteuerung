'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { isDemoUser, hasDemoCookie } from '@/lib/auth'
import { type AppRole, ROLE_LABELS, ROLE_PILOTS, PERMISSIONS, useRole, setRole as saveRole } from '@/lib/roles'
import {
  parseCsvFile, validateImportRows, autoMapColumns, buildImportRows,
  normalizeNumber, normalizeDate,
  TARGET_FIELDS, DEMO_CSV_ARTIKEL, DEMO_CSV_KUNDEN, DEMO_CSV_STEUER, DEMO_CSV_BUCHUNGEN,
  type ImportDataType, type ImportSource, type ImportParseResult, type ImportValidationResult,
} from '@/lib/importer'
import {
  getImportProtokolle, insertImportProtokoll,
  bulkImportLagerArtikel, bulkImportBueroKunden, bulkImportEinkaufLieferanten,
  bulkImportBueroRechnungen, bulkImportSteuerBelege, bulkImportSteuerBuchungen,
  bulkImportSteuerKonten,
} from '@/lib/db'

type NotifSettings = {
  wareneingaenge: boolean; niedrigerBestand: boolean; auftraege: boolean
  rechnungen: boolean; cloudSync: boolean; kiErkennungen: boolean
}

export default function EinstellungenPage() {
  const router = useRouter()
  const [section, setSection] = useState<'profil' | 'benachrichtigungen' | 'rollen' | 'info' | 'import'>('profil')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isDemo, setIsDemo] = useState(false)

  const { role: currentRole, setRole: applyRole } = useRole()
  const [selectedRole, setSelectedRole] = useState<AppRole>('Admin')

  // Sync picker with current role once loaded
  useEffect(() => { setSelectedRole(currentRole) }, [currentRole])

  const [profil, setProfil] = useState({ name: '', email: '', role: 'Administrator', firma: '' })
  const [pwForm, setPwForm] = useState({ neu: '', bestaetigung: '' })
  const [notif, setNotif] = useState<NotifSettings>({
    wareneingaenge: true, niedrigerBestand: true, auftraege: true,
    rechnungen: true, cloudSync: false, kiErkennungen: false,
  })

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      const demo = isDemoUser(email)
      setIsDemo(demo)
      setProfil({
        name: (user.user_metadata?.full_name as string) || email.split('@')[0] || '',
        email,
        role: demo ? 'Demo Admin' : 'Administrator',
        firma: (user.user_metadata?.firma as string) || '',
      })
    })
    const saved = localStorage.getItem('pk_notif')
    if (saved) setNotif(JSON.parse(saved))
  }, [])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  const handleProfilSave = async () => {
    if (!profil.name || !profil.email) { showToast('Name und E-Mail sind Pflichtfelder', 'error'); return }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profil.name, firma: profil.firma },
    })
    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return }
    showToast('✅ Profil wurde gespeichert')
  }

  const handlePwSave = async () => {
    if (pwForm.neu.length < 6) { showToast('Neues Passwort muss mindestens 6 Zeichen lang sein', 'error'); return }
    if (pwForm.neu !== pwForm.bestaetigung) { showToast('Passwörter stimmen nicht überein', 'error'); return }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.neu })
    if (error) { showToast('Fehler: ' + error.message, 'error'); return }
    setPwForm({ neu: '', bestaetigung: '' })
    showToast('✅ Passwort wurde geändert')
  }

  const handleNotifSave = () => {
    localStorage.setItem('pk_notif', JSON.stringify(notif))
    showToast('✅ Benachrichtigungseinstellungen gespeichert')
  }

  const handleLogout = async () => {
    const supabase = createSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavItem = ({ id, icon, label }: { id: typeof section; icon: string; label: string }) => (
    <button onClick={() => setSection(id)} data-active={section === id} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
      background: section === id ? 'rgba(22,132,255,.15)' : 'transparent',
      color: section === id ? '#6cb6ff' : '#aeb9c8',
      fontWeight: section === id ? 700 : 500, fontSize: 14,
      borderLeft: section === id ? '2px solid #1684ff' : '2px solid transparent',
      transition: 'background .15s', whiteSpace: 'nowrap',
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

      <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="pk-card settings-nav" style={{ padding: '10px' }}>
          <NavItem id="profil" icon="👤" label="Profil" />
          <NavItem id="benachrichtigungen" icon="🔔" label="Benachricht." />
          <NavItem id="rollen" icon="🔑" label="Rollen" />
          <NavItem id="import" icon="📥" label="Import" />
          <NavItem id="info" icon="ℹ️" label="Info" />
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

        <div>
          {section === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>👤 Benutzerprofil</h3>
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
                    {isDemo && <span className="badge badge-orange" style={{ marginTop: 4 }}>● Demo-Modus</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Name *</label>
                    <input className="pk-input" value={profil.name} onChange={e => setProfil(p => ({ ...p, name: e.target.value }))} placeholder="Vollständiger Name" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>E-Mail</label>
                    <input className="pk-input" value={profil.email} disabled style={{ opacity: .5, cursor: 'not-allowed' }} />
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

              {!isDemo && (
                <div className="pk-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🔑 Passwort ändern</h3>
                  <div style={{ display: 'grid', gap: 14, maxWidth: 400 }}>
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
              )}
            </div>
          )}

          {section === 'benachrichtigungen' && (
            <div className="pk-card">
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🔔 Benachrichtigungen</h3>
              <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14 }}>Legen Sie fest, welche System-Meldungen Sie erhalten möchten.</p>
              <Toggle checked={notif.wareneingaenge} onChange={() => setNotif(p => ({ ...p, wareneingaenge: !p.wareneingaenge }))} label="Wareneingänge" desc="Benachrichtigung bei neuen Wareneingängen im LagerPilot" />
              <Toggle checked={notif.niedrigerBestand} onChange={() => setNotif(p => ({ ...p, niedrigerBestand: !p.niedrigerBestand }))} label="Niedriger Bestand" desc="Alarm wenn Artikel unter den Mindestbestand fallen" />
              <Toggle checked={notif.auftraege} onChange={() => setNotif(p => ({ ...p, auftraege: !p.auftraege }))} label="Auftrags-Updates" desc="Statusänderungen bei Werkstatt-Aufträgen und Arbeitskarten" />
              <Toggle checked={notif.rechnungen} onChange={() => setNotif(p => ({ ...p, rechnungen: !p.rechnungen }))} label="Überfällige Rechnungen" desc="Erinnerung bei Zahlungsverzug im BüroPilot" />
              <Toggle checked={notif.cloudSync} onChange={() => setNotif(p => ({ ...p, cloudSync: !p.cloudSync }))} label="Cloud-Sync Status" desc="Meldungen zu Backup und Synchronisierungsstatus" />
              <Toggle checked={notif.kiErkennungen} onChange={() => setNotif(p => ({ ...p, kiErkennungen: !p.kiErkennungen }))} label="KI-Erkennungen" desc="Benachrichtigungen nach automatischer Dokumentenanalyse" />
              <div style={{ marginTop: 20 }}>
                <button className="pk-btn" onClick={handleNotifSave} style={{ fontWeight: 700 }}>Einstellungen speichern</button>
              </div>
            </div>
          )}

          {section === 'rollen' && (() => {
            const roleDescriptions: Record<AppRole, string> = {
              Admin: 'Vollzugriff auf alle Funktionen und Einstellungen',
              Mitarbeiter: 'Zugriff auf Kernfunktionen, kein Löschen',
              Büro: 'Büro, Analyse, Archiv und Einstellungen',
              Werkstatt: 'Werkstatt, Lager, Planung und KI-Erkennung',
              Lager: 'Nur Lagerverwaltung und KI-Erkennung',
            }
            const allRoles = Object.keys(ROLE_LABELS) as AppRole[]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Aktuelle Rolle */}
                <div className="pk-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🔑 Rollen & Rechte</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      padding: '10px 22px', borderRadius: 999, fontSize: 18, fontWeight: 900,
                      background: 'rgba(22,132,255,.18)', border: '2px solid rgba(22,132,255,.4)',
                      color: '#6cb6ff', letterSpacing: '-.02em',
                    }}>
                      {ROLE_LABELS[currentRole]}
                    </div>
                    <div style={{ fontSize: 13, color: '#aeb9c8' }}>Ihre aktuelle Rolle im System</div>
                  </div>

                  {/* Rollen-Tabelle */}
                  <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <table className="pk-table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Rolle</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Beschreibung</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Piloten</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Löschen</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Bearbeiten</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRoles.map(r => (
                          <tr key={r} style={{ background: r === currentRole ? 'rgba(22,132,255,.06)' : undefined }}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {ROLE_LABELS[r]}
                              {r === currentRole && (
                                <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(22,132,255,.25)', color: '#6cb6ff', fontWeight: 700 }}>Aktiv</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#aeb9c8' }}>{roleDescriptions[r]}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {ROLE_PILOTS[r].slice(0, 4).map(p => (
                                  <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.07)', color: '#aeb9c8', fontWeight: 600 }}>{p}</span>
                                ))}
                                {ROLE_PILOTS[r].length > 4 && (
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.07)', color: '#aeb9c8', fontWeight: 600 }}>+{ROLE_PILOTS[r].length - 4}</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canDelete(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canEdit(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canExport(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rolle wechseln */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Rolle wechseln (Demo)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <select
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value as AppRole)}
                        className="pk-input"
                        style={{ width: 'auto', minWidth: 180 }}
                      >
                        {allRoles.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <button
                        className="pk-btn"
                        style={{ fontWeight: 700 }}
                        onClick={() => {
                          applyRole(selectedRole)
                          saveRole(selectedRole)
                          showToast(`✅ Rolle gesetzt: ${ROLE_LABELS[selectedRole]}`)
                        }}
                      >
                        Speichern
                      </button>
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: '#4a5568', lineHeight: 1.6 }}>
                      Im Produktivbetrieb werden Rollen vom Admin über die Benutzerverwaltung vergeben.
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          {section === 'import' && (
            <ImportWizard isDemo={isDemo} showToast={showToast} />
          )}

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
                    { label: 'Auth', value: 'Supabase Authentication' },
                    { label: 'Modus', value: isDemo ? 'Demo – Beispieldaten' : 'Produktiv' },
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
                <div style={{
                  padding: '18px 20px', borderRadius: 16,
                  background: 'rgba(255,165,0,.08)', border: '1px solid rgba(255,165,0,.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Demo-Modus aktiv</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
                        Sie sind mit dem Demo-Zugang eingeloggt. Alle Daten sind Beispieldaten.
                        Für den produktiven Einsatz besuchen Sie{' '}
                        <a href="https://petersen-ki-pilot.de" target="_blank" rel="noopener noreferrer" style={{ color: '#6cb6ff', textDecoration: 'underline' }}>
                          petersen-ki-pilot.de
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Import Wizard Component ────────────────────────────────────────────────────

type ImportProtokoll = {
  id: string; quelle: string; datentyp: string; dateiname: string; status: string
  anzahl_gesamt: number; anzahl_erfolgreich: number; anzahl_fehlerhaft: number
  erstellt_am: string
}

const IMPORT_SOURCES: ImportSource[] = ['WISO', 'Lexware', 'sevDesk', 'JTL', 'Billbee', 'DATEV CSV', 'Generisch']

const DATA_TYPE_LABELS: Record<ImportDataType, string> = {
  artikel: '📦 Artikel / Lagerbestand → lager_artikel',
  kunden: '👥 Kunden → buero_kunden',
  lieferanten: '🏭 Lieferanten → einkauf_lieferanten',
  rechnungen: '🧾 Rechnungen → buero_rechnungen',
  angebote: '📄 Angebote → buero_angebote',
  auftraege: '📋 Aufträge → buero_auftraege',
  bewegungen: '🔄 Lagerbewegungen → lager_bewegungen',
  belege: '📎 Belege → steuer_belege',
  projekte: '📅 Projekte → planung_projekte',
  steuer_belege: '🧾 Steuerbelege / Eingangsrechnungen → steuer_belege',
  steuer_buchungen: '📒 Buchungen → steuer_buchungen',
  steuer_ustva: '📊 UStVA-Daten → steuer_ustva',
  steuer_konten: '🗂️ Steuerkonten / Kontenrahmen → steuer_konten',
}

function genId(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}` }

function ImportWizard({ isDemo, showToast }: { isDemo: boolean; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState<ImportSource>('Generisch')
  const [dataType, setDataType] = useState<ImportDataType>('artikel')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [protokolle, setProtokolle] = useState<ImportProtokoll[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isDemo) return
    getImportProtokolle().then(d => setProtokolle(d as ImportProtokoll[])).catch(() => {})
  }, [isDemo])

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
      showToast('Nur CSV-Dateien werden unterstützt (XLSX: in Kürze)', 'error'); return
    }
    if (f.name.endsWith('.xlsx')) {
      showToast('Excel-Dateien: Bitte als CSV exportieren (Datei → Speichern unter → CSV)', 'error'); return
    }
    setFile(f); setParsing(true)
    const result = await parseCsvFile(f)
    setParseResult(result)
    setMapping(autoMapColumns(result.headers, source, dataType))
    setParsing(false)
    if (result.error) { showToast(result.error, 'error'); return }
    setStep(3)
  }, [source, dataType, showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDemoSimulate = useCallback(async () => {
    const csvMap: Partial<Record<ImportDataType, string>> = {
      artikel: DEMO_CSV_ARTIKEL, kunden: DEMO_CSV_KUNDEN,
      steuer_belege: DEMO_CSV_STEUER, steuer_buchungen: DEMO_CSV_BUCHUNGEN,
    }
    const csv = csvMap[dataType] ?? DEMO_CSV_ARTIKEL
    const blob = new Blob([csv], { type: 'text/csv' })
    const f = new File([blob], `demo_${dataType}.csv`, { type: 'text/csv' })
    await handleFile(f)
  }, [dataType, handleFile])

  const handleValidate = () => {
    if (!parseResult) return
    const result = validateImportRows(parseResult.rows, dataType, mapping)
    setValidationResult(result)
    setStep(4)
  }

  const handleImport = async () => {
    if (!validationResult || !parseResult) return
    setImporting(true)
    const builtRows = buildImportRows(validationResult.valid, mapping)

    if (isDemo) {
      await new Promise(r => setTimeout(r, 800))
      showToast(`✅ Demo-Import simuliert: ${builtRows.length} Datensätze (Demo)`)
      setImporting(false); setStep(5); return
    }

    try {
      const importedCount = await runBulkImport(dataType, builtRows)
      const proto: ImportProtokoll = {
        id: genId('IMP'),
        quelle: source,
        datentyp: dataType,
        dateiname: file?.name ?? '',
        status: validationResult.summary.invalid > 0 ? 'teilweise' : 'erfolgreich',
        anzahl_gesamt: validationResult.summary.total,
        anzahl_erfolgreich: importedCount,
        anzahl_fehlerhaft: validationResult.summary.invalid,
        erstellt_am: new Date().toISOString(),
      }
      await insertImportProtokoll({ ...proto, fehler: validationResult.warnings as object })
      setProtokolle(prev => [proto, ...prev])
      showToast(`✅ ${importedCount} Datensätze erfolgreich importiert`)
      setStep(5)
    } catch (err) {
      showToast('Fehler beim Import: ' + String(err), 'error')
    } finally { setImporting(false) }
  }

  const reset = () => {
    setStep(1); setFile(null); setParseResult(null); setMapping({}); setValidationResult(null)
  }

  const STEP_LABELS = ['System', 'Datentyp', 'Upload', 'Mapping', 'Vorschau']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="pk-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>📥 Datenimport & Migration</h3>
            <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
              Importiere Daten aus WISO, Lexware, DATEV, sevDesk, JTL und anderen Systemen als CSV.
              {isDemo && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontSize: 11, fontWeight: 700 }}>DEMO</span>}
            </p>
          </div>
          {step > 1 && <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12 }}>↺ Neu starten</button>}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={n} style={{
                flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                background: active ? 'rgba(22,132,255,.18)' : done ? 'rgba(37,211,102,.08)' : 'transparent',
                color: active ? '#6cb6ff' : done ? '#4ddb7e' : '#4a5568',
                borderRight: n < 5 ? '1px solid rgba(255,255,255,.06)' : 'none',
                transition: 'all .2s',
              }}>
                <div style={{ fontSize: 16 }}>{done ? '✓' : n}</div>
                <div style={{ marginTop: 2 }}>{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: System */}
      {step === 1 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 1: Quellsystem wählen</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {IMPORT_SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)} style={{
                padding: '14px 10px', borderRadius: 10, border: `2px solid ${source === s ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                background: source === s ? 'rgba(22,132,255,.12)' : 'rgba(255,255,255,.03)',
                color: source === s ? '#6cb6ff' : '#aeb9c8', fontWeight: source === s ? 700 : 500,
                cursor: 'pointer', fontSize: 13, transition: 'all .15s',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.15)', fontSize: 13, color: '#aeb9c8', marginBottom: 20 }}>
            💡 Exportiere deine Daten aus <strong style={{ color: '#6cb6ff' }}>{source}</strong> als CSV-Datei und lade sie hier hoch. Spalten werden automatisch erkannt und vorgeschlagen.
          </div>
          <button className="pk-btn" onClick={() => setStep(2)}>Weiter →</button>
        </div>
      )}

      {/* Step 2: Datentyp */}
      {step === 2 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 2: Was möchtest du importieren?</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {(Object.keys(DATA_TYPE_LABELS) as ImportDataType[]).map(dt => (
              <button key={dt} onClick={() => setDataType(dt)} style={{
                padding: '12px 16px', borderRadius: 10, border: `2px solid ${dataType === dt ? '#1684ff' : 'rgba(255,255,255,.07)'}`,
                background: dataType === dt ? 'rgba(22,132,255,.1)' : 'rgba(255,255,255,.02)',
                color: dataType === dt ? '#6cb6ff' : '#aeb9c8', fontWeight: dataType === dt ? 700 : 500,
                cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all .15s',
              }}>{DATA_TYPE_LABELS[dt]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(1)}>← Zurück</button>
            <button className="pk-btn" onClick={() => setStep(3)}>Weiter →</button>
          </div>
        </div>
      )}

      {/* Step 3: Upload */}
      {step === 3 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 3: CSV-Datei hochladen</h4>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#aeb9c8' }}>
            Ziel: <strong style={{ color: '#6cb6ff' }}>{DATA_TYPE_LABELS[dataType]}</strong>
          </p>

          {/* Drag & Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#1684ff' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(22,132,255,.08)' : 'rgba(255,255,255,.02)',
              transition: 'all .2s', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {file ? file.name : 'CSV-Datei hier ablegen oder klicken'}
            </div>
            <div style={{ fontSize: 12, color: '#4a5568' }}>Unterstützt: .csv (XLSX: bitte als CSV exportieren)</div>
            {file && <div style={{ marginTop: 8, fontSize: 12, color: '#4ddb7e' }}>✓ {(file.size / 1024).toFixed(1)} KB geladen</div>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {isDemo && (
            <div style={{ marginBottom: 16 }}>
              <button className="pk-btn-ghost" onClick={handleDemoSimulate} style={{ fontSize: 13 }}>
                🎭 Demo-CSV simulieren
              </button>
              <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 10 }}>Lädt Beispieldaten für {dataType}</span>
            </div>
          )}

          {parsing && <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 12 }}>⏳ Datei wird geparst…</div>}

          {parseResult && !parseResult.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.2)', fontSize: 13, marginBottom: 16 }}>
              ✅ <strong>{parseResult.totalRows}</strong> Zeilen erkannt · <strong>{parseResult.headers.length}</strong> Spalten · Trennzeichen: <code>"{parseResult.delimiter}"</code>
            </div>
          )}
          {parseResult?.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', fontSize: 13, color: '#ff8080', marginBottom: 16 }}>
              ❌ {parseResult.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(2)}>← Zurück</button>
            {parseResult && !parseResult.error && (
              <button className="pk-btn" onClick={() => setStep(3.5 as never)}>Spalten mappen →</button>
            )}
          </div>
        </div>
      )}

      {/* Step 3.5: Column Mapping (shown between step 3 and 4) */}
      {(step as number) === 3.5 && parseResult && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 4: Spalten zuordnen</h4>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#aeb9c8' }}>
            Ordne die Spalten deiner Datei den Zielfeldern zu. Felder auf <strong>– ignorieren –</strong> werden übersprungen.
          </p>

          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Spalte in deiner Datei</th>
                  <th>Beispielwert</th>
                  <th>Zielfeld in Petersen KI</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.headers.map(header => {
                  const example = parseResult.rows[0]?.[header] ?? ''
                  return (
                    <tr key={header}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{header}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{example}</td>
                      <td>
                        <select
                          className="pk-input"
                          value={mapping[header] ?? '__skip__'}
                          onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          style={{ fontSize: 12, padding: '4px 8px' }}
                        >
                          <option value="__skip__">– ignorieren –</option>
                          {TARGET_FIELDS[dataType].map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.12)', fontSize: 12, color: '#aeb9c8', marginBottom: 16 }}>
            * Pflichtfelder müssen zugeordnet sein für einen erfolgreichen Import.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3)}>← Zurück</button>
            <button className="pk-btn" onClick={handleValidate}>Prüfen & Vorschau →</button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Validation */}
      {step === 4 && validationResult && parseResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <div className="pk-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Schritt 5: Vorschau & Prüfung</h4>
            <div className="stats-grid">
              {[
                { label: 'Gesamt', val: validationResult.summary.total, color: '#f8fbff' },
                { label: 'Gültig', val: validationResult.summary.valid, color: '#4ddb7e' },
                { label: 'Fehlerhaft', val: validationResult.summary.invalid, color: '#ff8080' },
                { label: 'Warnungen', val: validationResult.summary.warnings, color: '#f59e0b' },
                { label: 'Duplikate', val: validationResult.summary.duplicates, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="pk-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>⚠️ Prüf-Meldungen ({validationResult.warnings.length})</div>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validationResult.warnings.slice(0, 30).map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 7, fontSize: 12,
                    background: w.type === 'error' ? 'rgba(255,80,80,.07)' : w.type === 'warn' ? 'rgba(245,158,11,.07)' : 'rgba(22,132,255,.07)',
                    borderLeft: `2px solid ${w.type === 'error' ? '#ff5050' : w.type === 'warn' ? '#f59e0b' : '#1684ff'}`,
                  }}>
                    <span style={{ fontFamily: 'monospace', color: '#4a5568', flexShrink: 0 }}>Z.{w.row}</span>
                    <span style={{ color: '#aeb9c8' }}><strong>{w.field}:</strong> {w.message}</span>
                  </div>
                ))}
                {validationResult.warnings.length > 30 && <div style={{ fontSize: 12, color: '#4a5568' }}>… und {validationResult.warnings.length - 30} weitere</div>}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Vorschau (erste 10 Zeilen, gültige Felder)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                      <th key={field}>{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildImportRows(parseResult.rows.slice(0, 10), mapping).map((row, i) => (
                    <tr key={i}>
                      {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                        <td key={field} style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[field] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {validationResult.summary.valid === 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', color: '#ff8080', fontSize: 13, fontWeight: 600 }}>
              ❌ Keine gültigen Datensätze. Bitte Mapping überprüfen.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3.5 as never)}>← Mapping ändern</button>
            <button className="pk-btn-ghost" onClick={reset} style={{ color: '#ff8080', borderColor: 'rgba(255,80,80,.3)' }}>✕ Abbrechen</button>
            {validationResult.summary.valid > 0 && (
              <button className="pk-btn" onClick={handleImport} disabled={importing} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {importing ? '⏳ Importiere…' : `✅ ${validationResult.summary.valid} Datensätze importieren`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === 5 && (
        <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Import abgeschlossen!</div>
          <div style={{ color: '#aeb9c8', fontSize: 14, marginBottom: 20 }}>
            Die Daten wurden erfolgreich importiert und stehen jetzt im jeweiligen Piloten zur Verfügung.
            {isDemo && ' (Demo-Modus – keine echten Daten gespeichert)'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="pk-btn" onClick={reset}>Weiteren Import starten</button>
          </div>
        </div>
      )}

      {/* Import Protokolle */}
      <div className="pk-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Import-Protokolle</div>
        {protokolle.length === 0 && !isDemo ? (
          <div style={{ color: '#4a5568', fontSize: 13 }}>Noch keine Importe durchgeführt.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr><th>Datum</th><th>Quelle</th><th>Datentyp</th><th>Datei</th><th>Gesamt</th><th>OK</th><th>Fehler</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(isDemo ? DEMO_PROTOKOLLE : protokolle).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12 }}>{new Date(p.erstellt_am).toLocaleDateString('de-DE')}</td>
                    <td style={{ fontWeight: 600 }}>{p.quelle}</td>
                    <td style={{ fontSize: 12 }}>{p.datentyp}</td>
                    <td style={{ fontSize: 11, color: '#aeb9c8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.dateiname}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.anzahl_gesamt}</td>
                    <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{p.anzahl_erfolgreich}</td>
                    <td style={{ fontFamily: 'monospace', color: p.anzahl_fehlerhaft > 0 ? '#ff8080' : '#4a5568' }}>{p.anzahl_fehlerhaft}</td>
                    <td>
                      <span className={`badge ${p.status === 'erfolgreich' ? 'badge-green' : p.status === 'teilweise' ? 'badge-orange' : 'badge-red'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const DEMO_PROTOKOLLE: ImportProtokoll[] = [
  { id: 'IMP-001', quelle: 'WISO', datentyp: 'artikel', dateiname: 'wiso_artikel_export.csv', status: 'erfolgreich', anzahl_gesamt: 48, anzahl_erfolgreich: 48, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-10T09:15:00Z' },
  { id: 'IMP-002', quelle: 'Lexware', datentyp: 'kunden', dateiname: 'kundenstamm_2025.csv', status: 'teilweise', anzahl_gesamt: 120, anzahl_erfolgreich: 118, anzahl_fehlerhaft: 2, erstellt_am: '2025-04-08T14:30:00Z' },
  { id: 'IMP-003', quelle: 'DATEV CSV', datentyp: 'steuer_belege', dateiname: 'datev_belege_q1.csv', status: 'erfolgreich', anzahl_gesamt: 34, anzahl_erfolgreich: 34, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-01T11:00:00Z' },
]

async function runBulkImport(dataType: ImportDataType, rows: Record<string, string>[]): Promise<number> {
  const genId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  if (dataType === 'artikel') {
    const prepared = rows.map(r => ({
      id: genId('ART'), name: r.name ?? '', artikelnummer: r.artikelnummer,
      beschreibung: r.beschreibung, einheit: r.einheit, lagerort: r.lagerort,
      bestand: normalizeNumber(r.bestand ?? '') ?? 0,
      mindestbestand: normalizeNumber(r.mindestbestand ?? '') ?? 0,
      einkaufspreis: normalizeNumber(r.einkaufspreis ?? '') ?? 0,
      verkaufspreis: normalizeNumber(r.verkaufspreis ?? '') ?? 0,
    }))
    await bulkImportLagerArtikel(prepared)
    return prepared.length
  }
  if (dataType === 'kunden') {
    const prepared = rows.map(r => ({ id: genId('KD'), name: r.name ?? '', email: r.email, telefon: r.telefon, adresse: r.adresse, kundennummer: r.kundennummer, notizen: r.notizen }))
    await bulkImportBueroKunden(prepared); return prepared.length
  }
  if (dataType === 'lieferanten') {
    const prepared = rows.map(r => ({ id: genId('LFR'), name: r.name ?? '', email: r.email, telefon: r.telefon, ort: r.ort, kategorie: r.kategorie, zahlungsziel: r.zahlungsziel, notiz: r.notiz }))
    await bulkImportEinkaufLieferanten(prepared); return prepared.length
  }
  if (dataType === 'rechnungen') {
    const prepared = rows.map(r => ({ id: genId('RE'), nummer: r.nummer ?? genId('RE'), kunde: r.kunde, datum: normalizeDate(r.datum ?? '') ?? undefined, faellig_am: normalizeDate(r.faellig_am ?? '') ?? undefined, summe: normalizeNumber(r.summe ?? '') ?? 0, status: r.status ?? 'Offen', notiz: r.notiz }))
    await bulkImportBueroRechnungen(prepared); return prepared.length
  }
  if (dataType === 'steuer_belege' || dataType === 'belege') {
    const prepared = rows.map(r => ({
      id: genId('BLG'), lieferant: r.lieferant ?? '', datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      betrag: normalizeNumber(r.betrag ?? '') ?? 0, steuerbetrag: normalizeNumber(r.steuerbetrag ?? '') ?? 0,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? 19, belegnummer: r.belegnummer,
      kategorie: r.kategorie, status: r.status ?? 'offen', notiz: r.notiz,
    }))
    await bulkImportSteuerBelege(prepared); return prepared.length
  }
  if (dataType === 'steuer_buchungen') {
    const prepared = rows.map(r => ({
      id: genId('BCH'), datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      buchungstext: r.buchungstext ?? '', betrag: normalizeNumber(r.betrag ?? '') ?? 0,
      soll_konto: r.soll_konto, haben_konto: r.haben_konto, steuerkonto: r.steuerkonto,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, beleg_id: r.beleg_id, status: r.status ?? 'offen',
    }))
    await bulkImportSteuerBuchungen(prepared); return prepared.length
  }
  if (dataType === 'steuer_konten') {
    const prepared = rows.map(r => ({ id: genId('KTO'), kontonummer: r.kontonummer ?? '', name: r.name ?? '', typ: r.typ, steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, aktiv: r.aktiv !== 'false' }))
    await bulkImportSteuerKonten(prepared); return prepared.length
  }
  // Unsupported types: return 0 with TODO note
  // TODO: implement auftraege, angebote, bewegungen, projekte, steuer_ustva bulk imports
  return 0
}
