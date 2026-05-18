'use client'

const SKELETON_STYLE = `
@keyframes sk-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`

export default function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      <style>{SKELETON_STYLE}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'linear-gradient(180deg, rgba(16,26,40,.94), rgba(8,12,19,.94))',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ width: '80%', height: 22, borderRadius: 8, background: 'rgba(255,255,255,.06)', animation: 'sk-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ width: '50%', height: 14, borderRadius: 6, background: 'rgba(255,255,255,.06)', animation: 'sk-pulse 1.4s ease-in-out infinite 0.2s' }} />
        </div>
      ))}
    </>
  )
}
