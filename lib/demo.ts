/**
 * Demo-Mode-Helfer.
 *
 * Hintergrund: Demo-User (Cookie `pk_demo=1`) sollen keine echten Supabase-Calls
 * auslösen. Bisheriges Muster: `if (isDemo) return` vor jedem Aufruf — fehleranfällig,
 * weil eine vergessene Stelle live in DB schreibt. Diese Helfer kapseln die Prüfung.
 *
 * Nutze sie in NEUEM Code. Bestehende `if (isDemo) return`-Stellen bleiben
 * unverändert (Bricht-Risiko zu hoch bei flächendeckender Migration).
 */

import { hasDemoCookie } from './auth'

/**
 * Führt fn nur aus, wenn der Nutzer KEIN Demo-User ist.
 * Im Demo-Modus wird `demoFallback` synchron oder als Promise zurückgegeben.
 *
 * Beispiel:
 *   const artikel = await ifLive(() => getLagerArtikel(), [])
 */
export async function ifLive<T>(fn: () => Promise<T>, demoFallback: T): Promise<T> {
  if (hasDemoCookie()) return demoFallback
  return fn()
}

/**
 * Wie ifLive, aber für reine "fire-and-forget" Schreibaktionen:
 * Im Demo-Modus wird die Aktion übersprungen und `true` zurückgegeben
 * (so kann der Caller mit `if (await skipInDemo(...))` brechen).
 */
export async function skipInDemo<T>(fn: () => Promise<T>): Promise<{ skipped: boolean; result?: T }> {
  if (hasDemoCookie()) return { skipped: true }
  return { skipped: false, result: await fn() }
}

/**
 * React-Hook-freundlicher Helfer für Client-Komponenten:
 *   const { isDemo, when } = useDemoCheck()
 *   const list = when(() => loadFromDb(), demoList)
 *
 * Bewusst kein React-Hook (kein useState/useEffect) — `hasDemoCookie` ist
 * synchron und der Wert ändert sich pro Session nicht. Damit ist diese
 * Funktion in beliebigen Render-Paths sicher aufrufbar.
 */
export function useDemoCheck() {
  const isDemo = hasDemoCookie()
  return {
    isDemo,
    when<T>(liveFn: () => T, demoValue: T): T {
      return isDemo ? demoValue : liveFn()
    },
    async whenAsync<T>(liveFn: () => Promise<T>, demoValue: T): Promise<T> {
      return isDemo ? demoValue : liveFn()
    },
  }
}
