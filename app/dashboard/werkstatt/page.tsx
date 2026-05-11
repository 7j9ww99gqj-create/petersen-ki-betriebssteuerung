'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getWerkstattKarten, upsertWerkstattKarte, deleteWerkstattKarte,
  getWerkstattMitarbeiter, upsertWerkstattMitarbeiter, deleteWerkstattMitarbeiter,
  getWerkstattZeitbuchungen, insertWerkstattZeitbuchung,
  getWerkstattMaterial, insertWerkstattMaterial,
  getWerkstattPruefprotokolle, insertWerkstattPruefprotokoll,
} from '@/lib/db'

// ── Typen ────────────────────────────────────────────────────────────────────

type Prioritaet = 'Niedrig' | 'Mittel' | 'Hoch' | 'Kritisch'
type AKStatus = 'Offen' | 'In Arbeit' | 'Warten' | 'Fertig' | 'Storniert'

type Arbeitskarte = {
  id: string; auftragsnr: string; beschreibung: string
  mitarbeiter: string; prioritaet: Prioritaet; status: AKStatus
  erstellt: string; geplant: string; stunden: number
  fortschritt: number; maschine: string
}

type Zeitbuchung = {
  id: number; mitarbeiter: string; auftragsnr: string; stunden: number
  datum: string; taetigkeit: string
}

type Materialverbrauch = {
  id: number; artikel: string; menge: number; einheit: string
  auftragsnr: string; datum: string; mitarbeiter: string
}

type Pruefprotokoll = {
  id: number; auftragsnr: string; pruefpunkt: string
  ergebnis: 'OK' | 'Fehler' | 'Offen'; pruefer: string; datum: string
}

type Mitarbeiter = {
  id: string; name: string; rolle?: string; email?: string; telefon?: string
  aktiv?: boolean; notiz?: string; created_at?: string; updated_at?: string
}

// ── Demo-Daten ────────────────────────────────────────────────────────────────

const demoKarten: Arbeitskarte[] = [
  { id: 'AK-2025-041', auftragsnr: 'A-2025-034', beschreibung: 'Wartung Hydraulikpresse Station 3', mitarbeiter: 'K. Meier', prioritaet: 'Hoch', status: 'In Arbeit', erstellt: '02.05.2025', geplant: '07.05.2025', stunden: 4, fortschritt: 60, maschine: 'HP-Station-3' },
  { id: 'AK-2025-040', auftragsnr: 'A-2025-033', beschreibung: 'Schweißnahtprüfung Stahlträger Charge 1', mitarbeiter: 'M. Fischer', prioritaet: 'Mittel', status: 'In Arbeit', erstellt: '01.05.2025', geplant: '06.05.2025', stunden: 6, fortschritt: 80, maschine: 'Schweißbereich-B' },
  { id: 'AK-2025-039', auftragsnr: 'A-2025-032', beschreibung: 'Fundament Carport Vorbereitung', mitarbeiter: 'T. Schulz', prioritaet: 'Niedrig', status: 'Offen', erstellt: '30.04.2025', geplant: '10.05.2025', stunden: 8, fortschritt: 0, maschine: '—' },
  { id: 'AK-2025-038', auftragsnr: 'A-2025-031', beschreibung: 'Instandhaltung Förderband Segment 2', mitarbeiter: 'K. Meier', prioritaet: 'Kritisch', status: 'Fertig', erstellt: '25.04.2025', geplant: '28.04.2025', stunden: 5, fortschritt: 100, maschine: 'Förderband-2' },
  { id: 'AK-2025-037', auftragsnr: 'A-2025-029', beschreibung: 'Schaltschrankverkabelung Erweiterung', mitarbeiter: 'J. Brand', prioritaet: 'Hoch', status: 'Warten', erstellt: '20.04.2025', geplant: '30.05.2025', stunden: 12, fortschritt: 30, maschine: 'Elektro-Werkstatt' },
  { id: 'AK-2025-036', auftragsnr: 'A-2025-030', beschreibung: 'Druckluftleitung Hauptstrang verlegen', mitarbeiter: 'M. Fischer', prioritaet: 'Mittel', status: 'Fertig', erstellt: '18.04.2025', geplant: '25.04.2025', stunden: 10, fortschritt: 100, maschine: '—' },
]

const demoZeit: Zeitbuchung[] = [
  { id: 1, mitarbeiter: 'K. Meier', auftragsnr: 'A-2025-034', stunden: 2.5, datum: '06.05.2025', taetigkeit: 'Ölwechsel & Filterreinigung' },
  { id: 2, mitarbeiter: 'M. Fischer', auftragsnr: 'A-2025-033', stunden: 3.0, datum: '06.05.2025', taetigkeit: 'Sichtprüfung Schweißnähte' },
  { id: 3, mitarbeiter: 'T. Schulz', auftragsnr: 'A-2025-034', stunden: 1.5, datum: '05.05.2025', taetigkeit: 'Dichtungsprüfung Zylinder' },
  { id: 4, mitarbeiter: 'K. Meier', auftragsnr: 'A-2025-031', stunden: 5.0, datum: '28.04.2025', taetigkeit: 'Förderband komplett gewartet' },
  { id: 5, mitarbeiter: 'J. Brand', auftragsnr: 'A-2025-029', stunden: 4.0, datum: '25.04.2025', taetigkeit: 'Schaltplan erstellt & begonnen' },
]

