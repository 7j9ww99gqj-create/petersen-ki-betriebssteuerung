'use client'

import { useEffect, useState } from 'react'
import {
  getAiFeatureSettings, updateAiFeatureSettings, type AiFeatureSettings,
  getMarketingKiSettings, updateMarketingKiSettings, type MarketingKiSettings,
  getOpenAiToolSettings, updateOpenAiToolSettings, type OpenAiToolSettings,
  listBillingSubscriptionsForOwner,
} from '@/lib/db'

type QmKiFlagsState = { qm_ki_zeichnungs_analyse: boolean; qm_ki_sichtpruefung: boolean }
type QmUserEntry = { userId: string; email: string; isAutoAccount: boolean }

type OwnerAiControlPanelProps = {
  enabled: boolean
  showToast?: (message: string, type?: 'success' | 'error') => void
  compact?: boolean
}

const DEFAULT_SETTINGS: AiFeatureSettings = {
  enabled: true,
  chatEnabled: true,
  documentEnabled: true,
}

const DEFAULT_MARKETING: MarketingKiSettings = {
  contentDailyEnabled: false,
  autopilotEnabled: false,
  salesAssistantEnabled: false,
}

export function OwnerAiControlPanel({
  enabled,
  showToast,
  compact = false,
}: OwnerAiControlPanelProps) {
  const [settings, setSettings] = useState<AiFeatureSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<keyof AiFeatureSettings | null>(null)
  const [marketingSettings, setMarketingSettings] = useState<MarketingKiSettings>(DEFAULT_MARKETING)
  const [marketingLoading, setMarketingLoading] = useState(true)
  const [savingMarketingKey, setSavingMarketingKey] = useState<keyof MarketingKiSettings | null>(null)
  const [openAiTools, setOpenAiTools] = useState<OpenAiToolSettings>({ steuerprognoseEnabled: false, mahnungsgeneratorEnabled: false, emailAssistentEnabled: false, monatsberichtEnabled: false })
  const [openAiLoading, setOpenAiLoading] = useState(true)
  const [savingOpenAiKey, setSavingOpenAiKey] = useState<keyof OpenAiToolSettings | null>(null)

  // QM-KI-Flags
  const [qmUsers, setQmUsers] = useState<QmUserEntry[]>([])
  const [qmUsersLoading, setQmUsersLoading] = useState(true)
  const [selectedQmUserId, setSelectedQmUserId] = useState<string>('')
  const [qmKiFlags, setQmKiFlags] = useState<QmKiFlagsState>({ qm_ki_zeichnungs_analyse: false, qm_ki_sichtpruefung: false })
  const [qmFlagsLoading, setQmFlagsLoading] = useState(false)
  const [savingQmKey, setSavingQmKey] = useState<'qm_ki_zeichnungs_analyse' | 'qm_ki_sichtpruefung' | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    getAiFeatureSettings()
      .then(setSettings)
      .catch(() => showToast?.('KI-Einstellungen konnten nicht geladen werden.', 'error'))
      .finally(() => setLoading(false))

    getMarketingKiSettings()
      .then(setMarketingSettings)
      .catch(() => {})
      .finally(() => setMarketingLoading(false))

    getOpenAiToolSettings()
      .then(setOpenAiTools)
      .catch(() => {})
      .finally(() => setOpenAiLoading(false))

    // QM-User-Liste aus Billing-Subscriptions
    setQmUsersLoading(true)
    listBillingSubscriptionsForOwner()
      .then(subs => {
        const INHABER = 'info@petersen-ki-pilot.de'
        const PONDRUFF = 'info@pondruffpolierservice.de'
        const seen = new Set<string>()
        const users: QmUserEntry[] = []
        for (const s of subs) {
          if (!s.userId || seen.has(s.userId)) continue
          seen.add(s.userId)
          const email = (s.userEmail ?? '').toLowerCase()
          users.push({ userId: s.userId, email: s.userEmail ?? s.userId, isAutoAccount: email === INHABER || email === PONDRUFF })
        }
        setQmUsers(users)
        if (users.length > 0) setSelectedQmUserId(users[0].userId)
      })
      .catch(() => {})
      .finally(() => setQmUsersLoading(false))
  }, [enabled, showToast])

  async function handleToggle(key: keyof AiFeatureSettings) {
    if (!enabled || savingKey) return

    const nextValue = !settings[key]
    const nextSettings = key === 'enabled' && !nextValue
      ? { ...settings, enabled: false, chatEnabled: false, documentEnabled: false }
      : { ...settings, [key]: nextValue }

    // Einzelmodule koennen nur aktiv sein, wenn global KI aktiv ist.
    if (key !== 'enabled' && nextValue) nextSettings.enabled = true

    setSettings(nextSettings)
    setSavingKey(key)

    try {
      const saved = await updateAiFeatureSettings(nextSettings)
      setSettings(saved)
      showToast?.('KI-Einstellungen gespeichert.', 'success')
    } catch (error) {
      setSettings(settings)
      showToast?.(error instanceof Error ? error.message : 'KI-Einstellungen konnten nicht gespeichert werden.', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  async function handleMarketingToggle(key: keyof MarketingKiSettings) {
    if (!enabled || savingMarketingKey) return
    const next = { ...marketingSettings, [key]: !marketingSettings[key] }
    setMarketingSettings(next)
    setSavingMarketingKey(key)
    try {
      const saved = await updateMarketingKiSettings(next)
      setMarketingSettings(saved)
      showToast?.('Marketing-KI gespeichert.', 'success')
    } catch (error) {
      setMarketingSettings(marketingSettings)
      showToast?.(error instanceof Error ? error.message : 'Marketing-KI konnte nicht gespeichert werden.', 'error')
    } finally {
      setSavingMarketingKey(null)
    }
  }

  // QM-Flags beim User-Wechsel laden
  useEffect(() => {
    if (!selectedQmUserId) return
    setQmFlagsLoading(true)
    fetch(`/api/owner/qm-ki-flags?user_id=${selectedQmUserId}`)
      .then(r => r.json())
      .then((data: { flags?: QmKiFlagsState; error?: string }) => {
        if (data.flags) setQmKiFlags(data.flags)
      })
      .catch(() => {})
      .finally(() => setQmFlagsLoading(false))
  }, [selectedQmUserId])

  async function handleQmToggle(key: 'qm_ki_zeichnungs_analyse' | 'qm_ki_sichtpruefung') {
    if (!selectedQmUserId || savingQmKey) return
    const selectedUser = qmUsers.find(u => u.userId === selectedQmUserId)
    if (selectedUser?.isAutoAccount) return
    const next = { ...qmKiFlags, [key]: !qmKiFlags[key] }
    setQmKiFlags(next)
    setSavingQmKey(key)
    try {
      const res = await fetch('/api/owner/qm-ki-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedQmUserId, [key]: next[key] }),
      })
      const data = await res.json() as { flags?: QmKiFlagsState; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.flags) setQmKiFlags(data.flags)
      showToast?.('QM-KI-Flag gespeichert.', 'success')
    } catch (e) {
      setQmKiFlags(qmKiFlags)
      showToast?.(e instanceof Error ? e.message : 'QM-KI-Flag konnte nicht gespeichert werden.', 'error')
    } finally {
      setSavingQmKey(null)
    }
  }

  async function handleOpenAiToggle(key: keyof OpenAiToolSettings) {
    if (!enabled || savingOpenAiKey) return
    const next = { ...openAiTools, [key]: !openAiTools[key] }
    setOpenAiTools(next)
    setSavingOpenAiKey(key)
    try {
      const saved = await updateOpenAiToolSettings(next)
      setOpenAiTools(saved)
      showToast?.('OpenAI-Tool gespeichert.', 'success')
    } catch (error) {
      setOpenAiTools(openAiTools)
      showToast?.(error instanceof Error ? error.message : 'OpenAI-Tool konnte nicht gespeichert werden.', 'error')
    } finally {
      setSavingOpenAiKey(null)
    }
  }

  const ToggleRow = ({
    settingKey,
    label,
    desc,
  }: {
    settingKey: keyof AiFeatureSettings
    label: string
    desc: string
  }) => {
    const checked = settings[settingKey]
    const disabled = !enabled || loading || Boolean(savingKey) || (settingKey !== 'enabled' && !settings.enabled)

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: compact ? '12px 0' : '14px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14, color: '#f8fbff' }}>{label}</div>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{desc}</div>
        </div>
        <button
          onClick={() => handleToggle(settingKey)}
          disabled={disabled}
          style={{
            width: 48,
            height: 26,
            borderRadius: 999,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            position: 'relative',
            flexShrink: 0,
            opacity: disabled ? 0.6 : 1,
            background: checked ? 'linear-gradient(135deg, #10b981, #1684ff)' : 'rgba(255,255,255,.12)',
            transition: 'background .2s, opacity .2s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: checked ? 24 : 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left .2s',
              boxShadow: '0 1px 5px rgba(0,0,0,.35)',
            }}
          />
        </button>
      </div>
    )
  }

  if (!enabled) return null

  return (
    <div
      className="pk-card"
      style={{
        padding: compact ? 18 : 22,
        borderColor: 'rgba(16,185,129,.22)',
        background: 'linear-gradient(180deg, rgba(14,24,22,.98), rgba(9,15,15,.98))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: compact ? 15 : 16, fontWeight: 900 }}>KI-Funktionen</h3>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>
            Owner-Schalter fuer Testphase und Live-Schaltung. Server-Routen respektieren diese Einstellung direkt.
          </div>
        </div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            background: settings.enabled ? 'rgba(16,185,129,.16)' : 'rgba(245,158,11,.14)',
            color: settings.enabled ? '#86efac' : '#fbbf24',
            border: `1px solid ${settings.enabled ? 'rgba(16,185,129,.28)' : 'rgba(245,158,11,.24)'}`,
          }}
        >
          {loading ? 'Lädt…' : settings.enabled ? 'AKTIV' : 'DEAKTIVIERT'}
        </div>
      </div>

      <ToggleRow
        settingKey="enabled"
        label="KI global ein/aus"
        desc="Wenn aus, werden keine KI-API-Routen mehr ausgefuehrt und es entstehen keine API-Kosten."
      />
      <ToggleRow
        settingKey="chatEnabled"
        label="Lager-KI / Tagesbericht"
        desc="Steuert den KI-Tagesbericht und Lager-Analysen ueber `/api/chat`."
      />
      <ToggleRow
        settingKey="documentEnabled"
        label="Dokument-KI"
        desc="Steuert Dokumentanalyse und Extraktion ueber `/api/document-ai`."
      />

      <div style={{ fontSize: 12, color: '#7f8da3', paddingTop: 12 }}>
        {savingKey ? 'Einstellung wird gespeichert…' : 'Empfehlung fuer die Testphase: global aus lassen und nur bei Bedarf gezielt aktivieren.'}
      </div>

      {/* Marketing-KI Module */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(245,158,11,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: compact ? 14 : 15, fontWeight: 900, color: '#fbbf24' }}>📣 Marketing-KI Module</h4>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>
              Offline = kein API-Aufruf, keine Kosten. Live schalten wenn bereit.
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
            background: (marketingSettings.contentDailyEnabled || marketingSettings.autopilotEnabled || marketingSettings.salesAssistantEnabled)
              ? 'rgba(245,158,11,.16)' : 'rgba(100,116,139,.14)',
            color: (marketingSettings.contentDailyEnabled || marketingSettings.autopilotEnabled || marketingSettings.salesAssistantEnabled)
              ? '#fbbf24' : '#94a3b8',
            border: '1px solid rgba(245,158,11,.2)',
          }}>
            {marketingLoading ? 'Lädt…'
              : [marketingSettings.contentDailyEnabled, marketingSettings.autopilotEnabled, marketingSettings.salesAssistantEnabled].filter(Boolean).length + '/3 AKTIV'}
          </div>
        </div>

        {([
          { key: 'contentDailyEnabled' as const, label: '📊 Was soll ich morgen posten?', desc: 'KI generiert tägl. Content-Idee aus Kampagnen + Keywords → /api/marketing/content-daily' },
          { key: 'autopilotEnabled' as const, label: '🚀 Autopilot-Marketing', desc: 'KI erstellt Strategie + nächsten Schritt aus Leads + Kampagnen → /api/marketing/autopilot' },
          { key: 'salesAssistantEnabled' as const, label: '🗣️ KI-Vertriebsassistent', desc: 'KI priorisiert Leads und generiert Follow-up-Texte → /api/marketing/sales-assistant' },
        ] as const).map(({ key, label, desc }) => {
          const checked = marketingSettings[key]
          const disabled = !enabled || marketingLoading || Boolean(savingMarketingKey)
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: compact ? '10px 0' : '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14, color: '#f8fbff' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{desc}</div>
              </div>
              <button
                onClick={() => handleMarketingToggle(key)}
                disabled={disabled}
                style={{
                  width: 48, height: 26, borderRadius: 999, border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  position: 'relative', flexShrink: 0,
                  opacity: disabled ? 0.6 : 1,
                  background: checked ? 'linear-gradient(135deg, #f59e0b, #f43f5e)' : 'rgba(255,255,255,.12)',
                  transition: 'background .2s, opacity .2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: checked ? 24 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 5px rgba(0,0,0,.35)',
                }} />
              </button>
            </div>
          )
        })}

        <div style={{ fontSize: 12, color: '#7f8da3', paddingTop: 10 }}>
          {savingMarketingKey ? 'Wird gespeichert…' : 'Jedes Modul ist unabhängig. Kosten nur bei aktivem Modul + API-Aufruf (~0,01–0,02 € / Run).'}
        </div>
      </div>

      {/* OpenAI Piloten-Tools */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(16,185,129,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: compact ? 14 : 15, fontWeight: 900, color: '#34d399' }}>✨ OpenAI Piloten-Tools</h4>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>
              Alle Tools sind standardmäßig deaktiviert. Aktivieren wenn bereit — Kosten nur bei Nutzung.
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
            background: Object.values(openAiTools).some(Boolean) ? 'rgba(16,185,129,.16)' : 'rgba(100,116,139,.14)',
            color: Object.values(openAiTools).some(Boolean) ? '#34d399' : '#94a3b8',
            border: '1px solid rgba(16,185,129,.2)',
          }}>
            {openAiLoading ? 'Lädt…' : `${Object.values(openAiTools).filter(Boolean).length}/4 AKTIV`}
          </div>
        </div>

        {([
          { key: 'steuerprognoseEnabled' as const, label: '📊 Steuerprognose', desc: 'KI berechnet Steuerprognose aus Umsatzdaten → AnalysePilot · /api/openai/steuerprognose' },
          { key: 'mahnungsgeneratorEnabled' as const, label: '📨 Mahnungsgenerator', desc: 'KI erstellt Mahnschreiben für überfällige Rechnungen → BüroPilot · /api/openai/mahnung' },
          { key: 'emailAssistentEnabled' as const, label: '✉️ E-Mail Assistent', desc: 'KI formuliert professionelle Antwort-E-Mails → BüroPilot KI-Tools · /api/openai/email-assistent' },
          { key: 'monatsberichtEnabled' as const, label: '📋 Monatsbericht Generator', desc: 'KI erstellt strukturierten Monatsbericht aus KPIs → AnalysePilot · /api/openai/monatsbericht' },
        ] as const).map(({ key, label, desc }) => {
          const checked = openAiTools[key]
          const disabled = !enabled || openAiLoading || Boolean(savingOpenAiKey)
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: compact ? '10px 0' : '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14, color: '#f8fbff' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{desc}</div>
              </div>
              <button
                onClick={() => void handleOpenAiToggle(key)}
                disabled={disabled}
                style={{
                  width: 48, height: 26, borderRadius: 999, border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  position: 'relative', flexShrink: 0,
                  opacity: disabled ? 0.6 : 1,
                  background: checked ? 'linear-gradient(135deg, #10b981, #20c8ff)' : 'rgba(255,255,255,.12)',
                  transition: 'background .2s, opacity .2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: checked ? 24 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 5px rgba(0,0,0,.35)',
                }} />
              </button>
            </div>
          )
        })}

        <div style={{ fontSize: 12, color: '#7f8da3', paddingTop: 10 }}>
          {savingOpenAiKey ? 'Wird gespeichert…' : 'Kosten ca. 0,001–0,005 € pro Aufruf (gpt-4o-mini).'}
        </div>
      </div>

      {/* QM-Pilot KI-Features */}
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(20,184,166,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: compact ? 14 : 15, fontWeight: 900, color: '#14b8a6' }}>🔬 QM-Pilot KI-Features</h4>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>
              Steuere OpenAI Vision für Zeichnungs-Analyse und Sichtprüfung im QM-Piloten.
            </div>
          </div>
          <div style={{
            padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
            background: (qmKiFlags.qm_ki_zeichnungs_analyse || qmKiFlags.qm_ki_sichtpruefung) ? 'rgba(20,184,166,.16)' : 'rgba(100,116,139,.14)',
            color: (qmKiFlags.qm_ki_zeichnungs_analyse || qmKiFlags.qm_ki_sichtpruefung) ? '#5eead4' : '#94a3b8',
            border: '1px solid rgba(20,184,166,.2)',
          }}>
            {qmFlagsLoading ? 'Lädt…' : `${[qmKiFlags.qm_ki_zeichnungs_analyse, qmKiFlags.qm_ki_sichtpruefung].filter(Boolean).length}/2 AKTIV`}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#5eead4', background: 'rgba(20,184,166,.06)', border: '1px solid rgba(20,184,166,.15)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          ℹ️ Inhaber- und Pondruff-Account haben automatisch Zugang — diese Toggles wirken nur für andere Kunden.
        </div>

        {/* Kunden-Auswahl */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#aeb9c8', display: 'block', marginBottom: 5 }}>Kunde auswählen</label>
          <select
            className="pk-input"
            value={selectedQmUserId}
            onChange={e => setSelectedQmUserId(e.target.value)}
            disabled={qmUsersLoading || qmUsers.length === 0}
            style={{ width: '100%', fontSize: 13 }}
          >
            {qmUsersLoading && <option value="">Lädt…</option>}
            {!qmUsersLoading && qmUsers.length === 0 && <option value="">Keine Kunden gefunden</option>}
            {qmUsers.map(u => (
              <option key={u.userId} value={u.userId}>
                {u.email}{u.isAutoAccount ? ' 🔒 Auto' : ''}
              </option>
            ))}
          </select>
        </div>

        {(() => {
          const selectedUser = qmUsers.find(u => u.userId === selectedQmUserId)
          const isAuto = selectedUser?.isAutoAccount ?? false

          return ([
            { key: 'qm_ki_zeichnungs_analyse' as const, label: '📐 Zeichnungs-Analyse', desc: 'gpt-4o-mini · ca. 0,002–0,005 € pro Analyse — Extrahiert Maße, Toleranzen, Material aus technischen Zeichnungen.' },
            { key: 'qm_ki_sichtpruefung' as const, label: '🔍 KI-Sichtprüfung', desc: 'gpt-4o (Vision) · ca. 0,005–0,010 € pro Foto — Erkennt Kratzer, Grate, Verschmutzung auf Bauteil-Fotos.' },
          ] as const).map(({ key, label, desc }) => {
            const checked = isAuto ? true : qmKiFlags[key]
            const disabled = !enabled || qmFlagsLoading || Boolean(savingQmKey) || isAuto
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: compact ? '10px 0' : '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14, color: '#f8fbff' }}>
                    {label}
                    {isAuto && <span style={{ marginLeft: 8, fontSize: 11, color: '#10b981', fontWeight: 800 }}>🔒 automatisch AN</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{desc}</div>
                </div>
                <button
                  onClick={() => void handleQmToggle(key)}
                  disabled={disabled}
                  title={isAuto ? 'Automatisch freigeschaltet — Toggle nicht nötig' : undefined}
                  style={{
                    width: 48, height: 26, borderRadius: 999, border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    position: 'relative', flexShrink: 0,
                    opacity: disabled ? (isAuto ? 1 : 0.6) : 1,
                    background: checked ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 'rgba(255,255,255,.12)',
                    transition: 'background .2s, opacity .2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: checked ? 24 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 5px rgba(0,0,0,.35)',
                  }} />
                </button>
              </div>
            )
          })
        })()}

        <div style={{ fontSize: 12, color: '#7f8da3', paddingTop: 10 }}>
          {savingQmKey ? 'Wird gespeichert…' : 'Default AUS für neue Kunden. Inhaber/Pondruff immer AN (Auto-Override).'}
        </div>
      </div>
    </div>
  )
}
