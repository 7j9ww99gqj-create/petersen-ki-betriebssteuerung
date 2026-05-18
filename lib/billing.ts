import {
  appendAuditLog,
  getNextInvoiceNumber,
  getBillingSubscription,
  getLatestBueroRechnungBySubscriptionId,
  upsertBillingPayment,
  upsertBillingSubscription,
  updateBillingSubscriptionStatus,
  upsertBueroKunde,
  upsertBueroAuftrag,
  upsertBueroRechnung,
} from './db'
import { genId } from './ids'
import type { BookingStatus, EmployeeTierId, PackageId, PilotId } from './pricingConfig'

export type SubscriptionRecord = {
  id: string
  userId?: string
  userKey: string
  userEmail?: string
  packageId?: PackageId
  pilotIds: PilotId[]
  employeeTier: EmployeeTierId
  monthlyPrice: number | null
  status: BookingStatus
  softwareEnabled: boolean
  createdAt: string
  updatedAt: string
  nextPayment?: string
}

export type SubscriptionInvoiceDraft = {
  id: string
  number: string
  customerId: string
  subscriptionId: string
  issueDate: string
  dueDate: string
  periodStart?: string
  periodEnd?: string
  netAmount: number
  taxRate: number
  taxAmount: number
  grossAmount: number
  status: 'Offen' | 'Bezahlt'
}

export type BookingRequestInput = {
  userKey: string
  userEmail?: string
  packageId?: PackageId
  pilotIds: PilotId[]
  employeeTier: EmployeeTierId
  monthlyPrice: number | null
}

function storageKey(userKey: string) {
  return `pk_booking_subscription_${userKey || 'anonymous'}`
}

function isDemoUser(userKey: string) {
  return userKey === 'demo-user'
}

function readLegacySubscription(userKey: string): SubscriptionRecord | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey(userKey))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SubscriptionRecord
  } catch {
    return null
  }
}

function clearLegacySubscription(userKey: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(userKey))
}

export async function getCurrentSubscription(userKey: string): Promise<SubscriptionRecord | null> {
  if (isDemoUser(userKey)) {
    return readLegacySubscription(userKey)
  }

  const live = await getBillingSubscription()
  if (live) return live

  const legacy = readLegacySubscription(userKey)
  if (!legacy) return null

  const migrated = await upsertBillingSubscription({
    userKey: legacy.userKey || userKey,
    userEmail: legacy.userEmail,
    packageId: legacy.packageId,
    pilotIds: legacy.pilotIds,
    employeeTier: legacy.employeeTier,
    monthlyPrice: legacy.monthlyPrice,
    status: legacy.status,
    nextPayment: legacy.nextPayment ?? null,
  })
  clearLegacySubscription(userKey)
  return migrated
}

export async function createBookingRequest(input: BookingRequestInput): Promise<SubscriptionRecord> {
  if (isDemoUser(input.userKey)) {
    const now = new Date().toISOString()
    const record: SubscriptionRecord = {
      id: `BOOK-${Date.now().toString(36).toUpperCase()}`,
      userKey: input.userKey,
      userEmail: input.userEmail,
      packageId: input.packageId,
      pilotIds: input.pilotIds,
      employeeTier: input.employeeTier,
      monthlyPrice: input.monthlyPrice,
      status: 'pending_payment',
      softwareEnabled: false,
      createdAt: now,
      updatedAt: now,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(input.userKey), JSON.stringify(record))
    }
    return record
  }

  const subscription = await upsertBillingSubscription({
    ...input,
    status: 'pending_payment',
    softwareEnabled: false,
  })
  return subscription
}

export async function updateBookingStatus(userKey: string, status: BookingStatus): Promise<SubscriptionRecord | null> {
  if (isDemoUser(userKey)) {
    const current = readLegacySubscription(userKey)
    if (!current) return null
    const updated: SubscriptionRecord = { ...current, status, updatedAt: new Date().toISOString() }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(userKey), JSON.stringify(updated))
    }
    return updated
  }

  return updateBillingSubscriptionStatus(status)
}

function formatDateForUi(date: Date) {
  return date.toLocaleDateString('de-DE')
}

export async function ensureOwnerCustomerForSubscription(subscription: SubscriptionRecord) {
  const customerId = `BILL-${subscription.id}`
  await upsertBueroKunde({
    id: customerId,
    auth_user_id: subscription.userId,
    source: 'billing',
    billing_subscription_id: subscription.id,
    name: subscription.userEmail?.split('@')[0] || subscription.userKey || 'Kunde',
    typ: 'SaaS-Kunde',
    ansprechpartner: subscription.userEmail?.split('@')[0] || subscription.userKey || 'Kunde',
    email: subscription.userEmail,
    umsatz: subscription.monthlyPrice != null ? `${subscription.monthlyPrice.toFixed(2)} €` : 'auf Anfrage',
    status: subscription.softwareEnabled ? 'Aktiv' : subscription.status === 'cancelled' || subscription.status === 'rejected' ? 'Inaktiv' : 'In Prüfung',
    software_enabled: subscription.softwareEnabled,
  })
  await appendAuditLog({
    action: 'owner.customer.synced_from_subscription',
    targetType: 'buero_kunde',
    targetId: customerId,
    payload: { subscriptionId: subscription.id },
  })
  return customerId
}

