'use client'

import * as React from 'react'

export type ModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export function Modal({ title, onClose, children, maxWidth = 600 }: ModalProps) {
  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-no-swipe="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
    >
      <div
        className="pk-card fade-in"
        data-no-swipe="true"
        style={{
          width: '100%', maxWidth,
          maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
          position: 'relative', margin: 'auto 0',
        }}
        role="presentation"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export type DeleteConfirmProps = {
  label: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirm({ label, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div
      role="presentation"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
        borderRadius: 8, background: 'rgba(255,80,80,.08)',
        border: '1px solid rgba(255,80,80,.2)',
      }}
    >
      <span style={{ fontSize: 12, color: '#ff8080', fontWeight: 600 }}>{label} löschen?</span>
      <button
        onClick={e => { e.stopPropagation(); onConfirm() }}
        style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 999,
          border: '1px solid rgba(255,80,80,.4)',
          background: 'rgba(255,80,80,.15)', color: '#ff8080',
          cursor: 'pointer', fontWeight: 700,
        }}
      >
        Ja
      </button>
      <button
        onClick={e => { e.stopPropagation(); onCancel() }}
        style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 999,
          border: '1px solid rgba(255,255,255,.1)',
          background: 'transparent', color: '#aeb9c8', cursor: 'pointer',
        }}
      >
        Nein
      </button>
    </div>
  )
}
