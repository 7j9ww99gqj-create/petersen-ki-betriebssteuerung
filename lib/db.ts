/**
 * Petersen KI – Supabase Daten-Layer
 * Alle CRUD-Operationen für die Piloten.
 * Demo-Nutzer (hasDemoCookie) verwenden statische Daten in den Pilots.
 *
 * Interne Helpers/Types/Normalize-Funktionen liegen in lib/db/_shared.ts
 * (Soft-Split, halbiert die effektive Code-Größe dieser Datei).
 */
import { createSupabaseClient } from './supabase'
import { normalizeDocumentStoragePath } from './documents'
import { genId } from './ids'
import { logAuditAction } from './user-audit'
import type { BookingStatus, EmployeeTierId, PackageId, PilotId } from './pricingConfig'
import {
  db,
  today,
  firstText,
  toNumber,
  formatEuro,
  isSchemaMismatch,
  getCurrentUserId,
  listEinkaufLieferantenIndex,
  listBueroKundenIndex,
  normalizeBillingSubscription,
  normalizeOwnerNotification,
  normalizeBillingPayment,
  normalizeEinkaufBestellung,
  normalizeEinkaufWareneingang,
  normalizeBueroAngebot,
  normalizeBueroAuftrag,
  normalizeBueroRechnung,
  normalizeBueroEingangsrechnung,
} from './db/_shared'
import type {
  EinkaufLieferantRecord,
  BillingSubscriptionRow,
  OwnerNotificationRow,
  BueroKundeRecord,
  BueroAngebotRecord,
  BueroAuftragRecord,
  BueroRechnungRecord,
  BillingPaymentRow,
  BueroEingangsrechnungRecord,
  EinkaufBestellungRecord,
  EinkaufWareneingangRecord,
} from './db/_shared'

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
  revenueLast30Days: number
  pendingActivations: number
  overdueInvoices: number
  recentActivities: OwnerRecentActivity[]
}

export type AiFeatureSettings = {
  enabled: boolean
  chatEnabled: boolean
  documentEnabled: boolean
}

const DEFAULT_AI_FEATURE_SETTINGS: AiFeatureSettings = {
  enabled: true,
  chatEnabled: true,
  documentEnabled: true,
}

