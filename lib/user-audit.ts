import { createSupabaseClient } from './supabase'
import { hasDemoCookie } from './auth'

export type AuditAction =
  | 'delete'
  | 'create'
  | 'update'
  | 'archive'
  | 'export'
  | 'anonymize'

export type AuditEntityType =
  | 'rechnung'
  | 'angebot'
  | 'auftrag'
  | 'kunde'
  | 'lieferant'
  | 'beleg'
  | 'artikel'
  | 'projekt'
  | 'werkstatt_karte'
  | 'eingangsrechnung'
  | 'pondruff_rechnung'

export interface AuditLogInput {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  entityLabel?: string | null
  details?: Record<string, unknown>
}

/**
 * Loggt eine kritische User-Aktion in `user_audit_log`.
 * Im Demo-Modus oder ohne Supabase-Config: no-op.
 * Best-effort: schreibt im Hintergrund, blockiert die UI nicht.
 */
export function logAuditAction(input: AuditLogInput): void {
  if (typeof window === 'undefined') return
  if (hasDemoCookie()) return
  try {
    const supabase = createSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      void supabase.from('user_audit_log').insert({
        user_id: data.user.id,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        entity_label: input.entityLabel ?? null,
        details: input.details ?? {},
      })
    })
  } catch {
    // Best-effort — Audit-Log darf User-Action nie blockieren
  }
}
