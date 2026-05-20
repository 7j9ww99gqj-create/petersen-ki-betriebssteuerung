'use client'
// Petersen KI Brand-Logo als reine SVG-Komponente.
// Additiv — bestehende /pondruff/banner.png, app-icon.png usw. bleiben.
// Verwendung: <Logo /> oder <Logo variant="mark" /> oder <Logo variant="wordmark" />.

import React from 'react'

export type LogoVariant = 'full' | 'mark' | 'wordmark'

export interface LogoProps {
  variant?: LogoVariant
  height?: number
  className?: string
  style?: React.CSSProperties
  title?: string
}

const BRAND_BLUE = '#1684ff'
const BRAND_BLUE_LIGHT = '#20c8ff'
const TEXT = '#f8fbff'

function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Petersen KI"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="pkLogoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={BRAND_BLUE} />
          <stop offset="1" stopColor={BRAND_BLUE_LIGHT} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#pkLogoGrad)" />
      <path
        d="M16 14h9.5c4.7 0 7.5 2.7 7.5 6.6 0 3.9-2.9 6.6-7.5 6.6H20V34h-4V14zm9.1 9.4c2.5 0 3.9-1 3.9-2.8s-1.4-2.8-3.9-2.8H20v5.6h5.1z"
        fill="#ffffff"
      />
      <circle cx="34" cy="34" r="4" fill="#ffffff" opacity="0.95" />
    </svg>
  )
}

function Wordmark({ height = 22, color = TEXT }: { height?: number; color?: string }) {
  return (
    <svg
      height={height}
      viewBox="0 0 230 36"
      role="img"
      aria-label="Petersen KI"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="26"
        fontFamily="Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        fontWeight="800"
        fontSize="26"
        letterSpacing="-0.5"
        fill={color}
      >
        Petersen
      </text>
      <text
        x="138"
        y="26"
        fontFamily="Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        fontWeight="800"
        fontSize="26"
        letterSpacing="-0.3"
        fill={BRAND_BLUE_LIGHT}
      >
        KI
      </text>
    </svg>
  )
}

export function Logo({ variant = 'full', height = 32, className, style, title }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span className={className} style={style} title={title}>
        <Mark size={height} />
      </span>
    )
  }
  if (variant === 'wordmark') {
    return (
      <span className={className} style={style} title={title}>
        <Wordmark height={height * 0.7} />
      </span>
    )
  }
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, ...style }}
      title={title}
    >
      <Mark size={height} />
      <Wordmark height={height * 0.7} />
    </span>
  )
}

export default Logo
