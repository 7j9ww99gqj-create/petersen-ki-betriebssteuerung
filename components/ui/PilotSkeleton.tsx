import { SkeletonCard, SkeletonLine } from './SkeletonCard'

export default function PilotSkeleton() {
  return (
    <div style={{ padding: '20px 16px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <SkeletonLine width={220} height={28} />
        <div style={{ marginTop: 8 }}>
          <SkeletonLine width={160} height={14} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
        {[100, 80, 90, 110].map((w, i) => (
          <SkeletonLine key={i} width={w} height={36} />
        ))}
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
      </div>

      {/* Main content */}
      <SkeletonCard height={320} />
    </div>
  )
}
