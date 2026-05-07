'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import { getAppWarnings, type Warning } from '@/lib/warnings'

type Tab = 'alle' | 'error' | 'warn'

const TYPE_COLOR: Record<Warning['type'], string> = {
  error: '#f43f5e',
  warn: '#f59e0b',
  info: '#1684ff',
  success: '#25d366',
}

const TYPE_ICON: Record<Warning['type'], string> = {
  error: '🔴',
  warn: '⚠️',
  info: 'ℹ️',
  success: '✅',
}

const CAT_LABEL: Record<Warning['category'], string> = {
  lager: 'Lager',
  büro: 'Büro',
  werkstatt: 'Werkstatt',
  planung: 'Planung',
}

function formatTime(d: Date): string {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Gerade eben'
  if (mins < 60) return `Vor ${mins} Min.`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Vor ${hrs} Std.`
  return d.toLocaleDateString('de-DE')
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('alle')
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const isDemo = hasDemoCookie()
      const data = await getAppWarnings(isDemo)
      setWarnings(data)
    } catch {
      // Fehler beim Laden – leere Liste behalten
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + auto-refresh alle 60 Sekunden
  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(interval)
  }, [load])

  // Außenklick schließt Panel
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const alertCount = warnings.filter(
    w => (w.type === 'error' || w.type === 'warn') && !readIds.has(w.id)
  ).length

  const markAllRead = () => setReadIds(new Set(warnings.map(w => w.id)))
  const markRead = (id: string) => setReadIds(prev => {
    const next = new Set(prev)
    next.add(id)
    return next
  })

  const filtered = warnings.filter(w => {
    if (tab === 'error') return w.type === 'error'
    if (tab === 'warn') return w.type === 'warn'
    return true
  })

  const errorCount = warnings.filter(w => w.type === 'error').length
  const warnCount = warnings.filter(w => w.type === 'warn').length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 38, height: 38, borderRadius: 10,
          border: '1px solid rgba(255,255,255,.1)',
          background: open ? 'rgba(22,132,255,.15)' : 'rgba(255,255,255,.05)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
          transition: 'background .15s', fontSize: 18,
        }}
        title="Benachrichtigungen"
      >
        🔔
        {alertCount > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5,
            width: 16, height: 16, borderRadius: '50%',
            background: '#f43f5e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: 'white',
            border: '2px solid #0a1422',
          }}>{alertCount > 99 ? '99+' : alertCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, zIndex: 200,
          background: 'linear-gradient(180deg, #0d1e30, #080e18)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
          animation: 'fadeIn .15s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Systemwarnungen
              {alertCount > 0 && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(244,63,94,.15)', color: '#fb7185', fontWeight: 700,
                }}>{alertCount} aktiv</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => { void load() }}
                title="Neu laden"
                style={{
                  fontSize: 14, background: 'transparent', border: 'none',
                  color: '#6cb6ff', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: 6, lineHeight: 1,
                }}
              >↻</button>
              {alertCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: 11, color: '#6cb6ff', background: 'transparent',
                    border: 'none', cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >Alle gelesen</button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
          }}>
            {([
              { key: 'alle' as Tab, label: `Alle (${warnings.length})` },
              { key: 'error' as Tab, label: `🚨 Fehler (${errorCount})` },
              { key: 'warn' as Tab, label: `⚠️ Warnung (${warnCount})` },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: tab === t.key
                    ? 'rgba(22,132,255,.2)'
                    : 'rgba(255,255,255,.05)',
                  color: tab === t.key ? '#6cb6ff' : '#aeb9c8',
                  transition: 'background .15s',
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              // Skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  display: 'flex', gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(255,255,255,.06)', animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,.06)', width: '70%' }} />
                    <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,.04)', width: '90%' }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{
                padding: '32px 16px', textAlign: 'center',
                color: '#4a5568', fontSize: 13,
              }}>
                ✅ Keine Warnungen in dieser Kategorie
              </div>
            ) : (
              filtered.map(w => {
                const isRead = readIds.has(w.id)
                return (
                  <div
                    key={w.id}
                    style={{
                      padding: '11px 16px',
                      borderBottom: '1px solid rgba(255,255,255,.05)',
                      background: isRead ? 'transparent' : 'rgba(22,132,255,.04)',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(22,132,255,.04)')}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: TYPE_COLOR[w.type] + '18',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 15,
                      }}>{TYPE_ICON[w.type]}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            fontWeight: 700, fontSize: 12,
                            color: isRead ? '#aeb9c8' : '#f8fbff',
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{w.title}</span>
                          {!isRead && (
                            <span style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: '#1684ff', flexShrink: 0,
                            }} />
                          )}
                        </div>

                        <div style={{
                          fontSize: 11, color: '#aeb9c8', lineHeight: 1.4, marginBottom: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{w.desc}</div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 999,
                              background: 'rgba(255,255,255,.06)', color: '#6b7280',
                              fontWeight: 600,
                            }}>{CAT_LABEL[w.category]}</span>
                            <span style={{ fontSize: 10, color: '#4a5568' }}>{formatTime(w.timestamp)}</span>
                          </div>
                          {w.link && (
                            <a
                              href={w.link}
                              onClick={() => { markRead(w.id); setOpen(false) }}
                              style={{
                                fontSize: 11, color: '#1684ff', textDecoration: 'none',
                                fontWeight: 600, flexShrink: 0,
                              }}
                            >→ Öffnen</a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,.08)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#4a5568' }}>
              {loading ? 'Lade Warnungen…' : `${warnings.length} Warnungen · Auto-Refresh alle 60 s`}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  )
}
