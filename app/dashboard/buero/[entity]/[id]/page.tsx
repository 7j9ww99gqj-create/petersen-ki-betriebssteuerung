'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  getBueroAngebotById,
  getBueroAuftragById,
  getBueroDokumentById,
  getBueroEingangsrechnungById,
  getBueroKundeById,
  getBueroRechnungById,
  getDokumentUrl,
  getEinkaufBestellungById,
  getEinkaufLieferantById,
} from '@/lib/db'
import { normalizeDocumentStoragePath } from '@/lib/documents'

type DetailData = Record<string, unknown> & {
  id: string
  name?: string
  kunde?: string
  titel?: string
  beschreibung?: string
  rechnungsnummer?: string
  lieferant?: string
  storage_path?: string
  dokument_url?: string
}

const ENTITY_LABELS: Record<string, string> = {
  kunden: 'Kunde',
  angebote: 'Angebot',
  auftraege: 'Auftrag',
  rechnungen: 'Rechnung',
  eingangsrechnungen: 'Eingangsrechnung',
  dokumente: 'Dokument',
  lieferanten: 'Lieferant',
  bestellungen: 'Bestellung',
}

const LOADERS: Record<string, (id: string) => Promise<DetailData | null>> = {
  kunden: async id => (await getBueroKundeById(id)) as DetailData | null,
  angebote: async id => (await getBueroAngebotById(id)) as DetailData | null,
  auftraege: async id => (await getBueroAuftragById(id)) as DetailData | null,
  rechnungen: async id => (await getBueroRechnungById(id)) as DetailData | null,
  eingangsrechnungen: async id => (await getBueroEingangsrechnungById(id)) as DetailData | null,
  dokumente: async id => (await getBueroDokumentById(id)) as DetailData | null,
  lieferanten: async id => (await getEinkaufLieferantById(id)) as DetailData | null,
  bestellungen: async id => (await getEinkaufBestellungById(id)) as DetailData | null,
}

function DetailFields({ data }: { data: DetailData }) {
  const rows = Object.entries(data).filter(([key, value]) => {
    if (value == null || value === '') return false
    return !['search_text', 'summary', 'extracted', 'suggested_actions'].includes(key)
  })

  return (
    <div className="pk-card">
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map(([key, value]) => (
          <div key={key} style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>
              {key.replace(/_/g, ' ')}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BueroDetailPage() {
  const params = useParams<{ entity: string; id: string }>()
  const entity = params?.entity ?? ''
  const id = decodeURIComponent(params?.id ?? '')
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')

  const entityLabel = ENTITY_LABELS[entity] ?? 'Objekt'
  const title = useMemo(() => {
    if (!data) return entityLabel
    return data.name || data.titel || data.kunde || data.beschreibung || data.rechnungsnummer || data.lieferant || data.id
  }, [data, entityLabel])

  useEffect(() => {
    const load = async () => {
      const loader = LOADERS[entity]
      if (!loader) {
        setError('Dieser Detailtyp wird noch nicht unterstützt.')
        setLoading(false)
        return
      }
      try {
        const next = await loader(id)
        if (!next) {
          setError(`${entityLabel} nicht gefunden.`)
          return
        }
        setData(next)
        const path = normalizeDocumentStoragePath(next.storage_path || next.dokument_url)
        if (path) {
          const url = await getDokumentUrl(path)
          setDocumentUrl(url)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Fehler beim Laden von ${entityLabel}.`)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [entity, entityLabel, id])

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href="/dashboard/buero" className="pk-btn-ghost" style={{ textDecoration: 'none' }}>
          ← Zurück zu BüroPilot
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>{title}</h1>
          <div style={{ color: '#aeb9c8', fontSize: 14 }}>{entityLabel} · {id}</div>
        </div>
        {documentUrl && (
          <a className="pk-btn" href={documentUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            Dokument öffnen
          </a>
        )}
      </div>

      {loading && (
        <div className="pk-card" style={{ color: '#aeb9c8' }}>
          Lade Detailansicht…
        </div>
      )}

      {!loading && error && (
        <div className="pk-card" style={{ color: '#ff8080', border: '1px solid rgba(255,80,80,.25)' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && <DetailFields data={data} />}
    </div>
  )
}
