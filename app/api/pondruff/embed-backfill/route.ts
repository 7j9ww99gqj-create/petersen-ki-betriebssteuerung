import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Backfill: erzeugt Embeddings fuer alle Bauteile ohne embedding-Wert.
// Pro Aufruf werden bis zu 10 Bauteile abgearbeitet.

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  const sb = access.supabase
  const { data: todo, error } = await sb.from('pondruff_bauteile')
    .select('id').is('embedding', null).limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!todo?.length) return NextResponse.json({ ok: true, processed: 0, remaining: 0 })

  const origin = req.nextUrl.origin
  const cookie = req.headers.get('cookie') || ''
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const row of todo) {
    try {
      const r = await fetch(`${origin}/api/pondruff/embed-bauteil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ id: row.id }),
      })
      const d = await r.json()
      results.push({ id: row.id, ok: r.ok, error: r.ok ? undefined : (d?.error || `HTTP ${r.status}`) })
    } catch (e) {
      results.push({ id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const { count: remaining } = await sb.from('pondruff_bauteile').select('id', { count: 'exact', head: true }).is('embedding', null)
  return NextResponse.json({ ok: true, processed: results.length, remaining: remaining ?? 0, results })
}
