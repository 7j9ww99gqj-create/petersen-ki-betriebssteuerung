import { NextRequest, NextResponse } from 'next/server'

import { getAccessProfile, normalizeAccessExpiry, normalizeAccessMode, normalizeAccessStatus, normalizeAllowedPilotIds } from '@/lib/access'
import { genId } from '@/lib/ids'
import type { PilotId } from '@/lib/pricingConfig'
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase-admin'
import { getRouteAccess, type ServerAppRole } from '@/lib/server-auth'

const MANAGER_ROLES: ServerAppRole[] = ['Inhaber', 'Admin']
const MANAGED_ROLES = ['Inhaber', 'Admin', 'Mitarbeiter', 'Büro', 'Werkstatt', 'Lager'] as const

type ManagedRole = (typeof MANAGED_ROLES)[number]
type AuthMetadata = Record<string, unknown>
type AdminAuthUser = {
  id: string
  email?: string | null
  created_at?: string | null
  last_sign_in_at?: string | null
  app_metadata?: AuthMetadata | null
  user_metadata?: AuthMetadata | null
}
type BillingSubscriptionAdminRow = {
  id: string
  user_id?: string | null
  user_email?: string | null
  employee_tier?: string | null
  status?: string | null
  software_enabled?: boolean | null
}
type SeatEntitlement = {
  subscriptionId?: string
  ownerUserId?: string
  ownerEmail?: string
  employeeTier?: string
  maxSeats: number
  usedSeats: number
  remainingSeats: number
  hasActiveSubscription: boolean
  canCreateUsers: boolean
  reason: string
}

function normalizeManagedRole(value: unknown): ManagedRole {
  if (typeof value === 'string' && MANAGED_ROLES.includes(value as ManagedRole)) {
    return value as ManagedRole
  }
  return 'Mitarbeiter'
}

function getMetadataValue(metadata: AuthMetadata | null | undefined, key: string) {
  return metadata && key in metadata ? metadata[key] : undefined
}

function getLinkedSubscriptionId(user: AdminAuthUser) {
  const linked = getMetadataValue(user.app_metadata, 'billing_subscription_id') ?? getMetadataValue(user.user_metadata, 'billing_subscription_id')
  return typeof linked === 'string' ? linked : ''
}

function getOwnerUserId(user: AdminAuthUser) {
  const linked = getMetadataValue(user.app_metadata, 'account_owner_user_id') ?? getMetadataValue(user.user_metadata, 'account_owner_user_id')
  return typeof linked === 'string' ? linked : ''
}

function mapManagedUser(user: AdminAuthUser) {
  const role = normalizeManagedRole(getMetadataValue(user.app_metadata, 'role') ?? getMetadataValue(user.user_metadata, 'role'))
  const access = getAccessProfile(user)
  return {
    id: String(user.id),
    email: String(user.email ?? ''),
    fullName: typeof getMetadataValue(user.user_metadata, 'full_name') === 'string' ? String(getMetadataValue(user.user_metadata, 'full_name')) : '',
    role,
    accessStatus: access.status,
    accessMode: access.mode,
    accessExpiresAt: access.expiresAt,
    allowedPilotIds: access.allowedPilotIds,
    createdAt: typeof user.created_at === 'string' ? user.created_at : '',
    lastSignInAt: typeof user.last_sign_in_at === 'string' ? user.last_sign_in_at : '',
    isOwnerAccount: String(user.email ?? '').toLowerCase() === 'info@petersen-ki-pilot.de',
  }
}

function seatLimitFromTier(tier: string | null | undefined) {
  switch (tier) {
    case '1-3':
      return 3
    case '4-10':
      return 10
    case '11-30':
      return 30
    case '30+':
      return 999
    default:
      return 0
  }
}

function isSubscriptionActive(subscription: BillingSubscriptionAdminRow | null) {
  return Boolean(subscription && subscription.status === 'active' && subscription.software_enabled)
}

function buildSeatReason(subscription: BillingSubscriptionAdminRow | null, remainingSeats: number) {
  if (!subscription) return 'Kein aktives Abo mit Mitarbeiterstaffel gefunden.'
  if (subscription.status !== 'active') return `Abo ist nicht aktiv (${subscription.status ?? 'unbekannt'}).`
  if (!subscription.software_enabled) return 'Software fuer dieses Abo ist noch nicht freigeschaltet.'
  if (remainingSeats <= 0) return 'Mitarbeiterlimit des aktuellen Abos ist erreicht.'
  return 'Seats verfuegbar.'
}

