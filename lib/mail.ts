import 'server-only'

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export type SendDocumentMailInput = {
  to: string
  subject: string
  htmlBody: string
  pdfBase64: string
  filename: string
}

export async function sendDocumentMail(input: SendDocumentMailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isMailConfigured()) {
    return { ok: false, error: 'RESEND_API_KEY nicht konfiguriert.' }
  }

  const from = process.env.MAIL_FROM_ADDRESS || 'noreply@petersen-ki-pilot.de'

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from,
    to: [input.to],
    subject: input.subject,
    html: input.htmlBody,
    attachments: [
      {
        filename: input.filename,
        content: input.pdfBase64,
      },
    ],
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data?.id }
}
