import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerAiFeatureSettings } from '@/lib/ai-settings'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCachedResponse, setCachedResponse, hashCacheKey } from '@/lib/ai-cache'
import { logAiUsage, extractUsage } from '@/lib/ai-usage'

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.unknown(),
  })).min(1).max(40),
  system: z.string().max(8000).optional(),
  context: z.string().max(16000).optional(),
  structuredOutput: z.boolean().optional(),
  // Wenn true UND structuredOutput false: liefert text/event-stream mit
  // OpenAI Responses-API SSE-Events. Bestehende strukturierte Aufrufer
  // (Tagesbericht, SKR-Vorschlag, proaktive Frage) sind nicht betroffen.
  stream: z.boolean().optional(),
})

// ── Demo-Kontext (spiegelt die Demo-Daten aus lager/page.tsx wider) ──────────

const DEMO_CONTEXT = {
  artikel: [
    { id: 'ART-001', name: 'Stahlrohr 40x40', kategorie: 'Rohmaterial', bestand: 45, einheit: 'Stk', lagerplatz: 'A-01-03', mindestbestand: 20, status: 'ok' },
    { id: 'ART-002', name: 'Schrauben M8x30', kategorie: 'Verbindungsmittel', bestand: 8, einheit: 'Pkg', lagerplatz: 'A-02-01', mindestbestand: 10, status: 'niedrig' },
    { id: 'ART-003', name: 'Hydrauliköl HLP 46', kategorie: 'Betriebsmittel', bestand: 0, einheit: 'L', lagerplatz: 'B-01-02', mindestbestand: 5, status: 'leer' },
    { id: 'ART-004', name: 'Dichtungsring 60mm', kategorie: 'Ersatzteile', bestand: 120, einheit: 'Stk', lagerplatz: 'C-03-01', mindestbestand: 50, status: 'ok' },
    { id: 'ART-005', name: 'Schmierfett K2K', kategorie: 'Betriebsmittel', bestand: 3, einheit: 'Kg', lagerplatz: 'B-02-01', mindestbestand: 5, status: 'niedrig' },
  ],
  stellplaetze: [
    { id: 'SP-001', code: 'TL-A-01-01', bereich: 'Trockenlager', zone: 'A', typ: 'Standard', aktiv: true },
    { id: 'SP-002', code: 'TL-A-01-02', bereich: 'Trockenlager', zone: 'A', typ: 'Standard', aktiv: true },
    { id: 'SP-003', code: 'KL-B-02-01', bereich: 'Kühlbereich', zone: 'B', typ: 'Kühl', aktiv: true },
    { id: 'SP-004', code: 'WE-ZONE-01', bereich: 'Wareneingang', zone: 'WE', typ: 'Eingang', aktiv: true },
    { id: 'SP-005', code: 'SPERR-01', bereich: 'Sperrlager', zone: 'S', typ: 'Sperr', aktiv: true },
  ],
  bestand: [
    { stellplatz_code: 'TL-A-01-01', artikelname: 'Stahlrohr 40x40', menge: 45, einheit: 'Stk', mhd: null },
    { stellplatz_code: 'TL-A-01-02', artikelname: 'Schrauben M8x30', menge: 8, einheit: 'Pkg', mhd: null },
    { stellplatz_code: 'KL-B-02-01', artikelname: 'Hydrauliköl HLP 46', menge: 0, einheit: 'L', mhd: '2025-03-01' },
  ],
  umlagerungen: [
    { artikelname: 'Stahlrohr 40x40', von: 'WE-ZONE-01', nach: 'TL-A-01-01', menge: 20, datum: '2025-05-08', grund: 'Wareneingang' },
    { artikelname: 'Schrauben M8x30', von: 'TL-A-01-01', nach: 'TL-A-01-02', menge: 5, datum: '2025-05-07', grund: 'Umsortierung' },
  ],
  wareneingaenge: [
    { lieferant: 'Muster GmbH', artikel: 'Stahlrohr 40x40', menge: 20, erwartet_am: null as string | null, status: 'Geliefert' },
  ],
}

// ── Systemkontext als kompakter Prompt-Block ─────────────────────────────────

