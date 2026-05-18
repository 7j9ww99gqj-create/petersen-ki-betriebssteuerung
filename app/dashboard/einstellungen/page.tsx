'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { genId } from '@/lib/ids'
import { isDemoUser, hasDemoCookie, performLogout } from '@/lib/auth'
import { type AccessMode, type AccessStatus } from '@/lib/access'
import { type AppRole, APP_ROLES, INHABER_EMAIL, ROLE_LABELS, ROLE_PILOTS, PERMISSIONS, normalizeRole, useRole } from '@/lib/roles'
import {
  parseCsvFile, validateImportRows, autoMapColumns, buildImportRows,
  normalizeNumber, normalizeDate,
  TARGET_FIELDS, DEMO_CSV_ARTIKEL, DEMO_CSV_KUNDEN, DEMO_CSV_STEUER, DEMO_CSV_BUCHUNGEN,
  type ImportDataType, type ImportSource, type ImportParseResult, type ImportValidationResult,
} from '@/lib/importer'
import {
  getImportProtokolle, insertImportProtokoll,
  bulkImportLagerArtikel, bulkImportBueroKunden, bulkImportEinkaufLieferanten,
  bulkImportBueroRechnungen, bulkImportSteuerBelege, bulkImportSteuerBuchungen,
  bulkImportSteuerKonten, bulkImportWerkstattZeitbuchungen, bulkImportWerkstattMaterial,
  getFirmaEinstellungen, upsertFirmaEinstellungen, uploadFirmenLogo,
  uploadBriefpapier, deleteBriefpapier,
  type FirmaEinstellungen,
} from '@/lib/db'
import { PricingSettingsPage } from '@/components/billing/PricingSettingsPage'
import { OwnerAiControlPanel } from '@/components/billing/OwnerAiControlPanel'
import { OwnerCustomerControlPanel } from '@/components/billing/OwnerCustomerControlPanel'
import type { PilotId } from '@/lib/pricingConfig'

type NotifSettings = {
  wareneingaenge: boolean; niedrigerBestand: boolean; auftraege: boolean
  rechnungen: boolean; cloudSync: boolean; kiErkennungen: boolean
}

type ManagedUser = {
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

type ManagedUserAccessDraft = {
  accessStatus: AccessStatus
  accessMode: AccessMode
  accessExpiresAt: string
  allowedPilotIds: PilotId[]
}

type ManagedUsersEntitlement = {
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

type SettingsSection = 'profil' | 'firma' | 'billing' | 'kundensteuerung' | 'registrierungen' | 'kunden-eingerichtet' | 'aktivitaetslog' | 'benachrichtigungen' | 'rollen' | 'info' | 'import'

const SETTINGS_SECTIONS: SettingsSection[] = ['profil', 'firma', 'billing', 'kundensteuerung', 'registrierungen', 'kunden-eingerichtet', 'aktivitaetslog', 'benachrichtigungen', 'rollen', 'info', 'import']

const ACCESS_STATUS_OPTIONS: AccessStatus[] = ['pending', 'active', 'suspended']
const ACCESS_MODE_OPTIONS: AccessMode[] = ['standard', 'demo']
const MANAGED_PILOT_OPTIONS: PilotId[] = ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer']
const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  pending: 'Freigabe ausstehend',
  active: 'Aktiv',
  suspended: 'Gesperrt',
}
const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  standard: 'Standard',
  demo: 'Demo',
}
const PILOT_LABELS: Record<PilotId, string> = {
  lager: 'LagerPilot',
  buero: 'BüroPilot',
  werkstatt: 'WerkstattPilot',
  marketing: 'MarketingPilot',
  analyse: 'AnalysePilot',
  planung: 'PlanungPilot',
  steuer: 'SteuerPilot',
  custom: 'Custom',
}

