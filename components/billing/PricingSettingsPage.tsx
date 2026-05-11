'use client'

import { useEffect, useMemo, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { createBookingRequest, getCurrentSubscription, updateBookingStatus, type SubscriptionRecord } from '@/lib/billing'
import {
  EMPLOYEE_TIERS,
  PACKAGE_PRICING,
  PILOT_PRICING,
  type EmployeeTierId,
  type PackageId,
  type PilotId,
  type PriceValue,
} from '@/lib/pricingConfig'
import { CurrentSubscriptionCard } from './CurrentSubscriptionCard'
import { PackageCard } from './PackageCard'
import { PilotCard } from './PilotCard'
import { BookingSummary } from './BookingSummary'
import { PaymentInstructions } from './PaymentInstructions'
import { ComingSoonPaymentMethods } from './ComingSoonPaymentMethods'

export function PricingSettingsPage({
  isDemo,
  showToast,
}: {
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [userKey, setUserKey] = useState(isDemo ? 'demo-user' : '')
  const [userEmail, setUserEmail] = useState(isDemo ? 'demo@petersen-ki.de' : '')
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null)
  const [tier, setTier] = useState<EmployeeTierId>('1-3')
  const [packageId, setPackageId] = useState<PackageId | undefined>('business')
  const [pilotIds, setPilotIds] = useState<PilotId[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (isDemo) {
        const current = await getCurrentSubscription('demo-user')
        if (mounted) setSubscription(current)
        return
      }
      const supabase = createSupabaseClient()
      const { data } = await supabase.auth.getUser()
      const key = data.user?.id || data.user?.email || 'live-user'
      if (!mounted) return
      setUserKey(key)
      setUserEmail(data.user?.email ?? '')
      setSubscription(await getCurrentSubscription(key))
    }
    load()
    return () => { mounted = false }
  }, [isDemo])

  const packagePilots = packageId ? PACKAGE_PRICING[packageId].pilots : []
  const total = useMemo<PriceValue>(() => {
    if (packageId) return PACKAGE_PRICING[packageId].prices[tier]
    if (pilotIds.length === 0) return 0
    const prices = pilotIds.map(id => PILOT_PRICING[id].prices[tier])
    if (prices.some(p => p === 'request')) return 'request'
    return prices.reduce<number>((sum, p) => sum + Number(p), 0)
  }, [packageId, pilotIds, tier])

  const selectedPilotIds = packageId ? packagePilots : pilotIds
  const userReference = userEmail || userKey || 'User'

  const selectPackage = (id: PackageId) => {
    setPackageId(current => current === id ? undefined : id)
    setPilotIds([])
  }

  const togglePilot = (id: PilotId) => {
    setPackageId(undefined)
    setPilotIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  const createBooking = async () => {
    if (!packageId && pilotIds.length === 0) { showToast('Bitte zuerst ein Paket oder Piloten auswählen', 'error'); return }
    setLoading(true)
    try {
      const record = await createBookingRequest({
        userKey,
        userEmail,
        packageId,
        pilotIds: selectedPilotIds,
        employeeTier: tier,
        monthlyPrice: total === 'request' ? null : total,
      })
      setSubscription(record)
      showToast('✅ Buchungsanfrage vorbereitet')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Buchung konnte nicht vorbereitet werden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const markProofSent = async () => {
    const updated = await updateBookingStatus(userKey, 'proof_sent')
    if (updated) setSubscription(updated)
    showToast('✅ Zahlungsbeleg-Status gesetzt')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CurrentSubscriptionCard subscription={subscription} />

      <div className="pk-card">
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 900 }}>👥 Mitarbeiterstufe</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {EMPLOYEE_TIERS.map(t => (
            <button key={t.id} onClick={() => setTier(t.id)} style={{
              padding: '13px 14px',
              borderRadius: 12,
              border: tier === t.id ? '2px solid #20c8ff' : '1px solid rgba(255,255,255,.09)',
              background: tier === t.id ? 'rgba(32,200,255,.1)' : 'rgba(255,255,255,.03)',
              color: tier === t.id ? '#9be8ff' : '#d0d9e8',
              textAlign: 'left',
              cursor: 'pointer',
            }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: '#7f8ea3', marginTop: 3 }}>{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="billing-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'end', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>Pakete</h3>
                <p style={{ margin: '4px 0 0', color: '#aeb9c8', fontSize: 13 }}>Business ist als Standardpaket empfohlen.</p>
              </div>
              <span className="badge badge-green">KI-Erkennung überall inklusive</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              {(Object.keys(PACKAGE_PRICING) as PackageId[]).map(id => (
                <PackageCard key={id} pkg={PACKAGE_PRICING[id]} tier={tier} selected={packageId === id} onSelect={() => selectPackage(id)} />
              ))}
            </div>
          </section>

          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 950 }}>Einzelne Piloten</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 10 }}>
              {(Object.keys(PILOT_PRICING) as PilotId[]).map(id => (
                <PilotCard
                  key={id}
                  pilot={PILOT_PRICING[id]}
                  tier={tier}
                  selected={selectedPilotIds.includes(id)}
                  disabled={Boolean(packageId)}
                  onToggle={() => togglePilot(id)}
                />
              ))}
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <BookingSummary tier={tier} packageId={packageId} pilotIds={pilotIds} total={total} loading={loading} onCreate={createBooking} />
          <PaymentInstructions
            subscription={subscription}
            packageId={subscription?.packageId ?? packageId}
            pilotIds={subscription?.pilotIds ?? selectedPilotIds}
            total={subscription?.monthlyPrice === null ? 'request' : subscription?.monthlyPrice ?? total}
            userReference={userReference}
            onProofSent={markProofSent}
          />
        </div>
      </div>

      <ComingSoonPaymentMethods />
      <style jsx>{`
        @media (max-width: 980px) {
          .billing-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
