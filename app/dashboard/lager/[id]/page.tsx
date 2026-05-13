'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { hasDemoCookie } from '@/lib/auth'
import { getLagerArtikel, getLagerBewegungen, getLagerStellplatzBestand } from '@/lib/db'

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
  eingelagert_am?: string; notiz?: string
  lager_stellplaetze?: { code: string; bereich: string }
}

const STATUS_COLOR: Record<string, string> = { ok: '#10b981', niedrig: '#f59e0b', leer: '#f43f5e' }
const STATUS_LABEL: Record<string, string> = { ok: '✅ OK', niedrig: '⚠️ Niedrig', leer: '🚨 Leer' }

export default function LagerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = decodeURIComponent(params.id as string)
  const [artikel, setArtikel] = useState<Artikel | null>(null)
  const [bewegungen, setBewegungen] = useState<Bewegung[]>([])
  const [bestand, setBestand] = useState<StellplatzBestand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const isDemo = hasDemoCookie()
    async function load() {
      try {
        const [alleArtikel, alleBeweg, alleBestand] = await Promise.all([
          getLagerArtikel(),
          isDemo ? Promise.resolve([]) : getLagerBewegungen(),
          isDemo ? Promise.resolve([]) : getLagerStellplatzBestand(),
        ])
        const found = (alleArtikel as Artikel[]).find(a => a.id === id)
        if (!found) { setError('Artikel nicht gefunden.'); return }
        setArtikel(found)
        setBewegungen(
          (alleBeweg as Bewegung[])
            .filter(b => b.artikel === found.name)
            .slice(0, 20)
        )
        setBestand(
          (alleBestand as StellplatzBestand[])
            .filter(b => b.artikelnummer === found.id || b.artikelname === found.name)
        )
      } catch {
        setError('Fehler beim Laden der Daten.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid rgba(22,132,255,.3)', borderTopColor: '#1684ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Artikel…</div>
      </div>
    </div>
  )

  if (error || !artikel) return (
    <div className="pk-card" style={{ textAlign: 'center', padding: 40, color: '#aeb9c8' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
      <div style={{ marginBottom: 16 }}>{error || 'Nicht gefunden.'}</div>
      <button onClick={() => router.back()} style={{ color: '#1684ff', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>← Zurück zum Lager</button>
    </div>
  )

  const statusColor = STATUS_COLOR[artikel.status] ?? '#aeb9c8'
  const fehlmenge = Math.max(0, (artikel.mindestbestand ?? 0) - artikel.bestand)
  const gesamtBestand = bestand.reduce((s, b) => s + b.menge, 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Back */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#1684ff', fontSize: 14, cursor: 'pointer', padding: 0 }}>
          ← Zurück zum Lager
        </button>
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
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Stellplatz-Zuordnung vorhanden.</div>
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
                {b.mhd && (
                  <span style={{ fontSize: 11, color: '#aeb9c8' }}>MHD: {b.mhd}</span>
                )}
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
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Bewegungen für diesen Artikel gefunden.</div>
        ) : (
          <table className="pk-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Datum</th><th>Typ</th><th>Artikel</th><th>Menge</th><th>Mitarbeiter</th><th>Status</th>
              </tr>
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
