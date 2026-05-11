import { EMPLOYEE_TIERS, formatPrice, type EmployeeTierId, type PackageId, type PriceValue } from '@/lib/pricingConfig'

export function PackageCard({
  pkg,
  tier,
  selected,
  onSelect,
}: {
  pkg: {
    id: PackageId
    name: string
    icon: string
    recommended?: boolean
    included: string[]
    prices: Record<EmployeeTierId, PriceValue>
    singlePrices: Record<EmployeeTierId, PriceValue>
  }
  tier: EmployeeTierId
  selected: boolean
  onSelect: () => void
}) {
  const price = pkg.prices[tier]
  const singlePrice = pkg.singlePrices[tier]
  const tierLabel = EMPLOYEE_TIERS.find(t => t.id === tier)?.label ?? tier

  return (
    <div className="pk-card" style={{
      position: 'relative',
      border: selected ? '2px solid #20c8ff' : pkg.recommended ? '1px solid rgba(245,158,11,.45)' : '1px solid rgba(255,255,255,.08)',
      background: selected ? 'rgba(32,200,255,.08)' : 'rgba(255,255,255,.035)',
    }}>
      {pkg.recommended && (
        <div style={{ position: 'absolute', top: -11, right: 16, padding: '4px 9px', borderRadius: 999, background: '#f59e0b', color: '#111827', fontSize: 11, fontWeight: 900 }}>
          Empfehlung
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 28 }}>{pkg.icon}</div>
        <div>
          <h4 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>{pkg.name}</h4>
          <div style={{ fontSize: 12, color: '#aeb9c8' }}>{tierLabel}</div>
        </div>
      </div>

      <div style={{ fontSize: 24, fontWeight: 950, marginBottom: 4 }}>{formatPrice(price)}</div>
      {singlePrice !== 'request' && price !== 'request' && (
        <div style={{ fontSize: 12, color: '#7f8ea3', marginBottom: 14 }}>
          statt {formatPrice(singlePrice).replace(' / Monat', '')} einzeln
        </div>
      )}

      <div style={{ display: 'grid', gap: 7, marginBottom: 16 }}>
        {pkg.included.map(item => (
          <div key={item} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#d0d9e8' }}>
            <span style={{ color: '#4ddb7e' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <button className={selected ? 'pk-btn' : 'pk-btn-ghost'} onClick={onSelect} style={{ width: '100%', fontWeight: 800 }}>
        {selected ? 'Ausgewählt' : 'Paket auswählen'}
      </button>
    </div>
  )
}

