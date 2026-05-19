/**
 * POST /api/push  – Subscribe (Subscription in DB speichern)
 * DELETE /api/push – Unsubscribe (Subscription aus DB entfernen)
 *
 * Benötigte Vercel Env-Vars:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY (gleicher Wert, für Client)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseBody } from '@/lib/validation'

const SubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(500),
    auth: z.string().trim().min(1).max(500),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().trim().max(2000).optional(),
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

/** POST /api/push – Subscribe */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const parsedBody = await parseBody(req, SubscribeSchema)
    if (!parsedBody.ok) return parsedBody.error
    const body = parsedBody.data

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

/** DELETE /api/push – Unsubscribe */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const parsedBody = await parseBody(req, UnsubscribeSchema)
    if (!parsedBody.ok) return parsedBody.error
    const body = parsedBody.data

    if (body.endpoint) {
      // Nur diese spezifische Subscription entfernen
      await supabase.from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', body.endpoint)
    } else {
      // Alle Subscriptions des Users entfernen
      await supabase.from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
