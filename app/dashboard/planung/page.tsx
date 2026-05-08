'use client'
import { useState, useEffect, useCallback } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getPlanungProjekte, upsertPlanungProjekt, deletePlanungProjekt,
  getPlanungAufgaben, upsertPlanungAufgabe, deletePlanungAufgabe,
  getPlanungTermine, upsertPlanungTermin, deletePlanungTermin,
  getPlanungRessourcen, upsertPlanungRessource,
} from '@/lib/db'

// ── Typen ─────────────────────────────────────────────────────────────────────

type ProjektStatus = 'Planung' | 'Aktiv' | 'Pausiert' | 'Abgeschlossen' | 'Kritisch'
type AufgabeStatus = 'Offen' | 'In Arbeit' | 'Erledigt' | 'Blockiert'
type Prioritaet = 'Niedrig' | 'Mittel' | 'Hoch' | 'Kritisch'

type Meilenstein = { name: string; datum: string; erledigt: boolean }

type Projekt = {
  id: string; name: string; kunde: string; status: ProjektStatus
  start: string; ende: string; budget: string; fortschritt: number
  beschreibung: string; verantwortlich: string
  meilensteine: Meilenstein[]
}

type Aufgabe = {
  id: string; titel: string; projekt: string; verantwortlich: string
  prioritaet: Prioritaet; status: AufgabeStatus; faellig: string; erstellt: string
}

type Termin = {
  id: string; titel: string; datum: string; uhrzeit: string
  typ: 'Meeting' | 'Deadline' | 'Lieferung' | 'Wartung'
  projekt: string; teilnehmer: string
}

type Ressource = {
  id: string; name: string; typ: 'Person' | 'Maschine' | 'Fahrzeug'
  kapazitaet: number; genutzt: number; projekt: string
  status: 'Verfügbar' | 'Belegt' | 'Wartung'
}

// ── Demo-Daten ────────────────────────────────────────────────────────────────

const demoProjekte: Projekt[] = [
  {
    id: 'PRJ-001', name: 'Hallenerweiterung Müller Bau', kunde: 'Müller Bau GmbH',
    status: 'Aktiv', start: '01.04.2025', ende: '30.06.2025', budget: '48.000 €',
    fortschritt: 42, beschreibung: 'Planung und Ausführung Stahlkonstruktion für Hallenerweiterung 400m²',
    verantwortlich: 'K. Petersen',
    meilensteine: [
      { name: 'Planung abgeschlossen', datum: '15.04.2025', erledigt: true },
      { name: 'Fundamente fertig', datum: '30.04.2025', erledigt: true },
      { name: 'Stahlbau aufgestellt', datum: '31.05.2025', erledigt: false },
      { name: 'Abnahme', datum: '30.06.2025', erledigt: false },
    ],
  },
  {
    id: 'PRJ-002', name: 'Wartungsvertrag Technik Nord Q2', kunde: 'Technik Nord AG',
    status: 'Aktiv', start: '01.04.2025', ende: '30.06.2025', budget: '7.200 €',
    fortschritt: 65, beschreibung: 'Quartalsweise Instandhaltung aller Produktionsanlagen',
    verantwortlich: 'M. Fischer',
    meilensteine: [
      { name: 'Anlage A gewartet', datum: '15.04.2025', erledigt: true },
      { name: 'Anlage B gewartet', datum: '15.05.2025', erledigt: true },
      { name: 'Anlage C gewartet', datum: '15.06.2025', erledigt: false },
      { name: 'Abschlussbericht', datum: '30.06.2025', erledigt: false },
    ],
  },
  {
    id: 'PRJ-003', name: 'Schaltschrankbau Delta Logistik', kunde: 'Delta Logistik KG',
    status: 'Planung', start: '01.06.2025', ende: '31.08.2025', budget: '22.500 €',
    fortschritt: 8, beschreibung: 'Sonderanfertigung 3 Schaltschränke für neue Sorteranlage',
    verantwortlich: 'J. Brand',
    meilensteine: [
      { name: 'Technische Spezifikation', datum: '15.05.2025', erledigt: false },
      { name: 'Materialbeschaffung', datum: '01.06.2025', erledigt: false },
      { name: 'Fertigung', datum: '31.07.2025', erledigt: false },
      { name: 'Lieferung & Inbetriebnahme', datum: '31.08.2025', erledigt: false },
    ],
  },
  {
    id: 'PRJ-004', name: 'Carport-Montage Werner', kunde: 'Hans Werner',
    status: 'Aktiv', start: '05.05.2025', ende: '20.05.2025', budget: '3.100 €',
    fortschritt: 20, beschreibung: 'Fundament und Montage Carport 6×3m mit Regenrinne',
    verantwortlich: 'T. Schulz',
    meilensteine: [
      { name: 'Fundament ausgehoben', datum: '08.05.2025', erledigt: false },
      { name: 'Beton eingebracht', datum: '10.05.2025', erledigt: false },
      { name: 'Montage Carport', datum: '16.05.2025', erledigt: false },
      { name: 'Abnahme', datum: '20.05.2025', erledigt: false },
    ],
  },
]

const demoAufgaben: Aufgabe[] = [
  { id: 'AU-001', titel: 'Statikberechnung Hallenerweiterung finalisieren', projekt: 'PRJ-001', verantwortlich: 'K. Petersen', prioritaet: 'Hoch', status: 'In Arbeit', faellig: '10.05.2025', erstellt: '28.04.2025' },
  { id: 'AU-002', titel: 'Stahllieferung Termin koordinieren', projekt: 'PRJ-001', verantwortlich: 'K. Petersen', prioritaet: 'Hoch', status: 'Offen', faellig: '12.05.2025', erstellt: '02.05.2025' },
  { id: 'AU-003', titel: 'Anlage B Ölwechsel durchführen', projekt: 'PRJ-002', verantwortlich: 'M. Fischer', prioritaet: 'Mittel', status: 'Erledigt', faellig: '15.05.2025', erstellt: '01.05.2025' },
  { id: 'AU-004', titel: 'Technische Anforderungen Schaltschrank klären', projekt: 'PRJ-003', verantwortlich: 'J. Brand', prioritaet: 'Kritisch', status: 'In Arbeit', faellig: '08.05.2025', erstellt: '30.04.2025' },
  { id: 'AU-005', titel: 'Baugrube Werner abstecken', projekt: 'PRJ-004', verantwortlich: 'T. Schulz', prioritaet: 'Mittel', status: 'Offen', faellig: '07.05.2025', erstellt: '05.05.2025' },
  { id: 'AU-006', titel: 'Baugenehmigung Müller prüfen', projekt: 'PRJ-001', verantwortlich: 'K. Petersen', prioritaet: 'Hoch', status: 'Blockiert', faellig: '09.05.2025', erstellt: '01.05.2025' },
]

