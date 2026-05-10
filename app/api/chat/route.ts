import { NextRequest, NextResponse } from 'next/server'
import { getLagerArtikel, getLagerStellplaetze, getLagerStellplatzBestand, getLagerUmlagerungen } from '@/lib/db'

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

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, system, context, structuredOutput } = await req.json()

    // Demo-Modus: Cookie aus Request lesen
    const isDemo = req.cookies.get('pk_demo')?.value === '1'

    // Systemkontext aufbauen
    let systemContext: typeof DEMO_CONTEXT

    if (isDemo) {
      systemContext = DEMO_CONTEXT
    } else {
      // Live-Modus: Echte DB-Daten laden
      // Hinweis: Ohne SSR-Auth-Client werden RLS-geschützte Tabellen leer zurückgegeben.
      // Die Architektur ist korrekt — für vollständige Daten muss der Supabase-Client
      // auf createServerClient (mit Cookie-Forwarding) umgestellt werden.
      try {
        const [rawArtikel, rawStellplaetze, rawBestand, rawUmlagerungen] = await Promise.allSettled([
          getLagerArtikel(),
          getLagerStellplaetze(),
          getLagerStellplatzBestand(),
          getLagerUmlagerungen(),
        ])

        systemContext = {
          artikel: rawArtikel.status === 'fulfilled' ? rawArtikel.value.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            name: a.name as string,
            kategorie: a.kategorie as string,
            bestand: (a.bestand as number) ?? 0,
            einheit: a.einheit as string,
            lagerplatz: a.lagerplatz as string,
            mindestbestand: (a.mindestbestand as number) ?? 0,
            status: a.status as string,
          })) : [],
          stellplaetze: rawStellplaetze.status === 'fulfilled' ? rawStellplaetze.value.map((sp: Record<string, unknown>) => ({
            id: sp.id as string,
            code: sp.code as string,
            bereich: sp.bereich as string,
            zone: sp.zone as string,
            typ: sp.typ as string,
            aktiv: sp.aktiv as boolean,
          })) : [],
          bestand: rawBestand.status === 'fulfilled' ? rawBestand.value.map((b: Record<string, unknown>) => ({
            stellplatz_code: (b.lager_stellplaetze as { code?: string } | null)?.code ?? '',
            artikelname: b.artikelname as string,
            menge: (b.menge as number) ?? 0,
            einheit: b.einheit as string,
            mhd: b.mhd as string | null,
          })) : [],
          umlagerungen: rawUmlagerungen.status === 'fulfilled' ? rawUmlagerungen.value.map((u: Record<string, unknown>) => ({
            artikelname: u.artikelname as string,
            von: u.von_stellplatz_id as string,
            nach: u.nach_stellplatz_id as string,
            menge: (u.menge as number) ?? 0,
            datum: u.datum as string,
            grund: u.grund as string,
          })) : [],
        }
      } catch {
        systemContext = { artikel: [], stellplaetze: [], bestand: [], umlagerungen: [] }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply: 'Demo-Modus: Bitte ANTHROPIC_API_KEY in .env.local eintragen für echte KI-Antworten.',
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: fullSystem,
        messages,
      }),
    })

    const data = await response.json()
    const rawText: string = data.content?.[0]?.text || 'Keine Antwort erhalten.'

    // Bei structuredOutput: JSON parsen, sonst plain text zurückgeben
    if (structuredOutput) {
      try {
        // Claude kann JSON in Markdown-Codeblöcken einwickeln — Strip
        const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        const parsed = JSON.parse(cleaned) as { message?: string; probleme?: unknown[]; actions?: unknown[] }
        return NextResponse.json({
          reply: parsed.message || rawText,
          probleme: Array.isArray(parsed.probleme) ? parsed.probleme : [],
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        })
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
