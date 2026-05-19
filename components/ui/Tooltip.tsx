'use client'
import { useState, useRef } from 'react'

interface TooltipProps {
  content: string
  children?: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  const offset = 8
  const placementStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: offset },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: offset },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: offset },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: offset },
  }

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          zIndex: 9000,
          ...placementStyles[placement],
          background: '#1a2840',
          border: '1px solid rgba(255,255,255,.12)',
          color: '#f8fbff',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.5,
          borderRadius: 8,
          padding: '6px 10px',
          whiteSpace: 'nowrap',
          maxWidth: 260,
          whiteSpaceCollapse: 'preserve' as never,
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
          pointerEvents: 'none',
        }}>
          {content}
        </span>
      )}
    </span>
  )
}

export function HelpTooltip({ content, placement = 'top' }: { content: string; placement?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip content={content} placement={placement}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
          color: '#aeb9c8', fontSize: 10, fontWeight: 700, cursor: 'help',
          flexShrink: 0,
        }}
        tabIndex={0}
        role="img"
        aria-label={`Hilfe: ${content}`}
      >
        ?
      </span>
    </Tooltip>
  )
}
