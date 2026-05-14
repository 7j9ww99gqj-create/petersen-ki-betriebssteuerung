import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

import { genId } from './ids'
import { mapStripeCheckoutToInternal, mapStripeSessionStatus, retrieveStripeCheckoutSession } from './stripe'

export type InvoiceSyncRow = {
  id: string
  nummer?: string | null
  status?: string | null
  summe?: number | null
  kunde?: string | null
  billing_subscription_id?: string | null
  payment_link_id?: string | null
  payment_link_status?: string | null
  payment_link_reference?: string | null
  bezahlt_am?: string | null
}

export async function syncStripeInvoiceState(input: {
  supabase: SupabaseClient
  invoice: InvoiceSyncRow
  source: 'webhook' | 'polling'
  session?: Stripe.Checkout.Session
  eventType?: string | null
}) {
  const sessionId = input.session?.id ?? input.invoice.payment_link_id ?? ''
  if (!sessionId) {
    return { invoiceId: input.invoice.id, updated: false, reason: 'missing_payment_link' as const }
  }

  const session = input.session ?? await retrieveStripeCheckoutSession(sessionId)
  const mapped = mapStripeCheckoutToInternal({
    status: session.status ?? undefined,
    paymentStatus: session.payment_status ?? undefined,
    eventType: input.eventType,
  })
  const nextLinkStatus = mapStripeSessionStatus(session.status ?? undefined, session.payment_status ?? undefined)
  const previousStatus = input.invoice.status ?? 'Offen'
  const statusChanged = previousStatus !== mapped.invoiceStatus || input.invoice.payment_link_status !== nextLinkStatus
  const paidAt = session.payment_status === 'paid' && session.created ? new Date(session.created * 1000).toISOString() : undefined

  await input.supabase
    .from('buero_rechnungen')
    .update({
      status: mapped.invoiceStatus,
      bezahlt_am: mapped.paymentStatus === 'paid' ? paidAt ?? input.invoice.bezahlt_am ?? new Date().toISOString().slice(0, 10) : null,
      payment_provider: 'stripe',
      provider_ref: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
      payment_link_id: session.id,
      payment_link_url: session.url ?? null,
      payment_link_status: nextLinkStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.invoice.id)

  const existingPaymentResult = await input.supabase
    .from('billing_payments')
    .select('*')
    .eq('invoice_id', input.invoice.id)
    .eq('provider', 'stripe')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const existingPayment = existingPaymentResult.data as { id?: string } | null

  const amount = typeof session.amount_total === 'number' ? session.amount_total / 100 : Number(input.invoice.summe ?? 0)
  const paymentPayload = {
    id: existingPayment?.id ?? genId('PAY'),
    invoice_id: input.invoice.id,
    billing_subscription_id: input.invoice.billing_subscription_id ?? null,
    provider: 'stripe',
    provider_ref: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
    method: session.payment_method_types?.[0] ?? 'checkout',
    status: mapped.paymentStatus,
    amount,
    currency: (session.currency ?? 'eur').toUpperCase(),
    booked_at: paidAt ?? null,
    last_synced_at: new Date().toISOString(),
    status_source: input.source,
    external_reference: input.invoice.payment_link_reference ?? session.client_reference_id ?? null,
    provider_event_id: input.eventType ?? null,
    failure_reason: mapped.paymentStatus === 'failed' ? `Stripe-Status: ${session.status ?? 'unknown'}/${session.payment_status ?? 'unknown'}` : null,
    metadata: {
      checkout_session_id: session.id,
      checkout_status: session.status ?? null,
      payment_status: session.payment_status ?? null,
    },
    updated_at: new Date().toISOString(),
  }

  if (existingPayment?.id) {
    await input.supabase.from('billing_payments').update(paymentPayload).eq('id', existingPayment.id)
  } else {
    await input.supabase.from('billing_payments').insert(paymentPayload)
  }

  await input.supabase.from('audit_logs').insert({
    id: genId('AUD'),
    action: 'stripe.payment.sync',
    target_type: 'buero_rechnung',
    target_id: input.invoice.id,
    payload: {
      invoice_id: input.invoice.id,
      checkout_session_id: session.id,
      source: input.source,
      status: mapped.paymentStatus,
      checkout_status: session.status ?? null,
      payment_status: session.payment_status ?? null,
    },
  })

  if (statusChanged || mapped.paymentStatus === 'failed') {
    await input.supabase.rpc('pk_register_owner_event', {
      p_source: 'stripe',
      p_event_type: mapped.paymentStatus === 'paid' ? 'payment.paid' : mapped.paymentStatus === 'failed' ? 'payment.failed' : 'payment.updated',
      p_severity: mapped.severity,
      p_entity_type: 'buero_rechnung',
      p_entity_id: input.invoice.id,
      p_dedupe_key: `stripe:${input.invoice.id}:${mapped.paymentStatus}:${session.id}:${input.eventType ?? nextLinkStatus}`,
      p_title: mapped.paymentStatus === 'paid' ? 'Stripe-Zahlung eingegangen' : mapped.paymentStatus === 'failed' ? 'Stripe-Zahlung fehlgeschlagen' : 'Stripe-Zahlung aktualisiert',
      p_message: `${input.invoice.nummer ?? input.invoice.id}: Status ${mapped.paymentStatus}.`,
      p_link_url: '/dashboard/einstellungen',
      p_payload: {
        invoice_id: input.invoice.id,
        invoice_number: input.invoice.nummer,
        checkout_session_id: session.id,
        checkout_status: session.status ?? null,
        payment_status: session.payment_status ?? null,
        source: input.source,
      },
    })
  }

  return {
    invoiceId: input.invoice.id,
    updated: true,
    paymentStatus: mapped.paymentStatus,
    invoiceStatus: mapped.invoiceStatus,
    paymentLinkStatus: nextLinkStatus,
  }
}
