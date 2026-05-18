'use client'
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts'
import { hasDemoCookie } from '@/lib/auth'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

// ── Typen ──────────────────────────────────────────────────────────────────────

interface UmsatzPoint { monat: string; umsatz: number; kosten: number; gewinn: number }
interface BestandPoint { woche: string; artikel: number; niedrig: number; leer: number }
interface KiDayPoint { tag: string; erkennungen: number; korrekt: number; fehler: number }
interface KpiData {
  umsatzMonat: number
  gewinnMonat: number
  artikelGesamt: number
  artikelNiedrig: number
  artikelLeer: number
  aktivKunden: number
  offeneAngebote: number
  offeneRechnungen: number
  offeneRechnungenSumme: number
  offeneAngeboteSumme: number
}

// ── Demo-Fallback ──────────────────────────────────────────────────────────────

const DEMO_UMSATZ: UmsatzPoint[] = [
  { monat: 'Okt', umsatz: 38400, kosten: 24200, gewinn: 14200 },
  { monat: 'Nov', umsatz: 41200, kosten: 26100, gewinn: 15100 },
  { monat: 'Dez', umsatz: 52800, kosten: 31400, gewinn: 21400 },
  { monat: 'Jan', umsatz: 35600, kosten: 22800, gewinn: 12800 },
  { monat: 'Feb', umsatz: 44100, kosten: 27300, gewinn: 16800 },
  { monat: 'Mär', umsatz: 48700, kosten: 29100, gewinn: 19600 },
  { monat: 'Apr', umsatz: 51300, kosten: 30800, gewinn: 20500 },
  { monat: 'Mai', umsatz: 47200, kosten: 28400, gewinn: 18800 },
]

const DEMO_BESTAND: BestandPoint[] = [
  { woche: 'KW14', artikel: 1180, niedrig: 5, leer: 2 },
  { woche: 'KW15', artikel: 1210, niedrig: 4, leer: 1 },
  { woche: 'KW16', artikel: 1195, niedrig: 6, leer: 3 },
  { woche: 'KW17', artikel: 1240, niedrig: 3, leer: 0 },
  { woche: 'KW18', artikel: 1248, niedrig: 3, leer: 1 },
]

const DEMO_KPI: KpiData = {
  umsatzMonat: 47200, gewinnMonat: 18800,
  artikelGesamt: 1248, artikelNiedrig: 3, artikelLeer: 1,
  aktivKunden: 5, offeneAngebote: 4, offeneRechnungen: 4,
  offeneRechnungenSumme: 14300, offeneAngeboteSumme: 38150,
}

const ZERO_KPI: KpiData = {
  umsatzMonat: 0, gewinnMonat: 0, artikelGesamt: 0, artikelNiedrig: 0, artikelLeer: 0,
  aktivKunden: 0, offeneAngebote: 0, offeneRechnungen: 0, offeneRechnungenSumme: 0, offeneAngeboteSumme: 0,
}

const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function parseEuro(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.,\-]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

// ── Pilot-Nutzungsverteilung (indikativ – kein Session-Logging vorhanden) ─────

const pilotNutzungData = [
  { name: 'LagerPilot', value: 38, color: '#1684ff' },
  { name: 'BüroPilot', value: 24, color: '#20c8ff' },
  { name: 'WerkstattPilot', value: 18, color: '#a78bfa' },
  { name: 'AnalysePilot', value: 10, color: '#10b981' },
  { name: 'MarketingPilot', value: 6, color: '#f59e0b' },
  { name: 'PlanungPilot', value: 4, color: '#f43f5e' },
]

