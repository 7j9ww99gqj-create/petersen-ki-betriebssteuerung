import { createBrowserClient } from '@supabase/ssr'

function getEnv() {
  // Remove accidental trailing slashes from the URL
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return { url, key }
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getEnv()
  return url.startsWith('https://') && key.length > 20
}

export function createSupabaseClient() {
  const { url, key } = getEnv()
  if (!url || !key) {
    throw new Error('Supabase nicht konfiguriert.')
  }
  return createBrowserClient(url, key)
}
