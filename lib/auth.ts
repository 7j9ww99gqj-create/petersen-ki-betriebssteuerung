export const DEMO_EMAIL = 'demo@petersen-ki.de'
export const DEMO_PASSWORD = 'Demo1234!'

const DEMO_COOKIE = 'pk_demo'

export function isDemoUser(email: string | null | undefined): boolean {
  return email?.toLowerCase() === DEMO_EMAIL
}

// Cookie-based demo session (works without Supabase)
export function setDemoCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`
}

export function clearDemoCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}

export function hasDemoCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith(`${DEMO_COOKIE}=1`))
}
