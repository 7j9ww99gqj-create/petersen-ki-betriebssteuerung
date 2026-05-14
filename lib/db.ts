/**
 * Petersen KI – Supabase Daten-Layer
 * Alle CRUD-Operationen für die Piloten.
 * Demo-Nutzer (hasDemoCookie) verwenden statische Daten in den Pilots.
 */
import { createSupabaseClient } from './supabase'
import { normalizeDocumentStoragePath } from './documents'
import { genId } from './ids'
import type { BookingStatus, EmployeeTierId, PackageId, PilotId } from './pricingConfig'

function db() { return createSupabaseClient() }

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.')
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatEuro(value: unknown) {
  const amount = toNumber(value)
  return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function isSchemaMismatch(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const schemaError = error as { code?: string; message?: string; details?: string }
  return ['42703', '42804', 'PGRST204'].includes(schemaError.code ?? '')
    || /column|schema cache|type/i.test(`${schemaError.message ?? ''} ${schemaError.details ?? ''}`)
}

type EinkaufLieferantRecord = {
  id: string
  name?: string | null
}

type BillingSubscriptionRow = {
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

type OwnerNotificationRow = {
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

type BueroKundeRecord = {
  id: string
  auth_user_id?: string | null
  source?: string | null
  billing_subscription_id?: string | null
  name?: string | null
  software_enabled?: boolean | null
}

type BueroAngebotRecord = {
  id: string
  kunde_id?: string | null
  kunde?: string | null
  titel?: string | null
  betrag?: string | null
  datum?: string | null
  gueltig?: string | null
  status?: string | null
}

type BueroAuftragRecord = {
  id: string
  kunde_id?: string | null
  kunde?: string | null
  beschreibung?: string | null
  wert?: string | null
  start?: string | null
  ende?: string | null
  status?: string | null
  fortschritt?: number | null
}

type BueroRechnungRecord = {
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
}

type BillingPaymentRow = {
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

type BueroEingangsrechnungRecord = {
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

type EinkaufBestellungRecord = {
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

type EinkaufWareneingangRecord = {
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

async function listEinkaufLieferantenIndex() {
  const { data, error } = await db().from('einkauf_lieferanten').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as EinkaufLieferantRecord[]
  return {
    byId: new Map(rows.map(row => [row.id, row])),
    byName: new Map(rows.filter(row => row.name).map(row => [String(row.name).trim().toLowerCase(), row])),
  }
}

async function listBueroKundenIndex() {
  const { data, error } = await db().from('buero_kunden').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as BueroKundeRecord[]
  return {
    byId: new Map(rows.map(row => [row.id, row])),
    byName: new Map(rows.filter(row => row.name).map(row => [String(row.name).trim().toLowerCase(), row])),
  }
}

function normalizeBillingSubscription(row: BillingSubscriptionRow) {
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

export type OwnerNotification = {
  id: string
  source: 'billing' | 'qonto' | 'stripe' | 'buero_pilot' | 'system'
  severity: 'info' | 'warn' | 'error' | 'success'
  type: string
  title: string
  message?: string
  linkUrl?: string
  entityType?: string
  entityId?: string
  dedupeKey?: string
  seenAt?: string
  createdAt: string
}

export type BillingPaymentRecord = {
  id: string
  customerId?: string
  billingSubscriptionId?: string
  invoiceId?: string
  provider: string
  providerRef?: string
  method?: string
  status: string
  amount: number
  currency: string
  bookedAt?: string
  lastSyncedAt?: string
  statusSource?: string
  externalReference?: string
  providerEventId?: string
  failureReason?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AuditLogRecord = {
  id: string
  ownerUserId?: string
  actorUserId?: string
  action: string
  targetType: string
  targetId?: string
  payload?: Record<string, unknown>
  createdAt: string
}

export type OwnerBillingSnapshot = {
  activeCustomers: number
  pendingApprovals: number
  failedPayments: number
  openInvoices: number
  monthlyRecurringRevenue: number
  unreadNotifications: number
}

export type OwnerRecentActivity = {
  id: string
  source: 'billing' | 'qonto' | 'stripe' | 'system'
  severity: 'info' | 'warn' | 'error' | 'success'
  title: string
  description: string
  linkUrl?: string
  createdAt: string
}

export type OwnerDashboardSnapshot = OwnerBillingSnapshot & {
  revenueTotal: number
  pendingActivations: number
  recentActivities: OwnerRecentActivity[]
}

function normalizeOwnerNotification(row: OwnerNotificationRow): OwnerNotification {
  const source = firstText(row.source, 'system')
  const severity = firstText(row.severity, 'info')
  return {
    id: row.id,
    source: (['billing', 'qonto', 'stripe', 'buero_pilot', 'system'].includes(source) ? source : 'system') as OwnerNotification['source'],
    severity: (['info', 'warn', 'error', 'success'].includes(severity) ? severity : 'info') as OwnerNotification['severity'],
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

function normalizeBillingPayment(row: BillingPaymentRow): BillingPaymentRecord {
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

function normalizeEinkaufBestellung(
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

function normalizeEinkaufWareneingang(
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

function normalizeBueroAngebot(
  row: BueroAngebotRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
  }
}

function normalizeBueroAuftrag(
  row: BueroAuftragRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
  }
}

function normalizeBueroRechnung(
  row: BueroRechnungRecord,
  kundenById: Map<string, BueroKundeRecord>,
) {
  return {
    ...row,
    kunde_id: row.kunde_id ?? undefined,
    kunde: firstText(row.kunde, row.kunde_id ? kundenById.get(row.kunde_id)?.name ?? '' : ''),
  }
}

function normalizeBueroEingangsrechnung(
  row: BueroEingangsrechnungRecord,
  lieferantenById: Map<string, EinkaufLieferantRecord>,
) {
  return {
    ...row,
    lieferant_id: row.lieferant_id ?? undefined,
    lieferant: firstText(row.lieferant, row.lieferant_id ? lieferantenById.get(row.lieferant_id)?.name ?? '' : ''),
  }
}

export type FirmaEinstellungen = {
  id?: string
  user_id?: string
  firmenname: string
  logo_url?: string
  adresse?: string
  plz?: string
  ort?: string
  land?: string
  email?: string
  telefon?: string
  website?: string
  ansprechpartner?: string
  slogan?: string
  branche?: string
  ust_id?: string
  steuernummer?: string
  handelsregister?: string
  geschaeftsfuehrer?: string
  bankname?: string
  iban?: string
  bic?: string
  zahlungsziel_tage?: number
  standard_mwst?: number
  standard_waehrung?: string
  dokument_footer?: string
  briefpapier_layout?: Record<string, unknown>
  onboarding_completed?: boolean
  created_at?: string
  updated_at?: string
}

// ── FIRMA / MANDANT ───────────────────────────────────────────────────────────

export async function getFirmaEinstellungen() {
  const { data, error } = await db()
    .from('firma_einstellungen')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data as FirmaEinstellungen | null
}

export async function upsertFirmaEinstellungen(data: FirmaEinstellungen) {
  const { data: saved, error } = await db()
    .from('firma_einstellungen')
    .upsert({
      ...data,
      land: data.land || 'Deutschland',
      standard_waehrung: data.standard_waehrung || 'EUR',
      onboarding_completed: data.onboarding_completed ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return saved as FirmaEinstellungen
}

export async function uploadFirmenLogo(file: File) {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Kein Benutzer für Logo-Upload gefunden.')
  const ext = file.name.split('.').pop() || 'png'
  const path = `${userId}/firma/logo_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('dokumente').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = await supabase.storage.from('dokumente').createSignedUrl(path, 60 * 60 * 24 * 365)
  return { path, url: data?.signedUrl ?? path }
}

export async function deleteFirmenLogo(pathOrUrl: string) {
  const marker = '/object/sign/dokumente/'
  const path = pathOrUrl.includes(marker)
    ? decodeURIComponent(pathOrUrl.split(marker)[1]?.split('?')[0] ?? '')
    : pathOrUrl
  if (!path) return
  const { error } = await db().storage.from('dokumente').remove([path])
  if (error) throw error
}

export async function markFirmaOnboardingCompleted() {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmendaten vorhanden.')
  return upsertFirmaEinstellungen({ ...current, onboarding_completed: true })
}

async function getCurrentUserId() {
  const supabase = db()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = auth.user?.id
  if (!userId) throw new Error('Nicht angemeldet.')
  return userId
}

export async function getBillingSubscription() {
  const userId = await getCurrentUserId()
  const { data, error } = await db()
    .from('billing_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeBillingSubscription(data as BillingSubscriptionRow) : null
}

export async function upsertBillingSubscription(input: {
  userKey: string
  userEmail?: string
  packageId?: PackageId
  pilotIds: PilotId[]
  employeeTier: EmployeeTierId
  monthlyPrice: number | null
  status: BookingStatus
  softwareEnabled?: boolean
  nextPayment?: string | null
}) {
  const userId = await getCurrentUserId()
  const current = await getBillingSubscription()
  const payload = {
    id: current?.id ?? genId('BOOK'),
    user_id: userId,
    user_key: input.userKey,
    user_email: input.userEmail ?? null,
    package_id: input.packageId ?? null,
    pilot_ids: input.pilotIds,
    employee_tier: input.employeeTier,
    monthly_price: input.monthlyPrice,
    status: input.status,
    software_enabled: input.softwareEnabled ?? current?.softwareEnabled ?? false,
    next_payment: input.nextPayment ?? null,
    updated_at: new Date().toISOString(),
  }

  if (current) {
    const { data, error } = await db()
      .from('billing_subscriptions')
      .update(payload)
      .eq('id', current.id)
      .select('*')
      .single()
    if (error) throw error
    return normalizeBillingSubscription(data as BillingSubscriptionRow)
  }

  const { data, error } = await db()
    .from('billing_subscriptions')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return normalizeBillingSubscription(data as BillingSubscriptionRow)
}

export async function updateBillingSubscriptionStatus(status: BookingStatus) {
  const current = await getBillingSubscription()
  if (!current) return null

  const { data, error } = await db()
    .from('billing_subscriptions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select('*')
    .single()
  if (error) throw error
  return normalizeBillingSubscription(data as BillingSubscriptionRow)
}

export async function listBillingSubscriptionsForOwner() {
  const { data, error } = await db()
    .from('billing_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as BillingSubscriptionRow[]).map(normalizeBillingSubscription)
}

export async function updateBillingSubscriptionControls(id: string, input: {
  status?: BookingStatus
  softwareEnabled?: boolean
}) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (typeof input.status === 'string') payload.status = input.status
  if (typeof input.softwareEnabled === 'boolean') payload.software_enabled = input.softwareEnabled

  const { data, error } = await db()
    .from('billing_subscriptions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return normalizeBillingSubscription(data as BillingSubscriptionRow)
}

export async function listOwnerNotifications(limit = 20) {
  const { data, error } = await db()
    .from('owner_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as OwnerNotificationRow[]).map(normalizeOwnerNotification)
}

export async function upsertBillingPayment(input: {
  id?: string
  customer_id?: string
  billing_subscription_id?: string
  invoice_id?: string
  provider?: string
  provider_ref?: string
  method?: string
  status: string
  amount: number
  currency?: string
  booked_at?: string
  last_synced_at?: string
  status_source?: string
  external_reference?: string
  provider_event_id?: string
  failure_reason?: string
  metadata?: Record<string, unknown>
}) {
  const payload = {
    id: input.id ?? genId('PAY'),
    customer_id: input.customer_id ?? null,
    billing_subscription_id: input.billing_subscription_id ?? null,
    invoice_id: input.invoice_id ?? null,
    provider: input.provider ?? 'stripe',
    provider_ref: input.provider_ref ?? null,
    method: input.method ?? null,
    status: input.status,
    amount: input.amount,
    currency: input.currency ?? 'EUR',
    booked_at: input.booked_at ?? null,
    last_synced_at: input.last_synced_at ?? null,
    status_source: input.status_source ?? 'unknown',
    external_reference: input.external_reference ?? null,
    provider_event_id: input.provider_event_id ?? null,
    failure_reason: input.failure_reason ?? null,
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db()
    .from('billing_payments')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return normalizeBillingPayment(data as BillingPaymentRow)
}

export async function listBillingPaymentsBySubscription(subscriptionId: string) {
  const { data, error } = await db()
    .from('billing_payments')
    .select('*')
    .eq('billing_subscription_id', subscriptionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as BillingPaymentRow[]).map(normalizeBillingPayment)
}

export async function listBillingPayments(limit = 100) {
  const { data, error } = await db()
    .from('billing_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as BillingPaymentRow[]).map(normalizeBillingPayment)
}

export async function appendAuditLog(input: {
  action: string
  targetType: string
  targetId?: string
  ownerUserId?: string
  payload?: Record<string, unknown>
}) {
  const { data, error } = await db()
    .from('audit_logs')
    .insert({
      id: genId('AUD'),
      owner_user_id: input.ownerUserId ?? null,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      payload: input.payload ?? {},
    })
    .select('*')
    .single()
  if (error) throw error
  const row = data as {
    id: string
    owner_user_id?: string | null
    actor_user_id?: string | null
    action?: string | null
    target_type?: string | null
    target_id?: string | null
    payload?: Record<string, unknown> | null
    created_at?: string | null
  }
  return {
    id: row.id,
    ownerUserId: firstText(row.owner_user_id) || undefined,
    actorUserId: firstText(row.actor_user_id) || undefined,
    action: firstText(row.action),
    targetType: firstText(row.target_type),
    targetId: firstText(row.target_id) || undefined,
    payload: row.payload ?? undefined,
    createdAt: firstText(row.created_at, new Date().toISOString()),
  } as AuditLogRecord
}

export async function listAuditLogs(limit = 20) {
  const { data, error } = await db()
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as Array<{
    id: string
    owner_user_id?: string | null
    actor_user_id?: string | null
    action?: string | null
    target_type?: string | null
    target_id?: string | null
    payload?: Record<string, unknown> | null
    created_at?: string | null
  }>).map(row => ({
    id: row.id,
    ownerUserId: firstText(row.owner_user_id) || undefined,
    actorUserId: firstText(row.actor_user_id) || undefined,
    action: firstText(row.action),
    targetType: firstText(row.target_type),
    targetId: firstText(row.target_id) || undefined,
    payload: row.payload ?? undefined,
    createdAt: firstText(row.created_at, new Date().toISOString()),
  }))
}

export async function getNextInvoiceNumber() {
  const { data, error } = await db().rpc('pk_next_invoice_number')
  if (error) throw error
  if (typeof data !== 'string' || !data.trim()) throw new Error('Rechnungsnummer konnte nicht erzeugt werden.')
  return data.trim()
}

function describeAuditAction(item: AuditLogRecord): { title: string; description: string; source: OwnerRecentActivity['source']; severity: OwnerRecentActivity['severity']; linkUrl?: string } {
  switch (item.action) {
    case 'billing.invoice.created':
      return {
        title: 'Rechnung erzeugt',
        description: `Neue Billing-Rechnung ${item.targetId ?? 'ohne ID'} wurde erstellt.`,
        source: 'billing',
        severity: 'success',
        linkUrl: '/dashboard/buero?tab=rechnungen',
      }
    case 'billing.payment.recorded':
      return {
        title: 'Zahlungsstatus aktualisiert',
        description: `Payment ${item.payload?.status ? String(item.payload.status) : 'aktualisiert'} fuer ${item.payload?.subscriptionId ? String(item.payload.subscriptionId) : 'ein Abo'}.`,
        source: 'stripe',
        severity: item.payload?.status === 'failed' ? 'error' : item.payload?.status === 'paid' ? 'success' : 'info',
        linkUrl: '/dashboard/einstellungen',
      }
    case 'owner.customer.synced_from_subscription':
      return {
        title: 'Owner-Kunde synchronisiert',
        description: `Kundendatensatz ${item.targetId ?? 'ohne ID'} wurde mit Billing abgeglichen.`,
        source: 'billing',
        severity: 'info',
        linkUrl: '/dashboard/einstellungen',
      }
    default:
      return {
        title: item.action,
        description: item.targetId ? `Ziel: ${item.targetId}` : 'Audit-Eintrag aktualisiert.',
        source: item.action.includes('stripe') ? 'stripe' : item.action.includes('qonto') ? 'qonto' : item.action.includes('billing') ? 'billing' : 'system',
        severity: 'info',
      }
  }
}

export async function getOwnerDashboardSnapshot(): Promise<OwnerDashboardSnapshot> {
  const [subscriptions, invoices, notifications, payments, auditLogs] = await Promise.all([
    listBillingSubscriptionsForOwner(),
    getBueroRechnungen(),
    listOwnerNotifications(50),
    listBillingPayments(100),
    listAuditLogs(12),
  ])

  const recentActivities = [
    ...notifications.map(item => ({
      id: `notif:${item.id}`,
      source: item.source === 'buero_pilot' ? 'system' : item.source,
      severity: item.severity,
      title: item.title,
      description: item.message ?? item.type,
      linkUrl: item.linkUrl,
      createdAt: item.createdAt,
    }) satisfies OwnerRecentActivity),
    ...auditLogs.map(item => {
      const summary = describeAuditAction(item)
      return {
        id: `audit:${item.id}`,
        source: summary.source,
        severity: summary.severity,
        title: summary.title,
        description: summary.description,
        linkUrl: summary.linkUrl,
        createdAt: item.createdAt,
      } satisfies OwnerRecentActivity
    }),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return {
    activeCustomers: subscriptions.filter(item => item.softwareEnabled || item.status === 'active').length,
    pendingApprovals: subscriptions.filter(item => item.status === 'pending_payment' || item.status === 'proof_sent').length,
    pendingActivations: subscriptions.filter(item => !item.softwareEnabled && (item.status === 'pending_payment' || item.status === 'proof_sent' || item.status === 'active')).length,
    failedPayments: payments.filter(item => item.status === 'failed').length,
    openInvoices: invoices.filter(item => item.status !== 'Bezahlt').length,
    monthlyRecurringRevenue: subscriptions.reduce((sum, item) => sum + (item.status === 'active' ? item.monthlyPrice ?? 0 : 0), 0),
    revenueTotal: invoices.reduce((sum, item) => sum + ((item.status === 'Bezahlt' ? item.summe ?? 0 : 0)), 0),
    unreadNotifications: notifications.filter(item => !item.seenAt).length,
    recentActivities,
  }
}

export async function getOwnerBillingSnapshot(): Promise<OwnerBillingSnapshot> {
  const snapshot = await getOwnerDashboardSnapshot()
  return {
    activeCustomers: snapshot.activeCustomers,
    pendingApprovals: snapshot.pendingApprovals,
    failedPayments: snapshot.failedPayments,
    openInvoices: snapshot.openInvoices,
    monthlyRecurringRevenue: snapshot.monthlyRecurringRevenue,
    unreadNotifications: snapshot.unreadNotifications,
  }
}

// ── LAGER ────────────────────────────────────────────────────────────────────

export async function getLagerArtikel() {
  const { data, error } = await db().from('lager_artikel').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function upsertLagerArtikel(artikel: {
  id: string; name: string; kategorie?: string; bestand?: number
  einheit?: string; lagerplatz?: string; status?: string; mindestbestand?: number
}) {
  const { data, error } = await db()
    .from('lager_artikel')
    .upsert({ ...artikel, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerArtikel(id: string) {
  const { error } = await db().from('lager_artikel').delete().eq('id', id)
  if (error) throw error
}

export async function getLagerBewegungen() {
  const { data, error } = await db()
    .from('lager_bewegungen')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertLagerBewegung(b: {
  typ: string; artikel: string; menge: number
  mitarbeiter?: string; status?: string
}) {
  const { data, error } = await db()
    .from('lager_bewegungen')
    .insert({ ...b, datum: today() })
    .select()
  if (error) throw error
  return data
}

// ── BÜRO ─────────────────────────────────────────────────────────────────────

export async function getBueroKunden() {
  const { data, error } = await db().from('buero_kunden').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function getBueroKundeById(id: string) {
  const { data, error } = await db().from('buero_kunden').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertBueroKunde(k: {
  id: string; name: string; typ?: string; ansprechpartner?: string
  email?: string; telefon?: string; ort?: string; umsatz?: string; status?: string
  auth_user_id?: string; source?: string; billing_subscription_id?: string; software_enabled?: boolean
}) {
  const { data, error } = await db()
    .from('buero_kunden')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteBueroKunde(id: string) {
  const { error } = await db().from('buero_kunden').delete().eq('id', id)
  if (error) throw error
}

export async function getBueroAngebote() {
  const [{ data, error }, kundenIndex] = await Promise.all([
    db().from('buero_angebote').select('*').order('id', { ascending: false }),
    listBueroKundenIndex(),
  ])
  if (error) throw error
  return ((data ?? []) as BueroAngebotRecord[]).map(row => normalizeBueroAngebot(row, kundenIndex.byId))
}

export async function upsertBueroAngebot(a: {
  id: string; kunde_id?: string; kunde?: string; titel?: string; betrag?: string
  datum?: string; gueltig?: string; status?: string
}) {
  const kundenIndex = await listBueroKundenIndex()
  const kundeRecord = a.kunde_id
    ? kundenIndex.byId.get(a.kunde_id)
    : a.kunde
      ? kundenIndex.byName.get(a.kunde.trim().toLowerCase())
      : undefined
  const { data, error } = await db()
    .from('buero_angebote')
    .upsert({
      ...a,
      kunde_id: a.kunde_id ?? kundeRecord?.id ?? null,
      kunde: firstText(a.kunde, kundeRecord?.name),
      updated_at: new Date().toISOString(),
    })
    .select()
  if (error) throw error
  return data
}

export async function getBueroAngebotById(id: string) {
  const [angebot, kundenIndex] = await Promise.all([
    db().from('buero_angebote').select('*').eq('id', id).maybeSingle(),
    listBueroKundenIndex(),
  ])
  if (angebot.error) throw angebot.error
  if (!angebot.data) return null
  return normalizeBueroAngebot(angebot.data as BueroAngebotRecord, kundenIndex.byId)
}

export async function getBueroAuftraege() {
  const [{ data, error }, kundenIndex] = await Promise.all([
    db().from('buero_auftraege').select('*').order('id', { ascending: false }),
    listBueroKundenIndex(),
  ])
  if (error) throw error
  return ((data ?? []) as BueroAuftragRecord[]).map(row => normalizeBueroAuftrag(row, kundenIndex.byId))
}

export async function upsertBueroAuftrag(a: {
  id: string; kunde_id?: string; kunde?: string; beschreibung?: string; wert?: string
  start?: string; ende?: string; status?: string; fortschritt?: number
}) {
  const kundenIndex = await listBueroKundenIndex()
  const kundeRecord = a.kunde_id
    ? kundenIndex.byId.get(a.kunde_id)
    : a.kunde
      ? kundenIndex.byName.get(a.kunde.trim().toLowerCase())
      : undefined
  const { data, error } = await db()
    .from('buero_auftraege')
    .upsert({
      ...a,
      kunde_id: a.kunde_id ?? kundeRecord?.id ?? null,
      kunde: firstText(a.kunde, kundeRecord?.name),
      updated_at: new Date().toISOString(),
    })
    .select()
  if (error) throw error
  return data
}

export async function getBueroAuftragById(id: string) {
  const [auftrag, kundenIndex] = await Promise.all([
    db().from('buero_auftraege').select('*').eq('id', id).maybeSingle(),
    listBueroKundenIndex(),
  ])
  if (auftrag.error) throw auftrag.error
  if (!auftrag.data) return null
  return normalizeBueroAuftrag(auftrag.data as BueroAuftragRecord, kundenIndex.byId)
}

export async function getBueroRechnungen() {
  const [{ data, error }, kundenIndex] = await Promise.all([
    db().from('buero_rechnungen').select('*').order('id', { ascending: false }),
    listBueroKundenIndex(),
  ])
  if (error) throw error
  return ((data ?? []) as BueroRechnungRecord[]).map(row => normalizeBueroRechnung(row, kundenIndex.byId))
}

export async function upsertBueroRechnung(r: {
  id: string; kunde_id?: string; billing_subscription_id?: string; kunde?: string; nummer?: string; rechnungstyp?: string
  betrag?: string; summe?: number; netto?: number; steuer_satz?: number; steuerbetrag?: number
  pdf_url?: string; payment_provider?: string; provider_ref?: string
  payment_link_id?: string; payment_link_url?: string; payment_link_reference?: string; payment_link_status?: string; payment_link_created_at?: string; payment_link_error?: string
  auto_generated?: boolean
  leistungszeitraum_von?: string; leistungszeitraum_bis?: string; faellig?: string
  erstellt?: string; status?: string; bezahlt_am?: string
}) {
  const kundenIndex = await listBueroKundenIndex()
  const kundeRecord = r.kunde_id
    ? kundenIndex.byId.get(r.kunde_id)
    : r.kunde
      ? kundenIndex.byName.get(r.kunde.trim().toLowerCase())
      : undefined
  const { data, error } = await db()
    .from('buero_rechnungen')
    .upsert({
      ...r,
      kunde_id: r.kunde_id ?? kundeRecord?.id ?? null,
      kunde: firstText(r.kunde, kundeRecord?.name),
      updated_at: new Date().toISOString(),
    })
    .select()
  if (error) throw error
  return data
}

export async function getBueroRechnungById(id: string) {
  const [rechnung, kundenIndex] = await Promise.all([
    db().from('buero_rechnungen').select('*').eq('id', id).maybeSingle(),
    listBueroKundenIndex(),
  ])
  if (rechnung.error) throw rechnung.error
  if (!rechnung.data) return null
  return normalizeBueroRechnung(rechnung.data as BueroRechnungRecord, kundenIndex.byId)
}

export async function getLatestBueroRechnungBySubscriptionId(subscriptionId: string) {
  const [rechnung, kundenIndex] = await Promise.all([
    db()
      .from('buero_rechnungen')
      .select('*')
      .eq('billing_subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    listBueroKundenIndex(),
  ])
  if (rechnung.error) throw rechnung.error
  if (!rechnung.data) return null
  return normalizeBueroRechnung(rechnung.data as BueroRechnungRecord, kundenIndex.byId)
}

export async function deleteBueroAngebot(id: string) {
  const { error } = await db().from('buero_angebote').delete().eq('id', id)
  if (error) throw error
}

export async function deleteBueroAuftrag(id: string) {
  const { error } = await db().from('buero_auftraege').delete().eq('id', id)
  if (error) throw error
}

export async function deleteBueroRechnung(id: string) {
  const { error } = await db().from('buero_rechnungen').delete().eq('id', id)
  if (error) throw error
}

export async function getBueroEingangsrechnungen() {
  const [result, lieferantenIndex] = await Promise.all([
    db()
      .from('buero_eingangsrechnungen')
      .select('*')
      .order('faelligkeit', { ascending: true }),
    listEinkaufLieferantenIndex(),
  ])
  const { data, error } = result
  if (error) throw error
  return ((data ?? []) as BueroEingangsrechnungRecord[]).map(row => normalizeBueroEingangsrechnung(row, lieferantenIndex.byId))
}

export async function upsertBueroEingangsrechnung(r: {
  id: string
  lieferant_id?: string
  lieferant: string
  rechnungsnummer?: string
  rechnungsdatum?: string
  faelligkeit?: string
  betrag_netto?: number
  mwst?: number
  betrag_brutto?: number
  status?: string
  kategorie?: string
  iban?: string
  verwendungszweck?: string
  notiz?: string
  dokument_url?: string
  dokument_id?: string
  bezahlt_am?: string
}) {
  const lieferantenIndex = await listEinkaufLieferantenIndex()
  const lieferantRecord = r.lieferant_id
    ? lieferantenIndex.byId.get(r.lieferant_id)
    : r.lieferant
      ? lieferantenIndex.byName.get(r.lieferant.trim().toLowerCase())
      : undefined
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .upsert({
      ...r,
      lieferant_id: r.lieferant_id ?? lieferantRecord?.id ?? null,
      lieferant: firstText(r.lieferant, lieferantRecord?.name),
      updated_at: new Date().toISOString(),
    })
    .select()
  if (error) throw error
  return data
}

export async function getBueroEingangsrechnungById(id: string) {
  const [rechnung, lieferantenIndex] = await Promise.all([
    db().from('buero_eingangsrechnungen').select('*').eq('id', id).maybeSingle(),
    listEinkaufLieferantenIndex(),
  ])
  if (rechnung.error) throw rechnung.error
  if (!rechnung.data) return null
  return normalizeBueroEingangsrechnung(rechnung.data as BueroEingangsrechnungRecord, lieferantenIndex.byId)
}

export async function deleteBueroEingangsrechnung(id: string) {
  const { error } = await db().from('buero_eingangsrechnungen').delete().eq('id', id)
  if (error) throw error
}

export async function markEingangsrechnungBezahlt(id: string, bezahlt_am?: string) {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .update({
      status: 'bezahlt',
      bezahlt_am: bezahlt_am ?? new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function updateEingangsrechnungStatus(id: string, status: string) {
  const { data, error } = await db()
    .from('buero_eingangsrechnungen')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function getBueroDokumente() {
  const { data, error } = await db().from('buero_dokumente').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertBueroDokument(d: {
  id: string; name: string; typ?: string; groesse?: string
  datum?: string; kategorie?: string; bezug?: string; storage_path?: string
  status?: string; document_type?: string; confidence?: number; summary?: string
  extracted?: Record<string, unknown>; suggested_actions?: unknown[]; search_text?: string
  eingangsrechnung_id?: string; rechnung_id?: string; angebot_id?: string; auftrag_id?: string
}) {
  const { data, error } = await db().from('buero_dokumente').insert(d).select()
  if (error) throw error
  return data
}

export async function updateBueroDokument(id: string, d: {
  name?: string; typ?: string; groesse?: string; datum?: string; kategorie?: string
  bezug?: string; storage_path?: string; status?: string; document_type?: string
  confidence?: number; summary?: string; extracted?: Record<string, unknown>
  suggested_actions?: unknown[]; search_text?: string
  eingangsrechnung_id?: string | null; rechnung_id?: string | null; angebot_id?: string | null; auftrag_id?: string | null
}) {
  const { data, error } = await db()
    .from('buero_dokumente')
    .update({ ...d, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function deleteBueroDokument(id: string) {
  const supabase = db()
  const { data: existing, error: readError } = await supabase
    .from('buero_dokumente')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()
  if (readError) throw readError

  const storagePath = normalizeDocumentStoragePath((existing as { storage_path?: string | null } | null)?.storage_path)
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('dokumente').remove([storagePath])
    if (storageError && !/not found/i.test(storageError.message ?? '')) throw storageError
  }

  const { error } = await supabase.from('buero_dokumente').delete().eq('id', id)
  if (error) throw error
}

// Datei in Storage hochladen
export async function uploadDokument(file: File, userId: string): Promise<string> {
  const sanitizedName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${Date.now()}_${sanitizedName}`
  const { error } = await db().storage.from('dokumente').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getDokumentUrl(pathOrUrl: string): Promise<string> {
  const normalized = normalizeDocumentStoragePath(pathOrUrl)
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  const { data, error } = await db().storage.from('dokumente').createSignedUrl(normalized, 3600)
  if (error) throw error
  return data?.signedUrl ?? ''
}

export async function getBueroDokumentById(id: string) {
  const { data, error } = await db().from('buero_dokumente').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function getBueroKundeDetailContext(id: string) {
  const [kunde, angebote, auftraege, rechnungen, dokumente] = await Promise.all([
    getBueroKundeById(id),
    getBueroAngebote(),
    getBueroAuftraege(),
    getBueroRechnungen(),
    getBueroDokumente(),
  ])
  if (!kunde) return null
  const kundeName = firstText((kunde as { name?: string | null }).name)
  const relatedAngebote = (angebote ?? []).filter(row => row.kunde_id === id || firstText(row.kunde).toLowerCase() === kundeName.toLowerCase())
  const relatedAuftraege = (auftraege ?? []).filter(row => row.kunde_id === id || firstText(row.kunde).toLowerCase() === kundeName.toLowerCase())
  const relatedRechnungen = (rechnungen ?? []).filter(row => row.kunde_id === id || firstText(row.kunde).toLowerCase() === kundeName.toLowerCase())
  const angebotIds = new Set(relatedAngebote.map(row => row.id))
  const auftragIds = new Set(relatedAuftraege.map(row => row.id))
  const rechnungIds = new Set(relatedRechnungen.map(row => row.id))
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return angebotIds.has(String(doc.angebot_id ?? ''))
      || auftragIds.has(String(doc.auftrag_id ?? ''))
      || rechnungIds.has(String(doc.rechnung_id ?? ''))
      || (!!kundeName && bezug === kundeName.toLowerCase())
    })

  return {
    kunde,
    angebote: relatedAngebote,
    auftraege: relatedAuftraege,
    rechnungen: relatedRechnungen,
    dokumente: relatedDokumente,
  }
}

export async function getEinkaufLieferantDetailContext(id: string) {
  const [lieferant, bestellungen, eingangsrechnungen, dokumente] = await Promise.all([
    getEinkaufLieferantById(id),
    getEinkaufBestellungen(),
    getBueroEingangsrechnungen(),
    getBueroDokumente(),
  ])
  if (!lieferant) return null
  const lieferantName = firstText((lieferant as { name?: string | null }).name)
  const relatedBestellungen = (bestellungen ?? []).filter(row => row.lieferant_id === id || firstText(row.lieferant).toLowerCase() === lieferantName.toLowerCase())
  const relatedEingangsrechnungen = (eingangsrechnungen ?? []).filter(row => row.lieferant_id === id || firstText(row.lieferant).toLowerCase() === lieferantName.toLowerCase())
  const eingangsrechnungIds = new Set(relatedEingangsrechnungen.map(row => row.id))
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return eingangsrechnungIds.has(String(doc.eingangsrechnung_id ?? ''))
      || (!!lieferantName && bezug === lieferantName.toLowerCase())
  })

  return {
    lieferant,
    bestellungen: relatedBestellungen,
    eingangsrechnungen: relatedEingangsrechnungen,
    dokumente: relatedDokumente,
  }
}

export async function getBueroEingangsrechnungDetailContext(id: string) {
  const [eingangsrechnung, dokumente, steuerbelege, bestellungen] = await Promise.all([
    getBueroEingangsrechnungById(id),
    getBueroDokumente(),
    getSteuerBelege(),
    getEinkaufBestellungen(),
  ])
  if (!eingangsrechnung) return null
  const lieferant = eingangsrechnung.lieferant_id
    ? await getEinkaufLieferantById(eingangsrechnung.lieferant_id)
    : null
  const lieferantName = firstText(eingangsrechnung.lieferant, (lieferant as { name?: string | null } | null)?.name)
  const rechnungsnummer = firstText(eingangsrechnung.rechnungsnummer)
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    if (String(doc.id ?? '') === String(eingangsrechnung.dokument_id ?? '')) return true
    if (String(doc.eingangsrechnung_id ?? '') === id) return true
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return (!!lieferantName && bezug === lieferantName.toLowerCase())
  })
  const relatedSteuerbelege = ((steuerbelege ?? []) as Array<Record<string, unknown>>).filter(beleg => {
    const supplier = firstText(beleg.lieferant as string | undefined).toLowerCase()
    const note = `${firstText(beleg.notiz as string | undefined)} ${firstText(beleg.belegnummer as string | undefined)}`.toLowerCase()
    return (!!lieferantName && supplier === lieferantName.toLowerCase())
      || (!!rechnungsnummer && note.includes(rechnungsnummer.toLowerCase()))
  })
  const relatedBestellungen = (bestellungen ?? []).filter(row => row.lieferant_id === eingangsrechnung.lieferant_id || firstText(row.lieferant).toLowerCase() === lieferantName.toLowerCase())

  return {
    eingangsrechnung,
    lieferant,
    dokumente: relatedDokumente,
    steuerbelege: relatedSteuerbelege,
    bestellungen: relatedBestellungen,
  }
}

// ── WERKSTATT ────────────────────────────────────────────────────────────────

export async function getWerkstattKarten() {
  const { data, error } = await db().from('werkstatt_karten').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattKarte(k: {
  id: string; auftragsnr?: string; beschreibung?: string; mitarbeiter?: string
  prioritaet?: string; status?: string; erstellt?: string; geplant?: string
  stunden?: number; fortschritt?: number; maschine?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_karten')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattKarte(id: string) {
  const { error } = await db().from('werkstatt_karten').delete().eq('id', id)
  if (error) throw error
}

export async function getWerkstattMitarbeiter() {
  const { data, error } = await db()
    .from('werkstatt_mitarbeiter')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattMitarbeiter(m: {
  id: string; name: string; rolle?: string; email?: string; telefon?: string
  aktiv?: boolean; notiz?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_mitarbeiter')
    .upsert({ ...m, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattMitarbeiter(id: string) {
  const { error } = await db().from('werkstatt_mitarbeiter').delete().eq('id', id)
  if (error) throw error
}

export async function getWerkstattBereiche() {
  const { data, error } = await db()
    .from('werkstatt_bereiche')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattBereich(b: {
  id: string; name: string; typ?: string; aktiv?: boolean; notiz?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_bereiche')
    .upsert({ ...b, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattBereich(id: string) {
  const { error } = await db().from('werkstatt_bereiche').delete().eq('id', id)
  if (error) throw error
}

export async function getWerkstattZeitbuchungen() {
  const { data, error } = await db()
    .from('werkstatt_zeitbuchungen')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattZeitbuchung(z: {
  mitarbeiter: string; auftragsnr: string; stunden: number
  datum?: string; taetigkeit?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_zeitbuchungen')
    .insert({ ...z, datum: z.datum ?? today() })
    .select()
  if (error) throw error
  return data
}

export async function getWerkstattMaterial() {
  const { data, error } = await db()
    .from('werkstatt_material')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattMaterial(m: {
  artikel: string; menge: number; einheit?: string
  auftragsnr?: string; mitarbeiter?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_material')
    .insert({ ...m, datum: today() })
    .select()
  if (error) throw error
  return data
}

export async function getWerkstattPruefprotokolle() {
  const { data, error } = await db()
    .from('werkstatt_pruefprotokolle')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertWerkstattPruefprotokoll(p: {
  auftragsnr: string; pruefpunkt: string; ergebnis?: string
  pruefer?: string; datum?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_pruefprotokolle')
    .insert({ ...p, datum: p.datum ?? today() })
    .select()
  if (error) throw error
  return data
}

export async function getWerkstattWartungen() {
  const { data, error } = await db()
    .from('werkstatt_wartungen')
    .select('*')
    .order('faellig_am', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattWartung(w: {
  id: string; maschine: string; intervall?: string; faellig_am: string
  letzte_wartung?: string; verantwortlich?: string; status?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_wartungen')
    .upsert({ ...w, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattWartung(id: string) {
  const { error } = await db().from('werkstatt_wartungen').delete().eq('id', id)
  if (error) throw error
}

export async function getWerkstattStoerungen() {
  const { data, error } = await db()
    .from('werkstatt_stoerungen')
    .select('*')
    .order('gemeldet_am', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertWerkstattStoerung(s: {
  id: string; maschine: string; titel: string; beschreibung?: string
  prioritaet?: string; status?: string; gemeldet_von?: string; gemeldet_am?: string
  behoben_am?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('werkstatt_stoerungen')
    .upsert({ ...s, gemeldet_am: s.gemeldet_am ?? today(), updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteWerkstattStoerung(id: string) {
  const { error } = await db().from('werkstatt_stoerungen').delete().eq('id', id)
  if (error) throw error
}

// ── MARKETING ────────────────────────────────────────────────────────────────

export async function getMarketingKampagnen() {
  const { data, error } = await db().from('marketing_kampagnen').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingKampagne(k: {
  id: string; name: string; typ?: string; status?: string; zielgruppe?: string
  start?: string; ende?: string; empfaenger?: number; geoeffnet?: number
  geklickt?: number; konversionen?: number; budget?: string
}) {
  const { data, error } = await db()
    .from('marketing_kampagnen')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingLeads() {
  const { data, error } = await db().from('marketing_leads').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingLead(l: {
  id: string; name: string; firma?: string; email?: string; telefon?: string
  quelle?: string; status?: string; wert?: string; erstellt?: string; betreuer?: string
}) {
  const { data, error } = await db()
    .from('marketing_leads')
    .upsert({ ...l, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingNewsletter() {
  const { data, error } = await db().from('marketing_newsletter').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingNewsletter(n: {
  id: string; betreff: string; vorschau?: string; empfaenger?: number
  datum?: string; status?: string; oeffnungsrate?: number; klickrate?: number
}) {
  const { data, error } = await db()
    .from('marketing_newsletter')
    .upsert({ ...n, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingSeoKeywords() {
  const { data, error } = await db().from('marketing_seo_keywords').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingSeoKeyword(k: {
  id: string; keyword: string; zielseite?: string; intent?: string; suchvolumen?: number
  schwierigkeit?: number; ranking?: number; klicks?: number; status?: string
}) {
  const { data, error } = await db()
    .from('marketing_seo_keywords')
    .upsert({ ...k, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingContentIdeas() {
  const { data, error } = await db().from('marketing_content_ideas').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingContentIdea(c: {
  id: string; titel: string; kanal?: string; ziel?: string; keyword?: string
  hook?: string; cta?: string; status?: string
}) {
  const { data, error } = await db()
    .from('marketing_content_ideas')
    .upsert({ ...c, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingPostingPlans() {
  const { data, error } = await db().from('marketing_posting_plans').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingPostingPlan(p: {
  id: string; titel: string; kanal?: string; datum?: string; status?: string; owner?: string; quelle?: string
}) {
  const { data, error } = await db()
    .from('marketing_posting_plans')
    .upsert({ ...p, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingAutomationRules() {
  const { data, error } = await db().from('marketing_automation_rules').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingAutomationRule(a: {
  id: string; name: string; trigger?: string; aktion?: string; kanal?: string; owner?: string; status?: string
}) {
  const { data, error } = await db()
    .from('marketing_automation_rules')
    .upsert({ ...a, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function getMarketingIntegrationItems() {
  const { data, error } = await db().from('marketing_integration_items').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertMarketingIntegrationItem(i: {
  id: string; name: string; status?: string; datenbasis?: string; letzterSync?: string; naechsterSchritt?: string
}) {
  const { data, error } = await db()
    .from('marketing_integration_items')
    .upsert({ ...i, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

// ── PLANUNG ──────────────────────────────────────────────────────────────────

export async function getPlanungProjekte() {
  const { data, error } = await db().from('planung_projekte').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungProjekt(p: {
  id: string; name: string; kunde?: string; status?: string; start?: string
  ende?: string; budget?: string; fortschritt?: number; beschreibung?: string
  verantwortlich?: string; meilensteine?: object[]
}) {
  const { data, error } = await db()
    .from('planung_projekte')
    .upsert({ ...p, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deletePlanungProjekt(id: string) {
  const { error } = await db().from('planung_projekte').delete().eq('id', id)
  if (error) throw error
}

export async function getPlanungAufgaben() {
  const { data, error } = await db().from('planung_aufgaben').select('*').order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungAufgabe(a: {
  id: string; titel: string; projekt?: string; verantwortlich?: string
  prioritaet?: string; status?: string; faellig?: string; erstellt?: string
}) {
  const { data, error } = await db()
    .from('planung_aufgaben')
    .upsert({ ...a, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deletePlanungAufgabe(id: string) {
  const { error } = await db().from('planung_aufgaben').delete().eq('id', id)
  if (error) throw error
}

export async function getPlanungTermine() {
  const { data, error } = await db().from('planung_termine').select('*').order('datum')
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungTermin(t: {
  id: string; titel: string; datum?: string; uhrzeit?: string
  typ?: string; projekt?: string; teilnehmer?: string
}) {
  const { data, error } = await db().from('planung_termine').upsert(t).select()
  if (error) throw error
  return data
}

export async function deletePlanungTermin(id: string) {
  const { error } = await db().from('planung_termine').delete().eq('id', id)
  if (error) throw error
}

// ── EINKAUF / LIEFERANTEN ────────────────────────────────────────────────────

export async function getEinkaufLieferanten() {
  const { data, error } = await db().from('einkauf_lieferanten').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function getEinkaufLieferantById(id: string) {
  const { data, error } = await db().from('einkauf_lieferanten').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertEinkaufLieferant(l: {
  id: string; name: string; kontakt?: string; email?: string; telefon?: string
  ort?: string; kategorie?: string; zahlungsziel?: string; status?: string; bewertung?: number
}) {
  const { data, error } = await db()
    .from('einkauf_lieferanten')
    .upsert({ ...l, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteEinkaufLieferant(id: string) {
  const { error } = await db().from('einkauf_lieferanten').delete().eq('id', id)
  if (error) throw error
}

export async function getEinkaufBestellungen() {
  const [{ data, error }, lieferantenIndex] = await Promise.all([
    db().from('einkauf_bestellungen').select('*').order('id', { ascending: false }),
    listEinkaufLieferantenIndex(),
  ])
  if (error) throw error
  return ((data ?? []) as EinkaufBestellungRecord[]).map(row => normalizeEinkaufBestellung(row, lieferantenIndex.byId))
}

export async function getEinkaufBestellungById(id: string) {
  const [bestellung, lieferantenIndex] = await Promise.all([
    db().from('einkauf_bestellungen').select('*').eq('id', id).maybeSingle(),
    listEinkaufLieferantenIndex(),
  ])
  if (bestellung.error) throw bestellung.error
  if (!bestellung.data) return null
  return normalizeEinkaufBestellung(bestellung.data as EinkaufBestellungRecord, lieferantenIndex.byId)
}

export async function upsertEinkaufBestellung(b: {
  id: string; lieferant_id?: string; lieferant?: string; artikel?: string; menge?: number; einheit?: string
  einkaufspreis?: string; gesamt?: string; status?: string; bestellt_am?: string
  erwartet_am?: string; geliefert_am?: string; notiz?: string
}) {
  const lieferantenIndex = await listEinkaufLieferantenIndex()
  const lieferantRecord = b.lieferant_id
    ? lieferantenIndex.byId.get(b.lieferant_id)
    : b.lieferant
      ? lieferantenIndex.byName.get(b.lieferant.trim().toLowerCase())
      : undefined
  const menge = toNumber(b.menge)
  const einzelpreis = b.einkaufspreis ? toNumber(b.einkaufspreis) : 0
  const gesamtpreis = b.gesamt ? toNumber(b.gesamt) : menge * einzelpreis
  const payload = {
    id: b.id,
    lieferant_id: b.lieferant_id ?? lieferantRecord?.id ?? null,
    lieferant: firstText(b.lieferant, lieferantRecord?.name),
    artikel: b.artikel ?? '',
    menge,
    einheit: firstText(b.einheit, 'Stk'),
    einkaufspreis: b.einkaufspreis ? formatEuro(b.einkaufspreis) : formatEuro(einzelpreis),
    gesamt: b.gesamt ? formatEuro(b.gesamt) : formatEuro(gesamtpreis),
    status: firstText(b.status, 'Entwurf'),
    bestellt_am: b.bestellt_am ?? '',
    erwartet_am: b.erwartet_am ?? '',
    geliefert_am: b.geliefert_am ?? null,
    notiz: b.notiz ?? null,
    einzelpreis,
    gesamtpreis,
    bestelldatum: b.bestellt_am ?? '',
    lieferdatum_soll: b.erwartet_am ?? '',
    updated_at: new Date().toISOString(),
  }
  const supabase = db()
  const full = await supabase.from('einkauf_bestellungen').upsert(payload).select()
  if (!full.error) return full.data
  if (!isSchemaMismatch(full.error)) throw full.error

  const legacy = await supabase
    .from('einkauf_bestellungen')
    .upsert({
      id: payload.id,
      lieferant: payload.lieferant,
      artikel: payload.artikel,
      menge: payload.menge,
      einheit: payload.einheit,
      einkaufspreis: payload.einkaufspreis,
      gesamt: payload.gesamt,
      status: payload.status,
      bestellt_am: payload.bestellt_am,
      erwartet_am: payload.erwartet_am,
      geliefert_am: payload.geliefert_am,
      notiz: payload.notiz,
      updated_at: payload.updated_at,
    })
    .select()
  if (!legacy.error) return legacy.data
  if (!isSchemaMismatch(legacy.error)) throw legacy.error

  const live = await supabase
    .from('einkauf_bestellungen')
    .upsert({
      id: payload.id,
      lieferant_id: payload.lieferant_id,
      status: payload.status,
      artikel: payload.artikel,
      menge: payload.menge,
      einzelpreis: payload.einzelpreis,
      gesamtpreis: payload.gesamtpreis,
      bestelldatum: payload.bestelldatum,
      lieferdatum_soll: payload.lieferdatum_soll,
      notiz: payload.notiz,
      updated_at: payload.updated_at,
    })
    .select()
  if (live.error) throw live.error
  return live.data
}

export async function getEinkaufWareneingaenge() {
  const [result, bestellungen] = await Promise.all([
    (async () => {
      const preferred = await db()
        .from('einkauf_wareneingaenge')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!preferred.error || !isSchemaMismatch(preferred.error)) return preferred
      return db()
        .from('einkauf_wareneingaenge')
        .select('*')
        .order('id', { ascending: false })
        .limit(200)
    })(),
    getEinkaufBestellungen(),
  ])
  if (result.error) throw result.error
  const bestellungenById = new Map(
    (bestellungen as Array<ReturnType<typeof normalizeEinkaufBestellung>>).map(bestellung => [bestellung.id, bestellung]),
  )
  return ((result.data ?? []) as EinkaufWareneingangRecord[]).map(row => normalizeEinkaufWareneingang(row, bestellungenById))
}

export async function insertEinkaufWareneingang(w: {
  id: string; bestellung_id?: string; lieferant?: string; artikel?: string
  menge?: number; einheit?: string; datum?: string; qualitaet?: string; mitarbeiter?: string
}) {
  const menge = toNumber(w.menge)
  const payload = {
    id: w.id,
    bestellung_id: w.bestellung_id ?? null,
    lieferant: w.lieferant ?? null,
    artikel: w.artikel ?? null,
    menge,
    einheit: firstText(w.einheit, 'Stk'),
    datum: w.datum ?? today(),
    qualitaet: firstText(w.qualitaet, 'OK'),
    mitarbeiter: firstText(w.mitarbeiter, '—'),
    eingangsdatum: w.datum ?? today(),
    menge_bestellt: menge,
    menge_erhalten: menge,
  }
  const supabase = db()
  const full = await supabase.from('einkauf_wareneingaenge').insert(payload).select()
  if (!full.error) return full.data
  if (!isSchemaMismatch(full.error)) throw full.error

  const legacy = await supabase
    .from('einkauf_wareneingaenge')
    .insert({
      id: payload.id,
      bestellung_id: payload.bestellung_id,
      lieferant: payload.lieferant,
      artikel: payload.artikel,
      menge: payload.menge,
      einheit: payload.einheit,
      datum: payload.datum,
      qualitaet: payload.qualitaet,
      mitarbeiter: payload.mitarbeiter,
    })
    .select()
  if (!legacy.error) return legacy.data
  if (!isSchemaMismatch(legacy.error)) throw legacy.error

  const live = await supabase
    .from('einkauf_wareneingaenge')
    .insert({
      bestellung_id: payload.bestellung_id,
      eingangsdatum: payload.eingangsdatum,
      menge_bestellt: payload.menge_bestellt,
      menge_erhalten: payload.menge_erhalten,
      qualitaet: payload.qualitaet,
      notiz: [payload.lieferant, payload.artikel, payload.mitarbeiter].filter(Boolean).join(' | ') || null,
    })
    .select()
  if (live.error) throw live.error
  return live.data
}

export async function getPlanungRessourcen() {
  const { data, error } = await db().from('planung_ressourcen').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertPlanungRessource(r: {
  id: string; name: string; typ?: string; kapazitaet?: number
  genutzt?: number; projekt?: string; status?: string
}) {
  const { data, error } = await db()
    .from('planung_ressourcen')
    .upsert({ ...r, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

// ── STEUER ────────────────────────────────────────────────────────────────────

export async function getSteuerBelege() {
  const { data, error } = await db().from('steuer_belege').select('*').order('datum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerBeleg(b: {
  id: string; lieferant: string; betrag: number; steuerbetrag: number
  steuersatz: number; datum: string; status: string; datei_url?: string; notiz?: string
}) {
  const { data, error } = await db().from('steuer_belege').upsert(b).select()
  if (error) throw error
  return data
}

export async function deleteSteuerBeleg(id: string) {
  const supabase = createSupabaseClient()
  const { data: existing } = await supabase
    .from('steuer_belege')
    .select('datei_url')
    .eq('id', id)
    .single()
  const storagePath = normalizeDocumentStoragePath((existing as { datei_url?: string | null } | null)?.datei_url)
  if (storagePath && !storagePath.startsWith('http')) {
    const { error: storageError } = await supabase.storage.from('dokumente').remove([storagePath])
    if (storageError && !/not found/i.test(storageError.message ?? '')) throw storageError
  }
  const { error } = await supabase.from('steuer_belege').delete().eq('id', id)
  if (error) throw error
}

export async function getSteuerUstva() {
  const { data, error } = await db().from('steuer_ustva').select('*').order('monat', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerUstva(u: {
  id: string; monat: string; umsatzsteuer: number; vorsteuer: number
  zahllast: number; status: string
}) {
  const { data, error } = await db().from('steuer_ustva').upsert(u).select()
  if (error) throw error
  return data
}

export async function uploadSteuerBeleg(file: File, userId: string): Promise<string> {
  const supabase = createSupabaseClient()
  const ext = file.name.split('.').pop()
  const path = `steuer/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('dokumente').upload(path, file)
  if (error) throw error
  return path
}

// ── STEUER BUCHUNGEN ──────────────────────────────────────────────────────────

export async function getSteuerBuchungen() {
  const { data, error } = await db().from('steuer_buchungen').select('*').order('datum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerBuchung(b: {
  id: string; datum: string; buchungstext: string; betrag: number
  soll_konto?: string; haben_konto?: string; steuerkonto?: string
  steuersatz?: number; beleg_id?: string; status?: string
}) {
  const { data, error } = await db().from('steuer_buchungen').upsert(b).select()
  if (error) throw error
  return data
}

// ── STEUER KONTEN ─────────────────────────────────────────────────────────────

export async function getSteuerKonten() {
  const { data, error } = await db().from('steuer_konten').select('*').order('kontonummer')
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerKonto(k: {
  id: string; kontonummer: string; name: string; typ?: string; steuersatz?: number; aktiv?: boolean
}) {
  const { data, error } = await db().from('steuer_konten').upsert(k).select()
  if (error) throw error
  return data
}

// ── IMPORT PROTOKOLLE ─────────────────────────────────────────────────────────

export async function getImportProtokolle() {
  const { data, error } = await db().from('import_protokolle').select('*').order('erstellt_am', { ascending: false }).limit(50)
  if (error) throw error
  return data ?? []
}

export async function insertImportProtokoll(p: {
  id: string; quelle: string; datentyp: string; dateiname: string; status: string
  anzahl_gesamt: number; anzahl_erfolgreich: number; anzahl_fehlerhaft: number; fehler?: object
}) {
  const { data, error } = await db().from('import_protokolle').insert(p).select()
  if (error) throw error
  return data
}

// ── BULK INSERT HELPERS ────────────────────────────────────────────────────────

export async function bulkImportLagerArtikel(rows: Array<{
  id: string; name: string; artikelnummer?: string; beschreibung?: string
  bestand?: number; mindestbestand?: number; einkaufspreis?: number
  verkaufspreis?: number; einheit?: string; lagerort?: string
}>) {
  const { data, error } = await db().from('lager_artikel').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportBueroKunden(rows: Array<{
  id: string; name: string; email?: string; telefon?: string
  adresse?: string; kundennummer?: string; notizen?: string
}>) {
  const { data, error } = await db().from('buero_kunden').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportEinkaufLieferanten(rows: Array<{
  id: string; name: string; email?: string; telefon?: string
  ort?: string; kategorie?: string; zahlungsziel?: string; notiz?: string
}>) {
  const { data, error } = await db().from('einkauf_lieferanten').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportBueroRechnungen(rows: Array<{
  id: string; nummer: string; kunde?: string; datum?: string
  faellig_am?: string; summe?: number; status?: string; notiz?: string
}>) {
  const { data, error } = await db().from('buero_rechnungen').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerBelege(rows: Array<{
  id: string; lieferant: string; betrag: number; datum: string
  steuerbetrag?: number; steuersatz?: number; belegnummer?: string
  kategorie?: string; status?: string; notiz?: string
}>) {
  const { data, error } = await db().from('steuer_belege').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerBuchungen(rows: Array<{
  id: string; datum: string; buchungstext: string; betrag: number
  soll_konto?: string; haben_konto?: string; steuerkonto?: string
  steuersatz?: number; beleg_id?: string; status?: string
}>) {
  const { data, error } = await db().from('steuer_buchungen').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportSteuerKonten(rows: Array<{
  id: string; kontonummer: string; name: string; typ?: string; steuersatz?: number; aktiv?: boolean
}>) {
  const { data, error } = await db().from('steuer_konten').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportWerkstattZeitbuchungen(rows: Array<{
  mitarbeiter: string; auftragsnr: string; stunden: number
  datum?: string; taetigkeit?: string
}>) {
  const { data, error } = await db().from('werkstatt_zeitbuchungen').insert(rows).select()
  if (error) throw error
  return data
}

export async function bulkImportWerkstattMaterial(rows: Array<{
  artikel: string; menge: number; einheit?: string
  auftragsnr?: string; datum?: string; mitarbeiter?: string
}>) {
  const { data, error } = await db().from('werkstatt_material').insert(rows).select()
  if (error) throw error
  return data
}

// ── LAGER STELLPLÄTZE ─────────────────────────────────────────────────────────

export async function getLagerStellplaetze() {
  const { data, error } = await db()
    .from('lager_stellplaetze')
    .select('*')
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function upsertLagerStellplatz(s: {
  id: string; code: string; name?: string; bereich?: string; zone?: string
  gang?: string; regal?: string; ebene?: string; fach?: string; typ?: string
  warengruppe?: string; warenobergruppe?: string; temperaturzone?: string
  max_gewicht?: number; max_volumen?: number; aktiv?: boolean; notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_stellplaetze')
    .upsert({ ...s, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerStellplatz(id: string) {
  const { error } = await db().from('lager_stellplaetze').delete().eq('id', id)
  if (error) throw error
}

// ── LAGER STELLPLATZ-BESTAND ──────────────────────────────────────────────────

export async function getLagerStellplatzBestand() {
  const { data, error } = await db()
    .from('lager_stellplatz_bestand')
    .select('*, lager_stellplaetze(code, bereich, warengruppe, warenobergruppe)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertLagerStellplatzBestand(b: {
  id: string; stellplatz_id: string; artikel_id?: string
  artikelnummer?: string; artikelname?: string; charge?: string
  mhd?: string; menge: number; einheit?: string; status?: string
  eingelagert_am?: string; notiz?: string
  lager_stellplaetze?: unknown
}) {
  const { lager_stellplaetze: _displayOnly, ...payload } = b
  void _displayOnly

  const { data, error } = await db()
    .from('lager_stellplatz_bestand')
    .upsert(payload)
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerStellplatzBestand(id: string) {
  const { error } = await db().from('lager_stellplatz_bestand').delete().eq('id', id)
  if (error) throw error
}

// ── LAGER UMLAGERUNGEN ────────────────────────────────────────────────────────

export async function getLagerUmlagerungen() {
  const { data, error } = await db()
    .from('lager_umlagerungen')
    .select('*')
    .order('datum', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function insertLagerUmlagerung(u: {
  id: string; artikel_id?: string; artikelnummer?: string; artikelname?: string
  von_stellplatz_id?: string; nach_stellplatz_id?: string; charge?: string
  mhd?: string; menge: number; grund?: string; datum?: string; notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_umlagerungen')
    .insert(u)
    .select()
  if (error) throw error
  return data
}

export async function umlagerArtikel(params: {
  vonBestandId: string
  nachStellplatzId: string
  menge: number
  charge?: string
  mhd?: string
  grund?: string
  notiz?: string
  artikelname?: string
  artikelnummer?: string
  artikelId?: string
  vonStellplatzId?: string
}) {
  const supabase = db()

  // 1. Quell-Bestand laden
  const { data: von, error: vonErr } = await supabase
    .from('lager_stellplatz_bestand')
    .select('*')
    .eq('id', params.vonBestandId)
    .single()
  if (vonErr || !von) throw new Error('Quell-Bestand nicht gefunden')
  if (von.menge < params.menge) throw new Error(`Nur ${von.menge} ${von.einheit ?? 'Stk'} verfügbar`)

  // 2. Quell-Menge reduzieren oder Datensatz löschen
  if (von.menge === params.menge) {
    await supabase.from('lager_stellplatz_bestand').delete().eq('id', params.vonBestandId)
  } else {
    await supabase.from('lager_stellplatz_bestand')
      .update({ menge: von.menge - params.menge })
      .eq('id', params.vonBestandId)
  }

  // 3. Ziel-Bestand suchen (gleicher Artikel+Charge+MHD am Ziel-Stellplatz)
  const { data: zielRows } = await supabase
    .from('lager_stellplatz_bestand')
    .select('*')
    .eq('stellplatz_id', params.nachStellplatzId)
    .eq('artikelnummer', von.artikelnummer ?? '')
    .eq('charge', params.charge ?? von.charge ?? '')

  if (zielRows && zielRows.length > 0) {
    await supabase.from('lager_stellplatz_bestand')
      .update({ menge: zielRows[0].menge + params.menge })
      .eq('id', zielRows[0].id)
  } else {
    await supabase.from('lager_stellplatz_bestand').insert({
      id: crypto.randomUUID(),
      stellplatz_id: params.nachStellplatzId,
      artikel_id: von.artikel_id,
      artikelnummer: von.artikelnummer,
      artikelname: von.artikelname,
      charge: params.charge ?? von.charge,
      mhd: params.mhd ?? von.mhd,
      menge: params.menge,
      einheit: von.einheit,
      status: 'Verfügbar',
      eingelagert_am: new Date().toISOString().slice(0, 10),
    })
  }

  // 4. Umlagerung dokumentieren
  await supabase.from('lager_umlagerungen').insert({
    id: `UML-${Date.now().toString(36).toUpperCase()}`,
    artikel_id: von.artikel_id,
    artikelnummer: von.artikelnummer,
    artikelname: von.artikelname,
    von_stellplatz_id: von.stellplatz_id,
    nach_stellplatz_id: params.nachStellplatzId,
    charge: params.charge ?? von.charge,
    mhd: params.mhd ?? von.mhd,
    menge: params.menge,
    grund: params.grund,
    notiz: params.notiz,
    datum: new Date().toISOString(),
  })
}
