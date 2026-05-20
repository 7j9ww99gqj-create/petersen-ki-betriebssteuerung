'use client'
import { useEffect, useState } from 'react'
import { PricingSettingsPage } from '@/components/billing/PricingSettingsPage'

/**
 * BillingTab — Stripe-Callback-Banner + Pricing/Subscription-Steuerung.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 3b).
 *
 * Liest `?payment=success|cancelled` + `?invoice=…` aus der URL, zeigt einen
 * Banner und räumt die Params aus der Adresszeile auf. Die Section-Umschaltung
 * (Stripe-Callback landet immer auf `billing`) bleibt in der Page.
 */
export default function BillingTab({
  isDemo,
  showToast,
}: {
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [paymentBanner, setPaymentBanner] = useState<
    { type: 'success' | 'cancelled'; invoiceId?: string } | null
  >(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const invoice = params.get('invoice')
    if (payment === 'success' || payment === 'cancelled') {
      setPaymentBanner({ type: payment, invoiceId: invoice || undefined })
      // URL-Cleanup: payment + invoice raus, andere Params bleiben.
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('invoice')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  return (
    <>
      {paymentBanner && (
        <div
          style={{
            marginBottom: 14,
            padding: '14px 18px',
            borderRadius: 14,
            background:
              paymentBanner.type === 'success' ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)',
            border: `1px solid ${
              paymentBanner.type === 'success' ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'
            }`,
            color: paymentBanner.type === 'success' ? '#86efac' : '#fbbf24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {paymentBanner.type === 'success'
                ? '✅ Zahlung erfolgreich eingegangen'
                : '⚠️ Checkout abgebrochen'}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
              {paymentBanner.type === 'success'
                ? 'Ihre Stripe-Zahlung wurde registriert. Der Inhaber prüft und schaltet Sie schnellstmöglich frei.'
                : 'Der Checkout-Vorgang wurde abgebrochen. Sie können die Zahlung unten jederzeit erneut starten.'}
            </div>
          </div>
          <button
            onClick={() => setPaymentBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#aeb9c8',
              cursor: 'pointer',
              fontSize: 20,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <PricingSettingsPage isDemo={isDemo} showToast={showToast} />
    </>
  )
}