function normalizeAiFeatureSettings(data?: Record<string, unknown> | null): AiFeatureSettings {
  return {
    enabled: typeof data?.ai_enabled === 'boolean' ? data.ai_enabled : DEFAULT_AI_FEATURE_SETTINGS.enabled,
    chatEnabled: typeof data?.ai_chat_enabled === 'boolean' ? data.ai_chat_enabled : DEFAULT_AI_FEATURE_SETTINGS.chatEnabled,
    documentEnabled: typeof data?.ai_document_enabled === 'boolean' ? data.ai_document_enabled : DEFAULT_AI_FEATURE_SETTINGS.documentEnabled,
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
  briefpapier_url?: string
  briefpapier_layout?: Record<string, unknown>
  onboarding_completed?: boolean
  ai_enabled?: boolean
  ai_chat_enabled?: boolean
  ai_document_enabled?: boolean
  marketing_content_daily_enabled?: boolean
  marketing_autopilot_enabled?: boolean
  marketing_sales_assistant_enabled?: boolean
  openai_steuerprognose_enabled?: boolean
  openai_mahnungsgenerator_enabled?: boolean
  openai_email_assistent_enabled?: boolean
  openai_monatsbericht_enabled?: boolean
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
  if (!data) return null
  // briefpapier_url ist in briefpapier_layout JSONB gespeichert (kein eigenes DB-Feld nötig)
  const layout = (data.briefpapier_layout as Record<string, unknown>) ?? {}
  return {
    ...data,
    briefpapier_url: (data as Record<string, unknown>).briefpapier_url as string | undefined
      ?? layout.briefpapier_url as string | undefined,
  } as FirmaEinstellungen
}

export async function getAiFeatureSettings(): Promise<AiFeatureSettings> {
  const { data, error } = await db()
    .rpc('pk_get_ai_settings')
    .single()

  if (error) {
    if (isSchemaMismatch(error)) return DEFAULT_AI_FEATURE_SETTINGS
    throw error
  }

  return normalizeAiFeatureSettings(data as Record<string, unknown> | null)
}

export async function upsertFirmaEinstellungen(data: FirmaEinstellungen) {
  // briefpapier_url existiert nicht als eigene DB-Spalte → in briefpapier_layout JSONB einbetten
  const { briefpapier_url, ...dataWithout } = data
  const mergedLayout: Record<string, unknown> = {
    ...(data.briefpapier_layout as Record<string, unknown> ?? {}),
    ...(briefpapier_url !== undefined ? { briefpapier_url } : {}),
  }

  const { data: saved, error } = await db()
    .from('firma_einstellungen')
    .upsert({
      ...dataWithout,
      briefpapier_layout: mergedLayout,
      land: data.land || 'Deutschland',
      standard_waehrung: data.standard_waehrung || 'EUR',
      onboarding_completed: data.onboarding_completed ?? true,
      ai_enabled: data.ai_enabled ?? true,
      ai_chat_enabled: data.ai_chat_enabled ?? true,
      ai_document_enabled: data.ai_document_enabled ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  // Beim Lesen briefpapier_url aus dem Layout zurückextrahieren
  const savedLayout = (saved.briefpapier_layout as Record<string, unknown>) ?? {}
  return {
    ...saved,
    briefpapier_url: savedLayout.briefpapier_url as string | undefined,
  } as FirmaEinstellungen
}

export async function updateAiFeatureSettings(next: Partial<AiFeatureSettings>) {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmeneinstellungen gefunden. Bitte zuerst die Firmendaten speichern.')

  const merged = normalizeAiFeatureSettings({
    ai_enabled: next.enabled ?? current.ai_enabled,
    ai_chat_enabled: next.chatEnabled ?? current.ai_chat_enabled,
    ai_document_enabled: next.documentEnabled ?? current.ai_document_enabled,
  })

  await upsertFirmaEinstellungen({
    ...current,
    ai_enabled: merged.enabled,
    ai_chat_enabled: merged.chatEnabled,
    ai_document_enabled: merged.documentEnabled,
  })

  return merged
}

export type MarketingKiSettings = {
  contentDailyEnabled: boolean
  autopilotEnabled: boolean
  salesAssistantEnabled: boolean
}

const DEFAULT_MARKETING_KI: MarketingKiSettings = {
  contentDailyEnabled: false,
  autopilotEnabled: false,
  salesAssistantEnabled: false,
}

export async function getMarketingKiSettings(): Promise<MarketingKiSettings> {
  try {
    const firma = await getFirmaEinstellungen()
    if (!firma) return DEFAULT_MARKETING_KI
    const row = firma as Record<string, unknown>
    return {
      contentDailyEnabled: Boolean(row.marketing_content_daily_enabled),
      autopilotEnabled: Boolean(row.marketing_autopilot_enabled),
      salesAssistantEnabled: Boolean(row.marketing_sales_assistant_enabled),
    }
  } catch {
    return DEFAULT_MARKETING_KI
  }
}

export async function updateMarketingKiSettings(next: Partial<MarketingKiSettings>): Promise<MarketingKiSettings> {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmeneinstellungen gefunden. Bitte zuerst die Firmendaten speichern.')

  const row = current as Record<string, unknown>
  const merged: MarketingKiSettings = {
    contentDailyEnabled: next.contentDailyEnabled ?? Boolean(row.marketing_content_daily_enabled),
    autopilotEnabled: next.autopilotEnabled ?? Boolean(row.marketing_autopilot_enabled),
    salesAssistantEnabled: next.salesAssistantEnabled ?? Boolean(row.marketing_sales_assistant_enabled),
  }

  await upsertFirmaEinstellungen({
    ...current,
    marketing_content_daily_enabled: merged.contentDailyEnabled,
    marketing_autopilot_enabled: merged.autopilotEnabled,
    marketing_sales_assistant_enabled: merged.salesAssistantEnabled,
  })

  return merged
}

export type OpenAiToolSettings = {
  steuerprognoseEnabled: boolean
  mahnungsgeneratorEnabled: boolean
  emailAssistentEnabled: boolean
  monatsberichtEnabled: boolean
}

const DEFAULT_OPENAI_TOOLS: OpenAiToolSettings = {
  steuerprognoseEnabled: false,
  mahnungsgeneratorEnabled: false,
  emailAssistentEnabled: false,
  monatsberichtEnabled: false,
}

export async function getOpenAiToolSettings(): Promise<OpenAiToolSettings> {
  try {
    const firma = await getFirmaEinstellungen()
    if (!firma) return DEFAULT_OPENAI_TOOLS
    const row = firma as Record<string, unknown>
    return {
      steuerprognoseEnabled: Boolean(row.openai_steuerprognose_enabled),
      mahnungsgeneratorEnabled: Boolean(row.openai_mahnungsgenerator_enabled),
      emailAssistentEnabled: Boolean(row.openai_email_assistent_enabled),
      monatsberichtEnabled: Boolean(row.openai_monatsbericht_enabled),
    }
  } catch {
    return DEFAULT_OPENAI_TOOLS
  }
}

export async function updateOpenAiToolSettings(next: Partial<OpenAiToolSettings>): Promise<OpenAiToolSettings> {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmeneinstellungen gefunden.')
  const row = current as Record<string, unknown>
  const merged: OpenAiToolSettings = {
    steuerprognoseEnabled: next.steuerprognoseEnabled ?? Boolean(row.openai_steuerprognose_enabled),
    mahnungsgeneratorEnabled: next.mahnungsgeneratorEnabled ?? Boolean(row.openai_mahnungsgenerator_enabled),
    emailAssistentEnabled: next.emailAssistentEnabled ?? Boolean(row.openai_email_assistent_enabled),
    monatsberichtEnabled: next.monatsberichtEnabled ?? Boolean(row.openai_monatsbericht_enabled),
  }
  await upsertFirmaEinstellungen({
    ...current,
    openai_steuerprognose_enabled: merged.steuerprognoseEnabled,
    openai_mahnungsgenerator_enabled: merged.mahnungsgeneratorEnabled,
    openai_email_assistent_enabled: merged.emailAssistentEnabled,
    openai_monatsbericht_enabled: merged.monatsberichtEnabled,
  })
  return merged
}

export async function uploadFirmenLogo(file: File) {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Kein Benutzer für Logo-Upload gefunden.')
  const ext = file.name.split('.').pop() || 'png'
  const path = `${userId}/firma/logo_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('firma-branding').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = await supabase.storage.from('firma-branding').createSignedUrl(path, 60 * 60 * 24 * 365)
  return { path, url: data?.signedUrl ?? path }
}

export async function deleteFirmenLogo(pathOrUrl: string) {
  const marker = '/object/sign/firma-branding/'
  const path = pathOrUrl.includes(marker)
    ? decodeURIComponent(pathOrUrl.split(marker)[1]?.split('?')[0] ?? '')
    : pathOrUrl
  if (!path) return
  const { error } = await db().storage.from('firma-branding').remove([path])
  if (error) throw error
}

export async function uploadBriefpapier(file: File) {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Kein Benutzer für Briefpapier-Upload gefunden.')
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `${userId}/firma/briefpapier_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('firma-branding').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = await supabase.storage.from('firma-branding').createSignedUrl(path, 60 * 60 * 24 * 365)
  return { path, url: data?.signedUrl ?? path }
}

export async function deleteBriefpapier(pathOrUrl: string) {
  const marker = '/object/sign/firma-branding/'
  const path = pathOrUrl.includes(marker)
    ? decodeURIComponent(pathOrUrl.split(marker)[1]?.split('?')[0] ?? '')
    : pathOrUrl
  if (!path) return
  const { error } = await db().storage.from('firma-branding').remove([path])
  if (error) throw error
}

export async function markFirmaOnboardingCompleted() {
  const current = await getFirmaEinstellungen()
  if (!current) throw new Error('Keine Firmendaten vorhanden.')
  return upsertFirmaEinstellungen({ ...current, onboarding_completed: true })
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

// ── Pondruff Feature-Flags ───────────────────────────────────────────────────

import { POND_DEFAULT_FEATURE_FLAGS, type PondruffFeatureFlags, type PondruffFeatureKey } from './pondruff'

type PondruffFeatureFlagsRow = {
  user_id: string
  ocr_wareneingang: boolean | null
  ocr_preisrechner: boolean | null
  ki_bauteilsuche: boolean | null
  wiso_sync: boolean | null
  updated_at: string | null
}

function normalizeFlags(row: PondruffFeatureFlagsRow | null): PondruffFeatureFlags {
  if (!row) return { ...POND_DEFAULT_FEATURE_FLAGS }
  return {
    ocr_wareneingang: row.ocr_wareneingang ?? true,
    ocr_preisrechner: row.ocr_preisrechner ?? true,
    ki_bauteilsuche: row.ki_bauteilsuche ?? true,
    wiso_sync: row.wiso_sync ?? true,
  }
}

// Pondruff-User liest seine eigenen Flags (RLS: select_self)
export async function getMyPondruffFeatureFlags(): Promise<PondruffFeatureFlags> {
  const { data, error } = await db()
    .from('pondruff_feature_flags')
    .select('*')
    .maybeSingle()
  if (error) {
    // Bei Fehler: Defaults zurueck — UI wird optimistisch alles freischalten.
    return { ...POND_DEFAULT_FEATURE_FLAGS }
  }
  return normalizeFlags(data as PondruffFeatureFlagsRow | null)
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

export async function listBillingPaymentsByInvoice(invoiceId: string) {
  const { data, error } = await db()
    .from('billing_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
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

export async function getNextAngebotNumber() {
  const { data, error } = await db().rpc('pk_next_angebot_number')
  if (error || !data) throw new Error('Angebotsnummer konnte nicht erzeugt werden.')
  if (typeof data !== 'string' || !data.trim()) throw new Error('Angebotsnummer konnte nicht erzeugt werden.')
  return data as string
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

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
  const parseDate = (raw?: string | null) => {
    if (!raw) return 0
    const t = new Date(raw).getTime()
    return Number.isFinite(t) ? t : 0
  }

  return {
    activeCustomers: subscriptions.filter(item => item.softwareEnabled || item.status === 'active').length,
    pendingApprovals: subscriptions.filter(item => item.status === 'pending_payment' || item.status === 'proof_sent').length,
    pendingActivations: subscriptions.filter(item => !item.softwareEnabled && (item.status === 'pending_payment' || item.status === 'proof_sent' || item.status === 'active')).length,
    failedPayments: payments.filter(item => item.status === 'failed').length,
    openInvoices: invoices.filter(item => item.status !== 'Bezahlt').length,
    overdueInvoices: invoices.filter(item => {
      if (item.status === 'Bezahlt') return false
      const created = parseDate(item.erstellt)
      return created > 0 && created < fourteenDaysAgo
    }).length,
    monthlyRecurringRevenue: subscriptions.reduce((sum, item) => sum + (item.status === 'active' ? item.monthlyPrice ?? 0 : 0), 0),
    revenueTotal: invoices.reduce((sum, item) => sum + ((item.status === 'Bezahlt' ? item.summe ?? 0 : 0)), 0),
    revenueLast30Days: invoices.reduce((sum, item) => {
      if (item.status !== 'Bezahlt') return sum
      const paid = parseDate(item.bezahlt_am) || parseDate(item.erstellt)
      if (paid > 0 && paid >= thirtyDaysAgo) return sum + (item.summe ?? 0)
      return sum
    }, 0),
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
  lieferant_id?: string | null; einkaufspreis?: number
  bild_path?: string | null
}) {
  const { data, error } = await db()
    .from('lager_artikel')
    .upsert({ ...artikel, updated_at: new Date().toISOString() })
    .select()
  if (error) throw error
  return data
}

export async function deleteLagerArtikel(id: string) {
  // Bild aus Storage entfernen (Cleanup), bevor DB-Zeile gelöscht wird
  try {
    const { data: row } = await db().from('lager_artikel').select('bild_path').eq('id', id).maybeSingle()
    const path = (row as { bild_path?: string | null } | null)?.bild_path
    if (path) {
      await db().storage.from('lager-bilder').remove([path])
    }
  } catch {
    // Cleanup ist best-effort, blockiert das Löschen nicht
  }
  const { error } = await db().from('lager_artikel').delete().eq('id', id)
  if (error) throw error
  logAuditAction({ action: 'delete', entityType: 'artikel', entityId: id })
}

// Lädt eine signed URL für ein Artikelbild (1h Gültigkeit, CDN-cached)
export async function getLagerBildSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data } = await db().storage.from('lager-bilder').createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}

// Lädt mehrere signed URLs in einem Batch (effizienter als N Einzelaufrufe)
export async function getLagerBildSignedUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const filtered = paths.filter(Boolean)
  if (filtered.length === 0) return {}
  const { data } = await db().storage.from('lager-bilder').createSignedUrls(filtered, expiresIn)
  const map: Record<string, string> = {}
  ;(data ?? []).forEach((r: { path?: string | null; signedUrl?: string | null }) => {
    if (r.path && r.signedUrl) map[r.path] = r.signedUrl
  })
  return map
}

// Lädt ein neues Artikelbild hoch + entfernt das alte (falls vorhanden)
// User-ID wird aus der aktuellen Session ermittelt (Pfad-Konvention für RLS)
export async function uploadLagerArtikelBild(opts: {
  artikelId: string
  blob: Blob
  ext: string
  oldPath?: string | null
}): Promise<string> {
  const { artikelId, blob, ext, oldPath } = opts
  const { data: userData, error: userErr } = await db().auth.getUser()
  if (userErr || !userData?.user) throw new Error('Nicht angemeldet')
  const userId = userData.user.id
  const safeId = artikelId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${userId}/${safeId}.${ext}`
  const { error } = await db().storage.from('lager-bilder').upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'image/webp',
    cacheControl: '3600',
  })
  if (error) throw error
  if (oldPath && oldPath !== path) {
    await db().storage.from('lager-bilder').remove([oldPath]).catch(() => {})
  }
  return path
}

export async function deleteLagerArtikelBild(path: string): Promise<void> {
  if (!path) return
  await db().storage.from('lager-bilder').remove([path]).catch(() => {})
}

// ── LAGER BESTAND-SNAPSHOTS ───────────────────────────────────────────────────

export async function getLagerBestandSnapshots(limit = 30) {
  const { data, error } = await db()
    .from('lager_bestand_snapshots')
    .select('*')
    .order('datum', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function insertLagerBestandSnapshot(s: {
  id: string
  datum: string
  artikel_ges: number
  niedrig: number
  leer: number
  lagerwert: number
  notiz?: string
}) {
  const { data, error } = await db()
    .from('lager_bestand_snapshots')
    .upsert(s, { onConflict: 'datum' })
    .select()
  if (error) throw error
  return data
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

// ── WERKSTATT → LAGER SYNC (Aufgabe 27) ──────────────────────────────────────

/**
 * Nach einer Material-Entnahme in der Werkstatt:
 * 1. Lager-Artikel-Bestand um `menge` reduzieren
 * 2. Lager-Bewegung "Ausgang" erzeugen
 * Falls der Artikel nicht gefunden wird, wird nur die Bewegung geloggt.
 */
export async function syncWerkstattMaterialToLager(input: {
  artikelName: string
  menge: number
  einheit: string
  auftragsnr: string
  mitarbeiter?: string
}) {
  const client = db()
  // Artikel suchen (case-insensitive über ilike)
  const { data: artikelRows } = await client
    .from('lager_artikel')
    .select('id,name,bestand')
    .ilike('name', input.artikelName.trim())
    .limit(1)

  if (artikelRows && artikelRows.length > 0) {
    const art = artikelRows[0] as { id: string; name: string; bestand: number }
    const neuerBestand = Math.max(0, (art.bestand ?? 0) - input.menge)
    const newStatus = neuerBestand === 0 ? 'leer' : neuerBestand <= 5 ? 'niedrig' : 'ok'
    await client
      .from('lager_artikel')
      .update({ bestand: neuerBestand, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', art.id)
  }

  // Lager-Bewegung "Ausgang" via insertLagerBewegung loggen (Audit-Konsistenz)
  await insertLagerBewegung({
    typ: 'Ausgang',
    artikel: input.artikelName,
    menge: input.menge,
    mitarbeiter: input.mitarbeiter ?? '',
    status: `Werkstatt-Entnahme: ${input.auftragsnr}`,
  })
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
  website?: string; strasse?: string; plz?: string; lieferadresse?: string; rechnungsadresse?: string
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
  logAuditAction({ action: 'delete', entityType: 'kunde', entityId: id })
}

export async function checkBueroKundeDuplicate(email: string, excludeId?: string) {
  if (!email) return null
  let q = db().from('buero_kunden').select('id, name, email').ilike('email', email)
  if (excludeId) q = q.neq('id', excludeId)
  const { data, error } = await q.maybeSingle()
  if (error) return null
  return data as { id: string; name: string; email: string } | null
}

export async function anonymisiereBueroKunde(id: string) {
  const { error } = await db()
    .from('buero_kunden')
    .update({
      name: '[Anonym]',
      email: 'anonym@geloescht.de',
      telefon: '',
      ort: '',
      ansprechpartner: '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
  logAuditAction({ action: 'anonymize', entityType: 'kunde', entityId: id })
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
  datum?: string; gueltig?: string; status?: string; nummer?: string; verschickt_am?: string
  positionen?: Array<{ id: string; beschreibung: string; menge: number; einheit: string; einzelpreis: number }>
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
  id: string; kunde_id?: string; billing_subscription_id?: string; kunde?: string; beschreibung?: string; wert?: string
  start?: string; ende?: string; status?: string; fortschritt?: number; angebot_id?: string; ab_verschickt_am?: string; ab_nummer?: string
  positionen?: Array<{ id: string; beschreibung: string; menge: number; einheit: string; einzelpreis: number }>
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

// ── PDF-ARCHIV (GoBD) ─────────────────────────────────────────────────────────

async function sha256Base64(base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function base64ToBlob(base64: string, mime = 'application/pdf'): Blob {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

export async function archiveRechnungPdf(opts: {
  rechnungId: string
  rechnungNummer?: string
  pdfBase64: string
}): Promise<{ path: string; hash: string }> {
  const supabase = db()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) throw new Error('Nicht angemeldet')
  const userId = userData.user.id
  const year = new Date().getFullYear()
  const safeName = (opts.rechnungNummer || opts.rechnungId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${userId}/${year}/rechnung_${safeName}.pdf`

  const hash = await sha256Base64(opts.pdfBase64)
  const blob = base64ToBlob(opts.pdfBase64)
  const { error } = await supabase.storage.from('rechnungen-archiv').upload(path, blob, {
    upsert: true,
    contentType: 'application/pdf',
    cacheControl: '3600',
  })
  if (error) throw error

  await supabase.from('buero_rechnungen').update({
    pdf_path: path,
    pdf_hash: hash,
    pdf_archived_at: new Date().toISOString(),
  }).eq('id', opts.rechnungId)

  return { path, hash }
}

export async function archiveAngebotPdf(opts: {
  angebotId: string
  angebotNummer?: string
  pdfBase64: string
}): Promise<{ path: string; hash: string }> {
  const supabase = db()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) throw new Error('Nicht angemeldet')
  const userId = userData.user.id
  const year = new Date().getFullYear()
  const safeName = (opts.angebotNummer || opts.angebotId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${userId}/${year}/angebot_${safeName}.pdf`

  const hash = await sha256Base64(opts.pdfBase64)
  const blob = base64ToBlob(opts.pdfBase64)
  const { error } = await supabase.storage.from('rechnungen-archiv').upload(path, blob, {
    upsert: true,
    contentType: 'application/pdf',
    cacheControl: '3600',
  })
  if (error) throw error

  await supabase.from('buero_angebote').update({
    pdf_path: path,
    pdf_hash: hash,
    pdf_archived_at: new Date().toISOString(),
  }).eq('id', opts.angebotId)

  return { path, hash }
}

export async function getArchivPdfSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null
  const { data } = await db().storage.from('rechnungen-archiv').createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
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
  erstellt?: string; status?: string; bezahlt_am?: string; mahnung_count?: number
  positionen?: unknown
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
  logAuditAction({ action: 'delete', entityType: 'angebot', entityId: id })
}

export async function deleteBueroAuftrag(id: string) {
  const { error } = await db().from('buero_auftraege').delete().eq('id', id)
  if (error) throw error
  logAuditAction({ action: 'delete', entityType: 'auftrag', entityId: id })
}

export async function deleteBueroRechnung(id: string) {
  const { error } = await db().from('buero_rechnungen').delete().eq('id', id)
  if (error) throw error
  logAuditAction({ action: 'delete', entityType: 'rechnung', entityId: id })
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
  logAuditAction({ action: 'delete', entityType: 'eingangsrechnung', entityId: id })
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

export async function getBueroAngebotDetailContext(id: string) {
  const [angebot, kunden, auftraege, rechnungen, dokumente] = await Promise.all([
    getBueroAngebotById(id),
    getBueroKunden(),
    getBueroAuftraege(),
    getBueroRechnungen(),
    getBueroDokumente(),
  ])
  if (!angebot) return null
  const kundeName = firstText(angebot.kunde)
  const kunde = angebot.kunde_id
    ? (kunden ?? []).find(row => row.id === angebot.kunde_id) ?? null
    : (kunden ?? []).find(row => firstText(row.name).toLowerCase() === kundeName.toLowerCase()) ?? null
  const relatedAuftraege = (auftraege ?? []).filter(row => row.kunde_id === angebot.kunde_id || (!!kundeName && firstText(row.kunde).toLowerCase() === kundeName.toLowerCase()))
  const relatedRechnungen = (rechnungen ?? []).filter(row => row.kunde_id === angebot.kunde_id || (!!kundeName && firstText(row.kunde).toLowerCase() === kundeName.toLowerCase()))
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    if (String(doc.angebot_id ?? '') === id) return true
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return (!!kundeName && bezug === kundeName.toLowerCase())
      || bezug === firstText(angebot.titel).toLowerCase()
  })

  return {
    angebot,
    kunde,
    auftraege: relatedAuftraege,
    rechnungen: relatedRechnungen,
    dokumente: relatedDokumente,
  }
}

export async function getBueroAuftragDetailContext(id: string) {
  const [auftrag, kunden, rechnungen, dokumente] = await Promise.all([
    getBueroAuftragById(id),
    getBueroKunden(),
    getBueroRechnungen(),
    getBueroDokumente(),
  ])
  if (!auftrag) return null
  const kundeName = firstText(auftrag.kunde)
  const kunde = auftrag.kunde_id
    ? (kunden ?? []).find(row => row.id === auftrag.kunde_id) ?? null
    : (kunden ?? []).find(row => firstText(row.name).toLowerCase() === kundeName.toLowerCase()) ?? null
  const relatedRechnungen = (rechnungen ?? []).filter(row => row.kunde_id === auftrag.kunde_id || (!!kundeName && firstText(row.kunde).toLowerCase() === kundeName.toLowerCase()))
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    if (String(doc.auftrag_id ?? '') === id) return true
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return (!!kundeName && bezug === kundeName.toLowerCase())
      || bezug === firstText(auftrag.beschreibung).toLowerCase()
  })

  return {
    auftrag,
    kunde,
    rechnungen: relatedRechnungen,
    dokumente: relatedDokumente,
  }
}

export async function getBueroRechnungDetailContext(id: string) {
  const [rechnung, kunden, dokumente, payments] = await Promise.all([
    getBueroRechnungById(id),
    getBueroKunden(),
    getBueroDokumente(),
    listBillingPaymentsByInvoice(id),
  ])
  if (!rechnung) return null
  const kundeName = firstText(rechnung.kunde)
  const kunde = rechnung.kunde_id
    ? (kunden ?? []).find(row => row.id === rechnung.kunde_id) ?? null
    : (kunden ?? []).find(row => firstText(row.name).toLowerCase() === kundeName.toLowerCase()) ?? null
  const relatedDokumente = ((dokumente ?? []) as Array<Record<string, unknown>>).filter(doc => {
    if (String(doc.rechnung_id ?? '') === id) return true
    const bezug = firstText(doc.bezug as string | undefined).toLowerCase()
    return (!!kundeName && bezug === kundeName.toLowerCase())
      || bezug === firstText(rechnung.nummer).toLowerCase()
  })

  return {
    rechnung,
    kunde,
    dokumente: relatedDokumente,
    payments,
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
  stunden?: number; fortschritt?: number; maschine?: string; buero_auftrag_id?: string | null
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
  logAuditAction({ action: 'delete', entityType: 'werkstatt_karte', entityId: id })
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
  const client = db()
  let karte_id: string | null = null
  if (m.auftragsnr) {
    const { data: karten } = await client
      .from('werkstatt_karten')
      .select('id')
      .eq('auftragsnr', m.auftragsnr)
      .limit(1)
    if (karten && karten.length > 0) karte_id = (karten[0] as { id: string }).id
  }
  const { data, error } = await client
    .from('werkstatt_material')
    .insert({ ...m, datum: today(), karte_id })
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

export async function deleteMarketingKampagne(id: string) {
  const { error } = await db().from('marketing_kampagnen').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingLead(id: string) {
  const { error } = await db().from('marketing_leads').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingNewsletter(id: string) {
  const { error } = await db().from('marketing_newsletter').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingSeoKeyword(id: string) {
  const { error } = await db().from('marketing_seo_keywords').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingContentIdea(id: string) {
  const { error } = await db().from('marketing_content_ideas').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingPostingPlan(id: string) {
  const { error } = await db().from('marketing_posting_plans').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingAutomationRule(id: string) {
  const { error } = await db().from('marketing_automation_rules').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMarketingIntegrationItem(id: string) {
  const { error } = await db().from('marketing_integration_items').delete().eq('id', id)
  if (error) throw error
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
  verantwortlich?: string; meilensteine?: object[]; auftrag_id?: string | null
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

export async function deletePlanungRessource(id: string) {
  const { error } = await db().from('planung_ressourcen').delete().eq('id', id)
  if (error) throw error
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
  const supabase = db()
  const { data: existing } = await supabase
    .from('steuer_belege')
    .select('datei_url')
    .eq('id', id)
    .single()
  const storagePath = normalizeDocumentStoragePath((existing as { datei_url?: string | null } | null)?.datei_url)
  if (storagePath && !storagePath.startsWith('http')) {
    const supabaseBrowser = createSupabaseClient()
    const { error: storageError } = await supabaseBrowser.storage.from('dokumente').remove([storagePath])
    if (storageError && !/not found/i.test(storageError.message ?? '')) throw storageError
  }
  const { error } = await supabase.from('steuer_belege').delete().eq('id', id)
  if (error) throw error
  logAuditAction({ action: 'delete', entityType: 'beleg', entityId: id })
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
  const { error } = await supabase.storage.from('ocr-originale').upload(path, file)
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
  imported_ids?: string[]; ziel_tabelle?: string
}) {
  const { data, error } = await db().from('import_protokolle').insert(p).select()
  if (error) throw error
  return data
}

// Lösche ein Import-Protokoll. Wenn rollback=true, werden auch die importierten Datensätze gelöscht.
export async function deleteImportProtokoll(id: string, rollback: boolean): Promise<{ deleted_records: number }> {
  let deletedRecords = 0
  if (rollback) {
    const { data: proto, error: fetchErr } = await db().from('import_protokolle').select('imported_ids, ziel_tabelle').eq('id', id).maybeSingle()
    if (fetchErr) throw fetchErr
    const ids: string[] = Array.isArray(proto?.imported_ids) ? proto!.imported_ids as string[] : []
    const table: string | null = proto?.ziel_tabelle ?? null
    const ALLOWED = ['buero_kunden', 'lager_artikel', 'einkauf_lieferanten', 'buero_rechnungen', 'steuer_belege', 'steuer_buchungen', 'steuer_konten']
    if (table && ids.length && ALLOWED.includes(table)) {
      const { error: delErr, count } = await db().from(table).delete({ count: 'exact' }).in('id', ids)
      if (delErr) throw delErr
      deletedRecords = count ?? 0
    }
  }
  const { error } = await db().from('import_protokolle').delete().eq('id', id)
  if (error) throw error
  return { deleted_records: deletedRecords }
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
  ansprechpartner?: string; mobil?: string
  strasse?: string; plz?: string; ort?: string; land?: string
  website?: string; ust_id?: string
}>) {
  // Schutz: leere oder doppelte Einträge filtern
  const seen = new Set<string>()
  const cleaned = rows
    .map(r => {
      const out = { ...r }
      // Adresse aus Einzelfeldern zusammensetzen, falls leer
      if (!out.adresse && (out.strasse || out.plz || out.ort)) {
        out.adresse = [out.strasse, [out.plz, out.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      }
      return out
    })
    .filter(r => {
      const key = (r.name || '').trim().toLowerCase()
      if (!key) return false // ohne Name keinen Import
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  if (!cleaned.length) return []
  const { data, error } = await db().from('buero_kunden').insert(cleaned).select()
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

// ── Steuer Fixkosten ───────────────────────────────────────────────────────────

export async function getSteuerFixkosten() {
  const { data, error } = await db().from('steuer_fixkosten').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerFixkosten(f: {
  id: string; titel: string; kategorie: string; betrag_netto: number; steuersatz: number
  betrag_brutto: number; zahlungsintervall: string; naechste_zahlung?: string
  anbieter?: string; notiz?: string; datei_url?: string; aktiv: boolean
}) {
  const { data, error } = await db().from('steuer_fixkosten').upsert({ ...f, updated_at: new Date().toISOString() }).select()
  if (error) throw error
  return data
}

export async function deleteSteuerFixkosten(id: string) {
  const { error } = await db().from('steuer_fixkosten').delete().eq('id', id)
  if (error) throw error
}

export async function uploadSteuerDokument(file: File, userId: string, prefix = 'steuer'): Promise<string> {
  const supabase = createSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${prefix}/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('dokumente').upload(path, file, { upsert: true })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('dokumente').getPublicUrl(path)
  return publicUrl
}

// ── Steuer Betriebsausgaben ────────────────────────────────────────────────────

export async function getSteuerBetriebsausgaben() {
  const { data, error } = await db().from('steuer_betriebsausgaben').select('*').order('datum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerBetriebsausgabe(b: {
  id: string; titel: string; kategorie: string; betrag_netto: number; steuersatz: number
  betrag_brutto: number; datum: string; anbieter?: string; notiz?: string; datei_url?: string
}) {
  const { data, error } = await db().from('steuer_betriebsausgaben').upsert({ ...b, updated_at: new Date().toISOString() }).select()
  if (error) throw error
  return data
}

export async function deleteSteuerBetriebsausgabe(id: string) {
  const { error } = await db().from('steuer_betriebsausgaben').delete().eq('id', id)
  if (error) throw error
}

// ── Steuer Anschaffungen ───────────────────────────────────────────────────────

export async function getSteuerAnschaffungen() {
  const { data, error } = await db().from('steuer_anschaffungen').select('*').order('kaufdatum', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSteuerAnschaffung(a: {
  id: string; titel: string; kategorie: string; betrag_netto: number; steuersatz: number
  betrag_brutto: number; kaufdatum: string; lieferant?: string; seriennummer?: string
  garantie_bis?: string; notiz?: string; datei_url?: string; gwg: boolean
}) {
  const { data, error } = await db().from('steuer_anschaffungen').upsert({ ...a, updated_at: new Date().toISOString() }).select()
  if (error) throw error
  return data
}

export async function deleteSteuerAnschaffung(id: string) {
  const { error } = await db().from('steuer_anschaffungen').delete().eq('id', id)
  if (error) throw error
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

  // Atomare 4-Schritt-Transaktion via Supabase RPC (kein Datenverlust bei Teilfehlern)
  const { data, error } = await supabase.rpc('umlager_artikel', {
    p_von_bestand_id: params.vonBestandId,
    p_nach_stellplatz_id: params.nachStellplatzId,
    p_menge: params.menge,
    p_charge: params.charge ?? null,
    p_mhd: params.mhd ?? null,
    p_grund: params.grund ?? null,
    p_notiz: params.notiz ?? null,
  })

  if (error) throw new Error(error.message)
  return data
}

// ── Steuer Beleg-Uploads (mit Kategorie) ──────────────────────────────────────

export type SteuerBelegUpload = {
  id: string
  user_id?: string | null
  kategorie: 'Fixkosten' | 'Betriebsausgaben' | 'Anschaffung' | 'Sonstiges'
  datei_url?: string | null
  betrag?: number | null
  datum?: string | null
  notiz?: string | null
  created_at?: string | null
}

export async function getSteuerBelegUploads() {
  const { data, error } = await db()
    .from('steuer_belege_uploads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SteuerBelegUpload[]
}

export async function upsertSteuerBelegUpload(u: {
  id: string
  kategorie: string
  datei_url?: string | null
  betrag?: number | null
  datum?: string | null
  notiz?: string | null
}) {
  const { data, error } = await db()
    .from('steuer_belege_uploads')
    .upsert(u)
    .select()
  if (error) throw error
  return data
}

export async function deleteSteuerBelegUpload(id: string) {
  const { error } = await db().from('steuer_belege_uploads').delete().eq('id', id)
  if (error) throw error
}

export async function uploadSteuerBelegFile(file: File, userId: string): Promise<string> {
  const supabase = createSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('steuer-belege').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('steuer-belege').getPublicUrl(path)
  return data.publicUrl
}

// ── MESSAGING & POSTFACH ──────────────────────────────────────────────────────

export type UserMessage = {
  id: string
  user_id: string
  message_type: 'support_request' | 'broadcast'
  subject: string
  body: string
  is_read: boolean
  read_at?: string | null
  created_at?: string
  updated_at?: string
}

export type BroadcastMessage = {
  id: string
  owner_user_id: string
  subject: string
  body: string
  recipient_type: 'all' | 'single'
  recipient_user_id?: string | null
  created_at?: string
  updated_at?: string
}

// User Messages: Normal user support requests
export async function getUserMessages() {
  const { data, error } = await db()
    .from('user_messages')
    .select('*')
    .order('created_at', { ascending: false })
  if (isSchemaMismatch(error)) return []
  if (error) throw error
  return (data ?? []) as UserMessage[]
}

export async function insertUserMessage(input: {
  subject: string
  body: string
}) {
  const user = await db().auth.getUser()
  const { data, error } = await db()
    .from('user_messages')
    .insert({
      user_id: user.data.user?.id,
      message_type: 'support_request',
      subject: input.subject,
      body: input.body,
    })
    .select()
    .single()
  if (error) throw error
  return data as UserMessage
}

export async function markUserMessageAsRead(messageId: string) {
  const { data, error } = await db()
    .from('user_messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', messageId)
    .select()
    .single()
  if (error) throw error
  return data as UserMessage
}

// Owner Inbox: All support requests from users
export async function getOwnerInbox() {
  const { data, error } = await db()
    .from('user_messages')
    .select('id, user_id, message_type, subject, body, is_read, created_at')
    .order('created_at', { ascending: false })
  if (isSchemaMismatch(error)) return []
  if (error) throw error
  return (data ?? []) as Omit<UserMessage, 'updated_at'>[]
}

// Broadcast Messages: Owner to all/single users
export async function insertBroadcastMessage(input: {
  subject: string
  body: string
  recipient_type: 'all' | 'single'
  recipient_user_id?: string
}) {
  const user = await db().auth.getUser()
  const { data, error } = await db()
    .from('broadcast_messages')
    .insert({
      owner_user_id: user.data.user?.id,
      subject: input.subject,
      body: input.body,
      recipient_type: input.recipient_type,
      recipient_user_id: input.recipient_user_id || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as BroadcastMessage
}

export async function getOwnerSentMessages() {
  const user = await db().auth.getUser()
  const { data, error } = await db()
    .from('broadcast_messages')
    .select('*')
    .eq('owner_user_id', user.data.user?.id)
    .order('created_at', { ascending: false })
  if (isSchemaMismatch(error)) return []
  if (error) throw error
  return (data ?? []) as BroadcastMessage[]
}

// ─── Cloud Backups ───────────────────────────────────────────────────────────

export type CloudBackup = {
  id: string
  user_id: string
  created_at: string
  label: string
  modules: Record<string, number>
  total_records: number
  status: 'ok' | 'partial' | 'error'
}

export async function getCloudBackups(): Promise<CloudBackup[]> {
  const { data, error } = await db()
    .from('cloud_backups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (isSchemaMismatch(error)) return []
  if (error) throw error
  return (data ?? []) as CloudBackup[]
}

export async function createCloudBackup(_label = 'Manuell'): Promise<CloudBackup> {
  const res = await fetch('/api/backup/manual', { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Backup fehlgeschlagen (${res.status})`)
  }
  return res.json() as Promise<CloudBackup>
}
