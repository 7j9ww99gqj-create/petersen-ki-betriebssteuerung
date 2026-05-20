/**
 * POST /api/qm/pruefplan
 * Generiert aus erkannten Maßen einer Zeichnung einen geordneten Prüfplan.
 * Keine KI — reine Regel-Engine.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export type PruefplanPosition = {
  reihenfolge: number
  messstelle: string
  sollwert: number | null
  einheit: string
  toleranz_plus: number | null
  toleranz_minus: number | null
  pruefmittel: string
  kritisch: boolean
  hinweis: string
}

type ErkanntesMass = {
  name: string
  wert: number
  einheit: string
  toleranz_plus?: number | null
  toleranz_minus?: number | null
  kritisch?: boolean
  konfidenz?: number
}

function pruefmittelFuer(mass: ErkanntesMass): string {
  const name = (mass.name ?? '').toLowerCase()
  const einheit = (mass.einheit ?? '').toLowerCase()

  if (einheit === 'µm' || name.includes('ra') || name.includes('rz')) return 'Rauheitsmessgerät'
  if (name.includes('gewinde')) return 'Gewindelehrdorn'
  if (name.includes('bohrung') || name.includes('ø') || name.includes('⌀')) return 'Dreipunktmessgerät / Lehrdorn'

  const tol = (mass.toleranz_plus ?? 0) + (mass.toleranz_minus ?? 0)
  if (tol > 0 && tol < 0.04) return 'Mikrometer'
  if (tol >= 0.04 && tol <= 0.2) return 'Messschieber digital (0,01mm)'
  return 'Messschieber analog'
}

function pruefmittelGruppe(pm: string): number {
  if (pm.startsWith('Messschieber')) return 1
  if (pm.startsWith('Mikrometer'))  return 2
  if (pm.startsWith('Rauheit'))     return 3
  return 4
}

export async function POST(req: NextRequest) {
  try {
    const { zeichnung_id } = await req.json() as { zeichnung_id: string }
    if (!zeichnung_id) return NextResponse.json({ error: 'zeichnung_id fehlt' }, { status: 400 })

    const supabase = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    )

    const { data, error } = await supabase
      .from('qm_zeichnungen')
      .select('erkannte_masse')
      .eq('id', zeichnung_id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    const masse: ErkanntesMass[] = (data?.erkannte_masse ?? []) as ErkanntesMass[]

    // Prüfpositionen bauen
    const positionen: (PruefplanPosition & { _gruppe: number })[] = masse.map(m => {
      const pm = pruefmittelFuer(m)
      const kritisch = m.kritisch ?? false
      return {
        reihenfolge: 0,
        messstelle: m.name,
        sollwert: m.wert ?? null,
        einheit: m.einheit ?? 'mm',
        toleranz_plus: m.toleranz_plus ?? null,
        toleranz_minus: m.toleranz_minus ?? null,
        pruefmittel: pm,
        kritisch,
        hinweis: kritisch ? '⚠️ kritisches Maß' : '',
        _gruppe: pruefmittelGruppe(pm),
      }
    })

    // Sortierung: kritische zuerst, dann nach Messmittel-Gruppe
    positionen.sort((a, b) => {
      if (a.kritisch !== b.kritisch) return a.kritisch ? -1 : 1
      return a._gruppe - b._gruppe
    })

    // Reihenfolge vergeben
    positionen.forEach((p, i) => { p.reihenfolge = i + 1 })

    // _gruppe entfernen
    const result: PruefplanPosition[] = positionen.map(({ _gruppe: _g, ...p }) => p)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