const demoTermine: Termin[] = [
  { id: 'T-001', titel: 'Kick-Off Hallenerweiterung', datum: '08.05.2025', uhrzeit: '09:00', typ: 'Meeting', projekt: 'PRJ-001', teilnehmer: 'K. Petersen, T. Müller' },
  { id: 'T-002', titel: 'Lieferung Stahlträger Charge 1', datum: '13.05.2025', uhrzeit: '07:00', typ: 'Lieferung', projekt: 'PRJ-001', teilnehmer: 'K. Petersen' },
  { id: 'T-003', titel: 'Technik Nord – Anlage C Termin', datum: '15.06.2025', uhrzeit: '08:00', typ: 'Wartung', projekt: 'PRJ-002', teilnehmer: 'M. Fischer, L. Brandt' },
  { id: 'T-004', titel: 'Abgabe Spezifikation Schaltschrank', datum: '15.05.2025', uhrzeit: '17:00', typ: 'Deadline', projekt: 'PRJ-003', teilnehmer: 'J. Brand' },
  { id: 'T-005', titel: 'Beton-Lieferung Werner', datum: '10.05.2025', uhrzeit: '06:30', typ: 'Lieferung', projekt: 'PRJ-004', teilnehmer: 'T. Schulz' },
  { id: 'T-006', titel: 'Wochenmeeting Planung', datum: '12.05.2025', uhrzeit: '10:00', typ: 'Meeting', projekt: '—', teilnehmer: 'Alle' },
]

const demoRessourcen: Ressource[] = [
  { id: 'R-001', name: 'K. Petersen', typ: 'Person', kapazitaet: 40, genutzt: 36, projekt: 'PRJ-001', status: 'Belegt' },
  { id: 'R-002', name: 'M. Fischer', typ: 'Person', kapazitaet: 40, genutzt: 28, projekt: 'PRJ-002', status: 'Belegt' },
  { id: 'R-003', name: 'T. Schulz', typ: 'Person', kapazitaet: 40, genutzt: 16, projekt: 'PRJ-004', status: 'Verfügbar' },
  { id: 'R-004', name: 'J. Brand', typ: 'Person', kapazitaet: 40, genutzt: 32, projekt: 'PRJ-003', status: 'Belegt' },
  { id: 'R-005', name: 'Schweißanlage MIG-Pro', typ: 'Maschine', kapazitaet: 50, genutzt: 22, projekt: 'PRJ-001', status: 'Verfügbar' },
  { id: 'R-006', name: 'Kran 5t', typ: 'Maschine', kapazitaet: 50, genutzt: 50, projekt: 'PRJ-001', status: 'Belegt' },
  { id: 'R-007', name: 'Transporter LT35', typ: 'Fahrzeug', kapazitaet: 50, genutzt: 18, projekt: 'PRJ-004', status: 'Verfügbar' },
  { id: 'R-008', name: 'Bagger Compact', typ: 'Maschine', kapazitaet: 50, genutzt: 0, projekt: '—', status: 'Wartung' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLOR = '#f43f5e'

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}

function todayDE() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Fixed-position toast (bottom-right, like LagerPilot)
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
      fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      animation: 'fade-in-scale .2s ease',
    }}>{msg}</div>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#aeb9c8', minWidth: 30 }}>{value}%</span>
    </div>
  )
}

const LABEL: Record<string, string> = {
  name: 'Projektname *', kunde: 'Kunde *', verantwortlich: 'Verantwortlich',
  budget: 'Budget (€)', start: 'Startdatum', ende: 'Enddatum', beschreibung: 'Beschreibung',
  titel: 'Titel *', datum: 'Datum *', uhrzeit: 'Uhrzeit', projekt: 'Projekt',
  teilnehmer: 'Teilnehmer', faellig: 'Fällig am',
}
const PLACEHOLDER: Record<string, string> = {
  name: 'z.B. Umbau Lager Nord', kunde: 'Kundenname', verantwortlich: 'Mitarbeitername',
  budget: 'z.B. 15000', start: 'TT.MM.JJJJ', ende: 'TT.MM.JJJJ', beschreibung: 'Kurze Beschreibung…',
  titel: 'z.B. Kundengespräch', datum: 'TT.MM.JJJJ', uhrzeit: 'HH:MM',
  projekt: 'PRJ-XXX oder —', teilnehmer: 'Namen, kommagetrennt', faellig: 'TT.MM.JJJJ',
}

const projektStatusColor: Record<ProjektStatus, string> = {
  Planung: '#aeb9c8', Aktiv: '#1684ff', Pausiert: '#f59e0b', Abgeschlossen: '#25d366', Kritisch: '#f43f5e',
}
const projektStatusBadge: Record<ProjektStatus, string> = {
  Planung: 'badge-gray', Aktiv: 'badge-blue', Pausiert: 'badge-orange', Abgeschlossen: 'badge-green', Kritisch: 'badge-red',
}
const aufgabeStatusBadge: Record<AufgabeStatus, string> = {
  Offen: 'badge-gray', 'In Arbeit': 'badge-blue', Erledigt: 'badge-green', Blockiert: 'badge-red',
}
const prioBadge: Record<Prioritaet, string> = {
  Niedrig: 'badge-gray', Mittel: 'badge-blue', Hoch: 'badge-orange', Kritisch: 'badge-red',
}
const prioColor: Record<Prioritaet, string> = {
  Niedrig: '#aeb9c8', Mittel: '#1684ff', Hoch: '#f59e0b', Kritisch: '#f43f5e',
}
const terminTypIcon: Record<Termin['typ'], string> = { Meeting: '🤝', Deadline: '🚨', Lieferung: '🚚', Wartung: '🔧' }
const terminTypColor: Record<Termin['typ'], string> = {
  Meeting: '#1684ff', Deadline: '#f43f5e', Lieferung: '#25d366', Wartung: '#f59e0b',
}

