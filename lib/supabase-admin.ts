import 'server-only'

import { createClient } from '@supabase/supabase-js'

function getAdminEnv() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  }
}

export function isSupabaseAdminConfigured() {
  const { url, serviceRoleKey } = getAdminEnv()
  return url.startsWith('https://') && serviceRoleKey.length > 20
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getAdminEnv()
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase-Service-Role ist serverseitig nicht konfiguriert.')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
