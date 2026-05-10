'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getLagerArtikel, getLagerBewegungen,
  upsertLagerArtikel, insertLagerBewegung, deleteLagerArtikel,
  getLagerStellplaetze, getLagerStellplatzBestand, getLagerUmlagerungen,
  upsertLagerStellplatz, deleteLagerStellplatz,
  deleteLagerStellplatzBestand, umlagerArtikel,
} from '@/lib/db'

// ── Typen ────────────────────────────────────────────────────────────────────

type Artikel = {
  id: string; name: string; kategorie: string; bestand: number
  einheit: string; lagerplatz: string; status: string; mindestbestand?: number
}
type Bewegung = {
  id: number | string; typ: string; artikel: string; menge: number
  datum: string; mitarbeiter: string; status: string
}

type Stellplatz = {
  id: string; code: string; name?: string; bereich?: string; zone?: string
  typ?: string; warengruppe?: string; aktiv?: boolean; notiz?: string
}
type StellplatzBestand = {
  id: string; stellplatz_id: string; artikelnummer?: string; artikelname?: string
  charge?: string; mhd?: string; menge: number; einheit?: string; status?: string
  eingelagert_am?: string; notiz?: string
  lager_stellplaetze?: { code: string; bereich?: string }
}
type Umlagerung = {
  id: string; artikelname?: string; artikelnummer?: string
  von_stellplatz_id?: string; nach_stellplatz_id?: string
  menge: number; grund?: string; datum?: string; notiz?: string
}

type StellplatzForm = {
  code: string; name: string; bereich: string; zone: string; gang: string
  regal: string; ebene: string; fach: string; typ: string; warengruppe: string
  warenobergruppe: string; temperaturzone: string; max_gewicht: string
  max_volumen: string; aktiv: boolean; notiz: string
}
const emptyStellplatzForm: StellplatzForm = {
  code: '', name: '', bereich: '', zone: '', gang: '', regal: '', ebene: '',
  fach: '', typ: 'Standard', warengruppe: '', warenobergruppe: '',
  temperaturzone: '', max_gewicht: '', max_volumen: '', aktiv: true, notiz: '',
}
type UmlagerungForm = { vonBestandId: string; nachStellplatzId: string; menge: string; grund: string; notiz: string }
const emptyUmlagerungForm: UmlagerungForm = { vonBestandId: '', nachStellplatzId: '', menge: '', grund: '', notiz: '' }

const SP_BEREICHE = ['Trockenlager', 'Kühlbereich', 'Wareneingang', 'Versand', 'Sperrlager', 'Außenlager', 'Sonstiges']
const SP_TYPEN = ['Standard', 'Kühl', 'Tiefkühl', 'Eingang', 'Ausgang', 'Sperr', 'Bodenplatz', 'Hochregal']

type SortKey = 'id' | 'name' | 'bestand' | 'status'
type SortDir = 'asc' | 'desc'
type LagerTab = 'bestand' | 'bewegungen' | 'eingang' | 'ausgang' | 'inventur' | 'bestellung' | 'historie' | 'stellplaetze' | 'lagerbelegung' | 'umlagerung'

const EINHEITEN = ['Stk', 'Liter', 'kg', 'Rollen', 'Meter', 'Paar', 'Karton', 'Palette']
const KATEGORIEN = ['Rohstoffe', 'Kleinteile', 'Betriebsstoffe', 'Verbrauchsmaterial', 'Werkzeug', 'Schutzausrüstung', 'Sonstiges']

// ── Demo-Daten ───────────────────────────────────────────────────────────────

const demoArtikel: Artikel[] = [
  { id: 'ART-001', name: 'Stahlrohr 40x40', kategorie: 'Rohstoffe', bestand: 142, einheit: 'Stk', lagerplatz: 'A-01-03', status: 'ok', mindestbestand: 20 },
  { id: 'ART-002', name: 'Schrauben M8x30', kategorie: 'Kleinteile', bestand: 1840, einheit: 'Stk', lagerplatz: 'B-02-01', status: 'ok', mindestbestand: 500 },
  { id: 'ART-003', name: 'Hydrauliköl HLP46', kategorie: 'Betriebsstoffe', bestand: 8, einheit: 'Liter', lagerplatz: 'C-01-02', status: 'niedrig', mindestbestand: 20 },
  { id: 'ART-004', name: 'Schweißdraht 1.0mm', kategorie: 'Verbrauchsmaterial', bestand: 24, einheit: 'Rollen', lagerplatz: 'B-03-04', status: 'ok', mindestbestand: 10 },
  { id: 'ART-005', name: 'Aluminiumplatte 200x300', kategorie: 'Rohstoffe', bestand: 0, einheit: 'Stk', lagerplatz: 'A-02-01', status: 'leer', mindestbestand: 5 },
  { id: 'ART-006', name: 'Dichtungsring 50mm', kategorie: 'Kleinteile', bestand: 360, einheit: 'Stk', lagerplatz: 'B-01-05', status: 'ok', mindestbestand: 50 },
  { id: 'ART-007', name: 'Schutzhandschuhe Gr. L', kategorie: 'Schutzausrüstung', bestand: 12, einheit: 'Paar', lagerplatz: 'D-01-01', status: 'niedrig', mindestbestand: 20 },
  { id: 'ART-008', name: 'Winkelschleifer 125mm', kategorie: 'Werkzeug', bestand: 3, einheit: 'Stk', lagerplatz: 'E-01-02', status: 'ok', mindestbestand: 1 },
]

const demoBewegungen: Bewegung[] = [
  { id: 1, typ: 'Eingang', artikel: 'Stahlrohr 40x40', menge: 50, datum: '06.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 2, typ: 'Ausgang', artikel: 'Schrauben M8x30', menge: 200, datum: '06.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 3, typ: 'Eingang', artikel: 'Hydrauliköl HLP46', menge: 20, datum: '05.05.2025', mitarbeiter: 'K. Petersen', status: 'KI erkannt' },
  { id: 4, typ: 'Ausgang', artikel: 'Schweißdraht 1.0mm', menge: 6, datum: '05.05.2025', mitarbeiter: 'M. Fischer', status: 'Gebucht' },
  { id: 5, typ: 'Eingang', artikel: 'Schrauben M8x30', menge: 1000, datum: '03.05.2025', mitarbeiter: 'K. Petersen', status: 'Gebucht' },
  { id: 6, typ: 'Ausgang', artikel: 'Stahlrohr 40x40', menge: 8, datum: '02.05.2025', mitarbeiter: 'T. Schulz', status: 'Gebucht' },
]

const demoStellplaetze: Stellplatz[] = [
  { id: 'SP-001', code: 'TL-A-01-01', name: 'Trockenlager A Regal 1 Fach 1', bereich: 'Trockenlager', zone: 'A', typ: 'Standard', aktiv: true },
  { id: 'SP-002', code: 'TL-A-01-02', name: 'Trockenlager A Regal 1 Fach 2', bereich: 'Trockenlager', zone: 'A', typ: 'Standard', aktiv: true },
  { id: 'SP-003', code: 'KL-B-02-01', name: 'Kühlbereich B Regal 2 Fach 1', bereich: 'Kühlbereich', zone: 'B', typ: 'Kühl', aktiv: true },
  { id: 'SP-004', code: 'WE-ZONE-01', name: 'Wareneingangszone 1', bereich: 'Wareneingang', zone: 'WE', typ: 'Eingang', aktiv: true },
  { id: 'SP-005', code: 'SPERR-01', name: 'Sperrlager 1', bereich: 'Sperrlager', zone: 'S', typ: 'Sperr', aktiv: true },
  { id: 'SP-006', code: 'VERSAND-01', name: 'Versandzone 1', bereich: 'Versand', zone: 'V', typ: 'Ausgang', aktiv: true },
]

const demoStellplatzBestand: StellplatzBestand[] = [
  { id: 'SB-001', stellplatz_id: 'SP-001', artikelnummer: 'ART-001', artikelname: 'Stahlrohr 40x40', charge: 'CH-2025-01', menge: 80, einheit: 'Stk', status: 'Verfügbar', lager_stellplaetze: { code: 'TL-A-01-01', bereich: 'Trockenlager' } },
  { id: 'SB-002', stellplatz_id: 'SP-002', artikelnummer: 'ART-001', artikelname: 'Stahlrohr 40x40', charge: 'CH-2025-02', menge: 62, einheit: 'Stk', status: 'Verfügbar', lager_stellplaetze: { code: 'TL-A-01-02', bereich: 'Trockenlager' } },
  { id: 'SB-003', stellplatz_id: 'SP-001', artikelnummer: 'ART-002', artikelname: 'Schrauben M8x30', menge: 1840, einheit: 'Stk', status: 'Verfügbar', lager_stellplaetze: { code: 'TL-A-01-01', bereich: 'Trockenlager' } },
  { id: 'SB-004', stellplatz_id: 'SP-003', artikelnummer: 'ART-003', artikelname: 'Hydrauliköl HLP46', charge: 'CH-2024-11', mhd: '2026-12-31', menge: 8, einheit: 'Liter', status: 'Verfügbar', lager_stellplaetze: { code: 'KL-B-02-01', bereich: 'Kühlbereich' } },
  { id: 'SB-005', stellplatz_id: 'SP-004', artikelnummer: 'ART-005', artikelname: 'Aluminiumplatte 200x300', menge: 0, einheit: 'Stk', status: 'Leer', lager_stellplaetze: { code: 'WE-ZONE-01', bereich: 'Wareneingang' } },
]

