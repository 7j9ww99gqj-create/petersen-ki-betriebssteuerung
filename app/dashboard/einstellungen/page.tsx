'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { hasDemoCookie, isDemoUser, performLogout } from '@/lib/auth'
import { type AccessMode, type AccessStatus } from '@/lib/access'
import { type AppRole, APP_ROLES, INHABER_EMAIL, ROLE_LABELS, ROLE_PILOTS, PERMISSIONS, normalizeRole, useRole } from '@/lib/roles'
// DesignV2Toggle + DesignThemeSelector bleiben im Codebase (rückwärtskompatibel),
// werden hier aber nicht mehr gerendert — DesignCustomizationPanel deckt alles ab.
import DesignCustomizationPanel from '@/components/einstellungen/DesignCustomizationPanel'
import ProfilTab from '@/components/einstellungen/ProfilTab'
import BenachrichtigungenTab from '@/components/einstellungen/BenachrichtigungenTab'
import InfoSection from '@/components/einstellungen/InfoSection'
import { AuditLogSection, CustomerInvoicePreview } from '@/components/einstellungen/AuditLogSection'
import CompanySettingsSection from '@/components/einstellungen/CompanySettingsSection'
import ImportWizard from '@/components/einstellungen/ImportWizard'
import PostfachTab from '@/components/einstellungen/PostfachTab'
import { PricingSettingsPage } from '@/components/billing/PricingSettingsPage'
import { OwnerAiControlPanel } from '@/components/billing/OwnerAiControlPanel'
import { OwnerCustomerControlPanel } from '@/components/billing/OwnerCustomerControlPanel'
import { OwnerPondruffFeaturesPanel } from '@/components/billing/OwnerPondruffFeaturesPanel'
import { OwnerOpenAiCostsPanel } from '@/components/billing/OwnerOpenAiCostsPanel'
import { OwnerAuditLogPanel } from '@/components/billing/OwnerAuditLogPanel'
import { OwnerMrrPanel } from '@/components/billing/OwnerMrrPanel'
import type { PilotId } from '@/lib/pricingConfig'

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

type SettingsSection = 'profil' | 'firma' | 'billing' | 'kundensteuerung' | 'registrierungen' | 'kunden-eingerichtet' | 'aktivitaetslog' | 'postfach' | 'benachrichtigungen' | 'design' | 'rollen' | 'info' | 'import'

const SETTINGS_SECTIONS: SettingsSection[] = ['profil', 'firma', 'billing', 'kundensteuerung', 'registrierungen', 'kunden-eingerichtet', 'aktivitaetslog', 'postfach', 'benachrichtigungen', 'design', 'rollen', 'info', 'import']

const ACCESS_STATUS_OPTIONS: AccessStatus[] = ['pending', 'active', 'suspended']
const ACCESS_MODE_OPTIONS: AccessMode[] = ['standard', 'demo']
const MANAGED_PILOT_OPTIONS: PilotId[] = ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer', 'qm']
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
  qm: 'QM-Pilot',
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

  // profil.email + setProfil werden noch außerhalb von ProfilTab gebraucht
  // (isInhaberAccount-Check + Rollen-Section). pwForm/notif/push-State sind in
  // ProfilTab / BenachrichtigungenTab gewandert.
  const [profil, setProfil] = useState({ name: '', email: '', role: 'Administrator', firma: '' })

  // Messaging-State + postfach-Load-useEffect sind nach PostfachTab gewandert.

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
    if ((section === 'rollen' || section === 'registrierungen' || section === 'kunden-eingerichtet' || section === 'postfach') && canManageLiveUsers) {
      void loadManagedUsers()
    }
  }, [section, canManageLiveUsers, loadManagedUsers])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  // handleProfilSave/handlePwSave/handleNotifSave wurden in ProfilTab + BenachrichtigungenTab verlagert

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

  // lokaler Toggle wurde in components/einstellungen/Toggle.tsx ausgelagert

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
          <NavItem id="postfach" icon="📬" label="Postfach" />
          <NavItem id="benachrichtigungen" icon="🔔" label="Benachricht." />
          <NavItem id="design" icon="🎨" label="Design" />
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
          {section === 'profil' && <ProfilTab showToast={showToast} />}

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
              <OwnerMrrPanel enabled={isInhaberAccount} />
              <OwnerAiControlPanel enabled={isInhaberAccount} showToast={showToast} />
              <OwnerOpenAiCostsPanel enabled={isInhaberAccount} />
              <OwnerCustomerControlPanel enabled={isInhaberAccount} showToast={showToast} />
              <OwnerPondruffFeaturesPanel enabled={isInhaberAccount} showToast={showToast} />
              <OwnerAuditLogPanel enabled={isInhaberAccount} />
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

          {section === 'benachrichtigungen' && <BenachrichtigungenTab showToast={showToast} />}

          {section === 'design' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DesignCustomizationPanel />
            </div>
          )}

          {section === 'postfach' && <PostfachTab isInhaberAccount={isInhaberAccount} isDemo={isDemo} showToast={showToast} managedUsers={managedUsers} />}

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

          {section === 'info' && <InfoSection isDemo={isDemo} />}
        </div>
      </div>
    </div>
  )
}
