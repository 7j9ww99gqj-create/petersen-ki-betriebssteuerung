import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRouteAccess } from '@/lib/server-auth'

export const runtime = 'nodejs'

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'

function isOwner(email: string | null | undefined) {
  return !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase()
}

function serviceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req, ['Admin'])
  if (access.error) return access.error
  if (!isOwner(access.user?.email)) {
    return NextResponse.json({ error: 'Nur für den Inhaber-Account.' }, { status: 403 })
  }

  const client = serviceClient()
  if (!client) return NextResponse.json({ error: 'DB nicht erreichbar' }, { status: 500 })

  const now = new Date()
  const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  try {
    // Alle Abos
    const { data: subs } = await client
      .from('billing_subscriptions')
      .select('id,status,monthly_price_eur,created_at,cancelled_at,user_id')

    const allSubs = subs ?? []
    const active = allSubs.filter(s => s.status === 'active')
    const mrr = active.reduce((sum, s) => sum + (Number(s.monthly_price_eur) || 0), 0)

    const newThisMonth = allSubs.filter(s =>
      s.created_at >= startOfMonth && (s.status === 'active' || s.status === 'pending_payment')
    ).length

    const churnedThisMonth = allSubs.filter(s =>
      s.status === 'cancelled' && s.cancelled_at && s.cancelled_at >= startOfMonth
    ).length

    // Aktive User: hatten KI-Anfragen in den letzten 30 Tagen
    const { data: usageData } = await client
      .from('ai_usage')
      .select('user_id')
      .gte('created_at', startOf30d)

    const activeUsers30d = new Set((usageData ?? []).map(r => r.user_id)).size

    // Gesamtumsatz aus Rechnungen mit Status 'Bezahlt'
    const { data: rechnungen } = await client
      .from('buero_rechnungen')
      .select('betrag')
      .eq('status', 'Bezahlt')

    const totalRevenue = (rechnungen ?? []).reduce((sum, r) => {
      const n = parseFloat(String(r.betrag ?? '0').replace(',', '.').replace(/[^\d.]/g, ''))
      return sum + (isNaN(n) ? 0 : n)
    }, 0)

    return NextResponse.json({
      activeSubscriptions: active.length,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      churnedThisMonth,
      newThisMonth,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      activeUsers30d,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