function buildContextBlock(ctx: typeof DEMO_CONTEXT): string {
  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Artikel-Probleme
  const artikelLeer  = ctx.artikel.filter(a => a.status === 'leer')
  const artikelNiedrig = ctx.artikel.filter(a => a.status === 'niedrig')

  // MHD-Analyse auf Bestandsebene
  const mhdAbgelaufen = ctx.bestand.filter(b => b.mhd && new Date(b.mhd) < today)
  const mhdKritisch   = ctx.bestand.filter(b => b.mhd && new Date(b.mhd) >= today && new Date(b.mhd) <= in30)

  // Überlastete Stellplätze (≥3 Positionen)
  const spCount = new Map<string, number>()
  ctx.bestand.forEach(b => spCount.set(b.stellplatz_code, (spCount.get(b.stellplatz_code) ?? 0) + 1))
  const ueberlastet = Array.from(spCount.entries()).filter(([, n]) => n >= 3)

  // Artikel auf mehreren Stellplätzen verteilt (≥2 verschiedene Codes)
  const artikelSp = new Map<string, Set<string>>()
  ctx.bestand.forEach(b => {
    if (!artikelSp.has(b.artikelname)) artikelSp.set(b.artikelname, new Set())
    artikelSp.get(b.artikelname)!.add(b.stellplatz_code)
  })
  const verteilt = Array.from(artikelSp.entries()).filter(([, codes]) => codes.size >= 2)

  const none = (arr: unknown[]) => arr.length === 0

  return `=== AKTUELLE LAGERDATEN (${today.toLocaleDateString('de-DE')}) ===

ARTIKELBESTAND (${ctx.artikel.length} Artikel):
${ctx.artikel.map(a =>
  `- ${a.name} [${a.id}]: ${a.bestand} ${a.einheit} | Lagerplatz: ${a.lagerplatz} | Mindest: ${a.mindestbestand} | Status: ${a.status}`
).join('\n')}

STELLPLÄTZE (${ctx.stellplaetze.length} gesamt, ${ctx.stellplaetze.filter(sp => sp.aktiv).length} aktiv):
${ctx.stellplaetze.map(sp => `- ${sp.code} | Bereich: ${sp.bereich} | Typ: ${sp.typ}`).join('\n')}

LETZTE UMLAGERUNGEN (${ctx.umlagerungen.length}):
${ctx.umlagerungen.map(u => `- ${u.datum}: ${u.artikelname} (${u.menge}) von ${u.von} → ${u.nach} [${u.grund}]`).join('\n')}

OFFENE WARENEINGÄNGE (${ctx.wareneingaenge.filter((w: { status?: string }) => w.status !== 'Geliefert').length} ausstehend):
${ctx.wareneingaenge.length === 0
  ? '- Keine ausstehenden Wareneingänge'
  : ctx.wareneingaenge.map((w: { lieferant?: string; artikel?: string; menge?: number; erwartet_am?: string | null; status?: string }) =>
      `- ${w.lieferant ?? 'Unbekannt'}: ${w.artikel} (${w.menge ?? '?'}) — erwartet: ${w.erwartet_am ?? 'offen'} [${w.status}]`
    ).join('\n')}

=== VORBERECHNETE PROBLEM-ANALYSE ===

🔴 DRINGEND (${mhdAbgelaufen.length + artikelLeer.length} Probleme):
${none([...mhdAbgelaufen, ...artikelLeer])
  ? '- Keine dringenden Probleme'
  : [
    ...mhdAbgelaufen.map(b => `- MHD ABGELAUFEN: "${b.artikelname}" auf ${b.stellplatz_code} (MHD war ${b.mhd}) — sofort aussondern`),
    ...artikelLeer.map(a => `- BESTAND LEER: "${a.name}" — 0 ${a.einheit}, Mindest ${a.mindestbestand} — Nachbestellung dringend`),
  ].join('\n')}

⚠️ WICHTIG (${mhdKritisch.length + artikelNiedrig.length} Warnungen):
${none([...mhdKritisch, ...artikelNiedrig])
  ? '- Keine wichtigen Warnungen'
  : [
    ...mhdKritisch.map(b => `- MHD KRITISCH: "${b.artikelname}" auf ${b.stellplatz_code} — läuft ab ${b.mhd} (< 30 Tage)`),
    ...artikelNiedrig.map(a => `- BESTAND NIEDRIG: "${a.name}" — nur ${a.bestand} ${a.einheit} (Mindest: ${a.mindestbestand})`),
  ].join('\n')}

📦 INFO (${ueberlastet.length + verteilt.length} Hinweise):
${none([...ueberlastet, ...verteilt])
  ? '- Keine weiteren Hinweise'
  : [
    ...ueberlastet.map(([code, n]) => `- ÜBERLASTET: Stellplatz ${code} hat ${n} Positionen — Umlagerung prüfen`),
    ...verteilt.map(([name, codes]) => `- VERTEILT: "${name}" liegt auf ${codes.size} Stellplätzen (${Array.from(codes).join(', ')}) — Konsolidierung sinnvoll`),
  ].join('\n')}

=== ENDE LAGERDATEN ===`
}

