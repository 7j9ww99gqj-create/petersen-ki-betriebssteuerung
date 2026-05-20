/**
 * Owner-Audit-Log Helper.
 *
 * Loggt kritische Inhaber-Aktionen (Kundenfreischaltung, Sperren,
 * Pondruff-Flag-Toggle, Rechnungserstellung) in `public.owner_audit_log`.
 *
 * Nutzt Service-Role-Client; nur fuer Server-Code (API-Routes).
 */

import { createClient } from '@supabase/supabase-js'

export type OwnerAuditAction =
  | 'customer.unlock'
  | 'customer.suspend'
  | 'customer.status_change'
  | 'pondruff_flag.toggle'
  | 'qm_ki_zeichnungs_analyse.toggle'
  | 'qm_ki_sichtpruefung.toggle'
  | 'invoice.create'

export type OwnerAuditActor = {
  userId?: string | null
  email?: string | null
}

export type OwnerAuditTarget = {
  userId?: string | null
  email?: string | null
}

export type OwnerAuditEntry = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_email: string | null
  action: string
  target_user_id: string | null
  target_email: string | null
  details: Record<string, unknown>
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function logOwnerAction(params: {
  actor: OwnerAuditActor
  action: OwnerAuditAction
  target?: OwnerAuditTarget
  details?: Record<string, unknown>
}): Promise<void> {
  const sa = serviceClient()
  if (!sa) return
  try {
    await sa.from('owner_audit_log').insert({
      actor_user_id: params.actor.userId ?? null,
      actor_email: params.actor.email ?? null,
      action: params.action,
      target_user_id: params.target?.userId ?? null,
      target_email: params.target?.email ?? null,
      details: params.details ?? {},
    })
  } catch {
    // Audit-Log darf produktive Aktion niemals blockieren — Fehler schlucken.
  }
}

export async function listOwnerAuditLog(limit = 50): Promise<OwnerAuditEntry[]> {
  const sa = serviceClient()
  if (!sa) return []
  const { data, error } = await sa
    .from('owner_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as OwnerAuditEntry[]
}
