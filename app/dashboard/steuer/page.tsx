'use client'
import { useEffect, useRef, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { getSteuerBelege, upsertSteuerBeleg, deleteSteuerBeleg, getSteuerUstva, upsertSteuerUstva, uploadSteuerBeleg } from '@/lib/db'
import { createSupabaseClient } from '@/lib/supabase'
import { getSteuerWarnings, type Warning } from '@/lib/warnings'

// ── Types ──────────────────────────────────────────────────────────────────────

type Beleg = {
  id: string
  lieferant: string
  betrag: number
  steuerbetrag: number
  steuersatz: number
  datum: string
  status: 'offen' | 'geprüft' | 'exportiert'
  datei_url?: string
  notiz?: string
}

type Ustva = {
  id: string
  monat: string
  umsatzsteuer: number
  vorsteuer: number
  zahllast: number
  status: 'offen' | 'geprüft'
}

type SteuerTab = 'uebersicht' | 'belege' | 'ustva' | 'pruefungen' | 'export'

// ── Helpers ────────────────────────────────────────────────────────────────────

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

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

const STEUER_COLOR = '#f59e0b'
const STEUERSAETZE = [0, 7, 19]

// ── Demo-Daten ─────────────────────────────────────────────────────────────────

const demoMonate = ['2025-04', '2025-03', '2025-02', '2025-01']

const demoBelege: Beleg[] = [
  { id: 'BLG-001', lieferant: 'Büromaterial GmbH', betrag: 238.00, steuerbetrag: 38.00, steuersatz: 19, datum: '2025-04-05', status: 'geprüft', notiz: 'Druckerpapier & Toner' },
  { id: 'BLG-002', lieferant: 'Tanke Nord AG', betrag: 480.00, steuerbetrag: 76.64, steuersatz: 19, datum: '2025-04-08', status: 'geprüft', notiz: 'Diesel Firmenfahrzeug' },
  { id: 'BLG-003', lieferant: 'Tanke Nord AG', betrag: 480.00, steuerbetrag: 76.64, steuersatz: 19, datum: '2025-04-08', status: 'offen', notiz: 'ACHTUNG: möglicher Duplikat' },
  { id: 'BLG-004', lieferant: 'IT Solutions UG', betrag: 119.00, steuerbetrag: 19.00, steuersatz: 19, datum: '2025-04-12', status: 'exportiert' },
  { id: 'BLG-005', lieferant: 'Lebensmittel Großhandel', betrag: 107.00, steuerbetrag: 7.00, steuersatz: 7, datum: '2025-04-18', status: 'offen', notiz: 'Kantinenbedarf' },
  { id: 'BLG-006', lieferant: 'Versicherung GmbH', betrag: 850.00, steuerbetrag: 0, steuersatz: 0, datum: '2025-04-01', status: 'geprüft', notiz: 'Betriebshaftpflicht' },
  { id: 'BLG-007', lieferant: 'Werkzeug Depot', betrag: 595.00, steuerbetrag: 95.00, steuersatz: 19, datum: '2025-03-22', status: 'exportiert' },
]

const demoUstva: Ustva[] = [
  { id: 'USTVA-2025-04', monat: '2025-04', umsatzsteuer: 4750.00, vorsteuer: 282.28, zahllast: 4467.72, status: 'offen' },
  { id: 'USTVA-2025-03', monat: '2025-03', umsatzsteuer: 3980.00, vorsteuer: 95.00, zahllast: 3885.00, status: 'geprüft' },
  { id: 'USTVA-2025-02', monat: '2025-02', umsatzsteuer: 5210.00, vorsteuer: 310.00, zahllast: 4900.00, status: 'geprüft' },
  { id: 'USTVA-2025-01', monat: '2025-01', umsatzsteuer: 4100.00, vorsteuer: 220.00, zahllast: 3880.00, status: 'geprüft' },
]

// ── Sub-Components ─────────────────────────────────────────────────────────────

function Toast({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  if (!msg) return null
  const isErr = type === 'error'
  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
      padding: '14px 20px', borderRadius: 12, maxWidth: 360,
      background: isErr ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${isErr ? 'rgba(255,80,80,.4)' : 'rgba(37,211,102,.35)'}`,
      color: isErr ? '#ff8080' : '#4ddb7e',
      fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
    }}>{msg}</div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    offen:      { label: 'Offen',      cls: 'badge badge-orange' },
    geprüft:    { label: 'Geprüft',    cls: 'badge badge-green' },
    exportiert: { label: 'Exportiert', cls: 'badge badge-gray' },
  }
  const s = map[status] ?? { label: status, cls: 'badge badge-gray' }
  return <span className={s.cls}>{s.label}</span>
}

function WarnBadge({ type }: { type: Warning['type'] }) {
  const map = { error: { cls: 'badge badge-red', label: 'Fehler' }, warn: { cls: 'badge badge-orange', label: 'Warnung' }, info: { cls: 'badge badge-blue', label: 'Info' }, success: { cls: 'badge badge-green', label: 'OK' } }
  const s = map[type]
  return <span className={s.cls}>{s.label}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pk-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f8fbff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SteuerPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<SteuerTab>('uebersicht')
  const [belege, setBelege] = useState<Beleg[]>([])
  const [ustva, setUstva] = useState<Ustva[]>([])
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [selectedMonat, setSelectedMonat] = useState(currentMonthStr())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editBeleg, setEditBeleg] = useState<Partial<Beleg> | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3500)
  }

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      if (isDemo) {
        setBelege(demoBelege)
        setUstva(demoUstva)
        const w = await getSteuerWarnings(true)
        setWarnings(w)
        setLoading(false)
        return
      }
      try {
        const [b, u, w] = await Promise.all([getSteuerBelege(), getSteuerUstva(), getSteuerWarnings(false)])
        setBelege(b as Beleg[])
        setUstva(u as Ustva[])
        setWarnings(w)
      } catch { showToast('Daten konnten nicht geladen werden', 'error') }
      finally { setLoading(false) }
    }
    load()
  }, [isDemo])

  // ── KPI-Berechnungen ──────────────────────────────────────────────────────────

  const aktuellUstva = ustva.find(u => u.monat === selectedMonat)
  const belegeAktuell = belege.filter(b => b.datum.startsWith(selectedMonat))
  const vorsteuerGes = belegeAktuell.reduce((s, b) => s + (b.steuerbetrag ?? 0), 0)
  const umsatzsteuerGes = aktuellUstva?.umsatzsteuer ?? 0
  const zahllast = umsatzsteuerGes - vorsteuerGes

  const alleUmsatz = ustva.find(u => u.monat === selectedMonat)?.umsatzsteuer ?? 0
  const alleBelege = belege.length

  // ── CRUD Belege ───────────────────────────────────────────────────────────────

  const handleSaveBeleg = async () => {
    if (!editBeleg?.lieferant || editBeleg.betrag == null) {
      showToast('Bitte Lieferant und Betrag eingeben', 'error'); return
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
      showToast('Beleg gespeichert')
      setEditBeleg(null); setSaving(false); return
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
      const fresh = await getSteuerBelege()
      setBelege(fresh as Beleg[])
      showToast('Beleg gespeichert')
      setEditBeleg(null)
    } catch { showToast('Fehler beim Speichern', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteBeleg = async (id: string) => {
    if (isDemo) { setBelege(prev => prev.filter(b => b.id !== id)); setDeleteConfirm(null); showToast('Beleg gelöscht'); return }
    try {
      await deleteSteuerBeleg(id)
      setBelege(prev => prev.filter(b => b.id !== id))
      setDeleteConfirm(null)
      showToast('Beleg gelöscht')
    } catch { showToast('Fehler beim Löschen', 'error') }
  }

  const handleAutoBerechne = () => {
    const netto19 = belegeAktuell.filter(b => b.steuersatz === 19).reduce((s, b) => s + (b.betrag - b.steuerbetrag), 0)
    const netto7  = belegeAktuell.filter(b => b.steuersatz === 7).reduce((s, b) => s + (b.betrag - b.steuerbetrag), 0)
    const steuer19 = belegeAktuell.filter(b => b.steuersatz === 19).reduce((s, b) => s + b.steuerbetrag, 0)
    const steuer7  = belegeAktuell.filter(b => b.steuersatz === 7).reduce((s, b) => s + b.steuerbetrag, 0)
    return { netto19, netto7, steuer19, steuer7, nettoGes: netto19 + netto7 }
  }

  const handleMarkiereGeprueft = async () => {
    const calc = handleAutoBerechne()
    const entry: Ustva = {
      id: `USTVA-${selectedMonat}`,
      monat: selectedMonat,
      umsatzsteuer: aktuellUstva?.umsatzsteuer ?? 0,
      vorsteuer: calc.steuer19 + calc.steuer7,
      zahllast: (aktuellUstva?.umsatzsteuer ?? 0) - (calc.steuer19 + calc.steuer7),
      status: 'geprüft',
    }
    if (isDemo) { setUstva(prev => prev.map(u => u.monat === selectedMonat ? entry : u)); showToast('UStVA als geprüft markiert'); return }
    try {
      await upsertSteuerUstva(entry)
      const fresh = await getSteuerUstva()
      setUstva(fresh as Ustva[])
      showToast('UStVA als geprüft markiert')
    } catch { showToast('Fehler', 'error') }
  }

  // ── DATEV CSV Export ──────────────────────────────────────────────────────────

  const handleDatevExport = () => {
    const kontoMap: Record<number, string> = { 0: '8125', 7: '1575', 19: '1576' }
    const rows = [
      ['Datum', 'Lieferant', 'Betrag netto', 'Steuerbetrag', 'Steuersatz %', 'Konto', 'Belegname', 'Status'],
      ...belege.map(b => [
        b.datum,
        b.lieferant,
        String((b.betrag - b.steuerbetrag).toFixed(2)).replace('.', ','),
        String(b.steuerbetrag.toFixed(2)).replace('.', ','),
        String(b.steuersatz),
        kontoMap[b.steuersatz] ?? '1400',
        b.notiz ?? '',
        b.status,
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `DATEV_Export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    showToast('DATEV CSV exportiert')
  }

  const handleMonatExport = () => {
    const calc = handleAutoBerechne()
    const rows = [
      ['Monat', 'Umsatz netto 19%', 'USt 19%', 'Umsatz netto 7%', 'USt 7%', 'Vorsteuer gesamt', 'Umsatzsteuer gesamt', 'Zahllast'],
      [
        monthLabel(selectedMonat),
        String(calc.netto19.toFixed(2)).replace('.', ','),
        String(calc.steuer19.toFixed(2)).replace('.', ','),
        String(calc.netto7.toFixed(2)).replace('.', ','),
        String(calc.steuer7.toFixed(2)).replace('.', ','),
        String((calc.steuer19 + calc.steuer7).toFixed(2)).replace('.', ','),
        String(umsatzsteuerGes.toFixed(2)).replace('.', ','),
        String(zahllast.toFixed(2)).replace('.', ','),
      ],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `UStVA_${selectedMonat}.csv`
    a.click(); URL.revokeObjectURL(url)
    showToast('UStVA Monatsexport heruntergeladen')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,.25)', borderTopColor: STEUER_COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  const calc = handleAutoBerechne()
  const tabs: { id: SteuerTab; label: string }[] = [
    { id: 'uebersicht', label: '📊 Übersicht' },
    { id: 'belege',     label: '🧾 Belege' },
    { id: 'ustva',      label: '📋 UStVA' },
    { id: 'pruefungen', label: `⚠️ Prüfungen${warnings.length > 0 ? ` (${warnings.length})` : ''}` },
    { id: 'export',     label: '📤 Export' },
  ]

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 900, letterSpacing: '-.03em' }}>
              🧾 <span style={{ color: STEUER_COLOR }}>Steuer</span>Pilot
            </h1>
            <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>
              Buchführungsvorbereitung · UStVA · DATEV-Export
              {isDemo && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontSize: 11, fontWeight: 700 }}>DEMO</span>}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="pk-btn" onClick={() => setEditBeleg({})} style={{ fontSize: 13 }}>
              + Beleg erfassen
            </button>
            <button className="pk-btn-ghost" onClick={handleDatevExport} style={{ fontSize: 13 }}>
              DATEV Export
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pk-tab-bar" style={{ marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            background: tab === t.id ? `rgba(245,158,11,.15)` : 'transparent',
            color: tab === t.id ? STEUER_COLOR : '#aeb9c8',
            borderBottom: tab === t.id ? `2px solid ${STEUER_COLOR}` : '2px solid transparent',
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Übersicht ────────────────────────────────────────────────────────── */}
      {tab === 'uebersicht' && (
        <div>
          {/* Monatsauswahl */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Betrachtungsmonat</label>
            <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 240 }}>
              {(isDemo ? demoMonate : Array.from(new Set([currentMonthStr(), ...ustva.map(u => u.monat)])).sort().reverse()).map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          {/* KPI-Karten */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <KpiCard label="Vorsteuer (Eingang)" value={fmt(vorsteuerGes)} sub={`${belegeAktuell.length} Belege`} color="#4ddb7e" />
            <KpiCard label="Umsatzsteuer (Ausgang)" value={fmt(umsatzsteuerGes)} sub="aus Rechnungen" color="#ff8080" />
            <KpiCard label="Zahllast" value={fmt(Math.max(0, zahllast))} sub={zahllast < 0 ? `Erstattung: ${fmt(Math.abs(zahllast))}` : 'ans Finanzamt'} color={STEUER_COLOR} />
            <KpiCard label="Belege gesamt" value={String(alleBelege)} sub={`${belege.filter(b => b.status === 'offen').length} offen`} />
          </div>

          {/* Warnungen */}
          {warnings.length > 0 && (
            <div className="pk-card" style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(245,158,11,.25)' }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: STEUER_COLOR }}>⚠️ Offene Prüfpunkte ({warnings.length})</div>
              {warnings.slice(0, 3).map(w => (
                <div key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)' }}>
                  <WarnBadge type={w.type} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{w.title}</div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>{w.desc}</div>
                  </div>
                </div>
              ))}
              {warnings.length > 3 && <button className="pk-btn-ghost" onClick={() => setTab('pruefungen')} style={{ fontSize: 12, marginTop: 4 }}>Alle {warnings.length} anzeigen →</button>}
            </div>
          )}

          {/* Letzte Belege */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Letzte Belege</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Datum</th><th>Lieferant</th><th>Betrag</th><th>Steuer</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {belege.slice(0, 6).map(b => (
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
            {belege.length > 6 && <button className="pk-btn-ghost" onClick={() => setTab('belege')} style={{ fontSize: 12, marginTop: 10 }}>Alle {belege.length} Belege →</button>}
          </div>
        </div>
      )}

      {/* ── Belege ────────────────────────────────────────────────────────────── */}
      {tab === 'belege' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Eingangsbelege ({belege.length})</div>
            <button className="pk-btn" onClick={() => setEditBeleg({})} style={{ fontSize: 13 }}>+ Beleg erfassen</button>
          </div>
          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Datum</th><th>Lieferant</th><th>Betrag</th><th>Steuer</th><th>Satz</th><th>Status</th><th>Notiz</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {belege.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontSize: 11, color: '#aeb9c8' }}>{b.id}</td>
                      <td style={{ fontSize: 12 }}>{new Date(b.datum).toLocaleDateString('de-DE')}</td>
                      <td style={{ fontWeight: 600 }}>{b.lieferant}</td>
                      <td style={{ fontFamily: 'monospace' }}>{fmt(b.betrag)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(b.steuerbetrag)}</td>
                      <td><span className="badge badge-blue">{b.steuersatz}%</span></td>
                      <td><StatusBadge status={b.status} /></td>
                      <td style={{ fontSize: 12, color: '#aeb9c8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notiz}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditBeleg(b)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>✏️</button>
                          {deleteConfirm === b.id ? (
                            <>
                              <button onClick={() => handleDeleteBeleg(b.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,80,80,.15)', border: '1px solid rgba(255,80,80,.35)', color: '#ff8080', borderRadius: 6, cursor: 'pointer' }}>Ja</button>
                              <button onClick={() => setDeleteConfirm(null)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>Nein</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteConfirm(b.id)} className="pk-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}>🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {belege.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: '#aeb9c8', padding: 32 }}>Noch keine Belege erfasst</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── UStVA ─────────────────────────────────────────────────────────────── */}
      {tab === 'ustva' && (
        <div>
          {/* Monatsauswahl */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 6 }}>Monat</label>
              <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ minWidth: 200 }}>
                {(isDemo ? demoMonate : Array.from(new Set([currentMonthStr(), ...ustva.map(u => u.monat)])).sort().reverse()).map(m => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>
            <button className="pk-btn" onClick={handleMarkiereGeprueft} style={{ fontSize: 13 }}>✓ Als geprüft markieren</button>
            <button className="pk-btn-ghost" onClick={handleMonatExport} style={{ fontSize: 13 }}>📥 Monats-CSV</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Vorsteuer */}
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: '#4ddb7e' }}>Vorsteuer (Eingang)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[7, 19].map(satz => {
                  const b = belegeAktuell.filter(b => b.steuersatz === satz)
                  const nettoSum = b.reduce((s, x) => s + (x.betrag - x.steuerbetrag), 0)
                  const steuSum = b.reduce((s, x) => s + x.steuerbetrag, 0)
                  return (
                    <div key={satz} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.03)' }}>
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Steuersatz {satz}%</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13 }}>Netto: <strong>{fmt(nettoSum)}</strong></span>
                        <span style={{ fontSize: 13, color: '#4ddb7e' }}>VSt: <strong>{fmt(steuSum)}</strong></span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Vorsteuer gesamt</span>
                  <span style={{ color: '#4ddb7e' }}>{fmt(calc.steuer19 + calc.steuer7)}</span>
                </div>
              </div>
            </div>

            {/* Umsatzsteuer */}
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: '#ff8080' }}>Umsatzsteuer (Ausgang)</div>
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,.03)', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 4 }}>Aus BüroPilot-Rechnungen ({monthLabel(selectedMonat)})</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ff8080' }}>{fmt(umsatzsteuerGes)}</div>
              </div>
              {aktuellUstva && (
                <div style={{ fontSize: 12, color: '#aeb9c8' }}>
                  Status: <StatusBadge status={aktuellUstva.status} />
                </div>
              )}
            </div>

            {/* Zahllast */}
            <div className="pk-card" style={{ padding: 20, border: `1px solid rgba(245,158,11,.3)` }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: STEUER_COLOR }}>Zahllast / Erstattung</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: zahllast >= 0 ? STEUER_COLOR : '#4ddb7e' }}>
                {zahllast >= 0 ? '' : '–'}{fmt(Math.abs(zahllast))}
              </div>
              <div style={{ fontSize: 13, color: '#aeb9c8', marginTop: 6 }}>
                {zahllast >= 0 ? '→ Zahlung ans Finanzamt' : '→ Erstattung vom Finanzamt'}
              </div>
              <div style={{ fontSize: 12, color: '#4a5568', marginTop: 8 }}>
                {fmt(umsatzsteuerGes)} USt − {fmt(calc.steuer19 + calc.steuer7)} VSt
              </div>
            </div>
          </div>

          {/* UStVA-Verlauf */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>UStVA-Verlauf</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr><th>Monat</th><th>Umsatzsteuer</th><th>Vorsteuer</th><th>Zahllast</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {ustva.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{monthLabel(u.monat)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#ff8080' }}>{fmt(u.umsatzsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{fmt(u.vorsteuer)}</td>
                      <td style={{ fontFamily: 'monospace', color: STEUER_COLOR, fontWeight: 700 }}>{fmt(u.zahllast)}</td>
                      <td><StatusBadge status={u.status} /></td>
                    </tr>
                  ))}
                  {ustva.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aeb9c8', padding: 24 }}>Noch keine UStVA-Daten</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Prüfungen ─────────────────────────────────────────────────────────── */}
      {tab === 'pruefungen' && (
        <div>
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>KI-Prüfungen & Warnungen</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>Automatisch erkannte Auffälligkeiten in Ihren Belegen</div>
            </div>
          </div>

          {warnings.length === 0 ? (
            <div className="pk-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Alles in Ordnung</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Auffälligkeiten gefunden</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warnings.map(w => (
                <div key={w.id} className="pk-card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', borderLeft: `3px solid ${w.type === 'error' ? '#ff5050' : w.type === 'warn' ? '#f59e0b' : '#1684ff'}` }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <WarnBadge type={w.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{w.title}</div>
                    <div style={{ fontSize: 13, color: '#aeb9c8' }}>{w.desc}</div>
                  </div>
                  {w.link && (
                    <a href={w.link} style={{ fontSize: 12, color: '#6cb6ff', textDecoration: 'none', flexShrink: 0 }}>→ Öffnen</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Checkliste */}
          <div className="pk-card" style={{ padding: 20, marginTop: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>📋 Monatsabschluss-Checkliste</div>
            {[
              { label: 'Alle Belege erfasst', done: belege.filter(b => b.datum.startsWith(selectedMonat)).length > 0 },
              { label: 'Alle Belege geprüft', done: belege.filter(b => b.datum.startsWith(selectedMonat) && b.status === 'offen').length === 0 },
              { label: 'UStVA berechnet', done: !!aktuellUstva },
              { label: 'UStVA als geprüft markiert', done: aktuellUstva?.status === 'geprüft' },
              { label: 'DATEV-Export erstellt', done: belege.filter(b => b.datum.startsWith(selectedMonat) && b.status === 'exportiert').length > 0 },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <span style={{ fontSize: 16 }}>{item.done ? '✅' : '⬜'}</span>
                <span style={{ fontSize: 14, color: item.done ? '#4ddb7e' : '#aeb9c8' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Export ────────────────────────────────────────────────────────────── */}
      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Exporte & Downloads</div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📤 DATEV CSV Export</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 16 }}>
              Exportiert alle Belege im DATEV-kompatiblen CSV-Format mit Konto-Mapping, Steuerbeträgen und Belegdaten. Direkt importierbar in DATEV, Lexware oder ähnliche Systeme.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="pk-btn" onClick={handleDatevExport} style={{ fontSize: 14 }}>
                📥 DATEV CSV herunterladen ({belege.length} Belege)
              </button>
            </div>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>📋 UStVA Monatsexport</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 16 }}>
              Exportiert die UStVA-Berechnung für einen gewählten Monat mit Umsatzsteuer, Vorsteuer und Zahllast.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="pk-input" value={selectedMonat} onChange={e => setSelectedMonat(e.target.value)} style={{ maxWidth: 220 }}>
                {(isDemo ? demoMonate : Array.from(new Set([currentMonthStr(), ...ustva.map(u => u.monat)])).sort().reverse()).map(m => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
              <button className="pk-btn" onClick={handleMonatExport} style={{ fontSize: 14 }}>
                📥 Monats-CSV ({monthLabel(selectedMonat)})
              </button>
            </div>
          </div>

          <div className="pk-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🗂️ Konto-Mapping (DATEV)</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 12 }}>Verwendete Kontonummern im Export:</div>
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
        </div>
      )}

      {/* ── Edit-Modal ────────────────────────────────────────────────────────── */}
      {editBeleg !== null && (
        <Modal title={editBeleg.id ? 'Beleg bearbeiten' : 'Neuer Beleg'} onClose={() => setEditBeleg(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Lieferant *</label>
              <input className="pk-input" placeholder="z.B. Büromaterial GmbH" value={editBeleg.lieferant ?? ''} onChange={e => setEditBeleg(prev => ({ ...prev, lieferant: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Bruttobetrag (€) *</label>
                <input className="pk-input" type="number" step="0.01" min="0" placeholder="238.00" value={editBeleg.betrag ?? ''} onChange={e => {
                  const brutto = parseFloat(e.target.value) || 0
                  const satz = Number(editBeleg.steuersatz ?? 19)
                  const steuer = satz > 0 ? Math.round(brutto / (1 + satz / 100) * (satz / 100) * 100) / 100 : 0
                  setEditBeleg(prev => ({ ...prev, betrag: brutto, steuerbetrag: steuer }))
                }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Steuerbetrag (€)</label>
                <input className="pk-input" type="number" step="0.01" min="0" placeholder="auto" value={editBeleg.steuerbetrag ?? ''} onChange={e => setEditBeleg(prev => ({ ...prev, steuerbetrag: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Steuersatz</label>
                <select className="pk-input" value={editBeleg.steuersatz ?? 19} onChange={e => {
                  const satz = Number(e.target.value)
                  const brutto = Number(editBeleg.betrag ?? 0)
                  const steuer = satz > 0 ? Math.round(brutto / (1 + satz / 100) * (satz / 100) * 100) / 100 : 0
                  setEditBeleg(prev => ({ ...prev, steuersatz: satz, steuerbetrag: steuer }))
                }}>
                  {STEUERSAETZE.map(s => <option key={s} value={s}>{s}%</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Datum *</label>
                <input className="pk-input" type="date" value={editBeleg.datum ?? new Date().toISOString().split('T')[0]} onChange={e => setEditBeleg(prev => ({ ...prev, datum: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                <select className="pk-input" value={editBeleg.status ?? 'offen'} onChange={e => setEditBeleg(prev => ({ ...prev, status: e.target.value as Beleg['status'] }))}>
                  <option value="offen">Offen</option>
                  <option value="geprüft">Geprüft</option>
                  <option value="exportiert">Exportiert</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Beleg (Datei)</label>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="pk-input" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notiz</label>
              <input className="pk-input" placeholder="Kommentar zum Beleg" value={editBeleg.notiz ?? ''} onChange={e => setEditBeleg(prev => ({ ...prev, notiz: e.target.value }))} />
            </div>
            {/* Netto-Vorschau */}
            {(editBeleg.betrag ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#aeb9c8' }}>Nettobetrag: <strong style={{ color: '#f8fbff' }}>{fmt((editBeleg.betrag ?? 0) - (editBeleg.steuerbetrag ?? 0))}</strong></span>
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
