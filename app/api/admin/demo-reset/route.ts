import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEMO_USER_ID = '5ff2cb0a-1ea0-4ba5-a6cc-54762710b68f'

// User-scoped Tabellen die beim Reset geleert werden (synchron mit Seed)
const RESET_TABLES = [
  'lager_artikel', 'lager_bewegungen', 'lager_stellplaetze',
  'lager_stellplatz_bestand', 'lager_umlagerungen', 'lager_bestand_snapshots',
  'buero_kunden', 'buero_angebote', 'buero_auftraege', 'buero_rechnungen',
  'buero_eingangsrechnungen', 'buero_dokumente',
  'werkstatt_karten', 'werkstatt_zeitbuchungen', 'werkstatt_material', 'werkstatt_pruefprotokolle',
  'planung_projekte', 'planung_aufgaben', 'planung_termine', 'planung_ressourcen',
  'steuer_belege', 'steuer_fixkosten', 'steuer_anschaffungen', 'steuer_betriebsausgaben', 'steuer_ustva',
  'marketing_kampagnen', 'marketing_leads', 'marketing_newsletter',
  'einkauf_lieferanten', 'einkauf_bestellungen', 'einkauf_wareneingaenge',
  'firma_einstellungen', 'cloud_backups', 'user_audit_log', 'ai_usage', 'ki_response_cache',
] as const

function serviceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function isAuthorized(req: NextRequest): boolean {
  // Vercel CRON setzt automatisch authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  return !!process.env.CRON_SECRET && authHeader === expected
}

/**
 * GET /api/admin/demo-reset
 *
 * Löscht alle Daten des Demo-Users und spielt das Seed-SQL neu ein.
 * Auth: CRON_SECRET (Vercel CRON).
 *
 * Wird täglich um 03:00 Uhr UTC via Vercel CRON ausgeführt.
 * Für manuelle Tests: `curl -H "Authorization: Bearer $CRON_SECRET" .../api/admin/demo-reset`
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service-Role nicht konfiguriert' }, { status: 500 })
  }

  const startedAt = new Date().toISOString()
  const deleted: Record<string, number> = {}
  const errors: Record<string, string> = {}

  // 1) Daten löschen (CASCADE über user_id)
  for (const table of RESET_TABLES) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq('user_id', DEMO_USER_ID)
    if (error) errors[table] = error.message
    else deleted[table] = count ?? 0
  }

  // 2) Storage-Files unter <DEMO_USER_ID>/ aus allen Buckets entfernen (best-effort)
  const storageBuckets = ['dokumente', 'lager-bilder', 'ocr-originale', 'firma-branding', 'rechnungen-archiv', 'db-backups']
  for (const bucket of storageBuckets) {
    try {
      const { data: files } = await supabase.storage.from(bucket).list(DEMO_USER_ID, { limit: 1000 })
      if (files && files.length > 0) {
        const paths = files.map(f => `${DEMO_USER_ID}/${f.name}`)
        await supabase.storage.from(bucket).remove(paths)
      }
    } catch {
      // best-effort
    }
  }

  // 3) Seed neu einspielen
  let seedError: string | undefined
  try {
    const seedPath = path.join(process.cwd(), 'supabase', 'seeds', 'demo-seed.sql')
    const seedSql = readFileSync(seedPath, 'utf8')
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: seedSql })
    if (rpcError) seedError = rpcError.message
  } catch (err) {
    seedError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    ok: !seedError,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    demo_user_id: DEMO_USER_ID,
    deleted,
    delete_errors: Object.keys(errors).length ? errors : undefined,
    seed_error: seedError,
  })
}

/**
 * POST → Status-Check (zeigt aktuelle Demo-Daten-Counts), nicht-destruktiv.
 * Auch hinter CRON_SECRET, damit niemand die Demo-User-Daten enumerieren kann.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Service-Role nicht konfiguriert' }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const table of RESET_TABLES) {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEMO_USER_ID)
    counts[table] = count ?? 0
  }

  return NextResponse.json({
    demo_user_id: DEMO_USER_ID,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  })
}
