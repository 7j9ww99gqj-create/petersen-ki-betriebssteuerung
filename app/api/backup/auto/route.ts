import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gzipSync } from 'zlib'

export const runtime = 'nodejs'
export const maxDuration = 300

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

const RETENTION_DAYS = 30

function getAdminSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('Supabase env-vars fehlen')
  return createClient(url, key)
}

// Vercel Cron: täglich 02:00 Uhr — vollständiger DB-Dump pro User in Storage-Bucket "db-backups"
export async function GET(req: NextRequest) {
  // Cron-Auth: Vercel sendet "Authorization: Bearer $CRON_SECRET" automatisch
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET nicht konfiguriert' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sb = getAdminSupabase()
    const { data: users, error: usersError } = await sb.auth.admin.listUsers()
    if (usersError) throw usersError

    const today = new Date().toISOString().slice(0, 10)
    let createdCount = 0
    let failedCount = 0
    let totalBytes = 0

    for (const user of users.users) {
      if (!user.id) continue
      try {
        // Alle Tabellen für diesen User dumpen
        const dump: Record<string, unknown[]> = {}
        const modules: Record<string, number> = {}

        for (const table of BACKUP_TABLES) {
          const { data, error } = await sb.from(table).select('*').eq('user_id', user.id)
          if (error) {
            // Tabelle existiert evtl. nicht in dieser DB → überspringen
            continue
          }
          const rows = data ?? []
          dump[table] = rows
          const label = MODULE_LABELS[table]
          if (label) modules[label] = rows.length
        }

        const payload = {
          version: 1,
          user_id: user.id,
          created_at: new Date().toISOString(),
          tables: dump,
        }
        const json = JSON.stringify(payload)
        const compressed = gzipSync(Buffer.from(json, 'utf-8'))
        const path = `${user.id}/${today}.json.gz`

        const { error: upErr } = await sb.storage
          .from('db-backups')
          .upload(path, compressed, { upsert: true, contentType: 'application/gzip' })
        if (upErr) throw upErr

        const total_records = Object.values(modules).reduce((a, b) => a + b, 0)
        await sb.from('cloud_backups').insert({
          user_id: user.id,
          label: 'Automatisch',
          modules,
          total_records,
          status: 'ok',
          storage_path: path,
          size_bytes: compressed.length,
        })

        totalBytes += compressed.length
        createdCount++
      } catch (userErr) {
        failedCount++
        // Pro-User-Fehler nicht hart fail-en, weiter mit nächstem User
        try {
          await sb.from('cloud_backups').insert({
            user_id: user.id,
            label: 'Automatisch (Fehler)',
            modules: {},
            total_records: 0,
            status: 'error',
          })
        } catch {}
      }
    }

    // Retention: Backups älter als RETENTION_DAYS Tage aus Storage löschen
    let deletedCount = 0
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      for (const user of users.users) {
        if (!user.id) continue
        const { data: files } = await sb.storage.from('db-backups').list(user.id, { limit: 100 })
        if (!files) continue
        const toDelete = files
          .map(f => `${user.id}/${f.name}`)
          .filter(p => {
            const m = p.match(/(\d{4}-\d{2}-\d{2})\.json\.gz$/)
            return m ? m[1] < cutoffStr : false
          })
        if (toDelete.length > 0) {
          await sb.storage.from('db-backups').remove(toDelete)
          deletedCount += toDelete.length
        }
      }
    } catch {
      // Cleanup ist best-effort
    }

    return NextResponse.json({
      ok: true,
      created: createdCount,
      failed: failedCount,
      retention_deleted: deletedCount,
      size_kb: Math.round(totalBytes / 1024),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
