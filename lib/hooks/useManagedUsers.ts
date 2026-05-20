'use client'
import { useCallback, useState } from 'react'
import { type AccessMode, type AccessStatus } from '@/lib/access'
import { type AppRole } from '@/lib/roles'
import { type PilotId } from '@/lib/pricingConfig'

/**
 * useManagedUsers — kapselt die komplette Inhaber-Tool-State-Machine für
 * Kundensteuerung / Registrierungen / Kunden-eingerichtet / Rollen-Tab.
 *
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 3b).
 *
 * Verantwortet:
 *  - Liste aller verwalteten User + Entitlement (Seat-Limits)
 *  - Per-User-Drafts (Rolle, AccessStatus/-Mode, AccessExpiresAt, Allowed Pilots)
 *  - Invite-/Create-Forms + temporäres Passwort-Echo nach Anlage
 *  - Transiente UI-Confirm-Flags (Delete, Disable), Saving-Indikator, Suche
 *  - Async-Actions: load, save, create/invite, disable, delete, resendInvite,
 *    applyRegistrationPreset
 */

export type ManagedUser = {
  id: string
  email: string
  fullName: string
  role: AppRole
  accessStatus: AccessStatus
  accessMode: AccessMode
  accessExpiresAt: string | null
  allowedPilotIds: PilotId[]
  createdAt: string
  lastSignInAt: string
  isOwnerAccount: boolean
}

export type ManagedUserAccessDraft = {
  accessStatus: AccessStatus
  accessMode: AccessMode
  accessExpiresAt: string
  allowedPilotIds: PilotId[]
}

