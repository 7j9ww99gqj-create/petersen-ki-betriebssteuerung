import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerComponentSession } from '@/lib/server-auth'

type Artikel = {
  id: string; name: string; kategorie: string; bestand: number; einheit: string
  lagerplatz: string; status: string; mindestbestand?: number
}
type Bewegung = {
  id: number | string; typ: string; artikel: string; menge: number
  mitarbeiter?: string; status?: string; datum?: string; created_at?: string
}
type StellplatzBestand = {
  id: string; stellplatz_id: string; artikelnummer?: string; artikelname?: string
  charge?: string; mhd?: string; menge: number; einheit?: string; status?: string
  eingelagert_am?: string
  lager_stellplaetze?: { code: string; bereich: string }
}

const STATUS_COLOR: Record<string, string> = { ok: '#10b981', niedrig: '#f59e0b', leer: '#f43f5e' }
const STATUS_LABEL: Record<string, string> = { ok: '✅ OK', niedrig: '⚠️ Niedrig', leer: '🚨 Leer' }

export default async function LagerDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)
  const { isDemo, user, supabase } = await getServerComponentSession()

  if (!isDemo && !user) redirect('/login')

  if (isDemo) {
    return (
      <div className="pk-card" style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#f8fbff' }}>Demo-Modus</div>
        <div style={{ marginBottom: 20 }}>Detailansichten erfordern einen Live-Account.</div>
        <Link href="/dashboard/lager" style={{ color: '#1684ff', fontSize: 14, textDecoration: 'none' }}>← Zurück zum Lager</Link>
      </div>
    )
  }

  const [artikelRes, bewegRes, bestandRes] = await Promise.all([
    supabase!.from('lager_artikel').select('*').eq('id', id).maybeSingle(),
    supabase!.from('lager_bewegungen').select('*').order('created_at', { ascending: false }).limit(20),
    supabase!.from('lager_stellplatz_bestand').select('*, lager_stellplaetze(code, bereich)'),
  ])

  const artikel = artikelRes.data as Artikel | null

  if (!artikel) {
    return (
      <div className="pk-card" style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#f8fbff' }}>Artikel nicht gefunden</div>
        <div style={{ marginBottom: 20, fontSize: 14 }}>Der Artikel &bdquo;{id}&ldquo; wurde nicht gefunden oder du hast keinen Zugriff.</div>
        <Link href="/dashboard/lager" style={{ color: '#1684ff', fontSize: 14, textDecoration: 'none' }}>← Zurück zum Lager</Link>
      </div>
    )
  }

  const bewegungen = ((bewegRes.data ?? []) as Bewegung[]).filter(b => b.artikel === artikel.name)
  const bestand = ((bestandRes.data ?? []) as StellplatzBestand[]).filter(
    b => b.artikelnummer === artikel.id || b.artikelname === artikel.name
  )

  const statusColor = STATUS_COLOR[artikel.status] ?? '#aeb9c8'
  const fehlmenge = Math.max(0, (artikel.mindestbestand ?? 0) - artikel.bestand)
  const gesamtBestand = bestand.reduce((s, b) => s + b.menge, 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/lager" style={{ color: '#1684ff', fontSize: 14, textDecoration: 'none' }}>
          ← Zurück zum Lager
        </Link>
      </div>

      {/* Header */}
      <div className="pk-card" style={{ marginBottom: 18, border: `1px solid ${statusColor}25` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `${statusColor}18`, border: `1px solid ${statusColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
            📦
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aeb9c8' }}>{artikel.id}</span>
              <span className="badge badge-gray">{artikel.kategorie}</span>
              <span className="badge" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                {STATUS_LABEL[artikel.status] ?? artikel.status}
              </span>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{artikel.name}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#aeb9c8' }}>
              <span>📍 Lagerplatz: {artikel.lagerplatz || '—'}</span>
              <span>📦 Bestand: <b style={{ color: statusColor }}>{artikel.bestand} {artikel.einheit}</b></span>
              <span>⚠️ Mindestbestand: {artikel.mindestbestand ?? 0} {artikel.einheit}</span>
              {fehlmenge > 0 && <span style={{ color: '#f43f5e' }}>🚨 Fehlmenge: {fehlmenge} {artikel.einheit}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Gesamtbestand', value: `${artikel.bestand} ${artikel.einheit}`, icon: '📦', color: statusColor },
          { label: 'Stellplätze', value: String(bestand.length), icon: '📍', color: '#1684ff' },
          { label: 'Stellplatz-Summe', value: `${gesamtBestand} ${artikel.einheit}`, icon: '🔢', color: '#a78bfa' },
          { label: 'Letzte Bewegungen', value: String(bewegungen.length), icon: '🔄', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stellplatz-Bestand */}
      <div className="pk-card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📍 Stellplatz-Belegung</div>
        {bestand.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aeb9c8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
            <div style={{ fontSize: 13 }}>Keine Stellplatz-Zuordnung vorhanden. Artikel im Lager einlagern, um Stellplätze zu belegen.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {bestand.map(b => (
              <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{b.lager_stellplaetze?.code ?? b.stellplatz_id}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>
                    {b.lager_stellplaetze?.bereich && <span>{b.lager_stellplaetze.bereich} · </span>}
                    {b.charge && <span>Charge: {b.charge} · </span>}
                    {b.eingelagert_am && <span>seit {b.eingelagert_am}</span>}
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: '#1684ff', fontSize: 14 }}>{b.menge} {b.einheit || artikel.einheit}</span>
                {b.mhd && <span style={{ fontSize: 11, color: '#aeb9c8' }}>MHD: {b.mhd}</span>}
                <span className={`badge ${b.status === 'Gesperrt' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10 }}>
                  {b.status || 'Verfügbar'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Letzte Bewegungen */}
      <div className="pk-card">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🔄 Letzte Lagerbewegungen</div>
        {bewegungen.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aeb9c8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔄</div>
            <div style={{ fontSize: 13 }}>Keine Lagerbewegungen für diesen Artikel gefunden.</div>
          </div>
        ) : (
          <table className="pk-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Datum</th><th>Typ</th><th>Artikel</th><th>Menge</th><th>Mitarbeiter</th><th>Status</th></tr>
            </thead>
            <tbody>
              {bewegungen.map(b => (
                <tr key={b.id}>
                  <td style={{ color: '#aeb9c8', fontSize: 12 }}>{b.datum || (b.created_at ? b.created_at.slice(0, 10) : '—')}</td>
                  <td>
                    <span className={`badge ${b.typ === 'eingang' || b.typ === 'Eingang' ? 'badge-green' : b.typ === 'ausgang' || b.typ === 'Ausgang' ? 'badge-orange' : 'badge-blue'}`}>
                      {b.typ}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{b.artikel}</td>
                  <td style={{ fontWeight: 700 }}>{b.menge}</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.mitarbeiter || '—'}</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{b.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
