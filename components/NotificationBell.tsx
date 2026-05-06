'use client'
import { useState, useEffect, useRef } from 'react'

type Notification = {
  id: number; type: 'info' | 'warn' | 'success' | 'error'; title: string; desc: string; time: string; read: boolean
}

const initialNotifications: Notification[] = [
  { id: 1, type: 'warn', title: 'Niedriger Bestand', desc: 'Hydrauliköl HLP46 – nur noch 8 Liter auf Lager', time: 'Vor 5 Min.', read: false },
  { id: 2, type: 'success', title: 'Wareneingang gebucht', desc: '50× Stahlrohr 40x40 auf A-01-03 eingelagert', time: 'Vor 12 Min.', read: false },
  { id: 3, type: 'info', title: 'Cloud-Sync abgeschlossen', desc: 'Alle 6 Piloten erfolgreich synchronisiert', time: 'Vor 2 Std.', read: false },
  { id: 4, type: 'warn', title: 'Überfällige Rechnung', desc: 'RE-2025-077 (Schmidt & Partner) seit 8 Tagen offen', time: 'Heute 09:14', read: true },
  { id: 5, type: 'success', title: 'KI-Erkennung fertig', desc: 'Lieferschein_A-2025-033.pdf wurde automatisch verarbeitet', time: 'Gestern 17:42', read: true },
]

const typeIcon: Record<Notification['type'], string> = { info: 'ℹ️', warn: '⚠️', success: '✅', error: '🔴' }
const typeColor: Record<Notification['type'], string> = {
  info: '#1684ff', warn: '#f59e0b', success: '#25d366', error: '#f43f5e',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>(initialNotifications)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  const markRead = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.1)',
          background: open ? 'rgba(22,132,255,.15)' : 'rgba(255,255,255,.05)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'background .15s',
          fontSize: 18,
        }}
        title="Benachrichtigungen"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 5, right: 5, width: 16, height: 16,
            borderRadius: '50%', background: '#f43f5e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: 'white',
            border: '2px solid #0a1422',
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, zIndex: 200,
          background: 'linear-gradient(180deg, #0d1e30, #080e18)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
          animation: 'fadeIn .15s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>
              Benachrichtigungen
              {unread > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(244,63,94,.15)', color: '#fb7185', fontWeight: 700 }}>
                  {unread} neu
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: '#6cb6ff', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600,
              }}>Alle gelesen</button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  cursor: 'pointer',
                  background: n.read ? 'transparent' : 'rgba(22,132,255,.04)',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(22,132,255,.04)')}
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: typeColor[n.type] + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>{typeIcon[n.type]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</span>
                      {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1684ff', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.4 }}>{n.desc}</div>
                    <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{n.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,.08)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#4a5568' }}>Letzte 5 System-Meldungen</span>
          </div>
        </div>
      )}
    </div>
  )
}