const demoUmlagerungen: Umlagerung[] = [
  { id: 'UML-001', artikelname: 'Stahlrohr 40x40', artikelnummer: 'ART-001', von_stellplatz_id: 'SP-004', nach_stellplatz_id: 'SP-001', menge: 50, grund: 'Einlagerung Wareneingang', datum: '2026-05-06T08:15:00Z' },
  { id: 'UML-002', artikelname: 'Schrauben M8x30', artikelnummer: 'ART-002', von_stellplatz_id: 'SP-001', nach_stellplatz_id: 'SP-005', menge: 200, grund: 'Qualitätsprüfung', datum: '2026-05-07T10:30:00Z' },
  { id: 'UML-003', artikelname: 'Hydrauliköl HLP46', artikelnummer: 'ART-003', von_stellplatz_id: 'SP-004', nach_stellplatz_id: 'SP-003', menge: 20, grund: 'Einlagerung Kühlbereich', datum: '2026-05-08T14:00:00Z' },
]

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function nextArtikelId(liste: Artikel[]) {
  const nums = liste.map(a => parseInt(a.id.replace('ART-', '')) || 0)
  const max = nums.length ? Math.max(...nums) : 0
  return `ART-${String(max + 1).padStart(3, '0')}`
}

function calcStatus(bestand: number, mindestbestand: number): string {
  if (bestand === 0) return 'leer'
  if (bestand <= mindestbestand) return 'niedrig'
  return 'ok'
}

