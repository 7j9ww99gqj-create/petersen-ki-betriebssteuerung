import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodType } from 'zod'

/**
 * Parst und validiert den Request-Body gegen ein Zod-Schema.
 * Bei Fehler: 400-Response mit detaillierten Issues.
 *
 * Verwendung in API-Routes:
 *   const result = await parseBody(req, Schema)
 *   if (!result.ok) return result.error
 *   const body = result.data
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Ungültiges JSON im Request-Body.' }, { status: 400 }),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: NextResponse.json(
        {
          error: 'Validierungsfehler',
          issues: formatZodIssues(parsed.error),
        },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

function formatZodIssues(err: ZodError) {
  return err.issues.map(i => ({
    path: i.path.join('.'),
    message: i.message,
    code: i.code,
  }))
}

// Gemeinsame Schema-Bausteine für KI-Routen
export const promptTextSchema = z.string().trim().min(1).max(8000)
export const shortTextSchema = z.string().trim().min(1).max(500)
export const decimalAmountSchema = z.string().regex(/^-?\d{1,12}([.,]\d{1,4})?$/, 'Kein gültiger Betrag')
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Kein ISO-Datum')
