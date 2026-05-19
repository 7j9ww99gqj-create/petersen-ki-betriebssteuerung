import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { POND_USER_EMAIL } from '@/lib/pondruff'

// Fuzzy-Match: Pondruff-OCR-Customer gegen buero_kunden des Pondruff-Users.
// Liefert Top-3 Kandidaten mit Score 0..100.
export const runtime = 'nodejs'

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s*(gmbh|kg|gbr|ag|e\.k\.|ek|ug|co\.|& co|& co\.|mbh)\b/g, '')
    .replace(/[.,&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length >= 2)
}

function score(a: string, b: string): number {
  if (!a || !b) return 0
  const na = norm(a), nb = norm(b)
  if (!na || !nb) return 0
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 90
  const ta = Array.from(new Set(tokens(a)))
  const tb = new Set(tokens(b))
  if (ta.length === 0 || tb.size === 0) return 0
  let hits = 0
  ta.forEach(t => { if (tb.has(t)) hits++ })
  const overlap = hits / Math.max(ta.length, tb.size)
  return Math.round(overlap * 85)
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL || !access.supabase) {
    return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
  }

  let body: { name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungueltige Anfrage' }, { status: 400 }) }
  const name = (body.name || '').trim()
  if (!name) return NextResponse.json({ matches: [] })

  const { data, error } = await access.supabase
    .from('buero_kunden')
    .select('id, name')
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const candidates = (data ?? [])
    .map(k => ({ id: String(k.id), name: String(k.name || ''), score: score(name, String(k.name || '')) }))
    .filter(c => c.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return NextResponse.json({ matches: candidates })
}
