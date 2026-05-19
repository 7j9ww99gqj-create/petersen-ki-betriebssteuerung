'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { getRecentVisits, type RecentItem } from '@/lib/recent'
import { getAccessProfile } from '@/lib/access'
import { createSupabaseClient } from '@/lib/supabase'
import { getLagerArtikel, getBueroRechnungen, getBueroAuftraege, getFirmaEinstellungen, getOwnerDashboardSnapshot, type FirmaEinstellungen, type OwnerDashboardSnapshot } from '@/lib/db'
import { loadRole, type AppRole } from '@/lib/roles'
import { OwnerAiControlPanel } from '@/components/billing/OwnerAiControlPanel'
import SkeletonCard from '@/components/SkeletonCard'
import type { PilotId } from '@/lib/pricingConfig'
import { isPondruffUser } from '@/lib/pondruff'

const pondruffTiles = [
  { href: '/dashboard/pondruff/wareneingang', icon: '📥', label: 'Wareneingang', desc: 'Lieferschein, Bauteile & Verpackung erfassen' },
  { href: '/dashboard/pondruff/preisrechner', icon: '💶', label: 'Preisrechner', desc: 'Positionen kalkulieren, WISO-Auftrag erzeugen' },
  { href: '/dashboard/pondruff/buero-wiso',   icon: '🧾', label: 'Büro / WISO', desc: 'Copy/Paste & CSV für WISO MeinBüro' },
]

const pilots = [
  { id: 'lager', label: 'LagerPilot', icon: '📦', desc: 'Wareneingang, Bestände, Lagerplätze, Inventur', href: '/dashboard/lager', color: '#1684ff', status: 'AKTIV' },
  { id: 'buero', label: 'BüroPilot', icon: '🧾', desc: 'Kunden, Aufträge, Rechnungen, Dokumente, Einkauf', href: '/dashboard/buero', color: '#20c8ff', status: 'AKTIV' },
  { id: 'werkstatt', label: 'WerkstattPilot', icon: '🛠️', desc: 'Arbeitskarten, Zeiterfassung, Qualität', href: '/dashboard/werkstatt', color: '#a78bfa', status: 'AKTIV' },
  { id: 'steuer', label: 'SteuerPilot', icon: '🧾', desc: 'Belege, UStVA, DATEV-Export, Buchungen', href: '/dashboard/steuer', color: '#4ddb7e', status: 'AKTIV' },
  { id: 'marketing', label: 'MarketingPilot', icon: '📣', desc: 'Kampagnen, E-Mail, Social Media, Leads', href: '/dashboard/marketing', color: '#f59e0b', status: 'AKTIV' },
  { id: 'analyse', label: 'AnalysePilot', icon: '📊', desc: 'Dashboards, KPIs, Prognosen, Berichte', href: '/dashboard/analyse', color: '#10b981', status: 'AKTIV' },
  { id: 'planung', label: 'PlanungPilot', icon: '📅', desc: 'Produktion, Ressourcen, Termine, Projekte', href: '/dashboard/planung', color: '#f43f5e', status: 'AKTIV' },
]

type KpiData = {
  lagerArtikel: number
  kritischeBestände: number
  offeneRechnungen: number
  rechnungenWert: string
  laufendeAuftraege: number
  ueberfaelligeRechnungen: number
}

type PendingRegistration = {
  id: string
  email: string
  fullName: string
  createdAt: string
  accessStatus?: string
}

const demoKpis: KpiData = {
  lagerArtikel: 8, kritischeBestände: 3, offeneRechnungen: 4,
  rechnungenWert: '14.300 €', laufendeAuftraege: 3, ueberfaelligeRechnungen: 2,
}

const demoFirma: FirmaEinstellungen = {
  firmenname: 'Petersen Musterbetrieb',
  slogan: 'Demo-Mandant für Petersen KI',
  land: 'Deutschland',
  standard_mwst: 19,
  standard_waehrung: 'EUR',
  onboarding_completed: true,
}