export type ManagedUsersEntitlement = {
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

type ShowToast = (msg: string, type?: 'success' | 'error') => void

export function useManagedUsers({
  enabled,
  showToast,
}: {
  enabled: boolean
  showToast: ShowToast
}) {
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [managedRoleDrafts, setManagedRoleDrafts] = useState<Record<string, AppRole>>({})
  const [managedAccessDrafts, setManagedAccessDrafts] = useState<
    Record<string, ManagedUserAccessDraft>
  >({})
  const [loadingManagedUsers, setLoadingManagedUsers] = useState(false)
  const [savingManagedUserId, setSavingManagedUserId] = useState('')
  const [managedUsersError, setManagedUsersError] = useState('')
  const [managedUsersEntitlement, setManagedUsersEntitlement] =
    useState<ManagedUsersEntitlement | null>(null)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    role: 'Mitarbeiter' as AppRole,
  })
  const [createForm, setCreateForm] = useState({
    email: '',
    fullName: '',
    role: 'Mitarbeiter' as AppRole,
    password: '',
  })
  const [creatingMode, setCreatingMode] = useState<'invite' | 'create' | ''>('')
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<
    { email: string; password: string } | null
  >(null)
  const [pendingPilotSelections, setPendingPilotSelections] = useState<Record<string, PilotId[]>>(
    {},
  )
  const [deleteConfirmId, setDeleteConfirmId] = useState('')
  const [expandedCustomerInvoices, setExpandedCustomerInvoices] = useState<string | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [disableConfirmId, setDisableConfirmId] = useState('')
  const [userActionInProgress, setUserActionInProgress] = useState('')

  const loadManagedUsers = useCallback(async () => {
    if (!enabled) return
    setLoadingManagedUsers(true)
    setManagedUsersError('')
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        users?: ManagedUser[]
        entitlement?: ManagedUsersEntitlement
      } | null
      if (!res.ok) throw new Error(data?.error || 'Benutzer konnten nicht geladen werden.')
      const users = Array.isArray(data?.users) ? data.users : []
      setManagedUsers(users)
      setManagedRoleDrafts(Object.fromEntries(users.map(user => [user.id, user.role])))
      setManagedAccessDrafts(
        Object.fromEntries(
          users.map(user => [
            user.id,
            {
              accessStatus: user.accessStatus,
              accessMode: user.accessMode,
              accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '',
              allowedPilotIds: user.allowedPilotIds,
            },
          ]),
        ),
      )
      setManagedUsersEntitlement(data?.entitlement ?? null)
    } catch (error) {
      setManagedUsersError(
        error instanceof Error ? error.message : 'Benutzer konnten nicht geladen werden.',
      )
    } finally {
      setLoadingManagedUsers(false)
    }
  }, [enabled])

  const handleManagedUserSave = async (user: ManagedUser) => {
    const nextRole = managedRoleDrafts[user.id] ?? user.role
    const accessDraft =
      managedAccessDrafts[user.id] ?? {
        accessStatus: user.accessStatus,
        accessMode: user.accessMode,
        accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '',
        allowedPilotIds: user.allowedPilotIds,
      }
    setSavingManagedUserId(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
          accessStatus: accessDraft.accessStatus,
          accessMode: accessDraft.accessMode,
          accessExpiresAt: accessDraft.accessExpiresAt || null,
          allowedPilotIds: accessDraft.allowedPilotIds,
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        user?: ManagedUser
      } | null
      if (!res.ok || !data?.user)
        throw new Error(data?.error || 'Rolle konnte nicht gespeichert werden.')
      setManagedUsers(prev =>
        prev.map(entry => (entry.id === data.user!.id ? data.user! : entry)),
      )
      setManagedRoleDrafts(prev => ({ ...prev, [data.user!.id]: data.user!.role }))
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt
            ? data.user!.accessExpiresAt.slice(0, 10)
            : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ Zugang aktualisiert: ${data.user.email}`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Zugang konnte nicht gespeichert werden.',
        'error',
      )
    } finally {
      setSavingManagedUserId('')
    }
  }

  const handleManagedUserCreate = async (mode: 'invite' | 'create') => {
    const form = mode === 'invite' ? inviteForm : createForm
    setCreatingMode(mode)
    setNewlyCreatedSecret(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          email: form.email,
          fullName: form.fullName,
          role: form.role,
          password: mode === 'create' ? createForm.password : undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        user?: ManagedUser
        entitlement?: ManagedUsersEntitlement
        temporaryPassword?: string | null
      } | null
      if (!res.ok || !data?.user)
        throw new Error(data?.error || 'Benutzer konnte nicht erstellt werden.')

      setManagedUsers(prev => [data.user!, ...prev])
      setManagedRoleDrafts(prev => ({ ...prev, [data.user!.id]: data.user!.role }))
      setManagedUsersEntitlement(data?.entitlement ?? managedUsersEntitlement)
      if (mode === 'invite') {
        setInviteForm({ email: '', fullName: '', role: 'Mitarbeiter' })
        showToast(`✅ Einladung gesendet: ${data.user.email}`)
      } else {
        setCreateForm({ email: '', fullName: '', role: 'Mitarbeiter', password: '' })
        if (data.temporaryPassword) {
          setNewlyCreatedSecret({ email: data.user.email, password: data.temporaryPassword })
        }
        showToast(`✅ Benutzer angelegt: ${data.user.email}`)
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Benutzer konnte nicht erstellt werden.',
        'error',
      )
    } finally {
      setCreatingMode('')
    }
  }

  const handleDisableUser = async (user: ManagedUser) => {
    setUserActionInProgress(user.id)
    setDisableConfirmId('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'disable', userId: user.id }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        user?: ManagedUser
      } | null
      if (!res.ok || !data?.user)
        throw new Error(data?.error || 'Benutzer konnte nicht deaktiviert werden.')
      setManagedUsers(prev =>
        prev.map(entry => (entry.id === data.user!.id ? data.user! : entry)),
      )
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt
            ? data.user!.accessExpiresAt.slice(0, 10)
            : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ ${data.user.email} wurde deaktiviert`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen.',
        'error',
      )
    } finally {
      setUserActionInProgress('')
    }
  }

  const handleDeleteUser = async (user: ManagedUser) => {
    setUserActionInProgress(user.id)
    setDeleteConfirmId('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        deletedUserId?: string
      } | null
      if (!res.ok) throw new Error(data?.error || 'Benutzer konnte nicht geloescht werden.')
      setManagedUsers(prev => prev.filter(entry => entry.id !== user.id))
      showToast(`✅ ${user.email} wurde geloescht`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Loeschen fehlgeschlagen.', 'error')
    } finally {
      setUserActionInProgress('')
    }
  }

  const handleResendInvite = async (user: ManagedUser) => {
    setUserActionInProgress(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'resend-invite', email: user.email }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok)
        throw new Error(data?.error || 'Einladung konnte nicht erneut gesendet werden.')
      showToast(`✅ Einladung erneut gesendet an ${user.email}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Einladung fehlgeschlagen.', 'error')
    } finally {
      setUserActionInProgress('')
    }
  }

  const applyRegistrationPreset = async (
    user: ManagedUser,
    preset: 'demo7' | 'demo14' | 'standard',
    customPilotIds?: PilotId[],
  ) => {
    const expiresAt =
      preset === 'standard'
        ? null
        : new Date(
            Date.now() + (preset === 'demo7' ? 7 : 14) * 24 * 60 * 60 * 1000,
          ).toISOString()
    const defaultPilotIds: PilotId[] =
      preset === 'standard'
        ? ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer']
        : ['buero', 'lager', 'analyse']
    const pilotIds: PilotId[] = customPilotIds ?? defaultPilotIds
    setSavingManagedUserId(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          accessStatus: 'active',
          accessMode: preset === 'standard' ? 'standard' : 'demo',
          accessExpiresAt: expiresAt,
          allowedPilotIds: pilotIds,
        }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        user?: ManagedUser
      } | null
      if (!res.ok || !data?.user)
        throw new Error(data?.error || 'Freigabe konnte nicht gespeichert werden.')
      setManagedUsers(prev =>
        prev.map(entry => (entry.id === data.user!.id ? data.user! : entry)),
      )
      setManagedRoleDrafts(prev => ({ ...prev, [data.user!.id]: data.user!.role }))
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt
            ? data.user!.accessExpiresAt.slice(0, 10)
            : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ ${data.user.email} wurde freigeschaltet`)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Freigabe konnte nicht gespeichert werden.',
        'error',
      )
    } finally {
      setSavingManagedUserId('')
    }
  }

  return {
    // data
    managedUsers,
    managedUsersEntitlement,
    managedUsersError,
    loadingManagedUsers,
    // drafts
    managedRoleDrafts,
    setManagedRoleDrafts,
    managedAccessDrafts,
    setManagedAccessDrafts,
    // forms
    inviteForm,
    setInviteForm,
    createForm,
    setCreateForm,
    creatingMode,
    newlyCreatedSecret,
    // setters (für inline-JSX-onClick die direkt mutieren wollen)
    setManagedUsers,
    setSavingManagedUserId,
    setManagedUsersError,
    // transient UI
    savingManagedUserId,
    userActionInProgress,
    pendingPilotSelections,
    setPendingPilotSelections,
    deleteConfirmId,
    setDeleteConfirmId,
    disableConfirmId,
    setDisableConfirmId,
    expandedCustomerInvoices,
    setExpandedCustomerInvoices,
    userSearchQuery,
    setUserSearchQuery,
    // actions
    loadManagedUsers,
    handleManagedUserSave,
    handleManagedUserCreate,
    handleDisableUser,
    handleDeleteUser,
    handleResendInvite,
    applyRegistrationPreset,
  }
}

