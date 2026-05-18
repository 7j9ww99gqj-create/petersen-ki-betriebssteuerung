'use client'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aeb9c8' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fbff', marginBottom: description ? 8 : 0 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: actionLabel ? 20 : 0 }}>{description}</div>}
      {actionLabel && onAction && (
        <button className="pk-btn" onClick={onAction} style={{ marginTop: 4 }}>{actionLabel}</button>
      )}
    </div>
  )
}
