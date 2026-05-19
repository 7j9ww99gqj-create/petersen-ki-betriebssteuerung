import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { POND_USER_EMAIL } from '@/lib/pondruff'
import { INHABER_EMAIL } from '@/lib/roles'
import defaultConfig from '@/lib/pondruff-price-config.json'

const Schema = z.object({
  config: z.unknown(),
})

// Pondruff Preistabellen-Admin-Endpunkt.
// GET → aktuelle Config aus DB; Fallback auf JSON-Defaults wenn leer.
// POST → speichert neue Config (nur Pondruff-User oder Petersen-Inhaber).

export const maxDuration = 30

function isAllowed(email: string | undefined): boolean {
  const e = (email || '').toLowerCase()
  return e === POND_USER_EMAIL || e === INHABER_EMAIL.toLowerCase()
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || !access.supabase || !isAllowed(access.user.email)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const { data, error } = await access.supabase
    .from('pondruff_price_config')
    .select('config, updated_at')
    .eq('user_id', access.user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    config: data?.config || defaultConfig,
    source: data ? 'db' : 'defaults',
    updated_at: data?.updated_at || null,
  })
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || !access.supabase || !isAllowed(access.user.email)) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const parsedBody = await parseBody(req, Schema)
  if (!parsedBody.ok) return parsedBody.error
  const body = parsedBody.data
  if (!body.config || typeof body.config !== 'object') {
    return NextResponse.json({ error: 'config fehlt oder ungültig' }, { status: 400 })
  }

  const cfg = body.config as Record<string, unknown>
  // Mindest-Validierung der Pflichtfelder
  if (typeof cfg.base_coating_multiplier !== 'number' || !cfg.coating_factors || !Array.isArray(cfg.price_table)) {
    return NextResponse.json({ error: 'config muss base_coating_multiplier, coating_factors und price_table enthalten' }, { status: 400 })
  }

  const { error } = await access.supabase
    .from('pondruff_price_config')
    .upsert({
      user_id: access.user.id,
      config: cfg,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated_at: new Date().toISOString() })
}
