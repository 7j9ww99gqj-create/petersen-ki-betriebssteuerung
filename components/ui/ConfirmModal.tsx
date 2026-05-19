'use client'
import * as React from 'react'
import { Modal } from './Modal'

export type ConfirmModalProps = {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Standard-Bestätigungs-Modal mit zwei Buttons.
 * Ersetzt ad-hoc `position:fixed inset:0`-Dialoge.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null
  const isDanger = variant === 'danger'
  return (
    <Modal title={title} onClose={loading ? () => {} : onCancel} maxWidth={460}>
      <div style={{ color: '#aeb9c8', fontSize: 14, marginBottom: 18, lineHeight: 1.5 }}>
        {message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button className="pk-btn-ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          className="pk-btn"
          onClick={onConfirm}
          disabled={loading}
          style={isDanger ? { background: '#dc2626', borderColor: '#dc2626' } : undefined}
        >
          {loading ? 'Läuft…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
