'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { POND_DEFAULT_FEATURE_FLAGS, type PondruffFeatureFlags } from '@/lib/pondruff'

export function usePondruffFlags(): { flags: PondruffFeatureFlags; loading: boolean } {
  const [flags, setFlags] = useState<PondruffFeatureFlags>({ ...POND_DEFAULT_FEATURE_FLAGS })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = createSupabaseClient()
      const { data } = await sb.from('pondruff_feature_flags').select('*').maybeSingle()
      if (cancelled) return
      if (data) {
        setFlags({
          ocr_wareneingang: data.ocr_wareneingang ?? true,
          ocr_preisrechner: data.ocr_preisrechner ?? true,
          ki_bauteilsuche: data.ki_bauteilsuche ?? true,
          wiso_sync: data.wiso_sync ?? true,
        })
      }
      setLoading(false)
    }
    void run().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { flags, loading }
}
