import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * KI-Response-Cache: spart OpenAI-Kosten für identische Anfragen.
 *
 * Genutzt z.B. für Tagesbericht — wenn 5 User denselben Bericht
 * aufrufen, läuft OpenAI nur 1× statt 5×.
 *
 * Schlüssel-Generierung: SHA-256 über die relevanten Input-Bestandteile.
 * TTL pro Cache-Eintrag konfigurierbar (Default: 1h für Tagesbericht).
 */

export function hashCacheKey(parts: unknown): string {
  const serialized = JSON.stringify(parts) ?? 'null'
  return createHash('sha256').update(serialized).digest('hex').slice(0, 32)
}

export async function getCachedResponse<T>(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  cacheKey: string,
): Promise<T | null> {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('ki_response_cache')
    .select('response, expires_at')
    .eq('user_id', userId)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  return data.response as T
}

export async function setCachedResponse(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  cacheKey: string,
  response: unknown,
  ttlSeconds: number = 3600,
): Promise<void> {
  if (!supabase || !userId) return
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  await supabase
    .from('ki_response_cache')
    .upsert(
      { user_id: userId, cache_key: cacheKey, response, expires_at: expiresAt },
      { onConflict: 'user_id,cache_key' },
    )
}
