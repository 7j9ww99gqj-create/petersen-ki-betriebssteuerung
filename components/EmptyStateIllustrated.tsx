'use client'
// Erweiterter Leerzustand mit SVG-Illustrationen.
// Additiv zu bestehender components/EmptyState.tsx — alte Komponente bleibt unverändert.
// Verwendung: <EmptyStateIllustrated kind="lager" title="Noch keine Artikel" />

import React from 'react'

export type EmptyKind =
  | 'lager'
  | 'buero'
  | 'werkstatt'
  | 'marketing'
  | 'analyse'
  | 'planung'
  | 'steuer'
  | 'qm'
  | 'cloud'
  | 'archiv'
  | 'suche'
  | 'allgemein'

export interface EmptyStateIllustratedProps {
  kind?: EmptyKind
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

const ACCENTS: Record<EmptyKind, string> = {
  lager: '#1684ff',
  buero: '#20c8ff',
  werkstatt: '#a78bfa',
  marketing: '#f59e0b',
  analyse: '#10b981',
  planung: '#f43f5e',
  steuer: '#facc15',
  qm: '#14b8a6',
  cloud: '#38bdf8',
  archiv: '#94a3b8',
  suche: '#60a5fa',
  allgemein: '#1684ff',
}

function Illustration({ kind }: { kind: EmptyKind }) {
  const color = ACCENTS[kind]
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="img"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', margin: '0 auto 18px auto' }}
    >
      <defs>
        <linearGradient id={`emptyGrad-${kind}`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill={`url(#emptyGrad-${kind})`} />
      <circle cx="60" cy="60" r="40" fill="none" stroke={color} strokeOpacity="0.25" strokeDasharray="3 4" />
      <g stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'lager' && (
          <>
            <rect x="42" y="48" width="36" height="28" rx="2" />
            <path d="M42 58h36" />
            <path d="M58 48v-6h4v6" />
          </>
        )}
        {kind === 'buero' && (
          <>
            <rect x="44" y="50" width="32" height="26" rx="2" />
            <path d="M52 50V44h16v6" />
            <path d="M44 60h32" />
          </>
        )}
        {kind === 'werkstatt' && (
          <>
            <path d="M50 70l-6-6 14-14 6 6z" />
            <path d="M62 56l8-8 4 4-8 8" />
          </>
        )}
        {kind === 'marketing' && (
          <>
            <path d="M44 60l28-10v22z" />
            <path d="M50 62v6a3 3 0 006 0v-4" />
          </>
        )}
        {kind === 'analyse' && (
          <>
            <path d="M44 76V52" />
            <path d="M44 76h36" />
            <path d="M52 70v-10M60 70v-16M68 70v-6M76 70v-12" />
          </>
        )}
        {kind === 'planung' && (
          <>
            <rect x="44" y="48" width="32" height="28" rx="2" />
            <path d="M52 44v8M68 44v8M44 58h32" />
          </>
        )}
        {kind === 'steuer' && (
          <>
            <rect x="46" y="46" width="28" height="32" rx="2" />
            <path d="M52 56h16M52 62h16M52 68h10" />
          </>
        )}
        {kind === 'qm' && (
          <>
            <path d="M60 44l14 6v10c0 9-6 15-14 18-8-3-14-9-14-18V50z" />
            <path d="M54 60l5 5 9-9" />
          </>
        )}
        {kind === 'cloud' && (
          <>
            <path d="M50 68a8 8 0 010-16 10 10 0 0119-3 7 7 0 011 14z" />
          </>
        )}
        {kind === 'archiv' && (
          <>
            <rect x="42" y="50" width="36" height="8" rx="1" />
            <rect x="46" y="58" width="28" height="20" rx="1" />
            <path d="M54 66h12" />
          </>
        )}
        {kind === 'suche' && (
          <>
            <circle cx="56" cy="56" r="10" />
            <path d="M64 64l8 8" />
          </>
        )}
        {kind === 'allgemein' && (
          <>
            <circle cx="60" cy="60" r="14" />
            <path d="M60 54v10M60 66h.01" />
          </>
        )}
      </g>
    </svg>
  )
}

export function EmptyStateIllustrated({
  kind = 'allgemein',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateIllustratedProps) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px', color: '#aeb9c8' }} role="status">
      <Illustration kind={kind} />
      <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fbff', marginBottom: description ? 8 : 0 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: '#aeb9c8', maxWidth: 360, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {(actionLabel || secondaryLabel) && (
        <div style={{ display: 'inline-flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actionLabel && onAction && (
            <button className="pk-btn" onClick={onAction}>{actionLabel}</button>
          )}
          {secondaryLabel && onSecondary && (
            <button className="pk-btn-ghost" onClick={onSecondary}>{secondaryLabel}</button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyStateIllustrated
