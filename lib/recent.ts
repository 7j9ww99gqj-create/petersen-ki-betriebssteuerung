export type RecentItem = {
  href: string
  label: string
  icon: string
  visitedAt: number
}

export function trackVisit(item: Omit<RecentItem, 'visitedAt'>) {
  if (typeof window === 'undefined') return
  const key = 'pk_recent_visits'
  const existing: RecentItem[] = JSON.parse(localStorage.getItem(key) || '[]')
  const filtered = existing.filter(e => e.href !== item.href)
  const updated = [{ ...item, visitedAt: Date.now() }, ...filtered].slice(0, 8)
  localStorage.setItem(key, JSON.stringify(updated))
}

export function getRecentVisits(): RecentItem[] {
  if (typeof window === 'undefined') return []
  return JSON.parse(localStorage.getItem('pk_recent_visits') || '[]')
}
