'use client'
import { useState } from 'react'

// ── Typen ─────────────────────────────────────────────────────────────────────

type KampagneStatus = 'Entwurf' | 'Aktiv' | 'Pausiert' | 'Abgeschlossen'
type LeadStatus = 'Neu' | 'Kontaktiert' | 'Qualifiziert' | 'Angebot' | 'Gewonnen' | 'Verloren'
type LeadQuelle = 'Website' | 'Empfehlung' | 'Messe' | 'Social Media' | 'Kaltakquise' | 'Sonstiges'

type Kampagne = {
  id: string; name: string; typ: 'E-Mail' | 'Social Media' | 'Newsletter' | 'Anzeige'
  status: KampagneStatus; zielgruppe: string; start: string; ende: string
  empfaenger: number; geoeffnet: number; geklickt: number; konversionen: number
  budget: string
}

type Lead = {
  id: string; name: string; firma: string; email: string; telefon: string
  quelle: LeadQuelle; status: LeadStatus; wert: string; erstellt: string; betreuer: string
}

type Newsletter = {
  id: string; betreff: string; vorschau: string; empfaenger: number
  datum: string; status: 'Entwurf' | 'Geplant' | 'Versendet'
  oeffnungsrate: number; klickrate: number
}

// ── Demo-Daten ────────────────────────────────────────────────────────────────

const initKampagnen: Kampagne[] = [
  { id: 'KMP-001', name: 'Frühjahrs-Aktion 2025', typ: 'E-Mail', status: 'Aktiv', zielgruppe: 'Bestandskunden', start: '01.04.2025', ende: '31.05.2025', empfaenger: 234, geoeffnet: 89, geklickt: 41, konversionen: 12, budget: '800 €' },
  { id: 'KMP-002', name: 'LinkedIn Reichweite Mai', typ: 'Social Media', status: 'Aktiv', zielgruppe: 'B2B-Neukunden', start: '01.05.2025', ende: '31.05.2025', empfaenger: 1840, geoeffnet: 612, geklickt: 188, konversionen: 7, budget: '350 €' },
  { id: 'KMP-003', name: 'Monatlicher Newsletter', typ: 'Newsletter', status: 'Abgeschlossen', zielgruppe: 'Alle Kunden', start: '01.04.2025', ende: '01.04.2025', empfaenger: 312, geoeffnet: 141, geklickt: 58, konversionen: 9, budget: '0 €' },
  { id: 'KMP-004', name: 'Google Ads – Sommer', typ: 'Anzeige', status: 'Entwurf', zielgruppe: 'Neukunden Region', start: '01.06.2025', ende: '31.07.2025', empfaenger: 0, geoeffnet: 0, geklickt: 0, konversionen: 0, budget: '1.200 €' },
  { id: 'KMP-005', name: 'Messe-Nachfass-Mail', typ: 'E-Mail', status: 'Pausiert', zielgruppe: 'Messekontakte', start: '15.03.2025', ende: '15.04.2025', empfaenger: 67, geoeffnet: 18, geklickt: 6, konversionen: 1, budget: '0 €' },
]

const initLeads: Lead[] = [
  { id: 'LD-001', name: 'Peter Braun', firma: 'Braun Metall GmbH', email: 'p.braun@braun-metall.de', telefon: '040 55512', quelle: 'Website', status: 'Qualifiziert', wert: '15.000 €', erstellt: '28.04.2025', betreuer: 'K. Petersen' },
  { id: 'LD-002', name: 'Maria Vogel', firma: 'Vogel Technik KG', email: 'm.vogel@vogeltech.de', telefon: '0511 8834', quelle: 'Messe', status: 'Angebot', wert: '8.200 €', erstellt: '22.04.2025', betreuer: 'K. Petersen' },
  { id: 'LD-003', name: 'Klaus Werner', firma: 'Einzelkunde', email: 'k.werner@gmail.com', telefon: '0172 3314455', quelle: 'Empfehlung', status: 'Kontaktiert', wert: '2.400 €', erstellt: '15.04.2025', betreuer: 'M. Fischer' },
  { id: 'LD-004', name: 'BauGroup Nord AG', firma: 'BauGroup Nord AG', email: 'einkauf@baugroup.de', telefon: '030 44400', quelle: 'Kaltakquise', status: 'Neu', wert: '32.000 €', erstellt: '05.05.2025', betreuer: 'K. Petersen' },
  { id: 'LD-005', name: 'Rainer Holm', firma: 'Holm Elektrotechnik', email: 'r.holm@holm-et.de', telefon: '089 22113', quelle: 'Social Media', status: 'Gewonnen', wert: '6.800 €', erstellt: '10.03.2025', betreuer: 'M. Fischer' },
  { id: 'LD-006', name: 'Stadt Logistik AG', firma: 'Stadt Logistik AG', email: 'info@stadtlog.de', telefon: '0211 77700', quelle: 'Website', status: 'Verloren', wert: '18.500 €', erstellt: '01.03.2025', betreuer: 'K. Petersen' },
]