export default function EinstellungenPage() {
  const router = useRouter()
  const [section, setSection] = useState<SettingsSection>('profil')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isDemo, setIsDemo] = useState(false)

  const { role: currentRole, setRole: applyRole } = useRole()
  const [selectedRole, setSelectedRole] = useState<AppRole>('Admin')
  const [paymentBanner, setPaymentBanner] = useState<{ type: 'success' | 'cancelled'; invoiceId?: string } | null>(null)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([])
  const [managedRoleDrafts, setManagedRoleDrafts] = useState<Record<string, AppRole>>({})
  const [managedAccessDrafts, setManagedAccessDrafts] = useState<Record<string, ManagedUserAccessDraft>>({})
  const [loadingManagedUsers, setLoadingManagedUsers] = useState(false)
  const [savingManagedUserId, setSavingManagedUserId] = useState('')
  const [managedUsersError, setManagedUsersError] = useState('')
  const [managedUsersEntitlement, setManagedUsersEntitlement] = useState<ManagedUsersEntitlement | null>(null)
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'Mitarbeiter' as AppRole })
  const [createForm, setCreateForm] = useState({ email: '', fullName: '', role: 'Mitarbeiter' as AppRole, password: '' })
  const [creatingMode, setCreatingMode] = useState<'invite' | 'create' | ''>('')
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<{ email: string; password: string } | null>(null)
  const [pendingPilotSelections, setPendingPilotSelections] = useState<Record<string, PilotId[]>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState('')
  const [expandedCustomerInvoices, setExpandedCustomerInvoices] = useState<string | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [disableConfirmId, setDisableConfirmId] = useState('')
  const [userActionInProgress, setUserActionInProgress] = useState('')

  // Sync picker with current role once loaded
  useEffect(() => { setSelectedRole(currentRole) }, [currentRole])

  // URL-Params auswerten: section und Stripe payment callback
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sectionParam = params.get('section')
    const payment = params.get('payment')
    const invoice = params.get('invoice')

    if (sectionParam && SETTINGS_SECTIONS.includes(sectionParam as SettingsSection)) {
      setSection(sectionParam as SettingsSection)
    } else if (payment === 'success' || payment === 'cancelled') {
      setSection('billing')
    }

    if (payment === 'success' || payment === 'cancelled') {
      setPaymentBanner({ type: payment as 'success' | 'cancelled', invoiceId: invoice || undefined })
    }

    if (sectionParam || payment) {
      const url = new URL(window.location.href)
      url.searchParams.delete('payment')
      url.searchParams.delete('invoice')
      url.searchParams.delete('section')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const [profil, setProfil] = useState({ name: '', email: '', role: 'Administrator', firma: '' })
  const [pwForm, setPwForm] = useState({ neu: '', bestaetigung: '' })
  const [notif, setNotif] = useState<NotifSettings>({
    wareneingaenge: true, niedrigerBestand: true, auftraege: true,
    rechnungen: true, cloudSync: false, kiErkennungen: false,
  })

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      const demo = isDemoUser(email)
      const resolvedRole = normalizeRole(user.app_metadata?.role ?? user.user_metadata?.role)
      setIsDemo(demo)
      setProfil({
        name: (user.user_metadata?.full_name as string) || email.split('@')[0] || '',
        email,
        role: demo ? 'Demo Admin' : ROLE_LABELS[resolvedRole],
        firma: (user.user_metadata?.firma as string) || '',
      })
    })
    const saved = localStorage.getItem('pk_notif')
    if (saved) setNotif(JSON.parse(saved))
  }, [])

  const isInhaberAccount = profil.email.toLowerCase() === INHABER_EMAIL || currentRole === 'Inhaber'
  const canManageLiveUsers = !isDemo && PERMISSIONS.canManageUsers(currentRole)

  const loadManagedUsers = useCallback(async () => {
    if (!canManageLiveUsers) return
    setLoadingManagedUsers(true)
    setManagedUsersError('')
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const data = await res.json().catch(() => null) as { error?: string; users?: ManagedUser[]; entitlement?: ManagedUsersEntitlement } | null
      if (!res.ok) throw new Error(data?.error || 'Benutzer konnten nicht geladen werden.')
      const users = Array.isArray(data?.users) ? data.users : []
      setManagedUsers(users)
      setManagedRoleDrafts(Object.fromEntries(users.map(user => [user.id, user.role])))
      setManagedAccessDrafts(Object.fromEntries(users.map(user => [user.id, {
        accessStatus: user.accessStatus,
        accessMode: user.accessMode,
        accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '',
        allowedPilotIds: user.allowedPilotIds,
      }])))
      setManagedUsersEntitlement(data?.entitlement ?? null)
    } catch (error) {
      setManagedUsersError(error instanceof Error ? error.message : 'Benutzer konnten nicht geladen werden.')
    } finally {
      setLoadingManagedUsers(false)
    }
  }, [canManageLiveUsers])

  useEffect(() => {
    if ((section === 'rollen' || section === 'registrierungen' || section === 'kunden-eingerichtet') && canManageLiveUsers) {
      void loadManagedUsers()
    }
  }, [section, canManageLiveUsers, loadManagedUsers])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  const handleProfilSave = async () => {
    if (!profil.name || !profil.email) { showToast('Name und E-Mail sind Pflichtfelder', 'error'); return }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profil.name, firma: profil.firma },
    })
    if (error) { showToast('Fehler beim Speichern: ' + error.message, 'error'); return }
    showToast('✅ Profil wurde gespeichert')
  }

  const handlePwSave = async () => {
    if (pwForm.neu.length < 6) { showToast('Neues Passwort muss mindestens 6 Zeichen lang sein', 'error'); return }
    if (pwForm.neu !== pwForm.bestaetigung) { showToast('Passwörter stimmen nicht überein', 'error'); return }
    const supabase = createSupabaseClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.neu })
    if (error) { showToast('Fehler: ' + error.message, 'error'); return }
    setPwForm({ neu: '', bestaetigung: '' })
    showToast('✅ Passwort wurde geändert')
  }

  const handleNotifSave = () => {
    localStorage.setItem('pk_notif', JSON.stringify(notif))
    showToast('✅ Benachrichtigungseinstellungen gespeichert')
  }

  const handleLogout = () => performLogout()

  const handleManagedUserSave = async (user: ManagedUser) => {
    const nextRole = managedRoleDrafts[user.id] ?? user.role
    const accessDraft = managedAccessDrafts[user.id] ?? {
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
      const data = await res.json().catch(() => null) as { error?: string; user?: ManagedUser } | null
      if (!res.ok || !data?.user) throw new Error(data?.error || 'Rolle konnte nicht gespeichert werden.')
      setManagedUsers(prev => prev.map(entry => entry.id === data.user!.id ? data.user! : entry))
      setManagedRoleDrafts(prev => ({ ...prev, [data.user!.id]: data.user!.role }))
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt ? data.user!.accessExpiresAt.slice(0, 10) : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ Zugang aktualisiert: ${data.user.email}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Zugang konnte nicht gespeichert werden.', 'error')
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
      const data = await res.json().catch(() => null) as {
        error?: string
        user?: ManagedUser
        entitlement?: ManagedUsersEntitlement
        temporaryPassword?: string | null
      } | null
      if (!res.ok || !data?.user) throw new Error(data?.error || 'Benutzer konnte nicht erstellt werden.')

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
      showToast(error instanceof Error ? error.message : 'Benutzer konnte nicht erstellt werden.', 'error')
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
      const data = await res.json().catch(() => null) as { error?: string; user?: ManagedUser } | null
      if (!res.ok || !data?.user) throw new Error(data?.error || 'Benutzer konnte nicht deaktiviert werden.')
      setManagedUsers(prev => prev.map(entry => entry.id === data.user!.id ? data.user! : entry))
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt ? data.user!.accessExpiresAt.slice(0, 10) : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ ${data.user.email} wurde deaktiviert`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen.', 'error')
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
      const data = await res.json().catch(() => null) as { error?: string; deletedUserId?: string } | null
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
      const data = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error || 'Einladung konnte nicht erneut gesendet werden.')
      showToast(`✅ Einladung erneut gesendet an ${user.email}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Einladung fehlgeschlagen.', 'error')
    } finally {
      setUserActionInProgress('')
    }
  }

  const applyRegistrationPreset = async (user: ManagedUser, preset: 'demo7' | 'demo14' | 'standard', customPilotIds?: PilotId[]) => {
    const expiresAt = preset === 'standard'
      ? null
      : new Date(Date.now() + (preset === 'demo7' ? 7 : 14) * 24 * 60 * 60 * 1000).toISOString()
    const defaultPilotIds: PilotId[] = preset === 'standard'
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
      const data = await res.json().catch(() => null) as { error?: string; user?: ManagedUser } | null
      if (!res.ok || !data?.user) throw new Error(data?.error || 'Freigabe konnte nicht gespeichert werden.')
      setManagedUsers(prev => prev.map(entry => entry.id === data.user!.id ? data.user! : entry))
      setManagedRoleDrafts(prev => ({ ...prev, [data.user!.id]: data.user!.role }))
      setManagedAccessDrafts(prev => ({
        ...prev,
        [data.user!.id]: {
          accessStatus: data.user!.accessStatus,
          accessMode: data.user!.accessMode,
          accessExpiresAt: data.user!.accessExpiresAt ? data.user!.accessExpiresAt.slice(0, 10) : '',
          allowedPilotIds: data.user!.allowedPilotIds,
        },
      }))
      showToast(`✅ ${data.user.email} wurde freigeschaltet`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Freigabe konnte nicht gespeichert werden.', 'error')
    } finally {
      setSavingManagedUserId('')
    }
  }

  const buildRegistrationMailHref = (user: ManagedUser, preset: 'demo7' | 'demo14' | 'standard' | 'pending') => {
    const subject = preset === 'pending'
      ? 'Ihre Registrierung bei Petersen KI'
      : 'Ihr Zugang bei Petersen KI wurde freigeschaltet'
    const label = preset === 'demo7'
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
    ].filter(Boolean).join('\n')
    return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const NavItem = ({ id, icon, label }: { id: SettingsSection; icon: string; label: string }) => (
    <button onClick={() => setSection(id)} data-active={section === id} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
      background: section === id ? 'rgba(22,132,255,.15)' : 'transparent',
      color: section === id ? '#6cb6ff' : '#aeb9c8',
      fontWeight: section === id ? 700 : 500, fontSize: 14,
      borderLeft: section === id ? '2px solid #1684ff' : '2px solid transparent',
      transition: 'background .15s', whiteSpace: 'nowrap',
    }}>
      <span>{icon}</span> {label}
    </button>
  )

  const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{desc}</div>}
      </div>
      <button onClick={onChange} style={{
        width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: checked ? 'linear-gradient(135deg, #1684ff, #005bea)' : 'rgba(255,255,255,.1)',
        transition: 'background .2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 22 : 2, width: 18, height: 18,
          borderRadius: '50%', background: 'white', transition: 'left .2s',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(22,132,255,.15)', border: '1px solid rgba(22,132,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>⚙️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Einstellungen</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Profil · Firmendaten · Briefpapier · Benachrichtigungen</p>
        </div>
      </div>

      {toast && (
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 16,
          background: toastType === 'success' ? 'rgba(37,211,102,.12)' : 'rgba(244,63,94,.12)',
          border: `1px solid ${toastType === 'success' ? 'rgba(37,211,102,.3)' : 'rgba(244,63,94,.3)'}`,
          color: toastType === 'success' ? '#4ddb7e' : '#fb7185', fontSize: 14, fontWeight: 600,
        }}>{toast}</div>
      )}

      <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="pk-card settings-nav" style={{ padding: '10px' }}>
          <NavItem id="profil" icon="👤" label="Profil" />
          <NavItem id="firma" icon="🏢" label="Firmendaten" />
          <NavItem id="billing" icon="💳" label="Buchung & Abonnement" />
          {isInhaberAccount && <NavItem id="kundensteuerung" icon="👑" label="Kundensteuerung" />}
          {isInhaberAccount && <NavItem id="registrierungen" icon="🆕" label="Offene Registrierungen" />}
          {isInhaberAccount && <NavItem id="kunden-eingerichtet" icon="✅" label="Kunden eingerichtet" />}
          {isInhaberAccount && <NavItem id="aktivitaetslog" icon="📋" label="Aktivitätslog" />}
          <NavItem id="benachrichtigungen" icon="🔔" label="Benachricht." />
          <NavItem id="rollen" icon="🔑" label="Rollen" />
          <NavItem id="import" icon="📥" label="Import" />
          <NavItem id="info" icon="ℹ️" label="Info" />
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '10px 0' }} />
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
            background: 'transparent', color: '#aeb9c8', fontSize: 14, fontWeight: 500,
            transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span>🚪</span> Abmelden
          </button>
        </div>

        <div>
          {section === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>👤 Benutzerprofil</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 999,
                    background: 'linear-gradient(135deg, #1684ff, #005bea)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 900, color: 'white',
                    boxShadow: '0 0 20px rgba(22,132,255,.3)',
                  }}>
                    {profil.name ? profil.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{profil.name || '–'}</div>
                    <div style={{ color: '#aeb9c8', fontSize: 13 }}>{profil.role}</div>
                    {isDemo && <span className="badge badge-orange" style={{ marginTop: 4 }}>● Demo-Modus</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Name *</label>
                    <input className="pk-input" value={profil.name} onChange={e => setProfil(p => ({ ...p, name: e.target.value }))} placeholder="Vollständiger Name" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>E-Mail</label>
                    <input className="pk-input" value={profil.email} disabled style={{ opacity: .5, cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Firma</label>
                    <input className="pk-input" value={profil.firma} onChange={e => setProfil(p => ({ ...p, firma: e.target.value }))} placeholder="Firmenname" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Rolle</label>
                    <input className="pk-input" value={profil.role} disabled style={{ opacity: .5, cursor: 'not-allowed' }} />
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <button className="pk-btn" onClick={handleProfilSave} style={{ fontWeight: 700 }}>Profil speichern</button>
                </div>
              </div>

              {!isDemo && (
                <div className="pk-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🔑 Passwort ändern</h3>
                  <div style={{ display: 'grid', gap: 14, maxWidth: 400 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Neues Passwort</label>
                      <input className="pk-input" type="password" placeholder="Min. 6 Zeichen" value={pwForm.neu} onChange={e => setPwForm(p => ({ ...p, neu: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Passwort bestätigen</label>
                      <input className="pk-input" type="password" placeholder="Passwort wiederholen" value={pwForm.bestaetigung} onChange={e => setPwForm(p => ({ ...p, bestaetigung: e.target.value }))} />
                    </div>
                    <button className="pk-btn" onClick={handlePwSave} style={{ fontWeight: 700, width: 'fit-content' }}>Passwort ändern</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'firma' && (
            <CompanySettingsSection isDemo={isDemo} currentRole={currentRole} showToast={showToast} />
          )}

          {section === 'billing' && (
            <>
              {paymentBanner && (
                <div style={{
                  marginBottom: 14, padding: '14px 18px', borderRadius: 14,
                  background: paymentBanner.type === 'success' ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)',
                  border: `1px solid ${paymentBanner.type === 'success' ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}`,
                  color: paymentBanner.type === 'success' ? '#86efac' : '#fbbf24',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      {paymentBanner.type === 'success' ? '✅ Zahlung erfolgreich eingegangen' : '⚠️ Checkout abgebrochen'}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, opacity: .85 }}>
                      {paymentBanner.type === 'success'
                        ? 'Ihre Stripe-Zahlung wurde registriert. Der Inhaber prüft und schaltet Sie schnellstmöglich frei.'
                        : 'Der Checkout-Vorgang wurde abgebrochen. Sie können die Zahlung unten jederzeit erneut starten.'}
                    </div>
                  </div>
                  <button onClick={() => setPaymentBanner(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 20, flexShrink: 0, lineHeight: 1 }}>✕</button>
                </div>
              )}
              <PricingSettingsPage isDemo={isDemo} showToast={showToast} />
            </>
          )}

          {section === 'kundensteuerung' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <OwnerAiControlPanel enabled={isInhaberAccount} showToast={showToast} />
              <OwnerCustomerControlPanel enabled={isInhaberAccount} showToast={showToast} />
            </div>
          )}

          {section === 'registrierungen' && (
            <div className="pk-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Offene Registrierungen</h3>
                  <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Neue Accounts bleiben gesperrt, bis Sie Demo oder Standard freischalten.</p>
                </div>
                <button className="pk-btn-ghost" onClick={() => void loadManagedUsers()} style={{ fontWeight: 700 }}>
                  Aktualisieren
                </button>
              </div>

              {loadingManagedUsers ? (
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Registrierungen werden geladen…</div>
              ) : managedUsers.filter(user => user.accessStatus === 'pending').length === 0 ? (
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine offenen Registrierungen vorhanden.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {managedUsers.filter(user => user.accessStatus === 'pending').map(user => {
                    const selectedPilots = pendingPilotSelections[user.id] ?? ['buero', 'lager', 'analyse']
                    return (
                    <div key={user.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,.03)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{user.fullName || 'Ohne Namen'}</div>
                          <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 3 }}>{user.email}</div>
                          <div style={{ color: '#7f8ea3', fontSize: 11, marginTop: 4 }}>
                            Registriert am {user.createdAt ? new Date(user.createdAt).toLocaleString('de-DE') : 'unbekannt'}
                          </div>
                        </div>
                        <span className="badge badge-orange">Freigabe ausstehend</span>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Pilot-Auswahl</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {MANAGED_PILOT_OPTIONS.map(pilotId => {
                            const active = selectedPilots.includes(pilotId)
                            return (
                              <button
                                key={pilotId}
                                type="button"
                                onClick={() => setPendingPilotSelections(prev => ({
                                  ...prev,
                                  [user.id]: active
                                    ? selectedPilots.filter(id => id !== pilotId)
                                    : [...selectedPilots, pilotId],
                                }))}
                                disabled={savingManagedUserId === user.id}
                                style={{
                                  borderRadius: 999,
                                  border: `1px solid ${active ? 'rgba(22,132,255,.38)' : 'rgba(255,255,255,.08)'}`,
                                  background: active ? 'rgba(22,132,255,.14)' : 'rgba(255,255,255,.03)',
                                  color: active ? '#93c5fd' : '#aeb9c8',
                                  padding: '5px 9px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                {PILOT_LABELS[pilotId]}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button className="pk-btn-ghost" disabled={savingManagedUserId === user.id} onClick={() => void applyRegistrationPreset(user, 'demo7', selectedPilots)} style={{ fontWeight: 800 }}>
                          Demo 7 Tage
                        </button>
                        <button className="pk-btn-ghost" disabled={savingManagedUserId === user.id} onClick={() => void applyRegistrationPreset(user, 'demo14', selectedPilots)} style={{ fontWeight: 800 }}>
                          Demo 14 Tage
                        </button>
                        <button className="pk-btn" disabled={savingManagedUserId === user.id} onClick={() => void applyRegistrationPreset(user, 'standard', selectedPilots)} style={{ fontWeight: 800 }}>
                          Standard freischalten
                        </button>
                        <a className="pk-btn-ghost" href={buildRegistrationMailHref(user, 'pending')} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontWeight: 800 }}>
                          Mailtext öffnen
                        </a>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'kunden-eingerichtet' && (() => {
            const activeUsers = managedUsers.filter(user => user.accessStatus === 'active' && !user.isOwnerAccount)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="pk-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Kunden eingerichtet</h3>
                      <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Alle aktiven Zugänge — Piloten, Testzeitraum und Kontakt verwalten.</p>
                    </div>
                    <button className="pk-btn-ghost" onClick={() => void loadManagedUsers()} style={{ fontWeight: 700 }}>
                      Aktualisieren
                    </button>
                  </div>

                  {loadingManagedUsers ? (
                    <div style={{ color: '#aeb9c8', fontSize: 13 }}>Zugänge werden geladen…</div>
                  ) : activeUsers.length === 0 ? (
                    <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine aktiven Zugänge vorhanden.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {activeUsers.map(user => {
                        const accessDraft = managedAccessDrafts[user.id] ?? {
                          accessStatus: user.accessStatus,
                          accessMode: user.accessMode,
                          accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '',
                          allowedPilotIds: user.allowedPilotIds,
                        }
                        const hasChanges =
                          accessDraft.accessMode !== user.accessMode
                          || accessDraft.accessExpiresAt !== (user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '')
                          || accessDraft.allowedPilotIds.join('|') !== user.allowedPilotIds.join('|')

                        const extendExpiry = (days: number) => {
                          const base = accessDraft.accessExpiresAt
                            ? new Date(accessDraft.accessExpiresAt)
                            : new Date()
                          base.setDate(base.getDate() + days)
                          setManagedAccessDrafts(prev => ({
                            ...prev,
                            [user.id]: { ...accessDraft, accessExpiresAt: base.toISOString().slice(0, 10) },
                          }))
                        }

                        const mailHref = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent('Ihr Zugang bei Petersen KI')}&body=${encodeURIComponent(`Guten Tag ${user.fullName || ''}`.trim() + `,\n\nhier eine kurze Information zu Ihrem Zugang bei Petersen KI.\n\nZugangsstatus: ${ACCESS_MODE_LABELS[accessDraft.accessMode]}${accessDraft.accessExpiresAt ? `\nGültig bis: ${new Date(accessDraft.accessExpiresAt).toLocaleDateString('de-DE')}` : ''}\nFreigeschaltete Piloten: ${accessDraft.allowedPilotIds.length > 0 ? accessDraft.allowedPilotIds.map(id => PILOT_LABELS[id]).join(', ') : 'Keine'}\n\nLogin: ${user.email}\nPortal: https://petersen-ki-pilot.de/login\n\nViele Grüße`)}`

                        return (
                          <div key={user.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,.03)' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 14 }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 15 }}>{user.fullName || 'Ohne Namen'}</div>
                                <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 3 }}>{user.email}</div>
                                <div style={{ color: '#7f8ea3', fontSize: 11, marginTop: 4 }}>
                                  Letzter Login: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString('de-DE') : 'Noch nie'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className="badge badge-green">aktiv</span>
                                <span className={`badge ${accessDraft.accessMode === 'demo' ? 'badge-orange' : 'badge-blue'}`}>
                                  {ACCESS_MODE_LABELS[accessDraft.accessMode]}
                                </span>
                                {accessDraft.accessExpiresAt && (
                                  <span className="badge badge-gray">
                                    bis {new Date(accessDraft.accessExpiresAt).toLocaleDateString('de-DE')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Pilot readonly overview */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Zugewiesene Piloten</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {user.allowedPilotIds.length > 0
                                  ? user.allowedPilotIds.map(pid => (
                                      <span key={pid} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(22,132,255,.12)', border: '1px solid rgba(22,132,255,.28)', color: '#93c5fd', fontWeight: 600 }}>
                                        {PILOT_LABELS[pid]}
                                      </span>
                                    ))
                                  : <span style={{ color: '#4a5568', fontSize: 12 }}>Keine Piloten zugewiesen</span>
                                }
                              </div>
                            </div>

                            {/* Pilot edit toggles */}
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Piloten bearbeiten</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {MANAGED_PILOT_OPTIONS.map(pilotId => {
                                  const active = accessDraft.allowedPilotIds.includes(pilotId)
                                  return (
                                    <button
                                      key={pilotId}
                                      type="button"
                                      onClick={() => setManagedAccessDrafts(prev => ({
                                        ...prev,
                                        [user.id]: {
                                          ...accessDraft,
                                          allowedPilotIds: active
                                            ? accessDraft.allowedPilotIds.filter(id => id !== pilotId)
                                            : [...accessDraft.allowedPilotIds, pilotId],
                                        },
                                      }))}
                                      disabled={savingManagedUserId === user.id}
                                      style={{
                                        borderRadius: 999,
                                        border: `1px solid ${active ? 'rgba(22,132,255,.38)' : 'rgba(255,255,255,.08)'}`,
                                        background: active ? 'rgba(22,132,255,.14)' : 'rgba(255,255,255,.03)',
                                        color: active ? '#93c5fd' : '#aeb9c8',
                                        padding: '5px 9px',
                                        fontSize: 11,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {PILOT_LABELS[pilotId]}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Rechnungsübersicht */}
                            {expandedCustomerInvoices === user.id ? (
                              <CustomerInvoicePreview userId={user.id} userEmail={user.email} onClose={() => setExpandedCustomerInvoices(null)} />
                            ) : (
                              <button
                                className="pk-btn-ghost"
                                style={{ fontSize: 12, marginTop: 8 }}
                                onClick={() => setExpandedCustomerInvoices(user.id)}
                              >
                                📄 Rechnungen anzeigen
                              </button>
                            )}

                            {/* Testzeitraum verlängern */}
                            <div style={{ marginBottom: 14, marginTop: 12 }}>
                              <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>Testzeitraum / Ablaufdatum</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="pk-btn-ghost"
                                  onClick={() => extendExpiry(7)}
                                  disabled={savingManagedUserId === user.id}
                                  style={{ fontSize: 12, padding: '6px 12px' }}
                                >
                                  +7 Tage
                                </button>
                                <button
                                  type="button"
                                  className="pk-btn-ghost"
                                  onClick={() => extendExpiry(14)}
                                  disabled={savingManagedUserId === user.id}
                                  style={{ fontSize: 12, padding: '6px 12px' }}
                                >
                                  +14 Tage
                                </button>
                                <button
                                  type="button"
                                  className="pk-btn-ghost"
                                  onClick={() => extendExpiry(30)}
                                  disabled={savingManagedUserId === user.id}
                                  style={{ fontSize: 12, padding: '6px 12px' }}
                                >
                                  +30 Tage
                                </button>
                                <input
                                  className="pk-input"
                                  type="date"
                                  value={accessDraft.accessExpiresAt}
                                  onChange={e => setManagedAccessDrafts(prev => ({
                                    ...prev,
                                    [user.id]: { ...accessDraft, accessExpiresAt: e.target.value },
                                  }))}
                                  disabled={savingManagedUserId === user.id}
                                  style={{ width: 160, fontSize: 13 }}
                                />
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <button
                                className="pk-btn"
                                onClick={() => void handleManagedUserSave(user)}
                                disabled={!hasChanges || savingManagedUserId === user.id}
                                style={{ fontWeight: 700, opacity: !hasChanges || savingManagedUserId === user.id ? .55 : 1 }}
                              >
                                {savingManagedUserId === user.id ? 'Speichert…' : 'Änderungen speichern'}
                              </button>
                              <a
                                href={mailHref}
                                className="pk-btn-ghost"
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 13 }}
                              >
                                ✉️ Kontakt
                              </a>
                            </div>
                            {deleteConfirmId === user.id ? (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontSize: 12, color: '#fb7185' }}>Wirklich sperren?</span>
                                <button
                                  className="pk-btn-ghost"
                                  style={{ fontSize: 12, color: '#fb7185', borderColor: 'rgba(244,63,94,.3)' }}
                                  onClick={async () => {
                                    setDeleteConfirmId('')
                                    setSavingManagedUserId(user.id)
                                    try {
                                      const res = await fetch('/api/admin/users', {
                                        method: 'PATCH',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify({ userId: user.id, role: user.role, accessStatus: 'suspended', accessMode: user.accessMode, accessExpiresAt: null, allowedPilotIds: [] }),
                                      })
                                      const data = await res.json().catch(() => null) as { error?: string; user?: ManagedUser } | null
                                      if (!res.ok) throw new Error(data?.error || 'Fehler')
                                      setManagedUsers(prev => prev.map(u => u.id === user.id ? { ...u, accessStatus: 'suspended', allowedPilotIds: [] } : u))
                                      showToast(`🚫 ${user.email} wurde gesperrt`)
                                    } catch (e) {
                                      showToast(e instanceof Error ? e.message : 'Fehler', 'error')
                                    } finally {
                                      setSavingManagedUserId('')
                                    }
                                  }}
                                >
                                  Ja, sperren
                                </button>
                                <button className="pk-btn-ghost" style={{ fontSize: 12 }} onClick={() => setDeleteConfirmId('')}>Abbrechen</button>
                              </div>
                            ) : (
                              <button
                                className="pk-btn-ghost"
                                style={{ fontSize: 12, color: '#fb7185', borderColor: 'rgba(244,63,94,.3)', marginTop: 8 }}
                                onClick={() => setDeleteConfirmId(user.id)}
                              >
                                🚫 Kunden sperren
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {section === 'aktivitaetslog' && (
            <div className="pk-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>📋 Aktivitätslog</h3>
                  <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Letzte Systemereignisse und Buchungsaktivitäten.</p>
                </div>
                <button className="pk-btn-ghost" onClick={() => void loadManagedUsers()} style={{ fontWeight: 700 }}>Aktualisieren</button>
              </div>
              <AuditLogSection isInhaber={isInhaberAccount} showToast={showToast} />
            </div>
          )}

          {section === 'benachrichtigungen' && (
            <div className="pk-card">
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🔔 Benachrichtigungen</h3>
              <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14 }}>Legen Sie fest, welche System-Meldungen Sie erhalten möchten.</p>
              <Toggle checked={notif.wareneingaenge} onChange={() => setNotif(p => ({ ...p, wareneingaenge: !p.wareneingaenge }))} label="Wareneingänge" desc="Benachrichtigung bei neuen Wareneingängen im LagerPilot" />
              <Toggle checked={notif.niedrigerBestand} onChange={() => setNotif(p => ({ ...p, niedrigerBestand: !p.niedrigerBestand }))} label="Niedriger Bestand" desc="Alarm wenn Artikel unter den Mindestbestand fallen" />
              <Toggle checked={notif.auftraege} onChange={() => setNotif(p => ({ ...p, auftraege: !p.auftraege }))} label="Auftrags-Updates" desc="Statusänderungen bei Werkstatt-Aufträgen und Arbeitskarten" />
              <Toggle checked={notif.rechnungen} onChange={() => setNotif(p => ({ ...p, rechnungen: !p.rechnungen }))} label="Überfällige Rechnungen" desc="Erinnerung bei Zahlungsverzug im BüroPilot" />
              <Toggle checked={notif.cloudSync} onChange={() => setNotif(p => ({ ...p, cloudSync: !p.cloudSync }))} label="Cloud-Sync Status" desc="Meldungen zu Backup und Synchronisierungsstatus" />
              <Toggle checked={notif.kiErkennungen} onChange={() => setNotif(p => ({ ...p, kiErkennungen: !p.kiErkennungen }))} label="KI-Assistenten-Auswertungen" desc="Benachrichtigungen nach automatischer Dokumentenanalyse" />
              <div style={{ marginTop: 20 }}>
                <button className="pk-btn" onClick={handleNotifSave} style={{ fontWeight: 700 }}>Einstellungen speichern</button>
              </div>
            </div>
          )}

          {section === 'rollen' && (() => {
            const roleDescriptions: Record<AppRole, string> = {
              Inhaber: 'Versteckte Betreiberrolle fuer zentrale Kundensteuerung, Billing und Freischaltung',
              Admin: 'Vollzugriff auf alle Funktionen und Einstellungen',
              Mitarbeiter: 'Zugriff auf Kernfunktionen, kein Löschen',
              Büro: 'Büro, Analyse, Archiv und Einstellungen',
              Werkstatt: 'Werkstatt, Lager, Planung und KI-Assistent',
              Lager: 'Nur Lagerverwaltung und KI-Assistent',
            }
            const allRoles = isInhaberAccount ? APP_ROLES : APP_ROLES.filter(role => role !== 'Inhaber')
            const managedRoleOptions = currentRole === 'Inhaber'
              ? APP_ROLES
              : APP_ROLES.filter(role => role !== 'Inhaber')
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Aktuelle Rolle */}
                <div className="pk-card">
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🔑 Rollen & Rechte</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      padding: '10px 22px', borderRadius: 999, fontSize: 18, fontWeight: 900,
                      background: 'rgba(22,132,255,.18)', border: '2px solid rgba(22,132,255,.4)',
                      color: '#6cb6ff', letterSpacing: '-.02em',
                    }}>
                      {ROLE_LABELS[currentRole]}
                    </div>
                    <div style={{ fontSize: 13, color: '#aeb9c8' }}>Ihre aktuelle Rolle im System</div>
                  </div>

                  {/* Rollen-Tabelle */}
                  <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                    <table className="pk-table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Rolle</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Beschreibung</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px' }}>Piloten</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Löschen</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Bearbeiten</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Export</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRoles.map(r => (
                          <tr key={r} style={{ background: r === currentRole ? 'rgba(22,132,255,.06)' : undefined }}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {ROLE_LABELS[r]}
                              {r === currentRole && (
                                <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(22,132,255,.25)', color: '#6cb6ff', fontWeight: 700 }}>Aktiv</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#aeb9c8' }}>{roleDescriptions[r]}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {ROLE_PILOTS[r].slice(0, 4).map(p => (
                                  <span key={p} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.07)', color: '#aeb9c8', fontWeight: 600 }}>{p}</span>
                                ))}
                                {ROLE_PILOTS[r].length > 4 && (
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.07)', color: '#aeb9c8', fontWeight: 600 }}>+{ROLE_PILOTS[r].length - 4}</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canDelete(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canEdit(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {PERMISSIONS.canExport(r) ? <span style={{ color: '#4ddb7e', fontWeight: 700 }}>✓</span> : <span style={{ color: '#4a5568' }}>–</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rolle wechseln */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{isDemo ? 'Rolle wechseln (Demo)' : 'Rollenvergabe im Produktivbetrieb'}</div>
                    {isDemo ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <select
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value as AppRole)}
                            className="pk-input"
                            style={{ width: 'auto', minWidth: 180 }}
                          >
                            {allRoles.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <button
                            className="pk-btn"
                            style={{ fontWeight: 700 }}
                            onClick={async () => {
                              try {
                                const nextRole = await applyRole(selectedRole)
                                setProfil(prev => ({ ...prev, role: 'Demo Admin' }))
                                showToast(`✅ Rolle gesetzt: ${ROLE_LABELS[nextRole]}`)
                              } catch (error) {
                                showToast(error instanceof Error ? error.message : 'Rolle konnte nicht gespeichert werden.', 'error')
                              }
                            }}
                          >
                            Speichern
                          </button>
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#4a5568', lineHeight: 1.6 }}>
                          Im Produktivbetrieb werden Rollen serverseitig an den Benutzer gebunden.
                        </p>
                      </>
                    ) : (
                      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,179,71,.08)', border: '1px solid rgba(255,179,71,.18)', color: '#ffd7a1', fontSize: 13, lineHeight: 1.6 }}>
                        Rollen koennen live nicht mehr vom Benutzer selbst geaendert werden. Vergabe und Aenderungen muessen zentral ueber Inhaber/Admin erfolgen.
                      </div>
                    )}
                  </div>
                </div>

                {canManageLiveUsers && (
                  <div className="pk-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>👥 Live-Benutzerverwaltung</h3>
                        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Rollen werden serverseitig per Supabase Admin API am Benutzerkonto gespeichert.</div>
                      </div>
                      <button className="pk-btn-ghost" onClick={() => void loadManagedUsers()} style={{ fontWeight: 700 }}>
                        Aktualisieren
                      </button>
                    </div>

                    {managedUsersEntitlement && (
                      <div style={{
                        marginBottom: 16,
                        padding: '14px 16px',
                        borderRadius: 14,
                        background: managedUsersEntitlement.canCreateUsers ? 'rgba(22,132,255,.08)' : 'rgba(255,179,71,.08)',
                        border: managedUsersEntitlement.canCreateUsers ? '1px solid rgba(22,132,255,.22)' : '1px solid rgba(255,179,71,.18)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14 }}>
                              Seat-Limit: {managedUsersEntitlement.usedSeats} / {managedUsersEntitlement.maxSeats || 0} belegt
                            </div>
                            <div style={{ color: '#aeb9c8', fontSize: 12, marginTop: 4 }}>
                              {managedUsersEntitlement.employeeTier ? `Abo ${managedUsersEntitlement.employeeTier}` : 'Kein zugeordnetes Abo'} · {managedUsersEntitlement.reason}
                            </div>
                          </div>
                          <span className={managedUsersEntitlement.canCreateUsers ? 'badge badge-green' : 'badge badge-orange'}>
                            {managedUsersEntitlement.remainingSeats} freie Plaetze
                          </span>
                        </div>
                      </div>
                    )}

                    {newlyCreatedSecret && (
                      <div style={{
                        marginBottom: 16, padding: '14px 16px', borderRadius: 12,
                        background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.22)',
                      }}>
                        <div style={{ fontWeight: 800, color: '#4ddb7e', marginBottom: 8 }}>Temporäres Passwort nur jetzt sichtbar</div>
                        <div style={{ fontSize: 13, color: '#dbe4ef', marginBottom: 6 }}>{newlyCreatedSecret.email}</div>
                        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14, fontWeight: 700 }}>{newlyCreatedSecret.password}</div>
                      </div>
                    )}

                    {managedUsersError && (
                      <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.28)', color: '#fb7185', fontSize: 13 }}>
                        {managedUsersError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 18 }}>
                      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>📨 Benutzer einladen</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          <input
                            className="pk-input"
                            placeholder="E-Mail"
                            value={inviteForm.email}
                            onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          />
                          <input
                            className="pk-input"
                            placeholder="Name (optional)"
                            value={inviteForm.fullName}
                            onChange={e => setInviteForm(prev => ({ ...prev, fullName: e.target.value }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          />
                          <select
                            className="pk-input"
                            value={inviteForm.role}
                            onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value as AppRole }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          >
                            {managedRoleOptions.map(role => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                          <button
                            className="pk-btn"
                            onClick={() => void handleManagedUserCreate('invite')}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                            style={{ fontWeight: 700, opacity: !managedUsersEntitlement?.canCreateUsers || creatingMode !== '' ? .6 : 1 }}
                          >
                            {creatingMode === 'invite' ? 'Einladung wird gesendet…' : 'Einladung senden'}
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>👤 Benutzer direkt anlegen</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          <input
                            className="pk-input"
                            placeholder="E-Mail"
                            value={createForm.email}
                            onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          />
                          <input
                            className="pk-input"
                            placeholder="Name (optional)"
                            value={createForm.fullName}
                            onChange={e => setCreateForm(prev => ({ ...prev, fullName: e.target.value }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          />
                          <select
                            className="pk-input"
                            value={createForm.role}
                            onChange={e => setCreateForm(prev => ({ ...prev, role: e.target.value as AppRole }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          >
                            {managedRoleOptions.map(role => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                          <input
                            className="pk-input"
                            placeholder="Temporäres Passwort (leer = automatisch)"
                            value={createForm.password}
                            onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                          />
                          <button
                            className="pk-btn"
                            onClick={() => void handleManagedUserCreate('create')}
                            disabled={!managedUsersEntitlement?.canCreateUsers || creatingMode !== ''}
                            style={{ fontWeight: 700, opacity: !managedUsersEntitlement?.canCreateUsers || creatingMode !== '' ? .6 : 1 }}
                          >
                            {creatingMode === 'create' ? 'Benutzer wird angelegt…' : 'Benutzer anlegen'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {loadingManagedUsers ? (
                      <div style={{ color: '#aeb9c8', fontSize: 14 }}>Benutzer werden geladen…</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className="badge badge-blue">
                            {managedUsers.filter(user => user.accessStatus === 'pending').length} Registrierungen offen
                          </span>
                          <span className="badge badge-green">
                            {managedUsers.filter(user => user.accessStatus === 'active').length} Zugänge aktiv
                          </span>
                          <span className="badge badge-gray">
                            {managedUsers.filter(user => user.accessMode === 'demo').length} Demo-Zugänge
                          </span>
                          <input
                            className="pk-input"
                            placeholder="Suche nach Name oder E-Mail…"
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            style={{ marginLeft: 'auto', minWidth: 220, maxWidth: 320 }}
                          />
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                        <table className="pk-table" style={{ width: '100%', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Benutzer</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Aktuelle Rolle</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Neue Rolle</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Freigabe</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Piloten</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Letzter Login</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Aktion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {managedUsers.filter(user => {
                              if (!userSearchQuery.trim()) return true
                              const q = userSearchQuery.toLowerCase()
                              return user.email.toLowerCase().includes(q) || (user.fullName || '').toLowerCase().includes(q)
                            }).map(user => {
                              const isSelf = user.email.toLowerCase() === profil.email.toLowerCase()
                              const targetIsInhaber = user.role === 'Inhaber' || user.isOwnerAccount
                              const mayEdit = !isSelf && (currentRole === 'Inhaber' || !targetIsInhaber)
                              const hasChanges = (managedRoleDrafts[user.id] ?? user.role) !== user.role
                              const accessDraft = managedAccessDrafts[user.id] ?? {
                                accessStatus: user.accessStatus,
                                accessMode: user.accessMode,
                                accessExpiresAt: user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '',
                                allowedPilotIds: user.allowedPilotIds,
                              }
                              const hasAccessChanges =
                                accessDraft.accessStatus !== user.accessStatus
                                || accessDraft.accessMode !== user.accessMode
                                || accessDraft.accessExpiresAt !== (user.accessExpiresAt ? user.accessExpiresAt.slice(0, 10) : '')
                                || accessDraft.allowedPilotIds.join('|') !== user.allowedPilotIds.join('|')
                              return (
                                <tr key={user.id}>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 700 }}>{user.fullName || 'Ohne Namen'}</div>
                                    <div style={{ color: '#aeb9c8', fontSize: 12 }}>{user.email}</div>
                                    {user.isOwnerAccount && (
                                      <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,179,71,.16)', color: '#ffd7a1', fontWeight: 700 }}>Owner-Konto</span>
                                    )}
                                    {!user.isOwnerAccount && user.email && (
                                      <a
                                        href={`mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent('Freischaltung Ihres Zugangs bei Petersen KI')}&body=${encodeURIComponent(`Guten Tag,\n\nihr Zugang bei Petersen KI wurde bearbeitet.\n\nStatus: ${ACCESS_STATUS_LABELS[accessDraft.accessStatus]}\nZugangsart: ${ACCESS_MODE_LABELS[accessDraft.accessMode]}\nPiloten: ${accessDraft.allowedPilotIds.length > 0 ? accessDraft.allowedPilotIds.map(id => PILOT_LABELS[id]).join(', ') : 'Noch keine'}${accessDraft.accessExpiresAt ? `\nGueltig bis: ${accessDraft.accessExpiresAt}` : ''}\n\nViele Gruesse`)}`}
                                        style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#6cb6ff', textDecoration: 'none' }}
                                      >
                                        Mail vorbereiten
                                      </a>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ROLE_LABELS[user.role]}</td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <select
                                      value={managedRoleDrafts[user.id] ?? user.role}
                                      onChange={e => setManagedRoleDrafts(prev => ({ ...prev, [user.id]: e.target.value as AppRole }))}
                                      className="pk-input"
                                      disabled={!mayEdit || savingManagedUserId === user.id}
                                      style={{ minWidth: 170, opacity: mayEdit ? 1 : .6 }}
                                    >
                                      {managedRoleOptions.map(role => (
                                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: '10px 12px', minWidth: 220 }}>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                      <select
                                        value={accessDraft.accessStatus}
                                        onChange={e => setManagedAccessDrafts(prev => ({ ...prev, [user.id]: { ...accessDraft, accessStatus: e.target.value as AccessStatus } }))}
                                        className="pk-input"
                                        disabled={!mayEdit || savingManagedUserId === user.id}
                                        style={{ opacity: mayEdit ? 1 : .6 }}
                                      >
                                        {ACCESS_STATUS_OPTIONS.map(status => (
                                          <option key={status} value={status}>{ACCESS_STATUS_LABELS[status]}</option>
                                        ))}
                                      </select>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                                        <select
                                          value={accessDraft.accessMode}
                                          onChange={e => setManagedAccessDrafts(prev => ({ ...prev, [user.id]: { ...accessDraft, accessMode: e.target.value as AccessMode } }))}
                                          className="pk-input"
                                          disabled={!mayEdit || savingManagedUserId === user.id}
                                          style={{ opacity: mayEdit ? 1 : .6 }}
                                        >
                                          {ACCESS_MODE_OPTIONS.map(mode => (
                                            <option key={mode} value={mode}>{ACCESS_MODE_LABELS[mode]}</option>
                                          ))}
                                        </select>
                                        <input
                                          className="pk-input"
                                          type="date"
                                          value={accessDraft.accessExpiresAt}
                                          onChange={e => setManagedAccessDrafts(prev => ({ ...prev, [user.id]: { ...accessDraft, accessExpiresAt: e.target.value } }))}
                                          disabled={!mayEdit || savingManagedUserId === user.id}
                                          style={{ opacity: mayEdit ? 1 : .6 }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 12px', minWidth: 260 }}>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {MANAGED_PILOT_OPTIONS.map(pilotId => {
                                          const active = accessDraft.allowedPilotIds.includes(pilotId)
                                          return (
                                            <button
                                              key={pilotId}
                                              type="button"
                                              onClick={() => setManagedAccessDrafts(prev => ({
                                                ...prev,
                                                [user.id]: {
                                                  ...accessDraft,
                                                  allowedPilotIds: active
                                                    ? accessDraft.allowedPilotIds.filter(id => id !== pilotId)
                                                    : [...accessDraft.allowedPilotIds, pilotId],
                                                },
                                              }))}
                                              disabled={!mayEdit || savingManagedUserId === user.id}
                                              style={{
                                                borderRadius: 999,
                                                border: `1px solid ${active ? 'rgba(22,132,255,.38)' : 'rgba(255,255,255,.08)'}`,
                                                background: active ? 'rgba(22,132,255,.14)' : 'rgba(255,255,255,.03)',
                                                color: active ? '#93c5fd' : '#aeb9c8',
                                                padding: '5px 9px',
                                                fontSize: 11,
                                                cursor: mayEdit ? 'pointer' : 'default',
                                                opacity: mayEdit ? 1 : .6,
                                              }}
                                            >
                                              {PILOT_LABELS[pilotId]}
                                            </button>
                                          )
                                        })}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#8ba0b8' }}>
                                        {accessDraft.allowedPilotIds.length > 0
                                          ? `${accessDraft.allowedPilotIds.length} Pilot(en) zugewiesen`
                                          : 'Noch keine Piloten zugewiesen'}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 12px', color: '#aeb9c8' }}>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString('de-DE') : 'Noch nie'}</td>
                                  <td style={{ padding: '10px 12px', minWidth: 200 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <button
                                        className="pk-btn"
                                        onClick={() => void handleManagedUserSave(user)}
                                        disabled={!mayEdit || (!hasChanges && !hasAccessChanges) || savingManagedUserId === user.id || userActionInProgress === user.id}
                                        style={{ fontWeight: 700, opacity: !mayEdit || (!hasChanges && !hasAccessChanges) || savingManagedUserId === user.id || userActionInProgress === user.id ? .55 : 1 }}
                                      >
                                        {savingManagedUserId === user.id ? 'Speichert…' : 'Zugang speichern'}
                                      </button>
                                      {mayEdit && !isSelf && (
                                        <>
                                          <button
                                            className="pk-btn-ghost"
                                            onClick={() => void handleResendInvite(user)}
                                            disabled={userActionInProgress === user.id || savingManagedUserId === user.id}
                                            style={{ fontWeight: 600, fontSize: 12, opacity: userActionInProgress === user.id ? .6 : 1 }}
                                          >
                                            {userActionInProgress === user.id ? '⏳ Läuft…' : '📨 Einladung erneut senden'}
                                          </button>
                                          {disableConfirmId === user.id ? (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                              <button
                                                onClick={() => void handleDisableUser(user)}
                                                disabled={userActionInProgress === user.id}
                                                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,179,71,.4)', background: 'rgba(255,179,71,.12)', color: '#ffd7a1', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                              >
                                                Ja, sperren
                                              </button>
                                              <button
                                                onClick={() => setDisableConfirmId('')}
                                                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#aeb9c8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                                              >
                                                Abbrechen
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              className="pk-btn-ghost"
                                              onClick={() => setDisableConfirmId(user.id)}
                                              disabled={user.accessStatus === 'suspended' || userActionInProgress === user.id}
                                              style={{ fontWeight: 600, fontSize: 12, opacity: user.accessStatus === 'suspended' || userActionInProgress === user.id ? .5 : 1 }}
                                            >
                                              🚫 Deaktivieren
                                            </button>
                                          )}
                                          {deleteConfirmId === user.id ? (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                              <button
                                                onClick={() => void handleDeleteUser(user)}
                                                disabled={userActionInProgress === user.id}
                                                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(244,63,94,.4)', background: 'rgba(244,63,94,.12)', color: '#fb7185', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                              >
                                                Ja, loeschen
                                              </button>
                                              <button
                                                onClick={() => setDeleteConfirmId('')}
                                                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#aeb9c8', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                                              >
                                                Abbrechen
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              className="pk-btn-ghost"
                                              onClick={() => setDeleteConfirmId(user.id)}
                                              disabled={userActionInProgress === user.id}
                                              style={{ fontWeight: 600, fontSize: 12, color: '#fb7185', borderColor: 'rgba(244,63,94,.28)', opacity: userActionInProgress === user.id ? .5 : 1 }}
                                            >
                                              🗑️ Loeschen
                                            </button>
                                          )}
                                        </>
                                      )}
                                      {!mayEdit && (
                                        <div style={{ color: '#aeb9c8', fontSize: 11 }}>
                                          {isSelf ? 'Eigene Rolle hier gesperrt' : 'Nur Inhaber darf diesen Benutzer aendern'}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                            {managedUsers.filter(u => {
                              if (!userSearchQuery.trim()) return true
                              const q = userSearchQuery.toLowerCase()
                              return u.email.toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q)
                            }).length === 0 && (
                              <tr>
                                <td colSpan={7} style={{ padding: '14px 12px', color: '#aeb9c8' }}>Keine Benutzer gefunden.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {section === 'import' && (
            <ImportWizard isDemo={isDemo} showToast={showToast} />
          )}

          {section === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="pk-card">
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>ℹ️ App-Informationen</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { label: 'Anwendung', value: 'Petersen KI Betriebssteuerung' },
                    { label: 'Version', value: 'v1.0.0' },
                    { label: 'Stack', value: 'Next.js 14 · TypeScript · Tailwind CSS' },
                    { label: 'KI-Modell', value: 'Anthropic Claude (Sonnet)' },
                    { label: 'Auth', value: 'Supabase Authentication' },
                    { label: 'Modus', value: isDemo ? 'Demo – Beispieldaten' : 'Produktiv' },
                    { label: 'Copyright', value: '© 2025 Petersen KI' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <span style={{ width: 180, fontSize: 13, color: '#aeb9c8', fontWeight: 600 }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isDemo && (
                <div style={{
                  padding: '18px 20px', borderRadius: 16,
                  background: 'rgba(255,165,0,.08)', border: '1px solid rgba(255,165,0,.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Demo-Modus aktiv</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
                        Sie sind mit dem Demo-Zugang eingeloggt. Alle Daten sind Beispieldaten.
                        Für den produktiven Einsatz besuchen Sie{' '}
                        <a href="https://petersen-ki-pilot.de" target="_blank" rel="noopener noreferrer" style={{ color: '#6cb6ff', textDecoration: 'underline' }}>
                          petersen-ki-pilot.de
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AuditLogSection({ isInhaber, showToast }: { isInhaber: boolean; showToast: (msg: string, type?: 'error') => void }) {
  const [logs, setLogs] = useState<{ id: string; action: string; actor_email?: string; target_email?: string; created_at: string; details?: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isInhaber) return
    const supabase = createSupabaseClient()
    supabase
      .from('audit_logs')
      .select('id, action, actor_email, target_email, created_at, details')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setLogs(data)
        setLoading(false)
      })
  }, [isInhaber])

  if (loading) return <div style={{ color: '#aeb9c8', fontSize: 13 }}>Wird geladen…</div>
  if (logs.length === 0) return <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Einträge vorhanden.</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="pk-table" style={{ width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Zeitpunkt</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Aktion</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Durchgeführt von</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Betrifft</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#aeb9c8' }}>
                {new Date(log.created_at).toLocaleString('de-DE')}
              </td>
              <td style={{ padding: '10px 12px', fontWeight: 700 }}>{log.action}</td>
              <td style={{ padding: '10px 12px', color: '#aeb9c8' }}>{log.actor_email || '–'}</td>
              <td style={{ padding: '10px 12px', color: '#aeb9c8' }}>{log.target_email || '–'}</td>
              <td style={{ padding: '10px 12px', color: '#aeb9c8', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CustomerInvoicePreview({ userId, userEmail, onClose }: { userId: string; userEmail: string; onClose: () => void }) {
  const [rechnungen, setRechnungen] = useState<{ id: string; nummer?: string; betrag: string; status: string; faellig: string; erstellt: string; kunde: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase
      .from('buero_rechnungen')
      .select('id, nummer, betrag, status, faellig, erstellt, kunde')
      .eq('user_id', userId)
      .order('erstellt', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setRechnungen(data)
        setLoading(false)
      })
  }, [userId])

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>📄 Rechnungen – {userEmail}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aeb9c8', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>
      {loading ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Wird geladen…</div>
      ) : rechnungen.length === 0 ? (
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine Rechnungen vorhanden.</div>
      ) : (
        <table className="pk-table" style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Nummer</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Betrag</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Fällig</th>
            </tr>
          </thead>
          <tbody>
            {rechnungen.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '8px 10px' }}>{r.nummer || r.id}</td>
                <td style={{ padding: '8px 10px' }}>{r.betrag}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span className={`badge badge-${r.status === 'Bezahlt' ? 'green' : r.status === 'Überfällig' || r.status === 'Mahnung' ? 'orange' : 'blue'}`}>{r.status}</span>
                </td>
                <td style={{ padding: '8px 10px', color: '#aeb9c8' }}>{r.faellig}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const emptyFirma: FirmaEinstellungen = {
  firmenname: '',
  land: 'Deutschland',
  zahlungsziel_tage: 14,
  standard_mwst: 19,
  standard_waehrung: 'EUR',
  dokument_footer: 'Vielen Dank für Ihr Vertrauen.',
  briefpapier_layout: {
    template: 'modern-dark',
    logoPosition: 'links',
    akzentfarbe: '#20c8ff',
    showBankdaten: true,
    showSteuernummer: true,
    showUstId: true,
    showGeschaeftsfuehrer: true,
    showWebsite: true,
    useForAngebote: true,
    useForAuftragsbestaetigungen: true,
    useForRechnungen: true,
  },
  onboarding_completed: false,
}

function CompanySettingsSection({ isDemo, currentRole, showToast }: {
  isDemo: boolean
  currentRole: AppRole
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const canEdit = currentRole === 'Admin' || currentRole === 'Inhaber'
  const [firma, setFirma] = useState<FirmaEinstellungen>(isDemo ? {
    ...emptyFirma,
    firmenname: 'Petersen Musterbetrieb GmbH',
    slogan: 'Betriebssteuerung mit KI',
    adresse: 'Musterstraße 12',
    plz: '20095',
    ort: 'Hamburg',
    email: 'info@petersen-ki-pilot.de',
    telefon: '+49 40 123456',
    website: 'petersen-ki-pilot.de',
    ust_id: 'DE123456789',
    bankname: 'Musterbank',
    iban: 'DE02120300000000202051',
    bic: 'MUSTDEHHXXX',
    onboarding_completed: true,
  } : emptyFirma)
  const [loading, setLoading] = useState(!isDemo)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [briefpapierUploading, setBriefpapierUploading] = useState(false)
  const [briefpapierDeleting, setBriefpapierDeleting] = useState(false)

  useEffect(() => {
    if (isDemo) {
      localStorage.setItem('pk_firma_einstellungen', JSON.stringify(firma))
      return
    }
    getFirmaEinstellungen()
      .then(data => {
        if (data) {
          setFirma({ ...emptyFirma, ...data, briefpapier_layout: { ...emptyFirma.briefpapier_layout, ...(data.briefpapier_layout ?? {}) } })
          localStorage.setItem('pk_firma_einstellungen', JSON.stringify(data))
        }
      })
      .catch(() => showToast('Firmendaten konnten nicht geladen werden', 'error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const setField = <K extends keyof FirmaEinstellungen>(key: K, value: FirmaEinstellungen[K]) =>
    setFirma(prev => ({ ...prev, [key]: value }))
  const setLayout = (key: string, value: unknown) =>
    setFirma(prev => ({ ...prev, briefpapier_layout: { ...(prev.briefpapier_layout ?? {}), [key]: value } }))
  const layout = (firma.briefpapier_layout ?? {}) as Record<string, unknown>
  const selectedTemplate = String(layout.template ?? 'modern-dark')
  const petersenBrandLocked = selectedTemplate === 'petersen-brand' && currentRole !== 'Inhaber'

  const save = async (complete = true) => {
    if (!canEdit) { showToast('Nur Admins und Inhaber dürfen Firmendaten bearbeiten', 'error'); return }
    if (!firma.firmenname.trim()) { showToast('Firmenname ist Pflicht', 'error'); return }
    if (petersenBrandLocked) { showToast('Petersen Brand ist nur für den Inhaber-Account freigegeben', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...firma,
        briefpapier_layout: {
          ...(firma.briefpapier_layout ?? {}),
          useForAngebote: layout.useForAngebote !== false,
          useForAuftragsbestaetigungen: layout.useForAuftragsbestaetigungen !== false,
          useForRechnungen: layout.useForRechnungen !== false,
        },
        onboarding_completed: complete ? true : firma.onboarding_completed,
      }
      if (isDemo) {
        setFirma(payload)
        localStorage.setItem('pk_firma_einstellungen', JSON.stringify(payload))
      } else {
        const saved = await upsertFirmaEinstellungen(payload)
        setFirma({ ...emptyFirma, ...saved, briefpapier_layout: { ...emptyFirma.briefpapier_layout, ...(saved.briefpapier_layout ?? {}) } })
        localStorage.setItem('pk_firma_einstellungen', JSON.stringify(saved))
      }
      showToast('✅ Firmendaten gespeichert')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleLogo = async (file: File | null) => {
    if (!file || !canEdit) return
    setLogoUploading(true)
    try {
      if (isDemo) {
        const url = URL.createObjectURL(file)
        setField('logo_url', url)
      } else {
        const uploaded = await uploadFirmenLogo(file)
        setField('logo_url', uploaded.url)
      }
      showToast('✅ Logo hochgeladen')
    } catch {
      showToast('Logo konnte nicht hochgeladen werden', 'error')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleBriefpapier = async (file: File | null) => {
    if (!file || !canEdit) return
    setBriefpapierUploading(true)
    try {
      if (isDemo) {
        const url = URL.createObjectURL(file)
        setField('briefpapier_url', url)
      } else {
        const uploaded = await uploadBriefpapier(file)
        setField('briefpapier_url', uploaded.url)
      }
      showToast('✅ Briefpapier hochgeladen')
    } catch {
      showToast('Briefpapier konnte nicht hochgeladen werden', 'error')
    } finally {
      setBriefpapierUploading(false)
    }
  }

  const handleBriefpapierDelete = async () => {
    if (!canEdit || !firma.briefpapier_url) return
    setBriefpapierDeleting(true)
    try {
      if (!isDemo) await deleteBriefpapier(firma.briefpapier_url)
      setField('briefpapier_url', undefined)
      showToast('✅ Briefpapier entfernt')
    } catch {
      showToast('Briefpapier konnte nicht entfernt werden', 'error')
    } finally {
      setBriefpapierDeleting(false)
    }
  }

  if (loading) return <div className="pk-card" style={{ color: '#aeb9c8' }}>Lade Firmendaten…</div>

  const inputDisabled = !canEdit
  const input = (key: keyof FirmaEinstellungen, label: string, placeholder = '', type = 'text') => (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{label}</label>
      <input className="pk-input" type={type} disabled={inputDisabled} value={String(firma[key] ?? '')} onChange={e => setField(key, e.target.value as never)} placeholder={placeholder} />
    </div>
  )
  const requiredDocumentFields: Array<[keyof FirmaEinstellungen, string]> = [
    ['firmenname', 'Firmenname'],
    ['adresse', 'Adresse'],
    ['plz', 'PLZ'],
    ['ort', 'Ort'],
    ['email', 'E-Mail'],
    ['telefon', 'Telefon'],
    ['iban', 'IBAN'],
  ]
  const missingDocumentFields = requiredDocumentFields
    .filter(([key]) => !String(firma[key] ?? '').trim())
    .map(([, label]) => label)
  const completedDocumentFields = requiredDocumentFields.length - missingDocumentFields.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!firma.onboarding_completed && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.28)', color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
          Firmendaten noch unvollständig. Die App bleibt nutzbar, aber PDFs nutzen Fallback-Daten.
        </div>
      )}
      {!canEdit && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#aeb9c8', fontSize: 13 }}>
          Nur Admins und Inhaber dürfen Firmendaten und Briefpapier bearbeiten. Sie können die Daten hier ansehen.
        </div>
      )}
      {petersenBrandLocked && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.24)', color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
          Petersen Brand ist in diesem Account gesperrt. Bitte als Inhaber anmelden oder eine andere Vorlage wählen.
        </div>
      )}

      <div className="pk-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(220px, .8fr)', gap: 16, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6cb6ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Dokumentdaten</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900 }}>Firmendaten für Angebote, Auftragsbestätigungen und Rechnungen</h3>
          <div style={{ color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
            {missingDocumentFields.length === 0
              ? 'Alle Pflichtdaten für saubere Geschäftsdokumente sind hinterlegt.'
              : `Es fehlen noch: ${missingDocumentFields.join(', ')}.`}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((completedDocumentFields / requiredDocumentFields.length) * 100)}%`, height: '100%', background: missingDocumentFields.length === 0 ? '#4ddb7e' : '#20c8ff' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Angebote', 'Auftragsbestätigungen', 'Rechnungen'].map(label => (
              <span key={label} className="badge badge-blue">{label}</span>
            ))}
            {currentRole === 'Inhaber' && <span className="badge badge-green">Inhaber-Briefpapier</span>}
          </div>
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🏢 Firmendaten & Logo</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 74, height: 74, borderRadius: 16, overflow: 'hidden', background: 'rgba(32,200,255,.12)', border: '1px solid rgba(32,200,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#20c8ff' }}>
            {firma.logo_url ? <img src={firma.logo_url} alt="Firmenlogo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (firma.firmenname || 'F').slice(0, 2).toUpperCase()}
          </div>
          <label className="pk-btn-ghost" style={{ cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5 }}>
            {logoUploading ? '⏳ Logo…' : 'Logo hochladen'}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit} onChange={e => handleLogo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {input('firmenname', 'Firmenname *')}
          {input('slogan', 'Slogan')}
          {input('branche', 'Branche')}
          {input('ansprechpartner', 'Ansprechpartner')}
          {input('adresse', 'Adresse')}
          {input('plz', 'PLZ')}
          {input('ort', 'Ort')}
          {input('land', 'Land')}
          {input('email', 'E-Mail', '', 'email')}
          {input('telefon', 'Telefon')}
          {input('website', 'Website')}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🧾 Steuerdaten & Bankverbindung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {input('ust_id', 'USt-IdNr.')}
          {input('steuernummer', 'Steuernummer')}
          {input('handelsregister', 'Handelsregister')}
          {input('geschaeftsfuehrer', 'Geschäftsführer')}
          {input('bankname', 'Bankname')}
          {input('iban', 'IBAN')}
          {input('bic', 'BIC')}
          {input('zahlungsziel_tage', 'Standard-Zahlungsziel', '', 'number')}
          {input('standard_mwst', 'Standard-MwSt.', '', 'number')}
          {input('standard_waehrung', 'Standard-Währung')}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>📄 Briefpapier / Design</h3>

        {/* Template selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase' }}>Briefpapier-Vorlage</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {([
              {
                id: 'modern-dark',
                name: 'Modern Dark',
                desc: 'Dunkel & professionell',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    {/* Header bar */}
                    <div style={{ background: '#0a121e', height: '12%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                      <div style={{ width: 10, height: 3, background: String(layout.akzentfarbe ?? '#20c8ff'), borderRadius: 1 }} />
                      <div style={{ marginLeft: 4, width: 30, height: 3, background: String(layout.akzentfarbe ?? '#20c8ff'), borderRadius: 1, opacity: 0.8 }} />
                    </div>
                    <div style={{ height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    {/* Body lines */}
                    <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ width: '45%', height: 2.5, background: '#1a2535', borderRadius: 1 }} />
                      <div style={{ width: '30%', height: 2, background: '#e8edf3', borderRadius: 1 }} />
                      <div style={{ marginTop: 3, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#0c1624', borderRadius: 2 }} />
                    </div>
                    {/* Footer bar */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10%', background: '#0a121e' }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
              {
                id: 'classic-light',
                name: 'Classic Professional',
                desc: 'Klassisch & seriös',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    <div style={{ background: '#162a58', height: '12%', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                      <div style={{ width: 10, height: 3, background: '#ffffff', borderRadius: 1, opacity: 0.9 }} />
                      <div style={{ marginLeft: 4, width: 30, height: 3, background: '#ffffff', borderRadius: 1, opacity: 0.7 }} />
                    </div>
                    <div style={{ height: 1.5, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ width: '45%', height: 2.5, background: '#162a58', borderRadius: 1 }} />
                      <div style={{ width: '30%', height: 2, background: '#d0d8e8', borderRadius: 1 }} />
                      <div style={{ marginTop: 3, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#e6f1ff', borderRadius: 2, border: `1px solid ${String(layout.akzentfarbe ?? '#20c8ff')}40` }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10%', background: '#f2f6fc' }} />
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, height: 1, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
              {
                id: 'elegant-minimal',
                name: 'Elegant Minimal',
                desc: 'Puristisch & edel',
                preview: (
                  <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                    <div style={{ height: 3, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                    <div style={{ padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ width: '40%', height: 3, background: '#161e34', borderRadius: 1 }} />
                        <div style={{ width: '25%', height: 2, background: '#c8d0dc', borderRadius: 1 }} />
                      </div>
                      <div style={{ width: '28%', height: 2, background: '#dce1ea', borderRadius: 1 }} />
                      <div style={{ height: 0.8, background: '#d7dee8', marginTop: 2, marginBottom: 2 }} />
                      <div style={{ width: '45%', height: 2.5, background: '#161e34', borderRadius: 1 }} />
                      <div style={{ marginTop: 2, width: '100%', height: 5, background: '#0a121e', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                      <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                      <div style={{ marginTop: 1, width: '55%', height: 4, background: '#0a121e', borderRadius: 1, alignSelf: 'flex-end' }} />
                      <div style={{ marginTop: 2, width: '100%', height: 8, background: '#fcfdff', borderRadius: 2, border: `1px solid ${String(layout.akzentfarbe ?? '#20c8ff')}60` }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: '10%', left: 6, right: 6, height: 0.8, background: String(layout.akzentfarbe ?? '#20c8ff') }} />
                  </div>
                ),
              },
            ...(currentRole === 'Inhaber' ? [{
              id: 'petersen-brand',
              name: 'Petersen Brand',
              desc: 'Exklusiv · Nur Inhaber',
              preview: (
                <div style={{ width: '100%', aspectRatio: '0.707', background: '#ffffff', borderRadius: 4, overflow: 'hidden', position: 'relative', fontSize: 0 }}>
                  {/* Dark header with cloud glow */}
                  <div style={{ background: '#040c1a', height: '14%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', paddingLeft: 6, gap: 5 }}>
                    {/* Mini 3D cube */}
                    <svg width="10" height="11" viewBox="0 0 100 110" fill="none">
                      <defs>
                        <linearGradient id="pt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#90c0ff"/><stop offset="100%" stopColor="#1a5ae0"/></linearGradient>
                        <linearGradient id="pl" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#05194a"/><stop offset="100%" stopColor="#0a2878"/></linearGradient>
                        <linearGradient id="pr" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1048cc"/><stop offset="100%" stopColor="#1e6aff"/></linearGradient>
                      </defs>
                      <polygon points="50,6 90,28 50,50 10,28" fill="url(#pt)"/>
                      <polygon points="10,28 50,50 50,94 10,72" fill="url(#pl)"/>
                      <polygon points="90,28 90,72 50,94 50,50" fill="url(#pr)"/>
                      <polygon points="50,24 77,38 50,52 23,38" fill="#030a1e" opacity="0.9"/>
                      <polygon points="23,38 50,52 50,76 23,62" fill="#020814" opacity="0.88"/>
                      <polygon points="77,38 77,62 50,76 50,52" fill="#060e2a" opacity="0.85"/>
                      <polygon points="50,33 67,42 50,51 33,42" fill="url(#pt)" opacity="0.85"/>
                      <polygon points="33,42 50,51 50,67 33,58" fill="url(#pl)" opacity="0.8"/>
                      <polygon points="67,42 67,58 50,67 50,51" fill="url(#pr)" opacity="0.82"/>
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ width: 32, height: 2, background: '#ffffff', borderRadius: 1 }} />
                      <div style={{ width: 22, height: 1.5, background: 'rgba(100,170,255,0.5)', borderRadius: 1 }} />
                    </div>
                    {/* Cloud glow bottom-left */}
                    <div style={{ position: 'absolute', bottom: -4, left: 0, width: 30, height: 10, background: 'radial-gradient(ellipse at 30% 80%, rgba(20,80,240,0.7) 0%, transparent 70%)', filter: 'blur(2px)' }} />
                    <div style={{ position: 'absolute', bottom: -4, right: 0, width: 30, height: 10, background: 'radial-gradient(ellipse at 70% 80%, rgba(20,80,240,0.6) 0%, transparent 70%)', filter: 'blur(2px)' }} />
                  </div>
                  {/* Gradient separator */}
                  <div style={{ height: 1.5, background: 'linear-gradient(90deg, #1048cc, #20c8ff 50%, #1048cc)' }} />
                  {/* Body */}
                  <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ width: '45%', height: 2.5, background: '#0a1a3a', borderRadius: 1 }} />
                    <div style={{ width: '30%', height: 2, background: '#e0e8f5', borderRadius: 1 }} />
                    <div style={{ marginTop: 2, width: '100%', height: 5, background: '#060e20', borderRadius: 1 }} />
                    <div style={{ width: '100%', height: 3, background: '#f3f6fa', borderRadius: 1 }} />
                    <div style={{ width: '100%', height: 3, background: '#f8fafc', borderRadius: 1 }} />
                    <div style={{ marginTop: 1, width: '55%', height: 4, background: '#060e20', borderRadius: 1, alignSelf: 'flex-end' }} />
                    <div style={{ marginTop: 2, width: '100%', height: 8, background: '#050e1e', borderRadius: 2 }} />
                  </div>
                  {/* Dark footer with diagonal */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '11%', background: '#040c1a', clipPath: 'polygon(0 40%, 100% 0%, 100% 100%, 0% 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #1048cc, #20c8ff 50%, #1048cc)' }} />
                  {/* Footer cloud glow */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: 30, height: 15, background: 'radial-gradient(ellipse at 20% 90%, rgba(20,80,240,0.5) 0%, transparent 70%)', filter: 'blur(3px)' }} />
                  {/* Inhaber badge */}
                  <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(32,200,255,0.15)', border: '1px solid rgba(32,200,255,0.3)', borderRadius: 3, padding: '1px 4px', fontSize: 5.5, color: '#20c8ff', fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 0.5 }}>INHABER</div>
                </div>
              ),
            }] : []),
            ] as Array<{ id: string; name: string; desc: string; preview: React.ReactNode }>).map(tpl => {
              const isSelected = (layout.template ?? 'modern-dark') === tpl.id
              const accentColor = String(layout.akzentfarbe ?? '#20c8ff')
              return (
                <button
                  key={tpl.id}
                  disabled={inputDisabled}
                  onClick={() => setLayout('template', tpl.id)}
                  style={{
                    background: isSelected ? 'rgba(32,200,255,.06)' : 'rgba(255,255,255,.03)',
                    border: isSelected ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,.08)',
                    borderRadius: 12,
                    padding: 10,
                    cursor: inputDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: inputDisabled ? 0.5 : 1,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  {tpl.preview}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? accentColor : 'rgba(255,255,255,.2)', flexShrink: 0, transition: 'background .15s' }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? accentColor : '#d0d9e8' }}>{tpl.name}</div>
                      <div style={{ fontSize: 10, color: '#7a8898', marginTop: 1 }}>{tpl.desc}</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Logo-Position</label>
            <select className="pk-input" disabled={inputDisabled} value={String(layout.logoPosition ?? 'links')} onChange={e => setLayout('logoPosition', e.target.value)}>
              <option value="links">links</option><option value="mitte">mitte</option><option value="rechts">rechts</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Akzentfarbe</label>
            <input className="pk-input" type="color" disabled={inputDisabled} value={String(layout.akzentfarbe ?? '#20c8ff')} onChange={e => setLayout('akzentfarbe', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Fußzeile</label>
            <textarea className="pk-input" rows={3} disabled={inputDisabled} value={firma.dokument_footer ?? ''} onChange={e => setField('dokument_footer', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
          {[
            ['showBankdaten', 'Bankdaten anzeigen'],
            ['showSteuernummer', 'Steuernummer anzeigen'],
            ['showUstId', 'USt-IdNr. anzeigen'],
            ['showGeschaeftsfuehrer', 'Geschäftsführer anzeigen'],
            ['showWebsite', 'Website anzeigen'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d0d9e8' }}>
              <input type="checkbox" disabled={inputDisabled} checked={layout[key] !== false} onChange={e => setLayout(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>📎 Eigenes Briefpapier hochladen</h3>
        <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 13, lineHeight: 1.6 }}>
          Wenn ein eigenes Briefpapier hinterlegt ist, werden Header, Footer, Logo und alle Firmendaten
          <strong style={{ color: '#d0d9e8' }}> ausschließlich aus dem Briefpapier</strong> übernommen.
          Der PDF-Generator erzeugt dann nur noch den Dokumentinhalt im freien Mittelbereich.
        </p>

        {firma.briefpapier_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'rgba(32,200,255,.06)', border: '1px solid rgba(32,200,255,.25)', marginBottom: 12 }}>
            <div style={{ fontSize: 28 }}>
              {firma.briefpapier_url.toLowerCase().split('?')[0].endsWith('.pdf') ? '📄' : '🖼️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#20c8ff', fontSize: 13 }}>Briefpapier aktiv</div>
              <div style={{ color: '#aeb9c8', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firma.briefpapier_url.split('/').pop()?.split('?')[0] || 'briefpapier'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <label className="pk-btn-ghost" style={{ cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5, fontSize: 12, padding: '6px 12px' }}>
                {briefpapierUploading ? '⏳' : 'Ersetzen'}
                <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={!canEdit} onChange={e => handleBriefpapier(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
              </label>
              <button
                onClick={handleBriefpapierDelete}
                disabled={briefpapierDeleting || !canEdit}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5 }}
              >
                {briefpapierDeleting ? '⏳' : 'Entfernen'}
              </button>
            </div>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px', borderRadius: 12, border: '2px dashed rgba(32,200,255,.25)', background: 'rgba(32,200,255,.03)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : .5, marginBottom: 12, transition: 'border-color .15s, background .15s' }}>
            <div style={{ fontSize: 32 }}>📄</div>
            <div>
              <div style={{ fontWeight: 700, color: '#d0d9e8', fontSize: 14 }}>
                {briefpapierUploading ? '⏳ Wird hochgeladen…' : 'Briefpapier hochladen'}
              </div>
              <div style={{ color: '#7a8898', fontSize: 12, marginTop: 2 }}>PDF, PNG oder JPG · DIN-A4 empfohlen</div>
            </div>
            <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={!canEdit || briefpapierUploading} onChange={e => handleBriefpapier(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
          </label>
        )}

        {firma.briefpapier_url && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24', fontSize: 12 }}>
            Hinweis: Bitte nach dem Hochladen auf &bdquo;Firmendaten speichern&ldquo; klicken, damit das Briefpapier dauerhaft verknüpft wird.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="pk-btn" disabled={saving || !canEdit} onClick={() => save(true)} style={{ fontWeight: 700, opacity: canEdit ? 1 : .5 }}>
          {saving ? '⏳ Speichern…' : 'Firmendaten speichern'}
        </button>
        {!firma.onboarding_completed && canEdit && (
          <button className="pk-btn-ghost" onClick={() => save(false)}>Später vervollständigen</button>
        )}
      </div>
    </div>
  )
}

// ── Import Wizard Component ────────────────────────────────────────────────────

type ImportProtokoll = {
  id: string; quelle: string; datentyp: string; dateiname: string; status: string
  anzahl_gesamt: number; anzahl_erfolgreich: number; anzahl_fehlerhaft: number
  erstellt_am: string
}

const IMPORT_SOURCES: ImportSource[] = ['WISO', 'Lexware', 'sevDesk', 'JTL', 'Billbee', 'DATEV CSV', 'Generisch']

const DATA_TYPE_LABELS: Record<ImportDataType, string> = {
  artikel: '📦 Artikel / Lagerbestand → lager_artikel',
  kunden: '👥 Kunden → buero_kunden',
  lieferanten: '🏭 Lieferanten → einkauf_lieferanten',
  rechnungen: '🧾 Rechnungen → buero_rechnungen',
  angebote: '📄 Angebote → buero_angebote',
  auftraege: '📋 Aufträge → buero_auftraege',
  bewegungen: '🔄 Lagerbewegungen → lager_bewegungen',
  belege: '📎 Belege → steuer_belege',
  projekte: '📅 Projekte → planung_projekte',
  steuer_belege: '🧾 Steuerbelege / Eingangsrechnungen → steuer_belege',
  steuer_buchungen: '📒 Buchungen → steuer_buchungen',
  steuer_ustva: '📊 UStVA-Daten → steuer_ustva',
  steuer_konten: '🗂️ Steuerkonten / Kontenrahmen → steuer_konten',
  werkstatt_zeitbuchungen: '⏱️ Werkstatt-Zeitbuchungen → werkstatt_zeitbuchungen',
  werkstatt_material: '🔩 Werkstatt-Materialverbrauch → werkstatt_material',
}


function ImportWizard({ isDemo, showToast }: { isDemo: boolean; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState<ImportSource>('Generisch')
  const [dataType, setDataType] = useState<ImportDataType>('artikel')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [protokolle, setProtokolle] = useState<ImportProtokoll[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isDemo) return
    getImportProtokolle().then(d => setProtokolle(d as ImportProtokoll[])).catch(() => {})
  }, [isDemo])

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
      showToast('Nur CSV-Dateien werden unterstützt (XLSX: in Kürze)', 'error'); return
    }
    if (f.name.endsWith('.xlsx')) {
      showToast('Excel-Dateien: Bitte als CSV exportieren (Datei → Speichern unter → CSV)', 'error'); return
    }
    setFile(f); setParsing(true)
    const result = await parseCsvFile(f)
    setParseResult(result)
    setMapping(autoMapColumns(result.headers, source, dataType))
    setParsing(false)
    if (result.error) { showToast(result.error, 'error'); return }
    setStep(3)
  }, [source, dataType, showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDemoSimulate = useCallback(async () => {
    const csvMap: Partial<Record<ImportDataType, string>> = {
      artikel: DEMO_CSV_ARTIKEL, kunden: DEMO_CSV_KUNDEN,
      steuer_belege: DEMO_CSV_STEUER, steuer_buchungen: DEMO_CSV_BUCHUNGEN,
    }
    const csv = csvMap[dataType] ?? DEMO_CSV_ARTIKEL
    const blob = new Blob([csv], { type: 'text/csv' })
    const f = new File([blob], `demo_${dataType}.csv`, { type: 'text/csv' })
    await handleFile(f)
  }, [dataType, handleFile])

  const handleValidate = () => {
    if (!parseResult) return
    const result = validateImportRows(parseResult.rows, dataType, mapping)
    setValidationResult(result)
    setStep(4)
  }

  const handleImport = async () => {
    if (!validationResult || !parseResult) return
    setImporting(true)
    const builtRows = buildImportRows(validationResult.valid, mapping)

    if (isDemo) {
      await new Promise(r => setTimeout(r, 800))
      showToast(`✅ Demo-Import simuliert: ${builtRows.length} Datensätze (Demo)`)
      setImporting(false); setStep(5); return
    }

    try {
      const importedCount = await runBulkImport(dataType, builtRows)
      const proto: ImportProtokoll = {
        id: genId('IMP'),
        quelle: source,
        datentyp: dataType,
        dateiname: file?.name ?? '',
        status: validationResult.summary.invalid > 0 ? 'teilweise' : 'erfolgreich',
        anzahl_gesamt: validationResult.summary.total,
        anzahl_erfolgreich: importedCount,
        anzahl_fehlerhaft: validationResult.summary.invalid,
        erstellt_am: new Date().toISOString(),
      }
      await insertImportProtokoll({ ...proto, fehler: validationResult.warnings as object })
      setProtokolle(prev => [proto, ...prev])
      showToast(`✅ ${importedCount} Datensätze erfolgreich importiert`)
      setStep(5)
    } catch (err) {
      showToast('Fehler beim Import: ' + String(err), 'error')
    } finally { setImporting(false) }
  }

  const reset = () => {
    setStep(1); setFile(null); setParseResult(null); setMapping({}); setValidationResult(null)
  }

  const STEP_LABELS = ['System', 'Datentyp', 'Upload', 'Mapping', 'Vorschau']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="pk-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>📥 Datenimport & Migration</h3>
            <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
              Importiere Daten aus WISO, Lexware, DATEV, sevDesk, JTL und anderen Systemen als CSV.
              {isDemo && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontSize: 11, fontWeight: 700 }}>DEMO</span>}
            </p>
          </div>
          {step > 1 && <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12 }}>↺ Neu starten</button>}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={n} style={{
                flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                background: active ? 'rgba(22,132,255,.18)' : done ? 'rgba(37,211,102,.08)' : 'transparent',
                color: active ? '#6cb6ff' : done ? '#4ddb7e' : '#4a5568',
                borderRight: n < 5 ? '1px solid rgba(255,255,255,.06)' : 'none',
                transition: 'all .2s',
              }}>
                <div style={{ fontSize: 16 }}>{done ? '✓' : n}</div>
                <div style={{ marginTop: 2 }}>{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: System */}
      {step === 1 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 1: Quellsystem wählen</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {IMPORT_SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)} style={{
                padding: '14px 10px', borderRadius: 10, border: `2px solid ${source === s ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                background: source === s ? 'rgba(22,132,255,.12)' : 'rgba(255,255,255,.03)',
                color: source === s ? '#6cb6ff' : '#aeb9c8', fontWeight: source === s ? 700 : 500,
                cursor: 'pointer', fontSize: 13, transition: 'all .15s',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.15)', fontSize: 13, color: '#aeb9c8', marginBottom: 20 }}>
            💡 Exportiere deine Daten aus <strong style={{ color: '#6cb6ff' }}>{source}</strong> als CSV-Datei und lade sie hier hoch. Spalten werden automatisch erkannt und vorgeschlagen.
          </div>
          <button className="pk-btn" onClick={() => setStep(2)}>Weiter →</button>
        </div>
      )}

      {/* Step 2: Datentyp */}
      {step === 2 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 2: Was möchtest du importieren?</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {(Object.keys(DATA_TYPE_LABELS) as ImportDataType[]).map(dt => (
              <button key={dt} onClick={() => setDataType(dt)} style={{
                padding: '12px 16px', borderRadius: 10, border: `2px solid ${dataType === dt ? '#1684ff' : 'rgba(255,255,255,.07)'}`,
                background: dataType === dt ? 'rgba(22,132,255,.1)' : 'rgba(255,255,255,.02)',
                color: dataType === dt ? '#6cb6ff' : '#aeb9c8', fontWeight: dataType === dt ? 700 : 500,
                cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all .15s',
              }}>{DATA_TYPE_LABELS[dt]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(1)}>← Zurück</button>
            <button className="pk-btn" onClick={() => setStep(3)}>Weiter →</button>
          </div>
        </div>
      )}

      {/* Step 3: Upload */}
      {step === 3 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 3: CSV-Datei hochladen</h4>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#aeb9c8' }}>
            Ziel: <strong style={{ color: '#6cb6ff' }}>{DATA_TYPE_LABELS[dataType]}</strong>
          </p>

          {/* Drag & Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#1684ff' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(22,132,255,.08)' : 'rgba(255,255,255,.02)',
              transition: 'all .2s', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {file ? file.name : 'CSV-Datei hier ablegen oder klicken'}
            </div>
            <div style={{ fontSize: 12, color: '#4a5568' }}>Unterstützt: .csv (XLSX: bitte als CSV exportieren)</div>
            {file && <div style={{ marginTop: 8, fontSize: 12, color: '#4ddb7e' }}>✓ {(file.size / 1024).toFixed(1)} KB geladen</div>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {isDemo && (
            <div style={{ marginBottom: 16 }}>
              <button className="pk-btn-ghost" onClick={handleDemoSimulate} style={{ fontSize: 13 }}>
                🎭 Demo-CSV simulieren
              </button>
              <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 10 }}>Lädt Beispieldaten für {dataType}</span>
            </div>
          )}

          {parsing && <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 12 }}>⏳ Datei wird geparst…</div>}

          {parseResult && !parseResult.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.2)', fontSize: 13, marginBottom: 16 }}>
              ✅ <strong>{parseResult.totalRows}</strong> Zeilen erkannt · <strong>{parseResult.headers.length}</strong> Spalten · Trennzeichen: <code>&quot;{parseResult.delimiter}&quot;</code>
            </div>
          )}
          {parseResult?.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', fontSize: 13, color: '#ff8080', marginBottom: 16 }}>
              ❌ {parseResult.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(2)}>← Zurück</button>
            {parseResult && !parseResult.error && (
              <button className="pk-btn" onClick={() => setStep(3.5 as never)}>Spalten mappen →</button>
            )}
          </div>
        </div>
      )}

      {/* Step 3.5: Column Mapping (shown between step 3 and 4) */}
      {(step as number) === 3.5 && parseResult && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 4: Spalten zuordnen</h4>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#aeb9c8' }}>
            Ordne die Spalten deiner Datei den Zielfeldern zu. Felder auf <strong>– ignorieren –</strong> werden übersprungen.
          </p>

          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Spalte in deiner Datei</th>
                  <th>Beispielwert</th>
                  <th>Zielfeld in Petersen KI</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.headers.map(header => {
                  const example = parseResult.rows[0]?.[header] ?? ''
                  return (
                    <tr key={header}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{header}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{example}</td>
                      <td>
                        <select
                          className="pk-input"
                          value={mapping[header] ?? '__skip__'}
                          onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          style={{ fontSize: 12, padding: '4px 8px' }}
                        >
                          <option value="__skip__">– ignorieren –</option>
                          {TARGET_FIELDS[dataType].map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.12)', fontSize: 12, color: '#aeb9c8', marginBottom: 16 }}>
            * Pflichtfelder müssen zugeordnet sein für einen erfolgreichen Import.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3)}>← Zurück</button>
            <button className="pk-btn" onClick={handleValidate}>Prüfen & Vorschau →</button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Validation */}
      {step === 4 && validationResult && parseResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <div className="pk-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Schritt 5: Vorschau & Prüfung</h4>
            <div className="stats-grid">
              {[
                { label: 'Gesamt', val: validationResult.summary.total, color: '#f8fbff' },
                { label: 'Gültig', val: validationResult.summary.valid, color: '#4ddb7e' },
                { label: 'Fehlerhaft', val: validationResult.summary.invalid, color: '#ff8080' },
                { label: 'Warnungen', val: validationResult.summary.warnings, color: '#f59e0b' },
                { label: 'Duplikate', val: validationResult.summary.duplicates, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="pk-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>⚠️ Prüf-Meldungen ({validationResult.warnings.length})</div>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validationResult.warnings.slice(0, 30).map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 7, fontSize: 12,
                    background: w.type === 'error' ? 'rgba(255,80,80,.07)' : w.type === 'warn' ? 'rgba(245,158,11,.07)' : 'rgba(22,132,255,.07)',
                    borderLeft: `2px solid ${w.type === 'error' ? '#ff5050' : w.type === 'warn' ? '#f59e0b' : '#1684ff'}`,
                  }}>
                    <span style={{ fontFamily: 'monospace', color: '#4a5568', flexShrink: 0 }}>Z.{w.row}</span>
                    <span style={{ color: '#aeb9c8' }}><strong>{w.field}:</strong> {w.message}</span>
                  </div>
                ))}
                {validationResult.warnings.length > 30 && <div style={{ fontSize: 12, color: '#4a5568' }}>… und {validationResult.warnings.length - 30} weitere</div>}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Vorschau (erste 10 Zeilen, gültige Felder)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                      <th key={field}>{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildImportRows(parseResult.rows.slice(0, 10), mapping).map((row, i) => (
                    <tr key={i}>
                      {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                        <td key={field} style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[field] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {validationResult.summary.valid === 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', color: '#ff8080', fontSize: 13, fontWeight: 600 }}>
              ❌ Keine gültigen Datensätze. Bitte Mapping überprüfen.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3.5 as never)}>← Mapping ändern</button>
            <button className="pk-btn-ghost" onClick={reset} style={{ color: '#ff8080', borderColor: 'rgba(255,80,80,.3)' }}>✕ Abbrechen</button>
            {validationResult.summary.valid > 0 && (
              <button className="pk-btn" onClick={handleImport} disabled={importing} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {importing ? '⏳ Importiere…' : `✅ ${validationResult.summary.valid} Datensätze importieren`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === 5 && (
        <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Import abgeschlossen!</div>
          <div style={{ color: '#aeb9c8', fontSize: 14, marginBottom: 20 }}>
            Die Daten wurden erfolgreich importiert und stehen jetzt im jeweiligen Piloten zur Verfügung.
            {isDemo && ' (Demo-Modus – keine echten Daten gespeichert)'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="pk-btn" onClick={reset}>Weiteren Import starten</button>
          </div>
        </div>
      )}

      {/* Import Protokolle */}
      <div className="pk-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Import-Protokolle</div>
        {protokolle.length === 0 && !isDemo ? (
          <div style={{ color: '#4a5568', fontSize: 13 }}>Noch keine Importe durchgeführt.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr><th>Datum</th><th>Quelle</th><th>Datentyp</th><th>Datei</th><th>Gesamt</th><th>OK</th><th>Fehler</th><th>Status</th></tr>
              </thead>
              <tbody>
                {(isDemo ? DEMO_PROTOKOLLE : protokolle).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12 }}>{new Date(p.erstellt_am).toLocaleDateString('de-DE')}</td>
                    <td style={{ fontWeight: 600 }}>{p.quelle}</td>
                    <td style={{ fontSize: 12 }}>{p.datentyp}</td>
                    <td style={{ fontSize: 11, color: '#aeb9c8', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.dateiname}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.anzahl_gesamt}</td>
                    <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{p.anzahl_erfolgreich}</td>
                    <td style={{ fontFamily: 'monospace', color: p.anzahl_fehlerhaft > 0 ? '#ff8080' : '#4a5568' }}>{p.anzahl_fehlerhaft}</td>
                    <td>
                      <span className={`badge ${p.status === 'erfolgreich' ? 'badge-green' : p.status === 'teilweise' ? 'badge-orange' : 'badge-red'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const DEMO_PROTOKOLLE: ImportProtokoll[] = [
  { id: 'IMP-001', quelle: 'WISO', datentyp: 'artikel', dateiname: 'wiso_artikel_export.csv', status: 'erfolgreich', anzahl_gesamt: 48, anzahl_erfolgreich: 48, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-10T09:15:00Z' },
  { id: 'IMP-002', quelle: 'Lexware', datentyp: 'kunden', dateiname: 'kundenstamm_2025.csv', status: 'teilweise', anzahl_gesamt: 120, anzahl_erfolgreich: 118, anzahl_fehlerhaft: 2, erstellt_am: '2025-04-08T14:30:00Z' },
  { id: 'IMP-003', quelle: 'DATEV CSV', datentyp: 'steuer_belege', dateiname: 'datev_belege_q1.csv', status: 'erfolgreich', anzahl_gesamt: 34, anzahl_erfolgreich: 34, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-01T11:00:00Z' },
]

async function runBulkImport(dataType: ImportDataType, rows: Record<string, string>[]): Promise<number> {

  if (dataType === 'artikel') {
    const prepared = rows.map(r => ({
      id: genId('ART'), name: r.name ?? '', artikelnummer: r.artikelnummer,
      beschreibung: r.beschreibung, einheit: r.einheit, lagerort: r.lagerort,
      bestand: normalizeNumber(r.bestand ?? '') ?? 0,
      mindestbestand: normalizeNumber(r.mindestbestand ?? '') ?? 0,
      einkaufspreis: normalizeNumber(r.einkaufspreis ?? '') ?? 0,
      verkaufspreis: normalizeNumber(r.verkaufspreis ?? '') ?? 0,
    }))
    await bulkImportLagerArtikel(prepared)
    return prepared.length
  }
  if (dataType === 'kunden') {
    const prepared = rows.map(r => ({ id: genId('KD'), name: r.name ?? '', email: r.email, telefon: r.telefon, adresse: r.adresse, kundennummer: r.kundennummer, notizen: r.notizen }))
    await bulkImportBueroKunden(prepared); return prepared.length
  }
  if (dataType === 'lieferanten') {
    const prepared = rows.map(r => ({ id: genId('LFR'), name: r.name ?? '', email: r.email, telefon: r.telefon, ort: r.ort, kategorie: r.kategorie, zahlungsziel: r.zahlungsziel, notiz: r.notiz }))
    await bulkImportEinkaufLieferanten(prepared); return prepared.length
  }
  if (dataType === 'rechnungen') {
    const prepared = rows.map(r => ({ id: genId('RE'), nummer: r.nummer ?? genId('RE'), kunde: r.kunde, datum: normalizeDate(r.datum ?? '') ?? undefined, faellig_am: normalizeDate(r.faellig_am ?? '') ?? undefined, summe: normalizeNumber(r.summe ?? '') ?? 0, status: r.status ?? 'Offen', notiz: r.notiz }))
    await bulkImportBueroRechnungen(prepared); return prepared.length
  }
  if (dataType === 'steuer_belege' || dataType === 'belege') {
    const prepared = rows.map(r => ({
      id: genId('BLG'), lieferant: r.lieferant ?? '', datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      betrag: normalizeNumber(r.betrag ?? '') ?? 0, steuerbetrag: normalizeNumber(r.steuerbetrag ?? '') ?? 0,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? 19, belegnummer: r.belegnummer,
      kategorie: r.kategorie, status: r.status ?? 'offen', notiz: r.notiz,
    }))
    await bulkImportSteuerBelege(prepared); return prepared.length
  }
  if (dataType === 'steuer_buchungen') {
    const prepared = rows.map(r => ({
      id: genId('BCH'), datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      buchungstext: r.buchungstext ?? '', betrag: normalizeNumber(r.betrag ?? '') ?? 0,
      soll_konto: r.soll_konto, haben_konto: r.haben_konto, steuerkonto: r.steuerkonto,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, beleg_id: r.beleg_id, status: r.status ?? 'offen',
    }))
    await bulkImportSteuerBuchungen(prepared); return prepared.length
  }
  if (dataType === 'steuer_konten') {
    const prepared = rows.map(r => ({ id: genId('KTO'), kontonummer: r.kontonummer ?? '', name: r.name ?? '', typ: r.typ, steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, aktiv: r.aktiv !== 'false' }))
    await bulkImportSteuerKonten(prepared); return prepared.length
  }
  if (dataType === 'werkstatt_zeitbuchungen') {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const prepared = rows.map(r => ({
      mitarbeiter: r.mitarbeiter ?? '',
      auftragsnr: r.auftragsnr ?? '',
      stunden: normalizeNumber(r.stunden ?? '') ?? 0,
      datum: r.datum || today,
      taetigkeit: r.taetigkeit ?? '',
    }))
    await bulkImportWerkstattZeitbuchungen(prepared); return prepared.length
  }
  if (dataType === 'werkstatt_material') {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const prepared = rows.map(r => ({
      artikel: r.artikel ?? '',
      menge: normalizeNumber(r.menge ?? '') ?? 0,
      einheit: r.einheit ?? 'Stk',
      auftragsnr: r.auftragsnr ?? '',
      datum: r.datum || today,
      mitarbeiter: r.mitarbeiter ?? '',
    }))
    await bulkImportWerkstattMaterial(prepared); return prepared.length
  }
  // TODO: implement auftraege, angebote, bewegungen, projekte, steuer_ustva bulk imports
  return 0
}
