/**
 * Petersen KI – geteilte Helper, Types und Row-Definitions
 * für den Daten-Layer (lib/db.ts).
 *
 * Diese Datei wurde aus lib/db.ts extrahiert (Soft-Split): rein interne
 * Hilfsfunktionen + Normalize-Helpers + Row-Types liegen jetzt zentral.
 * lib/db.ts re-importiert sie und bleibt der einzige öffentliche
 * Daten-Layer-Eingang.
 */

import { createSupabaseClient } from '../supabase'
import type { BookingStatus, EmployeeTierId, PackageId, PilotId } from '../pricingConfig'

// ── Supabase-Client-Wrapper ──────────────────────────────────────────────────

export function db() { return createSupabaseClient() }

// ── Primitive Helpers ────────────────────────────────────────────────────────

export function today() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.')
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function formatEuro(value: unknown) {
  const amount = toNumber(value)
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function isSchemaMismatch(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const schemaError = error as { code?: string; message?: string; details?: string }
  return ['42703', '42804', 'PGRST204'].includes(schemaError.code ?? '')
    || /column|schema cache|type/i.test(`${schemaError.message ?? ''} ${schemaError.details ?? ''}`)
}

export async function getCurrentUserId() {
  const supabase = db()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = auth.user?.id
  if (!userId) throw new Error('Nicht angemeldet.')
  return userId
}

// ── DB-Row-Types (intern) ────────────────────────────────────────────────────

export type EinkaufLieferantRecord = {
  id: string
  name?: string | null
}

export type BillingSubscriptionRow = {
  id: string
  user_id?: string | null
  user_key?: string | null
  user_email?: string | null
  customer_id?: string | null
  package_id?: string | null
  pilot_ids?: string[] | null
  employee_tier?: string | null
  monthly_price?: number | null
  status?: string | null
  software_enabled?: boolean | null
  next_payment?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type OwnerNotificationRow = {
  id: string
  source?: string | null
  severity?: string | null
  type?: string | null
  title?: string | null
  message?: string | null
  link_url?: string | null
  entity_type?: string | null
  entity_id?: string | null
  dedupe_key?: string | null
  seen_at?: string | null
  created_at?: string | null
}

export type BueroKundeRecord = {
  id: string
  auth_user_id?: string | null
  source?: string | null
  billing_subscription_id?: string | null
  name?: string | null
  software_enabled?: boolean | null
}

export type BueroAngebotRecord = {
  id: string
  kunde_id?: string | null
  kunde?: string | null
  titel?: string | null
  betrag?: string | null
  datum?: string | null
  gueltig?: string | null
  status?: string | null
  nummer?: string | null
  verschickt_am?: string | null
}

export type BueroAuftragRecord = {
  id: string
  kunde_id?: string | null
  billing_subscription_id?: string | null
  kunde?: string | null
  beschreibung?: string | null
  wert?: string | null
  start?: string | null
  ende?: string | null
  status?: string | null
  fortschritt?: number | null
  angebot_id?: string | null
  ab_verschickt_am?: string | null
  ab_nummer?: string | null
}

export type BueroRechnungRecord = {
  id: string
  kunde_id?: string | null
  billing_subscription_id?: string | null
  kunde?: string | null
  nummer?: string | null
  rechnungstyp?: string | null
  betrag?: string | null
  summe?: number | null
  netto?: number | null
  steuer_satz?: number | null
  steuerbetrag?: number | null
  pdf_url?: string | null
  payment_provider?: string | null
  provider_ref?: string | null
  payment_link_id?: string | null
  payment_link_url?: string | null
  payment_link_reference?: string | null
  payment_link_status?: string | null
  payment_link_created_at?: string | null
  payment_link_error?: string | null
  auto_generated?: boolean | null
  leistungszeitraum_von?: string | null
  leistungszeitraum_bis?: string | null
  faellig?: string | null
  erstellt?: string | null
  status?: string | null
  bezahlt_am?: string | null
  mahnung_count?: number | null
}

export type BillingPaymentRow = {
  id: string
  customer_id?: string | null
  billing_subscription_id?: string | null
  invoice_id?: string | null
  provider?: string | null
  provider_ref?: string | null
  method?: string | null
  status?: string | null
  amount?: number | null
  currency?: string | null
  booked_at?: string | null
  last_synced_at?: string | null
  status_source?: string | null
  external_reference?: string | null
  provider_event_id?: string | null
  failure_reason?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}

export type BueroEingangsrechnungRecord = {
  id: string
  lieferant_id?: string | null
  lieferant?: string | null
  rechnungsnummer?: string | null
  rechnungsdatum?: string | null
  faelligkeit?: string | null
  betrag_netto?: number | null
  mwst?: number | null
  betrag_brutto?: number | null
  status?: string | null
  kategorie?: string | null
  iban?: string | null
  verwendungszweck?: string | null
  notiz?: string | null
  dokument_url?: string | null
  dokument_id?: string | null
  bezahlt_am?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type EinkaufBestellungRecord = {
  id: string
  lieferant_id?: string | null
  lieferant?: string | null
  artikel?: string | null
  menge?: number | string | null
  einheit?: string | null
  einkaufspreis?: string | null
  gesamt?: string | null
  status?: string | null
  bestellt_am?: string | null
  erwartet_am?: string | null
  geliefert_am?: string | null
  notiz?: string | null
  einzelpreis?: number | string | null
  gesamtpreis?: number | string | null
  bestelldatum?: string | null
  lieferdatum_soll?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type EinkaufWareneingangRecord = {
  id: string | number
  bestellung_id?: string | null
  lieferant?: string | null
  artikel?: string | null
  menge?: number | string | null
  einheit?: string | null
  datum?: string | null
  qualitaet?: string | null
  mitarbeiter?: string | null
  notiz?: string | null
  eingangsdatum?: string | null
  menge_bestellt?: number | string | null
  menge_erhalten?: number | string | null
  created_at?: string | null
}

// ── Index-Helpers ────────────────────────────────────────────────────────────

export async function listEinkaufLieferantenIndex() {
  const { data, error } = await db().from('einkauf_lieferanten').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as EinkaufLieferantRecord[]
  return {
    byId: new Map(rows.map(row => [row.id, row])),
    byName: new Map(rows.filter(row => row.name).map(row => [String(row.name).trim().toLowerCase(), row])),
  }
}

export async function listBueroKundenIndex() {
  const { data, error } = await db().from('buero_kunden').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as BueroKundeRecord[]
  return {
    byId: new Map(rows.map(row => [row.id, row])),
    byName: new Map(rows.filter(row => row.name).map(row => [String(row.name).trim().toLowerCase(), row])),
  }
}

// ── Normalize-Funktionen ─────────────────────────────────────────────────────

export function normalizeBillingSubscription(row: BillingSubscriptionRow) {
  const packageId = firstText(row.package_id)
  return {
    id: row.id,
    userId: firstText(row.user_id) || undefined,
    userKey: firstText(row.user_key),
    userEmail: firstText(row.user_email),
    packageId: packageId ? packageId as PackageId : undefined,
    pilotIds: Array.isArray(row.pilot_ids) ? row.pilot_ids.filter(Boolean) as PilotId[] : [],
    employeeTier: firstText(row.employee_tier, '1-3') as EmployeeTierId,
    monthlyPrice: typeof row.monthly_price === 'number' ? row.monthly_price : null,
    status: firstText(row.status, 'pending_payment') as BookingStatus,
    softwareEnabled: Boolean(row.software_enabled),
    createdAt: firstText(row.created_at),
    updatedAt: firstText(row.updated_at),
    nextPayment: firstText(row.next_payment) || undefined,
  }
}

export function normalizeOwnerNotification(row: OwnerNotificationRow) {
  const source = firstText(row.source, 'system')
  const severity = firstText(row.severity, 'info')
  return {
    id: row.id,
    source: (['billing', 'qonto', 'stripe', 'buero_pilot', 'system'].includes(source) ? source : 'system') as 'billing' | 'qonto' | 'stripe' | 'buero_pilot' | 'system',
    severity: (['info', 'warn', 'error', 'success'].includes(severity) ? severity : 'info') as 'info' | 'warn' | 'error' | 'success',
    type: firstText(row.type, 'system.notice'),
    title: firstText(row.title, 'Hinweis'),
    message: firstText(row.message) || undefined,
    linkUrl: firstText(row.link_url) || undefined,
    entityType: firstText(row.entity_type) || undefined,
    entityId: firstText(row.entity_id) || undefined,
    dedupeKey: firstText(row.dedupe_key) || undefined,
    seenAt: firstText(row.seen_at) || undefined,
    createdAt: firstText(row.created_at, new Date().toISOString()),
  }
}

export function normalizeBillingPayment(row: BillingPaymentRow) {
  return {
    id: row.id,
    customerId: firstText(row.customer_id) || undefined,
    billingSubscriptionId: firstText(row.billing_subscription_id) || undefined,
    invoiceId: firstText(row.invoice_id) || undefined,
    provider: firstText(row.provider, 'stripe'),
    providerRef: firstText(row.provider_ref) || undefined,
    method: firstText(row.method) || undefined,
    status: firstText(row.status, 'pending'),
    amount: typeof row.amount === 'number' ? row.amount : 0,
    currency: firstText(row.currency, 'EUR'),
    bookedAt: firstText(row.booked_at) || undefined,
    lastSyncedAt: firstText(row.last_synced_at) || undefined,
    statusSource: firstText(row.status_source, 'unknown') || undefined,
    externalReference: firstText(row.external_reference) || undefined,
    providerEventId: firstText(row.provider_event_id) || undefined,
    failureReason: firstText(row.failure_reason) || undefined,
    metadata: row.metadata ?? undefined,
    createdAt: firstText(row.created_at, new Date().toISOString()),
    updatedAt: firstText(row.updated_at, new Date().toISOString()),
  }
}

export function normalizeEinkaufBestellung(
  row: EinkaufBestellungRecord,
  lieferantenById: Map<string, EinkaufLieferantRecord>,
) {
  const lieferantName = firstText(row.lieferant, row.lieferant_id ? lieferantenById.get(row.lieferant_id)?.name ?? '' : '')
  const einzelpreis = firstText(row.einkaufspreis, row.einzelpreis != null ? formatEuro(row.einzelpreis) : '')
  const gesamt = firstText(row.gesamt, row.gesamtpreis != null ? formatEuro(row.gesamtpreis) : '')
  return {
    ...row,
    lieferant_id: row.lieferant_id ?? undefined,
    lieferant: lieferantName,
    artikel: row.artikel ?? '',
    menge: toNumber(row.menge),
    einheit: firstText(row.einheit, 'Stk'),
    einkaufspreis: einzelpreis,
    gesamt,
    status: firstText(row.status, 'Entwurf'),
    bestellt_am: firstText(row.bestellt_am, row.bestelldatum),
    erwartet_am: firstText(row.erwartet_am, row.lieferdatum_soll),
    geliefert_am: firstText(row.geliefert_am),
    notiz: firstText(row.notiz),
  }
}

export function normalizeEinkaufWareneingang(
  row: EinkaufWareneingangRecord,
  bestellungenById: Map<string, ReturnType<typeof normalizeEinkaufBestellung>>,
) {
  const bestellung = row.bestellung_id ? bestellungenById.get(row.bestellung_id) : undefined
  return {
    ...row,
    id: String(row.id),
    bestellung_id: firstText(row.bestellung_id),
    lieferant: firstText(row.lieferant, bestellung?.lieferant),
    artikel: firstText(row.artikel, bestellung?.artikel),
    menge: toNumber(row.menge || row.menge_erhalten || row.menge_bestellt),
    einheit: firstText(row.einheit, bestellung?.einheit, 'Stk'),
    datum: firstText(row.datum, row.eingangsdatum),
    qualitaet: firstText(row.qualitaet, 'OK'),
    mitarbeiter: firstText(row.mitarbeiter, '—'),
    notiz: firstText(row.notiz),
  }
}

export function normalizeBueroAngebot(
  row: BueroAngebotRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
    nummer: firstText(row.nummer) || undefined,
    verschickt_am: firstText(row.verschickt_am) || undefined,
  }
}

export function normalizeBueroAuftrag(
  row: BueroAuftragRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    billing_subscription_id: row.billing_subscription_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
    angebot_id: firstText(row.angebot_id) || undefined,
    ab_verschickt_am: firstText(row.ab_verschickt_am) || undefined,
    ab_nummer: firstText(row.ab_nummer) || undefined,
  }
}

export function normalizeBueroRechnung(
  row: BueroRechnungRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
    mahnung_count: typeof row.mahnung_count === 'number' ? row.mahnung_count : 0,
  }
}

export function normalizeBueroEingangsrechnung(
  row: BueroEingangsrechnungRecord,
  lieferantenById: Map<string, EinkaufLieferantRecord>,
) {
  return {
    ...row,
    lieferant_id: row.lieferant_id ?? undefined,
    lieferant: firstText(row.lieferant, row.lieferant_id ? lieferantenById.get(row.lieferant_id)?.name ?? '' : ''),
  }
}
