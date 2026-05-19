'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { getBueroDokumente, getDokumentUrl, getSteuerBelege } from '@/lib/db'
import { normalizeDocumentStoragePath } from '@/lib/documents'
import EmptyState from '@/components/EmptyState'

type ArchivDokument = {
  id: string
  name: string
  typ?: string
  datum?: string
  groesse?: string
  kategorie?: string
  bezug?: string
  storage_path?: string
  eingangsrechnung_id?: string
  rechnung_id?: string
  angebot_id?: string
  auftrag_id?: string
  dokument_url?: string
  quelle?: 'buero' | 'steuer'
  datei_url?: string
  status?: string
  document_type?: string
  confidence?: number
  summary?: string
}

const demoArchivData: ArchivDokument[] = [
  { id: 'DOC-001', name: 'Lieferschein LS-2025-08847', typ: 'Lieferschein', datum: '06.05.2025', groesse: '124 KB', kategorie: 'Wareneingang', bezug: 'Metallbau GmbH' },
  { id: 'DOC-002', name: 'Rechnung RE-2025-1123', typ: 'Rechnung', datum: '05.05.2025', groesse: '89 KB', kategorie: 'Rechnung', bezug: 'Kunde' },
  { id: 'STB-001', name: 'Steuerbeleg April', typ: 'Steuerbeleg', datum: '03.05.2025', groesse: '—', kategorie: 'Steuer', bezug: 'Büromaterial GmbH', quelle: 'steuer' },
]

function getRelationLabel(doc: ArchivDokument) {
  if (doc.eingangsrechnung_id) return { label: `Eingangsrechnung ${doc.eingangsrechnung_id}`, href: `/dashboard/buero/eingangsrechnungen/${encodeURIComponent(doc.eingangsrechnung_id)}` }
  if (doc.rechnung_id) return { label: `Rechnung ${doc.rechnung_id}`, href: `/dashboard/buero/rechnungen/${encodeURIComponent(doc.rechnung_id)}` }
  if (doc.angebot_id) return { label: `Angebot ${doc.angebot_id}`, href: `/dashboard/buero/angebote/${encodeURIComponent(doc.angebot_id)}` }
  if (doc.auftrag_id) return { label: `Auftrag ${doc.auftrag_id}`, href: `/dashboard/buero/auftraege/${encodeURIComponent(doc.auftrag_id)}` }
  return null
}