export async function ensureOwnerOrderForSubscription(subscription: SubscriptionRecord, customerId?: string) {
  const finalCustomerId = customerId ?? `BILL-${subscription.id}`
  const pilotSummary = subscription.pilotIds.length ? subscription.pilotIds.join(', ') : 'Einzelbuchung'
  const orderId = `AUF-${subscription.id}`
  await upsertBueroAuftrag({
    id: orderId,
    kunde_id: finalCustomerId,
    kunde: subscription.userEmail || subscription.userKey,
    billing_subscription_id: subscription.id,
    beschreibung: `Abo-Buchung ${subscription.packageId ?? pilotSummary}`,
    wert: subscription.monthlyPrice != null ? `${subscription.monthlyPrice.toFixed(2)} € / Monat` : 'auf Anfrage',
    start: formatDateForUi(new Date()),
    status: subscription.softwareEnabled ? 'In Bearbeitung' : 'Geplant',
    fortschritt: subscription.softwareEnabled ? 25 : 0,
  })
  await appendAuditLog({
    action: 'billing.order.synced_from_subscription',
    targetType: 'buero_auftrag',
    targetId: orderId,
    payload: { subscriptionId: subscription.id, customerId: finalCustomerId },
  })
  return orderId
}

export async function buildSubscriptionInvoiceDraft(subscription: SubscriptionRecord, customerId: string, opts?: {
  taxRate?: number
  issueDate?: Date
  dueInDays?: number
  periodStart?: string
  periodEnd?: string
}): Promise<SubscriptionInvoiceDraft> {
  const issueDate = opts?.issueDate ?? new Date()
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + (opts?.dueInDays ?? 14))
  // monthlyPrice ist Brutto (inkl. MwSt.) — Netto rückwärts berechnen
  const grossAmount = Number(subscription.monthlyPrice ?? 0)
  const taxRate = Number(opts?.taxRate ?? 19)
  const netAmount = Number((grossAmount / (1 + taxRate / 100)).toFixed(2))
  const taxAmount = Number((grossAmount - netAmount).toFixed(2))
  return {
    id: genId('RE'),
    number: await getNextInvoiceNumber(),
    customerId,
    subscriptionId: subscription.id,
    issueDate: formatDateForUi(issueDate),
    dueDate: formatDateForUi(dueDate),
    periodStart: opts?.periodStart,
    periodEnd: opts?.periodEnd,
    netAmount,
    taxRate,
    taxAmount,
    grossAmount,
    status: 'Offen',
  }
}

export async function createBillingInvoiceForSubscription(subscription: SubscriptionRecord, opts?: {
  taxRate?: number
  dueInDays?: number
  issueDate?: Date
  periodStart?: string
  periodEnd?: string
}) {
  const customerId = await ensureOwnerCustomerForSubscription(subscription)
  const draft = await buildSubscriptionInvoiceDraft(subscription, customerId, opts)
  await upsertBueroRechnung({
    id: draft.id,
    kunde_id: draft.customerId,
    billing_subscription_id: draft.subscriptionId,
    kunde: subscription.userEmail || subscription.userKey,
    nummer: draft.number,
    rechnungstyp: 'subscription',
    betrag: `${draft.grossAmount.toFixed(2)} €`,
    summe: draft.grossAmount,
    netto: draft.netAmount,
    steuer_satz: draft.taxRate,
    steuerbetrag: draft.taxAmount,
    auto_generated: true,
    leistungszeitraum_von: draft.periodStart,
    leistungszeitraum_bis: draft.periodEnd,
    faellig: draft.dueDate,
    erstellt: draft.issueDate,
    status: draft.status,
  })
  await appendAuditLog({
    action: 'billing.invoice.created',
    targetType: 'buero_rechnung',
    targetId: draft.id,
    payload: { subscriptionId: subscription.id, customerId, grossAmount: draft.grossAmount },
  })
  return draft
}

export async function ensureBookingAutomation(subscription: SubscriptionRecord) {
  const customerId = await ensureOwnerCustomerForSubscription(subscription)
  const orderId = await ensureOwnerOrderForSubscription(subscription, customerId)
  const existingInvoice = await getLatestBueroRechnungBySubscriptionId(subscription.id)
  return { customerId, orderId, hasExistingInvoice: Boolean(existingInvoice) }
}

export async function recordSubscriptionPayment(subscription: SubscriptionRecord, input: {
  invoiceId?: string
  providerRef?: string
  method?: string
  status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  amount?: number
  currency?: string
  bookedAt?: string
  failureReason?: string
  metadata?: Record<string, unknown>
}) {
  const customerId = `BILL-${subscription.id}`
  const payment = await upsertBillingPayment({
    customer_id: customerId,
    billing_subscription_id: subscription.id,
    invoice_id: input.invoiceId,
    provider: 'stripe',
    provider_ref: input.providerRef,
    method: input.method,
    status: input.status,
    amount: input.amount ?? subscription.monthlyPrice ?? 0,
    currency: input.currency ?? 'EUR',
    booked_at: input.bookedAt,
    failure_reason: input.failureReason,
    metadata: input.metadata,
  })
  await appendAuditLog({
    action: 'billing.payment.recorded',
    targetType: 'billing_payment',
    targetId: payment.id,
    payload: { subscriptionId: subscription.id, status: payment.status, providerRef: payment.providerRef },
  })
  return payment
}
