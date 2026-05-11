import { EMPLOYEE_TIERS, PACKAGE_PRICING, PILOT_PRICING, STATUS_LABELS, formatPrice } from '@/lib/pricingConfig'
import type { SubscriptionRecord } from '@/lib/billing'

export function CurrentSubscriptionCard({ subscription }: { subscription: SubscriptionRecord | null }) {
  const packageName = subscription?.packageId ? PACKAGE_PRICING[subscription.packageId]?.name : undefined
  const activePilots = subscription?.pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean) ?? []
  const tier = subscription ? EMPLOYEE_TIERS.find(t => t.id === subscription.employeeTier)?.label : undefined

  return (
    <div className="pk-card" style={{ border: '1px solid rgba(32,200,255,.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#20c8ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Aktueller Status</div>
          <h3 style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 900 }}>
            {subscription ? (packageName ?? 'Einzelne Piloten') : 'Noch kein Paket gebucht'}
          </h3>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
            {subscription ? `${tier ?? 'Mitarbeiterstufe offen'} · ${activePilots.length || 0} aktive Piloten` : 'Wähle unten ein Paket oder einzelne Piloten aus.'}
          </p>
        </div>
        <span className={subscription?.status === 'active' ? 'badge badge-green' : subscription?.status === 'proof_sent' ? 'badge badge-orange' : 'badge badge-gray'}>
          {STATUS_LABELS[subscription?.status ?? 'no_subscription']}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 18 }}>
        <Info label="Aktuelles Paket" value={packageName ?? (subscription ? 'Einzelbuchung' : 'Keins')} />
        <Info label="Aktive Piloten" value={activePilots.length ? activePilots.join(', ') : 'Keine'} />
        <Info label="Mitarbeiterstufe" value={tier ?? 'Nicht gewählt'} />
        <Info label="Monatspreis" value={subscription ? formatPrice(subscription.monthlyPrice ?? 'request') : '-'} />
        <Info label="Nächste Zahlung" value={subscription?.nextPayment ?? '-'} />
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize: 11, color: '#7f8ea3', fontWeight: 800, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#d9e2ef', fontWeight: 700, lineHeight: 1.35 }}>{value}</div>
    </div>
  )
}

