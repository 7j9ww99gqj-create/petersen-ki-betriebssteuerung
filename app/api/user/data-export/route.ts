import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

// Alle User-scoped Tabellen, die im DSGVO-Export (Art. 15 DSGVO) ausgeliefert werden.
// Synchron mit /api/backup/auto + zusätzlich Profil/Settings/Audit-Tabellen.
const EXPORT_TABLES = [
  // Lager
  'lager_artikel', 'lager_bewegungen', 'lager_stellplaetze',
  'lager_stellplatz_bestand', 'lager_umlagerungen', 'lager_bestand_snapshots',
  // Büro
  'buero_kunden', 'buero_angebote', 'buero_auftraege', 'buero_rechnungen',
  'buero_eingangsrechnungen', 'buero_dokumente',
  // Werkstatt
  'werkstatt_karten', 'werkstatt_zeitbuchungen', 'werkstatt_material', 'werkstatt_pruefprotokolle',
  // Planung
  'planung_projekte', 'planung_aufgaben', 'planung_termine', 'planung_ressourcen',
  // Steuer
  'steuer_belege', 'steuer_fixkosten', 'steuer_anschaffungen', 'steuer_betriebsausgaben', 'steuer_ustva',
  // Marketing
  'marketing_kampagnen', 'marketing_leads', 'marketing_newsletter',
  // Einkauf
  'einkauf_lieferanten', 'einkauf_bestellungen', 'einkauf_wareneingaenge',
  // Profil / Settings / Audit
  'firma_einstellungen', 'cloud_backups', 'user_audit_log', 'ai_usage', 'ki_response_cache',
] as const

/**
 * GET /api/user/data-export → JSON-Dump aller User-Daten (DSGVO Art. 15 Auskunftsrecht)
 *
 * Liefert Content-Disposition: attachment für Browser-Download.
 * Format: { generated_at, user, tables: { name: rows[] } }
 */
export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.isDemo || !access.user || !access.supabase) {
    return NextResponse.json({ error: 'Nur für eingeloggte Nutzer verfügbar.' }, { status: 403 })
  }

  // Strenges Rate-Limit auf max 5 Exporte pro Stunde (default-Bucket reicht)
  const limited = checkRateLimit(access.user.id, 'default')
  if (limited) return limited

  const tables: Record<string, unknown[]> = {}
  const errors: Record<string, string> = {}

  for (const table of EXPORT_TABLES) {
    const { data, error } = await access.supabase
      .from(table)
      .select('*')
      .limit(50000)
    if (error) {
      errors[table] = error.message
      tables[table] = []
    } else {
      tables[table] = data ?? []
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    legal_basis: 'DSGVO Art. 15 Auskunftsrecht',
    user: {
      id: access.user.id,
      email: access.user.email ?? null,
      created_at: access.user.created_at ?? null,
    },
    tables,
    errors: Object.keys(errors).length ? errors : undefined,
  }

  const filename = `petersen-ki-datenauskunft-${access.user.id}-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
