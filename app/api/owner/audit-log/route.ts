import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import { listOwnerAuditLog, logOwnerAction, type OwnerAuditAction } from '@/lib/audit-log'

export const runtime = 'nodejs'

const OWNER_EMAIL = 'info@petersen-ki-pilot.de'

const ALLOWED_ACTIONS: OwnerAuditAction[] = [
  'customer.unlock',
  'customer.suspend',
  'customer.status_change',
  'pondruff_flag.toggle',
  'invoice.create',
]

function isOwner(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase()
}

export async function GET(req: NextRequest) {
  const access = await getRouteAccess(req, ['Admin', 'Inhaber'])
  if (access.error) return access.error
  if (!isOwner(access.user?.email)) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }
  const url = new URL(req.url)
  const limitParam = Number(url.searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200 ? Math.trunc(limitParam) : 20
  const entries = await listOwnerAuditLog(limit)
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const access = await getRouteAccess(req, ['Admin', 'Inhaber'])
  if (access.error) return access.error
  if (!isOwner(access.user?.email)) {
    return NextResponse.json({ error: 'Nur fuer den Inhaber-Account verfuegbar.' }, { status: 403 })
  }

  let body: {
    action?: string
    target?: { userId?: string | null; email?: string | null }
    details?: Record<string, unknown>
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Ungueltige Anfrage.' }, { status: 400 })
  }

  const action = body.action as OwnerAuditAction | undefined
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  }

  await logOwnerAction({
    actor: { userId: access.user?.id, email: access.user?.email },
    action,
    target: body.target ? { userId: body.target.userId, email: body.target.email } : undefined,
    details: body.details && typeof body.details === 'object' ? body.details : undefined,
  })

  return NextResponse.json({ ok: true })
}
