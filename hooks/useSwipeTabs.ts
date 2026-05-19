import { useEffect, useRef } from 'react'

// Tab-Swipe-Geste für Mobile — robust gegen Scroll/Modals/Inputs.
// Wechselt nur, wenn die horizontale Bewegung klar dominiert UND der Touch
// nicht in einem Modal/Eingabefeld oder einem scroll-fähigen Container begann.

export function useSwipeTabs(tabs: string[], currentTab: string, setTab: (t: string) => void) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const blocked = useRef(false)

  useEffect(() => {
    const isBlockedTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof Element)) return false
      // Modal offen? Dann Swipe komplett deaktivieren.
      if (document.querySelector('[role="dialog"], [data-modal-open="true"], [data-no-swipe-root="true"]')) return true
      // Touch innerhalb eines Modals / Form-Felds / interaktiven Elements
      if (el.closest('[role="dialog"], [data-no-swipe], input, textarea, select, button, a, label')) return true
      // Innere scrollbare Container blocken (Modal-Inhalte, scroll-wraps).
      // body/html ausnehmen — sonst löst Swipe nie auf der normalen Seite aus.
      let cur: Element | null = el
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur)
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cur.scrollWidth > cur.clientWidth) return true
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight) return true
        cur = cur.parentElement
      }
      return false
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startX.current = null; return }
      blocked.current = isBlockedTarget(e.target)
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const dx = startX.current - endX
      const dy = startY.current - endY
      startX.current = null
      startY.current = null
      if (blocked.current) { blocked.current = false; return }
      // Mindest-Distanz horizontal
      if (Math.abs(dx) < 90) return
      // Klar horizontale Bewegung: dx muss mind. 2× größer als dy sein
      if (Math.abs(dx) < Math.abs(dy) * 2) return
      const currentIndex = tabs.indexOf(currentTab)
      if (currentIndex < 0) return
      if (dx > 0 && currentIndex < tabs.length - 1) setTab(tabs[currentIndex + 1])
      else if (dx < 0 && currentIndex > 0) setTab(tabs[currentIndex - 1])
    }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [tabs, currentTab, setTab])
}
