'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const pilots = [
  { id: 'lager', label: 'LagerPilot', icon: '📦', desc: 'Wareneingang, Bestände, Lagerplätze, Inventur', href: '/dashboard/lager', color: '#1684ff', status: 'AKTIV' },
  { id: 'buero', label: 'BüroPilot', icon: '🧾', desc: 'Kunden, Aufträge, Rechnungen, Dokumente', href: '/dashboard/buero', color: '#20c8ff', status: 'AKTIV' },
  { id: 'werkstatt', label: 'WerkstattPilot', icon: '🛠️', desc: 'Arbeitskarten, Zeiterfassung, Qualität', href: '/dashboard/werkstatt', color: '#a78bfa', status: 'AKTIV' },
  { id: 'marketing', label: 'MarketingPilot', icon: '📣', desc: 'Kampagnen, E-Mail, Social Media, Leads', href: '/dashboard/marketing', color: '#f59e0b', status: 'DEMO' },
  { id: 'analyse', label: 'AnalysePilot', icon: '📊', desc: 'Dashboards, KPIs, Prognosen, Berichte', href: '/dashboard/analyse', color: '#10b981', status: 'AKTIV' },
  { id: 'planung', label: 'PlanungPilot', icon: '📅', desc: 'Produktion, Ressourcen, Termine, Projekte', href: '/dashboard/planung', color: '#f43f5e', status: 'DEMO' },
]

const statsConfig = [
  { label: 'Artikel im Lager', target: 1248, suffix: '', delta: '+12 heute', icon: '📦', color: '#1684ff' },
  { label: 'Offene Aufträge', target: 34, suffix: '', delta: '5 fällig', icon: '🧾', color: '#f59e0b' },
  { label: 'Cloud-Sync', target: 100, suffix: '%', delta: 'Vor 2 Min.', icon: '☁️', color: '#10b981' },
  { label: 'KI-Erkennungen', target: 847, suffix: '', delta: 'Diese Woche', icon: '🧠', color: '#a78bfa' },
]

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

  useEffect(() => {
    const u = localStorage.getItem('pk_user')
    if (u) setUser(JSON.parse(u))
    setTimeout(() => setHeaderVisible(true), 80)
  }, [])

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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pk-btn-ghost" onClick={() => router.push('/dashboard/ki-erkennung')} style={{ fontSize: 13 }}>
            🧠 KI Erkennung
          </button>
          <button className="pk-btn" onClick={() => router.push('/dashboard/cloud')} style={{ fontSize: 13 }}>
            ☁️ Cloud Sync
          </button>
        </div>
      </div>

      {/* Stats row – animated counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {statsConfig.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 80} />
        ))}
      </div>

      {/* Pilots grid */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>KI-Piloten</h2>
          <span style={{ fontSize: 12, color: '#aeb9c8' }}>4 vollständig · 2 Demo</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {pilots.map((p, i) => <PilotCard key={p.id} pilot={p} delay={200 + i * 60} />)}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {[
          { label: 'KI Erkennung', desc: 'Dokumente & Fotos automatisch erfassen', icon: '🧠', href: '/dashboard/ki-erkennung', color: '#a78bfa' },
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
