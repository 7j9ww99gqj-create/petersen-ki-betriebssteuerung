'use client'

import { useEffect, useState } from 'react'
import { getAiFeatureSettings, updateAiFeatureSettings, type AiFeatureSettings } from '@/lib/db'

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

export function OwnerAiControlPanel({
  enabled,
  showToast,
  compact = false,
}: OwnerAiControlPanelProps) {
  const [settings, setSettings] = useState<AiFeatureSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<keyof AiFeatureSettings | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    getAiFeatureSettings()
      .then(setSettings)
      .catch(() => showToast?.('KI-Einstellungen konnten nicht geladen werden.', 'error'))
      .finally(() => setLoading(false))
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
    </div>
  )
}
