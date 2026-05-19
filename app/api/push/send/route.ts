/**
 * POST /api/push/send – Push-Benachrichtigung senden (Admin/Inhaber only)
 *
 * Body: { userId?: string, title: string, body: string, url?: string }
 * Wenn userId fehlt → Broadcast an alle
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendPushNotification } from '@/lib/push.server'
import { parseBody } from '@/lib/validation'

const Schema = z.object({
  userId: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(2000),
  url: z.string().trim().max(2000).optional(),
})

function getSupabase() {
  const cookieStore = cookies()
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return createServerClient(url, key, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    // Nur Admin/Inhaber darf Push-Nachrichten senden
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile as { role?: string } | null)?.role ?? ''
    if (!['Admin', 'Inhaber'].includes(role)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const parsedBody = await parseBody(req, Schema)
    if (!parsedBody.ok) return parsedBody.error
    const body = parsedBody.data

    // Subscriptions laden
    let query = supabase.from('push_subscriptions').select('*')
    if (body.userId) {
      query = query.eq('user_id', body.userId)
    }
    const { data: subscriptions, error: subErr } = await query
    if (subErr) throw subErr

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Keine aktiven Subscriptions' })
    }

    // Alle Subscriptions benachrichtigen
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        sendPushNotification(
          sub.endpoint,
          { p256dh: sub.p256dh, auth: sub.auth_key },
          { title: body.title, body: body.body, url: body.url }
        )
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - sent

    return NextResponse.json({ sent, failed, total: results.length })
  } catch (err) {
    console.error('[push/send]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
