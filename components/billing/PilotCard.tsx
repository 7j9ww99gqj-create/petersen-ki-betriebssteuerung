import { formatPrice, type EmployeeTierId, type PilotId, type PriceValue } from '@/lib/pricingConfig'

export function PilotCard({
  pilot,
  tier,
  selected,
  disabled,
  onToggle,
}: {
  pilot: {
    id: PilotId
    name: string
    icon: string
    description: string
    prices: Record<EmployeeTierId, PriceValue>
  }
  tier: EmployeeTierId
  selected: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className="pk-card" style={{
      padding: 16,
      opacity: disabled ? .55 : 1,
      border: selected ? '1px solid rgba(32,200,255,.55)' : '1px solid rgba(255,255,255,.08)',
      background: selected ? 'rgba(32,200,255,.07)' : 'rgba(255,255,255,.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 24, width: 32 }}>{pilot.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 850, fontSize: 15 }}>{pilot.name}</div>
              <div style={{ color: '#aeb9c8', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{pilot.description}</div>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 850, fontSize: 13, whiteSpace: 'nowrap' }}>{formatPrice(pilot.prices[tier])}</div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#4ddb7e', fontWeight: 800 }}>KI-Erkennung inklusive</span>
            <button className={selected ? 'pk-btn' : 'pk-btn-ghost'} disabled={disabled} onClick={onToggle} style={{ fontSize: 12, fontWeight: 800, opacity: disabled ? .55 : 1 }}>
              {selected ? 'Entfernen' : 'Pilot hinzufügen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

