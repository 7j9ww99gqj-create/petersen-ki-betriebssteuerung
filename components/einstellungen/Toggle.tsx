'use client'

/**
 * Wiederverwendbarer iOS-Style-Toggle.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 1).
 */
export function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean
  onChange: () => void
  label: string
  desc?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0',
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={onChange}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          background: checked ? 'linear-gradient(135deg, #1684ff, #005bea)' : 'rgba(255,255,255,.1)',
          transition: 'background .2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'white',
            transition: 'left .2s',
            boxShadow: '0 1px 4px rgba(0,0,0,.3)',
          }}
        />
      </button>
    </div>
  )
}
