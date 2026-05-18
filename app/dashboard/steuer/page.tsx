'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { getBueroRechnungen, getSteuerBelege, upsertSteuerBeleg, deleteSteuerBeleg, getSteuerUstva, upsertSteuerUstva, uploadSteuerBeleg, getSteuerFixkosten, getSteuerBetriebsausgaben, getSteuerAnschaffungen, getSteuerBelegUploads, upsertSteuerBelegUpload, deleteSteuerBelegUpload, uploadSteuerBelegFile, type SteuerBelegUpload } from '@/lib/db'
import { genId } from '@/lib/ids'
import { createSupabaseClient } from '@/lib/supabase'
import { getSteuerWarnings, type Warning } from '@/lib/warnings'
import { useRole } from '@/lib/roles'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import dynamic from 'next/dynamic'
import { downloadElsterXml } from '@/lib/steuer-export'

// Lazy-load schwere Tabs
const SteuerFixkostenTab      = dynamic(() => import('@/components/steuer/SteuerFixkosten'), { ssr: false })
const SteuerBetriebsausgabenTab = dynamic(() => import('@/components/steuer/SteuerBetriebsausgaben'), { ssr: false })
const SteuerAnschaffungenTab  = dynamic(() => import('@/components/steuer/SteuerAnschaffungen'), { ssr: false })

// ── Typen ──────────────────────────────────────────────────────────────────────

type Beleg = {
  id: string; lieferant: string; betrag: number; steuerbetrag: number
  steuersatz: number; datum: string; status: 'offen' | 'geprüft' | 'exportiert'
  datei_url?: string; notiz?: string
}
type Ustva = {
  id: string; monat: string; umsatzsteuer: number; vorsteuer: number
  zahllast: number; status: 'offen' | 'geprüft'
}
type Rechnung = {
  id: string; kunde?: string; nummer?: string; summe?: number; netto?: number
  steuer_satz?: number; steuerbetrag?: number; status?: string
  erstellt?: string; bezahlt_am?: string; faellig?: string
}

type FixkostenMin = { id: string; betrag_brutto: number; steuersatz: number; zahlungsintervall: string; aktiv: boolean }
type BetriebsausgabeMin = { id: string; betrag_brutto: number; steuersatz: number; datum: string }
type AnschaffungMin = { id: string; betrag_brutto: number; steuersatz: number; kaufdatum: string }
type StripeZahlung = { id: string; amount: number; booked_at: string | null; provider_ref: string | null }

function faktorForIntervall(intervall: string): number {
  const m: Record<string, number> = { monatlich: 1, quartalsweise: 1 / 3, halbjährlich: 1 / 6, jährlich: 1 / 12 }
  return m[intervall] ?? 1
}

type SteuerTab =
  | 'dashboard' | 'einnahmen' | 'belege' | 'fixkosten'
  | 'betriebsausgaben' | 'anschaffungen' | 'ustva' | 'auswertungen' | 'export'

// ── Konstanten ─────────────────────────────────────────────────────────────────

const STEUER_COLOR = '#f59e0b'
const STEUERSAETZE = [0, 7, 19]

const NAV_ITEMS: { id: SteuerTab; icon: string; label: string }[] = [
  { id: 'dashboard',        icon: '📊', label: 'Dashboard' },
  { id: 'einnahmen',        icon: '💰', label: 'Einnahmen' },
  { id: 'belege',           icon: '🧾', label: 'Belege' },
  { id: 'fixkosten',        icon: '📋', label: 'Fixkosten' },
  { id: 'betriebsausgaben', icon: '💸', label: 'Betriebsausgaben' },
  { id: 'anschaffungen',    icon: '🖥️', label: 'Anschaffungen' },
  { id: 'ustva',            icon: '📑', label: 'UStVA' },
  { id: 'auswertungen',     icon: '📈', label: 'Auswertungen' },
  { id: 'export',           icon: '📤', label: 'Export' },
]

// ── Demo-Daten ─────────────────────────────────────────────────────────────────

const demoMonate = ['2025-04', '2025-03', '2025-02', '2025-01']
const demoBelege: Beleg[] = [
  { id: 'BLG-001', lieferant: 'Büromaterial GmbH', betrag: 238.00, steuerbetrag: 38.00, steuersatz: 19, datum: '2025-04-05', status: 'geprüft', notiz: 'Druckerpapier & Toner' },
  { id: 'BLG-002', lieferant: 'Tanke Nord AG', betrag: 480.00, steuerbetrag: 76.64, steuersatz: 19, datum: '2025-04-08', status: 'geprüft', notiz: 'Diesel Firmenfahrzeug' },
  { id: 'BLG-003', lieferant: 'Tanke Nord AG', betrag: 480.00, steuerbetrag: 76.64, steuersatz: 19, datum: '2025-04-08', status: 'offen', notiz: 'ACHTUNG: möglicher Duplikat' },
  { id: 'BLG-004', lieferant: 'IT Solutions UG', betrag: 119.00, steuerbetrag: 19.00, steuersatz: 19, datum: '2025-04-12', status: 'exportiert' },
  { id: 'BLG-005', lieferant: 'Lebensmittel Großhandel', betrag: 107.00, steuerbetrag: 7.00, steuersatz: 7, datum: '2025-04-18', status: 'offen' },
  { id: 'BLG-006', lieferant: 'Versicherung GmbH', betrag: 850.00, steuerbetrag: 0, steuersatz: 0, datum: '2025-04-01', status: 'geprüft' },
]
const demoUstva: Ustva[] = [
  { id: 'USTVA-2025-04', monat: '2025-04', umsatzsteuer: 4750.00, vorsteuer: 282.28, zahllast: 4467.72, status: 'offen' },
  { id: 'USTVA-2025-03', monat: '2025-03', umsatzsteuer: 3980.00, vorsteuer: 95.00, zahllast: 3885.00, status: 'geprüft' },
  { id: 'USTVA-2025-02', monat: '2025-02', umsatzsteuer: 5210.00, vorsteuer: 310.00, zahllast: 4900.00, status: 'geprüft' },
]
const demoRechnungen: Rechnung[] = [
  { id: 'R-001', kunde: 'Mustermann GmbH', nummer: 'RE-2025-042', summe: 2380, netto: 2000, steuer_satz: 19, steuerbetrag: 380, status: 'bezahlt', erstellt: '2025-04-03', bezahlt_am: '2025-04-10' },
  { id: 'R-002', kunde: 'Tech Startup AG', nummer: 'RE-2025-043', summe: 5950, netto: 5000, steuer_satz: 19, steuerbetrag: 950, status: 'offen', erstellt: '2025-04-15', faellig: '2025-05-05' },
  { id: 'R-003', kunde: 'Design Studio', nummer: 'RE-2025-044', summe: 1190, netto: 1000, steuer_satz: 19, steuerbetrag: 190, status: 'bezahlt', erstellt: '2025-03-20', bezahlt_am: '2025-04-01' },
]
const demoFixkosten: FixkostenMin[] = [
  { id: 'FK-001', betrag_brutto: 39.99, steuersatz: 19, zahlungsintervall: 'monatlich', aktiv: true },
  { id: 'FK-002', betrag_brutto: 499.99, steuersatz: 19, zahlungsintervall: 'monatlich', aktiv: true },
  { id: 'FK-003', betrag_brutto: 11.99, steuersatz: 19, zahlungsintervall: 'monatlich', aktiv: true },
  { id: 'FK-004', betrag_brutto: 24.99, steuersatz: 19, zahlungsintervall: 'monatlich', aktiv: true },
  { id: 'FK-005', betrag_brutto: 850.00, steuersatz: 0, zahlungsintervall: 'jährlich', aktiv: true },
]
const demoBetriebsausgaben: BetriebsausgabeMin[] = [
  { id: 'BA-001', betrag_brutto: 29.99, steuersatz: 19, datum: '2025-04-05' },
  { id: 'BA-002', betrag_brutto: 59.00, steuersatz: 19, datum: '2025-04-08' },
  { id: 'BA-003', betrag_brutto: 30.39, steuersatz: 7, datum: '2025-03-12' },
  { id: 'BA-004', betrag_brutto: 100.00, steuersatz: 19, datum: '2025-04-15' },
]
const demoAnschaffungen: AnschaffungMin[] = [
  { id: 'ANS-001', betrag_brutto: 2499.00, steuersatz: 19, kaufdatum: '2025-04-10' },
  { id: 'ANS-002', betrag_brutto: 249.99, steuersatz: 19, kaufdatum: '2025-03-15' },
]
const demoStripeZahlungen: StripeZahlung[] = [
  { id: 'SP-001', amount: 119.00, booked_at: '2025-04-08T10:30:00Z', provider_ref: 'pi_demo_001' },
  { id: 'SP-002', amount: 59.00, booked_at: '2025-04-15T14:20:00Z', provider_ref: 'pi_demo_002' },
  { id: 'SP-003', amount: 239.00, booked_at: '2025-04-22T09:10:00Z', provider_ref: 'pi_demo_003' },
]

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}
function calcVst(brutto: number, satz: number): number {
  if (satz === 0) return 0
  return Math.round(brutto / (1 + satz / 100) * (satz / 100) * 100) / 100
}

