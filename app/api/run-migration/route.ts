import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// EINMALIGE MIGRATIONS-ROUTE — nach Ausführung löschen!
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'petersen-migrate-cloud-backups-2026') {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ error: 'missing env vars' }, { status: 500 })

  const sb = createClient(url, key, { auth: { persistSession: false } })

  // Tabelle via Insert+select mit error-check prüfen ob sie existiert
  const { error: checkErr } = await sb.from('cloud_backups').select('id').limit(1)
  if (!checkErr) {
    return Response.json({ ok: true, message: 'Tabelle cloud_backups existiert bereits' })
  }
  if (checkErr.code !== '42P01' && !checkErr.message.includes('schema cache')) {
    return Response.json({ ok: false, error: checkErr.message })
  }

  // Tabelle existiert nicht → über rpc exec_sql oder pg_query versuchen
  // Supabase Admin: POST zur SQL-Endpoint via fetch mit service_role
  const sqlEndpoint = `${url}/rest/v1/rpc/exec_sql`
  const sql = `
    CREATE TABLE IF NOT EXISTS cloud_backups (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users DEFAULT auth.uid(),
      created_at timestamptz DEFAULT now(),
      label text NOT NULL DEFAULT 'Manuell',
      modules jsonb NOT NULL DEFAULT '{}',
      total_records integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'ok'
    );
    ALTER TABLE cloud_backups ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'cloud_backups' AND policyname = 'cloud_backups_own'
      ) THEN
        CREATE POLICY "cloud_backups_own" ON cloud_backups
          USING (user_id = auth.uid())
          WITH CHECK (user_id = auth.uid());
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS cloud_backups_user_created ON cloud_backups (user_id, created_at DESC);
  `

  const rpcRes = await fetch(sqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify({ sql }),
  })

  if (!rpcRes.ok) {
    const errText = await rpcRes.text()
    return Response.json({
      ok: false,
      message: 'exec_sql nicht verfügbar — bitte SQL manuell im Supabase SQL-Editor ausführen',
      sql: sql.trim(),
      rpcError: errText,
    })
  }

  return Response.json({ ok: true, message: 'Migration erfolgreich ausgeführt' })
}
