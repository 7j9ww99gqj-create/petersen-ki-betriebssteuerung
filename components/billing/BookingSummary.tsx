import { PACKAGE_PRICING, PILOT_PRICING, formatPrice, type EmployeeTierId, type PackageId, type PilotId, type PriceValue } from '@/lib/pricingConfig'

export function BookingSummary({
  tier,
  packageId,
  pilotIds,
  total,
  onCreate,
  loading,
  onRemovePackage,
  onRemovePilot,
  onClear,
}: {
  tier: EmployeeTierId
  packageId?: PackageId
  pilotIds: PilotId[]
  total: PriceValue
  onCreate: () => void
  loading: boolean
  onRemovePackage: () => void
  onRemovePilot: (id: PilotId) => void
  onClear: () => void
}) {
  const pkg = packageId ? PACKAGE_PRICING[packageId] : null
  const includedPilots = pkg ? pkg.pilots : pilotIds
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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{pkg ? `${pkg.icon} ${pkg.name}` : 'Einzelne Piloten'}</div>
              <button className="pk-btn-ghost" onClick={onClear} style={{ fontSize: 12, fontWeight: 800, padding: '8px 10px' }}>
                Alles entfernen
              </button>
            </div>
            <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>Mitarbeiterstufe: {tier}</div>
          </div>
          <div style={{ display: 'grid', gap: 8, margin: '14px 0' }}>
            {pkg ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontWeight: 800 }}>{pkg.icon} {pkg.name}</span>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>{includedPilots.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ')}</span>
                </div>
                <button className="pk-btn-ghost" onClick={onRemovePackage} style={{ fontSize: 12, fontWeight: 800, padding: '8px 10px' }}>
                  Entfernen
                </button>
              </div>
            ) : (
              pilotIds.map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span>{PILOT_PRICING[id]?.icon}</span>
                    <span style={{ fontWeight: 800 }}>{PILOT_PRICING[id]?.name}</span>
                  </div>
                  <button className="pk-btn-ghost" onClick={() => onRemovePilot(id)} style={{ fontSize: 12, fontWeight: 800, padding: '8px 10px' }}>
                    Entfernen
                  </button>
                </div>
              ))
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="badge badge-green">KI-Erkennung inklusive</span>
            </div>
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