function toDE(date: Date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function exportCSV(data: Artikel[]) {
  const header = ['id', 'name', 'kategorie', 'bestand', 'einheit', 'lagerplatz', 'status', 'mindestbestand']
  const rows = data.map(a => [
    a.id,
    `"${a.name.replace(/"/g, '""')}"`,
    a.kategorie,
    String(a.bestand),
    a.einheit,
    a.lagerplatz,
    a.status,
    String(a.mindestbestand ?? 0),
  ].join(';'))
  const csv = [header.join(';'), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lager-export-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Modal-Komponente ─────────────────────────────────────────────────────────

type ArtikelForm = { name: string; kategorie: string; bestand: string; einheit: string; lagerplatz: string; mindestbestand: string }
const emptyForm: ArtikelForm = { name: '', kategorie: 'Rohstoffe', bestand: '0', einheit: 'Stk', lagerplatz: '', mindestbestand: '0' }

function ArtikelModal({ artikel, onSave, onClose }: {
  artikel?: Artikel | null
  onSave: (form: ArtikelForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ArtikelForm>(artikel ? {
    name: artikel.name,
    kategorie: artikel.kategorie,
    bestand: String(artikel.bestand),
    einheit: artikel.einheit,
    lagerplatz: artikel.lagerplatz,
    mindestbestand: String(artikel.mindestbestand ?? 0),
  } : emptyForm)

  const set = (k: keyof ArtikelForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
      <div className="pk-card fade-in-scale" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: 28 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>
          {artikel ? '✏️ Artikel bearbeiten' : '➕ Neuer Artikel'}
        </h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikelbezeichnung *</label>
            <input className="pk-input" placeholder="z.B. Stahlrohr 40x40" value={form.name} onChange={set('name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Kategorie</label>
              <select className="pk-input" value={form.kategorie} onChange={set('kategorie')}>
                {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Einheit</label>
              <select className="pk-input" value={form.einheit} onChange={set('einheit')}>
                {EINHEITEN.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Aktueller Bestand</label>
              <input className="pk-input" type="number" min="0" value={form.bestand} onChange={set('bestand')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mindestbestand ⚠️</label>
              <input className="pk-input" type="number" min="0" value={form.mindestbestand} onChange={set('mindestbestand')} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
            <input className="pk-input" placeholder="z.B. A-01-03" value={form.lagerplatz} onChange={set('lagerplatz')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="pk-btn" onClick={() => { if (form.name.trim()) onSave(form) }} style={{ flex: 1, fontWeight: 700 }}>
            {artikel ? 'Speichern' : 'Artikel anlegen'}
          </button>
          <button className="pk-btn-ghost" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Bestell-Detail-Modal ─────────────────────────────────────────────────────

function BestellDetailModal({ artikel, menge, onConfirm, onClose }: {
  artikel: Artikel
  menge: string
  onConfirm: (m: string) => void
  onClose: () => void
}) {
  const [m, setM] = useState(menge)
  const [emailSent, setEmailSent] = useState(false)
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const lieferdatum = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)' }} />
      <div className="pk-card fade-in-scale" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🛒 Bestellung auslösen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Artikel-Info */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 28 }}>📦</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{artikel.name}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>
                {artikel.id} · {artikel.kategorie} · Lagerplatz: {artikel.lagerplatz || '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Aktuell', value: `${artikel.bestand} ${artikel.einheit}`, color: artikel.status === 'leer' ? '#f43f5e' : '#f59e0b' },
              { label: 'Mindestbestand', value: `${artikel.mindestbestand ?? 0} ${artikel.einheit}`, color: '#aeb9c8' },
              { label: 'Fehlmenge', value: `${Math.max(0, (artikel.mindestbestand ?? 0) - artikel.bestand)} ${artikel.einheit}`, color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,.04)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bestellmenge */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Bestellmenge *</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="pk-input"
              type="number" min="1"
              value={m}
              onChange={e => setM(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <span style={{ color: '#aeb9c8', fontSize: 14 }}>{artikel.einheit}</span>
          </div>
        </div>

        {/* E-Mail-Vorschau */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: '#aeb9c8', fontWeight: 600, marginBottom: 8 }}>📧 E-Mail-Vorschau (Bestellanfrage)</div>
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', fontFamily: 'monospace', fontSize: 12, color: '#d0dce8', lineHeight: 1.7 }}>
            <div style={{ color: '#aeb9c8', marginBottom: 8, fontSize: 11 }}>An: lieferant@beispiel.de · Betreff: Bestellanfrage – {artikel.name}</div>
            <div>Sehr geehrte Damen und Herren,</div>
            <div style={{ marginTop: 8 }}>hiermit stellen wir folgende Bestellanfrage:</div>
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.15)' }}>
              <div>Artikel: <b style={{ color: '#f8fbff' }}>{artikel.name}</b> ({artikel.id})</div>
              <div>Menge: <b style={{ color: '#6cb6ff' }}>{m || '—'} {artikel.einheit}</b></div>
              <div>Gewünschte Lieferung bis: <b style={{ color: '#f8fbff' }}>{lieferdatum}</b></div>
            </div>
            <div style={{ marginTop: 8 }}>Bitte bestätigen Sie die Bestellung und teilen Sie uns Ihre Lieferzeit mit.</div>
            <div style={{ marginTop: 8, color: '#aeb9c8' }}>Mit freundlichen Grüßen · Petersen Betrieb · {heute}</div>
          </div>
        </div>

        {emailSent && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.3)', fontSize: 13, color: '#4ddb7e', fontWeight: 600 }}>
            ✅ E-Mail-Vorschau wurde simuliert – In einer echten Integration würde jetzt eine E-Mail versandt.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="pk-btn"
            onClick={() => { onConfirm(m); }}
            style={{ flex: 1, fontWeight: 700 }}
            disabled={!m || parseInt(m) <= 0}
          >
            ✅ Bestellung bestätigen
          </button>
          <button
            className="pk-btn-ghost"
            onClick={() => setEmailSent(true)}
            style={{ fontSize: 13 }}
            title="E-Mail simulieren"
          >
            📧 E-Mail senden
          </button>
          <button className="pk-btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Stellplatz-Modal ─────────────────────────────────────────────────────────

function StellplatzModal({ stellplatz, onSave, onClose }: {
  stellplatz?: Stellplatz | null
  onSave: (form: StellplatzForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<StellplatzForm>(stellplatz ? {
    code: stellplatz.code,
    name: stellplatz.name ?? '',
    bereich: stellplatz.bereich ?? '',
    zone: stellplatz.zone ?? '',
    gang: '',
    regal: '',
    ebene: '',
    fach: '',
    typ: stellplatz.typ ?? 'Standard',
    warengruppe: stellplatz.warengruppe ?? '',
    warenobergruppe: (stellplatz as Stellplatz & { warenobergruppe?: string }).warenobergruppe ?? '',
    temperaturzone: '',
    max_gewicht: '',
    max_volumen: '',
    aktiv: stellplatz.aktiv !== false,
    notiz: stellplatz.notiz ?? '',
  } : emptyStellplatzForm)

  const set = (k: keyof StellplatzForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
      <div className="pk-card fade-in-scale" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>
          {stellplatz ? '✏️ Stellplatz bearbeiten' : '📍 Neuer Stellplatz'}
        </h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Stellplatz-Code * <span style={{ color: '#aeb9c8', fontWeight: 400 }}>(z.B. TL-A-01-02)</span></label>
            <input className="pk-input" placeholder="TL-A-01-02" value={form.code} onChange={set('code')} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Bezeichnung</label>
            <input className="pk-input" placeholder="z.B. Trockenlager A Regal 1 Fach 2" value={form.name} onChange={set('name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Bereich</label>
              <select className="pk-input" value={form.bereich} onChange={set('bereich')}>
                <option value="">— Bereich wählen —</option>
                {SP_BEREICHE.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={set('typ')}>
                {SP_TYPEN.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {([['zone', 'Zone'], ['gang', 'Gang'], ['regal', 'Regal'], ['ebene', 'Ebene']] as [keyof StellplatzForm, string][]).map(([k, label]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 600 }}>{label}</label>
                <input className="pk-input" placeholder={label} value={form[k] as string} onChange={set(k)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Fach</label>
              <input className="pk-input" placeholder="z.B. 03" value={form.fach} onChange={set('fach')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Temperaturzone</label>
              <input className="pk-input" placeholder="z.B. +15°C bis +25°C" value={form.temperaturzone} onChange={set('temperaturzone')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Warengruppe</label>
              <input className="pk-input" placeholder="z.B. Metallwaren" value={form.warengruppe} onChange={set('warengruppe')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Warenobergruppe</label>
              <input className="pk-input" placeholder="z.B. Rohstoffe" value={form.warenobergruppe} onChange={set('warenobergruppe')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Max. Gewicht (kg)</label>
              <input className="pk-input" type="number" min="0" placeholder="z.B. 500" value={form.max_gewicht} onChange={set('max_gewicht')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Max. Volumen (m³)</label>
              <input className="pk-input" type="number" min="0" step="0.01" placeholder="z.B. 2.5" value={form.max_volumen} onChange={set('max_volumen')} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Notiz</label>
            <input className="pk-input" placeholder="Optionale Hinweise" value={form.notiz} onChange={set('notiz')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              id="sp-aktiv"
              checked={form.aktiv}
              onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: '#1684ff', cursor: 'pointer' }}
            />
            <label htmlFor="sp-aktiv" style={{ fontSize: 14, color: '#f8fbff', cursor: 'pointer', fontWeight: 600 }}>Stellplatz aktiv</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="pk-btn" onClick={() => { if (form.code.trim()) onSave(form) }} style={{ flex: 1, fontWeight: 700 }}>
            {stellplatz ? 'Speichern' : 'Stellplatz anlegen'}
          </button>
          <button className="pk-btn-ghost" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function LagerPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<LagerTab>('bestand')
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState('Alle')
  const [artikel, setArtikel] = useState<Artikel[]>(isDemo ? demoArtikel : [])
  const [bewegungen, setBewegungen] = useState<Bewegung[]>(isDemo ? demoBewegungen : [])
  const [loading, setLoading] = useState(!isDemo)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<null | 'new' | Artikel>(null)
  const [newEingang, setNewEingang] = useState({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
  const [newAusgang, setNewAusgang] = useState({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
  const [inventurWerte, setInventurWerte] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Sortierung Bestand-Tab
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Inline-Delete-Bestätigung
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Warnbanner-Liste ausklappen
  const [warnListOpen, setWarnListOpen] = useState(false)

  // Bestellvorschlag-State
  const [bestellMengen, setBestellMengen] = useState<Record<string, string>>({})
  const [bestelltIds, setBestelltIds] = useState<Set<string>>(new Set())
  const [bestellModal, setBestellModal] = useState<Artikel | null>(null)
  const [bestellHint, setBestellHint] = useState<string | null>(null)

  // Artikel-Historie-State (P3)
  const [histArtikel, setHistArtikel] = useState<string | null>(null)

  // Stellplatz-State
  const [stellplaetze, setStellplaetze] = useState<Stellplatz[]>(isDemo ? demoStellplaetze : [])
  const [stellplatzBestand, setStellplatzBestand] = useState<StellplatzBestand[]>(isDemo ? demoStellplatzBestand : [])
  const [umlagerungen, setUmlagerungen] = useState<Umlagerung[]>(isDemo ? demoUmlagerungen : [])
  const [spModal, setSpModal] = useState<null | 'new' | Stellplatz>(null)
  const [spDeleteConfirmId, setSpDeleteConfirmId] = useState<string | null>(null)
  const [spSearch, setSpSearch] = useState('')
  const [spFilterBereich, setSpFilterBereich] = useState('Alle')

  // Umlagerungs-State
  const [umlForm, setUmlForm] = useState<UmlagerungForm>(emptyUmlagerungForm)

  // Lagerbelegung-State
  const [lbSearch, setLbSearch] = useState('')
  const [lbFilterBereich, setLbFilterBereich] = useState('Alle')
  const [lbNurMhdKritisch, setLbNurMhdKritisch] = useState(false)
  const [lbDeleteConfirmId, setLbDeleteConfirmId] = useState<string | null>(null)

  // Daten laden
  useEffect(() => {
    if (isDemo) return
    Promise.all([getLagerArtikel(), getLagerBewegungen()])
      .then(([a, b]) => { setArtikel(a as Artikel[]); setBewegungen(b as Bewegung[]) })
      .catch(() => showToast('Fehler beim Laden', false))
      .finally(() => setLoading(false))
  }, [isDemo])

  useEffect(() => {
    if (isDemo) return
    Promise.all([getLagerStellplaetze(), getLagerStellplatzBestand(), getLagerUmlagerungen()])
      .then(([sp, sb, uml]) => {
        setStellplaetze(sp as Stellplatz[])
        setStellplatzBestand(sb as StellplatzBestand[])
        setUmlagerungen(uml as Umlagerung[])
      })
      .catch(() => {})
  }, [isDemo])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = artikel.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      (a.lagerplatz ?? '').toLowerCase().includes(search.toLowerCase())
    const matchKat = filterKat === 'Alle' || a.kategorie === filterKat
    return matchSearch && matchKat
  })

  // ── Sortierung ───────────────────────────────────────────────────────────────

  const statusOrder: Record<string, number> = { leer: 0, niedrig: 1, ok: 2 }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'id') cmp = a.id.localeCompare(b.id)
    else if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'bestand') cmp = a.bestand - b.bestand
    else if (sortKey === 'status') cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: '#4a5568', marginLeft: 4, fontSize: 10 }}>↕</span>
    return <span style={{ color: '#6cb6ff', marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Artikel CRUD ─────────────────────────────────────────────────────────────

  const handleSaveArtikel = async (form: ArtikelForm) => {
    const bestand = parseInt(form.bestand) || 0
    const mindestbestand = parseInt(form.mindestbestand) || 0
    const status = calcStatus(bestand, mindestbestand)
    const isEdit = modal !== null && modal !== 'new'
    const id = isEdit ? (modal as Artikel).id : nextArtikelId(artikel)
    const a: Artikel = { id, name: form.name, kategorie: form.kategorie, bestand, einheit: form.einheit, lagerplatz: form.lagerplatz, status, mindestbestand }

    setSaving(true)
    if (!isDemo) {
      try { await upsertLagerArtikel(a) } catch { showToast('Fehler beim Speichern', false); setSaving(false); return }
    }
    setArtikel(prev => isEdit ? prev.map(x => x.id === id ? a : x) : [...prev, a])
    setModal(null)
    setSaving(false)
    showToast(isEdit ? `✅ "${form.name}" aktualisiert` : `✅ "${form.name}" angelegt`)
  }

  const handleDeleteArtikel = async (id: string) => {
    if (!isDemo) {
      try { await deleteLagerArtikel(id) } catch { showToast('Fehler beim Löschen', false); setDeleteConfirmId(null); return }
    }
    setArtikel(prev => prev.filter(a => a.id !== id))
    setDeleteConfirmId(null)
    showToast('🗑 Artikel gelöscht')
  }

  // ── Wareneingang ─────────────────────────────────────────────────────────────

  const handleEingang = async () => {
    if (!newEingang.artikel || !newEingang.menge) return
    const menge = parseInt(newEingang.menge)
    if (isNaN(menge) || menge <= 0) return
    setSaving(true)

    const existing = artikel.find(a => a.name === newEingang.artikel || a.id === newEingang.artikel)

    if (!isDemo) {
      try {
        await insertLagerBewegung({ typ: 'Eingang', artikel: newEingang.artikel, menge, mitarbeiter: newEingang.mitarbeiter || '—' })
        if (existing) {
          const newBestand = existing.bestand + menge
          const updated = { ...existing, bestand: newBestand, status: calcStatus(newBestand, existing.mindestbestand ?? 0) }
          await upsertLagerArtikel(updated)
          setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
        }
        const b = await getLagerBewegungen()
        setBewegungen(b as Bewegung[])
      } catch { showToast('Fehler beim Buchen', false); setSaving(false); return }
    } else {
      if (existing) {
        const newBestand = existing.bestand + menge
        setArtikel(prev => prev.map(a => a.id === existing.id ? { ...a, bestand: newBestand, status: calcStatus(newBestand, a.mindestbestand ?? 0) } : a))
      }
      setBewegungen(prev => [{ id: Date.now(), typ: 'Eingang', artikel: newEingang.artikel, menge, datum: toDE(new Date()), mitarbeiter: newEingang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
    }

    showToast(`✅ Eingang: ${menge}× "${newEingang.artikel}" gebucht`)
    setNewEingang({ artikel: '', menge: '', lagerplatz: '', mitarbeiter: '' })
    setSaving(false)
  }

  // ── Warenausgang ─────────────────────────────────────────────────────────────

  const handleAusgang = async () => {
    if (!newAusgang.artikel || !newAusgang.menge) return
    const menge = parseInt(newAusgang.menge)
    if (isNaN(menge) || menge <= 0) return
    const existing = artikel.find(a => a.name === newAusgang.artikel || a.id === newAusgang.artikel)
    if (existing && existing.bestand < menge) {
      showToast(`⚠️ Nur noch ${existing.bestand} ${existing.einheit} auf Lager!`, false)
      return
    }
    setSaving(true)

    if (!isDemo) {
      try {
        await insertLagerBewegung({ typ: 'Ausgang', artikel: newAusgang.artikel, menge, mitarbeiter: newAusgang.mitarbeiter || '—' })
        if (existing) {
          const newBestand = Math.max(0, existing.bestand - menge)
          const updated = { ...existing, bestand: newBestand, status: calcStatus(newBestand, existing.mindestbestand ?? 0) }
          await upsertLagerArtikel(updated)
          setArtikel(prev => prev.map(a => a.id === existing.id ? updated : a))
        }
        const b = await getLagerBewegungen()
        setBewegungen(b as Bewegung[])
      } catch { showToast('Fehler beim Buchen', false); setSaving(false); return }
    } else {
      if (existing) {
        const newBestand = Math.max(0, existing.bestand - menge)
        setArtikel(prev => prev.map(a => a.id === existing.id ? { ...a, bestand: newBestand, status: calcStatus(newBestand, a.mindestbestand ?? 0) } : a))
      }
      setBewegungen(prev => [{ id: Date.now(), typ: 'Ausgang', artikel: newAusgang.artikel, menge, datum: toDE(new Date()), mitarbeiter: newAusgang.mitarbeiter || '—', status: 'Gebucht' }, ...prev])
    }

    showToast(`✅ Ausgang: ${menge}× "${newAusgang.artikel}" gebucht`)
    if (existing) {
      const newBestand = Math.max(0, existing.bestand - menge)
      const newStatus = calcStatus(newBestand, existing.mindestbestand ?? 0)
      if (newStatus !== 'ok') {
        setBestellHint(`⚠️ "${existing.name}" ist jetzt ${newStatus === 'leer' ? 'leer' : 'unter Mindestbestand'}!`)
        setTimeout(() => setBestellHint(null), 10000)
      }
    }
    setNewAusgang({ artikel: '', menge: '', empfaenger: '', mitarbeiter: '' })
    setSaving(false)
  }

  // ── Inventur ─────────────────────────────────────────────────────────────────

  const handleInventurSave = async () => {
    const updates = artikel.map(a => {
      const istStr = inventurWerte[a.id]
      if (istStr === undefined || istStr === '') return null
      const ist = parseInt(istStr)
      if (isNaN(ist)) return null
      return { ...a, bestand: ist, status: calcStatus(ist, a.mindestbestand ?? 0) }
    }).filter(Boolean) as Artikel[]

    if (updates.length === 0) { showToast('Keine Änderungen', false); return }

    setSaving(true)
    if (!isDemo) {
      try { await Promise.all(updates.map(a => upsertLagerArtikel(a))) }
      catch { showToast('Fehler beim Speichern', false); setSaving(false); return }
    }
    setArtikel(prev => prev.map(a => updates.find(u => u.id === a.id) ?? a))
    setInventurWerte({})
    setSaving(false)
    showToast(`✅ Inventur gespeichert – ${updates.length} Artikel aktualisiert`)
    if (!isDemo) {
      await Promise.all(updates.map(a =>
        insertLagerBewegung({ typ: 'Inventur', artikel: a.name, menge: a.bestand, mitarbeiter: 'Inventur' }).catch(() => {})
      ))
    }
  }

  // ── Stellplatz CRUD ──────────────────────────────────────────────────────────

  const handleSaveStellplatz = async (form: StellplatzForm) => {
    const codeNorm = form.code.trim().toUpperCase()
    const isEdit = spModal !== null && spModal !== 'new'
    const editId = isEdit ? (spModal as Stellplatz).id : null

    // Eindeutigkeit prüfen
    const duplicate = stellplaetze.find(sp => sp.code.toUpperCase() === codeNorm && sp.id !== editId)
    if (duplicate) { showToast(`⚠️ Code "${codeNorm}" existiert bereits`, false); return }

    const id = editId ?? (isDemo
      ? `SP-${Date.now().toString(36).toUpperCase()}`
      : crypto.randomUUID())

    const payload: Stellplatz = {
      id,
      code: codeNorm,
      name: form.name || undefined,
      bereich: form.bereich || undefined,
      zone: form.zone || undefined,
      typ: form.typ || undefined,
      warengruppe: form.warengruppe || undefined,
      aktiv: form.aktiv,
      notiz: form.notiz || undefined,
    }

    setSaving(true)
    if (!isDemo) {
      try {
        await upsertLagerStellplatz({
          id,
          code: codeNorm,
          name: form.name || undefined,
          bereich: form.bereich || undefined,
          zone: form.zone || undefined,
          gang: form.gang || undefined,
          regal: form.regal || undefined,
          ebene: form.ebene || undefined,
          fach: form.fach || undefined,
          typ: form.typ || undefined,
          warengruppe: form.warengruppe || undefined,
          warenobergruppe: form.warenobergruppe || undefined,
          temperaturzone: form.temperaturzone || undefined,
          max_gewicht: form.max_gewicht ? parseFloat(form.max_gewicht) : undefined,
          max_volumen: form.max_volumen ? parseFloat(form.max_volumen) : undefined,
          aktiv: form.aktiv,
          notiz: form.notiz || undefined,
        })
      } catch { showToast('Fehler beim Speichern', false); setSaving(false); return }
    }

    setStellplaetze(prev => isEdit ? prev.map(sp => sp.id === id ? payload : sp) : [...prev, payload])
    setSpModal(null)
    setSaving(false)
    showToast(isEdit ? `✅ "${codeNorm}" aktualisiert` : `✅ Stellplatz "${codeNorm}" angelegt`)
  }

  const handleDeleteStellplatz = async (id: string) => {
    if (!isDemo) {
      try { await deleteLagerStellplatz(id) }
      catch { showToast('Fehler beim Löschen', false); setSpDeleteConfirmId(null); return }
    }
    setStellplaetze(prev => prev.filter(sp => sp.id !== id))
    setSpDeleteConfirmId(null)
    showToast('🗑 Stellplatz gelöscht')
  }

  // ── Lagerbelegung Helpers ────────────────────────────────────────────────────

  function mhdStatus(mhd: string | undefined): 'abgelaufen' | 'kritisch' | 'ok' | 'kein' {
    if (!mhd) return 'kein'
    const diff = (new Date(mhd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'abgelaufen'
    if (diff < 30) return 'kritisch'
    return 'ok'
  }

  const handleDeleteStellplatzBestand = async (id: string) => {
    if (!isDemo) {
      try { await deleteLagerStellplatzBestand(id) }
      catch { showToast('Fehler beim Entfernen', false); setLbDeleteConfirmId(null); return }
    }
    setStellplatzBestand(prev => prev.filter(sb => sb.id !== id))
    setLbDeleteConfirmId(null)
    showToast('🗑 Bestand-Position entfernt')
  }

  // ── Umlagerung ───────────────────────────────────────────────────────────────

  const handleUmlagerung = async () => {
    const { vonBestandId, nachStellplatzId, menge: mengeStr, grund, notiz } = umlForm
    if (!vonBestandId || !nachStellplatzId || !mengeStr) return
    const menge = parseInt(mengeStr)
    if (isNaN(menge) || menge <= 0) return

    const vonBestand = stellplatzBestand.find(sb => sb.id === vonBestandId)
    if (!vonBestand) { showToast('Quell-Position nicht gefunden', false); return }
    if (vonBestand.menge < menge) {
      showToast(`⚠️ Nur ${vonBestand.menge} ${vonBestand.einheit ?? 'Stk'} verfügbar`, false)
      return
    }
    if (vonBestand.stellplatz_id === nachStellplatzId) {
      showToast('Quelle und Ziel sind identisch', false); return
    }

    setSaving(true)

    if (!isDemo) {
      try {
        await umlagerArtikel({
          vonBestandId,
          nachStellplatzId,
          menge,
          grund: grund || undefined,
          notiz: notiz || undefined,
        })
        const [sp, sb, uml] = await Promise.all([
          getLagerStellplaetze(), getLagerStellplatzBestand(), getLagerUmlagerungen(),
        ])
        setStellplaetze(sp as Stellplatz[])
        setStellplatzBestand(sb as StellplatzBestand[])
        setUmlagerungen(uml as Umlagerung[])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Fehler bei Umlagerung'
        showToast(msg, false); setSaving(false); return
      }
    } else {
      // Demo: lokalen State simulieren
      setStellplatzBestand(prev => {
        let next = [...prev]
        // Quelle reduzieren oder entfernen
        if (vonBestand.menge === menge) {
          next = next.filter(sb => sb.id !== vonBestandId)
        } else {
          next = next.map(sb => sb.id === vonBestandId ? { ...sb, menge: sb.menge - menge } : sb)
        }
        // Ziel: bestehende Position gleicher Artikel+Charge aufstocken oder neu anlegen
        const ziel = next.find(sb =>
          sb.stellplatz_id === nachStellplatzId &&
          sb.artikelnummer === vonBestand.artikelnummer &&
          (sb.charge ?? '') === (vonBestand.charge ?? '')
        )
        const nachSp = stellplaetze.find(sp => sp.id === nachStellplatzId)
        if (ziel) {
          next = next.map(sb => sb.id === ziel.id ? { ...sb, menge: sb.menge + menge } : sb)
        } else {
          next.push({
            id: `SB-${Date.now().toString(36).toUpperCase()}`,
            stellplatz_id: nachStellplatzId,
            artikelnummer: vonBestand.artikelnummer,
            artikelname: vonBestand.artikelname,
            charge: vonBestand.charge,
            mhd: vonBestand.mhd,
            menge,
            einheit: vonBestand.einheit,
            status: 'Verfügbar',
            eingelagert_am: new Date().toISOString().slice(0, 10),
            lager_stellplaetze: nachSp ? { code: nachSp.code, bereich: nachSp.bereich } : undefined,
          })
        }
        return next
      })
      setUmlagerungen(prev => [{
        id: `UML-${Date.now().toString(36).toUpperCase()}`,
        artikelname: vonBestand.artikelname,
        artikelnummer: vonBestand.artikelnummer,
        von_stellplatz_id: vonBestand.stellplatz_id,
        nach_stellplatz_id: nachStellplatzId,
        menge,
        grund: grund || undefined,
        datum: new Date().toISOString(),
      }, ...prev])
    }

    const vonSp = stellplaetze.find(sp => sp.id === vonBestand.stellplatz_id)
    const nachSp = stellplaetze.find(sp => sp.id === nachStellplatzId)
    showToast(`✅ ${menge}× "${vonBestand.artikelname}" von ${vonSp?.code ?? '?'} → ${nachSp?.code ?? '?'}`)
    setUmlForm(emptyUmlagerungForm)
    setSaving(false)
  }

  // ── Bestellvorschlag ─────────────────────────────────────────────────────────

  const bestellArtikel = artikel.filter(a => a.bestand === 0 || a.bestand <= (a.mindestbestand ?? 0))

  const getBestellMenge = (a: Artikel) => {
    if (bestellMengen[a.id] !== undefined) return bestellMengen[a.id]
    return String((a.mindestbestand ?? 0) * 2)
  }

  const handleBestellungAusloesen = (a: Artikel) => {
    setBestellModal(a)
  }

  const handleBestellungBestaetigen = (id: string, menge: string) => {
    setBestelltIds(prev => { const next = new Set(Array.from(prev)); next.add(id); return next })
    if (menge) setBestellMengen(prev => ({ ...prev, [id]: menge }))
    setBestellModal(null)
    showToast(`✅ Bestellung für "${bestellModal?.name}" (${menge} ${bestellModal?.einheit}) wurde ausgelöst`)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const statsNiedrig = artikel.filter(a => a.status === 'niedrig').length
  const statsLeer = artikel.filter(a => a.status === 'leer').length
  const gesamtWert = artikel.reduce((s, a) => s + a.bestand, 0)

  const warnArtikel = artikel.filter(a => a.status === 'niedrig' || a.status === 'leer')

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Lagerdaten…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Artikel-Modal */}
      {modal !== null && (
        <ArtikelModal
          artikel={modal === 'new' ? null : modal}
          onSave={handleSaveArtikel}
          onClose={() => setModal(null)}
        />
      )}

      {/* Bestell-Detail-Modal */}
      {bestellModal && (
        <BestellDetailModal
          artikel={bestellModal}
          menge={getBestellMenge(bestellModal)}
          onConfirm={(m) => handleBestellungBestaetigen(bestellModal.id, m)}
          onClose={() => setBestellModal(null)}
        />
      )}

      {/* Stellplatz-Modal */}
      {spModal !== null && (
        <StellplatzModal
          stellplatz={spModal === 'new' ? null : spModal}
          onSave={handleSaveStellplatz}
          onClose={() => setSpModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '14px 20px', borderRadius: 12, fontWeight: 600, fontSize: 14,
          background: toast.ok ? 'rgba(37,211,102,.15)' : 'rgba(255,80,80,.15)',
          border: `1px solid ${toast.ok ? 'rgba(37,211,102,.4)' : 'rgba(255,80,80,.4)'}`,
          color: toast.ok ? '#4ddb7e' : '#ff8080',
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          animation: 'fadeIn .2s ease',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📦</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>LagerPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Wareneingang · Warenausgang · Bestände · Inventur</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="pk-btn" onClick={() => setModal('new')} style={{ fontSize: 13 }}>+ Artikel anlegen</button>
          <span className="badge badge-green">● AKTIV</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Artikel gesamt', value: String(artikel.length), icon: '📦', color: '#1684ff' },
          { label: 'Gesamtbestand', value: gesamtWert.toLocaleString('de-DE'), icon: '🔢', color: '#20c8ff' },
          { label: 'Niedrig Bestand', value: String(statsNiedrig), icon: '⚠️', color: '#f59e0b' },
          { label: 'Leer / 0', value: String(statsLeer), icon: '🚨', color: '#f43f5e' },
          { label: 'Buchungen', value: String(bewegungen.length), icon: '🔄', color: '#10b981' },
          { label: 'Bestellpflichtig', value: String(bestellArtikel.length), icon: '🛒', color: bestellArtikel.length > 0 ? '#f59e0b' : '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Warnhinweis niedrig/leer – klappbar */}
      {(statsNiedrig > 0 || statsLeer > 0) && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#fbbf24', flex: 1 }}>
              <b>{statsLeer} Artikel leer</b> · <b>{statsNiedrig} Artikel unter Mindestbestand</b> – Nachbestellung empfohlen
            </span>
            <button
              onClick={() => setWarnListOpen(o => !o)}
              style={{ background: 'transparent', border: '1px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#fbbf24', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
            >
              {warnListOpen ? 'Schließen ▲' : 'Artikel anzeigen ▼'}
            </button>
          </div>
          {warnListOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(245,158,11,.15)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {warnArtikel.map(a => (
                <span
                  key={a.id}
                  style={{
                    fontSize: 12, padding: '3px 9px', borderRadius: 6, fontWeight: 600,
                    background: a.status === 'leer' ? 'rgba(244,63,94,.12)' : 'rgba(245,158,11,.12)',
                    border: `1px solid ${a.status === 'leer' ? 'rgba(244,63,94,.3)' : 'rgba(245,158,11,.3)'}`,
                    color: a.status === 'leer' ? '#f43f5e' : '#f59e0b',
                  }}
                >
                  {a.status === 'leer' ? '🚨' : '⚠️'} {a.name} ({a.bestand} {a.einheit})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bestandsalarm nach Ausgang */}
      {bestellHint && (
        <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <span style={{ fontSize: 13, color: '#f87171', flex: 1, fontWeight: 600 }}>{bestellHint}</span>
          <button
            onClick={() => { setTab('bestellung'); setBestellHint(null) }}
            style={{ background: 'rgba(244,63,94,.15)', border: '1px solid rgba(244,63,94,.35)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', color: '#f87171', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Bestellvorschlag anzeigen →
          </button>
          <button onClick={() => setBestellHint(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="pk-tab-bar" style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {[
          { id: 'bestand', label: '📦 Bestand' },
          { id: 'bewegungen', label: '🔄 Bewegungen' },
          { id: 'eingang', label: '📥 Wareneingang' },
          { id: 'ausgang', label: '📤 Warenausgang' },
          { id: 'inventur', label: '📋 Inventur' },
          { id: 'bestellung', label: `🛒 Bestellvorschlag${bestellArtikel.length > 0 ? ` (${bestellArtikel.length})` : ''}` },
          { id: 'historie', label: '📈 Artikel-Historie' },
          { id: 'stellplaetze', label: '📍 Stellplätze' },
          { id: 'lagerbelegung', label: '📊 Lagerbelegung' },
          { id: 'umlagerung', label: '↔️ Umlagerung' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as LagerTab)} style={{ padding: '10px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'transparent', borderBottom: tab === t.id ? '2px solid #1684ff' : '2px solid transparent', color: tab === t.id ? '#6cb6ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BESTAND ── */}
      {tab === 'bestand' && (
        <div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="pk-input" placeholder="🔍 Suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <select className="pk-input" value={filterKat} onChange={e => setFilterKat(e.target.value)} style={{ maxWidth: 180 }}>
              <option>Alle</option>
              {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {artikel.length} Artikel</span>
            <button
              className="pk-btn-ghost"
              onClick={() => exportCSV(sorted)}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '7px 14px' }}
            >
              📥 CSV Export
            </button>
          </div>
          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th
                      onClick={() => handleSort('id')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Art.-Nr.{sortArrow('id')}
                    </th>
                    <th
                      onClick={() => handleSort('name')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Bezeichnung{sortArrow('name')}
                    </th>
                    <th>Kategorie</th>
                    <th
                      onClick={() => handleSort('bestand')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Bestand{sortArrow('bestand')}
                    </th>
                    <th>Mindest</th>
                    <th>Lagerplatz</th>
                    <th
                      onClick={() => handleSort('status')}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      Status{sortArrow('status')}
                    </th>
                    <th style={{ width: 110 }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
                      {artikel.length === 0 ? '📦 Noch keine Artikel. Lege deinen ersten Artikel an.' : 'Keine Artikel gefunden.'}
                    </td></tr>
                  ) : sorted.map(a => (
                    <tr key={a.id}>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td><span className="badge badge-gray">{a.kategorie}</span></td>
                      <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : a.status === 'niedrig' ? '#f59e0b' : '#f8fbff' }}>
                        {a.bestand} {a.einheit}
                      </td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.mindestbestand ?? 0} {a.einheit}</td>
                      <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.lagerplatz}</td>
                      <td>
                        <span className={`badge ${a.status === 'ok' ? 'badge-green' : a.status === 'niedrig' ? 'badge-orange' : 'badge-red'}`}>
                          {a.status === 'ok' ? '✅ OK' : a.status === 'niedrig' ? '⚠️ Niedrig' : '🚨 Leer'}
                        </span>
                      </td>
                      <td>
                          {deleteConfirmId === a.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                onClick={() => handleDeleteArtikel(a.id)}
                                style={{ background: 'rgba(244,63,94,.18)', border: '1px solid rgba(244,63,94,.4)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              >
                                Ja, löschen
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#aeb9c8', fontSize: 11, whiteSpace: 'nowrap' }}
                              >
                                Abbrechen
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setModal(a)} title="Bearbeiten" style={{ background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13 }}>✏️</button>
                              <button onClick={() => { setHistArtikel(a.id); setTab('historie') }} title="Artikel-Historie" style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#34d399', fontSize: 13 }}>📈</button>
                              <button onClick={() => setDeleteConfirmId(a.id)} title="Löschen" style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}>🗑</button>
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── BEWEGUNGEN ── */}
      {tab === 'bewegungen' && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 13, color: '#aeb9c8' }}>
            Alle {bewegungen.length} Lagerbewegungen
          </div>
          <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr><th>Typ</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Mitarbeiter</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {bewegungen.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>🔄 Noch keine Buchungen vorhanden.</td></tr>
                  ) : bewegungen.map(b => (
                    <tr key={b.id}>
                      <td>
                        <span className={`badge ${b.typ === 'Eingang' ? 'badge-green' : b.typ === 'Inventur' ? 'badge-blue' : 'badge-orange'}`}>
                          {b.typ === 'Eingang' ? '📥' : b.typ === 'Inventur' ? '📋' : '📤'} {b.typ}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.artikel}</td>
                      <td style={{ fontWeight: 700 }}>{b.menge}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                      <td style={{ color: '#aeb9c8' }}>{b.mitarbeiter}</td>
                      <td>
                        <span className={`badge ${b.status === 'KI erkannt' ? 'badge-purple' : 'badge-green'}`}>
                          {b.status === 'KI erkannt' ? '🧠 ' : '✅ '}{b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENEINGANG ── */}
      {tab === 'eingang' && (
        <div style={{ maxWidth: 560 }}>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>📥 Wareneingang buchen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel *</label>
                <input className="pk-input" placeholder="Artikelname eingeben oder auswählen" value={newEingang.artikel} onChange={e => setNewEingang(p => ({ ...p, artikel: e.target.value }))} list="ei-artikel-list" />
                <datalist id="ei-artikel-list">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
                {newEingang.artikel && artikel.find(a => a.name === newEingang.artikel) && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#aeb9c8' }}>
                    Aktueller Bestand: <b style={{ color: '#f8fbff' }}>{artikel.find(a => a.name === newEingang.artikel)?.bestand} {artikel.find(a => a.name === newEingang.artikel)?.einheit}</b>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge *</label>
                  <input className="pk-input" placeholder="z.B. 100" type="number" min="1" value={newEingang.menge} onChange={e => setNewEingang(p => ({ ...p, menge: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Lagerplatz</label>
                  <input className="pk-input" placeholder="z.B. A-01-03" value={newEingang.lagerplatz} onChange={e => setNewEingang(p => ({ ...p, lagerplatz: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name des Mitarbeiters" value={newEingang.mitarbeiter} onChange={e => setNewEingang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleEingang} disabled={saving || !newEingang.artikel || !newEingang.menge} style={{ fontWeight: 700, minHeight: 44 }}>
                {saving ? '⏳ Wird gebucht…' : '📥 Wareneingang buchen'}
              </button>
            </div>
          </div>
          <div className="pk-card" style={{ background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.15)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22 }}>🧠</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>KI-Erkennung</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>Lieferschein fotografieren → Daten automatisch erfassen</div>
                <button className="pk-btn-ghost" onClick={() => window.location.href = '/dashboard/ki-erkennung'} style={{ fontSize: 12, marginTop: 10, padding: '7px 14px' }}>📸 KI Erkennung öffnen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WARENAUSGANG ── */}
      {tab === 'ausgang' && (
        <div style={{ maxWidth: 560 }}>
          <div className="pk-card">
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>📤 Warenausgang buchen</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Artikel *</label>
                <input className="pk-input" placeholder="Artikelname eingeben oder auswählen" value={newAusgang.artikel} onChange={e => setNewAusgang(p => ({ ...p, artikel: e.target.value }))} list="au-artikel-list" />
                <datalist id="au-artikel-list">{artikel.map(a => <option key={a.id} value={a.name} />)}</datalist>
                {newAusgang.artikel && (() => {
                  const found = artikel.find(a => a.name === newAusgang.artikel)
                  if (!found) return null
                  return (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      Verfügbar: <b style={{ color: found.bestand === 0 ? '#f43f5e' : found.bestand <= (found.mindestbestand ?? 0) ? '#f59e0b' : '#4ddb7e' }}>
                        {found.bestand} {found.einheit}
                      </b>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Menge *</label>
                  <input className="pk-input" placeholder="z.B. 50" type="number" min="1" value={newAusgang.menge} onChange={e => setNewAusgang(p => ({ ...p, menge: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Empfänger / Auftrag</label>
                  <input className="pk-input" placeholder="z.B. A-2025-034" value={newAusgang.empfaenger} onChange={e => setNewAusgang(p => ({ ...p, empfaenger: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Mitarbeiter</label>
                <input className="pk-input" placeholder="Name des Mitarbeiters" value={newAusgang.mitarbeiter} onChange={e => setNewAusgang(p => ({ ...p, mitarbeiter: e.target.value }))} />
              </div>
              <button className="pk-btn" onClick={handleAusgang} disabled={saving || !newAusgang.artikel || !newAusgang.menge} style={{ fontWeight: 700, minHeight: 44, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                {saving ? '⏳ Wird gebucht…' : '📤 Warenausgang buchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVENTUR ── */}
      {tab === 'inventur' && (
        <div>
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 13, color: '#aeb9c8' }}>
            📋 <b style={{ color: '#f8fbff' }}>Inventur-Modus:</b> Trage den gezählten Ist-Bestand ein. Nur ausgefüllte Felder werden aktualisiert.
          </div>
          <div className="pk-card" style={{ padding: 0, overflowX: 'auto', marginBottom: 16 }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Art.-Nr.</th><th>Bezeichnung</th><th>Einheit</th>
                    <th>Soll (System)</th><th>Ist-Bestand (Zählung)</th><th>Differenz</th>
                  </tr>
                </thead>
                <tbody>
                  {artikel.map(a => {
                    const istVal = inventurWerte[a.id]
                    const ist = istVal !== undefined && istVal !== '' ? parseInt(istVal) : null
                    const diff = ist !== null ? ist - a.bestand : null
                    return (
                      <tr key={a.id}>
                        <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ color: '#aeb9c8' }}>{a.einheit}</td>
                        <td style={{ fontWeight: 700 }}>{a.bestand}</td>
                        <td>
                          <input
                            type="number" min="0"
                            placeholder={String(a.bestand)}
                            value={inventurWerte[a.id] ?? ''}
                            onChange={e => setInventurWerte(p => ({ ...p, [a.id]: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px', color: '#f8fbff', fontSize: 14, width: 90, outline: 'none' }}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: diff === null ? '#aeb9c8' : diff > 0 ? '#4ddb7e' : diff < 0 ? '#f43f5e' : '#aeb9c8' }}>
                          {diff === null ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleInventurSave} disabled={saving || Object.keys(inventurWerte).length === 0} style={{ fontWeight: 700 }}>
              {saving ? '⏳ Speichert…' : '✅ Inventur speichern'}
            </button>
            <button className="pk-btn-ghost" onClick={() => setInventurWerte({})} style={{ fontSize: 13 }}>Zurücksetzen</button>
          </div>
        </div>
      )}

      {/* ── BESTELLVORSCHLAG ── */}
      {tab === 'bestellung' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 13, color: '#fbbf24', flex: 1, minWidth: 200 }}>
              🛒 <b>{bestellArtikel.length} Artikel</b> benötigen eine Nachbestellung (Bestand leer oder unter Mindestbestand)
            </div>
            {bestellArtikel.length > 0 && bestelltIds.size < bestellArtikel.length && (
              <button
                onClick={() => {
                  const offene = bestellArtikel.filter(a => !bestelltIds.has(a.id))
                  offene.forEach(a => {
                    setBestelltIds(prev => { const n = new Set(Array.from(prev)); n.add(a.id); return n })
                  })
                  showToast(`✅ ${offene.length} Bestellung(en) auf einmal ausgelöst`)
                }}
                style={{ background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.35)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                🛒 Alle bestellen ({bestellArtikel.filter(a => !bestelltIds.has(a.id)).length})
              </button>
            )}
          </div>

          {bestellArtikel.length === 0 ? (
            <div className="pk-card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Alle Bestände ausreichend</div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Aktuell sind alle Artikel über dem Mindestbestand.</div>
            </div>
          ) : (
            <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Art.-Nr.</th>
                      <th>Bezeichnung</th>
                      <th>Kategorie</th>
                      <th>Aktueller Bestand</th>
                      <th>Mindestbestand</th>
                      <th>Vorschlag-Menge</th>
                      <th style={{ width: 160 }}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestellArtikel.map(a => {
                      const bestellt = bestelltIds.has(a.id)
                      return (
                        <tr key={a.id} style={{ opacity: bestellt ? 0.55 : 1 }}>
                          <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                          <td style={{ fontWeight: 600 }}>{a.name}</td>
                          <td><span className="badge badge-gray">{a.kategorie}</span></td>
                          <td style={{ fontWeight: 700, color: a.status === 'leer' ? '#f43f5e' : '#f59e0b' }}>
                            {a.bestand} {a.einheit}
                            <span style={{ marginLeft: 6 }}>
                              <span className={`badge ${a.status === 'leer' ? 'badge-red' : 'badge-orange'}`} style={{ fontSize: 10 }}>
                                {a.status === 'leer' ? '🚨 Leer' : '⚠️ Niedrig'}
                              </span>
                            </span>
                          </td>
                          <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.mindestbestand ?? 0} {a.einheit}</td>
                          <td>
                            {bestellt ? (
                              <span style={{ color: '#aeb9c8', fontSize: 13 }}>{getBestellMenge(a)} {a.einheit}</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={getBestellMenge(a)}
                                  onChange={e => setBestellMengen(p => ({ ...p, [a.id]: e.target.value }))}
                                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '5px 8px', color: '#f8fbff', fontSize: 13, width: 80, outline: 'none' }}
                                />
                                <span style={{ color: '#aeb9c8', fontSize: 12 }}>{a.einheit}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {bestellt ? (
                              <span className="badge badge-green" style={{ fontSize: 11 }}>✅ Bestellt</span>
                            ) : (
                              <button
                                onClick={() => handleBestellungAusloesen(a)}
                                style={{
                                  background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.35)',
                                  borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                                  color: '#6cb6ff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                                }}
                              >
                                🛒 Bestellung auslösen
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bestelltIds.size > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#aeb9c8' }}>{bestelltIds.size} Bestellung(en) ausgelöst</span>
              <button
                className="pk-btn-ghost"
                onClick={() => setBestelltIds(new Set())}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                Zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STELLPLÄTZE ── */}
      {tab === 'stellplaetze' && (() => {
        const belegteIds = new Set(stellplatzBestand.map(sb => sb.stellplatz_id))
        const spAktiv = stellplaetze.filter(sp => sp.aktiv !== false).length
        const spBelegt = stellplaetze.filter(sp => belegteIds.has(sp.id)).length
        const spFrei = stellplaetze.filter(sp => !belegteIds.has(sp.id)).length

        const bereiche = ['Alle', ...Array.from(new Set(stellplaetze.map(sp => sp.bereich).filter(Boolean) as string[]))]

        const filtered = stellplaetze.filter(sp => {
          const q = spSearch.toLowerCase()
          const matchQ = !q || sp.code.toLowerCase().includes(q) || (sp.name ?? '').toLowerCase().includes(q) || (sp.bereich ?? '').toLowerCase().includes(q)
          const matchB = spFilterBereich === 'Alle' || sp.bereich === spFilterBereich
          return matchQ && matchB
        })

        return (
          <div>
            {/* KPIs */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Stellplätze gesamt', value: String(stellplaetze.length), icon: '📍', color: '#1684ff' },
                { label: 'Aktiv', value: String(spAktiv), icon: '✅', color: '#10b981' },
                { label: 'Belegt', value: String(spBelegt), icon: '📦', color: '#f59e0b' },
                { label: 'Frei', value: String(spFrei), icon: '🟢', color: '#10b981' },
              ].map(s => (
                <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="pk-input"
                placeholder="🔍 Code, Name, Bereich…"
                value={spSearch}
                onChange={e => setSpSearch(e.target.value)}
                style={{ maxWidth: 260 }}
              />
              <select className="pk-input" value={spFilterBereich} onChange={e => setSpFilterBereich(e.target.value)} style={{ maxWidth: 180 }}>
                {bereiche.map(b => <option key={b}>{b}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {stellplaetze.length}</span>
              <button className="pk-btn" onClick={() => setSpModal('new')} style={{ marginLeft: 'auto', fontSize: 13 }}>
                + Stellplatz anlegen
              </button>
            </div>

            {/* Tabelle */}
            <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr><th>Code</th><th>Bezeichnung</th><th>Bereich</th><th>Typ</th><th>Status</th><th style={{ width: 110 }}>Aktionen</th></tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
                        {stellplaetze.length === 0 ? '📍 Noch keine Stellplätze. Lege deinen ersten an.' : 'Keine Stellplätze gefunden.'}
                      </td></tr>
                    ) : filtered.map(sp => (
                      <tr key={sp.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6cb6ff' }}>{sp.code}</td>
                        <td style={{ color: '#aeb9c8', fontSize: 13 }}>{sp.name ?? '—'}</td>
                        <td><span className="badge badge-gray">{sp.bereich ?? '—'}</span></td>
                        <td style={{ color: '#aeb9c8', fontSize: 13 }}>{sp.typ ?? '—'}</td>
                        <td>
                          <span className={`badge ${sp.aktiv !== false ? 'badge-green' : 'badge-red'}`}>
                            {sp.aktiv !== false ? '✅ Aktiv' : '🚫 Inaktiv'}
                          </span>
                        </td>
                        <td>
                          {spDeleteConfirmId === sp.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                onClick={() => handleDeleteStellplatz(sp.id)}
                                style={{ background: 'rgba(244,63,94,.18)', border: '1px solid rgba(244,63,94,.4)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                              >Ja, löschen</button>
                              <button
                                onClick={() => setSpDeleteConfirmId(null)}
                                style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#aeb9c8', fontSize: 11, whiteSpace: 'nowrap' }}
                              >Abbrechen</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setSpModal(sp)} title="Bearbeiten" style={{ background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6cb6ff', fontSize: 13 }}>✏️</button>
                              <button onClick={() => setSpDeleteConfirmId(sp.id)} title="Löschen" style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}>🗑</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── LAGERBELEGUNG ── */}
      {tab === 'lagerbelegung' && (() => {
        const bereiche = ['Alle', ...Array.from(new Set(
          stellplatzBestand
            .map(sb => stellplaetze.find(sp => sp.id === sb.stellplatz_id)?.bereich)
            .filter(Boolean) as string[]
        ))]

        const filtered = stellplatzBestand.filter(sb => {
          const sp = stellplaetze.find(x => x.id === sb.stellplatz_id)
          const q = lbSearch.toLowerCase()
          const matchQ = !q ||
            (sb.artikelname ?? '').toLowerCase().includes(q) ||
            (sb.artikelnummer ?? '').toLowerCase().includes(q) ||
            (sp?.code ?? '').toLowerCase().includes(q)
          const matchB = lbFilterBereich === 'Alle' || sp?.bereich === lbFilterBereich
          const matchMhd = !lbNurMhdKritisch || mhdStatus(sb.mhd) === 'abgelaufen' || mhdStatus(sb.mhd) === 'kritisch'
          return matchQ && matchB && matchMhd
        })

        const mhdBadge = (mhd: string | undefined) => {
          const s = mhdStatus(mhd)
          if (s === 'kein') return null
          const map = {
            abgelaufen: { cls: 'badge-red',    label: `🚨 ${mhd} (abgelaufen)` },
            kritisch:   { cls: 'badge-orange', label: `⚠️ ${mhd} (<30 Tage)` },
            ok:         { cls: 'badge-green',  label: `✅ ${mhd}` },
          } as const
          const { cls, label } = map[s]
          return <span className={`badge ${cls}`} style={{ fontSize: 11 }}>{label}</span>
        }

        return (
          <div>
            {/* Toolbar */}
            <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="pk-input"
                placeholder="🔍 Artikel, Artikelnr., Stellplatz…"
                value={lbSearch}
                onChange={e => setLbSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <select className="pk-input" value={lbFilterBereich} onChange={e => setLbFilterBereich(e.target.value)} style={{ maxWidth: 180 }}>
                {bereiche.map(b => <option key={b}>{b}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aeb9c8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={lbNurMhdKritisch}
                  onChange={e => setLbNurMhdKritisch(e.target.checked)}
                  style={{ accentColor: '#f59e0b', width: 16, height: 16 }}
                />
                Nur MHD-kritisch
              </label>
              <span style={{ fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {stellplatzBestand.length} Positionen</span>
            </div>

            {/* Tabelle */}
            <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Stellplatz</th>
                      <th>Bereich</th>
                      <th>Artikelnr.</th>
                      <th>Artikelname</th>
                      <th>Charge</th>
                      <th>MHD</th>
                      <th>Menge</th>
                      <th>Status</th>
                      <th>Eingelagert</th>
                      <th style={{ width: 100 }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
                        {stellplatzBestand.length === 0
                          ? '📊 Noch keine Artikel auf Stellplätzen erfasst.'
                          : 'Keine Positionen gefunden.'}
                      </td></tr>
                    ) : filtered.map(sb => {
                      const sp = stellplaetze.find(x => x.id === sb.stellplatz_id)
                      return (
                        <tr key={sb.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6cb6ff' }}>{sp?.code ?? sb.stellplatz_id}</td>
                          <td><span className="badge badge-gray">{sp?.bereich ?? '—'}</span></td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{sb.artikelnummer ?? '—'}</td>
                          <td style={{ fontWeight: 600 }}>{sb.artikelname ?? '—'}</td>
                          <td style={{ color: '#aeb9c8', fontSize: 13 }}>{sb.charge ?? '—'}</td>
                          <td>{mhdBadge(sb.mhd) ?? <span style={{ color: '#aeb9c8', fontSize: 13 }}>—</span>}</td>
                          <td style={{ fontWeight: 700 }}>{sb.menge} <span style={{ color: '#aeb9c8', fontSize: 12 }}>{sb.einheit ?? ''}</span></td>
                          <td>
                            <span className={`badge ${sb.status === 'Leer' ? 'badge-red' : sb.status === 'Gesperrt' ? 'badge-orange' : 'badge-green'}`}>
                              {sb.status ?? 'Verfügbar'}
                            </span>
                          </td>
                          <td style={{ color: '#aeb9c8', fontSize: 12 }}>
                            {sb.eingelagert_am ? new Date(sb.eingelagert_am as string).toLocaleDateString('de-DE') : '—'}
                          </td>
                          <td>
                            {lbDeleteConfirmId === sb.id ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => handleDeleteStellplatzBestand(sb.id)}
                                  style={{ background: 'rgba(244,63,94,.18)', border: '1px solid rgba(244,63,94,.4)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#f43f5e', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                                >Ja</button>
                                <button
                                  onClick={() => setLbDeleteConfirmId(null)}
                                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#aeb9c8', fontSize: 11, whiteSpace: 'nowrap' }}
                                >Nein</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                  title="Bearbeiten (folgt)"
                                  disabled
                                  style={{ background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.15)', borderRadius: 6, padding: '4px 8px', cursor: 'not-allowed', color: '#4a6080', fontSize: 13 }}
                                >✏️</button>
                                <button
                                  onClick={() => setLbDeleteConfirmId(sb.id)}
                                  title="Entfernen"
                                  style={{ background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#f43f5e', fontSize: 13 }}
                                >🗑</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── UMLAGERUNG ── */}
      {tab === 'umlagerung' && (() => {
        const vonBestand = stellplatzBestand.find(sb => sb.id === umlForm.vonBestandId)
        const vonSp = vonBestand ? stellplaetze.find(sp => sp.id === vonBestand.stellplatz_id) : null

        return (
          <div>
            {/* Formular */}
            <div className="pk-card" style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>↔️ Umlagerung durchführen</h3>
              <div style={{ display: 'grid', gap: 14 }}>

                {/* Quell-Position */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Quell-Position * <span style={{ fontWeight: 400 }}>(Stellplatz + Artikel)</span></label>
                  <select
                    className="pk-input"
                    value={umlForm.vonBestandId}
                    onChange={e => setUmlForm(p => ({ ...p, vonBestandId: e.target.value, menge: '' }))}
                  >
                    <option value="">— Quell-Position wählen —</option>
                    {stellplatzBestand.filter(sb => sb.menge > 0).map(sb => {
                      const sp = stellplaetze.find(x => x.id === sb.stellplatz_id)
                      return (
                        <option key={sb.id} value={sb.id}>
                          {sp?.code ?? '?'} · {sb.artikelname ?? sb.artikelnummer ?? '—'}{sb.charge ? ` · Ch: ${sb.charge}` : ''} ({sb.menge} {sb.einheit ?? 'Stk'})
                        </option>
                      )
                    })}
                  </select>
                  {vonBestand && (
                    <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(22,132,255,.07)', border: '1px solid rgba(22,132,255,.18)', fontSize: 12, color: '#aeb9c8', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>📍 <b style={{ color: '#6cb6ff' }}>{vonSp?.code ?? '?'}</b></span>
                      <span>📦 {vonBestand.artikelname}</span>
                      {vonBestand.charge && <span>Charge: {vonBestand.charge}</span>}
                      {vonBestand.mhd && <span>MHD: {vonBestand.mhd}</span>}
                      <span>Verfügbar: <b style={{ color: '#4ddb7e' }}>{vonBestand.menge} {vonBestand.einheit ?? 'Stk'}</b></span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Menge */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>
                      Menge * {vonBestand && <span style={{ color: '#aeb9c8', fontWeight: 400 }}>(max. {vonBestand.menge})</span>}
                    </label>
                    <input
                      className="pk-input"
                      type="number"
                      min="1"
                      max={vonBestand?.menge}
                      placeholder="z.B. 10"
                      value={umlForm.menge}
                      onChange={e => setUmlForm(p => ({ ...p, menge: e.target.value }))}
                    />
                  </div>

                  {/* Ziel-Stellplatz */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Ziel-Stellplatz *</label>
                    <select
                      className="pk-input"
                      value={umlForm.nachStellplatzId}
                      onChange={e => setUmlForm(p => ({ ...p, nachStellplatzId: e.target.value }))}
                    >
                      <option value="">— Ziel wählen —</option>
                      {stellplaetze
                        .filter(sp => sp.aktiv !== false && sp.id !== vonBestand?.stellplatz_id)
                        .map(sp => (
                          <option key={sp.id} value={sp.id}>
                            {sp.code}{sp.bereich ? ` (${sp.bereich})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Grund */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Grund</label>
                  <select
                    className="pk-input"
                    value={umlForm.grund}
                    onChange={e => setUmlForm(p => ({ ...p, grund: e.target.value }))}
                  >
                    <option value="">— Grund wählen —</option>
                    <option>Umlagerung</option>
                    <option>Kommissionierung</option>
                    <option>Sperrlager</option>
                    <option>Inventurkorrektur</option>
                    <option>Versand</option>
                  </select>
                </div>

                {/* Notiz */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#aeb9c8', marginBottom: 6, fontWeight: 600 }}>Notiz</label>
                  <input
                    className="pk-input"
                    placeholder="Optionale Bemerkung"
                    value={umlForm.notiz}
                    onChange={e => setUmlForm(p => ({ ...p, notiz: e.target.value }))}
                  />
                </div>

                <button
                  className="pk-btn"
                  onClick={handleUmlagerung}
                  disabled={saving || !umlForm.vonBestandId || !umlForm.nachStellplatzId || !umlForm.menge}
                  style={{ fontWeight: 700, minHeight: 44 }}
                >
                  {saving ? '⏳ Wird umgelagert…' : '↔️ Umlagerung ausführen'}
                </button>
              </div>
            </div>

            {/* Protokoll */}
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>📋 Umlagerungs-Protokoll</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{umlagerungen.length} Einträge</div>
            </div>
            <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr><th>Artikel</th><th>Von</th><th>Nach</th><th>Menge</th><th>Grund</th><th>Datum</th></tr>
                  </thead>
                  <tbody>
                    {umlagerungen.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>↔️ Noch keine Umlagerungen vorhanden.</td></tr>
                    ) : umlagerungen.map(u => {
                      const von = stellplaetze.find(sp => sp.id === u.von_stellplatz_id)
                      const nach = stellplaetze.find(sp => sp.id === u.nach_stellplatz_id)
                      return (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.artikelname ?? '—'}<br /><span style={{ fontSize: 11, color: '#aeb9c8', fontFamily: 'monospace' }}>{u.artikelnummer ?? ''}</span></td>
                          <td style={{ fontFamily: 'monospace', color: '#f59e0b', fontSize: 13, whiteSpace: 'nowrap' }}>{von?.code ?? u.von_stellplatz_id ?? '—'}</td>
                          <td style={{ fontFamily: 'monospace', color: '#10b981', fontSize: 13, whiteSpace: 'nowrap' }}>{nach?.code ?? u.nach_stellplatz_id ?? '—'}</td>
                          <td style={{ fontWeight: 700 }}>{u.menge}</td>
                          <td style={{ color: '#aeb9c8', fontSize: 13 }}>{u.grund ?? '—'}</td>
                          <td style={{ color: '#aeb9c8', fontSize: 13, whiteSpace: 'nowrap' }}>
                            {u.datum ? new Date(u.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ARTIKEL-HISTORIE ── */}
      {tab === 'historie' && (() => {
        const selectedArtikel = histArtikel ? artikel.find(a => a.id === histArtikel) : null
        const filteredBewegungen = histArtikel
          ? bewegungen.filter(b => {
              const a = artikel.find(x => x.id === histArtikel)
              return a && (b.artikel === a.name || b.artikel === a.id)
            })
          : bewegungen

        const letzterEingang = filteredBewegungen.filter(b => b.typ === 'Eingang').sort((a, b) => b.id > a.id ? 1 : -1)[0]
        const letzterAusgang = filteredBewegungen.filter(b => b.typ === 'Ausgang').sort((a, b) => b.id > a.id ? 1 : -1)[0]
        const gesamtEingang = filteredBewegungen.filter(b => b.typ === 'Eingang').reduce((s, b) => s + b.menge, 0)
        const gesamtAusgang = filteredBewegungen.filter(b => b.typ === 'Ausgang').reduce((s, b) => s + b.menge, 0)

        return (
          <div>
            {/* Filter */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="pk-input"
                value={histArtikel ?? ''}
                onChange={e => setHistArtikel(e.target.value || null)}
                style={{ maxWidth: 320 }}
              >
                <option value="">📦 Alle Artikel</option>
                {artikel.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
              {histArtikel && (
                <button
                  className="pk-btn-ghost"
                  onClick={() => setHistArtikel(null)}
                  style={{ fontSize: 12, padding: '7px 12px' }}
                >✕ Filter aufheben</button>
              )}
              <span style={{ fontSize: 12, color: '#aeb9c8' }}>{filteredBewegungen.length} Bewegungen</span>
            </div>

            {/* Artikel-Detail-Karte */}
            {selectedArtikel && (
              <div style={{ marginBottom: 16, padding: '16px 20px', borderRadius: 12, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Aktueller Bestand', value: `${selectedArtikel.bestand} ${selectedArtikel.einheit}`, icon: '📦', color: selectedArtikel.status === 'leer' ? '#f43f5e' : selectedArtikel.status === 'niedrig' ? '#f59e0b' : '#10b981' },
                  { label: 'Mindestbestand', value: `${selectedArtikel.mindestbestand ?? 0} ${selectedArtikel.einheit}`, icon: '⚠️', color: '#aeb9c8' },
                  { label: 'Ges. Eingang', value: `+${gesamtEingang}`, icon: '📥', color: '#10b981' },
                  { label: 'Ges. Ausgang', value: `-${gesamtAusgang}`, icon: '📤', color: '#f59e0b' },
                  { label: 'Letzter Eingang', value: letzterEingang?.datum ?? '—', icon: '📅', color: '#6cb6ff' },
                  { label: 'Letzter Ausgang', value: letzterAusgang?.datum ?? '—', icon: '📅', color: '#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Bewegungstabelle */}
            <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr><th>Typ</th><th>Artikel</th><th>Menge</th><th>Datum</th><th>Mitarbeiter</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {filteredBewegungen.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
                        {histArtikel ? '📈 Noch keine Bewegungen für diesen Artikel.' : '🔄 Keine Buchungen vorhanden.'}
                      </td></tr>
                    ) : filteredBewegungen.map(b => (
                      <tr key={b.id}>
                        <td>
                          <span className={`badge ${b.typ === 'Eingang' ? 'badge-green' : b.typ === 'Inventur' ? 'badge-blue' : 'badge-orange'}`}>
                            {b.typ === 'Eingang' ? '📥' : b.typ === 'Inventur' ? '📋' : '📤'} {b.typ}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{b.artikel}</td>
                        <td style={{ fontWeight: 700, color: b.typ === 'Eingang' ? '#10b981' : b.typ === 'Ausgang' ? '#f59e0b' : '#6cb6ff' }}>
                          {b.typ === 'Eingang' ? '+' : b.typ === 'Ausgang' ? '-' : ''}{b.menge}
                        </td>
                        <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                        <td style={{ color: '#aeb9c8' }}>{b.mitarbeiter}</td>
                        <td>
                          <span className={`badge ${b.status === 'KI erkannt' ? 'badge-purple' : 'badge-green'}`}>
                            {b.status === 'KI erkannt' ? '🧠 ' : '✅ '}{b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