async function listAllUsers(admin = createSupabaseAdminClient()) {
  const users: AdminAuthUser[] = []
  let page = 1

  while (page <= 10) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (result.error) throw result.error

    const chunk = (result.data?.users ?? []) as AdminAuthUser[]
    users.push(...chunk)
    if (chunk.length < 200) break
    page += 1
  }

  return users
}

async function getSubscriptionById(admin: ReturnType<typeof createSupabaseAdminClient>, id: string) {
  const result = await admin
    .from('billing_subscriptions')
    .select('id, user_id, user_email, employee_tier, status, software_enabled')
    .eq('id', id)
    .maybeSingle()
  if (result.error) throw result.error
  return (result.data ?? null) as BillingSubscriptionAdminRow | null
}

async function getSubscriptionByOwnerUserId(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const result = await admin
    .from('billing_subscriptions')
    .select('id, user_id, user_email, employee_tier, status, software_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (result.error) throw result.error
  return (result.data ?? null) as BillingSubscriptionAdminRow | null
}

async function resolveSeatEntitlement(actor: AdminAuthUser, admin: ReturnType<typeof createSupabaseAdminClient>, users?: AdminAuthUser[]) {
  const directSubscriptionId = getLinkedSubscriptionId(actor)
  const linkedOwnerUserId = getOwnerUserId(actor)

  let subscription: BillingSubscriptionAdminRow | null = null
  if (directSubscriptionId) {
    subscription = await getSubscriptionById(admin, directSubscriptionId)
  }
  if (!subscription) {
    subscription = await getSubscriptionByOwnerUserId(admin, actor.id)
  }
  if (!subscription && linkedOwnerUserId) {
    subscription = await getSubscriptionByOwnerUserId(admin, linkedOwnerUserId)
  }

  const allUsers = users ?? await listAllUsers(admin)
  const maxSeats = seatLimitFromTier(subscription?.employee_tier)
  const usedSeatUserIds = new Set<string>()
  if (subscription?.user_id) {
    usedSeatUserIds.add(subscription.user_id)
  }
  if (subscription) {
    for (const user of allUsers) {
      if (getLinkedSubscriptionId(user) === subscription.id) {
        usedSeatUserIds.add(user.id)
      }
    }
  }
  const usedSeats = subscription ? usedSeatUserIds.size : 0
  const remainingSeats = Math.max(0, maxSeats - usedSeats)
  const canCreateUsers = isSubscriptionActive(subscription) && remainingSeats > 0

  return {
    subscription,
    users: allUsers,
    entitlement: {
      subscriptionId: subscription?.id,
      ownerUserId: subscription?.user_id ?? (linkedOwnerUserId || undefined),
      ownerEmail: subscription?.user_email ?? undefined,
      employeeTier: subscription?.employee_tier ?? undefined,
      maxSeats,
      usedSeats,
      remainingSeats,
      hasActiveSubscription: isSubscriptionActive(subscription),
      canCreateUsers,
      reason: buildSeatReason(subscription, remainingSeats),
    } satisfies SeatEntitlement,
  }
}

function assertManagerMayAssignRole(actorRole: ServerAppRole, nextRole: ManagedRole) {
  if (actorRole !== 'Inhaber' && nextRole === 'Inhaber') {
    return 'Nur der Inhaber darf die Inhaber-Rolle vergeben oder aendern.'
  }
  return null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function generateTemporaryPassword() {
  return `Pk!${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}9a`
}

async function insertAuditLog(admin: ReturnType<typeof createSupabaseAdminClient>, input: {
  actorUserId: string
  ownerUserId?: string
  action: string
  targetId?: string
  payload?: Record<string, unknown>
}) {
  await admin.from('audit_logs').insert({
    id: genId('AUD'),
    owner_user_id: input.ownerUserId ?? null,
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: 'auth_user',
    target_id: input.targetId ?? null,
    payload: input.payload ?? {},
  })
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req, MANAGER_ROLES)
  if (access.error) return access.error
  if (!access.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase-Service-Role ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const admin = createSupabaseAdminClient()
  const users = await listAllUsers(admin)
  const { entitlement } = await resolveSeatEntitlement(access.user as AdminAuthUser, admin, users)
  const mapped = users
    .map(mapManagedUser)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return NextResponse.json({
    ok: true,
    actorRole: access.role,
    entitlement,
    users: mapped,
  })
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req, MANAGER_ROLES)
  if (access.error) return access.error
  if (!access.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase-Service-Role ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as {
    mode?: 'invite' | 'create'
    email?: string
    fullName?: string
    role?: string
    password?: string
  } | null

  const mode = body?.mode === 'create' ? 'create' : 'invite'
  const email = body?.email?.trim().toLowerCase() ?? ''
  const fullName = body?.fullName?.trim() ?? ''
  const nextRole = normalizeManagedRole(body?.role)
  const password = body?.password?.trim() ?? ''

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Bitte eine gueltige E-Mail angeben.' }, { status: 400 })
  }

  const roleError = assertManagerMayAssignRole(access.role!, nextRole)
  if (roleError) {
    return NextResponse.json({ error: roleError }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()
  const users = await listAllUsers(admin)
  const existingUser = users.find(user => String(user.email ?? '').toLowerCase() === email)
  if (existingUser) {
    return NextResponse.json({ error: 'Fuer diese E-Mail existiert bereits ein Benutzer.' }, { status: 409 })
  }

  const { subscription, entitlement } = await resolveSeatEntitlement(access.user as AdminAuthUser, admin, users)
  if (!subscription || !entitlement.canCreateUsers) {
    return NextResponse.json({ error: entitlement.reason }, { status: 403 })
  }

  const userMetadata: AuthMetadata = {
    full_name: fullName || email.split('@')[0],
    role: nextRole,
    access_status: 'active',
    access_mode: 'standard',
    allowed_pilot_ids: [],
    access_expires_at: null,
    billing_subscription_id: subscription.id,
    account_owner_user_id: subscription.user_id ?? access.user.id,
    managed_by_user_id: access.user.id,
    employee_tier: subscription.employee_tier ?? null,
  }
  const appMetadata: AuthMetadata = {
    role: nextRole,
    access_status: 'active',
    access_mode: 'standard',
    allowed_pilot_ids: [],
    access_expires_at: null,
    billing_subscription_id: subscription.id,
    account_owner_user_id: subscription.user_id ?? access.user.id,
    managed_by_user_id: access.user.id,
  }

  let createdUser: AdminAuthUser | null = null
  let temporaryPassword: string | null = null

  if (mode === 'invite') {
    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      data: userMetadata,
      redirectTo: `${req.nextUrl.origin}/auth/callback`,
    })
    if (inviteResult.error || !inviteResult.data?.user) {
      return NextResponse.json({ error: inviteResult.error?.message ?? 'Einladung konnte nicht erstellt werden.' }, { status: 500 })
    }

    const invitedUser = inviteResult.data.user as AdminAuthUser
    const updateResult = await admin.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    })
    if (updateResult.error || !updateResult.data?.user) {
      return NextResponse.json({ error: updateResult.error?.message ?? 'Eingeladener Benutzer konnte nicht nachkonfiguriert werden.' }, { status: 500 })
    }
    createdUser = updateResult.data.user as AdminAuthUser
  } else {
    temporaryPassword = password || generateTemporaryPassword()
    const createResult = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    })
    if (createResult.error || !createResult.data?.user) {
      return NextResponse.json({ error: createResult.error?.message ?? 'Benutzer konnte nicht angelegt werden.' }, { status: 500 })
    }
    createdUser = createResult.data.user as AdminAuthUser
  }

  await insertAuditLog(admin, {
    actorUserId: access.user.id,
    ownerUserId: entitlement.ownerUserId,
    action: mode === 'invite' ? 'user.invited' : 'user.created',
    targetId: createdUser.id,
    payload: {
      email,
      role: nextRole,
      billing_subscription_id: subscription.id,
      employee_tier: subscription.employee_tier ?? null,
      mode,
    },
  })

  const nextEntitlement = {
    ...entitlement,
    usedSeats: entitlement.usedSeats + 1,
    remainingSeats: Math.max(0, entitlement.remainingSeats - 1),
    canCreateUsers: entitlement.remainingSeats - 1 > 0 && entitlement.hasActiveSubscription,
    reason: buildSeatReason(subscription, entitlement.remainingSeats - 1),
  }

  return NextResponse.json({
    ok: true,
    mode,
    user: mapManagedUser(createdUser),
    entitlement: nextEntitlement,
    temporaryPassword,
  })
}