// ── Modal-Wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div
        className="pk-card fade-in"
        style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Projekte-Tab ──────────────────────────────────────────────────────────────

type ProjektFormState = {
  name: string; kunde: string; verantwortlich: string; start: string
  ende: string; budget: string; beschreibung: string; status: ProjektStatus
}

const emptyProjektForm: ProjektFormState = {
  name: '', kunde: '', verantwortlich: '', start: '', ende: '', budget: '', beschreibung: '', status: 'Planung',
}

function ProjekteTab({ isDemo }: { isDemo: boolean }) {
  const [projekte, setProjekte] = useState<Projekt[]>(isDemo ? demoProjekte : [])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editProjekt, setEditProjekt] = useState<Projekt | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<ProjektFormState>(emptyProjektForm)
  const [editForm, setEditForm] = useState<ProjektFormState>(emptyProjektForm)
  // Meilenstein add
  const [msForm, setMsForm] = useState<Record<string, { name: string; datum: string }>>({})

  useEffect(() => {
    if (isDemo) return
    getPlanungProjekte()
      .then(data => setProjekte(data as Projekt[]))
      .catch(() => showToast('Fehler beim Laden der Projekte', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = useCallback((msg: string, error = false) => {
    setToastType(error ? 'error' : 'success')
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }, [])

  const filtered = projekte.filter(p => filterStatus === 'Alle' || p.status === filterStatus)
  const counts: Record<string, number> = { Alle: projekte.length }
  projekte.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1 })

  // Create
  const handleCreate = async () => {
    if (!createForm.name || !createForm.kunde) return
    const newP: Projekt = {
      id: genId('PRJ'), name: createForm.name, kunde: createForm.kunde,
      status: createForm.status, start: createForm.start || '—', ende: createForm.ende || '—',
      budget: createForm.budget ? `${createForm.budget} €` : '—', fortschritt: 0,
      beschreibung: createForm.beschreibung, verantwortlich: createForm.verantwortlich,
      meilensteine: [],
    }
    if (!isDemo) {
      try { await upsertPlanungProjekt(newP) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProjekte(prev => [newP, ...prev])
    setCreateForm(emptyProjektForm)
    setShowCreateForm(false)
    showToast(`✅ Projekt "${newP.name}" angelegt`)
  }

  // Edit – open modal
  const openEdit = (p: Projekt) => {
    setEditForm({
      name: p.name, kunde: p.kunde, verantwortlich: p.verantwortlich,
      start: p.start === '—' ? '' : p.start, ende: p.ende === '—' ? '' : p.ende,
      budget: p.budget.replace(' €', ''), beschreibung: p.beschreibung, status: p.status,
    })
    setEditProjekt(p)
  }

  const handleUpdate = async () => {
    if (!editProjekt || !editForm.name) return
    const updated: Projekt = {
      ...editProjekt,
      name: editForm.name, kunde: editForm.kunde, verantwortlich: editForm.verantwortlich,
      start: editForm.start || '—', ende: editForm.ende || '—',
      budget: editForm.budget ? `${editForm.budget} €` : '—',
      beschreibung: editForm.beschreibung, status: editForm.status,
    }
    if (!isDemo) {
      try { await upsertPlanungProjekt(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProjekte(prev => prev.map(p => p.id === updated.id ? updated : p))
    setEditProjekt(null)
    showToast(`✅ Projekt "${updated.name}" aktualisiert`)
  }

  // Delete
  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try { await deletePlanungProjekt(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setProjekte(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Projekt gelöscht')
  }

  // Meilenstein toggle
  const toggleMeilenstein = async (projektId: string, msIndex: number) => {
    const projekt = projekte.find(p => p.id === projektId)
    if (!projekt) return
    const ms = projekt.meilensteine.map((m, i) => i === msIndex ? { ...m, erledigt: !m.erledigt } : m)
    const done = ms.filter(m => m.erledigt).length
    const updated = { ...projekt, meilensteine: ms, fortschritt: ms.length > 0 ? Math.round((done / ms.length) * 100) : 0 }
    if (!isDemo) {
      try { await upsertPlanungProjekt(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProjekte(prev => prev.map(p => p.id === projektId ? updated : p))
  }

  // Meilenstein add
  const handleAddMeilenstein = async (projektId: string) => {
    const f = msForm[projektId]
    if (!f?.name) return
    const projekt = projekte.find(p => p.id === projektId)
    if (!projekt) return
    const ms = [...projekt.meilensteine, { name: f.name, datum: f.datum || '—', erledigt: false }]
    const done = ms.filter(m => m.erledigt).length
    const updated = { ...projekt, meilensteine: ms, fortschritt: Math.round((done / ms.length) * 100) }
    if (!isDemo) {
      try { await upsertPlanungProjekt(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProjekte(prev => prev.map(p => p.id === projektId ? updated : p))
    setMsForm(prev => ({ ...prev, [projektId]: { name: '', datum: '' } }))
    showToast('✅ Meilenstein hinzugefügt')
  }

  // Meilenstein delete
  const handleDeleteMeilenstein = async (projektId: string, msIndex: number) => {
    const projekt = projekte.find(p => p.id === projektId)
    if (!projekt) return
    const ms = projekt.meilensteine.filter((_, i) => i !== msIndex)
    const done = ms.filter(m => m.erledigt).length
    const updated = { ...projekt, meilensteine: ms, fortschritt: ms.length > 0 ? Math.round((done / ms.length) * 100) : 0 }
    if (!isDemo) {
      try { await upsertPlanungProjekt(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setProjekte(prev => prev.map(p => p.id === projektId ? updated : p))
  }

  if (loading) return <LoadingSpinner label="Lade Projekte…" />

  return (
    <div>
      <Toast msg={toast} type={toastType} />

      {/* Filter + Neu */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Aktiv', 'Planung', 'Pausiert', 'Kritisch', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 13px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(244,63,94,.15)' : 'transparent',
              color: filterStatus === s ? '#fb7185' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }}
          onClick={() => setShowCreateForm(f => !f)}>
          {showCreateForm ? '✕ Abbrechen' : '+ Neues Projekt'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(244,63,94,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📁 Neues Projekt anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {(['name', 'kunde', 'verantwortlich', 'budget', 'start', 'ende'] as const).map(k => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{LABEL[k]}</label>
                <input className="pk-input" placeholder={PLACEHOLDER[k]} value={createForm[k]} onChange={e => setCreateForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Status</label>
              <select className="pk-input" value={createForm.status} onChange={e => setCreateForm(p => ({ ...p, status: e.target.value as ProjektStatus }))} style={{ cursor: 'pointer' }}>
                {(['Planung', 'Aktiv', 'Pausiert', 'Kritisch', 'Abgeschlossen'] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Beschreibung</label>
              <input className="pk-input" placeholder={PLACEHOLDER.beschreibung} value={createForm.beschreibung} onChange={e => setCreateForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleCreate}>Projekt anlegen</button>
        </div>
      )}

      {/* Projekt-Karten */}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="pk-card" style={{ border: `1px solid ${projektStatusColor[p.status]}20` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: projektStatusColor[p.status] + '18', border: `1px solid ${projektStatusColor[p.status]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📁</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{p.id}</span>
                  <span className={`badge ${projektStatusBadge[p.status]}`}>{p.status}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2, flexWrap: 'wrap' }}>
                  🏢 {p.kunde} · 👤 {p.verantwortlich} · 📅 {p.start} – {p.ende} · 💶 {p.budget}
                </div>
              </div>
              {/* Aktionen */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(p)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✏️ Bearbeiten</button>
                <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>
                  {expanded === p.id ? '▲' : '▼ Details'}
                </button>
                {deleteConfirm === p.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleDelete(p.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.15)', color: '#fb7185', cursor: 'pointer' }}>Ja, löschen</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Abbrechen</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(p.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
                )}
              </div>
            </div>

            <ProgressBar value={p.fortschritt} color={projektStatusColor[p.status]} />

            {/* Expandierte Details */}
            {expanded === p.id && (
              <div className="fade-in" style={{ marginTop: 16 }}>
                {p.beschreibung && (
                  <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                    {p.beschreibung}
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Meilensteine ({p.meilensteine.filter(m => m.erledigt).length}/{p.meilensteine.length})
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {p.meilensteine.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: m.erledigt ? 'rgba(37,211,102,.06)' : 'rgba(255,255,255,.03)', border: `1px solid ${m.erledigt ? 'rgba(37,211,102,.2)' : 'rgba(255,255,255,.06)'}` }}>
                      <span style={{ fontSize: 18, cursor: 'pointer', flexShrink: 0 }} onClick={() => toggleMeilenstein(p.id, i)}>{m.erledigt ? '✅' : '⬜'}</span>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleMeilenstein(p.id, i)}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: m.erledigt ? '#4ddb7e' : '#f8fbff', textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: '#aeb9c8' }}>📅 {m.datum}</div>
                      </div>
                      <span style={{ fontSize: 11, color: m.erledigt ? '#4ddb7e' : '#4a5568', marginRight: 8 }}>{m.erledigt ? 'Fertig' : 'Ausstehend'}</span>
                      <button onClick={() => handleDeleteMeilenstein(p.id, i)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }} title="Meilenstein löschen">✕</button>
                    </div>
                  ))}
                  {p.meilensteine.length === 0 && <div style={{ color: '#4a5568', fontSize: 13 }}>Noch keine Meilensteine definiert</div>}
                </div>

                {/* Meilenstein hinzufügen */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="pk-input" placeholder="Neuer Meilenstein…" style={{ flex: 1, minWidth: 160, fontSize: 13 }}
                    value={msForm[p.id]?.name || ''}
                    onChange={e => setMsForm(prev => ({ ...prev, [p.id]: { ...prev[p.id], name: e.target.value } }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddMeilenstein(p.id) }}
                  />
                  <input
                    className="pk-input" placeholder="Datum (TT.MM.JJJJ)" style={{ width: 160, fontSize: 13 }}
                    value={msForm[p.id]?.datum || ''}
                    onChange={e => setMsForm(prev => ({ ...prev, [p.id]: { ...prev[p.id], datum: e.target.value } }))}
                  />
                  <button className="pk-btn" style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg, #e11d48, #9f1239)', flexShrink: 0 }}
                    onClick={() => handleAddMeilenstein(p.id)}>+ Hinzufügen</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4a5568', fontSize: 14 }}>
            Keine Projekte gefunden.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editProjekt && (
        <Modal title={`✏️ Projekt bearbeiten – ${editProjekt.id}`} onClose={() => setEditProjekt(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {(['name', 'kunde', 'verantwortlich', 'budget', 'start', 'ende'] as const).map(k => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{LABEL[k]}</label>
                <input className="pk-input" placeholder={PLACEHOLDER[k]} value={editForm[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as ProjektStatus }))} style={{ cursor: 'pointer' }}>
                {(['Planung', 'Aktiv', 'Pausiert', 'Kritisch', 'Abgeschlossen'] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Beschreibung</label>
              <input className="pk-input" placeholder={PLACEHOLDER.beschreibung} value={editForm.beschreibung} onChange={e => setEditForm(p => ({ ...p, beschreibung: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleUpdate}>Änderungen speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditProjekt(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Kalender-Tab ──────────────────────────────────────────────────────────────

type TerminFormState = { titel: string; datum: string; uhrzeit: string; typ: string; projekt: string; teilnehmer: string }
const emptyTerminForm: TerminFormState = { titel: '', datum: '', uhrzeit: '', typ: 'Meeting', projekt: '', teilnehmer: '' }

function KalenderTab({ isDemo }: { isDemo: boolean }) {
  const [termine, setTermine] = useState<Termin[]>(isDemo ? demoTermine : [])
  const [showForm, setShowForm] = useState(false)
  const [editTermin, setEditTermin] = useState<Termin | null>(null)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<TerminFormState>(emptyTerminForm)
  const [editForm, setEditForm] = useState<TerminFormState>(emptyTerminForm)

  useEffect(() => {
    if (isDemo) return
    getPlanungTermine()
      .then(data => setTermine(data as Termin[]))
      .catch(() => showToast('Fehler beim Laden der Termine', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToastType(error ? 'error' : 'success')
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const sortFn = (a: Termin, b: Termin) => {
    const da = a.datum.split('.').reverse().join('')
    const db = b.datum.split('.').reverse().join('')
    return da.localeCompare(db)
  }

  const handleCreate = async () => {
    if (!form.titel || !form.datum) return
    const newT: Termin = {
      id: genId('T'), titel: form.titel, datum: form.datum,
      uhrzeit: form.uhrzeit || '—', typ: form.typ as Termin['typ'],
      projekt: form.projekt || '—', teilnehmer: form.teilnehmer || '—',
    }
    if (!isDemo) {
      try { await upsertPlanungTermin(newT) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setTermine(prev => [...prev, newT].sort(sortFn))
    setForm(emptyTerminForm)
    setShowForm(false)
    showToast(`✅ Termin "${newT.titel}" eingetragen`)
  }

  const openEdit = (t: Termin) => {
    setEditForm({ titel: t.titel, datum: t.datum, uhrzeit: t.uhrzeit === '—' ? '' : t.uhrzeit, typ: t.typ, projekt: t.projekt === '—' ? '' : t.projekt, teilnehmer: t.teilnehmer === '—' ? '' : t.teilnehmer })
    setEditTermin(t)
  }

  const handleUpdate = async () => {
    if (!editTermin || !editForm.titel) return
    const updated: Termin = { ...editTermin, ...editForm, typ: editForm.typ as Termin['typ'], uhrzeit: editForm.uhrzeit || '—', projekt: editForm.projekt || '—', teilnehmer: editForm.teilnehmer || '—' }
    if (!isDemo) {
      try { await upsertPlanungTermin(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setTermine(prev => prev.map(t => t.id === updated.id ? updated : t).sort(sortFn))
    setEditTermin(null)
    showToast(`✅ Termin aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try { await deletePlanungTermin(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setTermine(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Termin gelöscht')
  }

  if (loading) return <LoadingSpinner label="Lade Termine…" />

  const sorted = [...termine].sort(sortFn)

  return (
    <div>
      <Toast msg={toast} type={toastType} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
          {(['Meeting', 'Deadline', 'Lieferung', 'Wartung'] as const).map(t => (
            <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 14 }}>{terminTypIcon[t]}</span>
              <span style={{ color: terminTypColor[t], fontWeight: 700 }}>{t}</span>
            </span>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Termin'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(244,63,94,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📅 Neuen Termin eintragen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {(['titel', 'datum', 'uhrzeit', 'projekt', 'teilnehmer'] as const).map(k => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{LABEL[k]}</label>
                <input className="pk-input" placeholder={PLACEHOLDER[k]} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Meeting', 'Deadline', 'Lieferung', 'Wartung'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleCreate}>Termin speichern</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {sorted.map(t => (
          <div key={t.id} className="pk-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', border: `1px solid ${terminTypColor[t.typ]}18` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: terminTypColor[t.typ] + '18', border: `1px solid ${terminTypColor[t.typ]}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {terminTypIcon[t.typ]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{t.titel}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {t.projekt !== '—' && <span>📁 {t.projekt}</span>}
                <span>👥 {t.teilnehmer}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: terminTypColor[t.typ] }}>{t.datum}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>⏰ {t.uhrzeit} Uhr</div>
              <span style={{ fontSize: 10, color: terminTypColor[t.typ], fontWeight: 700 }}>{t.typ}</span>
            </div>
            {/* Aktionen */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
              <button onClick={() => openEdit(t)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✏️</button>
              {deleteConfirm === t.id ? (
                <div style={{ display: 'flex', gap: 3 }}>
                  <button onClick={() => handleDelete(t.id)} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.15)', color: '#fb7185', cursor: 'pointer' }}>✓</button>
                  <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(t.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 7, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4a5568', fontSize: 14 }}>Keine Termine vorhanden.</div>
        )}
      </div>

      {/* Edit Modal */}
      {editTermin && (
        <Modal title={`✏️ Termin bearbeiten`} onClose={() => setEditTermin(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {(['titel', 'datum', 'uhrzeit', 'projekt', 'teilnehmer'] as const).map(k => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{LABEL[k]}</label>
                <input className="pk-input" placeholder={PLACEHOLDER[k]} value={editForm[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
              <select className="pk-input" value={editForm.typ} onChange={e => setEditForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Meeting', 'Deadline', 'Lieferung', 'Wartung'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleUpdate}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditTermin(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Ressourcen-Tab ────────────────────────────────────────────────────────────

type RessourceFormState = { name: string; typ: string; kapazitaet: string; genutzt: string; projekt: string; status: string }
const emptyRessourceForm: RessourceFormState = { name: '', typ: 'Person', kapazitaet: '40', genutzt: '0', projekt: '', status: 'Verfügbar' }

function RessourcenTab({ isDemo }: { isDemo: boolean }) {
  const [ressourcen, setRessourcen] = useState<Ressource[]>(isDemo ? demoRessourcen : [])
  const [loading, setLoading] = useState(!isDemo)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [showForm, setShowForm] = useState(false)
  const [editRessource, setEditRessource] = useState<Ressource | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<RessourceFormState>(emptyRessourceForm)
  const [editForm, setEditForm] = useState<RessourceFormState>(emptyRessourceForm)

  useEffect(() => {
    if (isDemo) return
    getPlanungRessourcen()
      .then(data => setRessourcen(data as Ressource[]))
      .catch(() => showToast('Fehler beim Laden der Ressourcen', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToastType(error ? 'error' : 'success')
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const personen = ressourcen.filter(r => r.typ === 'Person')
  const maschinen = ressourcen.filter(r => r.typ !== 'Person')
  const gesamtKap = personen.reduce((s, r) => s + r.kapazitaet, 0)
  const genutztKap = personen.reduce((s, r) => s + r.genutzt, 0)
  const auslastung = gesamtKap > 0 ? Math.round((genutztKap / gesamtKap) * 100) : 0

  const statusColor: Record<Ressource['status'], string> = { Verfügbar: '#25d366', Belegt: '#f59e0b', Wartung: '#f43f5e' }
  const statusBadge: Record<Ressource['status'], string> = { Verfügbar: 'badge-green', Belegt: 'badge-orange', Wartung: 'badge-red' }
  const typIcon: Record<Ressource['typ'], string> = { Person: '👤', Maschine: '⚙️', Fahrzeug: '🚚' }

  const toRessource = (f: RessourceFormState, id: string): Ressource => ({
    id, name: f.name, typ: f.typ as Ressource['typ'],
    kapazitaet: parseInt(f.kapazitaet) || 40,
    genutzt: parseInt(f.genutzt) || 0,
    projekt: f.projekt || '—',
    status: f.status as Ressource['status'],
  })

  const handleCreate = async () => {
    if (!form.name) return
    const newR = toRessource(form, genId('R'))
    if (!isDemo) {
      try { await upsertPlanungRessource(newR) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRessourcen(prev => [...prev, newR])
    setForm(emptyRessourceForm)
    setShowForm(false)
    showToast(`✅ Ressource "${newR.name}" angelegt`)
  }

  const openEdit = (r: Ressource) => {
    setEditForm({ name: r.name, typ: r.typ, kapazitaet: String(r.kapazitaet), genutzt: String(r.genutzt), projekt: r.projekt === '—' ? '' : r.projekt, status: r.status })
    setEditRessource(r)
  }

  const handleUpdate = async () => {
    if (!editRessource || !editForm.name) return
    const updated = toRessource(editForm, editRessource.id)
    if (!isDemo) {
      try { await upsertPlanungRessource(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setRessourcen(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRessource(null)
    showToast(`✅ Ressource "${updated.name}" aktualisiert`)
  }

  const handleDelete = async (id: string) => {
    // No deletePlanungRessource in db.ts – handle locally / skip db call
    setRessourcen(prev => prev.filter(r => r.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Ressource entfernt')
  }

  if (loading) return <LoadingSpinner label="Lade Ressourcen…" />

  const RessourceFormFields = ({ f, onChange }: { f: RessourceFormState; onChange: (k: keyof RessourceFormState, v: string) => void }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
      {[
        { k: 'name', label: 'Name *', placeholder: 'z.B. K. Petersen' },
        { k: 'kapazitaet', label: 'Kapazität (h/Woche)', placeholder: '40' },
        { k: 'genutzt', label: 'Genutzt (h/Woche)', placeholder: '0' },
        { k: 'projekt', label: 'Aktuelles Projekt', placeholder: 'PRJ-XXX oder leer' },
      ].map(({ k, label, placeholder }) => (
        <div key={k}>
          <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{label}</label>
          <input className="pk-input" placeholder={placeholder} value={(f as Record<string, string>)[k]} onChange={e => onChange(k as keyof RessourceFormState, e.target.value)} />
        </div>
      ))}
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
        <select className="pk-input" value={f.typ} onChange={e => onChange('typ', e.target.value)} style={{ cursor: 'pointer' }}>
          {['Person', 'Maschine', 'Fahrzeug'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Status</label>
        <select className="pk-input" value={f.status} onChange={e => onChange('status', e.target.value)} style={{ cursor: 'pointer' }}>
          {['Verfügbar', 'Belegt', 'Wartung'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )

  return (
    <div>
      <Toast msg={toast} type={toastType} />
      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Team-Auslastung', value: `${auslastung}%`, icon: '👥', color: auslastung > 85 ? '#f43f5e' : '#1684ff' },
          { label: 'Ressourcen gesamt', value: String(ressourcen.length), icon: '📊', color: COLOR },
          { label: 'Verfügbar', value: String(ressourcen.filter(r => r.status === 'Verfügbar').length), icon: '✅', color: '#25d366' },
          { label: 'In Wartung', value: String(ressourcen.filter(r => r.status === 'Wartung').length), icon: '🔧', color: '#f43f5e' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Neue Ressource */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Ressource'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(244,63,94,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>⚙️ Neue Ressource anlegen</h3>
          <RessourceFormFields f={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} />
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleCreate}>Ressource anlegen</button>
        </div>
      )}

      {[{ titel: '👤 Personal', items: personen }, { titel: '⚙️ Maschinen & Fahrzeuge', items: maschinen }].map(group => (
        <div key={group.titel} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{group.titel}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {group.items.map(r => (
              <div key={r.id} className="pk-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', border: `1px solid ${statusColor[r.status]}18` }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: statusColor[r.status] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {typIcon[r.typ]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
                    <span className={`badge ${statusBadge[r.status]}`}>{r.status}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, maxWidth: 200, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
                      <div style={{ width: `${Math.min((r.genutzt / Math.max(r.kapazitaet, 1)) * 100, 100)}%`, height: '100%', borderRadius: 999, background: (r.genutzt / r.kapazitaet) > 0.85 ? '#f43f5e' : statusColor[r.status] }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#aeb9c8' }}>{r.genutzt}/{r.kapazitaet}h ({Math.round((r.genutzt / Math.max(r.kapazitaet, 1)) * 100)}%)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#aeb9c8', marginRight: 8 }}>
                  {r.projekt !== '—' && <div>📁 {r.projekt}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(r)} style={{ fontSize: 11, padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✏️</button>
                  {deleteConfirm === r.id ? (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => handleDelete(r.id)} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.15)', color: '#fb7185', cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)} style={{ fontSize: 11, padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
            {group.items.length === 0 && <div style={{ color: '#4a5568', fontSize: 13, padding: '10px 0' }}>Keine Einträge.</div>}
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editRessource && (
        <Modal title={`✏️ Ressource bearbeiten – ${editRessource.name}`} onClose={() => setEditRessource(null)}>
          <RessourceFormFields f={editForm} onChange={(k, v) => setEditForm(p => ({ ...p, [k]: v }))} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleUpdate}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditRessource(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Aufgaben-Tab ──────────────────────────────────────────────────────────────

type AufgabeFormState = { titel: string; projekt: string; verantwortlich: string; prioritaet: string; faellig: string }
const emptyAufgabeForm: AufgabeFormState = { titel: '', projekt: '', verantwortlich: '', prioritaet: 'Mittel', faellig: '' }

function AufgabenTab({ isDemo }: { isDemo: boolean }) {
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>(isDemo ? demoAufgaben : [])
  const [showForm, setShowForm] = useState(false)
  const [editAufgabe, setEditAufgabe] = useState<Aufgabe | null>(null)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(!isDemo)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<AufgabeFormState>(emptyAufgabeForm)
  const [editForm, setEditForm] = useState<AufgabeFormState & { status: AufgabeStatus }>(
    { ...emptyAufgabeForm, status: 'Offen' }
  )

  useEffect(() => {
    if (isDemo) return
    getPlanungAufgaben()
      .then(data => setAufgaben(data as Aufgabe[]))
      .catch(() => showToast('Fehler beim Laden der Aufgaben', true))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    setToastType(error ? 'error' : 'success')
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const filtered = aufgaben.filter(a => filterStatus === 'Alle' || a.status === filterStatus)
  const counts: Record<string, number> = { Alle: aufgaben.length }
  aufgaben.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  const handleCreate = async () => {
    if (!form.titel) return
    const newA: Aufgabe = {
      id: genId('AU'), titel: form.titel,
      projekt: form.projekt || '—', verantwortlich: form.verantwortlich || '—',
      prioritaet: form.prioritaet as Prioritaet, status: 'Offen',
      faellig: form.faellig || '—', erstellt: todayDE(),
    }
    if (!isDemo) {
      try { await upsertPlanungAufgabe(newA) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAufgaben(prev => [newA, ...prev])
    setForm(emptyAufgabeForm)
    setShowForm(false)
    showToast(`✅ Aufgabe "${newA.titel}" erstellt`)
  }

  const openEdit = (a: Aufgabe) => {
    setEditForm({ titel: a.titel, projekt: a.projekt === '—' ? '' : a.projekt, verantwortlich: a.verantwortlich === '—' ? '' : a.verantwortlich, prioritaet: a.prioritaet, faellig: a.faellig === '—' ? '' : a.faellig, status: a.status })
    setEditAufgabe(a)
  }

  const handleUpdate = async () => {
    if (!editAufgabe || !editForm.titel) return
    const updated: Aufgabe = {
      ...editAufgabe, titel: editForm.titel,
      projekt: editForm.projekt || '—', verantwortlich: editForm.verantwortlich || '—',
      prioritaet: editForm.prioritaet as Prioritaet, status: editForm.status,
      faellig: editForm.faellig || '—',
    }
    if (!isDemo) {
      try { await upsertPlanungAufgabe(updated) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setAufgaben(prev => prev.map(a => a.id === updated.id ? updated : a))
    setEditAufgabe(null)
    showToast(`✅ Aufgabe aktualisiert`)
  }

  const handleStatus = async (id: string, status: AufgabeStatus) => {
    const aufgabe = aufgaben.find(a => a.id === id)
    if (!isDemo && aufgabe) {
      try { await upsertPlanungAufgabe({ ...aufgabe, status }) } catch { showToast('Fehler', true); return }
    }
    setAufgaben(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    showToast(`✅ Status auf "${status}" gesetzt`)
  }

  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try { await deletePlanungAufgabe(id) } catch { showToast('Fehler beim Löschen', true); return }
    }
    setAufgaben(prev => prev.filter(a => a.id !== id))
    setDeleteConfirm(null)
    showToast('🗑️ Aufgabe gelöscht')
  }

  if (loading) return <LoadingSpinner label="Lade Aufgaben…" />

  return (
    <div>
      <Toast msg={toast} type={toastType} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Offen', 'In Arbeit', 'Blockiert', 'Erledigt'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(244,63,94,.15)' : 'transparent',
              color: filterStatus === s ? '#fb7185' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }}
          onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Aufgabe'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(244,63,94,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>✏️ Neue Aufgabe erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Aufgabe *</label>
              <input className="pk-input" placeholder="Aufgabenbeschreibung eingeben…" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            {([
              { k: 'projekt', label: 'Projekt', placeholder: 'PRJ-XXX' },
              { k: 'verantwortlich', label: 'Verantwortlich', placeholder: 'Mitarbeitername' },
              { k: 'faellig', label: 'Fällig am', placeholder: 'TT.MM.JJJJ' },
            ] as const).map(f => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Priorität</label>
              <select className="pk-input" value={form.prioritaet} onChange={e => setForm(p => ({ ...p, prioritaet: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Niedrig', 'Mittel', 'Hoch', 'Kritisch'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleCreate}>Aufgabe erstellen</button>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Aufgabe</th>
              <th>Projekt</th>
              <th>Priorität</th>
              <th>Status</th>
              <th>Verantwortlich</th>
              <th>Fällig</th>
              <th style={{ minWidth: 120 }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600, maxWidth: 240 }}>{a.titel}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' }}>{a.projekt}</td>
                <td><span className={`badge ${prioBadge[a.prioritaet]}`} style={{ color: prioColor[a.prioritaet] }}>{a.prioritaet}</span></td>
                <td><span className={`badge ${aufgabeStatusBadge[a.status]}`}>{a.status}</span></td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{a.verantwortlich}</td>
                <td style={{ color: a.status !== 'Erledigt' ? '#ffb347' : '#aeb9c8', fontSize: 13, fontWeight: a.status !== 'Erledigt' ? 600 : 400 }}>{a.faellig}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {a.status !== 'In Arbeit' && a.status !== 'Erledigt' && (
                      <button onClick={() => handleStatus(a.id, 'In Arbeit')} title="In Arbeit" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>▶</button>
                    )}
                    {a.status !== 'Erledigt' && (
                      <button onClick={() => handleStatus(a.id, 'Erledigt')} title="Erledigt" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>✅</button>
                    )}
                    <button onClick={() => openEdit(a)} title="Bearbeiten" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(22,132,255,.2)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✏️</button>
                    {deleteConfirm === a.id ? (
                      <>
                        <button onClick={() => handleDelete(a.id)} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.15)', color: '#fb7185', cursor: 'pointer' }}>Ja</button>
                        <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(a.id)} title="Löschen" style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, border: '1px solid rgba(244,63,94,.2)', background: 'transparent', color: '#f43f5e', cursor: 'pointer' }}>🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Aufgabe{filtered.length !== 1 ? 'n' : ''}</div>

      {/* Edit Modal */}
      {editAufgabe && (
        <Modal title={`✏️ Aufgabe bearbeiten`} onClose={() => setEditAufgabe(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Aufgabe *</label>
              <input className="pk-input" value={editForm.titel} onChange={e => setEditForm(p => ({ ...p, titel: e.target.value }))} />
            </div>
            {([
              { k: 'projekt', label: 'Projekt', placeholder: 'PRJ-XXX' },
              { k: 'verantwortlich', label: 'Verantwortlich', placeholder: 'Mitarbeitername' },
              { k: 'faellig', label: 'Fällig am', placeholder: 'TT.MM.JJJJ' },
            ] as const).map(f => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={editForm[f.k]} onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Priorität</label>
              <select className="pk-input" value={editForm.prioritaet} onChange={e => setEditForm(p => ({ ...p, prioritaet: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Niedrig', 'Mittel', 'Hoch', 'Kritisch'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Status</label>
              <select className="pk-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as AufgabeStatus }))} style={{ cursor: 'pointer' }}>
                {(['Offen', 'In Arbeit', 'Blockiert', 'Erledigt'] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #e11d48, #9f1239)' }} onClick={handleUpdate}>Speichern</button>
            <button className="pk-btn-ghost" onClick={() => setEditAufgabe(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Loading Spinner ───────────────────────────────────────────────────────────

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────

type Tab = 'projekte' | 'kalender' | 'ressourcen' | 'aufgaben'

export default function PlanungPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<Tab>('projekte')
  const [projekte, setProjekte] = useState<Projekt[]>(isDemo ? demoProjekte : [])
  const [termine, setTermine] = useState<Termin[]>(isDemo ? demoTermine : [])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>(isDemo ? demoAufgaben : [])
  const [ressourcen, setRessourcen] = useState<Ressource[]>(isDemo ? demoRessourcen : [])
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isDemo) return
    Promise.all([getPlanungProjekte(), getPlanungTermine(), getPlanungAufgaben(), getPlanungRessourcen()])
      .then(([p, t, a, r]) => {
        setProjekte(p as Projekt[])
        setTermine(t as Termin[])
        setAufgaben(a as Aufgabe[])
        setRessourcen(r as Ressource[])
      })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const aktiveProjekte = projekte.filter(p => p.status === 'Aktiv').length
  const offeneAufgaben = aufgaben.filter(a => a.status !== 'Erledigt').length
  const kritischeAufgaben = aufgaben.filter(a => a.prioritaet === 'Kritisch' && a.status !== 'Erledigt').length
  const personenRessourcen = ressourcen.filter(r => r.typ === 'Person')
  const gesamtKap = personenRessourcen.reduce((s, r) => s + r.kapazitaet, 0)
  const genutztKap = personenRessourcen.reduce((s, r) => s + r.genutzt, 0)
  const kapazitaet = gesamtKap > 0 ? Math.round((genutztKap / gesamtKap) * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade PlanungPilot…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(244,63,94,.15)', border: '1px solid rgba(244,63,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📅</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>PlanungPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Projekte · Kalender · Ressourcen · Aufgaben</p>
        </div>
        {isDemo && <span className="badge badge-orange" style={{ marginLeft: 'auto' }}>DEMO</span>}
        {!isDemo && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● LIVE</span>}
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Aktive Projekte', value: String(aktiveProjekte), icon: '📁', color: COLOR },
          { label: 'Termine gesamt', value: String(termine.length), icon: '📅', color: '#1684ff' },
          { label: 'Offene Aufgaben', value: String(offeneAufgaben), icon: '✏️', color: '#f59e0b' },
          { label: '🔴 Kritisch', value: String(kritischeAufgaben), icon: '⚠️', color: kritischeAufgaben > 0 ? '#f43f5e' : '#4a5568' },
          { label: 'Team-Auslastung', value: `${kapazitaet}%`, icon: '⚡', color: kapazitaet > 85 ? '#f43f5e' : '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', overflowX: 'auto' }}>
        {([
          { id: 'projekte', label: '📁 Projekte', count: projekte.length },
          { id: 'kalender', label: '📅 Kalender', count: termine.length },
          { id: 'ressourcen', label: '⚙️ Ressourcen', count: ressourcen.length },
          { id: 'aufgaben', label: '✏️ Aufgaben', count: aufgaben.filter(a => a.status !== 'Erledigt').length },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            background: 'transparent', borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            color: tab === t.id ? '#fb7185' : '#aeb9c8', marginBottom: -1, transition: 'color .15s',
          }}>
            {t.label} <span style={{ opacity: .6, fontSize: 11 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'projekte' && <ProjekteTab isDemo={isDemo} />}
      {tab === 'kalender' && <KalenderTab isDemo={isDemo} />}
      {tab === 'ressourcen' && <RessourcenTab isDemo={isDemo} />}
      {tab === 'aufgaben' && <AufgabenTab isDemo={isDemo} />}
    </div>
  )
}
