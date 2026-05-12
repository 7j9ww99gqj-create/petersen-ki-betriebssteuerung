'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import {
  getBueroAngebotById,
  getBueroAuftragById,
  getBueroDokumentById,
  getBueroEingangsrechnungById,
  getBueroEingangsrechnungDetailContext,
  getBueroKundeById,
  getBueroKundeDetailContext,
  getBueroRechnungById,
  getDokumentUrl,
  getEinkaufBestellungById,
  getEinkaufLieferantById,
  getEinkaufLieferantDetailContext,
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

type DetailContext = Record<string, unknown> | null

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

const CONTEXT_LOADERS: Record<string, (id: string) => Promise<DetailContext>> = {
  kunden: async id => await getBueroKundeDetailContext(id),
  eingangsrechnungen: async id => await getBueroEingangsrechnungDetailContext(id),
  lieferanten: async id => await getEinkaufLieferantDetailContext(id),
}

function formatValue(value: unknown) {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    return value.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })
  }
  return String(value)
}

function getDataTitle(data: DetailData | null, entityLabel: string) {
  if (!data) return entityLabel
  return data.name || data.titel || data.kunde || data.beschreibung || data.rechnungsnummer || data.lieferant || data.id
}

function MetricCard({ label, value, tone = '#6cb6ff' }: { label: string; value: unknown; tone?: string }) {
  return (
    <div className="pk-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: tone }}>{formatValue(value)}</div>
      <div style={{ fontSize: 12, color: '#aeb9c8' }}>{label}</div>
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="pk-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function PropertyGrid({ data, fields }: { data: Record<string, unknown>; fields: Array<{ key: string; label: string }> }) {
  const visible = fields.filter(field => {
    const value = data[field.key]
    return value != null && value !== ''
  })

  if (visible.length === 0) {
    return <div style={{ color: '#aeb9c8', fontSize: 14 }}>Keine Zusatzdaten vorhanden.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {visible.map(field => (
        <div key={field.key} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.06em' }}>{field.label}</div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{formatValue(data[field.key])}</div>
        </div>
      ))}
    </div>
  )
}

function CompactList({
  empty,
  items,
  renderItem,
}: {
  empty: string
  items: Array<Record<string, unknown>>
  renderItem: (item: Record<string, unknown>) => React.ReactNode
}) {
  if (items.length === 0) {
    return <div style={{ color: '#aeb9c8', fontSize: 14 }}>{empty}</div>
  }

  return <div style={{ display: 'grid', gap: 10 }}>{items.map(renderItem)}</div>
}

function EntityLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{ color: '#6cb6ff', textDecoration: 'none', fontWeight: 700 }}>
      {label}
    </Link>
  )
}

function GenericDetailFields({ data }: { data: DetailData }) {
  const rows = Object.entries(data).filter(([key, value]) => {
    if (value == null || value === '') return false
    return !['search_text', 'summary', 'extracted', 'suggested_actions'].includes(key)
  })

  return (
    <SectionCard title="Details">
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
    </SectionCard>
  )
}

function KundenDetailView({ context }: { context: Record<string, unknown> }) {
  const kunde = (context.kunde ?? {}) as Record<string, unknown>
  const angebote = ((context.angebote ?? []) as Array<Record<string, unknown>>)
  const auftraege = ((context.auftraege ?? []) as Array<Record<string, unknown>>)
  const rechnungen = ((context.rechnungen ?? []) as Array<Record<string, unknown>>)
  const dokumente = ((context.dokumente ?? []) as Array<Record<string, unknown>>)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Angebote" value={angebote.length} />
        <MetricCard label="Aufträge" value={auftraege.length} tone="#4ddb7e" />
        <MetricCard label="Rechnungen" value={rechnungen.length} tone="#ffb347" />
        <MetricCard label="Dokumente" value={dokumente.length} tone="#f59e0b" />
      </div>

      <SectionCard title="Stammdaten">
        <PropertyGrid
          data={kunde}
          fields={[
            { key: 'typ', label: 'Typ' },
            { key: 'ansprechpartner', label: 'Ansprechpartner' },
            { key: 'email', label: 'E-Mail' },
            { key: 'telefon', label: 'Telefon' },
            { key: 'ort', label: 'Ort' },
            { key: 'status', label: 'Status' },
            { key: 'umsatz', label: 'Umsatz' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Verknüpfte Vorgänge">
        <CompactList
          empty="Noch keine verknüpften Vorgänge vorhanden."
          items={[...angebote, ...auftraege, ...rechnungen]}
          renderItem={item => {
            const itemId = String(item.id ?? '')
            const href = item.titel != null
              ? `/dashboard/buero/angebote/${encodeURIComponent(itemId)}`
              : item.wert != null || item.beschreibung != null
                ? `/dashboard/buero/auftraege/${encodeURIComponent(itemId)}`
                : `/dashboard/buero/rechnungen/${encodeURIComponent(itemId)}`
            const title = item.titel || item.beschreibung || item.id
            const side = item.betrag || item.wert || item.status || '—'
            return (
              <div key={itemId} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <EntityLink href={href} label={String(title)} />
                  <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.status || item.datum || item.erstellt || item.start)}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{formatValue(side)}</div>
              </div>
            )
          }}
        />
      </SectionCard>

      <SectionCard title="Dokumente">
        <CompactList
          empty="Keine Dokumente verknüpft."
          items={dokumente}
          renderItem={item => (
            <div key={String(item.id)} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <EntityLink href={`/dashboard/buero/dokumente/${encodeURIComponent(String(item.id))}`} label={String(item.name || item.id)} />
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.typ || item.kategorie || item.status)}</div>
              </div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>{formatValue(item.datum)}</div>
            </div>
          )}
        />
      </SectionCard>
    </div>
  )
}

