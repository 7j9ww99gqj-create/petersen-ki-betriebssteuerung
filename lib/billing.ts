import type { BookingStatus, EmployeeTierId, PackageId, PilotId } from './pricingConfig'

export type SubscriptionRecord = {
  id: string
  userKey: string
  userEmail?: string
  packageId?: PackageId
  pilotIds: PilotId[]
  employeeTier: EmployeeTierId
  monthlyPrice: number | null
  status: BookingStatus
  createdAt: string
  updatedAt: string
  nextPayment?: string
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

export async function getCurrentSubscription(userKey: string): Promise<SubscriptionRecord | null> {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey(userKey))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SubscriptionRecord
  } catch {
    return null
  }
}

export async function createBookingRequest(input: BookingRequestInput): Promise<SubscriptionRecord> {
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
    createdAt: now,
    updatedAt: now,
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(input.userKey), JSON.stringify(record))
  }
  return record
}

export async function updateBookingStatus(userKey: string, status: BookingStatus): Promise<SubscriptionRecord | null> {
  const current = await getCurrentSubscription(userKey)
  if (!current) return null
  const updated: SubscriptionRecord = { ...current, status, updatedAt: new Date().toISOString() }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(updated))
  }
  return updated
}

