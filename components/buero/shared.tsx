'use client'
import React from 'react'
import type { Tab, Angebot, Auftrag, Rechnung, EingangsrechnungStatus } from '@/types/buero'
import { Modal as BaseModal, DeleteConfirm as BaseDeleteConfirm } from '@/components/ui/Modal'

export { BaseModal as Modal, BaseDeleteConfirm as DeleteConfirm }

export function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'kunden', label: '👥 Kunden' },
    { id: 'angebote', label: '📋 Angebote' },
    { id: 'auftraege', label: '✅ Aufträge' },
    { id: 'rechnungen', label: '💶 Rechnungen' },
    { id: 'eingangsrechnungen', label: '📥 Eingangsrechnungen' },
    { id: 'dokumente', label: '🗂️ Dokumente' },
    { id: 'einkauf', label: '🏭 Einkauf / Lieferanten' },
    { id: 'zeiterfassung', label: '🕐 Zeiterfassung' },
    { id: 'lieferanten', label: '🏪 Lieferanten' },
    { id: 'artikel', label: '📦 Artikel' },
    { id: 'alerts', label: '⚠️ Alerts' },
    { id: 'pipeline', label: '🔀 Pipeline' },
    { id: 'ki-tools', label: '🤖 KI-Tools' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, overflowX: 'auto' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          background: 'transparent', borderBottom: tab === t.id ? '2px solid #20c8ff' : '2px solid transparent',
          color: tab === t.id ? '#20c8ff' : '#aeb9c8', marginBottom: -1, transition: 'color .15s', whiteSpace: 'nowrap',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// Fixed-position Toast (bottom-right)
export function Toast({ msg, error }: { msg: string; error?: boolean }) {
  if (!msg) return null
  // .pk-toast-Klasse → Position/Animation/Größe aus User-Prefs (globals.css)
  return (
    <div className="pk-toast" style={{
      background: error ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${error ? 'rgba(255,80,80,.3)' : 'rgba(37,211,102,.3)'}`,
      color: error ? '#ff8080' : '#4ddb7e',
    }}>{msg}</div>
  )
}

// Modal + DeleteConfirm sind oben aus components/ui/Modal re-exportiert.

export function StatusBadgeAngebot({ status }: { status: Angebot['status'] }) {
  const map = {
    Entwurf: 'badge-gray',
    Erstellt: 'badge-orange',
    Versendet: 'badge-blue',
    Akzeptiert: 'badge-green',
    Abgelehnt: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

export function StatusBadgeAuftrag({ status }: { status: Auftrag['status'] }) {
  const map = {
    'AB erforderlich': 'badge-orange',
    'AB erstellt': 'badge-blue',
    'AB versendet': 'badge-green',
    'In Bearbeitung': 'badge-blue',
    Abgeschlossen: 'badge-green',
    Geplant: 'badge-gray',
    Pausiert: 'badge-orange',
  }
  return <span className={`badge ${map[status]}`}>{status}</span>
}

export function StatusBadgeRechnung({ status }: { status: Rechnung['status'] }) {
  const map = {
    Erstellt: 'badge-orange',
    Offen: 'badge-blue',
    Bezahlt: 'badge-green',
    Überfällig: 'badge-orange',
    Mahnung: 'badge-gray',
  }
  const icons = { Erstellt: '📝', Offen: '⏳', Bezahlt: '✅', Überfällig: '⚠️', Mahnung: '📮' }
  return <span className={`badge ${map[status]}`}>{icons[status]} {status}</span>
}

export function StatusBadgeEingangsrechnung({ status }: { status: EingangsrechnungStatus }) {
  const map: Record<EingangsrechnungStatus, string> = {
    offen: 'badge-blue',
    geprüft: 'badge-gray',
    freigegeben: 'badge-orange',
    bezahlt: 'badge-green',
    überfällig: 'badge-red',
    abgelehnt: 'badge-gray',
  }
  const icons: Record<EingangsrechnungStatus, string> = {
    offen: '⏳',
    geprüft: '🔎',
    freigegeben: '✅',
    bezahlt: '💚',
    überfällig: '⚠️',
    abgelehnt: '✕',
  }
  return <span className={`badge ${map[status]}`}>{icons[status]} {status}</span>
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#aeb9c8', minWidth: 32 }}>{value}%</span>
    </div>
  )
}

export const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }
