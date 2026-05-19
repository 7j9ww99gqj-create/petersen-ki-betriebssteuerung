'use client'

import { useCallback, useEffect, useState } from 'react'

type UsageData = {
  totalCostEur: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  dailyData: { date: string; costEur: number; requests: number }[]
  month: string
  fetchedDays: number
  cached_at?: string
  from_cache?: boolean
}

type Props = {
  enabled: boolean
}

const TOOL_PRICING = [
  {
    icon: '🧾',
    name: 'Dokument-KI',
    route: '/api/document-ai',
    model: 'gpt-4o-mini',
    costFrom: '~0,01',
    costTo: '0,03',
    unit: 'pro Dokument / Bild',
    details: 'Analyse von PDF, PNG, JPG, WEBP. Kosten steigen mit Bildgröße und Seitenanzahl.',
    color: '#20c8ff',
  },
  {
    icon: '💬',
    name: 'Lager-KI / Chat',
    route: '/api/chat',
    model: 'gpt-4o-mini',
    costFrom: '~0,01',
    costTo: '0,02',
    unit: 'pro Anfrage',
    details: 'KI-Tagesbericht, Chat-Anfragen mit Lagerdaten als Kontext.',
    color: '#1684ff',
  },
  {
    icon: '📊',
    name: 'Was soll ich morgen posten?',
    route: '/api/marketing/content-daily',
    model: 'gpt-4o-mini',
    costFrom: '~0,01',
    costTo: '0,02',
    unit: 'pro Run',
    details: 'KI generiert tägl. Content-Idee aus Kampagnen + Keywords.',
    color: '#f59e0b',
  },
  {
    icon: '🚀',
    name: 'Autopilot-Marketing',
    route: '/api/marketing/autopilot',
    model: 'gpt-4o-mini',
    costFrom: '~0,02',
    costTo: '0,05',
    unit: 'pro Run',
    details: 'KI erstellt Strategie + nächsten Schritt aus Leads + Kampagnen. Mehr Kontext = höhere Kosten.',
    color: '#f59e0b',
  },
  {
    icon: '🗣️',
    name: 'KI-Vertriebsassistent',
    route: '/api/marketing/sales-assistant',
    model: 'gpt-4o-mini',
    costFrom: '~0,01',
    costTo: '0,03',
    unit: 'pro Run',
    details: 'KI priorisiert Leads und generiert Follow-up-Texte.',
    color: '#f59e0b',
  },
  {
    icon: '📄',
    name: 'Angebot generieren',
    route: '/api/generate-angebot',
    model: 'claude-haiku',
    costFrom: '~0,001',
    costTo: '0,005',
    unit: 'pro Angebot',
    details: 'Claude Haiku (Anthropic) – günstigstes Modell. Kaum messbare Kosten.',
    color: '#a78bfa',
  },
  {
    icon: '🧾',
    name: 'OCR Beleg-Erkennung',
    route: '/api/ocr-beleg',
    model: 'claude-haiku',
    costFrom: '~0,002',
    costTo: '0,01',
    unit: 'pro Beleg',
    details: 'Claude Haiku OCR für Steuerbelege. Sehr günstig.',
    color: '#a78bfa',
  },
]

function formatEur(val: number) {
  return val.toFixed(4).replace('.', ',') + ' €'
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + ' k'
  return String(n)
}

