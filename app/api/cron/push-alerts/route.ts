/**
 * GET /api/cron/push-alerts
 * Vercel Cron: täglich 08:00 Uhr
 * Prüft: Mindestbestand, MHD-Ablauf, überfällige Rechnungen, Monatsbericht
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push.server'

function getAdminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createClient(url, key)
}

async function sendToAllUsers(
  supabase: ReturnType<typeof getAdminSupabase>,
  title: string,
  body: string,
  url?: string
) {
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return 0
  const results = await Promise.allSettled(
    subs.map(s => sendPushNotification(s.endpoint, { p256dh: s.p256dh, auth: s.auth_key }, { title, body, url }))
  )
  return results.filter(r => r.status === 'fulfilled' && (r.value as {success:boolean}).success).length
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminSupabase()
  const alerts: string[] = []
  const today = new Date()
  const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const in30days = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]

  // 1. Mindestbestand unterschritten
  const { data: artikel } = await supabase
    .from('lager_artikel')
    .select('name, bestand, mindestbestand')
    .filter('mindestbestand', 'gt', 0)

  const unterMindest = (artikel ?? []).filter((a: {bestand: number; mindestbestand: number}) => a.bestand < a.mindestbestand)
  if (unterMindest.length > 0) {
    const names = unterMindest.slice(0, 3).map((a: {name: string}) => a.name).join(', ')
    const msg = unterMindest.length === 1
      ? `${names} unter Mindestbestand`
      : `${unterMindest.length} Artikel unter Mindestbestand: ${names}${unterMindest.length > 3 ? ' …' : ''}`
    await sendToAllUsers(supabase, '📦 Lager: Mindestbestand', msg, '/dashboard/lager')
    alerts.push(`mindestbestand: ${unterMindest.length}`)
  }

  // 2. MHD läuft in 7 Tagen ab
  const { data: mhdKritisch } = await supabase
    .from('lager_stellplatz_bestand')
    .select('artikelname, mhd')
    .lte('mhd', in7days)
    .gte('mhd', today.toISOString().split('T')[0])

  if (mhdKritisch && mhdKritisch.length > 0) {
    const names = mhdKritisch.slice(0, 2).map((a: {artikelname: string}) => a.artikelname).join(', ')
    await sendToAllUsers(supabase, '⚠️ MHD läuft ab', `${mhdKritisch.length} Artikel ablaufen in 7 Tagen: ${names}`, '/dashboard/lager')
    alerts.push(`mhd_kritisch: ${mhdKritisch.length}`)
  }

  // 3. Überfällige Rechnungen (>14 Tage offen)
  const vor14tagen = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0]
  const { data: rechnungen } = await supabase
    .from('buero_rechnungen')
    .select('nummer, gesamtbetrag, datum')
    .eq('status', 'offen')
    .lte('datum', vor14tagen)

  if (rechnungen && rechnungen.length > 0) {
    const summe = rechnungen.reduce((s: number, r: {gesamtbetrag: number}) => s + (r.gesamtbetrag ?? 0), 0)
    await sendToAllUsers(supabase, '🧾 Offene Rechnungen', `${rechnungen.length} Rechnung${rechnungen.length > 1 ? 'en' : ''} seit >14 Tagen offen (${summe.toFixed(0)}€)`, '/dashboard/buero')
    alerts.push(`offene_rechnungen: ${rechnungen.length}`)
  }

  // 4. Monatsbericht (immer am 1. des Monats)
  if (today.getDate() === 1) {
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const monthName = prevMonth.toLocaleString('de', { month: 'long', year: 'numeric' })
    await sendToAllUsers(supabase, '📊 Monatsbericht bereit', `Auswertung für ${monthName} ist verfügbar`, '/dashboard/analyse')
    alerts.push('monatsbericht')
  }

  // 5. MHD bereits abgelaufen
  const { data: mhdAbgelaufen } = await supabase
    .from('lager_stellplatz_bestand')
    .select('artikelname, mhd')
    .lt('mhd', today.toISOString().split('T')[0])

  if (mhdAbgelaufen && mhdAbgelaufen.length > 0) {
    await sendToAllUsers(supabase, '🔴 MHD abgelaufen', `${mhdAbgelaufen.length} Artikel mit abgelaufenem MHD im Lager!`, '/dashboard/lager')
    alerts.push(`mhd_abgelaufen: ${mhdAbgelaufen.length}`)
  }

  return NextResponse.json({ ok: true, alerts, ts: new Date().toISOString() })
}
