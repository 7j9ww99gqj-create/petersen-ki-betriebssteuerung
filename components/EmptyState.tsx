'use client'
import { usePathname } from 'next/navigation'
import { useDesignV2 } from '@/lib/design-flag'
import { EmptyStateIllustrated, type EmptyKind } from './EmptyStateIllustrated'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  /** Optional: explizite Empty-Kind für Design-V2-Illustration. Sonst aus Pathname abgeleitet. */
  kind?: EmptyKind
}

// Pathname → Empty-Kind Mapping (für Auto-Detect im v2-Modus).
function detectKind(pathname: string | null): EmptyKind {
  if (!pathname) return 'allgemein'
  if (pathname.includes('/lager')) return 'lager'
  if (pathname.includes('/buero')) return 'buero'
  if (pathname.includes('/werkstatt')) return 'werkstatt'
  if (pathname.includes('/marketing')) return 'marketing'
  if (pathname.includes('/analyse')) return 'analyse'
  if (pathname.includes('/planung')) return 'planung'
  if (pathname.includes('/steuer')) return 'steuer'
  if (pathname.includes('/qm')) return 'qm'
  if (pathname.includes('/cloud')) return 'cloud'
  if (pathname.includes('/archiv')) return 'archiv'
  return 'allgemein'
}

export default function EmptyState({ icon, title, description, actionLabel, onAction, kind }: EmptyStateProps) {
  const v2 = useDesignV2()
  const pathname = usePathname()

  if (v2) {
    return (
      <EmptyStateIllustrated
        kind={kind ?? detectKind(pathname)}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    )
  }

  // Klassisches Verhalten (v1 default) — unverändert.
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