function LieferantenDetailView({ context }: { context: Record<string, unknown> }) {
  const lieferant = (context.lieferant ?? {}) as Record<string, unknown>
  const bestellungen = ((context.bestellungen ?? []) as Array<Record<string, unknown>>)
  const eingangsrechnungen = ((context.eingangsrechnungen ?? []) as Array<Record<string, unknown>>)
  const dokumente = ((context.dokumente ?? []) as Array<Record<string, unknown>>)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Bestellungen" value={bestellungen.length} />
        <MetricCard label="Eingangsrechnungen" value={eingangsrechnungen.length} tone="#ffb347" />
        <MetricCard label="Dokumente" value={dokumente.length} tone="#f59e0b" />
        <MetricCard label="Bewertung" value={lieferant.bewertung ?? '—'} tone="#4ddb7e" />
      </div>

      <SectionCard title="Lieferantenprofil">
        <PropertyGrid
          data={lieferant}
          fields={[
            { key: 'kontakt', label: 'Kontakt' },
            { key: 'email', label: 'E-Mail' },
            { key: 'telefon', label: 'Telefon' },
            { key: 'ort', label: 'Ort' },
            { key: 'kategorie', label: 'Kategorie' },
            { key: 'zahlungsziel', label: 'Zahlungsziel' },
            { key: 'status', label: 'Status' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Bestellungen">
        <CompactList
          empty="Keine Bestellungen vorhanden."
          items={bestellungen}
          renderItem={item => (
            <div key={String(item.id)} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <EntityLink href={`/dashboard/buero/bestellungen/${encodeURIComponent(String(item.id))}`} label={String(item.artikel || item.id)} />
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.status)} · {formatValue(item.bestellt_am || item.erwartet_am)}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatValue(item.gesamt || item.einkaufspreis)}</div>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Eingangsrechnungen">
        <CompactList
          empty="Keine Eingangsrechnungen vorhanden."
          items={eingangsrechnungen}
          renderItem={item => (
            <div key={String(item.id)} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <EntityLink href={`/dashboard/buero/eingangsrechnungen/${encodeURIComponent(String(item.id))}`} label={String(item.rechnungsnummer || item.id)} />
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.status)} · fällig {formatValue(item.faelligkeit)}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatValue(item.betrag_brutto ?? item.betrag_netto)}</div>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Dokumente">
        <CompactList
          empty="Keine Dokumente verknüpft."
          items={dokumente}
          renderItem={item => (
            <div key={String(item.id)} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <EntityLink href={`/dashboard/buero/dokumente/${encodeURIComponent(String(item.id))}`} label={String(item.name || item.id)} />
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.typ || item.kategorie || item.status)}</div>
              </div>
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>{formatValue(item.datum)}</div>
            </div>
          )}
        />
      </SectionCard>
    </div>
  )
}

