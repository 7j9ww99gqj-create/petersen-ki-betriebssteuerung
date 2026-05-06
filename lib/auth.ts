export const DEMO_EMAIL = 'demo@petersen-ki-pilot.de'
export const DEMO_PASSWORD = 'Demo2025!'

const SESSION_KEY = 'pk_user'

export type UserSession = {
  name: string
  email: string
  role: string
  firma: string
  isDemo: boolean
  pilots: string[]
}

export function checkLogin(
  email: string,
  password: string,
): { ok: true; user: UserSession } | { ok: false; error: string } {
  if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
    return {
      ok: true,
      user: {
        name: 'Demo',
        email: DEMO_EMAIL,
        role: 'Demo Admin',
        firma: 'Petersen KI Demo',
        isDemo: true,
        pilots: ['lager', 'buero', 'werkstatt', 'marketing', 'analyse', 'planung'],
      },
    }
  }
  // Placeholder for future real-user authentication (e.g. NextAuth / Clerk / DB lookup)
  return { ok: false, error: 'Login derzeit nur für freigeschaltete Nutzer verfügbar.' }
}

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as UserSession) : null
  } catch {
    return null
  }
}

export function setSession(user: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