export default function ArchivPage() {
  const [docs, setDocs] = useState<ArchivDokument[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Alle')
  const [relationFilter, setRelationFilter] = useState<'alle' | 'verknuepft' | 'ohne'>('alle')
  const [kiFilter, setKiFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState('')
  const isDemo = hasDemoCookie()

  useEffect(() => {
    if (isDemo) {
      setDocs(demoArchivData)
      setLoading(false)
      return
    }
    Promise.all([getBueroDokumente(), getSteuerBelege()])
      .then(([bueroDocs, steuerBelege]) => {
        const mappedSteuer = (steuerBelege ?? []).map(row => {
          const entry = row as {
            id: string
            lieferant?: string
            datum?: string
            datei_url?: string
            status?: string
            notiz?: string
            belegnummer?: string
          }
          return {
            id: entry.id,
            name: entry.notiz?.trim() || entry.belegnummer?.trim() || `Steuerbeleg ${entry.id}`,
            typ: 'Steuerbeleg',
            datum: entry.datum,
            groesse: '—',
            kategorie: 'Steuer',
            bezug: entry.lieferant || 'SteuerPilot',
            dokument_url: entry.datei_url,
            datei_url: entry.datei_url,
            status: entry.status,
            quelle: 'steuer' as const,
          } satisfies ArchivDokument
        })

        const mappedBuero = ((bueroDocs ?? []) as ArchivDokument[]).map(doc => ({
          ...doc,
          quelle: 'buero' as const,
          document_type: (doc as { document_type?: string }).document_type,
          confidence: (doc as { confidence?: number }).confidence,
          summary: (doc as { summary?: string }).summary,
        }))
        setDocs([...mappedBuero, ...mappedSteuer].sort((a, b) => String(b.datum ?? '').localeCompare(String(a.datum ?? ''))))
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Archiv konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const typen = useMemo(
    () => ['Alle', ...Array.from(new Set(docs.map(doc => doc.kategorie || doc.typ || 'Sonstiges')))],
    [docs],
  )

  const filtered = docs.filter(doc => {
    const q = search.toLowerCase()
    const relation = getRelationLabel(doc)
    const matchSearch = !q || [doc.name, doc.bezug, doc.id, doc.kategorie, doc.typ, relation?.label, doc.quelle, doc.status, doc.document_type, doc.summary].some(value => (value ?? '').toLowerCase().includes(q))
    const typeValue = doc.kategorie || doc.typ || 'Sonstiges'
    const matchFilter = filter === 'Alle' || typeValue === filter
    const hasRelation = Boolean(relation)
    const matchRelation = relationFilter === 'alle'
      || (relationFilter === 'verknuepft' && hasRelation)
      || (relationFilter === 'ohne' && !hasRelation)
    const matchKi = !kiFilter || Boolean(doc.document_type)
    return matchSearch && matchFilter && matchRelation && matchKi
  })

  const stats = useMemo(() => {
    const linked = docs.filter(doc => getRelationLabel(doc)).length
    const incoming = docs.filter(doc => doc.eingangsrechnung_id).length
    const outgoing = docs.filter(doc => doc.rechnung_id || doc.angebot_id || doc.auftrag_id).length
    const steuer = docs.filter(doc => doc.quelle === 'steuer').length
    const kiErkannt = docs.filter(doc => doc.document_type).length
    return {
      total: docs.length,
      linked,
      unlinked: docs.length - linked,
      incoming,
      outgoing,
      steuer,
      kiErkannt,
    }
  }, [docs])

  const openDocument = async (doc: ArchivDokument) => {
    if (isDemo) return
    const path = normalizeDocumentStoragePath(doc.storage_path || doc.dokument_url || doc.datei_url)
    if (!path) {
      setError(`Für ${doc.name} ist kein gültiger Speicherpfad vorhanden.`)
      return
    }
    setOpeningId(doc.id)
    setError('')
    try {
      const url = await getDokumentUrl(path)
      if (!url) throw new Error('Signierte Dokument-URL konnte nicht erzeugt werden.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dokument konnte nicht geöffnet werden.')
    } finally {
      setOpeningId('')
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🗂️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Archiv</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>
            {isDemo ? 'Demo-Archiv' : 'Globale Dokumentübersicht aus dem Live-System'}
          </p>
        </div>
        <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{docs.length} Dokumente</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="pk-input"
          placeholder="🔍 Dokument suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {typen.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: filter === type ? 'rgba(22,132,255,.2)' : 'rgba(255,255,255,.06)',
                color: filter === type ? '#6cb6ff' : '#aeb9c8',
                border: filter === type ? '1px solid rgba(22,132,255,.4)' : '1px solid rgba(255,255,255,.08)',
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <select
          className="pk-input"
          value={relationFilter}
          onChange={e => setRelationFilter(e.target.value as 'alle' | 'verknuepft' | 'ohne')}
          style={{ maxWidth: 220 }}
        >
          <option value="alle">Alle Verknüpfungen</option>
          <option value="verknuepft">Nur verknüpfte Dokumente</option>
          <option value="ohne">Ohne Objektverknüpfung</option>
        </select>
        <button
          onClick={() => setKiFilter(prev => !prev)}
          style={{
            padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: kiFilter ? 'rgba(167,139,250,.2)' : 'rgba(255,255,255,.06)',
            color: kiFilter ? '#a78bfa' : '#aeb9c8',
            border: kiFilter ? '1px solid rgba(167,139,250,.4)' : '1px solid rgba(255,255,255,.08)',
          }}
        >
          🧠 KI-erkannt {kiFilter ? `(${stats.kiErkannt})` : ''}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Dokumente', value: stats.total, color: '#6cb6ff' },
          { label: 'Verknüpft', value: stats.linked, color: '#4ddb7e' },
          { label: 'Ohne Bezug', value: stats.unlinked, color: '#f59e0b' },
          { label: 'Eingangsbelege', value: stats.incoming, color: '#ffb347' },
          { label: 'Steuerbelege', value: stats.steuer, color: '#f59e0b' },
          { label: 'KI-erkannt', value: stats.kiErkannt, color: '#a78bfa' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#aeb9c8' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="pk-card" style={{ marginBottom: 16, color: '#ff8080', border: '1px solid rgba(255,80,80,.25)' }}>
          {error}
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Dokument</th>
              <th>Typ</th>
              <th>Bezug</th>
              <th>Quelle</th>
              <th>KI</th>
              <th>Datum</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.map(doc => {
              const relation = getRelationLabel(doc)
              return (
                <tr key={doc.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'monospace' }}>{doc.id}</div>
                  </td>
                  <td><span className="badge badge-gray">{doc.kategorie || doc.typ || 'Sonstiges'}</span></td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{doc.bezug || '—'}</td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{doc.quelle === 'steuer' ? 'SteuerPilot' : 'BüroPilot'}</td>
                  <td style={{ fontSize: 12 }}>
                    {doc.document_type
                      ? (
                        <span title={doc.summary || ''} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                          <span className="badge badge-purple" style={{ fontSize: 10 }}>🧠 {doc.document_type}</span>
                          {doc.confidence !== undefined && (
                            <span style={{ color: '#aeb9c8', fontSize: 10 }}>{Math.round(doc.confidence * 100)}%</span>
                          )}
                        </span>
                      )
                      : <span style={{ color: '#4a5568', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ color: '#aeb9c8', fontSize: 13 }}>{doc.datum || '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {doc.quelle === 'steuer' ? (
                        <Link href="/dashboard/steuer?tab=belege" style={{ color: '#6cb6ff', textDecoration: 'none' }}>
                          Steuerbelege öffnen
                        </Link>
                      ) : (
                        <Link href={`/dashboard/buero/dokumente/${encodeURIComponent(doc.id)}`} style={{ color: '#6cb6ff', textDecoration: 'none' }}>
                          Dokumentdetails
                        </Link>
                      )}
                      {relation && (
                        <Link href={relation.href} style={{ color: '#aeb9c8', textDecoration: 'none' }}>
                          {relation.label}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => void openDocument(doc)}
                      disabled={isDemo || openingId === doc.id || !(doc.storage_path || doc.dokument_url || doc.datei_url)}
                      style={{ padding: '5px 12px', fontSize: 12, opacity: isDemo || !(doc.storage_path || doc.dokument_url || doc.datei_url) ? 0.55 : 1 }}
                    >
                      {openingId === doc.id ? 'Lädt…' : 'Öffnen'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#aeb9c8' }}>
            Archiv wird geladen…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon="🗂️"
            title="Keine Dokumente gefunden"
            description={docs.length === 0 ? 'Lade Dokumente im BüroPilot oder SteuerPilot hoch, um sie hier zu sehen.' : 'Kein Treffer für deine Filterauswahl. Suche anpassen oder Filter zurücksetzen.'}
          />
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>
        {filtered.length} von {docs.length} Dokumenten angezeigt
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { icon: '🧾', label: 'BüroPilot', color: '#20c8ff', note: 'Dokumente, Rechnungen, Angebote' },
          { icon: '💰', label: 'SteuerPilot', color: '#f59e0b', note: 'Steuerbelege' },
          { icon: '🧠', label: 'KI-Erkennung', color: '#a78bfa', note: 'Dokumente mit KI-Analyse (Typ + Konfidenz)' },
          { icon: '🛠️', label: 'WerkstattPilot', color: '#6b7280', note: 'Kein eigenes Dokumentarchiv vorhanden' },
          { icon: '📦', label: 'LagerPilot', color: '#6b7280', note: 'Kein eigenes Dokumentarchiv vorhanden' },
        ].map(item => (
          <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
