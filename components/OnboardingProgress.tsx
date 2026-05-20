'use client'
// Wiederverwendbarer Fortschritts-Indikator für Onboarding-/Wizard-Flows.
// Additiv: bestehende components/OnboardingWizard.tsx bleibt unverändert,
// diese Komponente kann in neuen Flows oder als Drop-in für Verbesserungen
// importiert werden.

import React from 'react'

export interface OnboardingProgressStep {
  label: string
  icon?: React.ReactNode
  description?: string
}

export interface OnboardingProgressProps {
  steps: OnboardingProgressStep[]
  current: number
  variant?: 'dots' | 'bar' | 'numbered'
  accent?: string
  ariaLabel?: string
}

const DEFAULT_ACCENT = '#1684ff'
const DONE = '#10b981'
const MUTED = 'rgba(255,255,255,.10)'
const MUTED_TEXT = '#6c7a8c'

export function OnboardingProgress({
  steps,
  current,
  variant = 'numbered',
  accent = DEFAULT_ACCENT,
  ariaLabel = 'Fortschritt',
}: OnboardingProgressProps) {
  const total = steps.length || 1
  const pct = Math.min(100, Math.max(0, (current / Math.max(1, total - 1)) * 100))

  if (variant === 'bar') {
    return (
      <div role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={total - 1} aria-valuenow={current}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 8,
          fontSize: 12, color: '#aeb9c8', fontWeight: 600,
        }}>
          <span>Schritt {current + 1} von {total}</span>
          <span>{steps[current]?.label}</span>
        </div>
        <div style={{ height: 6, background: MUTED, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: `linear-gradient(90deg, ${accent}, #20c8ff)`,
            borderRadius: 999, transition: 'width .35s ease-out',
          }} />
        </div>
      </div>
    )
  }

  if (variant === 'dots') {
    return (
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={total - 1}
        aria-valuenow={current}
        style={{ display: 'flex', gap: 6, justifyContent: 'center' }}
      >
        {steps.map((_, i) => {
          const active = i === current
          const done = i < current
          return (
            <span
              key={i}
              style={{
                width: active ? 28 : 8,
                height: 8,
                borderRadius: 999,
                background: done ? DONE : active ? accent : MUTED,
                transition: 'width .25s ease, background .2s',
              }}
            />
          )
        })}
      </div>
    )
  }

  // numbered (default) — Circles + Connector Lines
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={current}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 0, width: '100%' }}
    >
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const isLast = i === total - 1
        const circleBg = done ? 'rgba(16,185,129,.18)' : active ? `${accent}22` : 'rgba(255,255,255,.04)'
        const circleBorder = done ? DONE : active ? accent : 'rgba(255,255,255,.10)'
        const circleColor = done ? DONE : active ? accent : MUTED_TEXT
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}>
              <div
                aria-current={active ? 'step' : undefined}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: circleBg,
                  border: `2px solid ${circleBorder}`,
                  color: circleColor,
                  fontWeight: 800, fontSize: 13,
                  transition: 'all .25s',
                  boxShadow: active ? `0 0 0 4px ${accent}1a` : 'none',
                }}
              >
                {done ? '✓' : s.icon ?? i + 1}
              </div>
              <div style={{
                marginTop: 6, fontSize: 11, fontWeight: active ? 700 : 500,
                color: active ? '#f8fbff' : MUTED_TEXT, textAlign: 'center',
                maxWidth: 80, lineHeight: 1.25,
              }}>
                {s.label}
              </div>
            </div>
            {!isLast && (
              <div
                aria-hidden
                style={{
                  flex: 1, height: 2, marginTop: 15,
                  background: done ? DONE : 'rgba(255,255,255,.08)',
                  transition: 'background .3s',
                  borderRadius: 1,
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default OnboardingProgress
