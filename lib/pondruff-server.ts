import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { POND_DEFAULT_FEATURE_FLAGS, POND_FEATURE_LABELS, POND_USER_ID, type PondruffFeatureFlags, type PondruffFeatureKey } from './pondruff'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// Liest Pondruff-Feature-Flags via Service-Role (RLS bypass) — schnell + ohne
// Cookie-Forwarding. Fallback bei Fehler: alle Defaults true.
export async function loadPondruffFeatureFlags(userId: string = POND_USER_ID): Promise<PondruffFeatureFlags> {
  const sa = admin()
  if (!sa) return { ...POND_DEFAULT_FEATURE_FLAGS }
  const { data, error } = await sa
    .from('pondruff_feature_flags')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return { ...POND_DEFAULT_FEATURE_FLAGS }
  return {
    ocr_wareneingang: data.ocr_wareneingang ?? true,
    ocr_preisrechner: data.ocr_preisrechner ?? true,
    ki_bauteilsuche: data.ki_bauteilsuche ?? true,
    wiso_sync: data.wiso_sync ?? true,
  }
}

// Wenn das Feature deaktiviert ist: 403-Response zurueck. Sonst null.
export async function requirePondruffFeature(
  feature: PondruffFeatureKey,
  userId: string = POND_USER_ID,
): Promise<NextResponse | null> {
  const flags = await loadPondruffFeatureFlags(userId)
  if (flags[feature]) return null
  return NextResponse.json(
    {
      error: `${POND_FEATURE_LABELS[feature]} ist aktuell durch den Inhaber deaktiviert.`,
      feature,
      disabled: true,
    },
    { status: 403 },
  )
}
