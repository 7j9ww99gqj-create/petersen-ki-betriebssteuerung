'use client'
import { useEffect, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

export type AppRole = 'Admin' | 'Mitarbeiter' | 'Büro' | 'Werkstatt' | 'Lager'
export const APP_ROLES: AppRole[] = ['Admin', 'Mitarbeiter', 'Büro', 'Werkstatt', 'Lager']

export const ROLE_LABELS: Record<AppRole, string> = {
  Admin: '🔑 Admin',
  Mitarbeiter: '👤 Mitarbeiter',
  Büro: '🧾 Büro',
  Werkstatt: '🛠️ Werkstatt',
  Lager: '📦 Lager',
}

export const ROLE_PILOTS: Record<AppRole, string[]> = {
  Admin: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'ki-erkennung', 'cloud', 'archiv', 'einstellungen'],
  Mitarbeiter: ['lager', 'buero', 'werkstatt', 'analyse', 'planung', 'ki-erkennung'],
  Büro: ['buero', 'analyse', 'archiv', 'einstellungen'],
  Werkstatt: ['werkstatt', 'lager', 'planung', 'ki-erkennung'],
  Lager: ['lager', 'ki-erkennung'],
}

export const PERMISSIONS = {
  canDelete: (role: AppRole) => role === 'Admin',
  canCreate: (role: AppRole) => role === 'Admin' || role === 'Mitarbeiter',
  canEdit: (role: AppRole) => role !== 'Lager',
  canManageRoles: (role: AppRole) => role === 'Admin',
  canExport: (role: AppRole) => role === 'Admin' || role === 'Büro',
}

export function normalizeRole(value: unknown): AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole)
    ? value as AppRole
    : 'Admin'
}

function readLocalRole(): AppRole {
  if (typeof window === 'undefined') return 'Admin'
  return normalizeRole(localStorage.getItem('pk_role'))
}

async function readAuthRole(): Promise<AppRole | null> {
  if (typeof window === 'undefined' || hasDemoCookie() || !isSupabaseConfigured()) return null

  try {
    const supabase = createSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const rawRole = user.app_metadata?.role ?? user.user_metadata?.role
    if (typeof rawRole !== 'string' || !APP_ROLES.includes(rawRole as AppRole)) return null

    return rawRole as AppRole
  } catch {
    return null
  }
}

export async function loadRole(): Promise<AppRole> {
  if (typeof window === 'undefined') return 'Admin'
  if (hasDemoCookie()) return 'Admin'

  const authRole = await readAuthRole()
  if (authRole) {
    localStorage.setItem('pk_role', authRole)
    return authRole
  }

  return readLocalRole()
}

export async function setRole(role: AppRole): Promise<AppRole> {
  if (typeof window === 'undefined') return role

  const normalized = normalizeRole(role)
  localStorage.setItem('pk_role', normalized)

  if (hasDemoCookie() || !isSupabaseConfigured()) return normalized

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({ data: { role: normalized } })
    if (error) throw error
  } catch {
    // lokale Rolle als Fallback beibehalten
  }

  return normalized
}

export function useRole(): {
  role: AppRole
  setRole: (role: AppRole) => Promise<AppRole>
  permissions: {
    canDelete: boolean
    canCreate: boolean
    canEdit: boolean
    canManageRoles: boolean
    canExport: boolean
  }
} {
  const [role, setRoleState] = useState<AppRole>('Admin')

  useEffect(() => {
    loadRole().then(setRoleState).catch(() => setRoleState(readLocalRole()))
  }, [])

  const handleSetRole = async (newRole: AppRole) => {
    const nextRole = await setRole(newRole)
    setRoleState(nextRole)
    return nextRole
  }

  return {
    role,
    setRole: handleSetRole,
    permissions: {
      canDelete: PERMISSIONS.canDelete(role),
      canCreate: PERMISSIONS.canCreate(role),
      canEdit: PERMISSIONS.canEdit(role),
      canManageRoles: PERMISSIONS.canManageRoles(role),
      canExport: PERMISSIONS.canExport(role),
    },
  }
}
