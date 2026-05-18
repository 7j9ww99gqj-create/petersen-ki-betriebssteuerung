import { useEffect, useRef } from 'react'

export function useSwipeTabs(tabs: string[], currentTab: string, setTab: (t: string) => void) {
  const startX = useRef<number | null>(null)

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (startX.current === null) return
      const diff = startX.current - e.changedTouches[0].clientX
      if (Math.abs(diff) < 60) return
      const currentIndex = tabs.indexOf(currentTab)
      if (diff > 0 && currentIndex < tabs.length - 1) {
        setTab(tabs[currentIndex + 1])
      } else if (diff < 0 && currentIndex > 0) {
        setTab(tabs[currentIndex - 1])
      }
      startX.current = null
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [tabs, currentTab, setTab])
}
