'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import SupportButton from '@/components/SupportButton'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie } from '@/lib/auth'
import { getAccessProfile } from '@/lib/access'
import { ROLE_LABELS, loadRole, type AppRole } from '@/lib/roles'
import { getFirmaEinstellungen, upsertFirmaEinstellungen, uploadFirmenLogo, type FirmaEinstellungen } from '@/lib/db'

// Bottom-Nav Einträge (Mobile)
const bottomNavItems = [
  { href: '/dashboard',             icon: '⊞',  label: 'Start' },
  { href: '/dashboard/lager',       icon: '📦', label: 'Lager' },
  { href: '/dashboard/buero',       icon: '🧾', label: 'Büro' },
  { href: '/dashboard/werkstatt',   icon: '🛠️', label: 'Werkstatt' },
  { href: '/dashboard/ki-erkennung',icon: '🧠', label: 'KI-Assist' },
  { href: '#menu',                  icon: '☰',  label: 'Menü' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRoleState] = useState<AppRole>('Admin')
  const [allowedPilotIds, setAllowedPilotIds] = useState<string[]>(['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer'])
  const [companyChecked, setCompanyChecked] = useState(false)
  const [showCompanyOnboarding, setShowCompanyOnboarding] = useState(false)
  const [companySaving, setCompanySaving] = useState(false)
  const [companyError, setCompanyError] = useState('')
  const [companyLogo, setCompanyLogo] = useState<File | null>(null)
  const [companyForm, setCompanyForm] = useState<FirmaEinstellungen>({
    firmenname: '',
    adresse: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    email: '',
    telefon: '',
    website: '',
    ansprechpartner: '',
    slogan: '',
    branche: '',
    ust_id: '',
    steuernummer: '',
    handelsregister: '',
    geschaeftsfuehrer: '',
    bankname: '',
    iban: '',
    bic: '',
    zahlungsziel_tage: 14,
    standard_mwst: 19,
    standard_waehrung: 'EUR',
    dokument_footer: '',
    briefpapier_layout: {
      logoPosition: 'links',
      akzentfarbe: '#20c8ff',
      showBankdaten: true,
      showSteuernummer: true,
      showUstId: true,
      showGeschaeftsfuehrer: true,
      showWebsite: true,
    },
    onboarding_completed: false,
  })

  // Close sidebar on route change (mobile nav)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    loadRole().then(setRoleState).catch(() => setRoleState('Admin'))
  }, [pathname])

  // Auth check
  useEffect(() => {
    if (hasDemoCookie()) { setUserName('Demo'); setAllowedPilotIds(['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer']); setChecked(true); return }
    if (!isSupabaseConfigured()) { router.push('/login'); return }

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const supabase = createSupabaseClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { router.push('/login'); return }
        setUserName((session.user.email ?? '').split('@')[0])
        setAllowedPilotIds(getAccessProfile(session.user).allowedPilotIds)
        setChecked(true)
      }).catch(() => router.push('/login'))

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) router.push('/login')
      })
      subscription = data.subscription
    } catch { router.push('/login') }

    return () => subscription?.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!checked || companyChecked) return
    if (hasDemoCookie() || role !== 'Admin') { setCompanyChecked(true); return }

    getFirmaEinstellungen()
      .then(data => {
        if (data) {
          localStorage.setItem('pk_firma_einstellungen', JSON.stringify(data))
          setCompanyForm(prev => ({ ...prev, ...data, briefpapier_layout: { ...prev.briefpapier_layout, ...(data.briefpapier_layout || {}) } }))
          if (!data.onboarding_completed || !data.firmenname) setShowCompanyOnboarding(true)
        } else {
          setShowCompanyOnboarding(true)
        }
      })
      .catch(() => {
        // Wenn die Live-Tabelle noch nicht migriert ist, darf das Dashboard nicht blockieren.
        setCompanyError('Firmendaten konnten noch nicht geladen werden. Bitte Supabase-Schema prüfen.')
      })
      .finally(() => setCompanyChecked(true))
  }, [checked, companyChecked, role])

  const setCompanyField = <K extends keyof FirmaEinstellungen>(key: K, value: FirmaEinstellungen[K]) => {
    setCompanyForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveCompanyOnboarding() {
    if (!companyForm.firmenname.trim()) {
      setCompanyError('Bitte mindestens den Firmennamen eintragen.')
      return
    }
    setCompanySaving(true)
    setCompanyError('')
    try {
      let logoUrl = companyForm.logo_url
      if (companyLogo) {
        const uploaded = await uploadFirmenLogo(companyLogo)
        logoUrl = uploaded.url
      }
      const saved = await upsertFirmaEinstellungen({
        ...companyForm,
        logo_url: logoUrl,
        onboarding_completed: true,
      })
      localStorage.setItem('pk_firma_einstellungen', JSON.stringify(saved))
      setCompanyForm(saved)
      setShowCompanyOnboarding(false)
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : 'Firmendaten konnten nicht gespeichert werden.')
    } finally {
      setCompanySaving(false)
    }
  }

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

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const filteredBottomNavItems = bottomNavItems.filter(item => {
    if (item.href === '#menu' || item.href === '/dashboard') return true
    if (item.href === '/dashboard/lager') return allowedPilotIds.includes('lager')
    if (item.href === '/dashboard/buero') return allowedPilotIds.includes('buero')
    if (item.href === '/dashboard/werkstatt') return allowedPilotIds.includes('werkstatt')
    if (item.href === '/dashboard/ki-erkennung') return allowedPilotIds.length > 0
    return true
  })

  return (
    <div style={{ display: 'flex' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dashboard-main">
        {/* Top bar */}
        <div
          className="topbar"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'linear-gradient(180deg, rgba(5,7,11,.97), rgba(5,7,11,.92))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(255,255,255,.07)',
            paddingTop: 'calc(10px + env(safe-area-inset-top))',
            paddingRight: 16,
            paddingBottom: 10,
            paddingLeft: 16,
            display: 'flex', alignItems: 'center', gap: 10,
            overflow: 'visible',
          }}
        >
          {/* Hamburger – only visible on desktop (mobile uses bottom-nav "Menü") */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menü öffnen"
            style={{
              display: 'none',
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 5, flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 18, height: 2, background: '#aeb9c8', borderRadius: 2 }} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <GlobalSearch />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <NotificationBell />
            {/* Role badge – hide on very small screens via inline media */}
            <span
              className="role-badge-desktop"
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 999,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                color: '#aeb9c8', fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              {ROLE_LABELS[role]}
            </span>
            <button
              onClick={() => router.push('/dashboard/einstellungen')}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #1684ff22, #20c8ff22)',
                border: '1px solid rgba(22,132,255,.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 15, color: '#6cb6ff',
                transition: 'border-color .15s, background .15s',
                touchAction: 'manipulation',
              }}
              title="Einstellungen"
            >
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </button>
          </div>
        </div>

        <main className="main-inner">
          {children}
        </main>
      </div>

      {showCompanyOnboarding && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,.68)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <div className="pk-card" style={{ width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6cb6ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Firmendaten-Onboarding
                </div>
                <h2 style={{ margin: '4px 0 4px', fontSize: 22, fontWeight: 900 }}>Briefpapier einmal einrichten</h2>
                <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
                  Diese Daten erscheinen später im Dashboard, in Angeboten, Rechnungen und Exporten.
                </p>
              </div>
              <button className="pk-btn-ghost" onClick={() => setShowCompanyOnboarding(false)} disabled={companySaving}>
                Später
              </button>
            </div>

            {companyError && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.28)', color: '#ff8aa0', fontSize: 13 }}>
                {companyError}
              </div>
            )}

            <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Firmenname *</span>
                <input className="pk-input" value={companyForm.firmenname} onChange={e => setCompanyField('firmenname', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Logo</span>
                <input className="pk-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => setCompanyLogo(e.target.files?.[0] ?? null)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Adresse</span>
                <input className="pk-input" value={companyForm.adresse || ''} onChange={e => setCompanyField('adresse', e.target.value)} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>PLZ</span>
                  <input className="pk-input" value={companyForm.plz || ''} onChange={e => setCompanyField('plz', e.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>Ort</span>
                  <input className="pk-input" value={companyForm.ort || ''} onChange={e => setCompanyField('ort', e.target.value)} />
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>E-Mail</span>
                <input className="pk-input" type="email" value={companyForm.email || ''} onChange={e => setCompanyField('email', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Telefon</span>
                <input className="pk-input" value={companyForm.telefon || ''} onChange={e => setCompanyField('telefon', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Website</span>
                <input className="pk-input" value={companyForm.website || ''} onChange={e => setCompanyField('website', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Ansprechpartner</span>
                <input className="pk-input" value={companyForm.ansprechpartner || ''} onChange={e => setCompanyField('ansprechpartner', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>USt-IdNr.</span>
                <input className="pk-input" value={companyForm.ust_id || ''} onChange={e => setCompanyField('ust_id', e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>IBAN</span>
                <input className="pk-input" value={companyForm.iban || ''} onChange={e => setCompanyField('iban', e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="pk-btn-ghost" onClick={() => setShowCompanyOnboarding(false)} disabled={companySaving}>
                Überspringen
              </button>
              <button className="pk-btn" onClick={saveCompanyOnboarding} disabled={companySaving}>
                {companySaving ? 'Speichern…' : 'Firmendaten speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation (Mobile) ── */}
      <nav className="bottom-nav" role="navigation" aria-label="Hauptnavigation">
        {filteredBottomNavItems.map(item => {
          const active = item.href !== '#menu' && isActive(item.href)
          return (
            <button
              key={item.href}
              className={`bottom-nav-item${active ? ' active' : ''}`}
              onClick={() => {
                if (item.href === '#menu') {
                  setSidebarOpen(o => !o)
                } else {
                  router.push(item.href)
                }
              }}
              aria-label={item.label}
            >
              <span className="bn-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <SupportButton />
    </div>
  )
}
