'use client'

import { useEffect, useMemo, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { trackVisit } from '@/lib/recent'
import {
  getBueroAngebote,
  getBueroAuftraege,
  getBueroDokumente,
  getBueroEingangsrechnungen,
  getBueroKunden,
  getBueroRechnungen,
  getEinkaufBestellungen,
  getEinkaufLieferanten,
  getEinkaufWareneingaenge,
  getLagerArtikel,
  getLagerBewegungen,
  getWerkstattKarten,
  getCloudBackups,
  createCloudBackup,
  type CloudBackup,
} from '@/lib/db'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { useGlobalToast } from '@/components/ui/ToastProvider'
import ActivityLog from '@/components/ui/ActivityLog'

type CloudLogEntry = {
  time: string
  action: string
  status: 'ok' | 'warn'
  sortKey: number
}

type CloudModule = {
  name: string
  value: string
  detail: string
  status: 'live' | 'warn'
  icon: string
}

type CloudSnapshot = {
  cloudStatus: string
  cloudStatusColor: string
  lastSyncLabel: string
  storageLabel: string
  deviceLabel: string
  totalDocs: number
  linkedDocs: number
  orphanDocs: number
  syncLog: CloudLogEntry[]
  modules: CloudModule[]
}

type CloudDocument = {
  id: string
  name?: string
  groesse?: string
  eingangsrechnung_id?: string
  rechnung_id?: string
  angebot_id?: string
  auftrag_id?: string
  created_at?: string
  updated_at?: string
}

type DateCarrier = {
  created_at?: string
  updated_at?: string
  datum?: string
  erstellt?: string
  rechnungsdatum?: string
  gemeldet_am?: string
  name?: string
  id?: string
}

const demoSnapshot: CloudSnapshot = {
  cloudStatus: 'Demo-Modus',
  cloudStatusColor: '#f59e0b',
  lastSyncLabel: 'Nur Demo-Daten',
  storageLabel: 'Nicht verbunden',
  deviceLabel: '1 Sitzung',
  totalDocs: 2,
  linkedDocs: 1,
  orphanDocs: 1,
  syncLog: [
    { time: '14:22', action: 'Demo-Archiv geladen', status: 'ok', sortKey: Date.now() - 60_000 },
    { time: '14:20', action: 'Keine Live-Cloud verbunden', status: 'warn', sortKey: Date.now() - 120_000 },
  ],
  modules: [
    { name: 'LagerPilot', value: 'Demo', detail: 'Lokale Beispieldaten', status: 'warn', icon: '📦' },
    { name: 'BüroPilot', value: 'Demo', detail: 'Belege nicht live synchronisiert', status: 'warn', icon: '🧾' },
    { name: 'Archiv', value: '2 Dokumente', detail: 'Nur Demo-Dateien', status: 'warn', icon: '🗂️' },
    { name: 'WerkstattPilot', value: 'Demo', detail: 'Keine Live-Aktivität', status: 'warn', icon: '🛠️' },
  ],
}

function parseGroesse(value?: string | null) {
  if (!value) return 0
  const normalized = value.replace(',', '.')
  const amount = Number.parseFloat(normalized.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(amount)) return 0
  if (/gb/i.test(value)) return amount * 1024 * 1024 * 1024
  if (/mb/i.test(value)) return amount * 1024 * 1024
  return amount * 1024
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

function parseDate(value?: string | null) {
  if (!value) return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct
  const deMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!deMatch) return null
  return new Date(`${deMatch[3]}-${deMatch[2]}-${deMatch[1]}T12:00:00`)
}

function formatRelative(value?: Date | null) {
  if (!value) return 'Keine Aktivität'
  const diffMs = Date.now() - value.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return 'Gerade eben'
  if (diffMinutes < 60) return `Vor ${diffMinutes} Min.`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `Vor ${diffHours} Std.`
  const diffDays = Math.round(diffHours / 24)
  return `Vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`
}

function formatClock(value?: Date | null) {
  if (!value) return '—'
  return value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function inferDeviceName() {
  if (typeof navigator === 'undefined') return 'Aktuelles Gerät'
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua) && /mobile/i.test(ua)) return 'Android Smartphone'
  if (/android/i.test(ua)) return 'Android Tablet'
  if (/mac os x|macintosh/i.test(ua)) return 'Mac'
  if (/windows/i.test(ua)) return 'Windows PC'
  if (/linux/i.test(ua)) return 'Linux Gerät'
  return 'Aktuelles Gerät'
}