const demoOwnerSnapshot: OwnerDashboardSnapshot = {
  activeCustomers: 24,
  pendingApprovals: 3,
  pendingActivations: 4,
  failedPayments: 1,
  openInvoices: 6,
  overdueInvoices: 2,
  monthlyRecurringRevenue: 3890,
  revenueTotal: 28460,
  revenueLast30Days: 4120,
  unreadNotifications: 5,
  recentActivities: [
    { id: 'owner-demo-1', source: 'stripe', severity: 'success', title: 'Zahlung eingegangen', description: 'RE-2026-00014 wurde per Stripe bezahlt.', createdAt: new Date().toISOString(), linkUrl: '/dashboard/einstellungen' },
    { id: 'owner-demo-2', source: 'billing', severity: 'warn', title: 'Freischaltung offen', description: 'Neukunde wartet auf finale Owner-Pruefung.', createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(), linkUrl: '/dashboard/einstellungen' },
    { id: 'owner-demo-3', source: 'system', severity: 'info', title: 'Sync protokolliert', description: 'Stripe-Abgleich wurde erfolgreich vorbereitet.', createdAt: new Date(Date.now() - 1000 * 60 * 78).toISOString(), linkUrl: '/dashboard/einstellungen' },
  ],
}

function useCountUp(target: number, duration = 1400, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const from = Math.max(0, target - Math.round(target * 0.18))
    function step(timestamp: number) {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}

function StatCard({ icon, label, target, suffix, delta, color, delay }: {
  icon: string; label: string; target: number; suffix: string; delta: string; color: string; delay: number
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  const value = useCountUp(target, 1200, visible)
  return (
    <div
      ref={ref}
      className="pk-card"
      style={{
        display: 'flex', gap: 14, alignItems: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity .4s ease, transform .4s ease',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        transition: 'box-shadow .3s',
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 20px ${color}40`)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
          {value.toLocaleString('de-DE')}{suffix}
        </div>
        <div style={{ fontSize: 12, color: '#aeb9c8' }}>{label}</div>
        <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>{delta}</div>
      </div>
    </div>
  )
}

function PilotCard({ pilot, delay }: { pilot: typeof pilots[0]; delay: number }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <button
      onClick={() => router.push(pilot.href)}
      style={{
        all: 'unset', cursor: 'pointer', display: 'block',
        background: 'linear-gradient(180deg, rgba(16,26,40,.94), rgba(8,12,19,.94))',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 20, padding: '20px',
        transition: 'border-color .2s, transform .15s, box-shadow .2s, opacity .4s, translateY .4s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = pilot.color + '60'
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = `0 12px 40px ${pilot.color}22`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = 'rgba(255,255,255,.1)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `${pilot.color}15`, border: `1px solid ${pilot.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          transition: 'background .2s',
        }}>{pilot.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fbff' }}>{pilot.label}</span>
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 700,
              background: pilot.status === 'AKTIV' ? 'rgba(37,211,102,.15)' : 'rgba(255,165,0,.1)',
              color: pilot.status === 'AKTIV' ? '#4ddb7e' : '#ffb347',
              letterSpacing: '.04em',
            }}>{pilot.status}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#aeb9c8', lineHeight: 1.5 }}>{pilot.desc}</p>
          <div style={{ marginTop: 12, fontSize: 12, color: pilot.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            Öffnen <span style={{ transition: 'transform .2s' }}>→</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [kpi, setKpi] = useState<KpiData>({ lagerArtikel: 0, kritischeBestände: 0, offeneRechnungen: 0, rechnungenWert: '0 €', laufendeAuftraege: 0, ueberfaelligeRechnungen: 0 })
  const [kpiLoaded, setKpiLoaded] = useState(false)
  const [firma, setFirma] = useState<FirmaEinstellungen | null>(null)
  const [role, setRole] = useState<AppRole>('Admin')
  const [allowedPilotIds, setAllowedPilotIds] = useState<string[]>(pilots.map(pilot => pilot.id))
  const [isPondruff, setIsPondruff] = useState(false)
  const [ownerSnapshot, setOwnerSnapshot] = useState<OwnerDashboardSnapshot | null>(null)
  const [ownerPendingRegistrations, setOwnerPendingRegistrations] = useState(0)
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [savingRegistrationId, setSavingRegistrationId] = useState('')
  const [recentVisits, setRecentVisits] = useState<RecentItem[]>([])

  const loadOwnerSnapshot = () => {
    getOwnerDashboardSnapshot()
      .then(setOwnerSnapshot)
      .catch(() => setOwnerSnapshot(null))
  }

  useEffect(() => {
    setRecentVisits(getRecentVisits())
    const u = localStorage.getItem('pk_user')
    if (u) setUser(JSON.parse(u))
    setTimeout(() => setHeaderVisible(true), 80)

    const isDemo = hasDemoCookie()
    if (isDemo) {
      setFirma(demoFirma)
      localStorage.setItem('pk_firma_einstellungen', JSON.stringify(demoFirma))
      setOwnerSnapshot(demoOwnerSnapshot)
      setRole('Inhaber')
    } else {
      getFirmaEinstellungen()
        .then(data => {
          setFirma(data)
          if (data) localStorage.setItem('pk_firma_einstellungen', JSON.stringify(data))
        })
        .catch(() => setFirma(null))
      createSupabaseClient().auth.getUser()
        .then(({ data: { user } }) => {
          if (user) {
            setAllowedPilotIds(getAccessProfile(user).allowedPilotIds)
            setIsPondruff(isPondruffUser(user.email))
          }
        })
        .catch(() => {})
      loadRole()
        .then(r => {
          setRole(r)
          if (r === 'Inhaber') {
            loadOwnerSnapshot()
            fetch('/api/admin/users', { cache: 'no-store' })
              .then(async res => {
                if (!res.ok) return null
                return await res.json() as { users?: PendingRegistration[] }
              })
              .then(data => {
                if (data?.users) {
                  const pending = data.users.filter(item => item.accessStatus === 'pending') as PendingRegistration[]
                  setPendingRegistrations(pending)
                  setOwnerPendingRegistrations(pending.length)
                }
              })
              .catch(() => {})
          }
        })
        .catch(() => setRole('Admin'))
    }

    if (!isDemo) {
      Promise.allSettled([getLagerArtikel(), getBueroRechnungen(), getBueroAuftraege()])
        .then(([artikelRes, rechnungenRes, auftraegeRes]) => {
          const artikel = artikelRes.status === 'fulfilled' ? (artikelRes.value as { bestand: number; mindestbestand?: number; status: string }[]) : []
          const rechnungen = rechnungenRes.status === 'fulfilled' ? (rechnungenRes.value as { betrag: string; status: string }[]) : []
          const auftraege = auftraegeRes.status === 'fulfilled' ? (auftraegeRes.value as { status: string }[]) : []

          const parseBetrag = (s: string) => parseFloat(s.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
          const offeneRe = rechnungen.filter(r => r.status !== 'Bezahlt')
          const offeneWert = offeneRe.reduce((s, r) => s + parseBetrag(r.betrag), 0)
          const ueberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').length

          setKpi({
            lagerArtikel: artikel.length,
            kritischeBestände: artikel.filter(a => a.status === 'niedrig' || a.status === 'leer').length,
            offeneRechnungen: offeneRe.length,
            rechnungenWert: offeneWert.toLocaleString('de-DE', { minimumFractionDigits: 0 }) + ' €',
            laufendeAuftraege: auftraege.filter(a => a.status === 'In Bearbeitung').length,
            ueberfaelligeRechnungen: ueberfaellig,
          })
        })
        .finally(() => setKpiLoaded(true))
    } else {
      setKpi(demoKpis)
      setKpiLoaded(true)
    }
  }, [])

  const firmaInitialen = (firma?.firmenname || 'PK')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')

  const kpiCards = [
    { label: 'Artikel im Lager', value: String(kpi.lagerArtikel), icon: '📦', color: '#1684ff', href: '/dashboard/lager?tab=bestand&status=Alle', delta: `${kpi.kritischeBestände} kritisch`, pilotId: 'lager' },
    { label: 'Kritische Bestände', value: String(kpi.kritischeBestände), icon: '⚠️', color: kpi.kritischeBestände > 0 ? '#f59e0b' : '#10b981', href: '/dashboard/lager?tab=bestand&status=niedrig', delta: kpi.kritischeBestände > 0 ? 'Nachbestellung nötig' : 'Alles OK', pilotId: 'lager' },
    { label: 'Offene Rechnungen', value: String(kpi.offeneRechnungen), icon: '💶', color: kpi.ueberfaelligeRechnungen > 0 ? '#f43f5e' : '#f59e0b', href: '/dashboard/buero?tab=rechnungen&filter=Offen', delta: kpi.rechnungenWert, pilotId: 'buero' },
    { label: 'Überfällige Zahlungen', value: String(kpi.ueberfaelligeRechnungen), icon: '🚨', color: kpi.ueberfaelligeRechnungen > 0 ? '#f43f5e' : '#10b981', href: '/dashboard/buero?tab=rechnungen&filter=%C3%9Cberf%C3%A4llig', delta: kpi.ueberfaelligeRechnungen > 0 ? 'Mahnung prüfen' : 'Alles beglichen', pilotId: 'buero' },
    { label: 'Laufende Aufträge', value: String(kpi.laufendeAuftraege), icon: '✅', color: '#10b981', href: '/dashboard/buero?tab=auftraege', delta: 'In Bearbeitung', pilotId: 'buero' },
    { label: 'Cloud-Sync', value: '100%', icon: '☁️', color: '#20c8ff', href: '/dashboard/cloud', delta: 'Aktuell', pilotId: 'general' },
  ]
  const visiblePilots = pilots.filter(pilot => allowedPilotIds.includes(pilot.id))
  const visibleKpiCards = kpiCards.filter(card => card.pilotId === 'general' ? allowedPilotIds.length > 0 : allowedPilotIds.includes(card.pilotId))
  const visibleQuickActions = [
    { label: 'KI-Assistent', desc: 'Dokumente & Fotos automatisch erfassen', icon: '🧠', href: '/dashboard/ki-erkennung', color: '#a78bfa', requiresPilot: true },
    { label: 'Cloud & Sync', desc: 'Datensicherung & Cloud-Status', icon: '☁️', href: '/dashboard/cloud', color: '#20c8ff', requiresPilot: true },
    { label: 'Archiv', desc: 'Alle gespeicherten Dokumente & Vorgänge', icon: '🗂️', href: '/dashboard/archiv', color: '#f59e0b', requiresPilot: true },
    { label: 'Einstellungen', desc: 'Profil, Benachrichtigungen, App-Info', icon: '⚙️', href: '/dashboard/einstellungen', color: '#aeb9c8', requiresPilot: false },
  ].filter(item => !item.requiresPilot || allowedPilotIds.length > 0)

  const applyRegistrationPreset = async (user: PendingRegistration, preset: 'demo7' | 'demo14' | 'standard') => {
    const expiresAt = preset === 'standard'
      ? null
      : new Date(Date.now() + (preset === 'demo7' ? 7 : 14) * 24 * 60 * 60 * 1000).toISOString()
    const pilotIds: PilotId[] = preset === 'standard'
      ? ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer']
      : ['buero', 'lager', 'analyse']
    setSavingRegistrationId(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accessStatus: 'active',
          accessMode: preset === 'standard' ? 'standard' : 'demo',
          accessExpiresAt: expiresAt,
          allowedPilotIds: pilotIds,
        }),
      })
      if (!res.ok) throw new Error('Freigabe konnte nicht gespeichert werden.')
      setPendingRegistrations(current => current.filter(entry => entry.id !== user.id))
      setOwnerPendingRegistrations(current => Math.max(0, current - 1))
    } finally {
      setSavingRegistrationId('')
    }
  }

  const buildRegistrationMailHref = (user: PendingRegistration, preset: 'demo7' | 'demo14' | 'standard' | 'pending') => {
    const subject = preset === 'pending'
      ? 'Ihre Registrierung bei Petersen KI'
      : 'Ihr Zugang bei Petersen KI wurde freigeschaltet'
    const body = [
      `Guten Tag ${user.fullName || ''}`.trim() + ',',
      '',
      preset === 'pending'
        ? 'vielen Dank fuer Ihre Registrierung. Ihr Zugang wird aktuell geprueft.'
        : preset === 'standard'
          ? 'Ihr Standard-Zugang wurde freigeschaltet.'
          : `Ihr Demo-Zugang wurde fuer ${preset === 'demo7' ? '7' : '14'} Tage freigeschaltet.`,
      preset === 'pending' ? '' : `Login: ${user.email}`,
      preset === 'pending' ? '' : 'Portal: https://petersen-ki-pilot.de/login',
      '',
      'Viele Gruesse',
    ].filter(Boolean).join('\n')
    return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        opacity: headerVisible ? 1 : 0, transform: headerVisible ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity .4s ease, transform .4s ease',
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Willkommen zurück
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-.04em' }}>
            {user?.name ? `Hallo, ${user.name} 👋` : 'Dashboard'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 14 }}>
            Ihre Betriebssteuerung – alles im Blick.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div
            className="pk-card"
            style={{
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 220,
              maxWidth: 360,
            }}
          >
            {firma?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firma.logo_url} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)' }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #1684ff33, #20c8ff22)', border: '1px solid rgba(22,132,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6cb6ff', fontWeight: 900 }}>
                {firmaInitialen}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Petersen KI für</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {firma?.firmenname || 'Ihre Firma'}
              </div>
              {firma?.slogan && <div style={{ fontSize: 11, color: '#7f8da3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firma.slogan}</div>}
            </div>
          </div>
          {allowedPilotIds.length > 0 && (
            <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/ki-erkennung')} style={{ fontSize: 13 }}>
              🧠 KI-Assistent
            </button>
          )}
          {allowedPilotIds.length > 0 && (
            <button className="pk-btn" onClick={() => router.push('/dashboard/cloud')} style={{ fontSize: 13 }}>
              ☁️ Cloud Sync
            </button>
          )}
        </div>
      </div>

      {searchParams.get('access') === 'restricted' && (
        <div style={{
          marginBottom: 16,
          padding: '12px 14px',
          borderRadius: 14,
          background: 'rgba(245,158,11,.08)',
          border: '1px solid rgba(245,158,11,.22)',
          color: '#fcd34d',
          fontSize: 13,
        }}>
          Dieser Bereich ist für Ihren Account noch nicht freigeschaltet. Die Zuteilung erfolgt im Inhaber-Dashboard.
        </div>
      )}

      {isPondruff && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Pondruff Polier-Service</h2>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>Wareneingang · Preisrechner · Büro/WISO</div>
            </div>
          </div>
          <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {pondruffTiles.map(t => (
              <button key={t.href} onClick={() => router.push(t.href)}
                style={{
                  all: 'unset', cursor: 'pointer', padding: 18, borderRadius: 16,
                  background: 'linear-gradient(180deg, rgba(229,9,9,.08), rgba(8,12,19,.94))',
                  border: '1px solid rgba(229,9,9,.32)', transition: 'transform .15s, box-shadow .2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(229,9,9,.18)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: '#ff8080' }}>{t.label}</div>
                <div style={{ fontSize: 13, color: '#aeb9c8' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Echte KPI-Karten */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Live-KPIs</h2>
        {!kpiLoaded && <div style={{ width: 16, height: 16, border: '2px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
      </div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {!kpiLoaded && <SkeletonCard count={6} />}
        {kpiLoaded && visibleKpiCards.map((s, i) => (
          <button
            key={s.label}
            onClick={() => router.push(s.href)}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', gap: 14, alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(16,26,40,.94), rgba(8,12,19,.94))',
              border: `1px solid rgba(255,255,255,.1)`,
              borderRadius: 16, padding: '16px 18px',
              transition: 'border-color .2s, transform .15s, box-shadow .2s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = s.color + '50'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 8px 24px ${s.color}18` }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'rgba(255,255,255,.1)'; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `${s.color}18`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.03em', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: s.color, marginTop: 2, fontWeight: 600, opacity: .8 }}>{s.delta}</div>
            </div>
          </button>
        ))}
      </div>

      {role === 'Inhaber' && ownerSnapshot && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Inhaber-Cockpit</h2>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>Kunden, Freischaltungen, offene Forderungen und Owner-Signale auf einen Blick.</div>
            </div>
            <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/einstellungen')} style={{ fontSize: 13 }}>
              Kundensteuerung öffnen
            </button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <OwnerAiControlPanel enabled compact />
          </div>
          <div style={{
            marginBottom: 14,
            border: '1px solid rgba(32,200,255,.22)',
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(8,18,34,.96), rgba(5,10,20,.98))',
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 240 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(32,200,255,.12)', border: '1px solid rgba(32,200,255,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                📄
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#f8fbff' }}>Inhaber-Briefpapier</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Petersen Brand für Angebote, Auftragsbestätigungen und Rechnungen.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-green">Nur Inhaber</span>
              <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/einstellungen?section=firma')} style={{ fontSize: 12, fontWeight: 800 }}>
                Firmendaten öffnen →
              </button>
            </div>
          </div>
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'Aktive Kunden', value: ownerSnapshot.activeCustomers.toLocaleString('de-DE'), icon: '👥', color: '#20c8ff', href: '/dashboard/einstellungen', delta: 'Live aus Billing' },
              { label: 'Umsatz gesamt', value: `${ownerSnapshot.revenueTotal.toLocaleString('de-DE')} €`, icon: '💶', color: '#10b981', href: '/dashboard/buero?tab=rechnungen', delta: `MRR ${ownerSnapshot.monthlyRecurringRevenue.toLocaleString('de-DE')} €` },
              { label: 'Umsatz 30 Tage', value: `${ownerSnapshot.revenueLast30Days.toLocaleString('de-DE')} €`, icon: '📈', color: '#34d399', href: '/dashboard/buero?tab=rechnungen&filter=Bezahlt', delta: 'Bezahlt letzte 30 T' },
              { label: 'Freischaltungen offen', value: ownerSnapshot.pendingActivations.toLocaleString('de-DE'), icon: '⏳', color: '#f59e0b', href: '/dashboard/einstellungen', delta: `${ownerSnapshot.pendingApprovals} Pending / Beleg` },
              { label: 'Registrierungen offen', value: ownerPendingRegistrations.toLocaleString('de-DE'), icon: '🆕', color: '#60a5fa', href: '/dashboard/einstellungen', delta: 'Warten auf Erstfreigabe' },
              { label: 'Offene Rechnungen', value: ownerSnapshot.openInvoices.toLocaleString('de-DE'), icon: '🧾', color: '#f43f5e', href: '/dashboard/buero?tab=rechnungen&filter=Offen', delta: `${ownerSnapshot.overdueInvoices} überfällig >14 T` },
              { label: 'Fehler-Zahlungen', value: ownerSnapshot.failedPayments.toLocaleString('de-DE'), icon: '💥', color: '#ef4444', href: '/dashboard/einstellungen', delta: 'Stripe / Billing' },
              { label: 'Ungelesen', value: ownerSnapshot.unreadNotifications.toLocaleString('de-DE'), icon: '🔔', color: '#a78bfa', href: '/dashboard/einstellungen', delta: 'Owner-Hinweise' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                style={{
                  all: 'unset', cursor: 'pointer',
                  background: 'linear-gradient(180deg, rgba(18,26,38,.98), rgba(10,14,22,.98))',
                  border: `1px solid ${item.color}33`,
                  borderRadius: 18, padding: '16px 18px',
                  display: 'flex', gap: 12, alignItems: 'center',
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${item.color}18`, border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color, letterSpacing: '-.03em' }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#dbe4ef' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#8ba0b8', marginTop: 2 }}>{item.delta}</div>
                </div>
              </button>
            ))}
          </div>
          {(ownerSnapshot.pendingActivations > 0 || ownerSnapshot.failedPayments > 0) && (
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              {ownerSnapshot.pendingActivations > 0 && (
                <div style={{
                  padding: '14px 18px', borderRadius: 14,
                  background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.28)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#4ddb7e' }}>
                      ✅ {ownerSnapshot.pendingActivations} Freischaltung{ownerSnapshot.pendingActivations > 1 ? 'en' : ''} bereit
                    </div>
                    <div style={{ fontSize: 12, color: '#86efac', marginTop: 3, opacity: .85 }}>
                      Zahlungsbeleg eingegangen – Kunden warten auf Software-Freischaltung.
                    </div>
                  </div>
                  <button
                    className="pk-btn"
                    onClick={() => router.push('/dashboard/einstellungen?section=kundensteuerung')}
                    style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}
                  >
                    Jetzt freischalten →
                  </button>
                </div>
              )}
              {ownerPendingRegistrations > 0 && (
                <div style={{
                  padding: '14px 18px', borderRadius: 14,
                  background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.28)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#93c5fd' }}>
                      🆕 {ownerPendingRegistrations} neue Registrierungen warten auf Freigabe
                    </div>
                    <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 3, opacity: .85 }}>
                      Rollen, Demo-Laufzeit und Pilot-Zuweisung bitte im Inhaber-Bereich festlegen.
                    </div>
                  </div>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/einstellungen?section=rollen')}
                    style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}
                  >
                    Jetzt bearbeiten →
                  </button>
                </div>
              )}
              {ownerSnapshot.failedPayments > 0 && (
                <div style={{
                  padding: '14px 18px', borderRadius: 14,
                  background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.28)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#fca5a5' }}>
                      💥 {ownerSnapshot.failedPayments} fehlgeschlagene Zahlung{ownerSnapshot.failedPayments > 1 ? 'en' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 3, opacity: .8 }}>
                      Betroffene Kunden kontaktieren oder Buchung stornieren.
                    </div>
                  </div>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/einstellungen?section=kundensteuerung')}
                    style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}
                  >
                    Prüfen →
                  </button>
                </div>
              )}
            </div>
          )}

          {pendingRegistrations.length > 0 && (
            <div style={{
              marginTop: 16,
              border: '1px solid rgba(96,165,250,.24)',
              borderRadius: 20,
              background: 'rgba(96,165,250,.05)',
              padding: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Offene Registrierungen</h3>
                  <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 4 }}>Demo-Zugang oder Standard-Zugang direkt freischalten und Mailtext manuell öffnen.</div>
                </div>
                <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/einstellungen?section=registrierungen')} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Alle öffnen
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {pendingRegistrations.slice(0, 4).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.03)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{item.fullName || 'Ohne Namen'}</div>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{item.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="pk-btn-ghost" disabled={savingRegistrationId === item.id} onClick={() => void applyRegistrationPreset(item, 'demo7')} style={{ fontSize: 12, fontWeight: 800 }}>
                        Demo 7 Tage
                      </button>
                      <button className="pk-btn-ghost" disabled={savingRegistrationId === item.id} onClick={() => void applyRegistrationPreset(item, 'demo14')} style={{ fontSize: 12, fontWeight: 800 }}>
                        Demo 14 Tage
                      </button>
                      <button className="pk-btn" disabled={savingRegistrationId === item.id} onClick={() => void applyRegistrationPreset(item, 'standard')} style={{ fontSize: 12, fontWeight: 800 }}>
                        Standard freischalten
                      </button>
                      <a className="pk-btn-ghost" href={buildRegistrationMailHref(item, 'pending')} style={{ fontSize: 12, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        Mailtext
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Betriebsübersicht für Owner */}
          <div style={{
            marginTop: 16,
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20,
            background: 'linear-gradient(180deg, rgba(17,24,36,.94), rgba(10,14,22,.98))',
            padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Betriebsübersicht</h3>
                <div style={{ fontSize: 12, color: '#8ba0b8', marginTop: 4 }}>Wichtige Kennzahlen auf einen Blick</div>
              </div>
              <button className="pk-btn-ghost" onClick={loadOwnerSnapshot} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Aktualisieren</button>
            </div>
            <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {[
                { label: 'Aktive Kunden', value: ownerSnapshot.activeCustomers.toLocaleString('de-DE'), icon: '👥', color: '#20c8ff', href: '/dashboard/einstellungen?section=kundensteuerung', hint: 'Alle Kunden verwalten' },
                { label: 'Monatsumsatz', value: `${ownerSnapshot.monthlyRecurringRevenue.toLocaleString('de-DE')} €`, icon: '💶', color: '#10b981', href: '/dashboard/buero?tab=rechnungen', hint: 'Rechnungen öffnen' },
                { label: 'Offene Rechnungen', value: ownerSnapshot.openInvoices.toLocaleString('de-DE'), icon: '🧾', color: ownerSnapshot.openInvoices > 0 ? '#f59e0b' : '#10b981', href: '/dashboard/buero?tab=rechnungen&filter=Offen', hint: 'Offene Positionen prüfen' },
                { label: 'Freischaltungen', value: ownerSnapshot.pendingActivations.toLocaleString('de-DE'), icon: '⏳', color: ownerSnapshot.pendingActivations > 0 ? '#f59e0b' : '#10b981', href: '/dashboard/einstellungen?section=kundensteuerung', hint: 'Kunden freischalten' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    padding: '14px 16px', borderRadius: 14,
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                    display: 'flex', gap: 12, alignItems: 'center',
                    transition: 'background .15s, border-color .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,.07)' }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{item.hint} →</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pilots grid */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>KI-Piloten</h2>
          <span style={{ fontSize: 12, color: '#aeb9c8' }}>{visiblePilots.length} Piloten freigeschaltet</span>
        </div>
        {visiblePilots.length === 0 ? (
          <div className="pk-card" style={{ color: '#aeb9c8', fontSize: 14 }}>
            Ihrem Account wurden noch keine Piloten zugewiesen. Die Freigabe erfolgt zentral im Inhaber-Dashboard.
          </div>
        ) : (
          <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {visiblePilots.map((p, i) => <PilotCard key={p.id} pilot={p} delay={200 + i * 60} />)}
          </div>
        )}
      </div>

      {/* Zuletzt besucht */}
      {recentVisits.length > 0 && (
        <div className="pk-card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>🕐 Zuletzt besucht</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {recentVisits.map(item => (
              <button key={item.href} onClick={() => router.push(item.href)}
                style={{ all: 'unset', cursor: 'pointer', padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {visibleQuickActions.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              all: 'unset', cursor: 'pointer',
              background: 'linear-gradient(180deg, rgba(16,26,40,.94), rgba(8,12,19,.94))',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 16, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'border-color .2s, background .2s, transform .15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = item.color + '40'
              el.style.background = `linear-gradient(180deg, rgba(16,26,40,.98), rgba(8,12,19,.98))`
              el.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.borderColor = 'rgba(255,255,255,.08)'
              el.style.background = 'linear-gradient(180deg, rgba(16,26,40,.94), rgba(8,12,19,.94))'
              el.style.transform = 'translateY(0)'
            }}
          >
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
