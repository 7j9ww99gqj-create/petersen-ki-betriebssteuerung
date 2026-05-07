'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getBueroKunden, upsertBueroKunde, deleteBueroKunde,
  getBueroAngebote, upsertBueroAngebot,
  getBueroAuftraege, upsertBueroAuftrag,
  getBueroRechnungen, upsertBueroRechnung,
  getBueroDokumente, insertBueroDokument, deleteBueroDokument,
} from '@/lib/db'

// ── Typen ───────────────────────────────────────────────────────────────────

type Kunde = {
  id: string; name: string; typ: 'Firma' | 'Privat'; ansprechpartner: string
  email: string; telefon: string; ort: string; umsatz: string; status: 'Aktiv' | 'Inaktiv'
}

type Angebot = {
  id: string; kunde: string; titel: string; betrag: string; datum: string
  gueltig: string; status: 'Entwurf' | 'Versendet' | 'Akzeptiert' | 'Abgelehnt'
}

type Auftrag = {
  id: string; kunde: string; beschreibung: string; wert: string
  start: string; ende: string; status: 'In Bearbeitung' | 'Abgeschlossen' | 'Geplant' | 'Pausiert'
  fortschritt: number
}

type Rechnung = {
  id: string; kunde: string; betrag: string; faellig: string
  erstellt: string; status: 'Offen' | 'Bezahlt' | 'Überfällig' | 'Mahnung'
  bezahltAm?: string
}

type Dokument = {
  id: string; name: string; typ: string; groesse: string; datum: string
  kategorie: 'Angebot' | 'Rechnung' | 'Vertrag' | 'Sonstiges'; bezug: string
}

// ── Demo-Daten ──────────────────────────────────────────────────────────────

const demoKunden: Kunde[] = [
  { id: 'K-001', name: 'Müller Bau GmbH', typ: 'Firma', ansprechpartner: 'Thomas Müller', email: 't.mueller@muellerbu.de', telefon: '040 12345-0', ort: 'Hamburg', umsatz: '84.200 €', status: 'Aktiv' },
  { id: 'K-002', name: 'Schmidt & Partner', typ: 'Firma', ansprechpartner: 'Anna Schmidt', email: 'a.schmidt@sp-kg.de', telefon: '030 98765-10', ort: 'Berlin', umsatz: '31.500 €', status: 'Aktiv' },
  { id: 'K-003', name: 'Technik Nord AG', typ: 'Firma', ansprechpartner: 'Lars Brandt', email: 'l.brandt@techniknord.de', telefon: '0511 44400', ort: 'Hannover', umsatz: '127.800 €', status: 'Aktiv' },
  { id: 'K-004', name: 'Hans Werner', typ: 'Privat', ansprechpartner: 'Hans Werner', email: 'h.werner@web.de', telefon: '0172 5551234', ort: 'Bremen', umsatz: '4.600 €', status: 'Aktiv' },
  { id: 'K-005', name: 'Delta Logistik KG', typ: 'Firma', ansprechpartner: 'Sandra Koch', email: 's.koch@delta-log.de', telefon: '0211 3330', ort: 'Düsseldorf', umsatz: '56.100 €', status: 'Aktiv' },
  { id: 'K-006', name: 'Ritter Elektro GmbH', typ: 'Firma', ansprechpartner: 'Jens Ritter', email: 'j.ritter@ritter-e.de', telefon: '089 10203', ort: 'München', umsatz: '19.200 €', status: 'Inaktiv' },
]

const demoAngebote: Angebot[] = [
  { id: 'ANG-2025-042', kunde: 'Müller Bau GmbH', titel: 'Stahlkonstruktion Hallenerweiterung', betrag: '18.400,00 €', datum: '02.05.2025', gueltig: '01.06.2025', status: 'Versendet' },
  { id: 'ANG-2025-041', kunde: 'Technik Nord AG', titel: 'Wartungsvertrag 2025/26', betrag: '7.200,00 €', datum: '28.04.2025', gueltig: '28.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-040', kunde: 'Delta Logistik KG', titel: 'Regalanlage Lager Ost', betrag: '12.850,00 €', datum: '25.04.2025', gueltig: '25.05.2025', status: 'Entwurf' },
  { id: 'ANG-2025-039', kunde: 'Schmidt & Partner', titel: 'Büromöbel Ausstattung', betrag: '5.640,00 €', datum: '18.04.2025', gueltig: '18.05.2025', status: 'Abgelehnt' },
  { id: 'ANG-2025-038', kunde: 'Hans Werner', titel: 'Carport Montage', betrag: '3.100,00 €', datum: '10.04.2025', gueltig: '10.05.2025', status: 'Akzeptiert' },
  { id: 'ANG-2025-037', kunde: 'Ritter Elektro GmbH', titel: 'Elektroinstallation Erweiterung', betrag: '9.300,00 €', datum: '03.04.2025', gueltig: '03.05.2025', status: 'Versendet' },
]

