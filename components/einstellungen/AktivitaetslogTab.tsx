'use client'
import { useState } from 'react'
import { AuditLogSection } from './AuditLogSection'

/**
 * AktivitaetslogTab — Kartenrahmen + Refresh-Button um AuditLogSection.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 3b).
 *
 * Fixt nebenbei einen Vorbefund: Die alte „Aktualisieren"-Schaltfläche rief
 * versehentlich `loadManagedUsers()` auf (lud also die User-Liste, nicht die Logs).
 * Hier wird stattdessen ein `refreshKey`-Counter inkrementiert, der AuditLogSection
 * zum Neuladen zwingt.
 */
export default function AktivitaetslogTab({
  isInhaber,
  showToast,
}: {
  isInhaber: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="pk-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>📋 Aktivitätslog</h3>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
            Letzte Systemereignisse und Buchungsaktivitäten.
          </p>
        </div>
        <button
          className="pk-btn-ghost"
          onClick={() => setRefreshKey(k => k + 1)}
          style={{ fontWeight: 700 }}
        >
          Aktualisieren
        </button>
      </div>
      <AuditLogSection isInhaber={isInhaber} showToast={showToast} refreshKey={refreshKey} />
    </div>
  )
}
