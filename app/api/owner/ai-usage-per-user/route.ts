import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRouteAccess } from '@/lib/server-auth'

export const runtime = 'nodejs'

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'

function isOwner(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase()
}

function serviceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req, ['Admin', 'Inhaber'])
  if (access.error) return access.error
  if (!isOwner(access.user?.email)) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }

  const supabase = serviceClient()
  if (!supabase) return NextResponse.json({ error: 'Supabase-Service-Role nicht konfiguriert.' }, { status: 500 })

  const url = new URL(req.url)
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '30')))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: usage, error } = await supabase
    .from('ai_usage')
    .select('user_id, route, input_tokens, output_tokens, cost_eur, cached, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregat pro User
  const byUser = new Map<string, { user_id: string; calls: number; cached: number; input: number; output: number; cost: number }>()
  for (const row of usage ?? []) {
    const existing = byUser.get(row.user_id) ?? { user_id: row.user_id, calls: 0, cached: 0, input: 0, output: 0, cost: 0 }
    existing.calls++
    if (row.cached) existing.cached++
    existing.input += row.input_tokens ?? 0
    existing.output += row.output_tokens ?? 0
    existing.cost += Number(row.cost_eur ?? 0)
    byUser.set(row.user_id, existing)
  }

  const users = Array.from(byUser.values()).sort((a, b) => b.cost - a.cost).slice(0, 50)

  // E-Mails dazu holen
  const userIds = users.map(u => u.user_id)
  let emails: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 500 })
    emails = Object.fromEntries(
      (authUsers ?? []).filter(u => userIds.includes(u.id)).map(u => [u.id, u.email ?? '']),
    )
  }

  return NextResponse.json({
    days,
    total: {
      calls: usage?.length ?? 0,
      users: byUser.size,
      cost_eur: Number(Array.from(byUser.values()).reduce((s, u) => s + u.cost, 0).toFixed(4)),
    },
    users: users.map(u => ({
      user_id: u.user_id,
      email: emails[u.user_id] ?? '–',
      calls: u.calls,
      cached: u.cached,
      input_tokens: u.input,
      output_tokens: u.output,
      cost_eur: Number(u.cost.toFixed(4)),
    })),
  })
}