const demoMaterial: Materialverbrauch[] = [
  { id: 1, artikel: 'Hydrauliköl HLP46', menge: 12, einheit: 'Liter', auftragsnr: 'A-2025-034', datum: '06.05.2025', mitarbeiter: 'K. Meier' },
  { id: 2, artikel: 'Dichtungsring 50mm', menge: 8, einheit: 'Stk', auftragsnr: 'A-2025-034', datum: '06.05.2025', mitarbeiter: 'K. Meier' },
  { id: 3, artikel: 'Schweißdraht 1.0mm', menge: 3, einheit: 'Rollen', auftragsnr: 'A-2025-033', datum: '05.05.2025', mitarbeiter: 'M. Fischer' },
  { id: 4, artikel: 'Schrauben M8x30', menge: 48, einheit: 'Stk', auftragsnr: 'A-2025-031', datum: '28.04.2025', mitarbeiter: 'K. Meier' },
]

const demoPruefung: Pruefprotokoll[] = [
  { id: 1, auftragsnr: 'A-2025-034', pruefpunkt: 'Hydraulikdruck 250 bar', ergebnis: 'OK', pruefer: 'K. Meier', datum: '06.05.2025' },
  { id: 2, auftragsnr: 'A-2025-034', pruefpunkt: 'Dichtheitsprüfung Zylinder', ergebnis: 'OK', pruefer: 'K. Meier', datum: '06.05.2025' },
  { id: 3, auftragsnr: 'A-2025-033', pruefpunkt: 'Schweißnaht Sichtprüfung', ergebnis: 'OK', pruefer: 'M. Fischer', datum: '05.05.2025' },
  { id: 4, auftragsnr: 'A-2025-033', pruefpunkt: 'Maßhaltigkeit ±0,5mm', ergebnis: 'Fehler', pruefer: 'M. Fischer', datum: '05.05.2025' },
  { id: 5, auftragsnr: 'A-2025-032', pruefpunkt: 'Fundament-Tiefe 80cm', ergebnis: 'Offen', pruefer: '—', datum: '—' },
]

const mitarbeiterListe = ['K. Meier', 'M. Fischer', 'T. Schulz', 'J. Brand', 'S. Richter', 'L. Hoffmann']
const demoMitarbeiter: Mitarbeiter[] = mitarbeiterListe.map((name, index) => ({
  id: `MA-${String(index + 1).padStart(3, '0')}`,
  name,
  rolle: index < 2 ? 'Mechanik' : index < 4 ? 'Fertigung' : 'Aushilfe',
  aktiv: true,
}))
const maschineListe = ['HP-Station-3', 'Schweißbereich-B', 'Förderband-2', 'Elektro-Werkstatt', 'CNC-Fräse-1', 'Drehmaschine-2', '—']

// ── Helpers ───────────────────────────────────────────────────────────────────

const prioBadge: Record<Prioritaet, string> = {
  Niedrig: 'badge-gray', Mittel: 'badge-blue', Hoch: 'badge-orange', Kritisch: 'badge-red',
}
const prioColor: Record<Prioritaet, string> = {
  Niedrig: '#aeb9c8', Mittel: '#1684ff', Hoch: '#f59e0b', Kritisch: '#f43f5e',
}
const statusBadge: Record<AKStatus, string> = {
  Offen: 'badge-gray', 'In Arbeit': 'badge-blue', Warten: 'badge-orange', Fertig: 'badge-green', Storniert: 'badge-gray',
}
const statusIcon: Record<AKStatus, string> = {
  Offen: '📋', 'In Arbeit': '⚙️', Warten: '⏸️', Fertig: '✅', Storniert: '✕',
}

function genId() {
  return `AK-${Date.now().toString(36).toUpperCase()}`
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#aeb9c8', minWidth: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  )
}

// Fixed-position Toast (success = green, error = red)
function Toast({ msg, isError }: { msg: string; isError?: boolean }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 24, zIndex: 9999,
      padding: '14px 20px', borderRadius: 12, minWidth: 260, maxWidth: 400,
      background: isError ? 'rgba(244,63,94,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${isError ? 'rgba(244,63,94,.4)' : 'rgba(37,211,102,.3)'}`,
      color: isError ? '#fb7185' : '#4ddb7e',
      fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
    }}>{msg}</div>
  )
}

// Modal-Pattern
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

// ── Edit-Modal für Arbeitskarten ──────────────────────────────────────────────