const initNewsletter: Newsletter[] = [
  { id: 'NL-006', betreff: 'Mai-News: Neue KI-Funktionen & Sommer-Angebote', vorschau: 'Entdecken Sie unsere neuesten Entwicklungen…', empfaenger: 312, datum: '01.05.2025', status: 'Entwurf', oeffnungsrate: 0, klickrate: 0 },
  { id: 'NL-005', betreff: 'April: Frühjahrs-Aktion startet jetzt!', vorschau: 'Nur bis Ende April: 10% Rabatt auf alle Wartungsverträge…', empfaenger: 312, datum: '01.04.2025', status: 'Versendet', oeffnungsrate: 45.2, klickrate: 18.6 },
  { id: 'NL-004', betreff: 'März: Messennachbericht & neue Referenzen', vorschau: 'Wir berichten von der Hannover Messe und stellen neue Kunden vor…', empfaenger: 298, datum: '01.03.2025', status: 'Versendet', oeffnungsrate: 38.7, klickrate: 12.4 },
  { id: 'NL-003', betreff: 'Februar: Produktneuheiten 2025', vorschau: 'Alle neuen Leistungen und Pakete für das neue Jahr…', empfaenger: 287, datum: '01.02.2025', status: 'Versendet', oeffnungsrate: 41.1, klickrate: 15.8 },
]

// ── Helper ────────────────────────────────────────────────────────────────────

const COLOR = '#f59e0b'

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 16, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#4ddb7e', fontSize: 14, fontWeight: 600 }}>{msg}</div>
  )
}

const kampagneStatusBadge: Record<KampagneStatus, string> = {
  Entwurf: 'badge-gray', Aktiv: 'badge-green', Pausiert: 'badge-orange', Abgeschlossen: 'badge-blue',
}
const leadStatusBadge: Record<LeadStatus, string> = {
  Neu: 'badge-gray', Kontaktiert: 'badge-blue', Qualifiziert: 'badge-orange',
  Angebot: 'badge-purple', Gewonnen: 'badge-green', Verloren: 'badge-gray',
}
const leadStatusColor: Record<LeadStatus, string> = {
  Neu: '#aeb9c8', Kontaktiert: '#1684ff', Qualifiziert: '#f59e0b',
  Angebot: '#a78bfa', Gewonnen: '#25d366', Verloren: '#4a5568',
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', borderRadius: 999, background: color }} />
      </div>
      <span style={{ fontSize: 11, color: '#aeb9c8', minWidth: 34 }}>{value.toFixed(1)}%</span>
    </div>
  )
}

// ── Kampagnen-Tab ─────────────────────────────────────────────────────────────

