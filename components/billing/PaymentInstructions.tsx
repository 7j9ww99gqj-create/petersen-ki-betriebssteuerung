import { useEffect, useState } from 'react'
import { PACKAGE_PRICING, PILOT_PRICING, formatPrice, type PackageId, type PilotId, type PriceValue } from '@/lib/pricingConfig'
import type { SubscriptionRecord } from '@/lib/billing'
import { getLatestBueroRechnungBySubscriptionId, type FirmaEinstellungen } from '@/lib/db'

type PaymentLinkState = {
  invoiceId?: string
  invoiceNumber?: string
  linkStatus?: string
  url?: string
  fallbackIban?: string
  fallbackLabel?: string
  internalReference?: string
  mode: 'idle' | 'loading' | 'ready' | 'fallback' | 'error'
  message?: string
}

export function PaymentInstructions({
  isDemo,
  subscription,
  packageId,
  pilotIds,
  total,
  userReference,
  onProofSent,
}: {
  isDemo: boolean
  subscription: SubscriptionRecord | null
  packageId?: PackageId
  pilotIds: PilotId[]
  total: PriceValue
  userReference: string
  onProofSent: () => void
}) {
  const [company, setCompany] = useState<Pick<FirmaEinstellungen, 'bankname' | 'iban' | 'bic' | 'telefon'> | null>(null)
  const [paymentLink, setPaymentLink] = useState<PaymentLinkState>({ mode: 'idle' })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('pk_firma_einstellungen')
      if (!raw) return
      const parsed = JSON.parse(raw) as FirmaEinstellungen
      setCompany({
        bankname: parsed.bankname,
        iban: parsed.iban,
        bic: parsed.bic,
        telefon: parsed.telefon,
      })
    } catch {
      // lokale Firmendaten ignorieren, falls defekt
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadPaymentLink() {
      if (!subscription?.id || isDemo) {
        if (active) setPaymentLink({ mode: 'idle' })
        return
      }

      try {
        if (active) setPaymentLink({ mode: 'loading' })
        const invoice = await getLatestBueroRechnungBySubscriptionId(subscription.id)

        const response = await fetch('/api/billing/stripe-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice ? { invoiceId: invoice.id } : { subscriptionId: subscription.id }),
        })
        const data = await response.json() as {
          error?: string
          status?: 'configured' | 'missing_config'
          url?: string
          paymentLinkId?: string
          linkStatus?: string
          fallbackIban?: string
          fallbackLabel?: string
          internalReference?: string
          invoiceNumber?: string
        }

        if (!response.ok) {
          throw new Error(data.error || 'Stripe-Checkout konnte nicht geladen werden.')
        }

        if (!active) return
        setPaymentLink({
          invoiceId: invoice?.id,
          invoiceNumber: data.invoiceNumber || invoice?.nummer || invoice?.id,
          linkStatus: data.linkStatus,
          url: data.url,
          fallbackIban: data.fallbackIban,
          fallbackLabel: data.fallbackLabel,
          internalReference: data.internalReference,
          mode: data.status === 'missing_config' ? 'fallback' : 'ready',
          message: data.status === 'missing_config'
            ? 'Stripe ist noch nicht final konfiguriert. Der sichere IBAN-Fallback bleibt aktiv.'
            : 'Stripe-Checkout wurde automatisch aus der echten Rechnung erzeugt.',
        })
      } catch (error) {
        if (!active) return
        setPaymentLink({
          mode: 'error',
          message: error instanceof Error ? error.message : 'Stripe-Checkout konnte nicht geladen werden.',
        })
      }
    }

    loadPaymentLink()
    return () => { active = false }
  }, [isDemo, subscription?.id])

  if (!subscription) return null

  const label = packageId
    ? PACKAGE_PRICING[packageId]?.name ?? 'Paket'
    : pilotIds.map(id => PILOT_PRICING[id]?.name).filter(Boolean).join(', ')
  const priceText = total === 'request' ? 'Preis auf Anfrage' : `${total} €`
  const whatsappNumber = company?.telefon || ''
  const whatsappText = `Hallo, ich habe ${label} für ${priceText} monatlich gebucht. Mein Verwendungszweck ist ${userReference}. Ich sende Ihnen hiermit meinen Zahlungsbeleg.`
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`
    : ''

  return (
    <div className="pk-card" style={{ border: '1px solid rgba(37,211,102,.22)' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 900 }}>💳 Zahlungsinformationen</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <Info label="Bank" value={company?.bankname || 'In Firmendaten hinterlegen'} />
        <Info label="IBAN" value={paymentLink.fallbackIban || company?.iban || 'In Firmendaten hinterlegen'} />
        <Info label="Verwendungszweck" value={`${userReference} · ${label}`} />
        <Info label="Monatlicher Betrag" value={formatPrice(total)} />
      </div>
      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 12,
        background: paymentLink.mode === 'ready' ? 'rgba(16,185,129,.08)' : paymentLink.mode === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)',
        border: paymentLink.mode === 'ready' ? '1px solid rgba(16,185,129,.22)' : paymentLink.mode === 'error' ? '1px solid rgba(239,68,68,.22)' : '1px solid rgba(245,158,11,.22)',
        color: paymentLink.mode === 'ready' ? '#86efac' : paymentLink.mode === 'error' ? '#fca5a5' : '#fbbf24',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 800, marginBottom: paymentLink.invoiceNumber ? 6 : 0 }}>
          {paymentLink.mode === 'loading' ? 'Stripe-Checkout wird vorbereitet…' : paymentLink.message || 'Zahlungslink wird vorbereitet.'}
        </div>
        {paymentLink.invoiceNumber && (
          <div style={{ color: '#dbe4ef' }}>
            Rechnung {paymentLink.invoiceNumber}
            {paymentLink.linkStatus ? ` · Status ${paymentLink.linkStatus}` : ''}
            {paymentLink.internalReference ? ` · Ref ${paymentLink.internalReference}` : ''}
          </div>
        )}
      </div>
      {paymentLink.url && (
        <a
          href={paymentLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pk-btn"
          style={{ display: 'inline-flex', marginTop: 14, fontWeight: 850, textDecoration: 'none', justifyContent: 'center' }}
        >
          Stripe-Checkout öffnen
        </a>
      )}
      {whatsappHref ? (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={paymentLink.url ? 'pk-btn-ghost' : 'pk-btn'} onClick={onProofSent} style={{ display: 'inline-flex', marginTop: 14, fontWeight: 850, textDecoration: 'none' }}>
          Zahlungsbeleg per WhatsApp senden
        </a>
      ) : (
        <button className="pk-btn-ghost" disabled style={{ display: 'inline-flex', marginTop: 14, fontWeight: 850 }}>
          WhatsApp-Nummer in Firmendaten hinterlegen
        </button>
      )}
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
