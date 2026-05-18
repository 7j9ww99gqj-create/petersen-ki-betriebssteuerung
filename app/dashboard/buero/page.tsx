'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { getBueroKunden, getBueroAngebote, getBueroAuftraege, getBueroRechnungen } from '@/lib/db'
import { useRole } from '@/lib/roles'
import { TabBar } from '@/components/buero/shared'
import type { Kunde, Angebot, Auftrag, Rechnung, Tab } from '@/types/buero'
import { demoKunden, demoAngebote, demoAuftraege, demoRechnungen, parseBetrag } from '@/types/buero'
import KundenTab from '@/components/buero/KundenTab'
import AngeboteTab from '@/components/buero/AngeboteTab'
import AuftraegeTab from '@/components/buero/AuftraegeTab'
import RechnungenTab from '@/components/buero/RechnungenTab'
import EingangRechnungenTab from '@/components/buero/EingangsrechnungenTab'
import DokumenteTab from '@/components/buero/DokumenteTab'
import EinkaufTab from '@/components/buero/EinkaufTab'
import AlertsTab from '@/components/buero/AlertsTab'
import PipelineKanbanTab from '@/components/buero/PipelineKanbanTab'

// ── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function BueroPilotPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isDemo] = useState(() => hasDemoCookie())
  const { role } = useRole()
  const isOwner = isDemo ? true : role === 'Admin'
  const [tab, setTab] = useState<Tab>('kunden')
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [angebote, setAngebote] = useState<Angebot[]>(isDemo ? demoAngebote : [])
  const [auftraege, setAuftraege] = useState<Auftrag[]>(isDemo ? demoAuftraege : [])
  const [sharedRechnungen, setSharedRechnungen] = useState<Rechnung[]>(isDemo ? demoRechnungen : [])
  const [sharedMailTarget, setSharedMailTarget] = useState<{ id: string; email: string; typ: 'rechnung' } | null>(null)
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = () => {
    if (isDemo) return
    setLoading(true)
    setErrorMsg('')
    Promise.all([getBueroKunden(), getBueroAngebote(), getBueroAuftraege(), getBueroRechnungen()])
      .then(([k, a, au, r]) => {
        setKunden(k as Kunde[])
        setAngebote(a as Angebot[])
        setAuftraege(au as Auftrag[])
        setSharedRechnungen(r as Rechnung[])
      })
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }

  // Shared data laden (Kunden + Angebote + Aufträge + Rechnungen für Cross-Tab-Referenzen)
  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab && ['kunden', 'angebote', 'auftraege', 'rechnungen', 'eingangsrechnungen', 'dokumente', 'einkauf'].includes(requestedTab)) {
      setTab(requestedTab as Tab)
    }
  }, [searchParams])

  // KPI-Berechnungen für Pipeline-Widget
  const offeneAngebote = angebote.filter(a => a.status === 'Versendet' || a.status === 'Entwurf').length
  const laufendeAuftraege = auftraege.filter(a => a.status === 'In Bearbeitung').length
  const offeneRechnungen = sharedRechnungen.filter(r => r.status !== 'Bezahlt').length

  // MTD/YTD Umsatz aus bezahlten Rechnungen
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  function parseDeDate(s?: string): Date | null {
    if (!s) return null
    const p = s.split('.')
    if (p.length !== 3) return null
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]))
  }
  const bezahltRechnungen = sharedRechnungen.filter(r => r.status === 'Bezahlt')
  const umsatzMTD = bezahltRechnungen.reduce((sum, r) => {
    const d = parseDeDate(r.bezahltAm)
    if (!d || d.getMonth() !== curMonth || d.getFullYear() !== curYear) return sum
    return sum + parseBetrag(r.betrag)
  }, 0)
  const umsatzYTD = bezahltRechnungen.reduce((sum, r) => {
    const d = parseDeDate(r.bezahltAm)
    if (!d || d.getFullYear() !== curYear) return sum
    return sum + parseBetrag(r.betrag)
  }, 0)
  const ueberfaelligCount = sharedRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').length
  function fmtEuro(v: number) { return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade BüroPilot…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(32,200,255,.15)', border: '1px solid rgba(32,200,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🧾</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>BüroPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kunden · Angebote · Aufträge · Rechnungen · Eingangsrechnungen · Dokumente · Einkauf</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,80,80,.1)', border: '1px solid rgba(255,80,80,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: '#ff8080' }}>⚠️ {errorMsg}</span>
          <button className="pk-btn-ghost" onClick={() => { setErrorMsg(''); void loadData() }}
            style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
            ↻ Erneut versuchen
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Kunden gesamt', value: String(kunden.filter(k => k.status === 'Aktiv').length), icon: '👥', color: '#20c8ff' },
          { label: 'Offene Angebote', value: String(offeneAngebote), icon: '📋', color: '#1684ff' },
          { label: 'Laufende Aufträge', value: String(laufendeAuftraege), icon: '✅', color: '#25d366' },
          { label: 'Offene Rechnungen', value: String(offeneRechnungen), icon: '💶', color: '#f59e0b' },
        ].map(s => (
          <button
            key={s.label}
            className="pk-card"
            onClick={() => {
              if (s.label === 'Kunden gesamt') router.push('/dashboard/buero?tab=kunden')
              if (s.label === 'Offene Angebote') router.push('/dashboard/buero?tab=angebote&filter=Versendet')
              if (s.label === 'Laufende Aufträge') router.push('/dashboard/buero?tab=auftraege')
              if (s.label === 'Offene Rechnungen') router.push('/dashboard/buero?tab=rechnungen&filter=Offen')
            }}
            style={{ textAlign: 'center', padding: '16px 12px', cursor: 'pointer', color: 'inherit' }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Finanzkennzahlen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Umsatz MTD', value: fmtEuro(umsatzMTD), icon: '📅', color: '#20c8ff', tab: 'rechnungen' as Tab },
          { label: 'Umsatz YTD', value: fmtEuro(umsatzYTD), icon: '📆', color: '#25d366', tab: 'rechnungen' as Tab },
          { label: 'Überfällig / Mahnung', value: String(ueberfaelligCount), icon: '⚠️', color: ueberfaelligCount > 0 ? '#f59e0b' : '#aeb9c8', tab: 'alerts' as Tab },
        ].map(s => (
          <button key={s.label} className="pk-card" onClick={() => setTab(s.tab)}
            style={{ textAlign: 'center', padding: '12px 10px', cursor: 'pointer', color: 'inherit' }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'kunden' && <KundenTab isDemo={isDemo} auftraege={auftraege} rechnungen={sharedRechnungen} angebote={angebote} />}
      {tab === 'angebote' && <AngeboteTab isDemo={isDemo} kunden={kunden} auftraege={auftraege} setAuftraege={setAuftraege} initialFilterStatus={searchParams.get('filter') ?? undefined} isOwner={isOwner} setTab={setTab} setRechnungen={setSharedRechnungen} />}
      {tab === 'auftraege' && <AuftraegeTab isDemo={isDemo} auftraege={auftraege} setAuftraege={setAuftraege} kunden={kunden} setTab={setTab} setRechnungen={setSharedRechnungen} setMailTarget={setSharedMailTarget} />}
      {tab === 'rechnungen' && <RechnungenTab isDemo={isDemo} kunden={kunden} initialFilterStatus={searchParams.get('filter') ?? undefined} sharedRechnungen={sharedRechnungen} setSharedRechnungen={setSharedRechnungen} sharedMailTarget={sharedMailTarget} setSharedMailTarget={setSharedMailTarget} />}
      {tab === 'eingangsrechnungen' && <EingangRechnungenTab isDemo={isDemo} initialFilterStatus={searchParams.get('filter') ?? undefined} />}
      {tab === 'dokumente' && <DokumenteTab isDemo={isDemo} />}
      {tab === 'einkauf' && <EinkaufTab isDemo={isDemo} />}
      {tab === 'alerts' && <AlertsTab kunden={kunden} rechnungen={sharedRechnungen} auftraege={auftraege} />}
      {tab === 'pipeline' && <PipelineKanbanTab angebote={angebote} auftraege={auftraege} rechnungen={sharedRechnungen} setTab={setTab} />}
    </div>
  )
}
