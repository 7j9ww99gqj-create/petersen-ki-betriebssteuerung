import { createClient } from '@supabase/supabase-js'

// gpt-4o-mini Pricing (Stand: 2026-05) — €/1M Tokens
// Quelle: https://platform.openai.com/docs/pricing (USD→EUR ~0.92)
const PRICING_EUR_PER_M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini':         { input: 0.138, output: 0.552 },
  'gpt-4o':              { input: 2.300, output: 9.200 },
  'gpt-4o-mini-2024-07-18': { input: 0.138, output: 0.552 },
  'text-embedding-3-small': { input: 0.018, output: 0 },
}

export type AiUsageInput = {
  userId: string
  route: string
  model?: string | null
  inputTokens?: number
  outputTokens?: number
  cached?: boolean
}

function serviceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function calcCostEur(model: string | null | undefined, inputTokens: number, outputTokens: number): number {
  const key = (model ?? 'gpt-4o-mini').toLowerCase()
  const pricing = PRICING_EUR_PER_M[key] ?? PRICING_EUR_PER_M['gpt-4o-mini']
  return Number(
    ((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000).toFixed(6),
  )
}

/**
 * Best-effort: schreibt einen Usage-Eintrag. Blockt nie den Response-Pfad.
 */
export function logAiUsage(input: AiUsageInput): void {
  const client = serviceClient()
  if (!client || !input.userId) return
  const inTok = input.inputTokens ?? 0
  const outTok = input.outputTokens ?? 0
  void client.from('ai_usage').insert({
    user_id: input.userId,
    route: input.route,
    model: input.model ?? null,
    input_tokens: inTok,
    output_tokens: outTok,
    cost_eur: calcCostEur(input.model, inTok, outTok),
    cached: input.cached ?? false,
  })
}

// Default monatliches Kostenlimit pro User in EUR
const DEFAULT_MONTHLY_LIMIT_EUR = 5.0

/**
 * Prüft ob der User sein monatliches KI-Kostenlimit überschritten hat.
 * Gibt { allowed: true } oder { allowed: false, spent: number, limit: number } zurück.
 * Best-effort: bei DB-Fehler wird der Request durchgelassen.
 */
export async function checkCostLimit(
  userId: string,
  limitEur: number = DEFAULT_MONTHLY_LIMIT_EUR,
): Promise<{ allowed: boolean; spent: number; limit: number }> {
  const client = serviceClient()
  if (!client || !userId) return { allowed: true, spent: 0, limit: limitEur }
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const { data, error } = await client
      .from('ai_usage')
      .select('cost_eur')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
    if (error) return { allowed: true, spent: 0, limit: limitEur }
    const spent = (data ?? []).reduce((sum, r) => sum + (r.cost_eur ?? 0), 0)
    return { allowed: spent < limitEur, spent: Number(spent.toFixed(4)), limit: limitEur }
  } catch {
    return { allowed: true, spent: 0, limit: limitEur }
  }
}

/**
 * Extrahiert Token-Counts aus einer OpenAI Chat-Completions/Responses-API-Antwort.
 */
export function extractUsage(data: unknown): { input: number; output: number } {
  const d = data as { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } }
  const u = d?.usage
  if (!u) return { input: 0, output: 0 }
  return {
    input: u.input_tokens ?? u.prompt_tokens ?? 0,
    output: u.output_tokens ?? u.completion_tokens ?? 0,
  }
}
