import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { POND_DEFAULT_FEATURE_FLAGS, POND_FEATURE_KEYS, POND_USER_ID, type PondruffFeatureFlags, type PondruffFeatureKey } from '@/lib/pondruff'
import { logOwnerAction } from '@/lib/audit-log'

const Schema = z.object({
  key: z.string().trim().max(80).optional(),
  value: z.boolean().optional(),
})

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'

export const runtime = 'nodejs'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalize(row: Record<string, unknown> | null): PondruffFeatureFlags {
  if (!row) return { ...POND_DEFAULT_FEATURE_FLAGS }
  const out = { ...POND_DEFAULT_FEATURE_FLAGS }
  for (const k of POND_FEATURE_KEYS) {
    const v = row[k]
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }
  const sa = admin()
  if (!sa) return NextResponse.json({ error: 'Service-Role-Key fehlt.' }, { status: 500 })
  const { data, error } = await sa
    .from('pondruff_feature_flags')
    .select('*')
    .eq('user_id', POND_USER_ID)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ userId: POND_USER_ID, flags: normalize(data) })
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }
  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data
  const key = body.key as PondruffFeatureKey | undefined
  if (!key || !POND_FEATURE_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Unbekannter Flag.' }, { status: 400 })
  }
  if (typeof body.value !== 'boolean') {
    return NextResponse.json({ error: 'value muss boolean sein.' }, { status: 400 })
  }
  const sa = admin()
  if (!sa) return NextResponse.json({ error: 'Service-Role-Key fehlt.' }, { status: 500 })

  // Vorherige Flags fuer Audit-Log auslesen
  const { data: previousRow } = await sa
    .from('pondruff_feature_flags')
    .select('*')
    .eq('user_id', POND_USER_ID)
    .maybeSingle()
  const previousFlags = normalize(previousRow)

  const payload: Record<string, unknown> = {
    user_id: POND_USER_ID,
    [key]: body.value,
    updated_at: new Date().toISOString(),
    updated_by: access.user?.id,
  }
  const { data, error } = await sa
    .from('pondruff_feature_flags')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit-Log (fire-and-forget)
  await logOwnerAction({
    actor: { userId: access.user?.id, email: access.user?.email },
    action: 'pondruff_flag.toggle',
    target: { userId: POND_USER_ID },
    details: {
      flag: key,
      previousValue: previousFlags[key],
      newValue: body.value,
    },
  })

  return NextResponse.json({ userId: POND_USER_ID, flags: normalize(data) })
}
