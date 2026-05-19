import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { getServerAiFeatureSettings } from '@/lib/ai-settings'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

const FALLBACK_RESULT = {
  documentType: 'sonstiges',
  confidence: 0,
  summary: 'Dokumenten-KI ist noch nicht konfiguriert. Bitte OPENAI_API_KEY serverseitig setzen.',
  extracted: {},
  suggestedActions: ['OPENAI_API_KEY in Vercel / .env.local hinterlegen und erneut analysieren.'],
}

function emptyResult(summary: string, confidence = 0) {
  return {
    documentType: 'sonstiges',
    confidence,
    summary,
    extracted: {},
    suggestedActions: [],
  }
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

export async function POST(req: NextRequest) {
  try {
    const access = await getRouteAccess(req, ['Admin', 'Mitarbeiter', 'Büro', 'Werkstatt', 'Lager'])
    if (access.error) return access.error

    if (access.user) {
      const limited = checkRateLimit(access.user.id, 'ocr')
      if (limited) return limited
    }

    const aiSettings = await getServerAiFeatureSettings(access.supabase)
    if (!aiSettings.enabled || !aiSettings.documentEnabled) {
      return NextResponse.json(
        emptyResult('Die Dokumenten-KI wurde im Inhaber-Cockpit derzeit deaktiviert.'),
        { status: 403 },
      )
    }

    const form = await req.formData()
    const rawFile = form.get('file')

    if (!(rawFile instanceof File)) {
      return NextResponse.json(emptyResult('Keine Datei im Request gefunden.'), { status: 400 })
    }

    const file = rawFile
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(emptyResult(`Dateityp nicht erlaubt: ${file.type || 'unbekannt'}. Erlaubt sind PDF, PNG, JPG/JPEG und WEBP.`), { status: 415 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(emptyResult('Datei ist zu groß. Maximal erlaubt sind 12 MB.'), { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // OCR-Original im Storage-Bucket "ocr-originale" archivieren (GoBD-relevant)
    // Pfad-Konvention: <user_id>/<YYYY-MM-DD>/<timestamp>-<filename>
    let originalPath: string | null = null
    if (access.user && access.supabase) {
      try {
        const now = new Date()
        const dateFolder = now.toISOString().slice(0, 10)
        const safeName = (file.name || 'dokument').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
        const path = `${access.user.id}/${dateFolder}/${now.getTime()}-${safeName}`
        const { error: upErr } = await access.supabase.storage
          .from('ocr-originale')
          .upload(path, buffer, { upsert: false, contentType: file.type, cacheControl: '3600' })
        if (!upErr) originalPath = path
      } catch {
        // Archivierung ist best-effort; OCR-Analyse läuft trotzdem weiter
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ...FALLBACK_RESULT, originalPath })
    }

    const base64 = buffer.toString('base64')
    const isPdf = file.type === 'application/pdf'

    const inputContent: Array<Record<string, unknown>> = [
      {
        type: 'input_text',
        text: [
          'Analysiere dieses Geschäftsdokument für Petersen KI Betriebssteuerung.',
          'Extrahiere nur Daten, die im Dokument erkennbar sind.',
          'Bei Rechnungen: Unterscheide Ausgangsrechnung vs. Eingangsrechnung/Lieferantenrechnung. Wenn Petersen KI oder Petersen als Empfänger/Kunde auftaucht und ein fremder Lieferant genannt ist, ist es wahrscheinlich eine Eingangsrechnung.',
          'Setze bei Eingangsrechnungen lieferant, kunde/empfaenger, rechnungsnummer, rechnungsdatum, faelligkeit, betrag_netto, mwst, betrag_brutto, iban und positionen soweit erkennbar.',
          'Wenn ein Feld nicht sicher erkennbar ist, lasse es weg oder setze null.',
          'Gib konkrete suggestedActions zurück, aber keine automatische Speicherung.',
        ].join('\n'),
      },
      isPdf
        ? {
          type: 'input_file',
          filename: file.name || 'dokument.pdf',
          file_data: `data:${file.type};base64,${base64}`,
        }
        : {
          type: 'input_image',
          image_url: `data:${file.type};base64,${base64}`,
        },
    ]

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_DOCUMENT_MODEL || 'gpt-5.4-mini',
        instructions: [
          'Du bist eine Dokumenten-KI für ein Warenwirtschaftssystem.',
          'Du klassifizierst Rechnungen, Angebote, Aufträge, Lieferscheine, Wareneingänge, Kundendokumente und sonstige Dokumente.',
          'Antworte ausschließlich als JSON entsprechend dem Schema.',
          'Confidence ist eine Zahl zwischen 0 und 1.',
        ].join('\n'),
        input: [
          {
            role: 'user',
            content: inputContent,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'document_ai_result',
            strict: false,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                documentType: {
                  type: 'string',
                  enum: ['rechnung', 'angebot', 'auftrag', 'lieferschein', 'wareneingang', 'kunden_dokument', 'sonstiges'],
                },
                confidence: { type: 'number' },
                summary: { type: 'string' },
                extracted: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    rechnungsnummer: { type: ['string', 'null'] },
                    kunde: { type: ['string', 'null'] },
                    lieferant: { type: ['string', 'null'] },
                    betrag_netto: { type: ['number', 'string', 'null'] },
                    betrag_brutto: { type: ['number', 'string', 'null'] },
                    mwst: { type: ['number', 'string', 'null'] },
                    rechnungsdatum: { type: ['string', 'null'] },
                    faelligkeit: { type: ['string', 'null'] },
                    iban: { type: ['string', 'null'] },
                    positionen: { type: ['array', 'string', 'null'], items: { type: 'object', additionalProperties: true } },
                    angebotsnummer: { type: ['string', 'null'] },
                    betrag: { type: ['number', 'string', 'null'] },
                    datum: { type: ['string', 'null'] },
                    gueltig_bis: { type: ['string', 'null'] },
                    lieferdatum: { type: ['string', 'null'] },
                    artikel: { type: ['array', 'string', 'null'], items: { type: ['string', 'object'], additionalProperties: true } },
                    mengen: { type: ['array', 'string', 'null'], items: { type: ['string', 'number', 'object'], additionalProperties: true } },
                    chargen: { type: ['array', 'string', 'null'], items: { type: ['string', 'object'], additionalProperties: true } },
                    mhd: { type: ['array', 'string', 'null'], items: { type: ['string', 'object'], additionalProperties: true } },
                    titel: { type: ['string', 'null'] },
                    beteiligte: { type: ['array', 'string', 'null'], items: { type: 'string' } },
                    wichtige_hinweise: { type: ['array', 'string', 'null'], items: { type: 'string' } },
                  },
                },
                suggestedActions: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['documentType', 'confidence', 'summary', 'extracted', 'suggestedActions'],
            },
          },
        },
      }),
    })

    const data = await response.json() as Record<string, unknown>
    if (!response.ok) {
      const message = typeof data.error === 'object' && data.error && 'message' in data.error
        ? String((data.error as { message?: unknown }).message)
        : 'OpenAI konnte das Dokument nicht analysieren.'
      return NextResponse.json(emptyResult(isPdf ? `PDF-Analyse aktuell nicht möglich: ${message}` : message), { status: 502 })
    }

    const text = pickOutputText(data)
    if (!text) {
      return NextResponse.json({ ...emptyResult('OpenAI hat keine auswertbare Antwort geliefert.'), originalPath }, { status: 502 })
    }

    try {
      return NextResponse.json({ ...JSON.parse(text), originalPath })
    } catch {
      return NextResponse.json({
        documentType: 'sonstiges',
        confidence: 0.35,
        summary: text.slice(0, 900),
        extracted: {},
        suggestedActions: ['Antwort prüfen und manuell übernehmen.'],
        originalPath,
      })
    }
  } catch (err) {
    return NextResponse.json(
      emptyResult(err instanceof Error ? err.message : 'Dokumentenanalyse fehlgeschlagen.'),
      { status: 500 },
    )
  }
}