// ── Sub-Komponenten ────────────────────────────────────────────────────────────

function Toast({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  if (!msg) return null
  const isErr = type === 'error'
  return (
    <div style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 9999, padding: '14px 20px', borderRadius: 12, maxWidth: 360, background: isErr ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)', border: `1px solid ${isErr ? 'rgba(255,80,80,.4)' : 'rgba(37,211,102,.35)'}`, color: isErr ? '#ff8080' : '#4ddb7e', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>{msg}</div>
  )
}

function KpiCard({ label, value, sub, color, onClick }: { label: string; value: string; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div className="pk-card" style={{ padding: '18px 20px', cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f8fbff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    offen: { label: 'Offen', cls: 'badge badge-orange' },
    geprüft: { label: 'Geprüft', cls: 'badge badge-green' },
    exportiert: { label: 'Exportiert', cls: 'badge badge-gray' },
    bezahlt: { label: 'Bezahlt', cls: 'badge badge-green' },
    erstellt: { label: 'Erstellt', cls: 'badge badge-blue' },
  }
  const s = map[status] ?? { label: status, cls: 'badge badge-gray' }
  return <span className={s.cls}>{s.label}</span>
}

function Modal({ title, onClose, children, maxWidth = 560 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="pk-card fade-in" style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function WarnBadge({ type }: { type: Warning['type'] }) {
  const map = { error: { cls: 'badge badge-red', label: 'Fehler' }, warn: { cls: 'badge badge-orange', label: 'Warnung' }, info: { cls: 'badge badge-blue', label: 'Info' }, success: { cls: 'badge badge-green', label: 'OK' } }
  const s = map[type]
  return <span className={s.cls}>{s.label}</span>
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────

export default function SteuerPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const { role, permissions } = useRole()
  const [tab, setTab] = useState<SteuerTab>('dashboard')
  const [belege, setBelege] = useState<Beleg[]>([])
  const [ustva, setUstva] = useState<Ustva[]>([])
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [selectedMonat, setSelectedMonat] = useState(currentMonthStr())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editBeleg, setEditBeleg] = useState<Partial<Beleg> | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('Alle')
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [fixkosten, setFixkosten] = useState<FixkostenMin[]>([])
  const [betriebsausgaben, setBetriebsausgaben] = useState<BetriebsausgabeMin[]>([])
  const [anschaffungen, setAnschaffungen] = useState<AnschaffungMin[]>([])
  const [belegUploads, setBelegUploads] = useState<SteuerBelegUpload[]>([])
  const [filterKategorie, setFilterKategorie] = useState<string>('Alle')
  const [deleteUploadConfirm, setDeleteUploadConfirm] = useState<string | null>(null)
  const [uploadForm, setUploadForm] = useState<{ kategorie: string; betrag: string; datum: string; notiz: string }>({ kategorie: 'Sonstiges', betrag: '', datum: new Date().toISOString().split('T')[0], notiz: '' })
  const [uploadFile2, setUploadFile2] = useState<File | null>(null)
  const [uploadSaving, setUploadSaving] = useState(false)
  const [dauerfristVerlaengerung, setDauerfristVerlaengerung] = useState(false)
  const [stripeZahlungen, setStripeZahlungen] = useState<StripeZahlung[]>([])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (isDemo) {
        setBelege(demoBelege); setUstva(demoUstva); setRechnungen(demoRechnungen)
        setFixkosten(demoFixkosten); setBetriebsausgaben(demoBetriebsausgaben); setAnschaffungen(demoAnschaffungen)
        setStripeZahlungen(demoStripeZahlungen)
        setWarnings(await getSteuerWarnings(true))
        setLoading(false); return
      }
      try {
        const supabase = createSupabaseClient()
        const start12 = new Date(); start12.setFullYear(start12.getFullYear() - 1)
        const [b, u, w, r, fk, ba, ans, bu, stripeResult] = await Promise.all([
          getSteuerBelege(), getSteuerUstva(), getSteuerWarnings(false), getBueroRechnungen(),
          getSteuerFixkosten(), getSteuerBetriebsausgaben(), getSteuerAnschaffungen(),
          getSteuerBelegUploads(),
          supabase.from('billing_payments').select('id,amount,booked_at,provider_ref').eq('status', 'paid').gte('booked_at', start12.toISOString()),
        ])
        setBelege(b as Beleg[])
        setUstva(u as Ustva[])
        setWarnings(w)
        setRechnungen((r as Rechnung[]) ?? [])
        setFixkosten((fk ?? []) as FixkostenMin[])
        setBetriebsausgaben((ba ?? []) as BetriebsausgabeMin[])
        setAnschaffungen((ans ?? []) as AnschaffungMin[])
        setBelegUploads(bu)
        if (!stripeResult.error) setStripeZahlungen((stripeResult.data ?? []) as StripeZahlung[])
      } catch { showToast('Daten konnten nicht geladen werden', 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [isDemo])

  // ── Berechnungen ──────────────────────────────────────────────────────────────

  const months = useMemo(() => {
    return Array.from(new Set([currentMonthStr(), ...ustva.map(u => u.monat), ...belege.map(b => b.datum.slice(0, 7))])).sort().reverse()
  }, [ustva, belege])

  const belegeMonat = belege.filter(b => b.datum.startsWith(selectedMonat))
  const rechnungenMonat = rechnungen.filter(r => (r.erstellt ?? '').startsWith(selectedMonat))
  const aktuellUstva = ustva.find(u => u.monat === selectedMonat)
  const stripeMonat = stripeZahlungen.filter(s => (s.booked_at ?? '').startsWith(selectedMonat))
  const stripeMonatSumme = stripeMonat.reduce((s, z) => s + (z.amount ?? 0), 0)

  const vorsteuerBelege = belegeMonat.reduce((s, b) => s + (b.steuerbetrag ?? 0), 0)
  const betriebsausgabenMonat = betriebsausgaben.filter(b => b.datum.startsWith(selectedMonat))
  const anschaffungenMonat = anschaffungen.filter(a => a.kaufdatum.startsWith(selectedMonat))
  const vorsteuerFixkosten = fixkosten.filter(f => f.aktiv).reduce((s, f) => s + calcVst(f.betrag_brutto * faktorForIntervall(f.zahlungsintervall), f.steuersatz), 0)
  const vorsteuerBetriebsAusg = betriebsausgabenMonat.reduce((s, b) => s + calcVst(b.betrag_brutto, b.steuersatz), 0)
  const vorsteuerAnschaffungen = anschaffungenMonat.reduce((s, a) => s + calcVst(a.betrag_brutto, a.steuersatz), 0)
  const vorsteuerGesamt = vorsteuerBelege + vorsteuerFixkosten + vorsteuerBetriebsAusg + vorsteuerAnschaffungen
  const umsatzsteuerRechnungen = rechnungenMonat.reduce((s, r) => s + (r.steuerbetrag ?? 0), 0)
  const umsatzsteuerGes = aktuellUstva?.umsatzsteuer ?? umsatzsteuerRechnungen
  const zahllast = umsatzsteuerGes - vorsteuerGesamt
  const einnahmenMonat = rechnungenMonat.reduce((s, r) => s + (r.summe ?? 0), 0)

  const calcUStVA = () => {
    const netto19 = belegeMonat.filter(b => b.steuersatz === 19).reduce((s, b) => s + (b.betrag - b.steuerbetrag), 0)
    const netto7  = belegeMonat.filter(b => b.steuersatz === 7).reduce((s, b) => s + (b.betrag - b.steuerbetrag), 0)
    const steuer19 = belegeMonat.filter(b => b.steuersatz === 19).reduce((s, b) => s + b.steuerbetrag, 0)
    const steuer7  = belegeMonat.filter(b => b.steuersatz === 7).reduce((s, b) => s + b.steuerbetrag, 0)
    return { netto19, netto7, steuer19, steuer7, nettoGes: netto19 + netto7 }
  }

  // ── CRUD Belege ───────────────────────────────────────────────────────────────

  const handleSaveBeleg = async () => {
    if (!editBeleg?.lieferant || editBeleg.betrag == null || !Number.isFinite(Number(editBeleg.betrag))) {
      showToast('Bitte Lieferant und gültigen Betrag eingeben', 'error'); return
    }
    setSaving(true)
    const toSave: Beleg = {
      id: editBeleg.id ?? genId('BLG'),
      lieferant: editBeleg.lieferant ?? '',
      betrag: Number(editBeleg.betrag ?? 0),
      steuerbetrag: Number(editBeleg.steuerbetrag ?? 0),
      steuersatz: Number(editBeleg.steuersatz ?? 19),
      datum: editBeleg.datum ?? new Date().toISOString().split('T')[0],
      status: editBeleg.status ?? 'offen',
      datei_url: editBeleg.datei_url,
      notiz: editBeleg.notiz,
    }
    if (isDemo) {
      setBelege(prev => prev.some(b => b.id === toSave.id) ? prev.map(b => b.id === toSave.id ? toSave : b) : [toSave, ...prev])
      showToast('Beleg gespeichert'); setEditBeleg(null); setSaving(false); return
    }
    try {
      let dateiUrl = toSave.datei_url
      if (uploadFile) {
        const supabase = createSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        dateiUrl = await uploadSteuerBeleg(uploadFile, session?.user.id ?? 'anon')
        setUploadFile(null)
      }
      await upsertSteuerBeleg({ ...toSave, datei_url: dateiUrl })
      setBelege((await getSteuerBelege()) as Beleg[])
      showToast('Beleg gespeichert'); setEditBeleg(null)
    } catch { showToast('Fehler beim Speichern', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteBeleg = async (id: string) => {
    if (isDemo) { setBelege(prev => prev.filter(b => b.id !== id)); setDeleteConfirm(null); showToast('Beleg gelöscht'); return }
    try {
      await deleteSteuerBeleg(id)
      setBelege(prev => prev.filter(b => b.id !== id))
      setDeleteConfirm(null); showToast('Beleg gelöscht')
    } catch { showToast('Fehler beim Löschen', 'error') }
  }

  const handleMarkiereGeprueft = async () => {
    const ust = aktuellUstva?.umsatzsteuer ?? umsatzsteuerRechnungen
    const entry: Ustva = {
      id: `USTVA-${selectedMonat}`, monat: selectedMonat,
      umsatzsteuer: ust,
      vorsteuer: vorsteuerGesamt,
      zahllast: ust - vorsteuerGesamt,
      status: 'geprüft',
    }
    if (isDemo) { setUstva(prev => prev.map(u => u.monat === selectedMonat ? entry : u)); showToast('UStVA als geprüft markiert'); return }
    try {
      await upsertSteuerUstva(entry)
      setUstva((await getSteuerUstva()) as Ustva[])
      showToast('UStVA als geprüft markiert')
    } catch { showToast('Fehler', 'error') }
  }

  // ── Exports ───────────────────────────────────────────────────────────────────

  const handleDatevExport = () => {
    const kontoMap: Record<number, string> = { 0: '8125', 7: '1575', 19: '1576' }
    const rows = [
      ['Datum', 'Lieferant', 'Betrag netto', 'Steuerbetrag', 'Steuersatz %', 'Konto', 'Notiz', 'Status'],
      ...belege.map(b => [b.datum, b.lieferant, String((b.betrag - b.steuerbetrag).toFixed(2)).replace('.', ','), String(b.steuerbetrag.toFixed(2)).replace('.', ','), String(b.steuersatz), kontoMap[b.steuersatz] ?? '1400', b.notiz ?? '', b.status]),
    ]
    downloadCsv(rows, `DATEV_Export_${new Date().toISOString().slice(0, 10)}.csv`)
    showToast('DATEV CSV exportiert')
  }

  const handleMonatExport = () => {
    const c = calcUStVA()
    const rows = [
      ['Monat', 'Einnahmen brutto', 'USt aus Rechnungen', 'VSt aus Belegen', 'Zahllast'],
      [monthLabel(selectedMonat), String(einnahmenMonat.toFixed(2)).replace('.', ','), String(umsatzsteuerGes.toFixed(2)).replace('.', ','), String(vorsteuerBelege.toFixed(2)).replace('.', ','), String(Math.max(0, zahllast).toFixed(2)).replace('.', ',')],
    ]
    downloadCsv(rows, `UStVA_${selectedMonat}.csv`)
    showToast('Monatsexport heruntergeladen')
  }

  const handleElsterExport = () => {
    downloadElsterXml(selectedMonat, umsatzsteuerGes, vorsteuerGesamt)
    showToast('ELSTER-XML exportiert')
  }

  function downloadCsv(rows: string[][], filename: string) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: `3px solid rgba(245,158,11,.25)`, borderTopColor: STEUER_COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!isDemo && !permissions.canViewSteuer) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#aeb9c8' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700 }}>Kein Zugriff</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          Der SteuerPilot ist nur für Admin, Büro und Inhaber zugänglich.
        </div>
      </div>
    )
  }

  const calc = calcUStVA()
  const filteredBelege = belege.filter(b => {
    const ms = !search || b.lieferant.toLowerCase().includes(search.toLowerCase()) || (b.notiz ?? '').toLowerCase().includes(search.toLowerCase())
    const fs = filterStatus === 'Alle' || b.status === filterStatus
    return ms && fs
  })

  // ── Duplizierte Belege erkennen ───────────────────────────────────────────────

  const duplicates = new Set<string>()
  belege.forEach((b, i) => {
    belege.forEach((c, j) => {
      if (i !== j && b.lieferant === c.lieferant && b.betrag === c.betrag && Math.abs(new Date(b.datum).getTime() - new Date(c.datum).getTime()) < 1000 * 60 * 60 * 24 * 7) {
        duplicates.add(b.id); duplicates.add(c.id)
      }
    })
  })

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 900, letterSpacing: '-.03em' }}>
              🧾 <span style={{ color: STEUER_COLOR }}>Steuer</span>Pilot
            </h1>
            <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>
              UStVA · Belege · Fixkosten · Betriebsausgaben · Anschaffungen
              {isDemo && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontSize: 11, fontWeight: 700 }}>DEMO</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="pk-btn" onClick={() => { setTab('belege'); setEditBeleg({}) }} style={{ fontSize: 13 }}>+ Beleg</button>
            <button className="pk-btn-ghost" onClick={handleDatevExport} style={{ fontSize: 13 }}>DATEV Export</button>
          </div>
        </div>
      </div>

      {/* Navigation – horizontale Tab-Bar (alle Screens) */}
      <div className="pk-tab-bar" style={{ marginBottom: 24 }}>
        {NAV_ITEMS.map(n => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: tab === n.id ? 700 : 500,
              background: tab === n.id ? `rgba(245,158,11,.15)` : 'transparent',
              color: tab === n.id ? STEUER_COLOR : '#aeb9c8',
              borderBottom: tab === n.id ? `2px solid ${STEUER_COLOR}` : '2px solid transparent',
              transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{n.icon}</span>
            <span className="hide-xs">{n.label}</span>
            {n.id === 'belege' && warnings.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 800 }}>{warnings.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Dashboard ─────────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div>
          {/* Monatsauswahl */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Betrachtungsmonat</label>
            <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 240 }}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          {/* KPI-Grid */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <KpiCard label="Einnahmen (brutto)" value={fmt(einnahmenMonat)} sub={`${rechnungenMonat.length} Rechnungen`} color="#4ddb7e" onClick={() => setTab('einnahmen')} />
            <KpiCard label="Vorsteuer (VSt)" value={fmt(vorsteuerGesamt)} sub="Belege + Fixkosten + Ausgaben" color="#4ddb7e" onClick={() => setTab('ustva')} />
            <KpiCard label="Umsatzsteuer (USt)" value={fmt(umsatzsteuerGes)} sub="aus Rechnungen" color="#ff8080" onClick={() => setTab('einnahmen')} />
            <KpiCard label="UStVA Zahllast" value={fmt(Math.max(0, zahllast))} sub={zahllast < 0 ? `Erstattung: ${fmt(Math.abs(zahllast))}` : 'ans Finanzamt'} color={STEUER_COLOR} onClick={() => setTab('ustva')} />
          </div>

          {/* UStVA-Status-Karte */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="pk-card" style={{ padding: 20, border: `1px solid ${zahllast >= 0 ? 'rgba(245,158,11,.25)' : 'rgba(37,211,102,.2)'}` }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: STEUER_COLOR }}>📑 UStVA {monthLabel(selectedMonat)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { l: 'Einnahmen netto', v: fmt(rechnungenMonat.reduce((s, r) => s + (r.netto ?? 0), 0)), c: '#f8fbff' },
                  { l: 'Umsatzsteuer (§ 18 UStG)', v: fmt(umsatzsteuerGes), c: '#ff8080' },
                  { l: 'Vorsteuer (§ 15 UStG)', v: fmt(vorsteuerGesamt), c: '#4ddb7e' },
                  { l: zahllast >= 0 ? '→ Zahllast' : '→ Erstattung', v: fmt(Math.abs(zahllast)), c: STEUER_COLOR },
                ].map(row => (
                  <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ color: '#aeb9c8' }}>{row.l}</span>
                    <strong style={{ color: row.c, fontFamily: 'monospace' }}>{row.v}</strong>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="pk-btn" onClick={() => setTab('ustva')} style={{ fontSize: 12 }}>Zur UStVA →</button>
                {aktuellUstva?.status !== 'geprüft' && (
                  <button className="pk-btn-ghost" onClick={handleMarkiereGeprueft} style={{ fontSize: 12 }}>✓ Als geprüft markieren</button>
                )}
              </div>
            </div>

            {/* Warnungen */}
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: warnings.length > 0 ? STEUER_COLOR : '#4ddb7e' }}>
                {warnings.length > 0 ? `⚠️ ${warnings.length} Prüfhinweis${warnings.length > 1 ? 'e' : ''}` : '✅ Alles geprüft'}
              </div>
              {warnings.length === 0 ? (
                <div style={{ fontSize: 13, color: '#aeb9c8' }}>Keine Auffälligkeiten in deinen Belegen gefunden.</div>
              ) : (
                warnings.slice(0, 3).map(w => (
                  <div key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,.03)' }}>
                    <WarnBadge type={w.type} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{w.title}</div>
                      <div style={{ fontSize: 11, color: '#aeb9c8' }}>{w.desc}</div>
                    </div>
                  </div>
                ))
              )}
              {warnings.length > 3 && (
                <button className="pk-btn-ghost" onClick={() => setTab('belege')} style={{ fontSize: 12, marginTop: 4 }}>Alle {warnings.length} anzeigen →</button>
              )}
            </div>
          </div>

          {/* Fälligkeits-Kalender */}
          {(() => {
            const now = new Date()
            const dueDates = [0, 1, 2].map(i => {
              const d = new Date(now.getFullYear(), now.getMonth() - i + 1 + (dauerfristVerlaengerung ? 1 : 0), 10)
              const monat = new Date(now.getFullYear(), now.getMonth() - i, 1)
                .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
              const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              const color = diffDays < 7 ? '#f43f5e' : diffDays < 14 ? '#f59e0b' : '#4ddb7e'
              const label = diffDays < 0 ? 'Überfällig' : diffDays < 7 ? `${diffDays}T (kritisch)` : diffDays < 14 ? `${diffDays}T (bald)` : `${diffDays}T`
              return { monat, datum: d.toLocaleDateString('de-DE'), color, label }
            })
            return (
              <div className="pk-card" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>📅 UStVA-Fälligkeiten (nächste 3 Monate)</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aeb9c8', cursor: 'pointer' }}>
                    <input type="checkbox" checked={dauerfristVerlaengerung} onChange={e => setDauerfristVerlaengerung(e.target.checked)} />
                    Dauerfristverlängerung (+1 Monat)
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {dueDates.map(d => (
                    <div key={d.monat} style={{ padding: '12px 16px', borderRadius: 10, background: d.color + '12', border: `1px solid ${d.color}40` }}>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>UStVA {d.monat}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: d.color }}>📌 {d.datum}</div>
                      <div style={{ fontSize: 11, marginTop: 4, color: d.color, fontWeight: 600 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Schnellzugriff */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>⚡ Schnellzugriff</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {NAV_ITEMS.filter(n => n.id !== 'dashboard').map(n => (
                <button
                  key={n.id}
                  className="pk-btn-ghost"
                  onClick={() => setTab(n.id)}
                  style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {n.icon} {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ausgaben-Übersicht */}
          {(() => {
            const gesamtFixkostenBrutto = fixkosten.filter(f => f.aktiv).reduce((s, f) =>
              s + f.betrag_brutto * faktorForIntervall(f.zahlungsintervall), 0)
            const gesamtBetriebsausgaben = betriebsausgabenMonat.reduce((s, b) => s + b.betrag_brutto, 0)
            const gesamtBelege = belegeMonat.reduce((s, b) => s + b.betrag, 0)
            const gesamtAnschaffungen = anschaffungenMonat.reduce((s, a) => s + a.betrag_brutto, 0)
            const gesamtAusgaben = gesamtFixkostenBrutto + gesamtBetriebsausgaben + gesamtBelege + gesamtAnschaffungen
            return (
              <div className="pk-card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 14 }}>📊 Ausgaben-Übersicht ({monthLabel(selectedMonat)})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { l: 'Fixkosten (monatl.)', v: fmt(gesamtFixkostenBrutto) },
                    { l: 'Betriebsausgaben', v: fmt(gesamtBetriebsausgaben) },
                    { l: 'Belege (Eingang)', v: fmt(gesamtBelege) },
                    { l: 'Anschaffungen', v: fmt(gesamtAnschaffungen) },
                  ].map(row => (
                    <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <span style={{ color: '#aeb9c8' }}>{row.l}</span>
                      <strong style={{ color: '#f8fbff', fontFamily: 'monospace' }}>{row.v}</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '10px 0 0', fontWeight: 700 }}>
                    <span style={{ color: '#f8fbff' }}>Gesamt Ausgaben</span>
                    <strong style={{ color: '#ff8080', fontFamily: 'monospace' }}>{fmt(gesamtAusgaben)}</strong>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Letzte Belege */}
          <div className="pk-card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Letzte Belege ({monthLabel(selectedMonat)})</div>
            {belegeMonat.length === 0 ? (
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Belege für diesen Monat.</div>
            ) : (
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead><tr><th>Datum</th><th>Lieferant</th><th>Betrag</th><th>VSt</th><th>Status</th></tr></thead>
                  <tbody>
                    {belegeMonat.slice(0, 5).map(b => (
                      <tr key={b.id}>
                        <td style={{ fontSize: 12 }}>{new Date(b.datum).toLocaleDateString('de-DE')}</td>
                        <td style={{ fontWeight: 600 }}>{b.lieferant}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmt(b.betrag)}</td>
                        <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(b.steuerbetrag)}</td>
                        <td><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="pk-btn-ghost" onClick={() => setTab('belege')} style={{ fontSize: 12, marginTop: 10 }}>Alle Belege →</button>
          </div>
        </div>
      )}

      {/* ── Einnahmen ─────────────────────────────────────────────────────────── */}
      {tab === 'einnahmen' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Monat</label>
            <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 240 }}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <KpiCard label="Einnahmen brutto" value={fmt(einnahmenMonat)} sub={`${rechnungenMonat.length} Rechnungen`} color="#4ddb7e" />
            <KpiCard label="Stripe-Zahlungen" value={fmt(stripeMonatSumme)} sub={`${stripeMonat.length} Zahlung${stripeMonat.length !== 1 ? 'en' : ''}`} color="#a78bfa" />
            <KpiCard label="Umsatzsteuer" value={fmt(umsatzsteuerRechnungen)} sub="§ 18 UStG zu zahlen" color="#ff8080" />
            <KpiCard label="Offen / Bezahlt" value={`${rechnungenMonat.filter(r => r.status !== 'bezahlt').length} / ${rechnungenMonat.filter(r => r.status === 'bezahlt').length}`} sub="Rechnungen" />
          </div>

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Rechnungen {monthLabel(selectedMonat)}</div>

          {rechnungenMonat.length === 0 ? (
            <div className="pk-card" style={{ padding: 40, textAlign: 'center', color: '#aeb9c8' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💰</div>
              <div>Keine Rechnungen für {monthLabel(selectedMonat)}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Rechnungen werden aus dem BüroPilot übernommen.</div>
            </div>
          ) : (
            <div className="pk-card" style={{ padding: 0 }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr><th>Nummer</th><th>Kunde</th><th>Datum</th><th>Brutto</th><th>Netto</th><th>USt</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rechnungenMonat.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontSize: 12, color: '#aeb9c8' }}>{r.nummer ?? r.id}</td>
                        <td style={{ fontWeight: 600 }}>{r.kunde ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>{r.erstellt ? new Date(r.erstellt).toLocaleDateString('de-DE') : '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(r.summe ?? 0)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fmt(r.netto ?? 0)}</td>
                        <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(r.steuerbetrag ?? 0)}</td>
                        <td><StatusBadge status={r.status ?? 'offen'} /></td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(37,211,102,.05)', fontWeight: 700 }}>
                      <td colSpan={3}>Gesamt {monthLabel(selectedMonat)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(einnahmenMonat)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmt(rechnungenMonat.reduce((s, r) => s + (r.netto ?? 0), 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(umsatzsteuerRechnungen)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Stripe-Zahlungen */}
          {stripeMonat.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                💳 Stripe-Zahlungen {monthLabel(selectedMonat)}
                <span className="badge badge-purple">{stripeMonat.length}</span>
              </div>
              <div className="pk-card" style={{ padding: 0 }}>
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr><th>Datum</th><th>Referenz</th><th>Betrag</th></tr>
                    </thead>
                    <tbody>
                      {stripeMonat.map(z => (
                        <tr key={z.id}>
                          <td style={{ fontSize: 12 }}>{z.booked_at ? new Date(z.booked_at).toLocaleDateString('de-DE') : '—'}</td>
                          <td style={{ fontSize: 12, color: '#aeb9c8', fontFamily: 'monospace' }}>{z.provider_ref ?? z.id}</td>
                          <td style={{ fontFamily: 'monospace', color: '#a78bfa', fontWeight: 700 }}>{fmt(z.amount)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'rgba(167,139,250,.05)', fontWeight: 700 }}>
                        <td colSpan={2}>Gesamt Stripe {monthLabel(selectedMonat)}</td>
                        <td style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{fmt(stripeMonatSumme)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {stripeZahlungen.length === 0 && (
            <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)', fontSize: 12, color: '#a78bfa' }}>
              💳 Keine Stripe-Zahlungen verknüpft. Zahlungen erscheinen hier sobald Stripe-Integration aktiv ist.
            </div>
          )}
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.2)', fontSize: 12, color: '#4ddb7e' }}>
            ℹ️ Einnahmen werden direkt aus dem BüroPilot übernommen. Rechnungen dort bearbeiten.
          </div>
        </div>
      )}

      {/* ── Belege ────────────────────────────────────────────────────────────── */}
      {tab === 'belege' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Eingangsbelege ({filteredBelege.length})</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>Alle steuerrelevanten Eingangsbelege und Quittungen</div>
            </div>
            <button className="pk-btn" onClick={() => setEditBeleg({})} style={{ fontSize: 13 }}>+ Beleg erfassen</button>
          </div>

          {/* Duplikat-Warnung */}
          {duplicates.size > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.3)', fontSize: 12, color: '#ff8080' }}>
              ⚠️ {duplicates.size / 2} mögliche{duplicates.size / 2 > 1 ? ' Duplikate' : 's Duplikat'} erkannt (gleicher Lieferant, gleicher Betrag, ±7 Tage). Bitte prüfen.
            </div>
          )}

          {/* Filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input className="pk-input" placeholder="Lieferant oder Notiz suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
            <select className="pk-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="Alle">Alle Status</option>
              <option value="offen">Offen</option>
              <option value="geprüft">Geprüft</option>
              <option value="exportiert">Exportiert</option>
            </select>
          </div>

          {/* ── Beleg-Upload mit Kategorie ──────────────────────────────────────── */}
          {(() => {
            const KATEGORIEN = ['Fixkosten', 'Betriebsausgaben', 'Anschaffung', 'Sonstiges'] as const

            const handleUploadSave = async () => {
              if (!uploadFile2) { showToast('Bitte eine Datei auswählen', 'error'); return }
              setUploadSaving(true)
              try {
                const supabase = createSupabaseClient()
                const { data: { session } } = await supabase.auth.getSession()
                const userId = session?.user.id ?? 'anon'
                let dateiUrl: string | undefined
                if (!isDemo) {
                  dateiUrl = await uploadSteuerBelegFile(uploadFile2, userId)
                }
                const entry: SteuerBelegUpload = {
                  id: `BU-${Date.now().toString(36).toUpperCase()}`,
                  kategorie: uploadForm.kategorie as SteuerBelegUpload['kategorie'],
                  datei_url: dateiUrl,
                  betrag: uploadForm.betrag ? parseFloat(uploadForm.betrag.replace(',', '.')) : null,
                  datum: uploadForm.datum || null,
                  notiz: uploadForm.notiz || null,
                }
                if (!isDemo) {
                  await upsertSteuerBelegUpload(entry)
                  setBelegUploads(await getSteuerBelegUploads())
                } else {
                  setBelegUploads(prev => [entry, ...prev])
                }
                setUploadForm({ kategorie: 'Sonstiges', betrag: '', datum: new Date().toISOString().split('T')[0], notiz: '' })
                setUploadFile2(null)
                if (uploadFileRef.current) uploadFileRef.current.value = ''
                showToast('Beleg hochgeladen')
              } catch { showToast('Upload fehlgeschlagen', 'error') }
              finally { setUploadSaving(false) }
            }

            const handleDeleteUpload = async (id: string) => {
              if (isDemo) { setBelegUploads(prev => prev.filter(u => u.id !== id)); setDeleteUploadConfirm(null); showToast('Beleg gelöscht'); return }
              try {
                await deleteSteuerBelegUpload(id)
                setBelegUploads(prev => prev.filter(u => u.id !== id))
                setDeleteUploadConfirm(null); showToast('Beleg gelöscht')
              } catch { showToast('Fehler beim Löschen', 'error') }
            }

            const filteredUploads = belegUploads.filter(u => filterKategorie === 'Alle' || u.kategorie === filterKategorie)

            return (
              <div style={{ marginTop: 24 }}>
                {/* Upload-Formular */}
                <div className="pk-card" style={{ padding: 20, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📎 Beleg hochladen</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Kategorie</label>
                      <select className="pk-input" value={uploadForm.kategorie} onChange={e => setUploadForm(p => ({ ...p, kategorie: e.target.value }))}>
                        {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Betrag (€)</label>
                      <input className="pk-input" type="text" inputMode="decimal" placeholder="0,00" value={uploadForm.betrag} onChange={e => setUploadForm(p => ({ ...p, betrag: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Datum</label>
                      <input className="pk-input" type="date" value={uploadForm.datum} onChange={e => setUploadForm(p => ({ ...p, datum: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notiz</label>
                      <input className="pk-input" placeholder="Optional" value={uploadForm.notiz} onChange={e => setUploadForm(p => ({ ...p, notiz: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Datei *</label>
                      <input ref={uploadFileRef} type="file" accept="image/*,application/pdf" className="pk-input" style={{ fontSize: 12 }} onChange={e => setUploadFile2(e.target.files?.[0] ?? null)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                    <button className="pk-btn" onClick={handleUploadSave} disabled={uploadSaving} style={{ fontSize: 13 }}>{uploadSaving ? 'Hochladen…' : '⬆ Hochladen'}</button>
                  </div>
                </div>

                {/* Kategorie-Filter */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {['Alle', 'Fixkosten', 'Betriebsausgaben', 'Anschaffung', 'Sonstiges'].map(k => (
                    <button
                      key={k}
                      onClick={() => setFilterKategorie(k)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: filterKategorie === k ? 700 : 500,
                        background: filterKategorie === k ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.05)',
                        color: filterKategorie === k ? STEUER_COLOR : '#aeb9c8',
                      }}
                    >{k} {k !== 'Alle' && `(${belegUploads.filter(u => u.kategorie === k).length})`}</button>
                  ))}
                </div>

                {/* Upload-Tabelle */}
                <div className="pk-card" style={{ padding: 0 }}>
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr><th>Datum</th><th>Kategorie</th><th>Betrag</th><th>Notiz</th><th>Datei</th><th></th></tr>
                      </thead>
                      <tbody>
                        {filteredUploads.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontSize: 12 }}>{u.datum ? new Date(u.datum).toLocaleDateString('de-DE') : '—'}</td>
                            <td><span className="badge badge-orange">{u.kategorie}</span></td>
                            <td style={{ fontFamily: 'monospace' }}>{u.betrag != null ? fmt(u.betrag) : '—'}</td>
                            <td style={{ fontSize: 12, color: '#aeb9c8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.notiz ?? '—'}</td>
                            <td>
                              {u.datei_url
                                ? <a href={u.datei_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1684ff' }}>📎 Ansehen</a>
                                : <span style={{ fontSize: 12, color: '#4a5568' }}>—</span>}
                            </td>
                            <td>
                              {deleteUploadConfirm === u.id ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleDeleteUpload(u.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                                  <button onClick={() => setDeleteUploadConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Nein</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteUploadConfirm(u.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>🗑️</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredUploads.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aeb9c8', padding: 28 }}>Noch keine Uploads in dieser Kategorie</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="pk-card" style={{ padding: 0 }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Datum</th><th>Lieferant</th><th>Betrag</th><th>VSt</th><th>Satz</th><th>Status</th><th>Notiz</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredBelege.map(b => (
                    <tr key={b.id} style={{ background: duplicates.has(b.id) ? 'rgba(255,80,80,.04)' : undefined }}>
                      <td style={{ fontSize: 12 }}>{new Date(b.datum).toLocaleDateString('de-DE')}</td>
                      <td style={{ fontWeight: 600 }}>
                        {b.lieferant}
                        {b.datei_url && <a href={b.datei_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#1684ff' }}>📎</a>}
                        {duplicates.has(b.id) && <span style={{ marginLeft: 6, fontSize: 10, color: '#ff8080' }}>⚠ Duplikat?</span>}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{fmt(b.betrag)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(b.steuerbetrag)}</td>
                      <td><span className="badge badge-blue">{b.steuersatz}%</span></td>
                      <td>
                        <select
                          value={b.status}
                          onChange={async e => {
                            const updated = { ...b, status: e.target.value as Beleg['status'] }
                            if (isDemo) { setBelege(prev => prev.map(x => x.id === b.id ? updated : x)); return }
                            try { await upsertSteuerBeleg(updated); setBelege(prev => prev.map(x => x.id === b.id ? updated : x)) }
                            catch { showToast('Fehler', 'error') }
                          }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: b.status === 'geprüft' ? '#4ddb7e' : b.status === 'exportiert' ? '#aeb9c8' : '#f59e0b', fontWeight: 600, fontSize: 12 }}
                        >
                          <option value="offen">Offen</option>
                          <option value="geprüft">Geprüft</option>
                          <option value="exportiert">Exportiert</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 12, color: '#aeb9c8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notiz}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditBeleg(b)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>✏️</button>
                          {deleteConfirm === b.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 10, color: '#f59e0b' }}>§ 147 AO: 10 Jahre Aufbewahrungspflicht</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleDeleteBeleg(b.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                                <button onClick={() => setDeleteConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Nein</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(b.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBelege.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: '#aeb9c8', padding: 32 }}>Keine Belege gefunden</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixkosten ─────────────────────────────────────────────────────────── */}
      {tab === 'fixkosten' && <SteuerFixkostenTab isDemo={isDemo} showToast={showToast} />}

      {/* ── Betriebsausgaben ──────────────────────────────────────────────────── */}
      {tab === 'betriebsausgaben' && <SteuerBetriebsausgabenTab isDemo={isDemo} showToast={showToast} />}

      {/* ── Anschaffungen ─────────────────────────────────────────────────────── */}
      {tab === 'anschaffungen' && <SteuerAnschaffungenTab isDemo={isDemo} showToast={showToast} />}

      {/* ── UStVA ─────────────────────────────────────────────────────────────── */}
      {tab === 'ustva' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Monat</label>
              <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ minWidth: 200 }}>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
            <button className="pk-btn" onClick={handleMarkiereGeprueft} style={{ fontSize: 13 }}>✓ Als geprüft markieren</button>
            <button className="pk-btn-ghost" onClick={handleMonatExport} style={{ fontSize: 13 }}>📥 CSV-Export</button>
            <button className="pk-btn-ghost" onClick={handleElsterExport} style={{ fontSize: 13 }}>📥 ELSTER-XML exportieren</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Einnahmen */}
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: '#4ddb7e' }}>💰 Einnahmen (Ausgang)</div>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(37,211,102,.05)', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Rechnungen {monthLabel(selectedMonat)}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#4ddb7e' }}>{fmt(einnahmenMonat)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                <span style={{ color: '#aeb9c8' }}>Umsatzsteuer (§ 18)</span>
                <strong style={{ color: '#ff8080', fontFamily: 'monospace' }}>{fmt(umsatzsteuerGes)}</strong>
              </div>
              {aktuellUstva && <div style={{ marginTop: 8, fontSize: 12, color: '#aeb9c8' }}>Status: <StatusBadge status={aktuellUstva.status} /></div>}
            </div>

            {/* Vorsteuer */}
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: '#4ddb7e' }}>🧾 Vorsteuer (Eingang)</div>
              {/* Belege nach Steuersatz */}
              {[7, 19].map(satz => {
                const b = belegeMonat.filter(b => b.steuersatz === satz)
                const nettoSum = b.reduce((s, x) => s + (x.betrag - x.steuerbetrag), 0)
                const steuSum = b.reduce((s, x) => s + x.steuerbetrag, 0)
                if (b.length === 0) return null
                return (
                  <div key={satz} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>{satz}% – Belege ({b.length})</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13 }}>Netto: <strong>{fmt(nettoSum)}</strong></span>
                      <span style={{ fontSize: 13, color: '#4ddb7e' }}>VSt: <strong>{fmt(steuSum)}</strong></span>
                    </div>
                  </div>
                )
              })}
              {/* Fixkosten — VSt Fixkosten */}
              <div style={{ padding: '8px 12px', borderRadius: 8, background: vorsteuerFixkosten > 0 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.01)', marginBottom: 8, border: vorsteuerFixkosten > 0 ? '1px solid rgba(77,219,126,.15)' : '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>VSt Fixkosten (mtl. Anteil, aktiv)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{fixkosten.filter(f => f.aktiv).length} Positionen aktiv</span>
                  <span style={{ fontSize: 13, color: '#4ddb7e' }}>VSt: <strong>{fmt(vorsteuerFixkosten)}</strong></span>
                </div>
              </div>
              {/* Betriebsausgaben */}
              {vorsteuerBetriebsAusg > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Betriebsausgaben ({betriebsausgabenMonat.length})</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>Brutto: <strong>{fmt(betriebsausgabenMonat.reduce((s, b) => s + b.betrag_brutto, 0))}</strong></span>
                    <span style={{ fontSize: 13, color: '#4ddb7e' }}>VSt: <strong>{fmt(vorsteuerBetriebsAusg)}</strong></span>
                  </div>
                </div>
              )}
              {/* Anschaffungen */}
              {vorsteuerAnschaffungen > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Anschaffungen ({anschaffungenMonat.length})</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>Brutto: <strong>{fmt(anschaffungenMonat.reduce((s, a) => s + a.betrag_brutto, 0))}</strong></span>
                    <span style={{ fontSize: 13, color: '#4ddb7e' }}>VSt: <strong>{fmt(vorsteuerAnschaffungen)}</strong></span>
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Vorsteuer gesamt (§ 15)</span>
                <span style={{ color: '#4ddb7e', fontFamily: 'monospace' }}>{fmt(vorsteuerGesamt)}</span>
              </div>
            </div>

            {/* Zahllast */}
            <div className="pk-card" style={{ padding: 20, border: `1px solid rgba(245,158,11,.3)` }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: STEUER_COLOR }}>📑 Zahllast / Erstattung</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: zahllast >= 0 ? STEUER_COLOR : '#4ddb7e' }}>
                {zahllast >= 0 ? '' : '–'}{fmt(Math.abs(zahllast))}
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginTop: 6 }}>
                {zahllast >= 0 ? '→ Zahlung ans Finanzamt' : '→ Erstattung vom Finanzamt'}
              </div>
              <div style={{ fontSize: 12, color: '#4a5568', marginTop: 8 }}>
                {fmt(umsatzsteuerGes)} USt − {fmt(vorsteuerGesamt)} VSt
              </div>
              <div style={{ marginTop: 12 }}>
                {zahllast < 0 && <span className="badge badge-green">Erstattung</span>}
                {zahllast >= 0 && zahllast < 500 && <span className="badge badge-green">Gering</span>}
                {zahllast >= 500 && zahllast < 2000 && <span className="badge badge-orange">Mittel</span>}
                {zahllast >= 2000 && <span className="badge badge-red">Hoch</span>}
              </div>
            </div>
          </div>

          {/* Verlauf */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>UStVA-Verlauf</div>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead><tr><th>Monat</th><th>Einnahmen</th><th>Umsatzsteuer</th><th>Vorsteuer</th><th>Zahllast</th><th>Status</th></tr></thead>
                <tbody>
                  {ustva.map(u => (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedMonat(u.monat)}>
                      <td style={{ fontWeight: 600 }}>{monthLabel(u.monat)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(rechnungen.filter(r => (r.erstellt ?? '').startsWith(u.monat)).reduce((s, r) => s + (r.summe ?? 0), 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(u.umsatzsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(u.vorsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: STEUER_COLOR, fontWeight: 700 }}>{fmt(u.zahllast)}</td>
                      <td><StatusBadge status={u.status} /></td>
                    </tr>
                  ))}
                  {ustva.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aeb9c8', padding: 24 }}>Noch keine UStVA-Daten. Beleg erfassen und Als geprüft markieren klicken.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Auswertungen ──────────────────────────────────────────────────────── */}
      {tab === 'auswertungen' && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📈 Monats- & Jahresauswertung</div>

          {/* Monatlicher Verlauf */}
          {ustva.length > 0 && (
            <div className="pk-card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>UStVA Verlauf (Balkendiagramm)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...ustva].reverse().map(u => ({ monat: monthLabel(u.monat), USt: u.umsatzsteuer, VSt: u.vorsteuer }))}>
                  <XAxis dataKey="monat" tick={{ fontSize: 11, fill: '#aeb9c8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#aeb9c8' }} />
                  <Tooltip
                    formatter={(value) => [typeof value === 'number' ? fmt(value) : value]}
                    contentStyle={{ background: '#101a28', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#f8fbff', fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#aeb9c8' }} />
                  <Bar dataKey="USt" fill="#ff8080" radius={[3, 3, 0, 0]} name="Umsatzsteuer" />
                  <Bar dataKey="VSt" fill="#4ddb7e" radius={[3, 3, 0, 0]} name="Vorsteuer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Jahrestabelle */}
          <div className="pk-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Jahresübersicht</div>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Monat</th><th>Einnahmen</th><th>USt</th><th>VSt</th><th>Zahllast</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {ustva.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{monthLabel(u.monat)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(rechnungen.filter(r => (r.erstellt ?? '').startsWith(u.monat)).reduce((s, r) => s + (r.summe ?? 0), 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(u.umsatzsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(u.vorsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: u.zahllast < 0 ? '#4ddb7e' : STEUER_COLOR, fontWeight: 700 }}>
                        {u.zahllast < 0 ? `–${fmt(Math.abs(u.zahllast))}` : fmt(u.zahllast)}
                      </td>
                      <td><StatusBadge status={u.status} /></td>
                    </tr>
                  ))}
                  {ustva.length > 0 && (
                    <tr style={{ fontWeight: 700, background: 'rgba(245,158,11,.06)' }}>
                      <td>Gesamt</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(rechnungen.reduce((s, r) => s + (r.summe ?? 0), 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(ustva.reduce((s, u) => s + u.umsatzsteuer, 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(ustva.reduce((s, u) => s + u.vorsteuer, 0))}</td>
                      <td style={{ fontFamily: 'monospace', color: STEUER_COLOR }}>{fmt(ustva.reduce((s, u) => s + u.zahllast, 0))}</td>
                      <td />
                    </tr>
                  )}
                  {ustva.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aeb9c8', padding: 24 }}>Noch keine UStVA-Daten vorhanden.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Belege nach Kategorie */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Vorsteuer nach Steuersatz (alle Belege)</div>
            {[0, 7, 19].map(satz => {
              const b = belege.filter(x => x.steuersatz === satz)
              const total = b.reduce((s, x) => s + x.steuerbetrag, 0)
              return (
                <div key={satz} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span className="badge badge-blue" style={{ minWidth: 36, textAlign: 'center' }}>{satz}%</span>
                  <div style={{ flex: 1, fontSize: 12, color: '#aeb9c8' }}>{b.length} Belege</div>
                  <strong style={{ fontFamily: 'monospace', color: '#4ddb7e', minWidth: 90, textAlign: 'right' }}>{fmt(total)}</strong>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Export ────────────────────────────────────────────────────────────── */}
      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📤 Exporte & Downloads</div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📤 DATEV CSV Export</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 16 }}>
              Exportiert alle Belege im DATEV-kompatiblen CSV-Format mit Konto-Mapping, Steuerbeträgen und Belegdaten.
            </div>
            <button className="pk-btn" onClick={handleDatevExport} style={{ fontSize: 14 }}>
              📥 DATEV CSV herunterladen ({belege.length} Belege)
            </button>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📋 UStVA Monatsexport</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 16 }}>
              Exportiert die UStVA-Berechnung für einen Monat mit Einnahmen, USt, VSt und Zahllast.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 220 }}>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <button className="pk-btn" onClick={handleMonatExport} style={{ fontSize: 14 }}>
                📥 {monthLabel(selectedMonat)} exportieren
              </button>
            </div>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🗂️ Konto-Mapping (DATEV)</div>
            <table className="pk-table">
              <thead><tr><th>Steuersatz</th><th>Konto</th><th>Beschreibung</th></tr></thead>
              <tbody>
                <tr><td><span className="badge badge-gray">0%</span></td><td style={{ fontFamily: 'monospace' }}>8125</td><td style={{ color: '#aeb9c8' }}>Steuerfreie Umsätze</td></tr>
                <tr><td><span className="badge badge-blue">7%</span></td><td style={{ fontFamily: 'monospace' }}>1575</td><td style={{ color: '#aeb9c8' }}>Vorsteuer 7%</td></tr>
                <tr><td><span className="badge badge-orange">19%</span></td><td style={{ fontFamily: 'monospace' }}>1576</td><td style={{ color: '#aeb9c8' }}>Vorsteuer 19%</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', fontSize: 12, color: '#ffb347' }}>
              ⚠️ Dies ist kein Steuerberatungsmodul. Die Kontierung dient als Arbeitshilfe. Bitte mit Ihrem Steuerberater abstimmen.
            </div>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📥 ELSTER-XML Export (UStVA)</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 16 }}>
              Exportiert die UStVA-Voranmeldung als ELSTER-XML mit Kennzahlen 81 (USt) und 83 (VSt) für den gewählten Monat.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 220 }}>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <button className="pk-btn" onClick={handleElsterExport} style={{ fontSize: 14 }}>
                📥 ELSTER-XML exportieren
              </button>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', fontSize: 12, color: '#ffb347' }}>
              ⚠️ Dies ist ein Vorbereitungsdokument (§§ 81/83 UStG). Bitte mit Ihrem Steuerberater abstimmen. Keine direkte ELSTER-Übertragung.
            </div>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🔮 Geplante Exporte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Steuerberater-Export', desc: 'Vollständiges Belegpaket als ZIP (in Vorbereitung)', soon: true },
                { label: 'SKR 03 / SKR 04 Export', desc: 'Buchungsexport für Kanzleisoftware (geplant)', soon: true },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.03)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>{item.desc}</div>
                  </div>
                  {item.soon && <span className="badge badge-gray">Bald</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Prüfungen (als Overlay-Tab für Belege) ────────────────────────────── */}
      {tab === 'belege' && warnings.length > 0 && (
        <div className="pk-card" style={{ padding: 20, marginTop: 16, border: '1px solid rgba(245,158,11,.25)' }}>
          <div style={{ fontWeight: 700, marginBottom: 14, color: STEUER_COLOR }}>⚠️ KI-Prüfungen ({warnings.length})</div>
          {warnings.map(w => (
            <div key={w.id} className="pk-card" style={{ padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: `3px solid ${w.type === 'error' ? '#ff5050' : w.type === 'warn' ? '#f59e0b' : '#1684ff'}` }}>
              <WarnBadge type={w.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.title}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8' }}>{w.desc}</div>
              </div>
              {w.link && <a href={w.link} style={{ fontSize: 12, color: '#6cb6ff' }}>→ Öffnen</a>}
            </div>
          ))}

          {/* Monatsabschluss-Checkliste */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>📋 Monatsabschluss-Checkliste</div>
            {[
              { label: 'Belege für diesen Monat erfasst', done: belegeMonat.length > 0 },
              { label: 'Alle Belege geprüft', done: belegeMonat.every(b => b.status !== 'offen') },
              { label: 'UStVA berechnet', done: !!aktuellUstva },
              { label: 'UStVA als geprüft markiert', done: aktuellUstva?.status === 'geprüft' },
              { label: 'DATEV-Export erstellt', done: belegeMonat.some(b => b.status === 'exportiert') },
              { label: 'Fixkosten für diesen Monat geprüft', done: fixkosten.filter(f => f.aktiv).length > 0 },
              { label: 'Betriebsausgaben für diesen Monat erfasst', done: betriebsausgabenMonat.length > 0 },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span style={{ fontSize: 15 }}>{item.done ? '✅' : '⬜'}</span>
                <span style={{ fontSize: 13, color: item.done ? '#4ddb7e' : '#aeb9c8' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Beleg Modal ──────────────────────────────────────────────────── */}
      {editBeleg !== null && (
        <Modal title={editBeleg.id ? 'Beleg bearbeiten' : 'Neuer Beleg'} onClose={() => setEditBeleg(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Lieferant *</label>
              <input className="pk-input" placeholder="z.B. Büromaterial GmbH" value={editBeleg.lieferant ?? ''} onChange={e => setEditBeleg(p => ({ ...p, lieferant: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Bruttobetrag (€) *</label>
                <input className="pk-input" type="text" inputMode="decimal" placeholder="0,00" value={editBeleg.betrag != null ? String(editBeleg.betrag) : ''} onChange={e => {
                  const raw = e.target.value
                  setEditBeleg(p => {
                    const normalized = raw.replace(',', '.')
                    const brutto = parseFloat(normalized)
                    const validBrutto = Number.isFinite(brutto) ? brutto : undefined
                    const satz = Number(p?.steuersatz ?? 19)
                    const steuer = validBrutto != null && satz > 0 ? Math.round(validBrutto / (1 + satz / 100) * (satz / 100) * 100) / 100 : (p?.steuerbetrag ?? 0)
                    return { ...p, betrag: validBrutto, steuerbetrag: validBrutto != null ? steuer : p?.steuerbetrag }
                  })
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Steuerbetrag (€)</label>
                <input className="pk-input" type="text" inputMode="decimal" placeholder="0,00" value={editBeleg.steuerbetrag != null ? String(editBeleg.steuerbetrag) : ''} onChange={e => {
                  const normalized = e.target.value.replace(',', '.')
                  const val = parseFloat(normalized)
                  setEditBeleg(p => ({ ...p, steuerbetrag: Number.isFinite(val) ? val : undefined }))
                }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Steuersatz</label>
                <select className="pk-input" value={editBeleg.steuersatz ?? 19} onChange={e => {
                  const satz = Number(e.target.value)
                  const brutto = Number(editBeleg.betrag ?? 0)
                  const steuer = satz > 0 ? Math.round(brutto / (1 + satz / 100) * (satz / 100) * 100) / 100 : 0
                  setEditBeleg(p => ({ ...p, steuersatz: satz, steuerbetrag: steuer }))
                }}>
                  {STEUERSAETZE.map(s => <option key={s} value={s}>{s}%</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Datum *</label>
                <input className="pk-input" type="date" value={editBeleg.datum ?? new Date().toISOString().split('T')[0]} onChange={e => setEditBeleg(p => ({ ...p, datum: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="pk-input" value={editBeleg.status ?? 'offen'} onChange={e => setEditBeleg(p => ({ ...p, status: e.target.value as Beleg['status'] }))}>
                  <option value="offen">Offen</option>
                  <option value="geprüft">Geprüft</option>
                  <option value="exportiert">Exportiert</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Beleg (Datei)</label>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="pk-input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                {editBeleg.datei_url && !uploadFile && <a href={editBeleg.datei_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1684ff', display: 'block', marginTop: 4 }}>Beleg ansehen →</a>}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notiz</label>
              <input className="pk-input" placeholder="Kommentar zum Beleg" value={editBeleg.notiz ?? ''} onChange={e => setEditBeleg(p => ({ ...p, notiz: e.target.value }))} />
            </div>
            {(editBeleg.betrag ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ color: '#aeb9c8' }}>Netto: <strong style={{ color: '#f8fbff' }}>{fmt((editBeleg.betrag ?? 0) - (editBeleg.steuerbetrag ?? 0))}</strong></span>
                <span style={{ color: '#aeb9c8' }}>Vorsteuer: <strong style={{ color: '#4ddb7e' }}>{fmt(editBeleg.steuerbetrag ?? 0)}</strong></span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="pk-btn-ghost" onClick={() => setEditBeleg(null)} style={{ fontSize: 13 }}>Abbrechen</button>
              <button className="pk-btn" onClick={handleSaveBeleg} disabled={saving} style={{ fontSize: 13 }}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast msg={toast} type={toastType} />
    </div>
  )
}
