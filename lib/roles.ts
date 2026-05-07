'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'

export type AppRole = 'Admin' | 'Mitarbeiter' | 'Büro' | 'Werkstatt' | 'Lager'

export const ROLE_LABELS: Record<AppRole, string> = {
  Admin: '🔑 Admin',
  Mitarbeiter: '👤 Mitarbeiter',
  Büro: '🧾 Büro',
  Werkstatt: '🛠️ Werkstatt',
  Lager: '📦 Lager',
}

// Welche Piloten darf diese Rolle sehen?
export const ROLE_PILOTS: Record<AppRole, string[]> = {
  Admin: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'ki-erkennung', 'cloud', 'archiv', 'einstellungen'],
  Mitarbeiter: ['lager', 'buero', 'werkstatt', 'analyse', 'planung', 'ki-erkennung'],
  Büro: ['buero', 'analyse', 'archiv', 'einstellungen'],
  Werkstatt: ['werkstatt', 'lager', 'planung', 'ki-erkennung'],
  Lager: ['lager', 'ki-erkennung'],
}

// Was darf diese Rolle tun?
export const PERMISSIONS = {
  canDelete: (role: AppRole) => role === 'Admin',
  canCreate: (role: AppRole) => role === 'Admin' || role === 'Mitarbeiter',
  canEdit: (role: AppRole) => role !== 'Lager',
  canManageRoles: (role: AppRole) => role === 'Admin',
  canExport: (role: AppRole) => role === 'Admin' || role === 'Büro',
}

// Gespeichert in localStorage als 'pk_role'
// Demo-User hat immer 'Admin'-Rolle
export function getRole(): AppRole {
  if (typeof window === 'undefined') return 'Admin'
  if (hasDemoCookie()) return 'Admin'
  return (localStorage.getItem('pk_role') as AppRole) || 'Admin'
}

export function setRole(role: AppRole): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('pk_role', role)
}

export function useRole(): {
  role: AppRole
  setRole: (role: AppRole) => void
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
    setRoleState(getRole())
  }, [])

  const handleSetRole = (newRole: AppRole) => {
    setRole(newRole)
    setRoleState(newRole)
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
