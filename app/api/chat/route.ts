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
  const niedrig = ctx.artikel.filter(a => a.status === 'niedrig' || a.status === 'leer')
  const freieStellplaetze = ctx.stellplaetze.filter(sp => sp.aktiv).length

  return `=== AKTUELLE LAGERDATEN (${new Date().toLocaleDateString('de-DE')}) ===

ARTIKELBESTAND (${ctx.artikel.length} Artikel):
${ctx.artikel.map(a =>
  `- ${a.name} [${a.id}]: ${a.bestand} ${a.einheit} auf Platz ${a.lagerplatz} | Mindest: ${a.mindestbestand} | Status: ${a.status}`
).join('\n')}

NACHBESTELLBEDARF (${niedrig.length} Artikel):
${niedrig.length === 0 ? '- Kein Nachbestellbedarf' : niedrig.map(a =>
  `- ${a.name}: nur noch ${a.bestand} ${a.einheit} (Mindest: ${a.mindestbestand})`
).join('\n')}

STELLPLÄTZE (${ctx.stellplaetze.length} gesamt, ${freieStellplaetze} aktiv):
${ctx.stellplaetze.map(sp =>
  `- ${sp.code} | Bereich: ${sp.bereich} | Typ: ${sp.typ}`
).join('\n')}

LETZTE UMLAGERUNGEN (${ctx.umlagerungen.length}):
${ctx.umlagerungen.map(u =>
  `- ${u.datum}: ${u.artikelname} (${u.menge}) von ${u.von} → ${u.nach} [${u.grund}]`
).join('\n')}

=== ENDE LAGERDATEN ===`
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages, system, context } = await req.json()

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

    const baseSystem = [
      'Du bist ein KI-Assistent für ein Warenwirtschaftssystem (Petersen KI Betriebssteuerung).',
      'Du hast Zugriff auf aktuelle Lagerdaten: Artikelbestand, Stellplätze und Lagerbewegungen.',
      'Antworte immer konkret basierend auf diesen Daten — nenne echte Artikelnamen, Mengen und Lagerplätze.',
      'Antworte auf Deutsch, professionell und präzise. Halte Antworten kurz und handlungsorientiert.',
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
    const reply = data.content?.[0]?.text || 'Keine Antwort erhalten.'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI API error:', err)
    return NextResponse.json({ reply: 'Fehler bei der KI-Anfrage. Bitte prüfen Sie Ihre Konfiguration.' }, { status: 500 })
  }
}
