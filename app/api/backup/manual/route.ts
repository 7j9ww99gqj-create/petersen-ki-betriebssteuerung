import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gzipSync } from 'zlib'
import { getServerComponentSession } from '@/lib/server-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const BACKUP_TABLES = [
  'lager_artikel', 'lager_bewegungen', 'lager_stellplaetze', 'lager_stellplatz_bestand', 'lager_umlagerungen',
  'buero_kunden', 'buero_angebote', 'buero_auftraege', 'buero_rechnungen',
  'buero_eingangsrechnungen', 'buero_dokumente',
  'werkstatt_karten', 'werkstatt_zeitbuchungen', 'werkstatt_material', 'werkstatt_pruefprotokolle',
  'planung_projekte', 'planung_aufgaben', 'planung_termine', 'planung_ressourcen',
  'steuer_belege',
  'marketing_kampagnen', 'marketing_leads', 'marketing_newsletter',
  'einkauf_lieferanten', 'einkauf_bestellungen', 'einkauf_wareneingaenge',
] as const

const MODULE_LABELS: Record<string, string> = {
  lager_artikel: 'LagerPilot',
  buero_kunden: 'BüroPilot Kunden',
  buero_angebote: 'BüroPilot Angebote',
  buero_auftraege: 'BüroPilot Aufträge',
  buero_rechnungen: 'BüroPilot Rechnungen',
  buero_eingangsrechnungen: 'BüroPilot Eingangsrechnungen',
  buero_dokumente: 'Archiv Dokumente',
  werkstatt_karten: 'WerkstattPilot',
  planung_projekte: 'PlanungPilot Projekte',
  planung_aufgaben: 'PlanungPilot Aufgaben',
  steuer_belege: 'SteuerPilot Belege',
  marketing_kampagnen: 'MarketingPilot Kampagnen',
  marketing_leads: 'MarketingPilot Leads',
  marketing_newsletter: 'MarketingPilot Newsletter',
  einkauf_lieferanten: 'Einkauf Lieferanten',
  einkauf_bestellungen: 'Einkauf Bestellungen',
}

export async function POST() {
  const session = await getServerComponentSession()
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase env-vars fehlen' }, { status: 500 })
  }
  const sb = createClient(url, key)

  const dump: Record<string, unknown[]> = {}
  const modules: Record<string, number> = {}

  for (const table of BACKUP_TABLES) {
    const { data, error } = await sb.from(table).select('*').eq('user_id', userId)
    if (error) continue
    const rows = data ?? []
    dump[table] = rows
    const label = MODULE_LABELS[table]
    if (label) modules[label] = rows.length
  }

  const payload = {
    version: 1,
    user_id: userId,
    created_at: new Date().toISOString(),
    tables: dump,
  }
  const json = JSON.stringify(payload)
  const compressed = gzipSync(Buffer.from(json, 'utf-8'))
  const today = new Date().toISOString().slice(0, 10)
  const path = `${userId}/${today}-manual.json.gz`

  const { error: upErr } = await sb.storage
    .from('db-backups')
    .upload(path, compressed, { upsert: true, contentType: 'application/gzip' })
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const total_records = Object.values(modules).reduce((a, b) => a + b, 0)
  const { data: backupRow, error: insertErr } = await sb
    .from('cloud_backups')
    .insert({
      user_id: userId,
      label: 'Manuell',
      modules,
      total_records,
      status: 'ok',
      storage_path: path,
      size_bytes: compressed.length,
    })
    .select()
    .single()
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json(backupRow)
}