function KampagnenTab() {
  const [kampagnen, setKampagnen] = useState<Kampagne[]>(initKampagnen)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const filtered = kampagnen.filter(k => filterStatus === 'Alle' || k.status === filterStatus)
  const counts: Record<string, number> = { Alle: kampagnen.length }
  kampagnen.forEach(k => { counts[k.status] = (counts[k.status] || 0) + 1 })

  const handleSave = () => {
    if (!form.name || !form.zielgruppe) return
    const newK: Kampagne = {
      id: `KMP-00${kampagnen.length + 1}`, name: form.name,
      typ: form.typ as Kampagne['typ'], status: 'Entwurf',
      zielgruppe: form.zielgruppe, start: form.start || '—', ende: form.ende || '—',
      empfaenger: 0, geoeffnet: 0, geklickt: 0, konversionen: 0,
      budget: form.budget ? `${form.budget} €` : '0 €',
    }
    setKampagnen(prev => [newK, ...prev])
    setForm({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })
    setShowForm(false)
    showToast(`✅ Kampagne "${newK.name}" als Entwurf angelegt`)
  }

  const handleStatus = (id: string, status: KampagneStatus) => {
    setKampagnen(prev => prev.map(k => k.id === id ? { ...k, status } : k))
    showToast(`✅ Kampagne auf "${status}" gesetzt`)
  }

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Aktiv', 'Entwurf', 'Pausiert', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 13px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(245,158,11,.15)' : 'transparent',
              color: filterStatus === s ? '#fbbf24' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Kampagne'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📣 Neue Kampagne erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { label: 'Kampagnenname *', key: 'name', placeholder: 'z.B. Sommer-Aktion 2025' },
              { label: 'Zielgruppe *', key: 'zielgruppe', placeholder: 'z.B. Bestandskunden' },
              { label: 'Budget (€)', key: 'budget', placeholder: 'z.B. 500' },
              { label: 'Start', key: 'start', placeholder: 'TT.MM.JJJJ' },
              { label: 'Ende', key: 'ende', placeholder: 'TT.MM.JJJJ' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['E-Mail', 'Social Media', 'Newsletter', 'Anzeige'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Kampagne anlegen</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(k => {
          const oeffRate = k.empfaenger > 0 ? (k.geoeffnet / k.empfaenger) * 100 : 0
          const klickRate = k.geoeffnet > 0 ? (k.geklickt / k.geoeffnet) * 100 : 0
          return (
            <div key={k.id} className="pk-card" style={{ border: `1px solid ${COLOR}18` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: COLOR + '18', border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {k.typ === 'E-Mail' ? '✉️' : k.typ === 'Social Media' ? '📱' : k.typ === 'Newsletter' ? '📰' : '📢'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{k.id}</span>
                    <span className="badge badge-gray">{k.typ}</span>
                    <span className={`badge ${kampagneStatusBadge[k.status]}`}>{k.status}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{k.name}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>👥 {k.zielgruppe} · 📅 {k.start} – {k.ende} · 💶 {k.budget}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {k.status === 'Entwurf' && <button onClick={() => handleStatus(k.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Starten</button>}
                  {k.status === 'Aktiv' && <button onClick={() => handleStatus(k.id, 'Pausiert')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>⏸ Pausieren</button>}
                  {k.status === 'Aktiv' && <button onClick={() => handleStatus(k.id, 'Abgeschlossen')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✅ Abschließen</button>}
                  {k.status === 'Pausiert' && <button onClick={() => handleStatus(k.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Fortsetzen</button>}
                </div>
              </div>
              {k.empfaenger > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'Empfänger', value: k.empfaenger.toLocaleString('de-DE'), icon: '👥' },
                    { label: 'Geöffnet', value: k.geoeffnet.toLocaleString('de-DE'), icon: '👁️' },
                    { label: 'Geklickt', value: k.geklickt.toLocaleString('de-DE'), icon: '🖱️' },
                    { label: 'Konversionen', value: k.konversionen.toLocaleString('de-DE'), icon: '🎯' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: COLOR }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#aeb9c8', marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {k.empfaenger > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Öffnungsrate</div>
                    <PctBar value={oeffRate} color={COLOR} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Klickrate (von Geöffnet)</div>
                    <PctBar value={klickRate} color="#1684ff" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Leads-Tab ─────────────────────────────────────────────────────────────────

function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>(initLeads)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const filtered = leads.filter(l =>
    (filterStatus === 'Alle' || l.status === filterStatus) &&
    (l.name.toLowerCase().includes(search.toLowerCase()) || l.firma.toLowerCase().includes(search.toLowerCase()))
  )
  const counts: Record<string, number> = { Alle: leads.length }
  leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1 })

  const handleSave = () => {
    if (!form.name || !form.email) return
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newL: Lead = {
      id: `LD-00${leads.length + 1}`, ...form,
      quelle: form.quelle as LeadQuelle, status: 'Neu',
      wert: form.wert ? `${form.wert} €` : '—', erstellt: today,
    }
    setLeads(prev => [newL, ...prev])
    setForm({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })
    setShowForm(false)
    showToast(`✅ Lead "${newL.name}" wurde angelegt`)
  }

  const handleStatusChange = (id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    showToast(`✅ Lead-Status auf "${status}" gesetzt`)
  }

  const pipeline: LeadStatus[] = ['Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen', 'Verloren']

  return (
    <div>
      <Toast msg={toast} />

      {/* Pipeline Visual */}
      <div className="pk-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Pipeline-Übersicht</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }}>
          {pipeline.slice(0, 5).map((s, i) => {
            const n = leads.filter(l => l.status === s).length
            const wert = leads.filter(l => l.status === s).reduce((sum, l) => sum + parseFloat(l.wert.replace(/[^0-9.]/g, '') || '0'), 0)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  minWidth: 110, padding: '10px 14px', borderRadius: 12, textAlign: 'center',
                  background: n > 0 ? leadStatusColor[s] + '15' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${n > 0 ? leadStatusColor[s] + '30' : 'rgba(255,255,255,.06)'}`,
                }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: n > 0 ? leadStatusColor[s] : '#4a5568' }}>{n}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 1 }}>{s}</div>
                  {n > 0 && <div style={{ fontSize: 10, color: leadStatusColor[s], marginTop: 2, fontWeight: 700 }}>{wert.toLocaleString('de-DE')} €</div>}
                </div>
                {i < 4 && <span style={{ color: '#4a5568', fontSize: 18 }}>›</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Leads suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(245,158,11,.15)' : 'transparent',
              color: filterStatus === s ? '#fbbf24' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Lead'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🎯 Neuen Lead anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Vor- und Nachname' },
              { label: 'Firma', key: 'firma', placeholder: 'Firmenname' },
              { label: 'E-Mail *', key: 'email', placeholder: 'email@firma.de' },
              { label: 'Telefon', key: 'telefon', placeholder: '040 12345' },
              { label: 'Potenzieller Wert (€)', key: 'wert', placeholder: 'z.B. 5000' },
              { label: 'Betreuer', key: 'betreuer', placeholder: 'Mitarbeitername' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Quelle</label>
              <select className="pk-input" value={form.quelle} onChange={e => setForm(p => ({ ...p, quelle: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise', 'Sonstiges'].map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Lead anlegen</button>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Lead</th><th>Quelle</th><th>Status</th><th>Wert</th><th>Betreuer</th><th>Erstellt</th><th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{l.firma} · {l.email}</div>
                </td>
                <td><span className="badge badge-gray">{l.quelle}</span></td>
                <td><span className={`badge ${leadStatusBadge[l.status]}`}>{l.status}</span></td>
                <td style={{ fontWeight: 700, color: l.status === 'Gewonnen' ? '#4ddb7e' : COLOR }}>{l.wert}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{l.betreuer}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{l.erstellt}</td>
                <td>
                  {l.status !== 'Gewonnen' && l.status !== 'Verloren' && (
                    <select
                      className="pk-input"
                      style={{ fontSize: 11, padding: '3px 8px', width: 'auto', cursor: 'pointer' }}
                      value={l.status}
                      onChange={e => handleStatusChange(l.id, e.target.value as LeadStatus)}
                    >
                      {pipeline.map(s => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Leads</div>
    </div>
  )
}

// ── Newsletter-Tab ────────────────────────────────────────────────────────────

function NewsletterTab() {
  const [newsletter, setNewsletter] = useState<Newsletter[]>(initNewsletter)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ betreff: '', vorschau: '', datum: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  const handleSave = () => {
    if (!form.betreff) return
    const newNL: Newsletter = {
      id: `NL-00${newsletter.length + 1}`, betreff: form.betreff,
      vorschau: form.vorschau || 'Klicken Sie hier, um mehr zu erfahren…',
      empfaenger: 312, datum: form.datum || new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      status: 'Entwurf', oeffnungsrate: 0, klickrate: 0,
    }
    setNewsletter(prev => [newNL, ...prev])
    setForm({ betreff: '', vorschau: '', datum: '' })
    setShowForm(false)
    showToast(`✅ Newsletter "${newNL.betreff.substring(0, 40)}…" als Entwurf gespeichert`)
  }

  const handleVersenden = (id: string) => {
    setNewsletter(prev => prev.map(n => n.id === id
      ? { ...n, status: 'Versendet', oeffnungsrate: 34 + Math.random() * 15, klickrate: 10 + Math.random() * 8 }
      : n
    ))
    showToast('✅ Newsletter wurde versendet (Demo-Simulation)')
  }

  return (
    <div>
      <Toast msg={toast} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Abonnenten', value: '312', icon: '👥', color: COLOR },
          { label: 'Ø Öffnungsrate', value: '41.7%', icon: '👁️', color: '#10b981' },
          { label: 'Ø Klickrate', value: '15.6%', icon: '🖱️', color: '#1684ff' },
          { label: 'Versendet (gesamt)', value: String(newsletter.filter(n => n.status === 'Versendet').length), icon: '📰', color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Newsletter'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📰 Neuen Newsletter erstellen</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Betreff *</label>
              <input className="pk-input" placeholder="E-Mail-Betreff eingeben…" value={form.betreff} onChange={e => setForm(p => ({ ...p, betreff: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Vorschautext</label>
              <input className="pk-input" placeholder="Kurze Vorschau für den Posteingang…" value={form.vorschau} onChange={e => setForm(p => ({ ...p, vorschau: e.target.value }))} />
            </div>
            <div style={{ maxWidth: 260 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Versanddatum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {newsletter.map(n => (
          <div key={n.id} className="pk-card" style={{ border: `1px solid ${COLOR}15` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: COLOR + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📰</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`badge ${n.status === 'Versendet' ? 'badge-green' : n.status === 'Geplant' ? 'badge-blue' : 'badge-gray'}`}>{n.status}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{n.id}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{n.betreff}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: n.status === 'Versendet' ? 10 : 0 }}>
                  {n.vorschau.substring(0, 80)}… · 📅 {n.datum} · 👥 {n.empfaenger} Empfänger
                </div>
                {n.status === 'Versendet' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Öffnungsrate</div>
                      <PctBar value={n.oeffnungsrate} color={COLOR} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Klickrate</div>
                      <PctBar value={n.klickrate} color="#1684ff" />
                    </div>
                  </div>
                )}
              </div>
              {n.status === 'Entwurf' && (
                <button onClick={() => handleVersenden(n.id)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  📤 Jetzt versenden
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Auswertungen-Tab ──────────────────────────────────────────────────────────

function AuswertungenTab() {
  const gesamtLeads = initLeads.length
  const gewonneneLeads = initLeads.filter(l => l.status === 'Gewonnen').length
  const konvRate = ((gewonneneLeads / gesamtLeads) * 100).toFixed(1)
  const pipelineWert = initLeads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
    .reduce((s, l) => s + parseFloat(l.wert.replace(/[^0-9.]/g, '') || '0'), 0)

  const quellenStats = ['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise'].map(q => ({
    quelle: q,
    count: initLeads.filter(l => l.quelle === q).length,
    gewonnen: initLeads.filter(l => l.quelle === q && l.status === 'Gewonnen').length,
  }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Leads gesamt', value: String(gesamtLeads), icon: '🎯', color: COLOR },
          { label: 'Gewonnen', value: String(gewonneneLeads), icon: '🏆', color: '#10b981' },
          { label: 'Konversionsrate', value: `${konvRate}%`, icon: '📈', color: '#1684ff' },
          { label: 'Pipeline-Wert', value: `${pipelineWert.toLocaleString('de-DE')} €`, icon: '💶', color: '#a78bfa' },
          { label: 'Aktive Kampagnen', value: String(initKampagnen.filter(k => k.status === 'Aktiv').length), icon: '📣', color: COLOR },
          { label: 'Ø Öffnungsrate', value: '41.7%', icon: '👁️', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📊 Leads nach Quelle</h3>
          {quellenStats.filter(q => q.count > 0).map(q => (
            <div key={q.quelle} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{q.quelle}</span>
                <span style={{ color: '#aeb9c8' }}>{q.count} Leads · {q.gewonnen} gewonnen</span>
              </div>
              <PctBar value={(q.count / gesamtLeads) * 100} color={COLOR} />
            </div>
          ))}
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📣 Kampagnen-Performance</h3>
          {initKampagnen.filter(k => k.empfaenger > 0).map(k => {
            const rate = ((k.geoeffnet / k.empfaenger) * 100).toFixed(1)
            return (
              <div key={k.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{k.name}</span>
                  <span style={{ color: '#aeb9c8' }}>{rate}% Öffnungsrate</span>
                </div>
                <PctBar value={parseFloat(rate)} color={COLOR} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────

type Tab = 'kampagnen' | 'leads' | 'newsletter' | 'auswertungen'

export default function MarketingPilotPage() {
  const [tab, setTab] = useState<Tab>('kampagnen')
  const aktiveKampagnen = initKampagnen.filter(k => k.status === 'Aktiv').length
  const neueLeads = initLeads.filter(l => l.status === 'Neu').length
  const gesamtLeads = initLeads.length
  const gesamtEmpfaenger = 1240

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📣</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>MarketingPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kampagnen · Leads · Newsletter · Auswertungen</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Aktive Kampagnen', value: String(aktiveKampagnen), icon: '📣', color: COLOR },
          { label: 'Neue Leads', value: String(neueLeads), icon: '🎯', color: '#f43f5e' },
          { label: 'Leads gesamt', value: String(gesamtLeads), icon: '👥', color: '#1684ff' },
          { label: 'E-Mails versendet', value: gesamtEmpfaenger.toLocaleString('de-DE'), icon: '✉️', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {([
          { id: 'kampagnen', label: '📣 Kampagnen' },
          { id: 'leads', label: '🎯 Leads' },
          { id: 'newsletter', label: '📰 Newsletter' },
          { id: 'auswertungen', label: '📊 Auswertungen' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            color: tab === t.id ? '#fbbf24' : '#aeb9c8', marginBottom: -1, transition: 'color .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'kampagnen' && <KampagnenTab />}
      {tab === 'leads' && <LeadsTab />}
      {tab === 'newsletter' && <NewsletterTab />}
      {tab === 'auswertungen' && <AuswertungenTab />}
    </div>
  )
}