function getLatest(records: DateCarrier[], fields: Array<keyof DateCarrier>) {
  return records.reduce<Date | null>((latest, record) => {
    for (const field of fields) {
      const parsed = parseDate(record[field] as string | undefined)
      if (parsed && (!latest || parsed > latest)) return parsed
    }
    return latest
  }, null)
}

async function listStorageUsage() {
  if (!isSupabaseConfigured()) return null

  const supabase = createSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return null

  const visited = new Set<string>()
  const prefixes = [userId, `steuer/${userId}`]

  async function walk(prefix: string): Promise<number> {
    if (!prefix || visited.has(prefix)) return 0
    visited.add(prefix)
    const { data, error } = await supabase.storage.from('dokumente').list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (error || !data) return 0

    let bytes = 0
    for (const item of data) {
      const size = typeof item.metadata?.size === 'number' ? item.metadata.size : 0
      if (size > 0) {
        bytes += size
        continue
      }
      bytes += await walk(`${prefix}/${item.name}`)
    }
    return bytes
  }

  const results = await Promise.all(prefixes.map(prefix => walk(prefix)))
  return results.reduce((sum, value) => sum + value, 0)
}

async function loadCloudSnapshot(): Promise<CloudSnapshot> {
  const [
    dokumente,
    angebote,
    auftraege,
    rechnungen,
    eingangsrechnungen,
    kunden,
    lieferanten,
    bestellungen,
    wareneingaenge,
    artikel,
    bewegungen,
    werkstattKarten,
    storageBytes,
  ] = await Promise.all([
    getBueroDokumente() as Promise<CloudDocument[]>,
    getBueroAngebote() as Promise<DateCarrier[]>,
    getBueroAuftraege() as Promise<DateCarrier[]>,
    getBueroRechnungen() as Promise<DateCarrier[]>,
    getBueroEingangsrechnungen() as Promise<DateCarrier[]>,
    getBueroKunden() as Promise<DateCarrier[]>,
    getEinkaufLieferanten() as Promise<DateCarrier[]>,
    getEinkaufBestellungen() as Promise<DateCarrier[]>,
    getEinkaufWareneingaenge() as Promise<DateCarrier[]>,
    getLagerArtikel() as Promise<DateCarrier[]>,
    getLagerBewegungen() as Promise<DateCarrier[]>,
    getWerkstattKarten() as Promise<DateCarrier[]>,
    listStorageUsage(),
  ])

  const linkedDocs = dokumente.filter(doc => doc.eingangsrechnung_id || doc.rechnung_id || doc.angebot_id || doc.auftrag_id).length
  const orphanDocs = dokumente.length - linkedDocs

  const lastActivity = [
    getLatest(dokumente, ['updated_at', 'created_at']),
    getLatest(rechnungen, ['updated_at', 'created_at', 'erstellt']),
    getLatest(eingangsrechnungen, ['updated_at', 'created_at', 'rechnungsdatum']),
    getLatest(bestellungen, ['updated_at', 'created_at']),
    getLatest(bewegungen, ['created_at', 'datum']),
    getLatest(werkstattKarten, ['updated_at', 'created_at', 'erstellt']),
  ].reduce<Date | null>((latest, current) => {
    if (!current) return latest
    if (!latest || current > latest) return current
    return latest
  }, null)

  const fallbackBytes = dokumente.reduce((sum, doc) => sum + parseGroesse(doc.groesse), 0)
  const effectiveBytes = storageBytes && storageBytes > 0 ? storageBytes : fallbackBytes

  const syncLog: CloudLogEntry[] = [
    {
      time: formatClock(getLatest(dokumente, ['updated_at', 'created_at'])),
      action: `${dokumente.length} Archivdokumente im Live-System erkannt`,
      status: dokumente.length ? 'ok' as const : 'warn' as const,
      sortKey: getLatest(dokumente, ['updated_at', 'created_at'])?.getTime() ?? 0,
    },
    {
      time: formatClock(getLatest(eingangsrechnungen, ['updated_at', 'created_at', 'rechnungsdatum'])),
      action: `${eingangsrechnungen.length} Eingangsrechnungen mit Büro-/Einkaufsbezug geladen`,
      status: eingangsrechnungen.length ? 'ok' as const : 'warn' as const,
      sortKey: getLatest(eingangsrechnungen, ['updated_at', 'created_at', 'rechnungsdatum'])?.getTime() ?? 0,
    },
    {
      time: formatClock(getLatest(bewegungen, ['created_at', 'datum'])),
      action: `${bewegungen.length} letzte Lagerbewegungen für Cloud-Status ausgewertet`,
      status: bewegungen.length ? 'ok' as const : 'warn' as const,
      sortKey: getLatest(bewegungen, ['created_at', 'datum'])?.getTime() ?? 0,
    },
    {
      time: formatClock(getLatest(bestellungen, ['updated_at', 'created_at'])),
      action: `${bestellungen.length} Einkaufsbestellungen und ${wareneingaenge.length} Wareneingänge verbunden`,
      status: bestellungen.length || wareneingaenge.length ? 'ok' as const : 'warn' as const,
      sortKey: getLatest(bestellungen, ['updated_at', 'created_at'])?.getTime() ?? 0,
    },
    {
      time: formatClock(getLatest(werkstattKarten, ['updated_at', 'created_at', 'erstellt'])),
      action: `${werkstattKarten.length} Werkstattkarten im Live-Bestand verfügbar`,
      status: werkstattKarten.length ? 'ok' as const : 'warn' as const,
      sortKey: getLatest(werkstattKarten, ['updated_at', 'created_at', 'erstellt'])?.getTime() ?? 0,
    },
  ]
    .filter(entry => entry.sortKey > 0)
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 6)

  const modules: CloudModule[] = [
    {
      name: 'LagerPilot',
      value: `${artikel.length} Artikel`,
      detail: `${bewegungen.length} letzte Bewegungen`,
      status: artikel.length ? 'live' : 'warn',
      icon: '📦',
    },
    {
      name: 'BüroPilot',
      value: `${kunden.length + angebote.length + auftraege.length + rechnungen.length} Objekte`,
      detail: `${kunden.length} Kunden · ${rechnungen.length} Rechnungen`,
      status: kunden.length || rechnungen.length ? 'live' : 'warn',
      icon: '🧾',
    },
    {
      name: 'Einkauf',
      value: `${lieferanten.length} Lieferanten`,
      detail: `${bestellungen.length} Bestellungen · ${wareneingaenge.length} Wareneingänge`,
      status: lieferanten.length || bestellungen.length ? 'live' : 'warn',
      icon: '🛒',
    },
    {
      name: 'Archiv',
      value: `${dokumente.length} Dokumente`,
      detail: `${linkedDocs} verknüpft · ${orphanDocs} ohne Bezug`,
      status: dokumente.length ? 'live' : 'warn',
      icon: '🗂️',
    },
    {
      name: 'WerkstattPilot',
      value: `${werkstattKarten.length} Karten`,
      detail: 'Live aus Werkstattdaten',
      status: werkstattKarten.length ? 'live' : 'warn',
      icon: '🛠️',
    },
  ]

  return {
    cloudStatus: isSupabaseConfigured() ? 'Live verbunden' : 'Nicht konfiguriert',
    cloudStatusColor: isSupabaseConfigured() ? '#10b981' : '#f59e0b',
    lastSyncLabel: formatRelative(lastActivity),
    storageLabel: effectiveBytes > 0 ? formatBytes(effectiveBytes) : 'Keine Daten erkannt',
    deviceLabel: `${modules.filter(m => m.status === 'live').length} Live-Module`,
    totalDocs: dokumente.length,
    linkedDocs,
    orphanDocs,
    syncLog: syncLog.length ? syncLog : [{ time: '—', action: 'Noch keine Live-Aktivität erkannt', status: 'warn', sortKey: 0 }],
    modules,
  }
}

