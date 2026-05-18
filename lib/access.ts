type AuthMetadata = Record<string, unknown>

export type AccessStatus = 'pending' | 'active' | 'suspended'
export type AccessMode = 'standard' | 'demo'
export type AccessPilotId = 'lager' | 'buero' | 'werkstatt' | 'marketing' | 'analyse' | 'planung' | 'steuer'
export type AccessRole = 'Inhaber' | 'Admin' | 'Mitarbeiter' | 'Büro' | 'Werkstatt' | 'Lager'

type MetadataCarrier = {
  app_metadata?: AuthMetadata | null
  user_metadata?: AuthMetadata | null
}

const ACCESS_PILOTS: AccessPilotId[] = ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer']
const ACCESS_ROLES: AccessRole[] = ['Inhaber', 'Admin', 'Mitarbeiter', 'Büro', 'Werkstatt', 'Lager']

const DEFAULT_ROLE_PILOTS: Record<AccessRole, AccessPilotId[]> = {
  Inhaber: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer'],
  Admin: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer'],
  Mitarbeiter: ['lager', 'buero', 'werkstatt', 'analyse', 'planung'],
  Büro: ['buero', 'analyse'],
  Werkstatt: ['werkstatt', 'lager', 'planung'],
  Lager: ['lager'],
}

export type UserAccessProfile = {
  role: AccessRole
  status: AccessStatus
  mode: AccessMode
  allowedPilotIds: AccessPilotId[]
  hasExplicitPilotGrant: boolean
  expiresAt: string | null
  isExpired: boolean
  canAccessDashboard: boolean
  requiresApproval: boolean
}

function getMetadataValue(metadata: AuthMetadata | null | undefined, key: string) {
  return metadata && key in metadata ? metadata[key] : undefined
}

function hasMetadataKey(metadata: AuthMetadata | null | undefined, key: string) {
  return Boolean(metadata && key in metadata)
}

export function normalizeAccessRole(value: unknown): AccessRole {
  return typeof value === 'string' && ACCESS_ROLES.includes(value as AccessRole)
    ? value as AccessRole
    : 'Mitarbeiter'
}

export function normalizeAccessStatus(value: unknown): AccessStatus {
  return value === 'pending' || value === 'active' || value === 'suspended' ? value : 'active'
}

export function normalizeAccessMode(value: unknown): AccessMode {
  return value === 'demo' ? 'demo' : 'standard'
}

export function normalizeAllowedPilotIds(value: unknown): AccessPilotId[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is AccessPilotId => typeof entry === 'string' && ACCESS_PILOTS.includes(entry as AccessPilotId))
}

export function normalizeAccessExpiry(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function isAccessExpired(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() < now
}

export function getAccessProfile(user: MetadataCarrier): UserAccessProfile {
  const role = normalizeAccessRole(getMetadataValue(user.app_metadata, 'role') ?? getMetadataValue(user.user_metadata, 'role'))
  const status = normalizeAccessStatus(getMetadataValue(user.app_metadata, 'access_status') ?? getMetadataValue(user.user_metadata, 'access_status'))
  const mode = normalizeAccessMode(getMetadataValue(user.app_metadata, 'access_mode') ?? getMetadataValue(user.user_metadata, 'access_mode'))
  const hasExplicitPilotGrant = hasMetadataKey(user.app_metadata, 'allowed_pilot_ids') || hasMetadataKey(user.user_metadata, 'allowed_pilot_ids')
  const explicitPilotIds = normalizeAllowedPilotIds(getMetadataValue(user.app_metadata, 'allowed_pilot_ids') ?? getMetadataValue(user.user_metadata, 'allowed_pilot_ids'))
  const allowedPilotIds = hasExplicitPilotGrant ? explicitPilotIds : DEFAULT_ROLE_PILOTS[role]
  const expiresAt = normalizeAccessExpiry(getMetadataValue(user.app_metadata, 'access_expires_at') ?? getMetadataValue(user.user_metadata, 'access_expires_at'))
  const expired = isAccessExpired(expiresAt)
  const canAccessDashboard = status === 'active' && !expired

  return {
    role,
    status,
    mode,
    allowedPilotIds,
    hasExplicitPilotGrant,
    expiresAt,
    isExpired: expired,
    canAccessDashboard,
    requiresApproval: status !== 'active' || expired,
  }
}

export function getAccessStatusMessage(profile: UserAccessProfile) {
  if (profile.isExpired) return 'Ihr Zugang ist abgelaufen. Bitte warten Sie auf eine neue Freigabe.'
  if (profile.status === 'pending') return 'Ihr Account wurde erstellt und wartet jetzt auf Freischaltung durch den Inhaber.'
  if (profile.status === 'suspended') return 'Ihr Zugang ist derzeit gesperrt. Bitte kontaktieren Sie den Inhaber.'
  if (profile.allowedPilotIds.length === 0) return 'Ihr Zugang ist aktiv, aber es wurden Ihnen noch keine Piloten zugewiesen.'
  if (profile.mode === 'demo' && profile.expiresAt) return `Ihr Demo-Zugang ist bis ${new Date(profile.expiresAt).toLocaleDateString('de-DE')} freigeschaltet.`
  return 'Ihr Zugang ist aktiv.'
}
