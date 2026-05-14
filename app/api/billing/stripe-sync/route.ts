import { NextRequest, NextResponse } from 'next/server'

import { getRouteAccess } from '@/lib/server-auth'
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase-admin'
import { isStripeConfigured } from '@/lib/stripe'
import { syncStripeInvoiceState } from '@/lib/stripe-sync'

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req, ['Inhaber'])
  if (access.error) return access.error
  if (!isSupabaseAdminConfigured() || !isStripeConfigured()) {
    return NextResponse.json({ ok: false, reason: 'missing_server_config' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as { invoiceId?: string } | null
  const admin = createSupabaseAdminClient()
  const baseQuery = admin
    .from('buero_rechnungen')
    .select('id, nummer, status, summe, kunde, billing_subscription_id, payment_link_id, payment_link_status, payment_link_reference, bezahlt_am')

  const invoiceQuery = body?.invoiceId
    ? baseQuery.eq('id', body.invoiceId).limit(1)
    : baseQuery.eq('payment_provider', 'stripe').order('updated_at', { ascending: false }).limit(25)
  const invoicesResult = await invoiceQuery
  if (invoicesResult.error) return NextResponse.json({ error: invoicesResult.error.message }, { status: 500 })

  const invoices = (Array.isArray(invoicesResult.data) ? invoicesResult.data : invoicesResult.data ? [invoicesResult.data] : []) as Array<{
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
  }>

  const results = []
  for (const invoice of invoices) {
    results.push(await syncStripeInvoiceState({
      supabase: admin,
      invoice,
      source: 'polling',
    }))
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