// ── Tooltip-Styles ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#0b1420',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 10,
  color: '#f8fbff',
  fontSize: 13,
}
const axisStyle = { fill: '#aeb9c8', fontSize: 11 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFmt = (...args: any[]) => any

function formatEuro(v: number) { return `${(v / 1000).toFixed(0)}k €` }
const fmtEuro: TFmt = (v) => [`${Number(v).toLocaleString('de-DE')} €`]
const fmtPct: TFmt = (v) => [`${v}%`, 'Anteil']

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, delta, color, sub }: {
  icon: string; label: string; value: string; delta?: string; color: string; sub?: string
}) {
  return (
    <div className="pk-card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: color + '18', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.03em' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 1 }}>{sub}</div>}
      </div>
      {delta && (
        <div style={{
          fontSize: 13, fontWeight: 700, color: delta.startsWith('+') ? '#4ddb7e' : '#fb7185',
          background: (delta.startsWith('+') ? 'rgba(37,211,102,' : 'rgba(244,63,94,') + '.1)',
          padding: '4px 10px', borderRadius: 999,
        }}>{delta}</div>
      )}
    </div>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'uebersicht' | 'umsatz' | 'bestand' | 'ki'

export default function AnalysePilotPage() {
  const [tab, setTab] = useState<Tab>('uebersicht')
  const [zeitraum, setZeitraum] = useState<'7T' | '30T' | '3M' | '6M' | '1J'>('6M')
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KpiData>(ZERO_KPI)
  const [umsatzData, setUmsatzData] = useState<UmsatzPoint[]>([])
  const [bestandData, setBestandData] = useState<BestandPoint[]>([])
  const [kiData, setKiData] = useState<KiDayPoint[]>([])
  const [kiDocTypes, setKiDocTypes] = useState<{ type: string; count: number }[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const demo = hasDemoCookie()
    setIsDemo(demo)
    if (demo || !isSupabaseConfigured()) {
      setKpi(DEMO_KPI)
      setUmsatzData(DEMO_UMSATZ)
      setBestandData(DEMO_BESTAND)
      setKiData([
        { tag: 'Mo', erkennungen: 42, korrekt: 40, fehler: 2 },
        { tag: 'Di', erkennungen: 58, korrekt: 55, fehler: 3 },
        { tag: 'Mi', erkennungen: 51, korrekt: 49, fehler: 2 },
        { tag: 'Do', erkennungen: 67, korrekt: 65, fehler: 2 },
        { tag: 'Fr', erkennungen: 73, korrekt: 71, fehler: 2 },
        { tag: 'Sa', erkennungen: 24, korrekt: 24, fehler: 0 },
        { tag: 'So', erkennungen: 18, korrekt: 17, fehler: 1 },
      ])
      setLoading(false)
      return
    }
    loadLiveData()
  }, [])

  async function loadLiveData() {
    try {
      const supabase = createSupabaseClient()
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [rechnungen, eingangsrechnungen, kunden, angebote, artikel, kiDocs] = await Promise.allSettled([
        supabase.from('buero_rechnungen').select('betrag,summe,datum,status').order('created_at'),
        supabase.from('buero_eingangsrechnungen').select('betrag_brutto,rechnungsdatum,status'),
        supabase.from('buero_kunden').select('status'),
        supabase.from('buero_angebote').select('betrag,datum,status'),
        supabase.from('lager_artikel').select('bestand,status,mindestbestand,created_at'),
        supabase.from('buero_dokumente').select('document_type,confidence,created_at').gte('created_at', sevenDaysAgo),
      ])

      // ── Rechnungen ──
      const raws = rechnungen.status === 'fulfilled' && !rechnungen.value.error
        ? rechnungen.value.data ?? []
        : []
      type RechnungRow = { betrag?: string | null; summe?: number | null; datum?: string | null; status?: string | null }
      const rechnungenRows = raws as RechnungRow[]

      // ── Eingangsrechnungen als Kostenquelle ──
      const kosten = eingangsrechnungen.status === 'fulfilled' && !eingangsrechnungen.value.error
        ? (eingangsrechnungen.value.data ?? []) as Array<{ betrag_brutto?: number | null; rechnungsdatum?: string | null }>
        : []

      // ── Kunden ──
      const kundenRows = kunden.status === 'fulfilled' && !kunden.value.error
        ? (kunden.value.data ?? []) as Array<{ status?: string | null }>
        : []

      // ── Angebote ──
      type AngebotRow = { betrag?: string | null; datum?: string | null; status?: string | null }
      const angeboteRows = angebote.status === 'fulfilled' && !angebote.value.error
        ? (angebote.value.data ?? []) as AngebotRow[]
        : []

      // ── Artikel ──
      type ArtikelRow = { bestand?: number | null; status?: string | null; mindestbestand?: number | null; created_at?: string | null }
      const artikelRows = artikel.status === 'fulfilled' && !artikel.value.error
        ? (artikel.value.data ?? []) as ArtikelRow[]
        : []

      // ── KPI berechnen ──
      const now = new Date()
      const monatStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const umsatzDiesen = rechnungenRows
        .filter(r => r.datum && new Date(r.datum) >= monatStart)
        .reduce((s, r) => s + (r.summe ?? parseEuro(r.betrag)), 0)

      const kostenDiesen = kosten
        .filter(k => k.rechnungsdatum && new Date(k.rechnungsdatum) >= monatStart)
        .reduce((s, k) => s + (k.betrag_brutto ?? 0), 0)

      const offeneRechnungenList = rechnungenRows.filter(r => r.status === 'Offen' || r.status === 'Fällig')
      const offeneRechnungenSumme = offeneRechnungenList.reduce((s, r) => s + (r.summe ?? parseEuro(r.betrag)), 0)

      const offeneAngeboteList = angeboteRows.filter(a => a.status === 'Entwurf' || a.status === 'Gesendet')
      const offeneAngeboteSumme = offeneAngeboteList.reduce((s, a) => s + parseEuro(a.betrag), 0)

      setKpi({
        umsatzMonat: Math.round(umsatzDiesen),
        gewinnMonat: Math.round(umsatzDiesen - kostenDiesen),
        artikelGesamt: artikelRows.length,
        artikelNiedrig: artikelRows.filter(a => a.status === 'niedrig').length,
        artikelLeer: artikelRows.filter(a => a.status === 'leer').length,
        aktivKunden: kundenRows.filter(k => k.status !== 'Inaktiv').length,
        offeneAngebote: offeneAngeboteList.length,
        offeneRechnungen: offeneRechnungenList.length,
        offeneRechnungenSumme: Math.round(offeneRechnungenSumme),
        offeneAngeboteSumme: Math.round(offeneAngeboteSumme),
      })

      // ── Umsatz-Chart: letzte 8 Monate ──
      const umsatzByMonth = new Map<string, { umsatz: number; kosten: number }>()
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        umsatzByMonth.set(key, { umsatz: 0, kosten: 0 })
      }
      for (const r of rechnungenRows) {
        if (!r.datum) continue
        const d = new Date(r.datum)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (umsatzByMonth.has(key)) {
          umsatzByMonth.get(key)!.umsatz += r.summe ?? parseEuro(r.betrag)
        }
      }
      for (const k of kosten) {
        if (!k.rechnungsdatum) continue
        const d = new Date(k.rechnungsdatum)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (umsatzByMonth.has(key)) {
          umsatzByMonth.get(key)!.kosten += k.betrag_brutto ?? 0
        }
      }
      const newUmsatz: UmsatzPoint[] = Array.from(umsatzByMonth.entries()).map(([key, v]) => {
        const [, m] = key.split('-')
        return {
          monat: MONATSNAMEN[parseInt(m, 10) - 1],
          umsatz: Math.round(v.umsatz),
          kosten: Math.round(v.kosten),
          gewinn: Math.round(v.umsatz - v.kosten),
        }
      })
      setUmsatzData(newUmsatz)

      // ── Bestand-Chart: nur aktuellen Snapshot zeigen (kein historisches Logging) ──
      const gesamtArtikel = artikelRows.length
      const niedrig = artikelRows.filter(a => a.status === 'niedrig').length
      const leer = artikelRows.filter(a => a.status === 'leer').length
      const kw = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)
      setBestandData([{
        woche: `KW${String(kw).padStart(2, '0')} (aktuell)`,
        artikel: gesamtArtikel,
        niedrig,
        leer,
      }])

      // ── KI-Dokumente der letzten 7 Tage ──
      type KiDocRow = { document_type?: string | null; confidence?: number | null; created_at?: string | null }
      const kiDokRows = kiDocs.status === 'fulfilled' && !kiDocs.value.error
        ? (kiDocs.value.data ?? []) as KiDocRow[]
        : []

      const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      const kiByDay = new Map<string, { erkennungen: number; korrekt: number }>()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        kiByDay.set(WOCHENTAGE[d.getDay()], { erkennungen: 0, korrekt: 0 })
      }
      for (const doc of kiDokRows) {
        if (!doc.document_type || !doc.created_at) continue
        const d = new Date(doc.created_at)
        const tag = WOCHENTAGE[d.getDay()]
        if (!kiByDay.has(tag)) continue
        const entry = kiByDay.get(tag)!
        entry.erkennungen++
        if ((doc.confidence ?? 0) >= 0.7) entry.korrekt++
      }
      const newKiData: KiDayPoint[] = Array.from(kiByDay.entries()).map(([tag, v]) => ({
        tag,
        erkennungen: v.erkennungen,
        korrekt: v.korrekt,
        fehler: v.erkennungen - v.korrekt,
      }))
      setKiData(newKiData)

      // ── KI-Dokumenttypen-Verteilung ──
      const typeMap = new Map<string, number>()
      for (const doc of kiDokRows) {
        if (!doc.document_type) continue
        typeMap.set(doc.document_type, (typeMap.get(doc.document_type) ?? 0) + 1)
      }
      setKiDocTypes(Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count))
    } catch {
      setLoadError(true)
      setKpi(ZERO_KPI)
      setUmsatzData([])
      setBestandData([])
    } finally {
      setLoading(false)
    }
  }

  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k €` : `${n.toLocaleString('de-DE')} €`

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>📊</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>AnalysePilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Echtzeit-Dashboards · KPIs · Diagramme · Prognosen</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {isDemo && <span className="badge badge-orange">Demo</span>}
          {loading && <span className="badge badge-blue">⏳ Lädt…</span>}
          {!loading && !isDemo && !loadError && <span className="badge badge-green">● Live</span>}
          {loadError && <span className="badge badge-red">⚠️ Ladefehler</span>}
        </div>
      </div>

      {/* Fehler-Banner */}
      {loadError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)', fontSize: 13, color: '#fb7185' }}>
          ⚠️ Daten konnten nicht geladen werden. Bitte Seite neu laden oder Verbindung prüfen.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {([
          { id: 'uebersicht', label: '⊞ Übersicht' },
          { id: 'umsatz', label: '💶 Umsatz & Gewinn' },
          { id: 'bestand', label: '📦 Bestandsentwicklung' },
          { id: 'ki', label: '🧠 KI-Nutzung' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: tab === t.id ? '2px solid #10b981' : '2px solid transparent',
            color: tab === t.id ? '#34d399' : '#aeb9c8', marginBottom: -1, transition: 'color .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ÜBERSICHT ── */}
      {tab === 'uebersicht' && (
        <div>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            <KPICard icon="💶" label="Umsatz (lfd. Monat)" value={fmtK(kpi.umsatzMonat)} color="#10b981" />
            <KPICard icon="📈" label="Gewinn (lfd. Monat)" value={fmtK(kpi.gewinnMonat)} color="#1684ff" />
            <KPICard icon="📦" label="Artikel im Lager" value={kpi.artikelGesamt.toLocaleString('de-DE')} color="#f59e0b"
              sub={kpi.artikelNiedrig > 0 ? `Davon ${kpi.artikelNiedrig} niedrig` : 'Alle ausreichend'} />
            <KPICard icon="✅" label="Ø Lagerauslastung" value={kpi.artikelLeer > 0 ? `${Math.round((1 - kpi.artikelLeer / Math.max(kpi.artikelGesamt, 1)) * 100)}%` : '100%'} color="#10b981" sub="Artikel mit Bestand > 0" />
            <KPICard icon="👥" label="Aktive Kunden" value={String(kpi.aktivKunden)} color="#20c8ff" />
            <KPICard icon="📋" label="Offene Angebote" value={String(kpi.offeneAngebote)} color="#f59e0b"
              sub={kpi.offeneAngeboteSumme > 0 ? `Wert: ${fmtK(kpi.offeneAngeboteSumme)}` : undefined} />
            <KPICard icon="💶" label="Offene Rechnungen" value={String(kpi.offeneRechnungen)} color="#f43f5e"
              sub={kpi.offeneRechnungenSumme > 0 ? `Gesamt: ${fmtK(kpi.offeneRechnungenSumme)}` : undefined} />
            <KPICard icon="⚠️" label="Kritische Artikel" value={String(kpi.artikelNiedrig + kpi.artikelLeer)} color="#f59e0b"
              sub={`${kpi.artikelLeer} leer · ${kpi.artikelNiedrig} niedrig`} />
          </div>

          {/* Sparkline Umsatz */}
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>💶 Umsatz & Kosten – letzte 8 Monate</h3>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#10b981' }}>▬ Umsatz</span>
                <span style={{ color: '#f43f5e' }}>▬ Kosten</span>
                <span style={{ color: '#1684ff' }}>▬ Gewinn</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={umsatzData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="umsatzGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gewinnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1684ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1684ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="monat" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatEuro} tick={axisStyle} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmtEuro} />
                <Area type="monotone" dataKey="umsatz" stroke="#10b981" strokeWidth={2} fill="url(#umsatzGrad)" name="Umsatz" />
                <Area type="monotone" dataKey="kosten" stroke="#f43f5e" strokeWidth={2} fill="none" strokeDasharray="4 2" name="Kosten" />
                <Area type="monotone" dataKey="gewinn" stroke="#1684ff" strokeWidth={2} fill="url(#gewinnGrad)" name="Gewinn" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pilot-Nutzung + Bestand nebeneinander */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="pk-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>🥧 Pilot-Nutzung (Sitzungen)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pilotNutzungData} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {pilotNutzungData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtPct} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                {pilotNutzungData.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                    <span style={{ color: '#aeb9c8' }}>{p.name}</span>
                    <span style={{ color: p.color, fontWeight: 700 }}>{p.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pk-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📦 Bestandstrend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={bestandData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="woche" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="artikel" stroke="#1684ff" strokeWidth={2} dot={{ fill: '#1684ff', r: 4 }} name="Artikel gesamt" />
                  <Line type="monotone" dataKey="niedrig" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Niedr. Bestand" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── UMSATZ ── */}
      {tab === 'umsatz' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>💶 Umsatz, Kosten & Gewinn</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['7T', '30T', '3M', '6M', '1J'] as const).map(z => (
                <button key={z} onClick={() => setZeitraum(z)} style={{
                  padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
                  background: zeitraum === z ? 'rgba(16,185,129,.15)' : 'transparent',
                  color: zeitraum === z ? '#34d399' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{z}</button>
              ))}
            </div>
          </div>

          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>Balkendiagramm – Umsatz vs. Kosten</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={umsatzData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="monat" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatEuro} tick={axisStyle} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmtEuro} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#aeb9c8', paddingTop: 8 }} />
                <Bar dataKey="umsatz" name="Umsatz" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="kosten" name="Kosten" fill="rgba(244,63,94,.6)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="gewinn" name="Gewinn" fill="#1684ff" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pk-card">
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>Liniendiagramm – Umsatzentwicklung</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={umsatzData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="monat" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatEuro} tick={axisStyle} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={tooltipStyle} formatter={fmtEuro} />
                <Line type="monotone" dataKey="umsatz" stroke="#10b981" strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: '#0b1420' }} name="Umsatz" />
                <Line type="monotone" dataKey="gewinn" stroke="#1684ff" strokeWidth={2}
                  dot={{ fill: '#1684ff', r: 4, strokeWidth: 2, stroke: '#0b1420' }}
                  strokeDasharray="6 3" name="Gewinn" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── BESTAND ── */}
      {tab === 'bestand' && (
        <div>
          {!isDemo && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, color: '#aeb9c8' }}>
              ● Live – aktueller Lagerbestand. Historische Wochenvergleiche werden noch nicht automatisch gespeichert.
            </div>
          )}
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📦 Bestandsübersicht – aktuell</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={bestandData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="bestandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1684ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1684ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="woche" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#aeb9c8', paddingTop: 8 }} />
                <Area type="monotone" dataKey="artikel" stroke="#1684ff" strokeWidth={2.5}
                  fill="url(#bestandGrad)" name="Artikel gesamt"
                  dot={{ fill: '#1684ff', r: 5, strokeWidth: 2, stroke: '#0b1420' }} />
                <Area type="monotone" dataKey="niedrig" stroke="#f59e0b" strokeWidth={2}
                  fill="none" name="Niedriger Bestand"
                  dot={{ fill: '#f59e0b', r: 4, strokeWidth: 2, stroke: '#0b1420' }} />
                <Area type="monotone" dataKey="leer" stroke="#f43f5e" strokeWidth={2}
                  fill="none" name="Leer / kein Bestand"
                  dot={{ fill: '#f43f5e', r: 4, strokeWidth: 2, stroke: '#0b1420' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Artikel gesamt</th>
                  <th>Niedriger Bestand</th>
                  <th>Leer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...bestandData].reverse().map(d => (
                  <tr key={d.woche}>
                    <td style={{ fontWeight: 700 }}>{d.woche}</td>
                    <td style={{ fontWeight: 700, color: '#1684ff' }}>{d.artikel}</td>
                    <td style={{ color: d.niedrig > 4 ? '#ffb347' : '#4ddb7e', fontWeight: 600 }}>{d.niedrig}</td>
                    <td style={{ color: d.leer > 0 ? '#f43f5e' : '#4ddb7e', fontWeight: 600 }}>{d.leer}</td>
                    <td>
                      <span className={`badge ${d.leer === 0 && d.niedrig <= 4 ? 'badge-green' : d.leer > 0 ? 'badge-orange' : 'badge-blue'}`}>
                        {d.leer === 0 && d.niedrig <= 4 ? '✅ Gut' : d.leer > 0 ? '⚠️ Kritisch' : '🔵 Prüfen'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KI-NUTZUNG ── */}
      {tab === 'ki' && (() => {
        const totalErkennungen = kiData.reduce((s, d) => s + d.erkennungen, 0)
        const totalKorrekt = kiData.reduce((s, d) => s + d.korrekt, 0)
        const totalFehler = kiData.reduce((s, d) => s + d.fehler, 0)
        const genauigkeit = totalErkennungen > 0 ? ((totalKorrekt / totalErkennungen) * 100).toFixed(1) : '–'
        const avgProTag = totalErkennungen > 0 ? Math.round(totalErkennungen / 7) : 0
        const hasKiData = totalErkennungen > 0

        return (
          <div>
            {!isDemo && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: hasKiData ? 'rgba(16,185,129,.08)' : 'rgba(22,132,255,.08)', border: `1px solid ${hasKiData ? 'rgba(16,185,129,.2)' : 'rgba(22,132,255,.2)'}`, fontSize: 13, color: '#aeb9c8' }}>
                {hasKiData
                  ? `● Live – KI-Erkennungen aus den letzten 7 Tagen (buero_dokumente). Genauigkeit basiert auf confidence ≥ 0.7.`
                  : `Noch keine KI-Erkennungen in den letzten 7 Tagen. Sobald Dokumente per KI analysiert werden, erscheinen hier echte Werte.`}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Erkennungen diese Woche', value: String(totalErkennungen), icon: '🧠', color: '#a78bfa' },
                { label: 'Genauigkeit', value: genauigkeit !== '–' ? `${genauigkeit}%` : '–', icon: '🎯', color: '#10b981' },
                { label: 'Fehler gesamt', value: String(totalFehler), icon: '⚠️', color: '#f43f5e' },
                { label: 'Ø pro Tag', value: String(avgProTag), icon: '📊', color: '#1684ff' },
              ].map(s => (
                <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="pk-card" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>🧠 KI-Erkennungen pro Tag (letzte 7 Tage)</h3>
              {hasKiData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={kiData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                    <XAxis dataKey="tag" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#aeb9c8', paddingTop: 8 }} />
                    <Bar dataKey="korrekt" name="Korrekt erkannt" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                    <Bar dataKey="fehler" name="Fehler / niedrige Confidence" fill="rgba(244,63,94,.6)" radius={[4, 4, 0, 0]} maxBarSize={40} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8ba0b8', fontSize: 13 }}>
                  Keine KI-Erkennungen in den letzten 7 Tagen
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>🥧 Pilot-Nutzungsverteilung</h3>
                <div style={{ fontSize: 11, color: '#8ba0b8', marginBottom: 12 }}>Indikativ – kein Session-Logging aktiv</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pilotNutzungData} cx="50%" cy="50%" outerRadius={70}
                      dataKey="value" nameKey="name" paddingAngle={2}>
                      {pilotNutzungData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: unknown, name: unknown) => [`${v}%`, name]) as TFmt} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                  {pilotNutzungData.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
                      <span style={{ color: '#aeb9c8' }}>{p.name.replace('Pilot', '')} </span>
                      <span style={{ color: p.color, fontWeight: 700 }}>{p.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800 }}>📋 Erkannte Dokumenttypen</h3>
                <div style={{ fontSize: 11, color: '#8ba0b8', marginBottom: 12 }}>Letzte 7 Tage aus buero_dokumente</div>
                {kiDocTypes.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {kiDocTypes.slice(0, 6).map(({ type, count }) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#dbe4ef' }}>{type}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{count}×</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#8ba0b8', fontSize: 13 }}>
                    Noch keine KI-erkannten Dokumente
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
