import { NextRequest, NextResponse } from 'next/server'

import { getRouteAccess } from '@/lib/server-auth'
import { createStripeInvoiceCheckoutSession, buildStripeInvoiceReference } from '@/lib/stripe'
import { genId } from '@/lib/ids'
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.isDemo || !access.supabase || !access.user) {
    return NextResponse.json({ error: 'Stripe-Checkout ist im Demo-Modus nicht verfuegbar.' }, { status: 400 })
  }

  const body = await req.json().catch(() => null) as { invoiceId?: string; subscriptionId?: string } | null
  let invoiceId = body?.invoiceId?.trim()

  // Kein Invoice vorhanden – direkt mit Server-Client anlegen
  if (!invoiceId && body?.subscriptionId) {
    const subResult = await access.supabase
      .from('billing_subscriptions')
      .select('*')
      .eq('id', body.subscriptionId)
      .maybeSingle()
    if (subResult.error) return NextResponse.json({ error: subResult.error.message }, { status: 500 })
    if (!subResult.data) return NextResponse.json({ error: 'Abo nicht gefunden.' }, { status: 404 })

    const sub = subResult.data as Record<string, unknown>
    const monthlyPrice = Number(sub.monthly_price ?? 0)
    const taxRate = 19
    const netto = Math.round((monthlyPrice / (1 + taxRate / 100)) * 100) / 100
    const steuer = Math.round((monthlyPrice - netto) * 100) / 100

    // Rechnungsnummer aus DB-Sequenz
    const numResult = await access.supabase.rpc('pk_next_invoice_number')
    const nummer = numResult.data ?? `RE-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-5)}`

    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + 14)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const newInvoiceId = genId('RE')
    const insertResult = await access.supabase.from('buero_rechnungen').insert({
      id: newInvoiceId,
      billing_subscription_id: sub.id,
      kunde: sub.user_email ?? sub.user_key ?? 'Kunde',
      nummer,
      rechnungstyp: 'subscription',
      betrag: `${monthlyPrice.toFixed(2)} €`,
      summe: monthlyPrice,
      netto,
      steuer_satz: taxRate,
      steuerbetrag: steuer,
      auto_generated: true,
      faellig: fmt(due),
      erstellt: fmt(now),
      status: 'Offen',
    })
    if (insertResult.error) return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
    invoiceId = newInvoiceId

    // Owner-Auftrag anlegen wenn Kunde bucht (kein automatischer Versand)
    if (isSupabaseAdminConfigured()) {
      try {
        const adminCl = createSupabaseAdminClient()
        const ownerLookup = await adminCl.auth.admin.listUsers({ page: 1, perPage: 200 })
        const ownerUserId = ownerLookup.data?.users.find(
          (u: { email?: string; id: string }) => u.email?.toLowerCase() === 'info@petersen-ki-pilot.de'
        )?.id
        if (ownerUserId) {
          const orderId = `AUF-${String(sub.id ?? newInvoiceId)}`
          const pilotSummary = Array.isArray(sub.pilot_ids) ? (sub.pilot_ids as string[]).join(', ') : ''
          const buchungLabel = String(sub.package_id ?? (pilotSummary || 'Module'))
          await adminCl.from('buero_auftraege').upsert({
            id: orderId,
            user_id: ownerUserId,
            billing_subscription_id: String(sub.id ?? ''),
            kunde: String(sub.user_email ?? sub.user_key ?? 'Kunde'),
            beschreibung: `Abo-Buchung ${buchungLabel}`,
            wert: `${Number(sub.monthly_price ?? 0).toFixed(2)} € / Monat`,
            start: new Date().toISOString().slice(0, 10),
            status: 'Geplant',
            fortschritt: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
        }
      } catch {
        // Owner-Auftrag-Fehler soll Buchung nicht blockieren
      }
    }
  }

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId oder subscriptionId fehlt.' }, { status: 400 })
  }

  const invoiceResult = await access.supabase.from('buero_rechnungen').select('*').eq('id', invoiceId).maybeSingle()
  if (invoiceResult.error) return NextResponse.json({ error: invoiceResult.error.message }, { status: 500 })
  if (!invoiceResult.data) return NextResponse.json({ error: 'Rechnung nicht gefunden.' }, { status: 404 })

  const invoice = invoiceResult.data as {
    id: string
    nummer?: string | null
    kunde?: string | null
    summe?: number | null
    payment_link_id?: string | null
    payment_link_url?: string | null
    payment_link_reference?: string | null
    payment_link_status?: string | null
    billing_subscription_id?: string | null
  }
  const amountCents = Math.round(Number(invoice.summe ?? 0) * 100)
  const internalReference = buildStripeInvoiceReference({
    invoiceId: invoice.id,
    invoiceNumber: invoice.nummer ?? invoice.id,
    amountCents,
  })

  if (
    invoice.payment_link_id
    && invoice.payment_link_url
    && invoice.payment_link_reference === internalReference
    && ['ready', 'processing', 'paid'].includes(invoice.payment_link_status ?? '')
  ) {
    return NextResponse.json({
      provider: 'stripe',
      status: 'configured',
      paymentLinkId: invoice.payment_link_id,
      url: invoice.payment_link_url,
      linkStatus: invoice.payment_link_status,
      internalReference,
      invoiceNumber: invoice.nummer ?? invoice.id,
    })
  }

  const origin = req.nextUrl.origin
  try {
    const result = await createStripeInvoiceCheckoutSession({
      invoiceId: invoice.id,
      invoiceNumber: invoice.nummer ?? invoice.id,
      customerName: invoice.kunde ?? 'Kunde',
      amountCents,
      internalReference,
      successUrl: `${origin}/dashboard/einstellungen?section=billing&payment=success&invoice=${encodeURIComponent(invoice.id)}`,
      cancelUrl: `${origin}/dashboard/einstellungen?section=billing&payment=cancelled&invoice=${encodeURIComponent(invoice.id)}`,
    })

    const now = new Date().toISOString()
    const invoiceUpdate = {
      payment_provider: 'stripe',
      provider_ref: result.paymentLinkId ?? internalReference,
      payment_link_id: result.paymentLinkId ?? null,
      payment_link_url: result.url ?? null,
      payment_link_reference: internalReference,
      payment_link_status: result.status === 'missing_config' ? 'missing_config' : result.linkStatus ?? 'ready',
      payment_link_created_at: result.createdAt ?? now,
      payment_link_error: null,
      updated_at: now,
    }
    const invoiceSave = await access.supabase.from('buero_rechnungen').update(invoiceUpdate).eq('id', invoice.id)
    if (invoiceSave.error) return NextResponse.json({ error: invoiceSave.error.message }, { status: 500 })

    const existingPaymentResult = await access.supabase
      .from('billing_payments')
      .select('*')
      .eq('invoice_id', invoice.id)
      .eq('provider', 'stripe')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const existingPayment = existingPaymentResult.data as { id?: string } | null

    const paymentPayload = {
      id: existingPayment?.id ?? genId('PAY'),
      invoice_id: invoice.id,
      billing_subscription_id: invoice.billing_subscription_id ?? null,
      provider: 'stripe',
      provider_ref: result.paymentLinkId ?? internalReference,
      method: 'checkout',
      status: 'pending',
      amount: Number(invoice.summe ?? 0),
      currency: 'EUR',
      last_synced_at: now,
      status_source: 'payment_link',
      external_reference: internalReference,
      failure_reason: null,
      metadata: {
        checkout_session_id: result.paymentLinkId ?? null,
        checkout_url: result.url ?? null,
        checkout_status: result.status === 'missing_config' ? 'missing_config' : result.linkStatus ?? 'ready',
        invoice_number: invoice.nummer ?? invoice.id,
      },
      updated_at: now,
    }

    const paymentSave = existingPayment?.id
      ? await access.supabase.from('billing_payments').update(paymentPayload).eq('id', existingPayment.id)
      : await access.supabase.from('billing_payments').insert(paymentPayload)
    if (paymentSave.error) return NextResponse.json({ error: paymentSave.error.message }, { status: 500 })

    await access.supabase.from('audit_logs').insert({
      id: genId('AUD'),
      action: result.status === 'missing_config' ? 'stripe.checkout.fallback' : 'stripe.checkout.created',
      target_type: 'buero_rechnung',
      target_id: invoice.id,
      payload: {
        invoice_id: invoice.id,
        invoice_number: invoice.nummer ?? invoice.id,
        checkout_session_id: result.paymentLinkId ?? null,
        internal_reference: internalReference,
        status: result.status,
      },
    })

    if (result.status === 'missing_config') {
      await access.supabase.rpc('pk_register_owner_event', {
        p_source: 'stripe',
        p_event_type: 'payment.link.missing_config',
        p_severity: 'warn',
        p_entity_type: 'buero_rechnung',
        p_entity_id: invoice.id,
        p_dedupe_key: `stripe:${invoice.id}:missing-config`,
        p_title: 'Stripe-Fallback aktiv',
        p_message: `${invoice.nummer ?? invoice.id} nutzt mangels Stripe-Konfiguration weiter den sicheren IBAN-Fallback.`,
        p_link_url: '/dashboard/einstellungen',
        p_payload: {
          invoice_id: invoice.id,
          invoice_number: invoice.nummer ?? invoice.id,
          internal_reference: internalReference,
        },
      })
    }

    return NextResponse.json({
      ...result,
      invoiceNumber: invoice.nummer ?? invoice.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe-Checkout konnte nicht erstellt werden.'
    await access.supabase
      .from('buero_rechnungen')
      .update({
        payment_provider: 'stripe',
        payment_link_reference: internalReference,
        payment_link_status: 'failed',
        payment_link_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
    await access.supabase.rpc('pk_register_owner_event', {
      p_source: 'stripe',
      p_event_type: 'payment.link.failed',
      p_severity: 'error',
      p_entity_type: 'buero_rechnung',
      p_entity_id: invoice.id,
      p_dedupe_key: `stripe:${invoice.id}:link-failed:${internalReference}`,
      p_title: 'Stripe-Checkout fehlgeschlagen',
      p_message: `${invoice.nummer ?? invoice.id}: ${message}`,
      p_link_url: '/dashboard/einstellungen',
      p_payload: {
        invoice_id: invoice.id,
        invoice_number: invoice.nummer ?? invoice.id,
        internal_reference: internalReference,
      },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
