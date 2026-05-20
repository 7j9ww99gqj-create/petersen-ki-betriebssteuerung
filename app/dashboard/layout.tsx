'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/GlobalSearch'
import SupportButton from '@/components/SupportButton'
import AppToast from '@/components/AppToast'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { hasDemoCookie } from '@/lib/auth'
import { getAccessProfile } from '@/lib/access'
import { ROLE_LABELS, loadRole, type AppRole } from '@/lib/roles'
import { getFirmaEinstellungen, upsertFirmaEinstellungen, uploadFirmenLogo, type FirmaEinstellungen } from '@/lib/db'
import { isPondruffUser } from '@/lib/pondruff'
import PondruffSheet from '@/components/pondruff/PondruffSheet'
import ErrorBoundary from '@/components/ErrorBoundary'
import OnboardingWizard from '@/components/OnboardingWizard'
import DemoBanner from '@/components/DemoBanner'
import { WhatsNewModal } from '@/components/ui'
import { useDesignV2 } from '@/lib/design-flag'
import { useCloudDesignSync } from '@/lib/design-sync'
import { PilotIcon, type PilotIconName } from '@/components/brand/PilotIcon'

// Icon-Map für Bottom-Nav im Design-V2 (Lucide).
const BN_V2_ICONS: Record<string, PilotIconName | undefined> = {
  '/dashboard': 'start',
  '/dashboard/lager': 'lager',
  '/dashboard/buero': 'buero',
  '/dashboard/werkstatt': 'werkstatt',
  '/dashboard/steuer': 'steuer',
  '/dashboard/ki-erkennung': 'ki',
  '#menu': 'menue',
}

// Bottom-Nav Einträge (Mobile)
const bottomNavItems = [
  { href: '/dashboard',             icon: '⊞',  label: 'Start' },
  { href: '/dashboard/lager',       icon: '📦', label: 'Lager' },
  { href: '/dashboard/buero',       icon: '🧾', label: 'Büro' },
  { href: '/dashboard/werkstatt',   icon: '🛠️', label: 'Werkstatt' },
  { href: '/dashboard/steuer',      icon: '🧾', label: 'Steuer' },
  { href: '/dashboard/ki-erkennung',icon: '🧠', label: 'KI-Assist' },
  { href: '#menu',                  icon: '☰',  label: 'Menü' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const v2 = useDesignV2()
  // DP12 — Multi-Device Sync für Design-Prefs (Opt-in, no-op wenn Cloud-Sync aus)
  useCloudDesignSync()
  const [checked, setChecked] = useState(false)
  const [userName, setUserName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [role, setRoleState] = useState<AppRole>('Admin')
  const [allowedPilotIds, setAllowedPilotIds] = useState<string[]>(['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer'])
  const [isPondruff, setIsPondruff] = useState(false)
  const [pondruffSheet, setPondruffSheet] = useState(false)
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
      template: 'modern-dark',
      logoPosition: 'links',
      akzentfarbe: '#20c8ff',
      showBankdaten: true,
      showSteuernummer: true,
      showUstId: true,
      showGeschaeftsfuehrer: true,
      showWebsite: true,
      useForAngebote: true,
      useForAuftragsbestaetigungen: true,
      useForRechnungen: true,
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
    if (hasDemoCookie()) { setUserName('Demo'); setAllowedPilotIds(['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer', 'qm']); setChecked(true); return }
    if (!isSupabaseConfigured()) { router.push('/login'); return }

    let subscription: { unsubscribe: () => void } | null = null
    try {
      const supabase = createSupabaseClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { router.push('/login'); return }
        setUserName((session.user.email ?? '').split('@')[0])
        setAllowedPilotIds(getAccessProfile(session.user).allowedPilotIds)
        setIsPondruff(isPondruffUser(session.user.email))
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
    // Pondruff-Account ersetzt Werkstatt durch eigenes Sheet-Item — Steuer + KI bleiben sichtbar
    if (item.href === '/dashboard/werkstatt') return !isPondruff && allowedPilotIds.includes('werkstatt')
    if (item.href === '/dashboard/steuer') return allowedPilotIds.includes('steuer')
    if (item.href === '/dashboard/ki-erkennung') return allowedPilotIds.length > 0
    return true
  })

  return (
    <div style={{ display: 'flex' }}>
      <WhatsNewModal />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setSidebarOpen(false) }}
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
            <button
              onClick={() => router.push('/dashboard/einstellungen')}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.1)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'all .15s',
                touchAction: 'manipulation',
              }}
              title="Einstellungen"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(22,132,255,.15)'
                e.currentTarget.style.border = '1px solid rgba(22,132,255,.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,.05)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,.1)'
              }}
            >
              ⚙️
            </button>
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
          </div>
        </div>

        <DemoBanner />

        <main className="main-inner">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {showCompanyOnboarding && (
        <OnboardingWizard
          form={companyForm}
          onFieldChange={setCompanyField}
          onLogoChange={setCompanyLogo}
          onSave={saveCompanyOnboarding}
          onSkip={() => setShowCompanyOnboarding(false)}
          saving={companySaving}
          error={companyError}
        />
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
              <span className="bn-icon">
                {v2 && BN_V2_ICONS[item.href]
                  ? <PilotIcon name={BN_V2_ICONS[item.href] as PilotIconName} size={22} />
                  : item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
        {isPondruff && (
          <button
            className={`bottom-nav-item${pathname.startsWith('/dashboard/pondruff') ? ' active' : ''}`}
            onClick={() => setPondruffSheet(true)}
            aria-label="Pondruff Menü"
            style={{ color: pathname.startsWith('/dashboard/pondruff') ? '#ff6b6b' : undefined }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pondruff/icon.png" alt="Pondruff" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
            <span>Pondruff</span>
          </button>
        )}
      </nav>

      {isPondruff && <PondruffSheet open={pondruffSheet} onClose={() => setPondruffSheet(false)} />}

      <SupportButton />
      <AppToast />
    </div>
  )
}
