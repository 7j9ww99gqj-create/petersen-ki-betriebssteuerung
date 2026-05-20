'use client'
// Petersen KI Brand-Logo.
// - mark / full  → echtes Marken-PNG aus /public/logo.png (Hexagon mit „P")
// - wordmark     → reines SVG-Text-Logo („Petersen KI")
// Verwendung: <Logo /> oder <Logo variant="mark" /> oder <Logo variant="wordmark" />.

import React from 'react'
import Image from 'next/image'

export type LogoVariant = 'full' | 'mark' | 'wordmark'

export interface LogoProps {
  variant?: LogoVariant
  height?: number
  className?: string
  style?: React.CSSProperties
  title?: string
}

const BRAND_BLUE_LIGHT = '#20c8ff'
const TEXT = '#f8fbff'

// Echtes PNG-Logo aus /public/logo.png (transparenter Hintergrund wird via CSS gerundet)
function Mark({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <Image
        src="/logo.png"
        alt="Petersen KI"
        width={size}
        height={size}
        priority
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </span>
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
