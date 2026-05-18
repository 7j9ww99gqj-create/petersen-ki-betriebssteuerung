import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export const runtime = 'nodejs'

// Vercel Cron: täglich 02:00 Uhr — erstellt automatischen Backup-Eintrag pro User
export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    const sb = createSupabaseClient()
    const { data: users, error: usersError } = await sb.auth.admin.listUsers()
    if (usersError) throw usersError

    let created = 0
    for (const user of users.users) {
      if (!user.id) continue

      const tables = [
        'lager_artikel', 'buero_kunden', 'buero_angebote', 'buero_auftraege',
        'buero_rechnungen', 'buero_eingangsrechnungen', 'buero_dokumente',
        'werkstatt_karten', 'planung_projekte', 'planung_aufgaben',
        'steuer_belege', 'marketing_kampagnen', 'marketing_leads',
        'marketing_newsletter', 'einkauf_lieferanten', 'einkauf_bestellungen',
      ]

      const counts = await Promise.all(
        tables.map(t => sb.from(t).select('id', { count: 'exact', head: true }).eq('user_id', user.id))
      )

      const moduleNames = [
        'LagerPilot', 'BüroPilot Kunden', 'BüroPilot Angebote', 'BüroPilot Aufträge',
        'BüroPilot Rechnungen', 'BüroPilot Eingangsrechnungen', 'Archiv Dokumente',
        'WerkstattPilot', 'PlanungPilot Projekte', 'PlanungPilot Aufgaben',
        'SteuerPilot Belege', 'MarketingPilot Kampagnen', 'MarketingPilot Leads',
        'MarketingPilot Newsletter', 'Einkauf Lieferanten', 'Einkauf Bestellungen',
      ]

      const modules: Record<string, number> = {}
      counts.forEach((r, i) => { modules[moduleNames[i]] = r.count ?? 0 })
      const total_records = Object.values(modules).reduce((a, b) => a + b, 0)

      await sb.from('cloud_backups').insert({
        user_id: user.id,
        label: 'Automatisch',
        modules,
        total_records,
        status: 'ok',
      })
      created++
    }

    return Response.json({ ok: true, created })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
