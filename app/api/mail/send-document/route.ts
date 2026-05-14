import { NextRequest, NextResponse } from 'next/server'

import { getRouteAccess } from '@/lib/server-auth'
import { sendDocumentMail, isMailConfigured } from '@/lib/mail'
import { appendAuditLog } from '@/lib/db'
import { genId } from '@/lib/ids'

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req, ['Inhaber', 'Admin', 'Büro', 'Mitarbeiter'])
  if (access.error) return access.error

  if (!isMailConfigured()) {
    return NextResponse.json({ ok: false, error: 'Mail nicht konfiguriert. RESEND_API_KEY in Vercel setzen.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as {
    to?: string
    subject?: string
    htmlBody?: string
    pdfBase64?: string
    filename?: string
    documentType?: 'rechnung' | 'angebot'
    documentId?: string
  } | null

  if (!body?.to || !body?.pdfBase64 || !body?.filename) {
    return NextResponse.json({ ok: false, error: 'to, pdfBase64 und filename sind Pflichtfelder.' }, { status: 400 })
  }

  const subject = body.subject || `Dokument von Petersen KI: ${body.filename}`
  const htmlBody = body.htmlBody || `
    <div style="font-family:sans-serif;color:#1a2233;max-width:540px">
      <h2 style="color:#1684ff;margin-bottom:8px">Petersen KI Betriebssteuerung</h2>
      <p>Guten Tag,</p>
      <p>anbei erhalten Sie Ihr Dokument: <strong>${body.filename}</strong></p>
      <p>Bei Fragen stehen wir gerne zur Verfügung.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
      <p style="font-size:12px;color:#6b7280">
        Petersen KI Betriebssteuerung · info@petersen-ki-pilot.de
      </p>
    </div>
  `

  const result = await sendDocumentMail({
    to: body.to,
    subject,
    htmlBody,
    pdfBase64: body.pdfBase64,
    filename: body.filename,
  })

  if (result.ok) {
    await appendAuditLog({
      action: 'mail.document.sent',
      targetType: body.documentType ?? 'document',
      targetId: body.documentId ?? genId('DOC'),
      payload: { to: body.to, filename: body.filename, resendId: result.id },
    })
  }

  return NextResponse.json(result)
}
