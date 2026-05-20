'use client'
import React from 'react'

// ── Constants ──────────────────────────────────────────────────────────────────

export const STEUER_COLOR = '#f59e0b'
export const STEUERSAETZE = [0, 7, 19]

export const FIXKOSTEN_KATEGORIEN = [
  'Internet', 'Handyvertrag', 'Büromiete', 'Coworking Space', 'Strom',
  'Hosting', 'Domains', 'Cloud-Speicher', 'Software-Abos', 'Buchhaltungssoftware',
  'Steuerberater', 'Geschäftskonto', 'Leasing', 'Werbung', 'Versicherungen',
  'IHK / Mitgliedschaften', 'Sonstiges',
]

export const BETRIEBSAUSGABEN_KATEGORIEN = [
  'Büromaterial', 'Druckerpapier / Tinte', 'Versandkosten', 'Fahrtkosten',
  'Bahntickets', 'Tanken', 'Parkgebühren', 'Arbeitskleidung', 'Werkzeuge',
  'Freelancer / Subunternehmer', 'Fortbildungen', 'Fachbücher', 'Messebesuche',
  'Bewirtung', 'Telefon / Porto', 'Sonstiges',
]

export const ANSCHAFFUNGEN_KATEGORIEN = [
  'Laptop', 'Monitor', 'Smartphone', 'Kamera', 'Drucker', 'Schreibtisch',
  'Bürostuhl', 'Werkzeuge', 'Maschinen', 'Firmenwagen', 'Sonstiges',
]

export const ZAHLUNGSINTERVALLE: { value: string; label: string; faktor: number }[] = [
  { value: 'monatlich',     label: 'Monatlich',     faktor: 1 },
  { value: 'quartalsweise', label: 'Quartalsweise', faktor: 1 / 3 },
  { value: 'halbjährlich',  label: 'Halbjährlich',  faktor: 1 / 6 },
  { value: 'jährlich',      label: 'Jährlich',      faktor: 1 / 12 },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export type Beleg = {
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

export type Ustva = {
  id: string
  monat: string
  umsatzsteuer: number
  vorsteuer: number
  zahllast: number
  status: 'offen' | 'geprüft'
}

export type Fixkosten = {
  id: string
  titel: string
  kategorie: string
  betrag_netto: number
  steuersatz: number
  betrag_brutto: number
  zahlungsintervall: string
  naechste_zahlung?: string
  anbieter?: string
  notiz?: string
  datei_url?: string
  aktiv: boolean
}

export type Betriebsausgabe = {
  id: string
  titel: string
  kategorie: string
  betrag_netto: number
  steuersatz: number
  betrag_brutto: number
  datum: string
  anbieter?: string
  notiz?: string
  datei_url?: string
}

export type Anschaffung = {
  id: string
  titel: string
  kategorie: string
  betrag_netto: number
  steuersatz: number
  betrag_brutto: number
  kaufdatum: string
  lieferant?: string
  seriennummer?: string
  garantie_bis?: string
  notiz?: string
  datei_url?: string
  gwg: boolean
}

export type Rechnung = {
  id: string
  kunde?: string
  nummer?: string
  summe?: number
  netto?: number
  steuer_satz?: number
  steuerbetrag?: number
  status?: string
  erstellt?: string
  bezahlt_am?: string
  faellig?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

export function calcMonatlichAnteil(betrag_brutto: number, intervall: string): number {
  const f = ZAHLUNGSINTERVALLE.find(z => z.value === intervall)?.faktor ?? 1
  return betrag_brutto * f
}

export function isGWG(betrag_netto: number): boolean {
  return betrag_netto > 0 && betrag_netto <= 800
}

export function calcVorsteuerbetrag(brutto: number, satz: number): number {
  if (satz === 0) return 0
  return Math.round(brutto / (1 + satz / 100) * (satz / 100) * 100) / 100
}

export function calcNetto(brutto: number, satz: number): number {
  if (satz === 0) return brutto
  return Math.round(brutto / (1 + satz / 100) * 100) / 100
}

// ── Atoms ──────────────────────────────────────────────────────────────────────

export function Toast({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  if (!msg) return null
  const isErr = type === 'error'
  // .pk-toast-Klasse → Position/Animation/Größe aus User-Prefs (globals.css)
  return (
    <div className="pk-toast" style={{
      background: isErr ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${isErr ? 'rgba(255,80,80,.4)' : 'rgba(37,211,102,.35)'}`,
      color: isErr ? '#ff8080' : '#4ddb7e',
    }}>{msg}</div>
  )
}

export function KpiCard({
  label, value, sub, color, onClick,
}: {
  label: string; value: string; sub?: string; color?: string; onClick?: () => void
}) {
  return (
    <div
      className="pk-card"
      style={{ padding: '18px 20px', cursor: onClick ? 'pointer' : undefined }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') onClick() }) : undefined}
    >
      <div style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#f8fbff', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Modal({
  title, onClose, children, maxWidth = 560,
}: {
  title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      role="presentation"
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div
        className="pk-card fade-in"
        style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}
        role="presentation"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    offen:      { label: 'Offen',      cls: 'badge badge-orange' },
    geprüft:    { label: 'Geprüft',    cls: 'badge badge-green' },
    exportiert: { label: 'Exportiert', cls: 'badge badge-gray' },
    bezahlt:    { label: 'Bezahlt',    cls: 'badge badge-green' },
    erstellt:   { label: 'Erstellt',   cls: 'badge badge-blue' },
    überfällig: { label: 'Überfällig', cls: 'badge badge-red' },
    aktiv:      { label: 'Aktiv',      cls: 'badge badge-green' },
    inaktiv:    { label: 'Inaktiv',    cls: 'badge badge-gray' },
  }
  const s = map[status] ?? { label: status, cls: 'badge badge-gray' }
  return <span className={s.cls}>{s.label}</span>
}

export function MonthSelector({
  value, onChange, months,
}: {
  value: string; onChange: (m: string) => void; months: string[]
}) {
  return (
    <select className="pk-input" value={value} onChange={e => onChange(e.target.value)} style={{ maxWidth: 240 }}>
      {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
    </select>
  )
}

export function SectionHeader({
  title, sub, action,
}: {
  title: string; sub?: string; action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="pk-card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
      {sub && <div style={{ color: '#aeb9c8', fontSize: 13 }}>{sub}</div>}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ width: 32, height: 32, border: `3px solid rgba(245,158,11,.2)`, borderTopColor: STEUER_COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

export function AmpelBadge({ zahllast }: { zahllast: number }) {
  if (zahllast < 0) return <span className="badge badge-green">Erstattung</span>
  if (zahllast < 500) return <span className="badge badge-green">Gering</span>
  if (zahllast < 2000) return <span className="badge badge-orange">Mittel</span>
  return <span className="badge badge-red">Hoch</span>
}

export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  )
}

export function FormField({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#ff8080' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

export function NettoBruttoVorschau({ netto, steuer, brutto }: { netto: number; steuer: number; brutto: number }) {
  if (brutto <= 0) return null
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ color: '#aeb9c8' }}>Netto: <strong style={{ color: '#f8fbff' }}>{fmt(netto)}</strong></span>
      <span style={{ color: '#aeb9c8' }}>Vorsteuer: <strong style={{ color: '#4ddb7e' }}>{fmt(steuer)}</strong></span>
      <span style={{ color: '#aeb9c8' }}>Brutto: <strong style={{ color: '#f8fbff' }}>{fmt(brutto)}</strong></span>
    </div>
  )
}