function EingangsrechnungDetailView({ context, documentUrl }: { context: Record<string, unknown>; documentUrl: string }) {
  const eingangsrechnung = (context.eingangsrechnung ?? {}) as Record<string, unknown>
  const lieferant = (context.lieferant ?? {}) as Record<string, unknown>
  const dokumente = ((context.dokumente ?? []) as Array<Record<string, unknown>>)
  const steuerbelege = ((context.steuerbelege ?? []) as Array<Record<string, unknown>>)
  const bestellungen = ((context.bestellungen ?? []) as Array<Record<string, unknown>>)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Status" value={eingangsrechnung.status ?? '—'} />
        <MetricCard label="Brutto" value={eingangsrechnung.betrag_brutto ?? '—'} tone="#ffb347" />
        <MetricCard label="Dokumente" value={dokumente.length} tone="#f59e0b" />
        <MetricCard label="Steuerbelege" value={steuerbelege.length} tone="#4ddb7e" />
      </div>

      <SectionCard
        title="Rechnungsdaten"
        action={documentUrl ? <a className="pk-btn" href={documentUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Dokument öffnen</a> : null}
      >
        <PropertyGrid
          data={eingangsrechnung}
          fields={[
            { key: 'rechnungsnummer', label: 'Rechnungsnummer' },
            { key: 'rechnungsdatum', label: 'Rechnungsdatum' },
            { key: 'faelligkeit', label: 'Fälligkeit' },
            { key: 'betrag_netto', label: 'Netto' },
            { key: 'mwst', label: 'MwSt.' },
            { key: 'betrag_brutto', label: 'Brutto' },
            { key: 'kategorie', label: 'Kategorie' },
            { key: 'iban', label: 'IBAN' },
            { key: 'verwendungszweck', label: 'Verwendungszweck' },
            { key: 'bezahlt_am', label: 'Bezahlt am' },
            { key: 'notiz', label: 'Notiz' },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Lieferantenbezug"
        action={lieferant.id ? <EntityLink href={`/dashboard/buero/lieferanten/${encodeURIComponent(String(lieferant.id))}`} label="Zum Lieferanten" /> : null}
      >
        <PropertyGrid
          data={{ ...lieferant, name: lieferant.name || eingangsrechnung.lieferant }}
          fields={[
            { key: 'name', label: 'Lieferant' },
            { key: 'kontakt', label: 'Kontakt' },
            { key: 'email', label: 'E-Mail' },
            { key: 'telefon', label: 'Telefon' },
            { key: 'zahlungsziel', label: 'Zahlungsziel' },
            { key: 'status', label: 'Status' },
          ]}
        />
      </SectionCard>

      <SectionCard title="Zugehörige Bestellungen">
        <CompactList
          empty="Keine passenden Bestellungen gefunden."
          items={bestellungen}
          renderItem={item => (
            <div key={String(item.id)} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <EntityLink href={`/dashboard/buero/bestellungen/${encodeURIComponent(String(item.id))}`} label={String(item.artikel || item.id)} />
                <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{formatValue(item.status)} · erwartet {formatValue(item.erwartet_am || item.bestellt_am)}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatValue(item.gesamt || item.einkaufspreis)}</div>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Belegkontext">
        <CompactList
          empty="Keine Dokumente oder Steuerbelege gefunden."
          items={[
            ...dokumente.map(item => ({ ...item, _kind: 'dokument' })),
            ...steuerbelege.map(item => ({ ...item, _kind: 'steuer' })),
          ]}
          renderItem={item => {
            const kind = String(item._kind)
            const href = kind === 'steuer' ? '/dashboard/steuer' : `/dashboard/buero/dokumente/${encodeURIComponent(String(item.id))}`
            const label = kind === 'steuer' ? String(item.notiz || item.belegnummer || item.id) : String(item.name || item.id)
            const meta = kind === 'steuer' ? `Steuerbeleg · ${formatValue(item.status || item.datum)}` : `${formatValue(item.typ || item.kategorie)} · ${formatValue(item.datum)}`
            return (
              <div key={`${kind}-${String(item.id)}`} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <EntityLink href={href} label={label} />
                  <div style={{ color: '#aeb9c8', fontSize: 13, marginTop: 4 }}>{meta}</div>
                </div>
              </div>
            )
          }}
        />
      </SectionCard>
    </div>
  )
}

export default function BueroDetailPage() {
  const params = useParams<{ entity: string; id: string }>()
  const entity = params?.entity ?? ''
  const id = decodeURIComponent(params?.id ?? '')
  const [data, setData] = useState<DetailData | null>(null)
  const [context, setContext] = useState<DetailContext>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')

  const entityLabel = ENTITY_LABELS[entity] ?? 'Objekt'
  const title = useMemo(() => getDataTitle(data, entityLabel), [data, entityLabel])

  useEffect(() => {
    const load = async () => {
      const loader = LOADERS[entity]
      if (!loader) {
        setError('Dieser Detailtyp wird noch nicht unterstützt.')
        setLoading(false)
        return
      }
      try {
        const [next, extra] = await Promise.all([
          loader(id),
          CONTEXT_LOADERS[entity] ? CONTEXT_LOADERS[entity](id) : Promise.resolve(null),
        ])
        if (!next) {
          setError(`${entityLabel} nicht gefunden.`)
          return
        }
        setData(next)
        setContext(extra)
        const primaryDocument = extra && entity === 'eingangsrechnungen'
          ? (((extra as Record<string, unknown>).dokumente ?? []) as Array<Record<string, unknown>>)[0]
          : null
        const path = normalizeDocumentStoragePath(
          String(primaryDocument?.storage_path ?? primaryDocument?.dokument_url ?? next.storage_path ?? next.dokument_url ?? ''),
        )
        if (path) {
          const url = await getDokumentUrl(path)
          setDocumentUrl(url)
        } else {
          setDocumentUrl('')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : `Fehler beim Laden von ${entityLabel}.`)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [entity, entityLabel, id])

  const specializedView = useMemo(() => {
    if (!context) return null
    if (entity === 'kunden') return <KundenDetailView context={context} />
    if (entity === 'lieferanten') return <LieferantenDetailView context={context} />
    if (entity === 'eingangsrechnungen') return <EingangsrechnungDetailView context={context} documentUrl={documentUrl} />
    return null
  }, [context, documentUrl, entity])

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
        {!specializedView && documentUrl && (
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

      {!loading && !error && data && (specializedView || <GenericDetailFields data={data} />)}
    </div>
  )
}
