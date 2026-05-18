import { NextRequest, NextResponse } from 'next/server'
import { getRouteAccess } from '@/lib/server-auth'
import {
  getUserMessages,
  insertUserMessage,
  markUserMessageAsRead,
  getOwnerInbox,
  insertBroadcastMessage,
  getOwnerSentMessages,
} from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const access = await getRouteAccess(request)
    if (access.error) return access.error

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'inbox') {
      // Owner liest sein Inbox (alle Support-Anfragen)
      if (access.role !== 'Inhaber') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const messages = await getOwnerInbox()
      return NextResponse.json({ messages })
    }

    if (action === 'sent') {
      // Owner liest seine gesendeten Nachrichten
      if (access.role !== 'Inhaber') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const messages = await getOwnerSentMessages()
      return NextResponse.json({ messages })
    }

    // Standard: User liest seine Nachrichten
    const messages = await getUserMessages()
    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Fehler beim Abrufen von Nachrichten:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen von Nachrichten' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getRouteAccess(request)
    if (access.error) return access.error

    const body = await request.json()
    const { action, subject, body: messageBody, recipient_user_id } = body

    if (action === 'send') {
      // User sendet Support-Anfrage
      if (!subject?.trim() || !messageBody?.trim()) {
        return NextResponse.json(
          { error: 'Betreff und Text erforderlich' },
          { status: 400 }
        )
      }
      const message = await insertUserMessage({
        subject: subject.trim(),
        body: messageBody.trim(),
      })
      return NextResponse.json({ message }, { status: 201 })
    }

    if (action === 'broadcast') {
      // Owner sendet Nachricht an User(s)
      if (access.role !== 'Inhaber') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!subject?.trim() || !messageBody?.trim()) {
        return NextResponse.json(
          { error: 'Betreff und Text erforderlich' },
          { status: 400 }
        )
      }
      const message = await insertBroadcastMessage({
        subject: subject.trim(),
        body: messageBody.trim(),
        recipient_type: recipient_user_id ? 'single' : 'all',
        recipient_user_id: recipient_user_id || undefined,
      })
      return NextResponse.json({ message }, { status: 201 })
    }

    if (action === 'mark_read') {
      // Owner markiert Nutzer-Nachricht als gelesen
      if (access.role !== 'Inhaber') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const messageId = body.messageId
      if (!messageId) {
        return NextResponse.json(
          { error: 'messageId erforderlich' },
          { status: 400 }
        )
      }
      await markUserMessageAsRead(messageId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Fehler beim Verarbeiten von Nachrichten:', error)
    return NextResponse.json(
      { error: 'Fehler beim Verarbeiten' },
      { status: 500 }
    )
  }
}