const demoAuftraege: Auftrag[] = [
  { id: 'A-2025-034', kunde: 'Technik Nord AG', beschreibung: 'Wartungsvertrag – Q2 Durchführung', wert: '1.800,00 €', start: '01.05.2025', ende: '31.05.2025', status: 'In Bearbeitung', fortschritt: 65 },
  { id: 'A-2025-033', kunde: 'Müller Bau GmbH', beschreibung: 'Lieferung Stahlträger Charge 1', wert: '6.200,00 €', start: '15.04.2025', ende: '15.05.2025', status: 'In Bearbeitung', fortschritt: 80 },
  { id: 'A-2025-032', kunde: 'Hans Werner', beschreibung: 'Carport Montage & Fundament', wert: '3.100,00 €', start: '28.04.2025', ende: '10.05.2025', status: 'Geplant', fortschritt: 0 },
  { id: 'A-2025-031', kunde: 'Delta Logistik KG', beschreibung: 'Instandhaltung Förderanlage', wert: '4.400,00 €', start: '01.04.2025', ende: '30.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-030', kunde: 'Schmidt & Partner', beschreibung: 'Druckluftleitungen verlegen', wert: '2.700,00 €', start: '20.03.2025', ende: '10.04.2025', status: 'Abgeschlossen', fortschritt: 100 },
  { id: 'A-2025-029', kunde: 'Ritter Elektro GmbH', beschreibung: 'Schaltschrankbau Sonderanfertigung', wert: '8.900,00 €', start: '10.05.2025', ende: '30.06.2025', status: 'Pausiert', fortschritt: 30 },
]

const demoRechnungen: Rechnung[] = [
  { id: 'RE-2025-078', kunde: 'Delta Logistik KG', betrag: '4.400,00 €', faellig: '10.05.2025', erstellt: '10.04.2025', status: 'Offen' },
  { id: 'RE-2025-077', kunde: 'Schmidt & Partner', betrag: '2.700,00 €', faellig: '08.05.2025', erstellt: '08.04.2025', status: 'Überfällig' },
  { id: 'RE-2025-076', kunde: 'Technik Nord AG', betrag: '7.200,00 €', faellig: '30.05.2025', erstellt: '30.04.2025', status: 'Offen' },
  { id: 'RE-2025-075', kunde: 'Müller Bau GmbH', betrag: '12.600,00 €', faellig: '25.04.2025', erstellt: '25.03.2025', status: 'Bezahlt', bezahltAm: '22.04.2025' },
  { id: 'RE-2025-074', kunde: 'Hans Werner', betrag: '1.500,00 €', faellig: '01.04.2025', erstellt: '01.03.2025', status: 'Mahnung' },
  { id: 'RE-2025-073', kunde: 'Delta Logistik KG', betrag: '3.800,00 €', faellig: '20.03.2025', erstellt: '20.02.2025', status: 'Bezahlt', bezahltAm: '18.03.2025' },
]

const demoDokumente: Dokument[] = [
  { id: 'DOK-001', name: 'Angebot_ANG-2025-042.pdf', typ: 'PDF', groesse: '284 KB', datum: '02.05.2025', kategorie: 'Angebot', bezug: 'Müller Bau GmbH' },
  { id: 'DOK-002', name: 'Rechnung_RE-2025-078.pdf', typ: 'PDF', groesse: '198 KB', datum: '10.04.2025', kategorie: 'Rechnung', bezug: 'Delta Logistik KG' },
  { id: 'DOK-003', name: 'Wartungsvertrag_TechnikNord_2025.pdf', typ: 'PDF', groesse: '1,2 MB', datum: '28.04.2025', kategorie: 'Vertrag', bezug: 'Technik Nord AG' },
  { id: 'DOK-004', name: 'Angebot_ANG-2025-041.pdf', typ: 'PDF', groesse: '312 KB', datum: '28.04.2025', kategorie: 'Angebot', bezug: 'Technik Nord AG' },
  { id: 'DOK-005', name: 'Auftragsbestätigung_A-2025-032.pdf', typ: 'PDF', groesse: '156 KB', datum: '25.04.2025', kategorie: 'Sonstiges', bezug: 'Hans Werner' },
  { id: 'DOK-006', name: 'Lieferschein_A-2025-033_Ch1.pdf', typ: 'PDF', groesse: '89 KB', datum: '15.04.2025', kategorie: 'Sonstiges', bezug: 'Müller Bau GmbH' },
  { id: 'DOK-007', name: 'Rahmenvertrag_DeltaLogistik.pdf', typ: 'PDF', groesse: '2,4 MB', datum: '01.01.2025', kategorie: 'Vertrag', bezug: 'Delta Logistik KG' },
  { id: 'DOK-008', name: 'Mahnung_RE-2025-074.pdf', typ: 'PDF', groesse: '112 KB', datum: '15.04.2025', kategorie: 'Rechnung', bezug: 'Hans Werner' },
]

// ── Hilfs-Funktionen ────────────────────────────────────────────────────────

