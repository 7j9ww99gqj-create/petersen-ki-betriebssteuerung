import 'server-only'

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from './supabase-admin'
import type { AiFeatureSettings } from './db'

const DEFAULT_AI_FEATURE_SETTINGS: AiFeatureSettings = {
  enabled: true,
  chatEnabled: true,
  documentEnabled: true,
}

function normalizeAiFeatureSettings(data?: Record<string, unknown> | null): AiFeatureSettings {
  return {
    enabled: typeof data?.ai_enabled === 'boolean' ? data.ai_enabled : DEFAULT_AI_FEATURE_SETTINGS.enabled,
    chatEnabled: typeof data?.ai_chat_enabled === 'boolean' ? data.ai_chat_enabled : DEFAULT_AI_FEATURE_SETTINGS.chatEnabled,
    documentEnabled: typeof data?.ai_document_enabled === 'boolean' ? data.ai_document_enabled : DEFAULT_AI_FEATURE_SETTINGS.documentEnabled,
  }
}

export async function getServerAiFeatureSettings(
  supabase?: { rpc: (fn: string) => { single: () => PromiseLike<{ data: unknown; error: unknown }> } } | null,
): Promise<AiFeatureSettings> {
  try {
    if (isSupabaseAdminConfigured()) {
      const admin = createSupabaseAdminClient()
      const { data, error } = await admin.rpc('pk_get_ai_settings').single()
      if (!error) return normalizeAiFeatureSettings(data as Record<string, unknown> | null)
    }

    if (supabase) {
      const { data, error } = await supabase.rpc('pk_get_ai_settings').single()
      if (!error) return normalizeAiFeatureSettings(data as Record<string, unknown> | null)
    }
  } catch {
    // Bei fehlender Migration oder lokal ohne Service-Role soll die App nicht hart ausfallen.
  }

  return DEFAULT_AI_FEATURE_SETTINGS
}
