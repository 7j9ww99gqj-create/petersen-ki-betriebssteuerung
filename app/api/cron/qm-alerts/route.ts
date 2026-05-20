/**
 * GET /api/cron/qm-alerts
 * Vercel Cron: täglich 07:00 Uhr
 * Prüft: qm_zeichnungen der letzten 24h ohne verknüpften qm_pruefbericht
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push.server'

function adminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminSupabase()

  // Early return wenn keine Subscriptions
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) {
    return NextResponse.json({ ok: true, alerts: 0, ts: new Date().toISOString() })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Zeichnungen der letzten 24h ohne Prüfbericht
  const { data: zeichnungen } = await supabase
    .from('qm_zeichnungen')
    .select('id, user_id, name')
    .gte('erstellt_am', since)

  if (!zeichnungen?.length) {
    return NextResponse.json({ ok: true, alerts: 0, ts: new Date().toISOString() })
  }

  // Welche davon haben bereits einen Prüfbericht?
  const ids = zeichnungen.map(z => z.id)
  const { data: berichte } = await supabase
    .from('qm_pruefberichte')
    .select('zeichnung_id')
    .in('zeichnung_id', ids)

  const gepruefteIds = new Set((berichte ?? []).map(b => b.zeichnung_id).filter(Boolean))
  const ungeprueft = zeichnungen.filter(z => !gepruefteIds.has(z.id))

  if (!ungeprueft.length) {
    return NextResponse.json({ ok: true, alerts: 0, ts: new Date().toISOString() })
  }

  // Pro User: offene Zeichnungen zählen und Push senden
  const perUser = new Map<string, number>()
  for (const z of ungeprueft) {
    perUser.set(z.user_id, (perUser.get(z.user_id) ?? 0) + 1)
  }

  let sent = 0
  for (const [userId, count] of Array.from(perUser.entries())) {
    const userSubs = subs.filter((s: { user_id?: string }) => s.user_id === userId)
    for (const sub of userSubs) {
      const result = await sendPushNotification(
        sub.endpoint,
        { p256dh: sub.p256dh, auth: sub.auth_key },
        {
          title: 'QM-Pilot: Zeichnung wartet',
          body: `${count} Bauteil${count !== 1 ? 'e' : ''} noch nicht geprüft`,
          url: '/dashboard/qm',
        }
      )
      if (result.success) sent++
    }
  }

  return NextResponse.json({ ok: true, alerts: ungeprueft.length, notificationsSent: sent, ts: new Date().toISOString() })
}