function parseBetrag(s: string): number {
  const cleaned = s.replace(/[^\d,\.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ── Hilfs-Komponenten ───────────────────────────────────────────────────────

type Tab = 'kunden' | 'angebote' | 'auftraege' | 'rechnungen' | 'dokumente'

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'kunden', label: '👥 Kunden' },
    { id: 'angebote', label: '📋 Angebote' },
    { id: 'auftraege', label: '✅ Aufträge' },
    { id: 'rechnungen', label: '💶 Rechnungen' },
    { id: 'dokumente', label: '🗂️ Dokumente' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: 'transparent', borderBottom: tab === t.id ? '2px solid #20c8ff' : '2px solid transparent',
          color: tab === t.id ? '#20c8ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// Fixed-position Toast (bottom-right)
function Toast({ msg, error }: { msg: string; error?: boolean }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
      padding: '14px 18px', borderRadius: 12, maxWidth: 360,
      background: error ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${error ? 'rgba(255,80,80,.3)' : 'rgba(37,211,102,.3)'}`,
      color: error ? '#ff8080' : '#4ddb7e',
      fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      animation: 'fadeIn .2s ease',
    }}>{msg}</div>
  )
}

// Modal-Komponente (nach PlanungPilot-Pattern)
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Inline-Löschbestätigung
function DeleteConfirm({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.2)' }}>
      <span style={{ fontSize: 12, color: '#ff8080', fontWeight: 600 }}>{label} löschen?</span>
      <button onClick={onConfirm} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.15)', color: '#ff8080', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
      <button onClick={onCancel} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
    </div>
  )
}

function StatusBadgeAngebot({ status }: { status: Angebot['status'] }) {
  const map = {
    Entwurf: 'badge-gray',
    Versendet: 'badge-blue',
    Akzeptiert: 'badge-green',
    Abgelehnt: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

function StatusBadgeAuftrag({ status }: { status: Auftrag['status'] }) {
  const map = {
    'In Bearbeitung': 'badge-blue',
    Abgeschlossen: 'badge-green',
    Geplant: 'badge-gray',
    Pausiert: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

function StatusBadgeRechnung({ status }: { status: Rechnung['status'] }) {
  const map = {
    Offen: 'badge-blue',
    Bezahlt: 'badge-green',
    Überfällig: 'badge-orange',
    Mahnung: 'badge-gray',
  }
  const icons = { Offen: '⏳', Bezahlt: '✅', Überfällig: '⚠️', Mahnung: '📮' }
  return <span className={`badge ${map[status]}`}>{icons[status]} {status}</span>
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#aeb9c8', minWidth: 32 }}>{value}%</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }

// ── Kunden-Tab ──────────────────────────────────────────────────────────────

function KundenTab({ isDemo, auftraege, rechnungen }: { isDemo: boolean; auftraege: Auftrag[]; rechnungen: Rechnung[] }) {
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Kunde | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [form, setForm] = useState({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })

  useEffect(() => {
    if (isDemo) return
    getBueroKunden()
      .then(data => setKunden(data as Kunde[]))
      .catch(() => showToast('Fehler beim Laden der Kunden', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const filtered = kunden.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.id.toLowerCase().includes(search.toLowerCase()) ||
    k.ort.toLowerCase().includes(search.toLowerCase())
  )

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return
    const newKunde: Kunde = {
      id: `K-${String(kunden.length + 1).padStart(3, '0')}`,
      name: form.name, typ: form.typ as Kunde['typ'],
      ansprechpartner: form.ansprechpartner || form.name,
      email: form.email, telefon: form.telefon, ort: form.ort,
      umsatz: '0 €', status: 'Aktiv',
    }
    if (!isDemo) {
      try { await upsertBueroKunde(newKunde) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKunden(prev => [newKunde, ...prev])
    setForm({ name: '', typ: 'Firma', ansprechpartner: '', email: '', telefon: '', ort: '' })
    setShowForm(false)
    showToast(`✅ Kunde "${newKunde.name}" wurde erfolgreich angelegt (${newKunde.id})`)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Kunden…</div>
      </div>
    </div>
  )

  if (selected) {
    return (
      <div className="fade-in">
        <Toast msg={toast} error={toastError} />
        <button className="pk-btn-ghost" onClick={() => setSelected(null)} style={{ marginBottom: 20, fontSize: 13 }}>
          ← Zurück zur Übersicht
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="pk-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(32,200,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {selected.typ === 'Firma' ? '🏢' : '👤'}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{selected.name}</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>{selected.id} · {selected.typ}</div>
              </div>
              <span className={`badge ${selected.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>
                {selected.status}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Ansprechpartner', value: selected.ansprechpartner, icon: '👤' },
                { label: 'E-Mail', value: selected.email, icon: '✉️' },
                { label: 'Telefon', value: selected.telefon, icon: '📞' },
                { label: 'Standort', value: selected.ort, icon: '📍' },
                { label: 'Gesamtumsatz', value: selected.umsatz, icon: '💶' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 16, width: 24 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{r.value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="pk-btn" style={{ fontSize: 13 }}>✉️ E-Mail senden</button>
              <button className="pk-btn-ghost" style={{ fontSize: 13 }}>📋 Angebot erstellen</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="pk-card">
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Letzte Aufträge</h4>
              {auftraege.filter(a => a.kunde === selected.name).slice(0, 3).map(a => (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.id}</div>
                    <div style={{ color: '#aeb9c8', fontSize: 12 }}>{a.beschreibung}</div>
                  </div>
                  <StatusBadgeAuftrag status={a.status} />
                </div>
              ))}
              {auftraege.filter(a => a.kunde === selected.name).length === 0 && (
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Aufträge vorhanden</div>
              )}
            </div>
            <div className="pk-card">
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em' }}>Offene Rechnungen</h4>
              {rechnungen.filter(r => r.kunde === selected.name && r.status !== 'Bezahlt').map(r => (
                <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.id}</div>
                    <div style={{ color: '#aeb9c8', fontSize: 12 }}>Fällig: {r.faellig}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.betrag}</div>
                    <StatusBadgeRechnung status={r.status} />
                  </div>
                </div>
              ))}
              {rechnungen.filter(r => r.kunde === selected.name && r.status !== 'Bezahlt').length === 0 && (
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Alle Rechnungen beglichen ✅</div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Kunden suchen (Name, Nummer, Ort)…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        <button className="pk-btn" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Kunde'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>👥 Neuen Kunden anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name / Firma *</label>
              <input className="pk-input" placeholder="z.B. Müller GmbH" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option>Firma</option>
                <option>Privat</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ansprechpartner</label>
              <input className="pk-input" placeholder="Vor- und Nachname" value={form.ansprechpartner} onChange={e => setForm(p => ({ ...p, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>E-Mail *</label>
              <input className="pk-input" placeholder="email@beispiel.de" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input className="pk-input" placeholder="040 123456" value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ort</label>
              <input className="pk-input" placeholder="Stadt" value={form.ort} onChange={e => setForm(p => ({ ...p, ort: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleSave} style={{ fontWeight: 700 }}>Kunden anlegen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Kd.-Nr.</th>
              <th>Name</th>
              <th>Ansprechpartner</th>
              <th>Ort</th>
              <th>Typ</th>
              <th>Umsatz</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(k => (
              <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(k)}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{k.id}</td>
                <td style={{ fontWeight: 700 }}>{k.typ === 'Firma' ? '🏢' : '👤'} {k.name}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ansprechpartner}</td>
                <td style={{ color: '#aeb9c8' }}>{k.ort}</td>
                <td><span className="badge badge-gray">{k.typ}</span></td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{k.umsatz}</td>
                <td><span className={`badge ${k.status === 'Aktiv' ? 'badge-green' : 'badge-gray'}`}>{k.status}</span></td>
                <td><span style={{ color: '#aeb9c8', fontSize: 16 }}>›</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {kunden.length} Kunden</div>
    </div>
  )
}

// ── Angebote-Tab ────────────────────────────────────────────────────────────

function AngeboteTab({ isDemo, kunden, auftraege, setAuftraege }: { isDemo: boolean; kunden: Kunde[]; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>> }) {
  const [angebote, setAngebote] = useState<Angebot[]>(isDemo ? demoAngebote : [])
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [form, setForm] = useState({ kunde: '', titel: '', betrag: '', gueltig: '' })

  // Edit-Modal
  const [editAngebot, setEditAngebot] = useState<Angebot | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', titel: '', betrag: '', datum: '', gueltig: '', status: 'Entwurf' as Angebot['status'] })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    getBueroAngebote()
      .then(data => setAngebote(data as Angebot[]))
      .catch(() => showToast('Fehler beim Laden der Angebote', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = angebote.filter(a => filterStatus === 'Alle' || a.status === filterStatus)

  const handleSave = async () => {
    if (!form.kunde || !form.titel || !form.betrag) return
    const today = new Date()
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newAng: Angebot = {
      id: `ANG-2025-0${43 + angebote.length - demoAngebote.length}`,
      kunde: form.kunde, titel: form.titel,
      betrag: form.betrag.includes('€') ? form.betrag : `${form.betrag} €`,
      datum: fmt(today),
      gueltig: form.gueltig || fmt(new Date(today.getTime() + 30 * 86400000)),
      status: 'Entwurf',
    }
    if (!isDemo) {
      try { await upsertBueroAngebot(newAng) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => [newAng, ...prev])
    setForm({ kunde: '', titel: '', betrag: '', gueltig: '' })
    setShowForm(false)
    showToast(`✅ Angebot "${newAng.id}" wurde als Entwurf erstellt`)
  }

  const handleStatusChange = async (id: string, status: Angebot['status']) => {
    if (!isDemo) {
      const ang = angebote.find(a => a.id === id)
      if (ang) {
        try { await upsertBueroAngebot({ ...ang, status }) } catch { showToast('Fehler beim Speichern', true); return }
      }
    }
    setAngebote(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    showToast(`✅ Angebot ${id} wurde auf "${status}" gesetzt`)
  }

  const openEdit = (a: Angebot) => {
    setEditAngebot(a)
    setEditForm({ kunde: a.kunde, titel: a.titel, betrag: a.betrag, datum: a.datum, gueltig: a.gueltig, status: a.status })
  }

  const handleEditSave = async () => {
    if (!editAngebot) return
    const updated: Angebot = { ...editAngebot, ...editForm, betrag: editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €` }
    if (!isDemo) {
      try { await upsertBueroAngebot(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAngebote(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAngebot(null)
    showToast(`✅ Angebot ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    // Kein eigener DB-Call für Angebote-Delete in der lib – wir entfernen nur lokal (Demo) oder rufen ggf. einen generischen Delete auf
    if (!isDemo) {
      // Angebote haben ggf. keinen expliziten deleteBueroAngebot – wir aktualisieren den Status auf Abgelehnt als Soft-Delete-Alternative
      const ang = angebote.find(a => a.id === id)
      if (ang) {
        try { await upsertBueroAngebot({ ...ang, status: 'Abgelehnt' }) } catch { showToast('Fehler beim Löschen', true); return }
      }
    }
    setAngebote(prev => prev.filter(a => a.id !== id))
    showToast(`🗑️ Angebot ${id} wurde gelöscht`)
  }

  // Angebot → Auftrag konvertieren
  const handleKonvertieren = async (a: Angebot) => {
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const newAuftrag: Auftrag = {
      id: `A-2025-0${35 + auftraege.length}`,
      kunde: a.kunde,
      beschreibung: a.titel,
      wert: a.betrag,
      start: fmt(today),
      ende: a.gueltig,
      status: 'Geplant',
      fortschritt: 0,
    }
    if (!isDemo) {
      try { await upsertBueroAuftrag(newAuftrag) } catch { showToast('Fehler beim Erstellen des Auftrags', true); return }
    }
    setAuftraege(prev => [newAuftrag, ...prev])
    showToast(`✅ Auftrag ${newAuftrag.id} aus Angebot ${a.id} erstellt`)
  }

  const statusCounts: Record<string, number> = { Alle: angebote.length, Entwurf: 0, Versendet: 0, Akzeptiert: 0, Abgelehnt: 0 }
  angebote.forEach(a => { statusCounts[a.status]++ })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Angebote…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAngebot && (
        <Modal title={`📋 Angebot bearbeiten – ${editAngebot.id}`} onClose={() => setEditAngebot(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" value={editForm.titel} onChange={e => setEditForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€)</label>
              <input className="pk-input" value={editForm.betrag} onChange={e => setEditForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Datum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.datum} onChange={e => setEditForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.gueltig} onChange={e => setEditForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Angebot['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Entwurf</option>
                <option>Versendet</option>
                <option>Akzeptiert</option>
                <option>Abgelehnt</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAngebot(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Alle', 'Entwurf', 'Versendet', 'Akzeptiert', 'Abgelehnt'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({statusCounts[s] ?? angebote.length})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neues Angebot'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📋 Neues Angebot erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Titel / Leistung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsvertrag 2025" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Nettobetrag (€) *</label>
              <input className="pk-input" placeholder="z.B. 4.200,00" value={form.betrag} onChange={e => setForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Gültig bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.gueltig} onChange={e => setForm(p => ({ ...p, gueltig: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Angebots-Nr.</th>
              <th>Kunde</th>
              <th>Leistung</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Gültig bis</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{a.id}</td>
                <td style={{ fontWeight: 600 }}>{a.kunde}</td>
                <td style={{ color: '#d0d9e8' }}>{a.titel}</td>
                <td style={{ fontWeight: 700, color: '#20c8ff' }}>{a.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.datum}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.gueltig}</td>
                <td><StatusBadgeAngebot status={a.status} /></td>
                <td>
                  {deleteId === a.id ? (
                    <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {a.status === 'Entwurf' && (
                        <button onClick={() => handleStatusChange(a.id, 'Versendet')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>
                          📤 Senden
                        </button>
                      )}
                      {a.status === 'Versendet' && (
                        <>
                          <button onClick={() => handleStatusChange(a.id, 'Akzeptiert')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>✅</button>
                          <button onClick={() => handleStatusChange(a.id, 'Abgelehnt')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>✕</button>
                        </>
                      )}
                      {a.status === 'Akzeptiert' && (
                        <button onClick={() => handleKonvertieren(a)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'rgba(37,211,102,.08)', color: '#4ddb7e', cursor: 'pointer', fontWeight: 700 }}>
                          → Auftrag erstellen
                        </button>
                      )}
                      <button onClick={() => openEdit(a)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={() => setDeleteId(a.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Angebote</div>
    </div>
  )
}

// ── Aufträge-Tab ────────────────────────────────────────────────────────────

function AuftraegeTab({ isDemo, auftraege, setAuftraege, kunden }: { isDemo: boolean; auftraege: Auftrag[]; setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>; kunden: Kunde[] }) {
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '' })

  // Edit-Modal
  const [editAuftrag, setEditAuftrag] = useState<Auftrag | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', beschreibung: '', wert: '', start: '', ende: '', status: 'Geplant' as Auftrag['status'], fortschritt: 0 })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = auftraege.filter(a => filterStatus === 'Alle' || a.status === filterStatus)

  const statusColor: Record<string, string> = {
    'In Bearbeitung': '#1684ff',
    Abgeschlossen: '#25d366',
    Geplant: '#aeb9c8',
    Pausiert: '#f59e0b',
  }

  const handleAbschliessen = async (id: string) => {
    const auftrag = auftraege.find(a => a.id === id)
    if (!isDemo && auftrag) {
      try { await upsertBueroAuftrag({ ...auftrag, status: 'Abgeschlossen', fortschritt: 100 }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === id ? { ...a, status: 'Abgeschlossen', fortschritt: 100 } : a))
    showToast(`✅ Auftrag ${id} wurde als abgeschlossen markiert`)
  }

  const handleNeuSave = async () => {
    if (!form.kunde || !form.beschreibung || !form.wert) return
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const today = new Date()
    const newA: Auftrag = {
      id: `A-2025-0${35 + auftraege.length}`,
      kunde: form.kunde, beschreibung: form.beschreibung,
      wert: form.wert.includes('€') ? form.wert : `${form.wert} €`,
      start: form.start || fmt(today),
      ende: form.ende || fmt(new Date(today.getTime() + 30 * 86400000)),
      status: 'Geplant', fortschritt: 0,
    }
    if (!isDemo) {
      try { await upsertBueroAuftrag(newA) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => [newA, ...prev])
    setForm({ kunde: '', beschreibung: '', wert: '', start: '', ende: '' })
    setShowForm(false)
    showToast(`✅ Auftrag ${newA.id} wurde angelegt`)
  }

  const openEdit = (a: Auftrag) => {
    setEditAuftrag(a)
    setEditForm({ kunde: a.kunde, beschreibung: a.beschreibung, wert: a.wert, start: a.start, ende: a.ende, status: a.status, fortschritt: a.fortschritt })
  }

  const handleEditSave = async () => {
    if (!editAuftrag) return
    const updated: Auftrag = { ...editAuftrag, ...editForm, wert: editForm.wert.includes('€') ? editForm.wert : `${editForm.wert} €` }
    if (!isDemo) {
      try { await upsertBueroAuftrag(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAuftraege(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAuftrag(null)
    showToast(`✅ Auftrag ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      const a = auftraege.find(x => x.id === id)
      if (a) {
        try { await upsertBueroAuftrag({ ...a, status: 'Abgeschlossen' }) } catch { showToast('Fehler beim Löschen', true); return }
      }
    }
    setAuftraege(prev => prev.filter(a => a.id !== id))
    showToast(`🗑️ Auftrag ${id} wurde gelöscht`)
  }

  const counts: Record<string, number> = { Alle: auftraege.length }
  auftraege.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editAuftrag && (
        <Modal title={`✅ Auftrag bearbeiten – ${editAuftrag.id}`} onClose={() => setEditAuftrag(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" value={editForm.beschreibung} onChange={e => setEditForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Wert (€)</label>
              <input className="pk-input" value={editForm.wert} onChange={e => setEditForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.start} onChange={e => setEditForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.ende} onChange={e => setEditForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Auftrag['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Geplant</option>
                <option>In Bearbeitung</option>
                <option>Pausiert</option>
                <option>Abgeschlossen</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fortschritt: {editForm.fortschritt}%</label>
              <input type="range" min={0} max={100} value={editForm.fortschritt} onChange={e => setEditForm(p => ({ ...p, fortschritt: Number(e.target.value) }))} style={{ width: '100%', cursor: 'pointer', accentColor: '#20c8ff' }} />
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAuftrag(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {(['Alle', 'In Bearbeitung', 'Geplant', 'Pausiert', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13 }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Auftrag'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>✅ Neuen Auftrag anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Beschreibung *</label>
              <input className="pk-input" placeholder="z.B. Wartungsarbeiten Q3" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Wert (€) *</label>
              <input className="pk-input" placeholder="z.B. 3.500,00" value={form.wert} onChange={e => setForm(p => ({ ...p, wert: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Start</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ende</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.ende} onChange={e => setForm(p => ({ ...p, ende: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeuSave}>Auftrag anlegen</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(a => (
          <div key={a.id} className="pk-card" style={{ border: `1px solid ${statusColor[a.status]}20` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{a.id}</span>
                  <StatusBadgeAuftrag status={a.status} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{a.beschreibung}</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>🏢 {a.kunde}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#20c8ff' }}>{a.wert}</div>
                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 2 }}>{a.start} – {a.ende}</div>
              </div>
            </div>
            <ProgressBar value={a.fortschritt} color={statusColor[a.status]} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {a.status === 'In Bearbeitung' && (
                <button onClick={() => handleAbschliessen(a.id)} style={{ fontSize: 12, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                  ✅ Als abgeschlossen markieren
                </button>
              )}
              <button onClick={() => openEdit(a)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                ✏️ Bearbeiten
              </button>
              {deleteId === a.id ? (
                <DeleteConfirm label={a.id} onConfirm={() => handleDelete(a.id)} onCancel={() => setDeleteId(null)} />
              ) : (
                <button onClick={() => setDeleteId(a.id)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                  🗑️ Löschen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Rechnungen-Tab ──────────────────────────────────────────────────────────

function RechnungenTab({ isDemo, kunden }: { isDemo: boolean; kunden: Kunde[] }) {
  const [rechnungen, setRechnungen] = useState<Rechnung[]>(isDemo ? demoRechnungen : [])
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [form, setForm] = useState({ kunde: '', betrag: '', faellig: '' })

  // Edit-Modal
  const [editRechnung, setEditRechnung] = useState<Rechnung | null>(null)
  const [editForm, setEditForm] = useState({ kunde: '', betrag: '', faellig: '', status: 'Offen' as Rechnung['status'] })

  // Delete-Bestätigung
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    getBueroRechnungen()
      .then(data => setRechnungen(data as Rechnung[]))
      .catch(() => showToast('Fehler beim Laden der Rechnungen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = rechnungen.filter(r => filterStatus === 'Alle' || r.status === filterStatus)
  const counts: Record<string, number> = { Alle: rechnungen.length }
  rechnungen.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })

  // KPI-Summen
  const sumOffen = rechnungen.filter(r => r.status === 'Offen').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumBezahlt = rechnungen.filter(r => r.status === 'Bezahlt').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const sumUeberfaellig = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

  const handleBezahlt = async (id: string) => {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo && rechnung) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Bezahlt', bezahlt_am: today }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Bezahlt', bezahltAm: today } : r))
    showToast(`✅ Rechnung ${id} als bezahlt markiert`)
  }

  const handleMahnung = async (id: string) => {
    const rechnung = rechnungen.find(r => r.id === id)
    if (!isDemo && rechnung) {
      try { await upsertBueroRechnung({ ...rechnung, status: 'Mahnung' }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === id ? { ...r, status: 'Mahnung' } : r))
    showToast(`📮 Mahnung für Rechnung ${id} wurde versendet`)
  }

  const handleNeu = async () => {
    if (!form.kunde || !form.betrag) return
    const today = new Date()
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newRe: Rechnung = {
      id: `RE-2025-0${79 + rechnungen.length - demoRechnungen.length}`,
      kunde: form.kunde,
      betrag: form.betrag.includes('€') ? form.betrag : `${form.betrag} €`,
      faellig: form.faellig || fmt(new Date(today.getTime() + 30 * 86400000)),
      erstellt: fmt(today),
      status: 'Offen',
    }
    if (!isDemo) {
      try { await upsertBueroRechnung(newRe) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => [newRe, ...prev])
    setForm({ kunde: '', betrag: '', faellig: '' })
    setShowForm(false)
    showToast(`✅ Rechnung ${newRe.id} wurde erstellt`)
  }

  const openEdit = (r: Rechnung) => {
    setEditRechnung(r)
    setEditForm({ kunde: r.kunde, betrag: r.betrag, faellig: r.faellig, status: r.status })
  }

  const handleEditSave = async () => {
    if (!editRechnung) return
    const updated: Rechnung = { ...editRechnung, ...editForm, betrag: editForm.betrag.includes('€') ? editForm.betrag : `${editForm.betrag} €` }
    if (!isDemo) {
      try { await upsertBueroRechnung(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRechnungen(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRechnung(null)
    showToast(`✅ Rechnung ${updated.id} wurde aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      const r = rechnungen.find(x => x.id === id)
      if (r) {
        try { await upsertBueroRechnung({ ...r, status: 'Bezahlt' }) } catch { showToast('Fehler beim Löschen', true); return }
      }
    }
    setRechnungen(prev => prev.filter(r => r.id !== id))
    showToast(`🗑️ Rechnung ${id} wurde gelöscht`)
  }

  const offenCount = rechnungen.filter(r => r.status === 'Offen' || r.status === 'Überfällig' || r.status === 'Mahnung').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Rechnungen…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />

      {/* Edit-Modal */}
      {editRechnung && (
        <Modal title={`💶 Rechnung bearbeiten – ${editRechnung.id}`} onClose={() => setEditRechnung(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde</label>
              <select className="pk-input" value={editForm.kunde} onChange={e => setEditForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€)</label>
              <input className="pk-input" value={editForm.betrag} onChange={e => setEditForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Fällig am</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={editForm.faellig} onChange={e => setEditForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Rechnung['status'] }))} style={{ cursor: 'pointer' }}>
                <option>Offen</option>
                <option>Bezahlt</option>
                <option>Überfällig</option>
                <option>Mahnung</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="pk-btn" onClick={handleEditSave}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditRechnung(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Offen', value: fmtEur(sumOffen), icon: '⏳', color: '#20c8ff', bg: 'rgba(32,200,255,.08)', border: 'rgba(32,200,255,.2)' },
          { label: 'Bezahlt', value: fmtEur(sumBezahlt), icon: '✅', color: '#4ddb7e', bg: 'rgba(37,211,102,.08)', border: 'rgba(37,211,102,.2)' },
          { label: 'Überfällig / Mahnung', value: fmtEur(sumUeberfaellig), icon: '⚠️', color: '#ffb347', bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.2)' },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', borderRadius: 12, background: k.bg, border: `1px solid ${k.border}` }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {offenCount > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ffb347' }}>
            {offenCount} offene Rechnungen – bitte prüfen und ggf. mahnen
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Offen', 'Überfällig', 'Mahnung', 'Bezahlt'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterStatus === s ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {s} <span style={{ opacity: .7 }}>({counts[s] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Rechnung'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(32,200,255,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>💶 Neue Rechnung erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Kunde *</label>
              <select className="pk-input" value={form.kunde} onChange={e => setForm(p => ({ ...p, kunde: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Kunde wählen…</option>
                {kunden.map(k => <option key={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Betrag (€) *</label>
              <input className="pk-input" placeholder="z.B. 2.400,00" value={form.betrag} onChange={e => setForm(p => ({ ...p, betrag: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Fällig am</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.faellig} onChange={e => setForm(p => ({ ...p, faellig: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="pk-btn" onClick={handleNeu}>Rechnung erstellen</button>
          </div>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr.</th>
              <th>Kunde</th>
              <th>Betrag</th>
              <th>Erstellt</th>
              <th>Fällig</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ color: '#aeb9c8', fontFamily: 'monospace', fontSize: 12 }}>{r.id}</td>
                <td style={{ fontWeight: 600 }}>{r.kunde}</td>
                <td style={{ fontWeight: 800, fontSize: 15, color: r.status === 'Bezahlt' ? '#4ddb7e' : '#f8fbff' }}>{r.betrag}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{r.erstellt}</td>
                <td style={{ color: r.status === 'Überfällig' ? '#ffb347' : '#aeb9c8', fontSize: 13, fontWeight: r.status === 'Überfällig' ? 700 : 400 }}>
                  {r.bezahltAm ? `Bezahlt: ${r.bezahltAm}` : r.faellig}
                </td>
                <td><StatusBadgeRechnung status={r.status} /></td>
                <td>
                  {deleteId === r.id ? (
                    <DeleteConfirm label={r.id} onConfirm={() => handleDelete(r.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(r.status === 'Offen' || r.status === 'Überfällig') && (
                        <>
                          <button onClick={() => handleBezahlt(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                            ✅ Bezahlt
                          </button>
                          <button onClick={() => handleMahnung(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,165,0,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                            📮 Mahnen
                          </button>
                        </>
                      )}
                      {r.status === 'Mahnung' && (
                        <button onClick={() => handleBezahlt(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                          ✅ Bezahlt
                        </button>
                      )}
                      <button onClick={() => openEdit(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(32,200,255,.3)', background: 'transparent', color: '#20c8ff', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={() => setDeleteId(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Rechnungen</div>
    </div>
  )
}

// ── Dokumente-Tab ───────────────────────────────────────────────────────────

function DokumenteTab({ isDemo }: { isDemo: boolean }) {
  const [dokumente, setDokumente] = useState<Dokument[]>(isDemo ? demoDokumente : [])
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [loading, setLoading] = useState(!isDemo)
  const [uploading, setUploading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    getBueroDokumente()
      .then(data => setDokumente(data as Dokument[]))
      .catch(() => showToast('Fehler beim Laden der Dokumente', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = dokumente.filter(d =>
    (filterKat === 'Alle' || d.kategorie === filterKat) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.bezug.toLowerCase().includes(search.toLowerCase()))
  )

  const handleUpload = async () => {
    setUploading(true)
    if (isDemo) {
      setTimeout(() => {
        const newDoc: Dokument = {
          id: `DOK-${String(dokumente.length + 1).padStart(3, '0')}`,
          name: 'Neues_Dokument_Upload.pdf',
          typ: 'PDF', groesse: '245 KB',
          datum: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          kategorie: 'Sonstiges', bezug: '—',
        }
        setDokumente(prev => [newDoc, ...prev])
        setUploading(false)
        showToast('✅ Dokument erfolgreich hochgeladen und archiviert')
      }, 1800)
      return
    }
    try {
      const newDoc: Dokument = {
        id: `DOK-${String(dokumente.length + 1).padStart(3, '0')}`,
        name: 'Neues_Dokument_Upload.pdf',
        typ: 'PDF', groesse: '245 KB',
        datum: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        kategorie: 'Sonstiges', bezug: '—',
      }
      await insertBueroDokument(newDoc)
      const data = await getBueroDokumente()
      setDokumente(data as Dokument[])
      showToast('✅ Dokument erfolgreich hochgeladen und archiviert')
    } catch { showToast('Fehler beim Hochladen', true) }
    finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    if (!isDemo) {
      try { await deleteBueroDokument(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setDokumente(prev => prev.filter(d => d.id !== id))
    showToast(`🗑️ Dokument wurde gelöscht`)
  }

  const kategorieIcon: Record<string, string> = { Angebot: '📋', Rechnung: '💶', Vertrag: '📝', Sonstiges: '📄' }
  const kategorieBadge: Record<string, string> = { Angebot: 'badge-blue', Rechnung: 'badge-orange', Vertrag: 'badge-green', Sonstiges: 'badge-gray' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(32,200,255,.3)', borderTopColor: '#20c8ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Dokumente…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} error={toastError} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="pk-input" placeholder="🔍 Dokumente suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Alle', 'Angebot', 'Rechnung', 'Vertrag', 'Sonstiges'] as const).map(k => (
            <button key={k} onClick={() => setFilterKat(k)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterKat === k ? 'rgba(32,200,255,.15)' : 'transparent',
              color: filterKat === k ? '#20c8ff' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{k}</button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto' }} onClick={handleUpload} disabled={uploading}>
          {uploading ? '⏳ Wird hochgeladen…' : '📤 Dokument hochladen'}
        </button>
      </div>

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Dateiname</th>
              <th>Kategorie</th>
              <th>Bezug</th>
              <th>Größe</th>
              <th>Datum</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{kategorieIcon[d.kategorie]}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                  </div>
                </td>
                <td><span className={`badge ${kategorieBadge[d.kategorie]}`}>{d.kategorie}</span></td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.bezug}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.groesse}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{d.datum}</td>
                <td>
                  {deleteId === d.id ? (
                    <DeleteConfirm label={d.name} onConfirm={() => handleDelete(d.id)} onCancel={() => setDeleteId(null)} />
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => showToast(`📄 "${d.name}" wird geöffnet…`)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        📂 Öffnen
                      </button>
                      <button onClick={() => setDeleteId(d.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.3)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} von {dokumente.length} Dokumenten</div>

      <div className="pk-card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🧠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>KI-gestützte Dokumentenanalyse</div>
          <div style={{ fontSize: 12, color: '#aeb9c8' }}>Dokumente automatisch erkennen, klassifizieren und Daten extrahieren lassen</div>
        </div>
        <button className="pk-btn-ghost" onClick={() => window.location.href = '/dashboard/ki-erkennung'} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          🧠 KI Erkennung öffnen
        </button>
      </div>
    </div>
  )
}

// ── Haupt-Seite ─────────────────────────────────────────────────────────────

export default function BueroPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<Tab>('kunden')
  const [kunden, setKunden] = useState<Kunde[]>(isDemo ? demoKunden : [])
  const [auftraege, setAuftraege] = useState<Auftrag[]>(isDemo ? demoAuftraege : [])
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  // Shared data laden (Kunden + Aufträge für Cross-Tab-Referenzen)
  useEffect(() => {
    if (isDemo) return
    Promise.all([getBueroKunden(), getBueroAuftraege()])
      .then(([k, a]) => { setKunden(k as Kunde[]); setAuftraege(a as Auftrag[]) })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const offeneAngebote = isDemo ? demoAngebote.filter(a => a.status === 'Versendet' || a.status === 'Entwurf').length : 0
  const offeneRechnungen = isDemo ? demoRechnungen.filter(r => r.status !== 'Bezahlt').length : 0
  const laufendeAuftraege = auftraege.filter(a => a.status === 'In Bearbeitung').length

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
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kunden · Angebote · Aufträge · Rechnungen · Dokumente</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Kunden gesamt', value: String(kunden.filter(k => k.status === 'Aktiv').length), icon: '👥', color: '#20c8ff' },
          { label: 'Offene Angebote', value: String(offeneAngebote), icon: '📋', color: '#1684ff' },
          { label: 'Laufende Aufträge', value: String(laufendeAuftraege), icon: '✅', color: '#25d366' },
          { label: 'Offene Rechnungen', value: String(offeneRechnungen), icon: '💶', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'kunden' && <KundenTab isDemo={isDemo} auftraege={auftraege} rechnungen={isDemo ? demoRechnungen : []} />}
      {tab === 'angebote' && <AngeboteTab isDemo={isDemo} kunden={kunden} auftraege={auftraege} setAuftraege={setAuftraege} />}
      {tab === 'auftraege' && <AuftraegeTab isDemo={isDemo} auftraege={auftraege} setAuftraege={setAuftraege} kunden={kunden} />}
      {tab === 'rechnungen' && <RechnungenTab isDemo={isDemo} kunden={kunden} />}
      {tab === 'dokumente' && <DokumenteTab isDemo={isDemo} />}
    </div>
  )
}