function EditKarteModal({ karte, onClose, onSave, mitarbeiterNamen }: {
  karte: Arbeitskarte
  onClose: () => void
  onSave: (updated: Arbeitskarte) => void
  mitarbeiterNamen: string[]
}) {
  const [form, setForm] = useState({
    auftragsnr: karte.auftragsnr,
    beschreibung: karte.beschreibung,
    mitarbeiter: karte.mitarbeiter,
    prioritaet: karte.prioritaet,
    status: karte.status,
    geplant: karte.geplant,
    stunden: String(karte.stunden),
    maschine: karte.maschine,
    fortschritt: karte.fortschritt,
  })

  const handleSubmit = () => {
    if (!form.auftragsnr || !form.beschreibung || !form.mitarbeiter) return
    onSave({
      ...karte,
      auftragsnr: form.auftragsnr,
      beschreibung: form.beschreibung,
      mitarbeiter: form.mitarbeiter,
      prioritaet: form.prioritaet,
      status: form.status,
      geplant: form.geplant || '—',
      stunden: Number(form.stunden) || 0,
      maschine: form.maschine || '—',
      fortschritt: form.fortschritt,
    })
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }

  return (
    <Modal title={`✏️ Arbeitskarte bearbeiten – ${karte.id}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div>
          <label style={labelStyle}>Auftragsnummer *</label>
          <input className="pk-input" value={form.auftragsnr} onChange={e => setForm(p => ({ ...p, auftragsnr: e.target.value }))} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Beschreibung *</label>
          <input className="pk-input" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Mitarbeiter *</label>
          <select className="pk-input" value={form.mitarbeiter} onChange={e => setForm(p => ({ ...p, mitarbeiter: e.target.value }))} style={{ cursor: 'pointer' }}>
            <option value="">Mitarbeiter wählen…</option>
            {mitarbeiterNamen.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Maschine / Bereich</label>
          <select className="pk-input" value={form.maschine} onChange={e => setForm(p => ({ ...p, maschine: e.target.value }))} style={{ cursor: 'pointer' }}>
            <option value="">Maschine wählen…</option>
            {maschineListe.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Priorität</label>
          <select className="pk-input" value={form.prioritaet} onChange={e => setForm(p => ({ ...p, prioritaet: e.target.value as Prioritaet }))} style={{ cursor: 'pointer' }}>
            <option>Niedrig</option><option>Mittel</option><option>Hoch</option><option>Kritisch</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select className="pk-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as AKStatus }))} style={{ cursor: 'pointer' }}>
            <option>Offen</option><option>In Arbeit</option><option>Warten</option><option>Fertig</option><option>Storniert</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Geplant bis</label>
          <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.geplant} onChange={e => setForm(p => ({ ...p, geplant: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Geplante Stunden</label>
          <input className="pk-input" type="number" value={form.stunden} onChange={e => setForm(p => ({ ...p, stunden: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Fortschritt: {form.fortschritt}%</label>
          <input
            type="range" min={0} max={100} step={5} value={form.fortschritt}
            onChange={e => setForm(p => ({ ...p, fortschritt: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a5568', marginTop: 2 }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button className="pk-btn" onClick={handleSubmit} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', fontWeight: 700 }}>
          💾 Speichern
        </button>
        <button className="pk-btn-ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  )
}

// ── Arbeitskarten-Tab ─────────────────────────────────────────────────────────

function ArbeitskartentTab({ isDemo, mitarbeiterNamen }: { isDemo: boolean; mitarbeiterNamen: string[] }) {
  const [karten, setKarten] = useState<Arbeitskarte[]>(isDemo ? demoKarten : [])
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('Alle')
  const [filterPrio, setFilterPrio] = useState<string>('Alle')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [editKarte, setEditKarte] = useState<Arbeitskarte | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    auftragsnr: '', beschreibung: '', mitarbeiter: '', prioritaet: 'Mittel' as Prioritaet,
    status: 'Offen' as AKStatus, geplant: '', stunden: '', maschine: '',
  })

  useEffect(() => {
    if (isDemo) return
    getWerkstattKarten()
      .then(data => setKarten(data as Arbeitskarte[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Arbeitskarten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => { setToast(''); setToastError(false) }, 4000)
  }

  const filtered = karten.filter(k =>
    (filterStatus === 'Alle' || k.status === filterStatus) &&
    (filterPrio === 'Alle' || k.prioritaet === filterPrio)
  )

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const counts: Record<string, number> = { Alle: karten.length }
  karten.forEach(k => {
    counts[k.status] = (counts[k.status] || 0) + 1
    counts[k.prioritaet] = (counts[k.prioritaet] || 0) + 1
  })

  // KPI counts
  const kpiOffen = karten.filter(k => k.status === 'Offen').length
  const kpiInArbeit = karten.filter(k => k.status === 'In Arbeit').length
  const kpiKritisch = karten.filter(k => k.prioritaet === 'Kritisch' && k.status !== 'Fertig' && k.status !== 'Storniert').length
  const kpiFertigHeute = karten.filter(k => k.status === 'Fertig' && k.erstellt === today).length

  const handleSave = async () => {
    if (!form.auftragsnr || !form.beschreibung || !form.mitarbeiter) return
    const newKarte: Arbeitskarte = {
      id: genId(), auftragsnr: form.auftragsnr, beschreibung: form.beschreibung,
      mitarbeiter: form.mitarbeiter, prioritaet: form.prioritaet, status: form.status,
      erstellt: today, geplant: form.geplant || '—', stunden: Number(form.stunden) || 0,
      fortschritt: 0, maschine: form.maschine || '—',
    }
    if (!isDemo) {
      try { await upsertWerkstattKarte(newKarte) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKarten(prev => [newKarte, ...prev])
    setForm({ auftragsnr: '', beschreibung: '', mitarbeiter: '', prioritaet: 'Mittel', status: 'Offen', geplant: '', stunden: '', maschine: '' })
    setShowForm(false)
    showToast(`✅ Arbeitskarte ${newKarte.id} wurde erfolgreich erstellt`)
  }

  const handleStatusChange = async (id: string, status: AKStatus) => {
    const karte = karten.find(k => k.id === id)
    if (!isDemo && karte) {
      const updated = { ...karte, status, fortschritt: status === 'Fertig' ? 100 : karte.fortschritt }
      try { await upsertWerkstattKarte(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKarten(prev => prev.map(k => k.id === id
      ? { ...k, status, fortschritt: status === 'Fertig' ? 100 : k.fortschritt }
      : k
    ))
    showToast(`✅ ${id}: Status auf "${status}" gesetzt`)
  }

  const handleEditSave = async (updated: Arbeitskarte) => {
    if (!isDemo) {
      try { await upsertWerkstattKarte(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKarten(prev => prev.map(k => k.id === updated.id ? updated : k))
    setEditKarte(null)
    showToast(`✅ Arbeitskarte ${updated.id} gespeichert`)
  }

  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try { await deleteWerkstattKarte(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setKarten(prev => prev.filter(k => k.id !== id))
    setDeleteConfirm(null)
    showToast(`🗑️ Arbeitskarte ${id} gelöscht`)
  }

  const handleSliderChange = (id: string, value: number) => {
    setSliderValues(prev => ({ ...prev, [id]: value }))
    setKarten(prev => prev.map(k => k.id === id ? { ...k, fortschritt: value } : k))
  }

  const handleSliderRelease = async (id: string, value: number) => {
    const karte = karten.find(k => k.id === id)
    if (!karte) return
    const updated = { ...karte, fortschritt: value }
    if (!isDemo) {
      try { await upsertWerkstattKarte(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKarten(prev => prev.map(k => k.id === id ? updated : k))
    const newSlider = { ...sliderValues }
    delete newSlider[id]
    setSliderValues(newSlider)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Arbeitskarten…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} isError={toastError} />
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Offen', value: kpiOffen, icon: '📋', color: '#aeb9c8' },
          { label: 'In Arbeit', value: kpiInArbeit, icon: '⚙️', color: '#1684ff' },
          { label: 'Kritisch', value: kpiKritisch, icon: '🔴', color: '#f43f5e' },
          { label: 'Fertig heute', value: kpiFertigHeute, icon: '✅', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + New Button */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Offen', 'In Arbeit', 'Warten', 'Fertig'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(166,139,250,.15)' : 'transparent',
              color: filterStatus === s ? '#c4b5fd' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Hoch', 'Kritisch'] as const).map(p => (
            <button key={p} onClick={() => setFilterPrio(filterPrio === p ? 'Alle' : p)} style={{
              padding: '6px 12px', borderRadius: 999, border: `1px solid ${filterPrio === p ? prioColor[p] + '60' : 'rgba(255,255,255,.1)'}`,
              background: filterPrio === p ? prioColor[p] + '18' : 'transparent',
              color: filterPrio === p ? prioColor[p] : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{p === 'Kritisch' ? '🔴' : '🟠'} {p}</button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, marginLeft: 'auto', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Arbeitskarte'}
        </button>
      </div>

      {/* Neues Arbeitskarten-Formular */}
      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(167,139,250,.25)' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800 }}>🛠️ Neue Arbeitskarte erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Auftragsnummer *</label>
              <input className="pk-input" placeholder="z.B. A-2025-035" value={form.auftragsnr} onChange={e => setForm(p => ({ ...p, auftragsnr: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Beschreibung *</label>
              <input className="pk-input" placeholder="Aufgabenbeschreibung eingeben…" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Mitarbeiter *</label>
              <select className="pk-input" value={form.mitarbeiter} onChange={e => setForm(p => ({ ...p, mitarbeiter: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Mitarbeiter wählen…</option>
                {mitarbeiterNamen.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Maschine / Bereich</label>
              <select className="pk-input" value={form.maschine} onChange={e => setForm(p => ({ ...p, maschine: e.target.value }))} style={{ cursor: 'pointer' }}>
                <option value="">Maschine wählen…</option>
                {maschineListe.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Priorität</label>
              <select className="pk-input" value={form.prioritaet} onChange={e => setForm(p => ({ ...p, prioritaet: e.target.value as Prioritaet }))} style={{ cursor: 'pointer' }}>
                <option>Niedrig</option>
                <option>Mittel</option>
                <option>Hoch</option>
                <option>Kritisch</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Status</label>
              <select className="pk-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as AKStatus }))} style={{ cursor: 'pointer' }}>
                <option>Offen</option>
                <option>In Arbeit</option>
                <option>Warten</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Geplant bis</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.geplant} onChange={e => setForm(p => ({ ...p, geplant: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Geplante Stunden</label>
              <input className="pk-input" placeholder="z.B. 8" type="number" value={form.stunden} onChange={e => setForm(p => ({ ...p, stunden: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="pk-btn" onClick={handleSave} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', fontWeight: 700 }}>
              🛠️ Arbeitskarte erstellen
            </button>
            <span style={{ fontSize: 12, color: '#4a5568' }}>* Pflichtfelder</span>
          </div>
        </div>
      )}

      {/* Karten-Liste */}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(k => (
          <div key={k.id} className="pk-card" style={{ border: `1px solid ${prioColor[k.prioritaet]}20` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: prioColor[k.prioritaet] + '18', border: `1px solid ${prioColor[k.prioritaet]}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>{statusIcon[k.status]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{k.id}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed' }}>{k.auftragsnr}</span>
                  <span className={`badge ${statusBadge[k.status]}`}>{k.status}</span>
                  <span className={`badge ${prioBadge[k.prioritaet]}`} style={{ color: prioColor[k.prioritaet] }}>{k.prioritaet}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{k.beschreibung}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#aeb9c8' }}>
                  <span>👷 {k.mitarbeiter}</span>
                  {k.maschine !== '—' && <span>⚙️ {k.maschine}</span>}
                  <span>📅 bis {k.geplant}</span>
                  <span>⏱️ {k.stunden}h geplant</span>
                  <span>📋 Erstellt: {k.erstellt}</span>
                </div>
              </div>
              {/* Action Buttons */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {/* Status-Schnellwechsel */}
                {k.status !== 'Fertig' && k.status !== 'Storniert' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {k.status !== 'In Arbeit' && (
                      <button onClick={() => handleStatusChange(k.id, 'In Arbeit')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>
                        ▶ Starten
                      </button>
                    )}
                    {k.status === 'In Arbeit' && (
                      <button onClick={() => handleStatusChange(k.id, 'Warten')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>
                        ⏸ Pausieren
                      </button>
                    )}
                    <button onClick={() => handleStatusChange(k.id, 'Fertig')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>
                      ✅ Abschließen
                    </button>
                  </div>
                )}
                {/* Edit + Delete */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditKarte(k)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(167,139,250,.3)', background: 'transparent', color: '#c4b5fd', cursor: 'pointer' }}>
                    ✏️
                  </button>
                  {deleteConfirm === k.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDelete(k.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.1)', color: '#fb7185', cursor: 'pointer', fontWeight: 700 }}>
                        Ja, löschen
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(k.id)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#fb7185', cursor: 'pointer' }}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* ProgressBar + inline Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <ProgressBar value={sliderValues[k.id] ?? k.fortschritt} color={prioColor[k.prioritaet]} />
              </div>
              <input
                type="range" min={0} max={100} step={5}
                value={sliderValues[k.id] ?? k.fortschritt}
                onChange={e => handleSliderChange(k.id, Number(e.target.value))}
                onMouseUp={e => handleSliderRelease(k.id, Number((e.target as HTMLInputElement).value))}
                onTouchEnd={e => handleSliderRelease(k.id, Number((e.target as HTMLInputElement).value))}
                style={{ width: 90, accentColor: prioColor[k.prioritaet], cursor: 'pointer', flexShrink: 0 }}
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#aeb9c8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            Keine Arbeitskarten für diesen Filter
          </div>
        )}
      </div>

      {/* Edit-Modal */}
      {editKarte && (
        <EditKarteModal
          karte={editKarte}
          onClose={() => setEditKarte(null)}
          onSave={handleEditSave}
          mitarbeiterNamen={mitarbeiterNamen}
        />
      )}
    </div>
  )
}

// ── Zeiterfassung-Tab ─────────────────────────────────────────────────────────

function ZeiterfassungTab({ isDemo, mitarbeiterNamen }: { isDemo: boolean; mitarbeiterNamen: string[] }) {
  const [buchungen, setBuchungen] = useState<Zeitbuchung[]>(isDemo ? demoZeit : [])
  const [form, setForm] = useState({ mitarbeiter: '', auftragsnr: '', stunden: '', taetigkeit: '' })
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    if (isDemo) return
    getWerkstattZeitbuchungen()
      .then(data => setBuchungen(data as Zeitbuchung[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Zeitbuchungen'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => { setToast(''); setToastError(false) }, 4000)
  }

  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const gesamtHeute = buchungen.filter(b => b.datum === today).reduce((s, b) => s + b.stunden, 0)
  const gesamtAlle = buchungen.reduce((s, b) => s + b.stunden, 0)

  const handleSave = async () => {
    if (!form.mitarbeiter || !form.auftragsnr || !form.stunden) return
    const newBuchung: Zeitbuchung = { id: Date.now(), ...form, stunden: Number(form.stunden), datum: today }
    if (!isDemo) {
      try { await insertWerkstattZeitbuchung(newBuchung) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setBuchungen(prev => [newBuchung, ...prev])
    setForm({ mitarbeiter: '', auftragsnr: '', stunden: '', taetigkeit: '' })
    showToast(`✅ ${form.stunden}h für ${form.mitarbeiter} auf ${form.auftragsnr} gebucht`)
  }

  const handleDelete = (id: number) => {
    setBuchungen(prev => prev.filter(b => b.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Zeitbuchung gelöscht')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Zeitbuchungen…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} isError={toastError} />
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Stunden heute', value: `${gesamtHeute}h`, icon: '⏱️', color: '#a78bfa' },
          { label: 'Stunden gesamt', value: `${gesamtAlle}h`, icon: '📊', color: '#1684ff' },
          { label: 'Mitarbeiter aktiv', value: '4', icon: '👷', color: '#10b981' },
          { label: 'Buchungen heute', value: String(buchungen.filter(b => b.datum === today).length), icon: '📋', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="pk-card fade-in" style={{ marginBottom: 16, border: '1px solid rgba(167,139,250,.2)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>⏱️ Stunden buchen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Mitarbeiter</label>
            <select className="pk-input" value={form.mitarbeiter} onChange={e => setForm(p => ({ ...p, mitarbeiter: e.target.value }))} style={{ cursor: 'pointer' }}>
              <option value="">Wählen…</option>
              {mitarbeiterNamen.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Auftrag</label>
            <input className="pk-input" placeholder="z.B. A-2025-034" value={form.auftragsnr} onChange={e => setForm(p => ({ ...p, auftragsnr: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Stunden</label>
            <input className="pk-input" placeholder="z.B. 2.5" type="number" step="0.5" value={form.stunden} onChange={e => setForm(p => ({ ...p, stunden: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Tätigkeit</label>
            <input className="pk-input" placeholder="Kurzbeschreibung" value={form.taetigkeit} onChange={e => setForm(p => ({ ...p, taetigkeit: e.target.value }))} />
          </div>
        </div>
        <button className="pk-btn" style={{ marginTop: 14, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', fontSize: 13 }} onClick={handleSave}>
          ⏱️ Stunden buchen
        </button>
      </div>

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Mitarbeiter</th>
              <th>Auftrag</th>
              <th>Stunden</th>
              <th>Tätigkeit</th>
              <th>Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {buchungen.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>👷 {b.mitarbeiter}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' }}>{b.auftragsnr}</td>
                <td style={{ fontWeight: 700, color: '#a78bfa' }}>{b.stunden}h</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.taetigkeit}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.datum}</td>
                <td>
                  {deleteConfirm === b.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDelete(b.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.1)', color: '#fb7185', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(b.id)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#fb7185', cursor: 'pointer' }}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Materialverbrauch-Tab ────────────────────────────────────────────────────

function MaterialverbrauchTab({ isDemo, mitarbeiterNamen }: { isDemo: boolean; mitarbeiterNamen: string[] }) {
  const [material, setMaterial] = useState<Materialverbrauch[]>(isDemo ? demoMaterial : [])
  const [form, setForm] = useState({ artikel: '', menge: '', einheit: 'Stk', auftragsnr: '', mitarbeiter: '' })
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    if (isDemo) return
    getWerkstattMaterial()
      .then(data => setMaterial(data as Materialverbrauch[]))
      .catch(() => setErrorMsg('Fehler beim Laden des Materialverbrauchs'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => { setToast(''); setToastError(false) }, 4000)
  }

  const handleSave = async () => {
    if (!form.artikel || !form.menge || !form.auftragsnr) return
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newEntry: Materialverbrauch = { id: Date.now(), ...form, menge: Number(form.menge), datum: today }
    if (!isDemo) {
      try { await insertWerkstattMaterial(newEntry) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setMaterial(prev => [newEntry, ...prev])
    setForm({ artikel: '', menge: '', einheit: 'Stk', auftragsnr: '', mitarbeiter: '' })
    showToast(`✅ Verbrauch "${form.artikel}" (${form.menge} ${form.einheit}) gebucht`)
  }

  const handleDelete = (id: number) => {
    setMaterial(prev => prev.filter(m => m.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Materialverbrauch gelöscht')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Materialverbrauch…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} isError={toastError} />
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <div className="pk-card fade-in" style={{ marginBottom: 16, border: '1px solid rgba(167,139,250,.2)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>🔩 Materialverbrauch buchen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Artikel</label>
            <input className="pk-input" placeholder="Artikelname" value={form.artikel} onChange={e => setForm(p => ({ ...p, artikel: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Menge</label>
            <input className="pk-input" placeholder="Anzahl" type="number" value={form.menge} onChange={e => setForm(p => ({ ...p, menge: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Einheit</label>
            <select className="pk-input" value={form.einheit} onChange={e => setForm(p => ({ ...p, einheit: e.target.value }))} style={{ cursor: 'pointer' }}>
              {['Stk', 'Liter', 'Rollen', 'Meter', 'kg', 'Paar'].map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Auftrag</label>
            <input className="pk-input" placeholder="A-2025-XXX" value={form.auftragsnr} onChange={e => setForm(p => ({ ...p, auftragsnr: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Mitarbeiter</label>
            <select className="pk-input" value={form.mitarbeiter} onChange={e => setForm(p => ({ ...p, mitarbeiter: e.target.value }))} style={{ cursor: 'pointer' }}>
              <option value="">Wählen…</option>
              {mitarbeiterNamen.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <button className="pk-btn" style={{ marginTop: 14, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', fontSize: 13 }} onClick={handleSave}>
          🔩 Verbrauch buchen
        </button>
      </div>

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Menge</th>
              <th>Auftrag</th>
              <th>Mitarbeiter</th>
              <th>Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {material.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 600 }}>🔩 {m.artikel}</td>
                <td style={{ fontWeight: 700, color: '#a78bfa' }}>{m.menge} {m.einheit}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' }}>{m.auftragsnr}</td>
                <td style={{ color: '#aeb9c8' }}>{m.mitarbeiter}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{m.datum}</td>
                <td>
                  {deleteConfirm === m.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDelete(m.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.1)', color: '#fb7185', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(m.id)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#fb7185', cursor: 'pointer' }}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Qualitätskontrolle-Tab ────────────────────────────────────────────────────

function QualitaetTab({ isDemo, mitarbeiterNamen }: { isDemo: boolean; mitarbeiterNamen: string[] }) {
  const [protokolle, setProtokolle] = useState<Pruefprotokoll[]>(isDemo ? demoPruefung : [])
  const [form, setForm] = useState({ auftragsnr: '', pruefpunkt: '', pruefer: '' })
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    if (isDemo) return
    getWerkstattPruefprotokolle()
      .then(data => setProtokolle(data as Pruefprotokoll[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Prüfprotokolle'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => { setToast(''); setToastError(false) }, 4000)
  }

  const handleErgebnis = async (id: number, ergebnis: 'OK' | 'Fehler' | 'Offen') => {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (!isDemo) {
      const p = protokolle.find(p => p.id === id)
      if (p) {
        try { await insertWerkstattPruefprotokoll({ ...p, ergebnis, datum: ergebnis === 'Offen' ? '—' : today }) } catch { showToast('Fehler beim Speichern', true); return }
      }
    }
    setProtokolle(prev => prev.map(p => p.id === id ? { ...p, ergebnis, datum: ergebnis === 'Offen' ? '—' : today } : p))
    if (ergebnis === 'OK') showToast('✅ Prüfpunkt bestanden')
    else if (ergebnis === 'Fehler') showToast('⚠️ Fehler protokolliert')
    else showToast('🔍 Prüfpunkt zurückgesetzt')
  }

  const handleAdd = async () => {
    if (!form.auftragsnr || !form.pruefpunkt) return
    const newP: Pruefprotokoll = { id: Date.now(), ...form, ergebnis: 'Offen', datum: '—' }
    if (!isDemo) {
      try { await insertWerkstattPruefprotokoll(newP) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProtokolle(prev => [newP, ...prev])
    setForm({ auftragsnr: '', pruefpunkt: '', pruefer: '' })
    showToast('✅ Prüfpunkt hinzugefügt')
  }

  const handleDelete = (id: number) => {
    setProtokolle(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Prüfpunkt gelöscht')
  }

  // Fertig-Badge: alle Prüfpunkte eines Auftrags sind "OK"
  const auftragsFertig = new Set<string>()
  const auftragsPunkte: Record<string, Pruefprotokoll[]> = {}
  protokolle.forEach(p => {
    if (!auftragsPunkte[p.auftragsnr]) auftragsPunkte[p.auftragsnr] = []
    auftragsPunkte[p.auftragsnr].push(p)
  })
  Object.entries(auftragsPunkte).forEach(([nr, pts]) => {
    if (pts.length > 0 && pts.every(p => p.ergebnis === 'OK')) auftragsFertig.add(nr)
  })

  const ok = protokolle.filter(p => p.ergebnis === 'OK').length
  const fehler = protokolle.filter(p => p.ergebnis === 'Fehler').length
  const offen = protokolle.filter(p => p.ergebnis === 'Offen').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Prüfprotokolle…</div>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} isError={toastError} />
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{ok}</div>
          <div style={{ fontSize: 11, color: '#aeb9c8' }}>Bestanden</div>
        </div>
        <div className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f43f5e' }}>{fehler}</div>
          <div style={{ fontSize: 11, color: '#aeb9c8' }}>Fehler</div>
        </div>
        <div className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🔍</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{offen}</div>
          <div style={{ fontSize: 11, color: '#aeb9c8' }}>Ausstehend</div>
        </div>
      </div>

      <div className="pk-card fade-in" style={{ marginBottom: 16, border: '1px solid rgba(167,139,250,.2)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>➕ Prüfpunkt hinzufügen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Auftrag</label>
            <input className="pk-input" placeholder="A-2025-XXX" value={form.auftragsnr} onChange={e => setForm(p => ({ ...p, auftragsnr: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Prüfpunkt</label>
            <input className="pk-input" placeholder="z.B. Drehmoment 120 Nm" value={form.pruefpunkt} onChange={e => setForm(p => ({ ...p, pruefpunkt: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase' }}>Prüfer</label>
            <select className="pk-input" value={form.pruefer} onChange={e => setForm(p => ({ ...p, pruefer: e.target.value }))} style={{ cursor: 'pointer' }}>
              <option value="">Wählen…</option>
              {mitarbeiterNamen.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <button className="pk-btn" style={{ marginTop: 14, background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', fontSize: 13 }} onClick={handleAdd}>
          ➕ Prüfpunkt anlegen
        </button>
      </div>

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Auftrag</th>
              <th>Prüfpunkt</th>
              <th>Ergebnis</th>
              <th>Prüfer</th>
              <th>Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {protokolle.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' }}>
                  {p.auftragsnr}
                  {auftragsFertig.has(p.auftragsnr) && (
                    <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 10 }}>✅ Fertig</span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{p.pruefpunkt}</td>
                <td>
                  {/* Ergebnis-Dropdown direkt in der Zeile */}
                  <select
                    value={p.ergebnis}
                    onChange={e => handleErgebnis(p.id, e.target.value as 'OK' | 'Fehler' | 'Offen')}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${p.ergebnis === 'OK' ? 'rgba(37,211,102,.3)' : p.ergebnis === 'Fehler' ? 'rgba(244,63,94,.3)' : 'rgba(255,255,255,.15)'}`,
                      color: p.ergebnis === 'OK' ? '#4ddb7e' : p.ergebnis === 'Fehler' ? '#fb7185' : '#f59e0b',
                      borderRadius: 999, padding: '3px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    <option value="OK">✅ OK</option>
                    <option value="Fehler">⚠️ Fehler</option>
                    <option value="Offen">🔍 Offen</option>
                  </select>
                </td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{p.pruefer}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{p.datum}</td>
                <td>
                  {deleteConfirm === p.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.1)', color: '#fb7185', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(p.id)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#fb7185', cursor: 'pointer' }}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────

function MitarbeiterTab({ isDemo, mitarbeiter, setMitarbeiter }: {
  isDemo: boolean
  mitarbeiter: Mitarbeiter[]
  setMitarbeiter: React.Dispatch<React.SetStateAction<Mitarbeiter[]>>
}) {
  const [form, setForm] = useState({ id: '', name: '', rolle: '', email: '', telefon: '', aktiv: true, notiz: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  const showToast = (msg: string, error = false) => {
    setToast(msg); setToastError(error)
    setTimeout(() => { setToast(''); setToastError(false) }, 3500)
  }

  const reset = () => {
    setForm({ id: '', name: '', rolle: '', email: '', telefon: '', aktiv: true, notiz: '' })
    setEditId(null)
  }

  const save = async () => {
    if (!form.name.trim()) { showToast('Name ist Pflicht', true); return }
    const payload: Mitarbeiter = {
      id: editId ?? `MA-${Date.now().toString(36).toUpperCase()}`,
      name: form.name.trim(),
      rolle: form.rolle || undefined,
      email: form.email || undefined,
      telefon: form.telefon || undefined,
      aktiv: form.aktiv,
      notiz: form.notiz || undefined,
    }
    if (!isDemo) {
      try { await upsertWerkstattMitarbeiter(payload) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setMitarbeiter(prev => editId ? prev.map(m => m.id === editId ? payload : m) : [payload, ...prev])
    reset()
    showToast(editId ? '✅ Mitarbeiter aktualisiert' : '✅ Mitarbeiter angelegt')
  }

  const remove = async (id: string) => {
    if (!isDemo) {
      try { await deleteWerkstattMitarbeiter(id) } catch { showToast('Fehler beim Entfernen', true); return }
    }
    setMitarbeiter(prev => prev.filter(m => m.id !== id))
    setDeleteId(null)
    showToast('🗑️ Mitarbeiter entfernt')
  }

  const edit = (m: Mitarbeiter) => {
    setEditId(m.id)
    setForm({
      id: m.id,
      name: m.name,
      rolle: m.rolle ?? '',
      email: m.email ?? '',
      telefon: m.telefon ?? '',
      aktiv: m.aktiv !== false,
      notiz: m.notiz ?? '',
    })
  }

  const active = mitarbeiter.filter(m => m.aktiv !== false).length

  return (
    <div>
      <Toast msg={toast} isError={toastError} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Mitarbeiter gesamt', value: String(mitarbeiter.length), icon: '👷', color: '#a78bfa' },
          { label: 'Aktiv', value: String(active), icon: '✅', color: '#10b981' },
          { label: 'Inaktiv', value: String(mitarbeiter.length - active), icon: '⏸️', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="pk-card" style={{ marginBottom: 16, border: '1px solid rgba(167,139,250,.22)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>{editId ? '✏️ Mitarbeiter bearbeiten' : '+ Mitarbeiter anlegen'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <input className="pk-input" placeholder="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <input className="pk-input" placeholder="Rolle / Bereich" value={form.rolle} onChange={e => setForm(p => ({ ...p, rolle: e.target.value }))} />
          <input className="pk-input" placeholder="E-Mail" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          <input className="pk-input" placeholder="Telefon" value={form.telefon} onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d0d9e8', fontSize: 13 }}>
            <input type="checkbox" checked={form.aktiv} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))} />
            Aktiv
          </label>
        </div>
        <textarea className="pk-input" rows={3} placeholder="Notiz" value={form.notiz} onChange={e => setForm(p => ({ ...p, notiz: e.target.value }))} style={{ marginTop: 12 }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="pk-btn" onClick={save}>{editId ? 'Speichern' : 'Mitarbeiter anlegen'}</button>
          {editId && <button className="pk-btn-ghost" onClick={reset}>Abbrechen</button>}
        </div>
      </div>

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead><tr><th>Name</th><th>Rolle</th><th>Kontakt</th><th>Status</th><th>Notiz</th><th>Aktionen</th></tr></thead>
          <tbody>
            {mitarbeiter.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#aeb9c8' }}>Noch keine Mitarbeiter angelegt.</td></tr>
            ) : mitarbeiter.map(m => (
              <tr key={m.id}>
                <td style={{ fontWeight: 800 }}>👷 {m.name}</td>
                <td style={{ color: '#aeb9c8' }}>{m.rolle ?? '—'}</td>
                <td style={{ color: '#aeb9c8', fontSize: 12 }}>{m.email || m.telefon ? `${m.email ?? ''}${m.email && m.telefon ? ' · ' : ''}${m.telefon ?? ''}` : '—'}</td>
                <td><span className={`badge ${m.aktiv === false ? 'badge-gray' : 'badge-green'}`}>{m.aktiv === false ? 'Inaktiv' : 'Aktiv'}</span></td>
                <td style={{ color: '#aeb9c8', fontSize: 12 }}>{m.notiz ?? '—'}</td>
                <td>
                  {deleteId === m.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => remove(m.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.1)', color: '#fb7185', cursor: 'pointer', fontWeight: 700 }}>Ja</button>
                      <button onClick={() => setDeleteId(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => edit(m)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(167,139,250,.25)', background: 'rgba(167,139,250,.08)', color: '#c4b5fd', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => setDeleteId(m.id)} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#fb7185', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type Tab = 'karten' | 'zeit' | 'material' | 'qualitaet' | 'mitarbeiter'

export default function WerkstattPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<Tab>('karten')
  const [karten, setKarten] = useState<Arbeitskarte[]>(isDemo ? demoKarten : [])
  const [zeitbuchungen, setZeitbuchungen] = useState<Zeitbuchung[]>(isDemo ? demoZeit : [])
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>(isDemo ? demoMitarbeiter : [])
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isDemo) return
    Promise.all([getWerkstattKarten(), getWerkstattZeitbuchungen(), getWerkstattMitarbeiter()])
      .then(([k, z, m]) => { setKarten(k as Arbeitskarte[]); setZeitbuchungen(z as Zeitbuchung[]); setMitarbeiter(m as Mitarbeiter[]) })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const offeneKarten = karten.filter(k => k.status !== 'Fertig' && k.status !== 'Storniert').length
  const kritisch = karten.filter(k => k.prioritaet === 'Kritisch' && k.status !== 'Fertig').length
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const heuteStunden = zeitbuchungen.filter(b => b.datum === today).reduce((s, b) => s + b.stunden, 0)
  const aktiveMitarbeiter = mitarbeiter.filter(m => m.aktiv !== false)
  const mitarbeiterNamen = aktiveMitarbeiter.map(m => m.name)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade WerkstattPilot…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🛠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>WerkstattPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Arbeitskarten · Zeiterfassung · Material · Qualität</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Offene Karten', value: String(offeneKarten), icon: '🛠️', color: '#a78bfa' },
          { label: 'Kritisch', value: String(kritisch), icon: '🔴', color: '#f43f5e' },
          { label: 'Stunden heute', value: `${heuteStunden}h`, icon: '⏱️', color: '#10b981' },
          { label: 'Mitarbeiter', value: String(aktiveMitarbeiter.length), icon: '👷', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {([
          { id: 'karten', label: '📋 Arbeitskarten' },
          { id: 'zeit', label: '⏱️ Zeiterfassung' },
          { id: 'material', label: '🔩 Material' },
          { id: 'qualitaet', label: '✅ Qualität' },
          { id: 'mitarbeiter', label: '👷 Mitarbeiter' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
            color: tab === t.id ? '#c4b5fd' : '#aeb9c8', marginBottom: -1, transition: 'color .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'karten' && <ArbeitskartentTab isDemo={isDemo} mitarbeiterNamen={mitarbeiterNamen} />}
      {tab === 'zeit' && <ZeiterfassungTab isDemo={isDemo} mitarbeiterNamen={mitarbeiterNamen} />}
      {tab === 'material' && <MaterialverbrauchTab isDemo={isDemo} mitarbeiterNamen={mitarbeiterNamen} />}
      {tab === 'qualitaet' && <QualitaetTab isDemo={isDemo} mitarbeiterNamen={mitarbeiterNamen} />}
      {tab === 'mitarbeiter' && <MitarbeiterTab isDemo={isDemo} mitarbeiter={mitarbeiter} setMitarbeiter={setMitarbeiter} />}
    </div>
  )
}
