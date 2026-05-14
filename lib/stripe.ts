import 'server-only'

import Stripe from 'stripe'

export type StripeLinkState = 'not_requested' | 'pending' | 'ready' | 'processing' | 'paid' | 'expired' | 'cancelled' | 'missing_config' | 'failed'
export type InternalPaymentState = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'cancelled'

export type StripeInvoiceCheckoutInput = {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  amountCents: number
  currency?: string
  internalReference: string
  successUrl: string
  cancelUrl: string
}

export type StripeCheckoutResult = {
  provider: 'stripe'
  status: 'configured' | 'missing_config'
  paymentLinkId?: string
  url?: string
  linkStatus?: StripeLinkState
  fallbackIban?: string
  fallbackLabel: string
  internalReference: string
  createdAt?: string
}

function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    fallbackIban: process.env.STRIPE_FALLBACK_IBAN || '',
  }
}

function getStripeClient() {
  const { secretKey } = getStripeConfig()
  if (!secretKey) {
    throw new Error('Stripe ist serverseitig nicht konfiguriert.')
  }
  return new Stripe(secretKey)
}

export function buildStripeInvoiceReference(input: { invoiceId: string; invoiceNumber: string; amountCents: number }) {
  const compactId = input.invoiceId.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || 'invoice'
  return `PK-${input.invoiceNumber}-${compactId}-${input.amountCents}`
}

export function isStripeConfigured() {
  const { secretKey } = getStripeConfig()
  return Boolean(secretKey)
}

export function isStripeWebhookConfigured() {
  const { webhookSecret } = getStripeConfig()
  return Boolean(webhookSecret && isStripeConfigured())
}

export function mapStripeSessionStatus(status?: string, paymentStatus?: string): StripeLinkState {
  if (paymentStatus === 'paid' || paymentStatus === 'no_payment_required') return 'paid'
  switch ((status ?? '').toLowerCase()) {
    case 'complete':
      return paymentStatus === 'unpaid' ? 'processing' : 'paid'
    case 'expired':
      return 'expired'
    case 'open':
      return 'ready'
    default:
      return 'pending'
  }
}

export function mapStripeCheckoutToInternal(input: { status?: string; paymentStatus?: string; eventType?: string | null }) {
  if (input.eventType === 'checkout.session.async_payment_failed') {
    return { paymentStatus: 'failed', invoiceStatus: 'Offen' as const, linkStatus: 'failed' as StripeLinkState, severity: 'error' as const }
  }
  if (input.paymentStatus === 'paid' || input.paymentStatus === 'no_payment_required' || input.eventType === 'checkout.session.async_payment_succeeded') {
    return { paymentStatus: 'paid', invoiceStatus: 'Bezahlt' as const, linkStatus: 'paid' as StripeLinkState, severity: 'success' as const }
  }
  if ((input.status ?? '').toLowerCase() === 'expired') {
    return { paymentStatus: 'failed', invoiceStatus: 'Überfällig' as const, linkStatus: 'expired' as StripeLinkState, severity: 'warn' as const }
  }
  if ((input.status ?? '').toLowerCase() === 'complete') {
    return { paymentStatus: 'authorized', invoiceStatus: 'Offen' as const, linkStatus: 'processing' as StripeLinkState, severity: 'info' as const }
  }
  return { paymentStatus: 'pending', invoiceStatus: 'Offen' as const, linkStatus: mapStripeSessionStatus(input.status, input.paymentStatus), severity: 'info' as const }
}

export async function createStripeInvoiceCheckoutSession(input: StripeInvoiceCheckoutInput): Promise<StripeCheckoutResult> {
  const cfg = getStripeConfig()
  const fallbackLabel = `Stripe-Zahlung fuer Rechnung ${input.invoiceNumber}`

  if (!cfg.secretKey) {
    return {
      provider: 'stripe',
      status: 'missing_config',
      fallbackIban: cfg.fallbackIban || undefined,
      fallbackLabel,
      internalReference: input.internalReference,
    }
  }

  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.internalReference,
    customer_email: input.customerEmail,
    metadata: {
      invoice_id: input.invoiceId,
      invoice_number: input.invoiceNumber,
      internal_reference: input.internalReference,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (input.currency ?? 'eur').toLowerCase(),
          unit_amount: input.amountCents,
          product_data: {
            name: `Rechnung ${input.invoiceNumber}`,
            description: `Petersen KI · ${input.customerName}`,
          },
        },
      },
    ],
  })

  return {
    provider: 'stripe',
    status: 'configured',
    paymentLinkId: session.id,
    url: session.url ?? undefined,
    linkStatus: mapStripeSessionStatus(session.status ?? undefined, session.payment_status ?? undefined),
    fallbackIban: cfg.fallbackIban || undefined,
    fallbackLabel,
    internalReference: input.internalReference,
    createdAt: session.created ? new Date(session.created * 1000).toISOString() : undefined,
  }
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  const stripe = getStripeClient()
  return stripe.checkout.sessions.retrieve(sessionId)
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const { webhookSecret } = getStripeConfig()
  if (!webhookSecret || !signatureHeader) return null
  const stripe = getStripeClient()
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)
}
