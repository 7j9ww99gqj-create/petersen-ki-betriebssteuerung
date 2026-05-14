'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { getLagerArtikel, getBueroRechnungen, getBueroAuftraege, getFirmaEinstellungen, getOwnerDashboardSnapshot, type FirmaEinstellungen, type OwnerDashboardSnapshot } from '@/lib/db'
import { loadRole, type AppRole } from '@/lib/roles'

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
  monthlyRecurringRevenue: 3890,
  revenueTotal: 28460,
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
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [kpi, setKpi] = useState<KpiData>(demoKpis)
  const [kpiLoaded, setKpiLoaded] = useState(false)
  const [firma, setFirma] = useState<FirmaEinstellungen | null>(null)
  const [role, setRole] = useState<AppRole>('Admin')
  const [ownerSnapshot, setOwnerSnapshot] = useState<OwnerDashboardSnapshot | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('pk_user')
    if (u) setUser(JSON.parse(u))
    setTimeout(() => setHeaderVisible(true), 80)

    const isDemo = hasDemoCookie()
    loadRole().then(setRole).catch(() => setRole('Admin'))
    if (isDemo) {
      setFirma(demoFirma)
      localStorage.setItem('pk_firma_einstellungen', JSON.stringify(demoFirma))
      setOwnerSnapshot(demoOwnerSnapshot)
    } else {
      getFirmaEinstellungen()
        .then(data => {
          setFirma(data)
          if (data) localStorage.setItem('pk_firma_einstellungen', JSON.stringify(data))
        })
        .catch(() => setFirma(null))
      getOwnerDashboardSnapshot()
        .then(setOwnerSnapshot)
        .catch(() => setOwnerSnapshot(null))
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
    { label: 'Artikel im Lager', value: String(kpi.lagerArtikel), icon: '📦', color: '#1684ff', href: '/dashboard/lager?tab=bestand&status=Alle', delta: `${kpi.kritischeBestände} kritisch` },
    { label: 'Kritische Bestände', value: String(kpi.kritischeBestände), icon: '⚠️', color: kpi.kritischeBestände > 0 ? '#f59e0b' : '#10b981', href: '/dashboard/lager?tab=bestand&status=niedrig', delta: kpi.kritischeBestände > 0 ? 'Nachbestellung nötig' : 'Alles OK' },
    { label: 'Offene Rechnungen', value: String(kpi.offeneRechnungen), icon: '💶', color: kpi.ueberfaelligeRechnungen > 0 ? '#f43f5e' : '#f59e0b', href: '/dashboard/buero?tab=rechnungen&filter=Offen', delta: kpi.rechnungenWert },
    { label: 'Überfällige Zahlungen', value: String(kpi.ueberfaelligeRechnungen), icon: '🚨', color: kpi.ueberfaelligeRechnungen > 0 ? '#f43f5e' : '#10b981', href: '/dashboard/buero?tab=rechnungen&filter=%C3%9Cberf%C3%A4llig', delta: kpi.ueberfaelligeRechnungen > 0 ? 'Mahnung prüfen' : 'Alles beglichen' },
    { label: 'Laufende Aufträge', value: String(kpi.laufendeAuftraege), icon: '✅', color: '#10b981', href: '/dashboard/buero?tab=auftraege', delta: 'In Bearbeitung' },
    { label: 'Cloud-Sync', value: '100%', icon: '☁️', color: '#20c8ff', href: '/dashboard/cloud', delta: 'Aktuell' },
  ]

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
          <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/ki-erkennung')} style={{ fontSize: 13 }}>
            🧠 KI-Assistent
          </button>
          <button className="pk-btn" onClick={() => router.push('/dashboard/cloud')} style={{ fontSize: 13 }}>
            ☁️ Cloud Sync
          </button>
        </div>
      </div>

      {/* Echte KPI-Karten */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Live-KPIs</h2>
        {!kpiLoaded && <div style={{ width: 16, height: 16, border: '2px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
      </div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {kpiCards.map((s, i) => (
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
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              { label: 'Aktive Kunden', value: ownerSnapshot.activeCustomers.toLocaleString('de-DE'), icon: '👥', color: '#20c8ff', href: '/dashboard/einstellungen', delta: 'Live aus Billing' },
              { label: 'Umsatz', value: `${ownerSnapshot.revenueTotal.toLocaleString('de-DE')} €`, icon: '💶', color: '#10b981', href: '/dashboard/buero?tab=rechnungen', delta: `MRR ${ownerSnapshot.monthlyRecurringRevenue.toLocaleString('de-DE')} €` },
              { label: 'Freischaltungen offen', value: ownerSnapshot.pendingActivations.toLocaleString('de-DE'), icon: '⏳', color: '#f59e0b', href: '/dashboard/einstellungen', delta: `${ownerSnapshot.pendingApprovals} Pending / Beleg` },
              { label: 'Offene Rechnungen', value: ownerSnapshot.openInvoices.toLocaleString('de-DE'), icon: '🧾', color: '#f43f5e', href: '/dashboard/buero?tab=rechnungen&filter=Offen', delta: 'BüroPilot' },
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

          <div style={{
            marginTop: 16,
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20,
            background: 'linear-gradient(180deg, rgba(17,24,36,.94), rgba(10,14,22,.98))',
            padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Letzte Aktivitäten</h3>
                <div style={{ fontSize: 12, color: '#8ba0b8', marginTop: 4 }}>Billing-, Stripe- und Owner-Signale in zeitlicher Reihenfolge.</div>
              </div>
              <span className="badge badge-blue">{ownerSnapshot.recentActivities.length} Einträge</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {ownerSnapshot.recentActivities.map(activity => (
                <button
                  key={activity.id}
                  onClick={() => activity.linkUrl ? router.push(activity.linkUrl) : undefined}
                  style={{
                    all: 'unset',
                    cursor: activity.linkUrl ? 'pointer' : 'default',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(255,255,255,.03)',
                    padding: '12px 14px',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fbff' }}>{activity.title}</div>
                    <div style={{ fontSize: 11, color: activity.severity === 'error' ? '#fca5a5' : activity.severity === 'success' ? '#86efac' : activity.severity === 'warn' ? '#fcd34d' : '#8ba0b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {activity.source}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.5 }}>{activity.description}</div>
                  <div style={{ fontSize: 11, color: '#708199' }}>
                    {new Date(activity.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
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
          <span style={{ fontSize: 12, color: '#aeb9c8' }}>{pilots.length} Piloten verfügbar</span>
        </div>
        <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {pilots.map((p, i) => <PilotCard key={p.id} pilot={p} delay={200 + i * 60} />)}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {[
          { label: 'KI-Assistent', desc: 'Dokumente & Fotos automatisch erfassen', icon: '🧠', href: '/dashboard/ki-erkennung', color: '#a78bfa' },
          { label: 'Cloud & Sync', desc: 'Datensicherung & Cloud-Status', icon: '☁️', href: '/dashboard/cloud', color: '#20c8ff' },
          { label: 'Archiv', desc: 'Alle gespeicherten Dokumente & Vorgänge', icon: '🗂️', href: '/dashboard/archiv', color: '#f59e0b' },
          { label: 'Einstellungen', desc: 'Profil, Benachrichtigungen, App-Info', icon: '⚙️', href: '/dashboard/einstellungen', color: '#aeb9c8' },
        ].map(item => (
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