export function OwnerOpenAiCostsPanel({ enabled }: Props) {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const loadUsage = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/owner/openai-usage${forceRefresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Fehler beim Laden der OpenAI-Nutzung.')
      }
      const json = await res.json() as UsageData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void loadUsage(false)
  }, [enabled, loadUsage])

  if (!enabled) return null

  const now = new Date()
  const monthLabel = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  // Bar chart: max cost per day for scaling
  const maxDayCost = data ? Math.max(...data.dailyData.map(d => d.costEur), 0.001) : 0.001

  return (
    <div
      className="pk-card"
      style={{
        borderColor: 'rgba(22,132,255,.2)',
        background: 'linear-gradient(180deg, rgba(8,16,30,.98), rgba(5,10,20,.98))',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
            <span style={{ marginRight: 8 }}>🤖</span>OpenAI Kostenübersicht
          </h3>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>
            Live-Auswertung Ihrer KI-API-Ausgaben — {monthLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void loadUsage(true)}
            disabled={loading}
            className="pk-btn-ghost"
            style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? '⏳ Lädt…' : '🔄 Neu laden'}
          </button>
          <a
            href="https://platform.openai.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="pk-btn-ghost"
            style={{ fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            OpenAI Dashboard ↗
          </a>
        </div>
      </div>

      {/* Cache-Hinweis */}
      {data?.cached_at && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
          {data.from_cache ? '📦 Aus Cache · ' : '🟢 Frisch · '}
          Stand {new Date(data.cached_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Cost KPIs */}
      {loading && !data && (
        <div style={{ color: '#aeb9c8', fontSize: 13, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
            border: '2px solid rgba(22,132,255,.25)', borderTopColor: '#1684ff',
            animation: 'spin 0.8s linear infinite',
          }} />
          Lade Nutzungsdaten von OpenAI…
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', color: '#fca5a5', fontSize: 13 }}>
          {error} — Bitte direkt im{' '}
          <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd' }}>
            OpenAI Dashboard
          </a>{' '}
          prüfen.
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              {
                label: `Kosten ${monthLabel}`,
                value: formatEur(data.totalCostEur),
                icon: '💶',
                color: data.totalCostEur > 5 ? '#f43f5e' : data.totalCostEur > 1 ? '#f59e0b' : '#10b981',
              },
              {
                label: 'API-Aufrufe gesamt',
                value: data.totalRequests.toLocaleString('de-DE'),
                icon: '📡',
                color: '#1684ff',
              },
              {
                label: 'Input-Tokens',
                value: formatTokens(data.totalInputTokens),
                icon: '📥',
                color: '#20c8ff',
              },
              {
                label: 'Output-Tokens',
                value: formatTokens(data.totalOutputTokens),
                icon: '📤',
                color: '#a78bfa',
              },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${item.color}22`,
                  display: 'flex', gap: 10, alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: '#8ba0b8' }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Daily bar chart */}
          {data.dailyData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8, fontWeight: 700 }}>Tageskosten (EUR)</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 48 }}>
                {data.dailyData.map(day => {
                  const pct = Math.max((day.costEur / maxDayCost) * 100, day.costEur > 0 ? 4 : 1)
                  const dayNum = new Date(day.date).getDate()
                  return (
                    <div key={day.date} title={`${day.date}: ${formatEur(day.costEur)} (${day.requests} Anfragen)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', borderRadius: 3,
                        height: `${pct}%`,
                        minHeight: day.costEur > 0 ? 3 : 1,
                        background: day.costEur > 0 ? 'linear-gradient(180deg, #1684ff, #20c8ff88)' : 'rgba(255,255,255,.06)',
                        transition: 'height .3s',
                      }} />
                      {data.dailyData.length <= 20 && (
                        <div style={{ fontSize: 9, color: '#4b5a6e' }}>{dayNum}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#4b5a6e', marginBottom: 16 }}>
            Basiert auf OpenAI Usage-API · Kosten in EUR (Umrechnungskurs ~0,92) · Modell: gpt-4o-mini
          </div>
        </>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', marginBottom: 14, paddingTop: 14 }}>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: '#f8fbff' }}>
            Preisübersicht je KI-Tool
          </div>
          <div style={{ marginLeft: 'auto', color: '#aeb9c8', fontSize: 16, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</div>
        </button>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
          Richtwerte · tatsächliche Kosten hängen von Tokenmenge ab
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'grid', gap: 8 }}>
          {TOOL_PRICING.map(tool => (
            <div
              key={tool.name}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,.025)', border: `1px solid ${tool.color}18`,
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${tool.color}14`, border: `1px solid ${tool.color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {tool.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#f8fbff' }}>{tool.name}</span>
                  <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{tool.route}</span>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{tool.model}</span>
                </div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{tool.details}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: tool.color }}>
                  {tool.costFrom} €
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{tool.unit}</div>
              </div>
            </div>
          ))}

          {/* Hinweis */}
          <div style={{
            marginTop: 4, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)',
            fontSize: 12, color: '#6ee7b7', lineHeight: 1.5,
          }}>
            <strong style={{ color: '#4ddb7e' }}>Kosten senken:</strong> Im KI-Funktionen-Panel oben Module deaktivieren. Jedes ausgeschaltete Modul erzeugt keinerlei API-Kosten. Dokument-KI und Chat sind die häufigsten Kostentreiber.
          </div>
        </div>
      )}
    </div>
  )
}
