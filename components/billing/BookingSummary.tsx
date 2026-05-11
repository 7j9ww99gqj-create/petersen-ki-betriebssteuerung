import { PACKAGE_PRICING, PILOT_PRICING, formatPrice, type EmployeeTierId, type PackageId, type PilotId, type PriceValue } from '@/lib/pricingConfig'

export function BookingSummary({
  tier,
  packageId,
  pilotIds,
  total,
  onCreate,
  loading,
}: {
  tier: EmployeeTierId
  packageId?: PackageId
  pilotIds: PilotId[]
  total: PriceValue
  onCreate: () => void
  loading: boolean
}) {
  const pkg = packageId ? PACKAGE_PRICING[packageId] : null
  const includedPilots = pkg ? pkg.pilots : pilotIds
  const names = includedPilots.map(id => PILOT_PRICING[id]?.name).filter(Boolean)
  const hasSelection = Boolean(pkg || pilotIds.length)

  return (
    <div className="pk-card" style={{ position: 'sticky', top: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 900 }}>🛒 Warenkorb</h3>
      {!hasSelection ? (
        <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Wähle ein Paket oder einzelne Piloten aus.</p>
      ) : (
        <>
          <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.07)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ color: '#aeb9c8', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Auswahl</div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{pkg ? `${pkg.icon} ${pkg.name}` : 'Einzelne Piloten'}</div>
            <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>Mitarbeiterstufe: {tier}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
            {names.map(name => (
              <span key={name} className="badge badge-blue">{name}</span>
            ))}
            <span className="badge badge-green">KI-Erkennung inklusive</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ color: '#aeb9c8', fontWeight: 700 }}>Gesamtpreis</span>
            <span style={{ fontSize: 22, fontWeight: 950 }}>{formatPrice(total)}</span>
          </div>
          <button className="pk-btn" onClick={onCreate} disabled={loading} style={{ width: '100%', fontWeight: 850 }}>
            {loading ? '⏳ Wird vorbereitet…' : 'Buchung abschließen'}
          </button>
        </>
      )}
    </div>
  )
}