export async function PATCH(req: NextRequest) {
  const access = await getRouteAccess(req, MANAGER_ROLES)
  if (access.error) return access.error
  if (!access.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase-Service-Role ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as {
    userId?: string
    role?: string
    accessStatus?: string
    accessMode?: string
    accessExpiresAt?: string | null
    allowedPilotIds?: string[]
  } | null
  const userId = body?.userId?.trim()
  const nextRole = normalizeManagedRole(body?.role)
  const nextAccessStatus = body?.accessStatus ? normalizeAccessStatus(body.accessStatus) : null
  const nextAccessMode = body?.accessMode ? normalizeAccessMode(body.accessMode) : null
  const nextAccessExpiresAt = body && 'accessExpiresAt' in body ? normalizeAccessExpiry(body.accessExpiresAt) : undefined
  const nextAllowedPilotIds = Array.isArray(body?.allowedPilotIds) ? normalizeAllowedPilotIds(body?.allowedPilotIds) : null

  if (!userId) {
    return NextResponse.json({ error: 'userId fehlt.' }, { status: 400 })
  }
  if (access.user.id === userId && typeof body?.role === 'string') {
    return NextResponse.json({ error: 'Die eigene Rolle kann hier nicht geaendert werden.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const targetResult = await admin.auth.admin.getUserById(userId)
  if (targetResult.error || !targetResult.data?.user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
  }

  const targetUser = targetResult.data.user as AdminAuthUser
  const currentRole = normalizeManagedRole(getMetadataValue(targetUser.app_metadata, 'role') ?? getMetadataValue(targetUser.user_metadata, 'role'))
  const currentAccess = getAccessProfile(targetUser)

  if (access.role !== 'Inhaber') {
    if (currentRole === 'Inhaber' || nextRole === 'Inhaber') {
      return NextResponse.json({ error: 'Nur der Inhaber darf die Inhaber-Rolle vergeben oder aendern.' }, { status: 403 })
    }
  }

  const appMetadata = {
    ...(targetUser.app_metadata ?? {}),
    ...(typeof body?.role === 'string' ? { role: nextRole } : {}),
    ...(nextAccessStatus ? { access_status: nextAccessStatus } : {}),
    ...(nextAccessMode ? { access_mode: nextAccessMode } : {}),
    ...(nextAccessExpiresAt !== undefined ? { access_expires_at: nextAccessExpiresAt } : {}),
    ...(nextAllowedPilotIds ? { allowed_pilot_ids: nextAllowedPilotIds } : {}),
  }
  const userMetadata = {
    ...(targetUser.user_metadata ?? {}),
    ...(typeof body?.role === 'string' ? { role: nextRole } : {}),
    ...(nextAccessStatus ? { access_status: nextAccessStatus } : {}),
    ...(nextAccessMode ? { access_mode: nextAccessMode } : {}),
    ...(nextAccessExpiresAt !== undefined ? { access_expires_at: nextAccessExpiresAt } : {}),
    ...(nextAllowedPilotIds ? { allowed_pilot_ids: nextAllowedPilotIds } : {}),
  }

  const updateResult = await admin.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  })
  if (updateResult.error || !updateResult.data?.user) {
    return NextResponse.json({ error: updateResult.error?.message ?? 'Benutzer konnte nicht aktualisiert werden.' }, { status: 500 })
  }

  await insertAuditLog(admin, {
    actorUserId: access.user.id,
    ownerUserId: access.role === 'Inhaber' ? access.user.id : undefined,
    action: 'user.role.updated',
    targetId: userId,
    payload: {
      previous_role: currentRole,
      next_role: typeof body?.role === 'string' ? nextRole : currentRole,
      previous_access_status: currentAccess.status,
      next_access_status: nextAccessStatus ?? currentAccess.status,
      previous_access_mode: currentAccess.mode,
      next_access_mode: nextAccessMode ?? currentAccess.mode,
      previous_allowed_pilot_ids: currentAccess.allowedPilotIds,
      next_allowed_pilot_ids: (nextAllowedPilotIds ?? currentAccess.allowedPilotIds) as PilotId[],
      previous_access_expires_at: currentAccess.expiresAt,
      next_access_expires_at: nextAccessExpiresAt === undefined ? currentAccess.expiresAt : nextAccessExpiresAt,
      target_email: targetUser.email ?? null,
    },
  })

  return NextResponse.json({
    ok: true,
    user: mapManagedUser(updateResult.data.user as AdminAuthUser),
  })
}

export async function DELETE(req: NextRequest) {
  const access = await getRouteAccess(req, MANAGER_ROLES)
  if (access.error) return access.error
  if (!access.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase-Service-Role ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as { userId?: string } | null
  const userId = body?.userId?.trim()

  if (!userId) {
    return NextResponse.json({ error: 'userId fehlt.' }, { status: 400 })
  }
  if (access.user.id === userId) {
    return NextResponse.json({ error: 'Sie koennen sich nicht selbst loeschen.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const targetResult = await admin.auth.admin.getUserById(userId)
  if (targetResult.error || !targetResult.data?.user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
  }

  const targetUser = targetResult.data.user as AdminAuthUser
  if (access.role !== 'Inhaber') {
    const targetRole = normalizeManagedRole(getMetadataValue(targetUser.app_metadata, 'role') ?? getMetadataValue(targetUser.user_metadata, 'role'))
    if (targetRole === 'Inhaber') {
      return NextResponse.json({ error: 'Nur der Inhaber darf ein Inhaber-Konto loeschen.' }, { status: 403 })
    }
  }

  const deleteResult = await admin.auth.admin.deleteUser(userId)
  if (deleteResult.error) {
    return NextResponse.json({ error: deleteResult.error.message ?? 'Benutzer konnte nicht geloescht werden.' }, { status: 500 })
  }

  await insertAuditLog(admin, {
    actorUserId: access.user.id,
    action: 'user.deleted',
    targetId: userId,
    payload: { target_email: targetUser.email ?? null },
  })

  return NextResponse.json({ ok: true, deletedUserId: userId })
}

// PUT: custom actions like resend-invite and disable
export async function PUT(req: NextRequest) {
  const access = await getRouteAccess(req, MANAGER_ROLES)
  if (access.error) return access.error
  if (!access.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase-Service-Role ist serverseitig nicht konfiguriert.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as {
    action?: string
    userId?: string
    email?: string
  } | null
  const action = body?.action?.trim()

  if (action === 'resend-invite') {
    const email = body?.email?.trim().toLowerCase()
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Bitte eine gueltige E-Mail angeben.' }, { status: 400 })
    }
    const admin = createSupabaseAdminClient()
    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.nextUrl.origin}/auth/callback`,
    })
    if (inviteResult.error) {
      return NextResponse.json({ error: inviteResult.error.message ?? 'Einladung konnte nicht erneut gesendet werden.' }, { status: 500 })
    }
    await insertAuditLog(admin, {
      actorUserId: access.user.id,
      action: 'user.invite.resent',
      targetId: inviteResult.data?.user?.id ?? undefined,
      payload: { email },
    })
    return NextResponse.json({ ok: true, email })
  }

  if (action === 'disable') {
    const userId = body?.userId?.trim()
    if (!userId) {
      return NextResponse.json({ error: 'userId fehlt.' }, { status: 400 })
    }
    if (access.user.id === userId) {
      return NextResponse.json({ error: 'Sie koennen sich nicht selbst deaktivieren.' }, { status: 400 })
    }
    const admin = createSupabaseAdminClient()
    const targetResult = await admin.auth.admin.getUserById(userId)
    if (targetResult.error || !targetResult.data?.user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
    }
    const targetUser = targetResult.data.user as AdminAuthUser
    const appMetadata = { ...(targetUser.app_metadata ?? {}), access_status: 'suspended' }
    const userMetadata = { ...(targetUser.user_metadata ?? {}), access_status: 'suspended' }
    const updateResult = await admin.auth.admin.updateUserById(userId, { app_metadata: appMetadata, user_metadata: userMetadata })
    if (updateResult.error || !updateResult.data?.user) {
      return NextResponse.json({ error: updateResult.error?.message ?? 'Benutzer konnte nicht deaktiviert werden.' }, { status: 500 })
    }
    await insertAuditLog(admin, {
      actorUserId: access.user.id,
      action: 'user.disabled',
      targetId: userId,
      payload: { target_email: targetUser.email ?? null },
    })
    return NextResponse.json({ ok: true, user: mapManagedUser(updateResult.data.user as AdminAuthUser) })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
