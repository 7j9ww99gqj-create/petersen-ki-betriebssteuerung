import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerComponentSession } from '@/lib/server-auth'

type Karte = {
  id: string; auftragsnr: string; beschreibung: string
  mitarbeiter: string; prioritaet: string; status: string
  erstellt: string; geplant: string; stunden: number
  fortschritt: number; maschine: string
}
type Zeitbuchung = { id: number; mitarbeiter: string; auftragsnr: string; stunden: number; datum: string; taetigkeit?: string }
type Material = { id: number; artikel: string; menge: number; einheit?: string; auftragsnr?: string; datum?: string; mitarbeiter?: string }
type Pruefprotokoll = { id: number; auftragsnr: string; pruefpunkt: string; ergebnis?: string; pruefer?: string; datum?: string }

const PRIO_COLOR: Record<string, string> = {
  Kritisch: '#f43f5e', Hoch: '#f59e0b', Mittel: '#1684ff', Niedrig: '#aeb9c8',
}
const STATUS_COLOR: Record<string, string> = {
  Offen: '#aeb9c8', 'In Arbeit': '#1684ff', Warten: '#f59e0b', Fertig: '#10b981', Storniert: '#4a5568',
}

export default async function WerkstattDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)
  const { isDemo, user, supabase } = await getServerComponentSession()

  if (!isDemo && !user) redirect('/login')

  if (isDemo) {
    return (
      <div className="pk-card" style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛠️</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#f8fbff' }}>Demo-Modus</div>
        <div style={{ marginBottom: 20 }}>Detailansichten erfordern einen Live-Account.</div>
        <Link href="/dashboard/werkstatt" style={{ color: '#a78bfa', fontSize: 14, textDecoration: 'none' }}>← Zurück zur Werkstatt</Link>
      </div>
    )
  }

  const [karteRes, zeitRes, matRes, pruefRes] = await Promise.all([
    supabase!.from('werkstatt_karten').select('*').eq('id', id).maybeSingle(),
    supabase!.from('werkstatt_zeitbuchungen').select('*').order('datum', { ascending: false }),
    supabase!.from('werkstatt_material').select('*').order('datum', { ascending: false }),
    supabase!.from('werkstatt_pruefprotokolle').select('*').order('datum', { ascending: false }),
  ])

  const karte = karteRes.data as Karte | null

  if (!karte) {
    return (
      <div className="pk-card" style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#f8fbff' }}>Arbeitskarte nicht gefunden</div>
        <div style={{ marginBottom: 20, fontSize: 14 }}>Die Karte &bdquo;{id}&ldquo; wurde nicht gefunden oder du hast keinen Zugriff.</div>
        <Link href="/dashboard/werkstatt" style={{ color: '#a78bfa', fontSize: 14, textDecoration: 'none' }}>← Zurück zur Werkstatt</Link>
      </div>
    )
  }

  const zeiten = ((zeitRes.data ?? []) as Zeitbuchung[]).filter(z => z.auftragsnr === karte.auftragsnr)
  const material = ((matRes.data ?? []) as Material[]).filter(m => m.auftragsnr === karte.auftragsnr)
  const pruef = ((pruefRes.data ?? []) as Pruefprotokoll[]).filter(p => p.auftragsnr === karte.auftragsnr)

  const gesamtStunden = zeiten.reduce((s, z) => s + z.stunden, 0)
  const prioColor = PRIO_COLOR[karte.prioritaet] ?? '#aeb9c8'
  const statusColor = STATUS_COLOR[karte.status] ?? '#aeb9c8'
  const ergebnisColor = (e?: string) => e === 'OK' ? '#10b981' : e === 'Fehler' ? '#f43f5e' : '#aeb9c8'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/werkstatt" style={{ color: '#a78bfa', fontSize: 14, textDecoration: 'none' }}>
          ← Zurück zur Werkstatt
        </Link>
      </div>

      {/* Header */}
      <div className="pk-card" style={{ marginBottom: 18, border: `1px solid ${prioColor}25` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${prioColor}18`, border: `1px solid ${prioColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
            🛠️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{karte.id}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed' }}>{karte.auftragsnr}</span>
              <span className="badge" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>{karte.status}</span>
              <span className="badge" style={{ background: `${prioColor}18`, color: prioColor, border: `1px solid ${prioColor}30` }}>{karte.prioritaet}</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{karte.beschreibung}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#aeb9c8' }}>
              <span>👷 {karte.mitarbeiter}</span>
              {karte.maschine && karte.maschine !== '—' && <span>⚙️ {karte.maschine}</span>}
              <span>📅 Erstellt: {karte.erstellt}</span>
              <span>📅 Geplant bis: {karte.geplant}</span>
              <span>⏱️ {karte.stunden}h geplant</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aeb9c8', marginBottom: 6 }}>
            <span>Fortschritt</span>
            <span style={{ color: prioColor, fontWeight: 800 }}>{karte.fortschritt}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
            <div style={{ width: `${karte.fortschritt}%`, height: '100%', borderRadius: 999, background: prioColor, transition: 'width .3s' }} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Gebuchte Stunden', value: `${gesamtStunden.toFixed(1)}h`, icon: '⏱️', color: '#1684ff' },
          { label: 'Zeitbuchungen', value: String(zeiten.length), icon: '📝', color: '#a78bfa' },
          { label: 'Materialien', value: String(material.length), icon: '📦', color: '#f59e0b' },
          { label: 'Prüfpunkte', value: String(pruef.length), icon: '✅', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Zeitbuchungen */}
      <div className="pk-card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>⏱️ Zeitbuchungen</div>
        {zeiten.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aeb9c8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏱️</div>
            <div style={{ fontSize: 13 }}>Keine Zeitbuchungen für diesen Auftrag.</div>
          </div>
        ) : (
          <table className="pk-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Datum</th><th>Mitarbeiter</th><th>Stunden</th><th>Tätigkeit</th></tr>
            </thead>
            <tbody>
              {zeiten.map(z => (
                <tr key={z.id}>
                  <td style={{ color: '#aeb9c8', fontSize: 12 }}>{z.datum}</td>
                  <td>{z.mitarbeiter}</td>
                  <td style={{ fontWeight: 700, color: '#1684ff' }}>{z.stunden}h</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{z.taetigkeit || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Material */}
      <div className="pk-card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📦 Materialverbrauch</div>
        {material.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aeb9c8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 13 }}>Kein Materialverbrauch für diesen Auftrag erfasst.</div>
          </div>
        ) : (
          <table className="pk-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Datum</th><th>Artikel</th><th>Menge</th><th>Einheit</th><th>Mitarbeiter</th></tr>
            </thead>
            <tbody>
              {material.map(m => (
                <tr key={m.id}>
                  <td style={{ color: '#aeb9c8', fontSize: 12 }}>{m.datum || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{m.artikel}</td>
                  <td style={{ fontWeight: 700, color: '#f59e0b' }}>{m.menge}</td>
                  <td style={{ color: '#aeb9c8' }}>{m.einheit || '—'}</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{m.mitarbeiter || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Prüfprotokoll */}
      <div className="pk-card">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>✅ Prüfprotokoll</div>
        {pruef.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aeb9c8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 13 }}>Keine Prüfpunkte für diesen Auftrag hinterlegt.</div>
          </div>
        ) : (
          <table className="pk-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Datum</th><th>Prüfpunkt</th><th>Ergebnis</th><th>Prüfer</th></tr>
            </thead>
            <tbody>
              {pruef.map(p => (
                <tr key={p.id}>
                  <td style={{ color: '#aeb9c8', fontSize: 12 }}>{p.datum || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{p.pruefpunkt}</td>
                  <td>
                    <span className="badge" style={{ background: `${ergebnisColor(p.ergebnis)}18`, color: ergebnisColor(p.ergebnis), border: `1px solid ${ergebnisColor(p.ergebnis)}30` }}>
                      {p.ergebnis || 'Offen'}
                    </span>
                  </td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{p.pruefer || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