/**
 * Pure helper — baut `mailto:`-Link aus User + Preset.
 * Kein State, kein Hook — daher außerhalb der Hook-Closure.
 */
export function buildRegistrationMailHref(
  user: ManagedUser,
  preset: 'demo7' | 'demo14' | 'standard' | 'pending',
): string {
  const subject =
    preset === 'pending'
      ? 'Ihre Registrierung bei Petersen KI'
      : 'Ihr Zugang bei Petersen KI wurde freigeschaltet'
  const label =
    preset === 'demo7'
      ? 'Demo-Zugang fuer 7 Tage'
      : preset === 'demo14'
        ? 'Demo-Zugang fuer 14 Tage'
        : preset === 'standard'
          ? 'Standard-Zugang'
          : 'Registrierung in Pruefung'
  const body = [
    `Guten Tag ${user.fullName || ''}`.trim() + ',',
    '',
    preset === 'pending'
      ? 'vielen Dank fuer Ihre Registrierung. Ihr Zugang wird aktuell geprueft.'
      : `Ihr ${label} wurde freigeschaltet.`,
    preset === 'pending' ? '' : `Login: ${user.email}`,
    preset === 'pending' ? '' : 'Portal: https://petersen-ki-pilot.de/login',
    '',
    'Viele Gruesse',
  ]
    .filter(Boolean)
    .join('\n')
  return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