// Wandelt OpenAI Responses-API SSE-Events in einen simplen Text-Stream um.
// Pro `response.output_text.delta`-Event wird der Delta-Text als
// `data: <text>\n\n` ausgegeben. Am Ende `event: done\ndata: \n\n`.
function transformOpenAiSseToTextSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          // SSE-Frames sind durch \n\n getrennt
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = frame.split('\n')
            let eventType = 'message'
            const dataLines: string[] = []
            for (const line of lines) {
              if (line.startsWith('event:')) eventType = line.slice(6).trim()
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
            }
            if (!dataLines.length) continue
            const payload = dataLines.join('\n')
            if (payload === '[DONE]') continue
            try {
              const json = JSON.parse(payload) as Record<string, unknown>
              if (eventType === 'response.output_text.delta' || json.type === 'response.output_text.delta') {
                const delta = typeof json.delta === 'string' ? json.delta : ''
                if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`))
              } else if (eventType === 'response.error' || json.type === 'response.error') {
                const errMsg = typeof json.error === 'object' && json.error && 'message' in (json.error as Record<string, unknown>)
                  ? String((json.error as { message: unknown }).message)
                  : 'OpenAI-Fehler im Stream'
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errMsg)}\n\n`))
              }
            } catch {
              // Frame nicht parsebar — ignorieren
            }
          }
        }
        controller.enqueue(encoder.encode('event: done\ndata: \n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(msg)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
}

function pickOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string') return data.output_text
  const output = Array.isArray(data.output) ? data.output as Array<Record<string, unknown>> : []
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content as Array<Record<string, unknown>> : []
    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text
    }
  }
  return ''
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    const parsed = ChatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Anfrage', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { messages, system, context, structuredOutput, stream } = parsed.data
    const wantsStream = Boolean(stream) && !structuredOutput
    const access = await getRouteAccess(req, ['Admin', 'Mitarbeiter', 'Lager', 'Werkstatt'])
    if (access.error) return access.error

    if (access.user) {
      const limited = checkRateLimit(access.user.id, 'ai')
      if (limited) return limited
    }

    const aiSettings = await getServerAiFeatureSettings(access.supabase)
    if (!aiSettings.enabled || !aiSettings.chatEnabled) {
      return NextResponse.json({
        reply: 'Die KI-Funktion wurde im Inhaber-Cockpit derzeit deaktiviert.',
        actions: [],
      }, { status: 403 })
    }

    // Systemkontext aufbauen
    let systemContext: typeof DEMO_CONTEXT

    if (access.isDemo) {
      systemContext = DEMO_CONTEXT
    } else {
      const supabase = access.supabase
      try {
        const [rawArtikel, rawStellplaetze, rawBestand, rawUmlagerungen, rawWareneingaenge] = await Promise.allSettled([
          supabase!.from('lager_artikel').select('*').order('id'),
          supabase!.from('lager_stellplaetze').select('*').order('code'),
          supabase!.from('lager_stellplatz_bestand').select('*, lager_stellplaetze(code, bereich, warengruppe, warenobergruppe)').order('created_at', { ascending: false }),
          supabase!.from('lager_umlagerungen').select('*').order('datum', { ascending: false }).limit(200),
          supabase!.from('einkauf_wareneingaenge').select('*, einkauf_bestellungen(artikel, menge, lieferant)').order('eingangsdatum', { ascending: false }).limit(50),
        ])

        systemContext = {
          artikel: rawArtikel.status === 'fulfilled' && !rawArtikel.value.error ? (rawArtikel.value.data ?? []).map((a: Record<string, unknown>) => ({
            id: a.id as string,
            name: a.name as string,
            kategorie: a.kategorie as string,
            bestand: (a.bestand as number) ?? 0,
            einheit: a.einheit as string,
            lagerplatz: a.lagerplatz as string,
            mindestbestand: (a.mindestbestand as number) ?? 0,
            status: a.status as string,
          })) : [],
          stellplaetze: rawStellplaetze.status === 'fulfilled' && !rawStellplaetze.value.error ? (rawStellplaetze.value.data ?? []).map((sp: Record<string, unknown>) => ({
            id: sp.id as string,
            code: sp.code as string,
            bereich: sp.bereich as string,
            zone: sp.zone as string,
            typ: sp.typ as string,
            aktiv: sp.aktiv as boolean,
          })) : [],
          bestand: rawBestand.status === 'fulfilled' && !rawBestand.value.error ? (rawBestand.value.data ?? []).map((b: Record<string, unknown>) => ({
            stellplatz_code: (b.lager_stellplaetze as { code?: string } | null)?.code ?? '',
            artikelname: b.artikelname as string,
            menge: (b.menge as number) ?? 0,
            einheit: b.einheit as string,
            mhd: b.mhd as string | null,
          })) : [],
          umlagerungen: rawUmlagerungen.status === 'fulfilled' && !rawUmlagerungen.value.error ? (rawUmlagerungen.value.data ?? []).map((u: Record<string, unknown>) => ({
            artikelname: u.artikelname as string,
            von: u.von_stellplatz_id as string,
            nach: u.nach_stellplatz_id as string,
            menge: (u.menge as number) ?? 0,
            datum: u.datum as string,
            grund: u.grund as string,
          })) : [],
          wareneingaenge: rawWareneingaenge.status === 'fulfilled' && !rawWareneingaenge.value.error ? (rawWareneingaenge.value.data ?? []).map((w: Record<string, unknown>) => {
            const bs = w.einkauf_bestellungen as Record<string, unknown> | null
            return {
              lieferant: (bs?.lieferant ?? 'Unbekannt') as string,
              artikel: (bs?.artikel ?? '') as string,
              menge: (w.menge_erhalten ?? bs?.menge ?? 0) as number,
              erwartet_am: w.eingangsdatum as string | null,
              status: w.qualitaet ? 'Geliefert' : 'Ausstehend',
            }
          }) : [],
        }
      } catch {
        systemContext = { artikel: [], stellplaetze: [], bestand: [], umlagerungen: [], wareneingaenge: [] }
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply: 'Bitte OPENAI_API_KEY serverseitig setzen, damit Lager-KI und Tagesbericht aktiv werden.',
        actions: [],
      })
    }

    const lagerContextBlock = buildContextBlock(systemContext)

    const jsonInstruction = structuredOutput ? `
Antworte IMMER als gültiges JSON-Objekt (kein Markdown, kein Text außerhalb):
{
  "message": "Kurze Zusammenfassung in 1-3 Sätzen",
  "probleme": [
    { "level": "dringend", "text": "Konkretes Problem mit Artikelname und Zahlenwert" },
    { "level": "wichtig",  "text": "Warnung mit Kontext" },
    { "level": "info",     "text": "Hinweis zur Optimierung" }
  ],
  "actions": [
    {
      "type": "umlagerung",
      "artikel": "Artikelname",
      "von": "Stellplatz-Code",
      "nach": "Stellplatz-Code",
      "menge": 10
    }
  ]
}
Regeln:
- "probleme": NUR Einträge die wirklich auf den Daten basieren. Level: "dringend" (MHD abgelaufen, Bestand leer), "wichtig" (MHD kritisch, Bestand niedrig), "info" (Optimierungshinweise). Leeres Array [] wenn keine Probleme.
- "actions": Erlaubte Typen: "umlagerung", "bestellung", "hinweis". Nur vorschlagen wenn konkret sinnvoll, sonst [].
- Für Bestellung/Hinweis: Felder type, artikel, beschreibung.
` : ''

    const baseSystem = [
      'Du bist ein KI-Assistent für ein Warenwirtschaftssystem (Petersen KI Betriebssteuerung).',
      'Du analysierst Lagerdaten und erkennst proaktiv Probleme: MHD-Überschreitungen, Mindestbestand-Unterschreitungen, überlastete Stellplätze, ineffizient verteilte Artikel.',
      'Antworte immer konkret basierend auf den Daten — nenne echte Artikelnamen, Mengen und Lagerplatz-Codes.',
      'Antworte auf Deutsch, professionell und präzise. Halte Antworten kurz und handlungsorientiert.',
      jsonInstruction,
      system || '',
    ].filter(Boolean).join('\n')

    // Kontext-Reihenfolge: Übergabe-Context (aus der Seite) → Lagerdaten → System-Prompt
    const fullSystem = [
      context || '',
      lagerContextBlock,
      baseSystem,
    ].filter(Boolean).join('\n\n')

    const inputMessages = Array.isArray(messages)
      ? messages.map((message: Record<string, unknown>) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: [
          {
            type: 'input_text',
            text: typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? ''),
          },
        ],
      }))
      : []

    // KI-Response-Cache nur bei structuredOutput (Tagesbericht): identische
    // Anfragen innerhalb der TTL liefern den gespeicherten Eintrag → spart Tokens.
    let cacheKey: string | null = null
    if (structuredOutput && access.user && access.supabase) {
      cacheKey = hashCacheKey({ messages, system, context, mode: 'tagesbericht' })
      const cached = await getCachedResponse<{ reply: string; probleme: unknown[]; actions: unknown[] }>(
        access.supabase, access.user.id, cacheKey,
      )
      if (cached) {
        logAiUsage({ userId: access.user.id, route: 'chat', model: 'gpt-4o-mini', cached: true })
        return NextResponse.json({ ...cached, cached: true })
      }
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-5.4-mini',
        instructions: fullSystem,
        input: inputMessages,
        max_output_tokens: 1024,
        ...(wantsStream ? { stream: true } : {}),
        ...(structuredOutput ? {
          text: {
            format: {
              type: 'json_schema',
              name: 'lager_ki_result',
              strict: false,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  message: { type: 'string' },
                  probleme: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        level: { type: 'string', enum: ['dringend', 'wichtig', 'info'] },
                        text: { type: 'string' },
                      },
                      required: ['level', 'text'],
                    },
                  },
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        type: { type: 'string', enum: ['umlagerung', 'bestellung', 'hinweis'] },
                        artikel: { type: 'string' },
                        von: { type: 'string' },
                        nach: { type: 'string' },
                        menge: { type: 'number' },
                        beschreibung: { type: 'string' },
                      },
                      required: ['type'],
                    },
                  },
                },
                required: ['message', 'probleme', 'actions'],
              },
            },
          },
        } : {}),
      }),
    })

    // Streaming-Pfad: SSE-Events 1:1 vom OpenAI Responses-API durchreichen,
    // aber nur die delta-Text-Chunks als simples 'data: <text>\n\n' weitergeben,
    // gefolgt von 'event: done\ndata: \n\n'. Das macht den Client trivial.
    if (wantsStream) {
      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '')
        return NextResponse.json({ reply: errText.slice(0, 500) || 'OpenAI-Fehler', actions: [] }, { status: 502 })
      }
      const stream = transformOpenAiSseToTextSse(response.body)
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    const data = await response.json() as Record<string, unknown>
    if (!response.ok) {
      const message = typeof data.error === 'object' && data.error && 'message' in data.error
        ? String((data.error as { message?: unknown }).message)
        : 'OpenAI konnte die Lager-KI-Anfrage nicht verarbeiten.'
      return NextResponse.json({ reply: message, actions: [] }, { status: 502 })
    }

    const rawText = pickOutputText(data) || 'Keine Antwort erhalten.'
    if (access.user) {
      const usage = extractUsage(data)
      logAiUsage({ userId: access.user.id, route: 'chat', model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini', inputTokens: usage.input, outputTokens: usage.output })
    }

    // Bei structuredOutput: JSON parsen, sonst plain text zurückgeben
    if (structuredOutput) {
      try {
        // Fallback, falls das Modell JSON doch als Text kapselt.
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        const parsed = JSON.parse(cleaned) as { message?: string; probleme?: unknown[]; actions?: unknown[] }
        const payload = {
          reply: parsed.message || rawText,
          probleme: Array.isArray(parsed.probleme) ? parsed.probleme : [],
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        }
        if (cacheKey && access.user) {
          await setCachedResponse(access.supabase, access.user.id, cacheKey, payload, 3600)
        }
        return NextResponse.json(payload)
      } catch {
        // Fallback: Antwort als plain text, keine Aktionen
        return NextResponse.json({ reply: rawText, actions: [] })
      }
    }

    return NextResponse.json({ reply: rawText })
  } catch (err) {
    console.error('AI API error:', err)
    return NextResponse.json({ reply: 'Fehler bei der KI-Anfrage. Bitte prüfen Sie Ihre Konfiguration.' }, { status: 500 })
  }
}
