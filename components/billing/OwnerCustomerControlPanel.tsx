'use client'

import { useEffect, useState } from 'react'
import { getLatestBueroRechnungBySubscriptionId, listBillingSubscriptionsForOwner, updateBillingSubscriptionControls } from '@/lib/db'
import { createBillingInvoiceForSubscription } from '@/lib/billing'
import { PACKAGE_PRICING, PILOT_PRICING, STATUS_LABELS, type BookingStatus } from '@/lib/pricingConfig'
import type { SubscriptionRecord } from '@/lib/billing'

const STATUS_OPTIONS: BookingStatus[] = ['pending_payment', 'proof_sent', 'active', 'cancelled', 'rejected']

type BillingInvoiceMini = {
  id: string
  nummer?: string
  status?: string
  betrag?: string
}

export function OwnerCustomerControlPanel({
  enabled,
  showToast,
}: {
  enabled: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [rows, setRows] = useState<SubscriptionRecord[]>([])
  const [invoiceBySubscription, setInvoiceBySubscription] = useState<Record<string, BillingInvoiceMini | null>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const audit = async (
    action: 'customer.unlock' | 'customer.suspend' | 'customer.status_change' | 'invoice.create',
    target: { userId?: string | null; email?: string | null },
    details: Record<string, unknown>,
  ) => {
    try {
      await fetch('/api/owner/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target, details }),
      })
    } catch {
      // Audit-Logging darf UI niemals blockieren
    }
  }

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    listBillingSubscriptionsForOwner()
      .then(async data => {
        setRows(data)
        const invoicePairs = await Promise.all(data.map(async row => {
          const invoice = await getLatestBueroRechnungBySubscriptionId(row.id).catch(() => null)
          return [row.id, invoice ? {
            id: String(invoice.id),
            nummer: String(invoice.nummer ?? ''),
            status: String(invoice.status ?? ''),
            betrag: String(invoice.betrag ?? ''),
          } : null] as const
        }))
        setInvoiceBySubscription(Object.fromEntries(invoicePairs))
      })
      .catch(err => showToast(err instanceof Error ? err.message : 'Kundensteuerung konnte nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  }, [enabled, showToast])

  const applyChange = async (id: string, input: { status?: BookingStatus; softwareEnabled?: boolean }) => {
    setSavingId(id)
    const prev = rows.find(r => r.id === id) ?? null
    try {
      const updated = await updateBillingSubscriptionControls(id, input)
      setRows(current => current.map(row => row.id === id ? updated : row))
      showToast('✅ Kundenstatus aktualisiert')

      // Audit-Logging der Inhaber-Aktion (fire-and-forget)
      const target = { userId: updated.userId ?? null, email: updated.userEmail ?? null }
      if (typeof input.softwareEnabled === 'boolean' && prev?.softwareEnabled !== input.softwareEnabled) {
        await audit(
          input.softwareEnabled ? 'customer.unlock' : 'customer.suspend',
          target,
          {
            subscriptionId: id,
            softwareEnabled: input.softwareEnabled,
            previousSoftwareEnabled: prev?.softwareEnabled ?? null,
            status: updated.status,
            previousStatus: prev?.status ?? null,
          },
        )
      } else if (typeof input.status === 'string' && prev?.status !== input.status) {
        await audit('customer.status_change', target, {
          subscriptionId: id,
          status: input.status,
          previousStatus: prev?.status ?? null,
        })
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kundenstatus konnte nicht gespeichert werden', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const createInvoice = async (row: SubscriptionRecord) => {
    setSavingId(row.id)
    try {
      const existing = await getLatestBueroRechnungBySubscriptionId(row.id).catch(() => null)
      if (existing) {
        setInvoiceBySubscription(current => ({
          ...current,
          [row.id]: {
            id: String(existing.id),
            nummer: String(existing.nummer ?? ''),
            status: String(existing.status ?? ''),
            betrag: String(existing.betrag ?? ''),
          },
        }))
        showToast('Rechnung existiert bereits.')
        return
      }
      const draft = await createBillingInvoiceForSubscription(row)
      setInvoiceBySubscription(current => ({
        ...current,
        [row.id]: {
          id: draft.id,
          nummer: draft.number,
          status: draft.status,
          betrag: `${draft.grossAmount.toFixed(2)} €`,
        },
      }))
      showToast(`✅ Rechnung ${draft.number} erstellt`)
      await audit('invoice.create', { userId: row.userId ?? null, email: row.userEmail ?? null }, {
        subscriptionId: row.id,
        invoiceId: draft.id,
        invoiceNumber: draft.number,
        grossAmount: draft.grossAmount,
        status: draft.status,
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rechnung konnte nicht erstellt werden', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const buildInvoiceMailHref = (row: SubscriptionRecord, invoice: BillingInvoiceMini) => {
    const subject = `Rechnung ${invoice.nummer || invoice.id} von Petersen KI`
    const body = [
      'Guten Tag,',
      '',
      `anbei erhalten Sie die Rechnung ${invoice.nummer || invoice.id} zu Ihrer Buchung bei Petersen KI.`,
      `Buchung: ${row.packageId ? PACKAGE_PRICING[row.packageId]?.name ?? row.packageId : row.pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ') || 'Einzelbuchung'}`,
      invoice.betrag ? `Betrag: ${invoice.betrag}` : '',
      '',
      'Viele Gruesse',
    ].filter(Boolean).join('\n')
    return `mailto:${encodeURIComponent(row.userEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
            const invoice = invoiceBySubscription[row.id]
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
                    <span className={invoice ? 'badge badge-green' : 'badge badge-gray'}>
                      {invoice ? `Rechnung ${invoice.nummer || invoice.id}` : 'Keine Rechnung'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: 10, marginTop: 12, alignItems: 'center' }}>
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
                  <button
                    className={invoice ? 'pk-btn-ghost' : 'pk-btn'}
                    disabled={savingId === row.id || Boolean(invoice)}
                    onClick={() => createInvoice(row)}
                    style={{ fontWeight: 800, minWidth: 150, opacity: invoice ? .6 : 1 }}
                  >
                    {invoice ? 'Rechnung erstellt' : 'Rechnung erstellen'}
                  </button>
                  {invoice && row.userEmail ? (
                    <a
                      href={buildInvoiceMailHref(row, invoice)}
                      className="pk-btn-ghost"
                      style={{ fontWeight: 800, minWidth: 130, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      Mail öffnen
                    </a>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
