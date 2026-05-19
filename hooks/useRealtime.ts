'use client'
import { useEffect, useRef } from 'react'
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface RealtimeOptions {
  table: string
  event?: RealtimeEvent
  schema?: string
  filter?: string
  onchange: (payload: Record<string, unknown>) => void
}

/**
 * Supabase Realtime-Subscription mit auto-cleanup.
 * Kein Polling — reagiert sofort auf DB-Änderungen via Postgres WAL.
 */
export function useRealtime({ table, event = '*', schema = 'public', filter, onchange }: RealtimeOptions) {
  const onchangeRef = useRef(onchange)
  onchangeRef.current = onchange

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createSupabaseClient()
    const channelName = `rt-${table}-${event}-${Date.now()}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelConfig: any = { event, schema, table }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload) => {
        onchangeRef.current(payload as Record<string, unknown>)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, event, schema, filter])
}

/**
 * Multi-Table Realtime — reagiert auf Änderungen in mehreren Tabellen gleichzeitig.
 * Ruft onchange bei jeder Änderung in einer der tables auf.
 */
export function useRealtimeMulti(
  tables: string[],
  onchange: () => void,
) {
  const onchangeRef = useRef(onchange)
  onchangeRef.current = onchange

  useEffect(() => {
    if (!isSupabaseConfigured() || tables.length === 0) return
    const supabase = createSupabaseClient()
    const channelName = `rt-multi-${tables.join('-')}-${Date.now()}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ch: any = supabase.channel(channelName)

    for (const table of tables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        onchangeRef.current()
      })
    }

    ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  // tables reference is stable only if caller memoizes — using join for primitive comparison
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')])
}
