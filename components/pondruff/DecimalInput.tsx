'use client'
import { useEffect, useRef, useState } from 'react'
import { parseDecimal, formatDecimalDe } from '@/lib/pondruff'

// Komma-tauglicher Decimal-Input: erlaubt "4,4" und "4.4", zeigt deutsch mit Komma.
// Während des Tippens bleibt die Roh-Eingabe stehen (auch unvollständig wie "4,").
// onChange feuert mit der geparsten Zahl. Bei Blur wird der Wert normalisiert.
export function DecimalInput({
  value,
  onChange,
  min = 0,
  max,
  placeholder,
  className = 'pk-input',
  decimals,
  keepZero = false,
  style,
  disabled,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  placeholder?: string
  className?: string
  decimals?: number
  keepZero?: boolean
  style?: React.CSSProperties
  disabled?: boolean
}) {
  const [text, setText] = useState<string>(() => formatDecimalDe(value, { keepZero, decimals }))
  const focused = useRef(false)

  // Externer Wert hat sich geändert (z.B. OCR-Befüllung) -> Anzeige aktualisieren,
  // aber nicht während der User tippt.
  useEffect(() => {
    if (focused.current) return
    setText(formatDecimalDe(value, { keepZero, decimals }))
  }, [value, keepZero, decimals])

  function commit(raw: string) {
    let n = parseDecimal(raw)
    if (typeof min === 'number' && n < min) n = min
    if (typeof max === 'number' && n > max) n = max
    onChange(n)
  }

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      value={text}
      onFocus={() => { focused.current = true }}
      onChange={(e) => {
        // Nur Ziffern, Komma, Punkt, Minus zulassen
        const v = e.target.value.replace(/[^\d.,\-]/g, '')
        setText(v)
        commit(v)
      }}
      onBlur={() => {
        focused.current = false
        const n = parseDecimal(text)
        const clamped = typeof min === 'number' && n < min ? min
          : typeof max === 'number' && n > max ? max
          : n
        if (clamped !== n) onChange(clamped)
        setText(formatDecimalDe(clamped, { keepZero, decimals }))
      }}
    />
  )
}
