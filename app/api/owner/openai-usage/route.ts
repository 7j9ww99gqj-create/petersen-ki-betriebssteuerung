import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'

export const runtime = 'nodejs'

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'
const USD_TO_EUR = 0.92

// Pricing per 1M tokens (USD, gpt-4o-mini is default model)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o':      { input: 5.00, output: 15.00 },
  'gpt-4':       { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
}

function getPricing(snapshotId: string) {
  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    if (snapshotId?.includes(model)) return pricing
  }
  return MODEL_PRICING['gpt-4o-mini']
}

type UsageItem = {
  n_context_tokens_processed: number
  n_generated_tokens_processed: number
  snapshot_id: string
  n_requests: number
}

async function fetchDayUsage(dateStr: string, key: string): Promise<{ inputTokens: number; outputTokens: number; requests: number; costEur: number }> {
  try {
    const res = await fetch(`https://api.openai.com/v1/usage?date=${dateStr}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { inputTokens: 0, outputTokens: 0, requests: 0, costEur: 0 }
    const data = await res.json() as { data?: UsageItem[] }
    let inputTokens = 0, outputTokens = 0, requests = 0, costEur = 0
    for (const item of data.data ?? []) {
      const pricing = getPricing(item.snapshot_id ?? '')
      inputTokens += item.n_context_tokens_processed
      outputTokens += item.n_generated_tokens_processed
      requests += item.n_requests ?? 0
      costEur += ((item.n_context_tokens_processed / 1_000_000) * pricing.input +
                  (item.n_generated_tokens_processed / 1_000_000) * pricing.output) * USD_TO_EUR
    }
    return { inputTokens, outputTokens, requests, costEur }
  } catch {
    return { inputTokens: 0, outputTokens: 0, requests: 0, costEur: 0 }
  }
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req, ['Admin', 'Inhaber'])
  if (access.error) return access.error

  const userEmail = access.user?.email?.toLowerCase()
  if (userEmail !== OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY nicht konfiguriert.' }, { status: 500 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const days = now.getDate()

  const dates: string[] = []
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d)
    dates.push(date.toISOString().split('T')[0])
  }

  const results = await Promise.all(dates.map(d => fetchDayUsage(d, key)))

  const dailyData = dates.map((date, i) => ({ date, ...results[i] }))
  const totalInputTokens = results.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutputTokens = results.reduce((s, r) => s + r.outputTokens, 0)
  const totalRequests = results.reduce((s, r) => s + r.requests, 0)
  const totalCostEur = results.reduce((s, r) => s + r.costEur, 0)

  return NextResponse.json({
    totalCostEur,
    totalInputTokens,
    totalOutputTokens,
    totalRequests,
    dailyData,
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    fetchedDays: days,
  })
}
