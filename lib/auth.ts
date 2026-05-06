// Demo-Zugangsdaten – dieser Account muss in Supabase unter Authentication > Users angelegt sein
export const DEMO_EMAIL = 'demo@petersen-ki.de'
export const DEMO_PASSWORD = 'Demo1234!'

export function isDemoUser(email: string | null | undefined): boolean {
  return email?.toLowerCase() === DEMO_EMAIL
}
