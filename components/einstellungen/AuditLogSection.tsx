'use client'
import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'

/**
 * AuditLogSection + CustomerInvoicePreview.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 2).
 */
export function AuditLogSection({ isInhaber, showToast, refreshKey = 0 }: { isInhaber: boolean; showToast: (msg: string, type?: 'error') => void; refreshKey?: number }) {
  const [logs, setLogs] = useState<{ id: string; action: string; actor_email?: string; target_email?: string; created_at: string; details?: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isInhaber) return
    setLoading(true)
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
  }, [isInhaber, refreshKey])

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

export function CustomerInvoicePreview({ userId, userEmail, onClose }: { userId: string; userEmail: string; onClose: () => void }) {
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
