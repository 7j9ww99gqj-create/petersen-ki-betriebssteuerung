'use client'
import * as React from 'react'

/**
 * Self-Service DSGVO-Datenexport (Art. 15 Auskunftsrecht).
 * Lädt JSON-Dump aller User-Daten als Download.
 *
 * Einbauen in Einstellungen:
 *   import DataExportButton from '@/components/einstellungen/DataExportButton'
 *   <DataExportButton />
 */
export default function DataExportButton() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/data-export')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Fehler ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Filename aus Content-Disposition oder Fallback
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? `petersen-ki-datenauskunft-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pk-card" style={{ padding: 18 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>
        📥 Datenauskunft (DSGVO Art. 15)
      </h3>
      <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 13, lineHeight: 1.5 }}>
        Lädt eine vollständige JSON-Datei mit allen zu Ihrem Konto gespeicherten Daten
        (Kunden, Rechnungen, Lager, Steuer, Aktivitäts-Logs, KI-Nutzung etc.). Sie haben
        gemäß DSGVO Art. 15 jederzeit Anspruch auf Auskunft über Ihre Daten.
      </p>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: 'rgba(255,80,80,.12)',
            border: '1px solid rgba(255,80,80,.3)',
            color: '#ff8080',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      <button
        className="pk-btn"
        onClick={handleExport}
        disabled={loading}
        style={{ minWidth: 200 }}
      >
        {loading ? '⏳ Wird erstellt…' : '📥 Daten herunterladen'}
      </button>
    </div>
  )
}
