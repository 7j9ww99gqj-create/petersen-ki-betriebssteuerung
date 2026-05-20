import 'server-only'

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from './supabase-admin'
import type { AiFeatureSettings, MarketingKiSettings, OpenAiToolSettings, QmKiSettings } from './db'
import { INHABER_EMAIL } from './roles'
import { isPondruffUser } from './pondruff'

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

const DEFAULT_MARKETING_KI: MarketingKiSettings = {
  contentDailyEnabled: false,
  autopilotEnabled: false,
  salesAssistantEnabled: false,
}

// Wenn Service-Role-Key fehlt, können Einstellungen nicht geprüft werden → fail-open
const MARKETING_KI_FAIL_OPEN: MarketingKiSettings = {
  contentDailyEnabled: true,
  autopilotEnabled: true,
  salesAssistantEnabled: true,
}

export async function getServerMarketingKiSettings(userId: string): Promise<MarketingKiSettings> {
  try {
    if (!isSupabaseAdminConfigured()) return MARKETING_KI_FAIL_OPEN
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('firma_einstellungen')
      .select('marketing_content_daily_enabled, marketing_autopilot_enabled, marketing_sales_assistant_enabled')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return DEFAULT_MARKETING_KI
    const row = data as Record<string, unknown>
    return {
      contentDailyEnabled: Boolean(row.marketing_content_daily_enabled),
      autopilotEnabled: Boolean(row.marketing_autopilot_enabled),
      salesAssistantEnabled: Boolean(row.marketing_sales_assistant_enabled),
    }
  } catch {
    return DEFAULT_MARKETING_KI
  }
}

const DEFAULT_OPENAI_TOOLS: OpenAiToolSettings = {
  steuerprognoseEnabled: false,
  mahnungsgeneratorEnabled: false,
  emailAssistentEnabled: false,
  monatsberichtEnabled: false,
}

const OPENAI_TOOLS_FAIL_OPEN: OpenAiToolSettings = {
  steuerprognoseEnabled: true,
  mahnungsgeneratorEnabled: true,
  emailAssistentEnabled: true,
  monatsberichtEnabled: true,
}

const DEFAULT_QM_KI: QmKiSettings = {
  qm_ki_zeichnungs_analyse: false,
  qm_ki_sichtpruefung: false,
}

export async function getServerQmKiSettings(userId: string, userEmail?: string): Promise<QmKiSettings> {
  const email = (userEmail ?? '').toLowerCase()
  if (email === INHABER_EMAIL.toLowerCase() || isPondruffUser(email)) {
    return { qm_ki_zeichnungs_analyse: true, qm_ki_sichtpruefung: true }
  }
  try {
    if (!isSupabaseAdminConfigured()) return DEFAULT_QM_KI
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('firma_einstellungen')
      .select('qm_ki_zeichnungs_analyse, qm_ki_sichtpruefung')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return DEFAULT_QM_KI
    const row = data as Record<string, unknown>
    return {
      qm_ki_zeichnungs_analyse: Boolean(row.qm_ki_zeichnungs_analyse),
      qm_ki_sichtpruefung: Boolean(row.qm_ki_sichtpruefung),
    }
  } catch {
    return DEFAULT_QM_KI
  }
}

export async function getServerOpenAiToolSettings(userId: string): Promise<OpenAiToolSettings> {
  try {
    if (!isSupabaseAdminConfigured()) return OPENAI_TOOLS_FAIL_OPEN
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('firma_einstellungen')
      .select('openai_steuerprognose_enabled, openai_mahnungsgenerator_enabled, openai_email_assistent_enabled, openai_monatsbericht_enabled')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return DEFAULT_OPENAI_TOOLS
    const row = data as Record<string, unknown>
    return {
      steuerprognoseEnabled: Boolean(row.openai_steuerprognose_enabled),
      mahnungsgeneratorEnabled: Boolean(row.openai_mahnungsgenerator_enabled),
      emailAssistentEnabled: Boolean(row.openai_email_assistent_enabled),
      monatsberichtEnabled: Boolean(row.openai_monatsbericht_enabled),
    }
  } catch {
    return DEFAULT_OPENAI_TOOLS
  }
}
