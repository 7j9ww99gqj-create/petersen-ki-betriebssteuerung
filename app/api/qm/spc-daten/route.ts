import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'

export const runtime = 'nodejs'

// SPC math (server-side for warnung mode)
function calcCpk(werte: number[], soll: number, tolPlus: number, tolMinus: number): number | null {
  const n = werte.length
  if (n < 2) return null
  const mean = werte.reduce((s, x) => s + x, 0) / n
  const stddev = Math.sqrt(werte.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1))
  if (stddev === 0) return null
  const usl = soll + tolPlus
  const lsl = soll - tolMinus
  const cpu = (usl - mean) / (3 * stddev)
  const cpl = (mean - lsl) / (3 * stddev)
  return Math.min(cpu, cpl)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const access = await getRouteAccess(req)
  if (access.isDemo) return NextResponse.json([])
  if (!access.user || !access.supabase) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')

  // ── Mode: warnung — find worst Cpk across all messstellen with ≥10 entries
  if (mode === 'warnung') {
    const { data: berichte } = await access.supabase
      .from('qm_pruefberichte')
      .select('id, bauteil_id, pruef_datum')
      .eq('user_id', access.user.id)

    if (!berichte || berichte.length === 0) return NextResponse.json(null)

    const berichtMap = new Map(berichte.map(b => [b.id, b]))
    const ids = berichte.map(b => b.id)

    const { data: messwerte } = await access.supabase
      .from('qm_messwerte')
      .select('pruefbericht_id, messstelle, istwert, sollwert, toleranz_plus, toleranz_minus')
      .in('pruefbericht_id', ids)

    if (!messwerte) return NextResponse.json(null)

    // Group by (bauteil_id, messstelle)
    type Group = { bauteil_id: string; messstelle: string; werte: number[]; soll: number; tolPlus: number; tolMinus: number }
    const groups = new Map<string, Group>()

    for (const m of messwerte) {
      if (m.istwert == null || m.sollwert == null) continue
      const b = berichtMap.get(m.pruefbericht_id)
      if (!b?.bauteil_id) continue
      const key = `${b.bauteil_id}||${m.messstelle}`
      if (!groups.has(key)) {
        groups.set(key, { bauteil_id: b.bauteil_id, messstelle: m.messstelle, werte: [], soll: m.sollwert, tolPlus: m.toleranz_plus ?? 0, tolMinus: m.toleranz_minus ?? 0 })
      }
      groups.get(key)!.werte.push(m.istwert)
    }

    let worst: { bauteil_id: string; messstelle: string; cpk: number } | null = null
    for (const g of Array.from(groups.values())) {
      if (g.werte.length < 10) continue
      const cpk = calcCpk(g.werte, g.soll, g.tolPlus, g.tolMinus)
      if (cpk !== null && (worst === null || cpk < worst.cpk)) {
        worst = { bauteil_id: g.bauteil_id, messstelle: g.messstelle, cpk }
      }
    }

    return NextResponse.json(worst)
  }

  // ── Mode: messstellen — distinct messstellen for a bauteil_id
  if (mode === 'messstellen') {
    const bauteil_id = url.searchParams.get('bauteil_id') ?? ''
    if (!bauteil_id) return NextResponse.json([])

    const { data: berichte } = await access.supabase
      .from('qm_pruefberichte')
      .select('id')
      .eq('bauteil_id', bauteil_id)
      .eq('user_id', access.user.id)

    if (!berichte?.length) return NextResponse.json([])
    const ids = berichte.map(b => b.id)

    const { data } = await access.supabase
      .from('qm_messwerte')
      .select('messstelle')
      .in('pruefbericht_id', ids)

    const distinct = Array.from(new Set((data ?? []).map(r => r.messstelle).filter(Boolean)))
    return NextResponse.json(distinct)
  }

  // ── Default: SPC data for a specific messstelle + bauteil_id
  const messstelle = url.searchParams.get('messstelle') ?? ''
  const bauteil_id = url.searchParams.get('bauteil_id') ?? ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  if (!messstelle || !bauteil_id) {
    return NextResponse.json({ error: 'messstelle und bauteil_id erforderlich' }, { status: 400 })
  }

  const { data: berichte } = await access.supabase
    .from('qm_pruefberichte')
    .select('id, pruef_datum, pruefbericht_nr')
    .eq('bauteil_id', bauteil_id)
    .eq('user_id', access.user.id)
    .order('pruef_datum', { ascending: true })

  if (!berichte?.length) return NextResponse.json([])

  const berichtMap = new Map(berichte.map(b => [b.id, b]))
  const ids = berichte.map(b => b.id)

  const { data, error } = await access.supabase
    .from('qm_messwerte')
    .select('istwert, sollwert, toleranz_plus, toleranz_minus, status, pruefbericht_id')
    .in('pruefbericht_id', ids)
    .ilike('messstelle', messstelle)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? [])
    .map(r => {
      const b = berichtMap.get(r.pruefbericht_id)
      return {
        istwert: r.istwert,
        sollwert: r.sollwert,
        toleranz_plus: r.toleranz_plus,
        toleranz_minus: r.toleranz_minus,
        status: r.status,
        pruef_datum: b?.pruef_datum ?? '',
        pruefbericht_nr: b?.pruefbericht_nr ?? '',
      }
    })
    .filter(r => r.istwert != null)
    .sort((a, b) => a.pruef_datum.localeCompare(b.pruef_datum))
    .slice(0, limit)

  return NextResponse.json(rows)
}
