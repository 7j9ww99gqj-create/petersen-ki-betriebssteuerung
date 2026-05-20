import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  const configured = !!(process.env.RESEND_API_KEY)
  return NextResponse.json({ configured })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const access = await getRouteAccess(req)
  if (!access.user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'RESEND_API_KEY nicht konfiguriert' }, { status: 501 })
  }

  const body = await req.json() as { bericht_id?: string; recipient_email?: string; recipient_name?: string; pdf_base64?: string; pruefbericht_nr?: string }
  const { bericht_id, recipient_email, recipient_name, pdf_base64, pruefbericht_nr } = body

  if (!recipient_email || !bericht_id) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)

    const attachments = pdf_base64
      ? [{ filename: `${pruefbericht_nr ?? 'pruefbericht'}.pdf`, content: pdf_base64 }]
      : []

    const { error } = await resend.emails.send({
      from: 'QM-Pilot <qm@petersen-ki-pilot.de>',
      to: recipient_email,
      subject: `Prüfbericht ${pruefbericht_nr ?? bericht_id}`,
      html: `<p>Sehr geehrte${recipient_name ? ` ${recipient_name}` : ''},</p>
<p>anbei finden Sie den Prüfbericht <strong>${pruefbericht_nr ?? bericht_id}</strong>.</p>
<p>Mit freundlichen Grüßen<br/>Petersen KI QM-Pilot</p>`,
      attachments,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unbekannter Fehler' }, { status: 500 })
  }
}
