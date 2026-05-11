import { PACKAGE_PRICING, PAYMENT_CONFIG, PILOT_PRICING, formatPrice, type PackageId, type PilotId, type PriceValue } from '@/lib/pricingConfig'
import type { SubscriptionRecord } from '@/lib/billing'

export function PaymentInstructions({
  subscription,
  packageId,
  pilotIds,
  total,
  userReference,
  onProofSent,
}: {
  subscription: SubscriptionRecord | null
  packageId?: PackageId
  pilotIds: PilotId[]
  total: PriceValue
  userReference: string
  onProofSent: () => void
}) {
  if (!subscription) return null

  const label = packageId
    ? PACKAGE_PRICING[packageId]?.name ?? 'Paket'
    : pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ')
  const priceText = total === 'request' ? 'Preis auf Anfrage' : `${total} €`
  const whatsappText = `Hallo, ich habe ${label} für ${priceText} monatlich gebucht. Mein Verwendungszweck ist ${userReference}. Ich sende Ihnen hiermit meinen Zahlungsbeleg.`
  const whatsappHref = `https://wa.me/${PAYMENT_CONFIG.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`

  return (
    <div className="pk-card" style={{ border: '1px solid rgba(37,211,102,.22)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 900 }}>💳 Zahlungsinformationen</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <Info label="Kontoinhaber" value={PAYMENT_CONFIG.accountHolder} />
        <Info label="IBAN" value={PAYMENT_CONFIG.iban} />
        <Info label="Verwendungszweck" value={`${userReference} · ${label}`} />
        <Info label="Monatlicher Betrag" value={formatPrice(total)} />
      </div>
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', color: '#fbbf24', fontSize: 13, lineHeight: 1.5 }}>
        Nach Prüfung des Zahlungsbelegs schalten wir Ihr Paket schnellstmöglich frei.
      </div>
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="pk-btn" onClick={onProofSent} style={{ display: 'inline-flex', marginTop: 14, fontWeight: 850, textDecoration: 'none' }}>
        Zahlungsbeleg per WhatsApp senden
      </a>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize: 11, color: '#7f8ea3', fontWeight: 800, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 750, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

