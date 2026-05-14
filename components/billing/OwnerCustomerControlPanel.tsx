'use client'

import { useEffect, useState } from 'react'
import { listBillingSubscriptionsForOwner, updateBillingSubscriptionControls } from '@/lib/db'
import { PACKAGE_PRICING, PILOT_PRICING, STATUS_LABELS, type BookingStatus } from '@/lib/pricingConfig'
import type { SubscriptionRecord } from '@/lib/billing'

const STATUS_OPTIONS: BookingStatus[] = ['pending_payment', 'proof_sent', 'active', 'cancelled', 'rejected']

export function OwnerCustomerControlPanel({
  enabled,
  showToast,
}: {
  enabled: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [rows, setRows] = useState<SubscriptionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    listBillingSubscriptionsForOwner()
      .then(setRows)
      .catch(err => showToast(err instanceof Error ? err.message : 'Kundensteuerung konnte nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  }, [enabled, showToast])

  const applyChange = async (id: string, input: { status?: BookingStatus; softwareEnabled?: boolean }) => {
    setSavingId(id)
    try {
      const updated = await updateBillingSubscriptionControls(id, input)
      setRows(current => current.map(row => row.id === id ? updated : row))
      showToast('✅ Kundenstatus aktualisiert')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kundenstatus konnte nicht gespeichert werden', 'error')
    } finally {
      setSavingId(null)
    }
  }

  if (!enabled) return null

  const pendingActivations = rows.filter(r => r.status === 'proof_sent' && !r.softwareEnabled)
  const pendingPayments = rows.filter(r => r.status === 'pending_payment')

  return (
    <div className="pk-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>👑 Kundensteuerung</h3>
          <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>Nur fuer den Inhaber-Account sichtbar. Buchungen werden hier zentral steuerbar.</p>
        </div>
        <span className="badge badge-blue">{rows.length} Buchungen</span>
      </div>

      {/* Freischaltungs-Review-Flow */}
      {pendingActivations.length > 0 && (
        <div style={{
          marginBottom: 16, padding: '14px 16px', borderRadius: 12,
          background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)',
        }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#4ddb7e', marginBottom: 10 }}>
            ✅ {pendingActivations.length} Freischaltung{pendingActivations.length > 1 ? 'en' : ''} bereit – Zahlungsbeleg eingegangen
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {pendingActivations.map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>{row.userEmail || row.userKey}</span>
                  <span style={{ color: '#aeb9c8', marginLeft: 8 }}>
                    {row.packageId ? PACKAGE_PRICING[row.packageId]?.name ?? row.packageId
                      : row.pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ') || 'Einzelbuchung'}
                  </span>
                </div>
                <button
                  className="pk-btn"
                  disabled={savingId === row.id}
                  onClick={() => applyChange(row.id, { softwareEnabled: true, status: 'active' })}
                  style={{ fontWeight: 800, fontSize: 13 }}
                >
                  {savingId === row.id ? '⏳ Wird freigeschalten…' : '🔓 Jetzt freischalten'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ausstehende Zahlungen */}
      {pendingPayments.length > 0 && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.22)',
        }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>
            ⏳ {pendingPayments.length} Buchung{pendingPayments.length > 1 ? 'en' : ''} mit ausstehender Zahlung
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {pendingPayments.map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ color: '#dbe4ef' }}>{row.userEmail || row.userKey}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {row.userEmail && (
                    <a
                      href={`mailto:${row.userEmail}?subject=Ihre%20Buchung%20bei%20Petersen%20KI&body=Guten%20Tag%2C%20Ihre%20Buchung%20wartet%20noch%20auf%20eine%20Zahlung.%20Bitte%20schließen%20Sie%20den%20Checkout%20ab.`}
                      className="pk-btn-ghost"
                      style={{ fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >
                      Erneut kontaktieren
                    </a>
                  )}
                  <button
                    className="pk-btn-ghost"
                    disabled={savingId === row.id}
                    onClick={() => applyChange(row.id, { status: 'cancelled' })}
                    style={{ fontSize: 12, fontWeight: 700, color: '#f43f5e' }}
                  >
                    Stornieren
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Kundenbuchungen…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine zentralen Buchungen vorhanden.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(row => {
            const label = row.packageId
              ? PACKAGE_PRICING[row.packageId]?.name ?? row.packageId
              : row.pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ') || 'Einzelbuchung'
            const isProofSent = row.status === 'proof_sent'
            const isPendingPayment = row.status === 'pending_payment'
            return (
              <div
                key={row.id}
                style={{
                  border: `1px solid ${isProofSent ? 'rgba(16,185,129,.25)' : isPendingPayment ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.08)'}`,
                  borderRadius: 12, padding: 14,
                  background: isProofSent ? 'rgba(16,185,129,.04)' : isPendingPayment ? 'rgba(245,158,11,.03)' : 'rgba(255,255,255,.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.userEmail || row.userKey}</div>
                    <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>{label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={row.softwareEnabled ? 'badge badge-green' : 'badge badge-gray'}>
                      {row.softwareEnabled ? 'Software aktiv' : 'Software aus'}
                    </span>
                    <span className="badge badge-blue">{STATUS_LABELS[row.status]}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, marginTop: 12, alignItems: 'center' }}>
                  <select
                    className="pk-input"
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={e => applyChange(row.id, { status: e.target.value as BookingStatus })}
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                    ))}
                  </select>
                  <button
                    className={row.softwareEnabled ? 'pk-btn-ghost' : 'pk-btn'}
                    disabled={savingId === row.id}
                    onClick={() => applyChange(row.id, { softwareEnabled: !row.softwareEnabled, status: !row.softwareEnabled ? 'active' : row.status })}
                    style={{ fontWeight: 800, minWidth: 160 }}
                  >
                    {row.softwareEnabled ? 'Software sperren' : 'Software freischalten'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