// Gruppiert Backup-Module in kompakte Zeilen für die UI
function summarizeModules(modules: Record<string, number>) {
  const groups: Record<string, number> = {
    'Lager': modules['LagerPilot'] ?? 0,
    'Büro': (modules['BüroPilot Kunden'] ?? 0) + (modules['BüroPilot Angebote'] ?? 0) +
      (modules['BüroPilot Aufträge'] ?? 0) + (modules['BüroPilot Rechnungen'] ?? 0) +
      (modules['BüroPilot Eingangsrechnungen'] ?? 0),
    'Archiv': modules['Archiv Dokumente'] ?? 0,
    'Werkstatt': modules['WerkstattPilot'] ?? 0,
    'Planung': (modules['PlanungPilot Projekte'] ?? 0) + (modules['PlanungPilot Aufgaben'] ?? 0),
    'Steuer': modules['SteuerPilot Belege'] ?? 0,
    'Marketing': (modules['MarketingPilot Kampagnen'] ?? 0) + (modules['MarketingPilot Leads'] ?? 0) +
      (modules['MarketingPilot Newsletter'] ?? 0),
    'Einkauf': (modules['Einkauf Lieferanten'] ?? 0) + (modules['Einkauf Bestellungen'] ?? 0),
  }
  return Object.entries(groups)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}

