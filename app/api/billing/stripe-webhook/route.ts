import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase-admin'
import { isStripeWebhookConfigured, verifyStripeWebhookSignature } from '@/lib/stripe'
import { syncStripeInvoiceState } from '@/lib/stripe-sync'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!isStripeWebhookConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ ok: true, ignored: 'webhook_not_configured' }, { status: 202 })
  }

  const signatureHeader = req.headers.get('stripe-signature')
  let event
  try {
    event = verifyStripeWebhookSignature(rawBody, signatureHeader)
  } catch {
    return NextResponse.json({ error: 'Ungueltige Stripe-Signatur.' }, { status: 401 })
  }
  if (!event) {
    return NextResponse.json({ error: 'Stripe-Webhook konnte nicht verifiziert werden.' }, { status: 401 })
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type)) {
    return NextResponse.json({ ok: true, ignored: event.type }, { status: 202 })
  }

  const session = event.data.object
  if (!session || session.object !== 'checkout.session') {
    return NextResponse.json({ ok: true, ignored: 'not_checkout_session' }, { status: 202 })
  }

  const invoiceId = session.metadata?.invoice_id
  const invoiceNumber = session.metadata?.invoice_number
  const sessionId = session.id
  if (!invoiceId && !invoiceNumber && !sessionId) {
    return NextResponse.json({ ok: true, ignored: 'no_invoice_locator' }, { status: 202 })
  }

  const admin = createSupabaseAdminClient()
  let query = admin
    .from('buero_rechnungen')
    .select('id, nummer, status, summe, kunde, billing_subscription_id, payment_link_id, payment_link_status, payment_link_reference, bezahlt_am')

  if (invoiceId) {
    query = query.eq('id', invoiceId)
  } else if (sessionId) {
    query = query.eq('payment_link_id', sessionId)
  } else if (invoiceNumber) {
    query = query.eq('nummer', invoiceNumber)
  }

  const invoiceResult = await query.limit(1).maybeSingle()
  if (invoiceResult.error) return NextResponse.json({ error: invoiceResult.error.message }, { status: 500 })
  if (!invoiceResult.data) return NextResponse.json({ ok: true, ignored: 'invoice_not_found' }, { status: 202 })

  const result = await syncStripeInvoiceState({
    supabase: admin,
    invoice: invoiceResult.data as never,
    source: 'webhook',
    session,
    eventType: event.type,
  })

  return NextResponse.json({ ok: true, result })
}
