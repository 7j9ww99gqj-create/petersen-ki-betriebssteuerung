'use client'
// M6: Toggle zwischen klassischem Design (v1) und neuem Design (v2).
// Additiv: wird per Import in einstellungen/page.tsx hinzugefügt, ersetzt nichts.

import { useDesignV2, setDesignV2 } from '@/lib/design-flag'

export default function DesignV2Toggle() {
  const v2 = useDesignV2()

  const toggle = () => setDesignV2(!v2)

  return (
    <div className="pk-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ✨ Neues Design (Beta)
          </div>
          <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.55, marginBottom: 10 }}>
            Tausche Emoji-Icons gegen professionelle SVG-Icons (Lucide), aktiviere das
            neue Vektor-Logo, illustrierte Leerzustände und sanfte Modal-Animationen.
            Du kannst jederzeit zurück wechseln.
          </div>
          <div style={{ fontSize: 11, color: v2 ? '#4ddb7e' : '#aeb9c8', fontWeight: 600 }}>
            Status: {v2 ? '● Aktiviert' : '○ Deaktiviert (klassisches Design)'}
          </div>
          <div style={{ fontSize: 11, color: '#6c7a8c', marginTop: 6 }}>
            Tipp: Mit <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=v2</code> oder <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 4 }}>?design=v1</code> in der URL überall umschaltbar.
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={v2}
          onClick={toggle}
          style={{
            position: 'relative',
            width: 56, height: 30,
            borderRadius: 999,
            border: '1px solid ' + (v2 ? 'rgba(22,132,255,.6)' : 'rgba(255,255,255,.18)'),
            background: v2 ? 'rgba(22,132,255,.45)' : 'rgba(255,255,255,.08)',
            cursor: 'pointer',
            transition: 'background .2s, border-color .2s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: v2 ? 28 : 3,
              width: 22, height: 22,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,.3)',
              transition: 'left .2s ease',
            }}
          />
        </button>
      </div>
    </div>
  )
}