export default function CloudPage() {
  const isDemo = hasDemoCookie()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState<CloudSnapshot>(demoSnapshot)

  // Backup-State
  const [backups, setBackups] = useState<CloudBackup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(true)
  const [backupConfirm, setBackupConfirm] = useState(false)
  const [backupRunning, setBackupRunning] = useState(false)
  const toast = useGlobalToast()
  const [expandedBackup, setExpandedBackup] = useState<string | null>(null)

  const lastBackup = backups[0] ?? null

  const cards = useMemo(() => ([
    { label: 'Cloud-Status', value: snapshot.cloudStatus, icon: '☁️', color: snapshot.cloudStatusColor },
    { label: 'Letzte Aktivität', value: snapshot.lastSyncLabel, icon: '🔄', color: '#1684ff' },
    { label: 'Gespeicherte Daten', value: snapshot.storageLabel, icon: '💾', color: '#a78bfa' },
    {
      label: 'Letztes Backup',
      value: lastBackup ? formatDateShort(lastBackup.created_at) : (isDemo ? 'Demo' : 'Noch keins'),
      icon: '🛡️',
      color: lastBackup ? '#10b981' : '#f59e0b',
    },
  ]), [snapshot, lastBackup, isDemo])

  const loadData = async () => {
    trackVisit({ href: '/dashboard/cloud', label: 'CloudPilot', icon: '☁️' })
    setError('')
    try {
      const [snap, bups] = await Promise.all([loadCloudSnapshot(), getCloudBackups()])
      setSnapshot(snap)
      setBackups(bups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
      setBackupsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const triggerRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [snap, bups] = await Promise.all([loadCloudSnapshot(), getCloudBackups()])
      setSnapshot(snap)
      setBackups(bups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud-Daten konnten nicht aktualisiert werden.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleBackup = async () => {
    if (backupRunning) return
    setBackupRunning(true)
    setBackupConfirm(false)
    try {
      const backup = await createCloudBackup('Manuell')
      setBackups(prev => [backup, ...prev])
      toast.success(`Backup erstellt — ${backup.total_records} Datensätze gesichert`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Backup fehlgeschlagen')
    } finally {
      setBackupRunning(false)
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(32,200,255,.15)', border: '1px solid rgba(32,200,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>☁️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Cloud/Sync & Backup</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>
            {isDemo ? 'Demo-Ansicht ohne Live-Cloud' : 'Live-Status · Backup-System · Modulübersicht'}
          </p>
        </div>
        <span
          className={snapshot.cloudStatus === 'Live verbunden' ? 'badge badge-green' : 'badge badge-gray'}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          {snapshot.cloudStatus === 'Live verbunden' ? '● LIVE' : '● DEMO'}
        </span>
      </div>

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {cards.map(card => (
          <div key={card.label} className="pk-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 24 }}>{card.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,80,80,.1)', border: '1px solid rgba(255,80,80,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: '#ff8080' }}>⚠️ {error}</span>
          <button className="pk-btn-ghost" onClick={() => { setError(''); void loadData() }}
            style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
            ↻ Erneut versuchen
          </button>
        </div>
      )}

      {/* Hauptbereich: Backup + Datenstatus */}
      <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Backup-System */}
        <div className="pk-card">
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🛡️ Backup-System</h3>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {isDemo ? 'Nur im Live-Modus verfügbar' : `${backups.length} gespeicherte Backups · Automatisch tägl. 02:00 Uhr`}
              </div>
            </div>
          </div>

          {/* Backup erstellen Button (2-Klick) */}
          {!isDemo && (
            <div style={{ marginBottom: 16 }}>
              {backupConfirm ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.25)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 13, color: '#aeb9c8', flex: 1 }}>Backup jetzt erstellen?</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="pk-btn"
                      onClick={() => void handleBackup()}
                      disabled={backupRunning}
                      style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
                    >
                      {backupRunning ? '⏳ Sichert…' : '✓ Jetzt sichern'}
                    </button>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => setBackupConfirm(false)}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="pk-btn"
                  onClick={() => setBackupConfirm(true)}
                  disabled={backupRunning}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  🛡️ Backup erstellen
                </button>
              )}
            </div>
          )}

          {/* Backup-Liste */}
          {backupsLoading ? (
            <div style={{ color: '#aeb9c8', fontSize: 13 }}>Backup-Historie wird geladen…</div>
          ) : isDemo ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
              <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>Demo-Modus</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>Keine echte Backup-Historie im Demo-Modus</div>
            </div>
          ) : backups.length === 0 ? (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
              <div style={{ fontSize: 13, color: '#aeb9c8' }}>Noch kein Backup erstellt</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Erstelle dein erstes Backup mit dem Button oben</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {backups.map((b, idx) => (
                <div key={b.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedBackup(expandedBackup === b.id ? null : b.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedBackup(expandedBackup === b.id ? null : b.id) }}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: idx === 0 ? 'rgba(22,132,255,.06)' : 'rgba(255,255,255,.03)',
                      border: idx === 0 ? '1px solid rgba(22,132,255,.2)' : '1px solid rgba(255,255,255,.05)',
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{b.label === 'Automatisch' ? '🤖' : '🖐️'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {b.label}
                            {idx === 0 && <span style={{ marginLeft: 6, fontSize: 10, color: '#1684ff', fontWeight: 600 }}>AKTUELL</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#aeb9c8' }}>{formatDateTime(b.created_at)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{b.total_records} DS</div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>{expandedBackup === b.id ? '▲' : '▼'} Details</div>
                      </div>
                    </div>
                  </div>
                  {expandedBackup === b.id && (
                    <div style={{
                      padding: '10px 12px', borderRadius: '0 0 10px 10px', marginTop: -2,
                      background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
                      borderTop: 'none',
                    }}>
                      <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.8 }}>
                        {summarizeModules(b.modules)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Datenstatus */}
        <div>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🔄 Datenstatus</h3>

            {loading ? (
              <div style={{ color: '#aeb9c8' }}>Cloud-Modul lädt Live-Daten…</div>
            ) : (
              <div>
                <div style={{
                  padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                  background: isDemo ? 'rgba(245,158,11,.08)' : 'rgba(37,211,102,.08)',
                  border: isDemo ? '1px solid rgba(245,158,11,.2)' : '1px solid rgba(37,211,102,.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>{isDemo ? 'ℹ️' : '✅'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isDemo ? '#ffb347' : '#4ddb7e' }}>
                      {isDemo ? 'Nur Demo-Cloud aktiv' : 'Live-Daten erfolgreich geladen'}
                    </div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>Letzte Aktivität: {snapshot.lastSyncLabel}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Archivdokumente', value: snapshot.totalDocs, color: '#20c8ff' },
                    { label: 'Verknüpft', value: snapshot.linkedDocs, color: '#4ddb7e' },
                    { label: 'Ohne Bezug', value: snapshot.orphanDocs, color: '#f59e0b' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 11, color: '#aeb9c8' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <button className="pk-btn" onClick={() => void triggerRefresh()} disabled={refreshing || isDemo} style={{ width: '100%', fontWeight: 700, opacity: isDemo ? 0.65 : 1 }}>
                  {refreshing ? 'Wird aktualisiert…' : '☁️ Live-Daten neu laden'}
                </button>
              </div>
            )}
          </div>

          <div className="pk-card">
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>Pilot-Module</h3>
            {snapshot.modules.map(module => (
              <div
                key={module.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                }}
              >
                <span style={{ fontSize: 18 }}>{module.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{module.name}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{module.detail}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{module.value}</div>
                  <span className={module.status === 'live' ? 'badge badge-green' : 'badge badge-gray'}>
                    {module.status === 'live' ? 'Live' : 'Leer'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aktivitätsprotokoll + Geräte */}
      <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="pk-card">
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>📋 Sync-Protokoll</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshot.syncLog.map((log, index) => (
              <div
                key={`${log.time}-${index}`}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                  borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)',
                }}
              >
                <span style={{ fontSize: 14, marginTop: 1 }}>{log.status === 'ok' ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: log.status === 'warn' ? '#f59e0b' : '#f8fbff' }}>{log.action}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{log.time} Uhr</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>🗑️ Lösch-Protokoll</h3>
          <ActivityLog maxItems={30} compact />
        </div>

        <div className="pk-card">
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>💻 Geräte & Sitzungen</h3>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Aktueller Browser + Supabase-Auth</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                name: inferDeviceName(),
                detail: `Aktive Browser-Sitzung · letzte Prüfung ${formatDateTime(new Date())}`,
                status: 'active' as const,
              },
              {
                name: 'Supabase Session',
                detail: isSupabaseConfigured() ? 'Authentifizierung und Storage erreichbar' : 'Supabase nicht vollständig konfiguriert',
                status: isSupabaseConfigured() ? 'passive' as const : 'active' as const,
              },
              {
                name: 'Automatisches Backup',
                detail: 'Täglich 02:00 Uhr via Vercel Cron — schreibt Snapshot in cloud_backups',
                status: 'passive' as const,
              },
            ].map(device => (
              <div key={device.name} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{device.name}</div>
                  <span className={device.status === 'active' ? 'badge badge-green' : 'badge badge-gray'}>
                    {device.status === 'active' ? 'Aktiv' : 'Info'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>{device.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
