import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getRouteAccess } from '@/lib/server-auth'
import { parseBody } from '@/lib/validation'
import { isPondruffUser } from '@/lib/pondruff'
import { logOwnerAction } from '@/lib/audit-log'

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'

const PatchSchema = z.object({
  user_id: z.string().uuid(),
  qm_ki_zeichnungs_analyse: z.boolean().optional(),
  qm_ki_sichtpruefung: z.boolean().optional(),
})

export const runtime = 'nodejs'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function resolveTargetEmail(sa: ReturnType<typeof admin>, userId: string): Promise<string> {
  if (!sa) return ''
  try {
    const { data } = await sa.auth.admin.getUserById(userId)
    return (data?.user?.email ?? '').toLowerCase()
  } catch {
    return ''
  }
}

function normalizeFlags(row: Record<string, unknown> | null) {
  return {
    qm_ki_zeichnungs_analyse: Boolean(row?.qm_ki_zeichnungs_analyse),
    qm_ki_sichtpruefung: Boolean(row?.qm_ki_sichtpruefung),
  }
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Nur für den Inhaber-Account verfügbar.' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id fehlt.' }, { status: 400 })

  const sa = admin()
  if (!sa) return NextResponse.json({ error: 'Service-Role-Key fehlt.' }, { status: 500 })

  const targetEmail = await resolveTargetEmail(sa, userId)
  if (targetEmail === OWNER_EMAIL || isPondruffUser(targetEmail)) {
    return NextResponse.json({ userId, flags: { qm_ki_zeichnungs_analyse: true, qm_ki_sichtpruefung: true }, auto: true })
  }

  const { data, error } = await sa
    .from('firma_einstellungen')
    .select('qm_ki_zeichnungs_analyse, qm_ki_sichtpruefung')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ userId, flags: normalizeFlags(data as Record<string, unknown> | null) })
}

export async function PATCH(req: NextRequest) {
  const access = await getRouteAccess(req)
  if (access.error) return access.error
  if (access.user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Nur für den Inhaber-Account verfügbar.' }, { status: 403 })
  }

  const parsed = await parseBody(req, PatchSchema)
  if (!parsed.ok) return parsed.error
  const body = parsed.data

  if (body.qm_ki_zeichnungs_analyse === undefined && body.qm_ki_sichtpruefung === undefined) {
    return NextResponse.json({ error: 'Mindestens ein Flag muss angegeben werden.' }, { status: 400 })
  }

  const sa = admin()
  if (!sa) return NextResponse.json({ error: 'Service-Role-Key fehlt.' }, { status: 500 })

  // Prüfen ob Ziel-User Auto-Account ist
  const targetEmail = await resolveTargetEmail(sa, body.user_id)
  if (targetEmail === OWNER_EMAIL || isPondruffUser(targetEmail)) {
    return NextResponse.json({
      error: 'Inhaber- und Pondruff-Account haben automatischen Zugang — Toggle nicht erforderlich.',
    }, { status: 400 })
  }

  // Vorherige Werte für Audit-Log
  const { data: prevData } = await sa
    .from('firma_einstellungen')
    .select('qm_ki_zeichnungs_analyse, qm_ki_sichtpruefung')
    .eq('user_id', body.user_id)
    .maybeSingle()
  const prevFlags = normalizeFlags(prevData as Record<string, unknown> | null)

  const payload: Record<string, unknown> = {
    user_id: body.user_id,
    updated_at: new Date().toISOString(),
  }
  if (body.qm_ki_zeichnungs_analyse !== undefined) payload.qm_ki_zeichnungs_analyse = body.qm_ki_zeichnungs_analyse
  if (body.qm_ki_sichtpruefung !== undefined) payload.qm_ki_sichtpruefung = body.qm_ki_sichtpruefung

  const { data, error } = await sa
    .from('firma_einstellungen')
    .upsert(payload, { onConflict: 'user_id' })
    .select('qm_ki_zeichnungs_analyse, qm_ki_sichtpruefung')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const newFlags = normalizeFlags(data as Record<string, unknown> | null)

  // Audit-Log (fire-and-forget)
  const auditBase = { actor: { userId: access.user?.id, email: access.user?.email }, target: { userId: body.user_id, email: targetEmail || undefined } }
  if (body.qm_ki_zeichnungs_analyse !== undefined) {
    await logOwnerAction({ ...auditBase, action: 'qm_ki_zeichnungs_analyse.toggle', details: { previousValue: prevFlags.qm_ki_zeichnungs_analyse, newValue: newFlags.qm_ki_zeichnungs_analyse } })
  }
  if (body.qm_ki_sichtpruefung !== undefined) {
    await logOwnerAction({ ...auditBase, action: 'qm_ki_sichtpruefung.toggle', details: { previousValue: prevFlags.qm_ki_sichtpruefung, newValue: newFlags.qm_ki_sichtpruefung } })
  }

  return NextResponse.json({ userId: body.user_id, flags: newFlags })
}
