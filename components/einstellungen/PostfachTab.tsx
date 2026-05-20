'use client'
import { useEffect, useState } from 'react'

/**
 * PostfachTab — Owner-Inbox + Broadcast + Member-Postfach.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 3a).
 *
 * Eigenständiger State für Inbox/Sent/Forms. Lädt Nachrichten beim Mount (skippt Demo).
 * `managedUsers` wird minimal typisiert reingereicht (Recipient-Auswahl + Namens-Lookup).
 */

type InboxMessage = {
  id: string
  subject: string
  body: string
  is_read: boolean
  created_at: string
}

type OwnerInboxMessage = InboxMessage & { user_id: string }

type OwnerSentMessage = {
  id: string
  owner_user_id: string
  subject: string
  body: string
  recipient_type: string
  recipient_user_id?: string
  created_at: string
}

type RecipientUser = {
  id: string
  email: string
  fullName: string
  isOwnerAccount: boolean
  accessStatus: 'pending' | 'active' | 'suspended'
}

export default function PostfachTab({
  isInhaberAccount,
  isDemo,
  showToast,
  managedUsers,
}: {
  isInhaberAccount: boolean
  isDemo: boolean
  showToast: (msg: string, type?: 'success' | 'error') => void
  managedUsers: RecipientUser[]
}) {
  const [userMessages, setUserMessages] = useState<InboxMessage[]>([])
  const [ownerInbox, setOwnerInbox] = useState<OwnerInboxMessage[]>([])
  const [ownerSentMessages, setOwnerSentMessages] = useState<OwnerSentMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' })
  const [broadcastForm, setBroadcastForm] = useState({
    subject: '',
    body: '',
    recipient_user_id: '',
    recipient_mode: 'all' as 'all' | 'single',
  })
  const [sendingMessage, setSendingMessage] = useState(false)
  const [postfachTab, setPostfachTab] = useState<'inbox' | 'sent'>('inbox')

  // Initial-Load beim Mount (Demo wird übersprungen)
  useEffect(() => {
    if (isDemo) return
    setLoadingMessages(true)
    const load = async () => {
      try {
        if (isInhaberAccount) {
          const res = await fetch('/api/messages?action=inbox')
          if (res.ok) {
            const data = await res.json()
            setOwnerInbox(data.messages ?? [])
          }
          const sentRes = await fetch('/api/messages?action=sent')
          if (sentRes.ok) {
            const sentData = await sentRes.json()
            setOwnerSentMessages(sentData.messages ?? [])
          }
        } else {
          const res = await fetch('/api/messages')
          if (res.ok) {
            const data = await res.json()
            setUserMessages(data.messages ?? [])
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden von Nachrichten:', err)
      } finally {
        setLoadingMessages(false)
      }
    }
    void load()
  }, [isInhaberAccount, isDemo])

  async function handleBroadcast() {
    if (!broadcastForm.subject.trim() || !broadcastForm.body.trim()) {
      showToast('Betreff und Text erforderlich', 'error')
      return
    }
    if (broadcastForm.recipient_mode === 'single' && !broadcastForm.recipient_user_id) {
      showToast('Bitte einen Nutzer auswählen', 'error')
      return
    }
    setSendingMessage(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          subject: broadcastForm.subject,
          body: broadcastForm.body,
          recipient_user_id:
            broadcastForm.recipient_mode === 'single' ? broadcastForm.recipient_user_id : undefined,
        }),
      })
      if (!res.ok) throw new Error('Versand fehlgeschlagen')
      const recipient = managedUsers.find(u => u.id === broadcastForm.recipient_user_id)
      const label =
        broadcastForm.recipient_mode === 'single'
          ? `Nachricht an ${recipient?.fullName || recipient?.email || 'Nutzer'} versendet`
          : 'Nachricht an alle Nutzer versendet'
      showToast(label)
      setBroadcastForm({ subject: '', body: '', recipient_user_id: '', recipient_mode: 'all' })
      const sentRes = await fetch('/api/messages?action=sent')
      if (sentRes.ok) {
        const sentData = await sentRes.json()
        setOwnerSentMessages(sentData.messages ?? [])
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler beim Versand', 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleSendSupport() {
    if (!messageForm.subject.trim() || !messageForm.body.trim()) {
      showToast('Betreff und Text erforderlich', 'error')
      return
    }
    setSendingMessage(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          subject: messageForm.subject,
          body: messageForm.body,
        }),
      })
      if (!res.ok) throw new Error('Versand fehlgeschlagen')
      showToast('Nachricht versendet! Der Support antwortet in Kürze.')
      setMessageForm({ subject: '', body: '' })
      const reloadRes = await fetch('/api/messages')
      if (reloadRes.ok) {
        const reloadData = await reloadRes.json()
        setUserMessages(reloadData.messages ?? [])
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fehler beim Versand', 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Inhaber-View: Inbox / Versendete + Broadcast-Form
  // ──────────────────────────────────────────────────────────────────────────
  if (isInhaberAccount) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>📬 Postfach & Support</h2>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            borderBottom: '1px solid rgba(255,255,255,.1)',
            paddingBottom: 12,
          }}
        >
          <button
            onClick={() => setPostfachTab('inbox')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: postfachTab === 'inbox' ? 'rgba(22,132,255,.1)' : 'rgba(255,255,255,.05)',
              color: postfachTab === 'inbox' ? '#20c8ff' : '#aeb9c8',
              border: `1px solid ${postfachTab === 'inbox' ? 'rgba(22,132,255,.3)' : 'rgba(255,255,255,.1)'}`,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all .15s',
            }}
          >
            📥 Eingang ({ownerInbox.length})
          </button>
          <button
            onClick={() => setPostfachTab('sent')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: postfachTab === 'sent' ? 'rgba(22,132,255,.1)' : 'rgba(255,255,255,.05)',
              color: postfachTab === 'sent' ? '#20c8ff' : '#aeb9c8',
              border: `1px solid ${postfachTab === 'sent' ? 'rgba(22,132,255,.3)' : 'rgba(255,255,255,.1)'}`,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all .15s',
            }}
          >
            📤 Versendete ({ownerSentMessages.length})
          </button>
        </div>

        {postfachTab === 'inbox' && (
          <div className="pk-card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800 }}>
              📥 Support-Anfragen von Nutzern
            </h3>
            {loadingMessages ? (
              <div style={{ color: '#aeb9c8' }}>Laden…</div>
            ) : ownerInbox.length === 0 ? (
              <div style={{ color: '#aeb9c8', fontSize: 13 }}>Keine neuen Nachrichten</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {ownerInbox.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: msg.is_read ? 'rgba(255,255,255,.02)' : 'rgba(22,132,255,.08)',
                      border: `1px solid ${msg.is_read ? 'rgba(255,255,255,.05)' : 'rgba(22,132,255,.3)'}`,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = msg.is_read
                        ? 'rgba(255,255,255,.04)'
                        : 'rgba(22,132,255,.12)'
                      e.currentTarget.style.borderColor = 'rgba(22,132,255,.5)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = msg.is_read
                        ? 'rgba(255,255,255,.02)'
                        : 'rgba(22,132,255,.08)'
                      e.currentTarget.style.borderColor = msg.is_read
                        ? 'rgba(255,255,255,.05)'
                        : 'rgba(22,132,255,.3)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 6,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{msg.subject}</div>
                      {!msg.is_read && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            background: '#1684ff',
                            borderRadius: 4,
                            color: 'white',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Ungelesen
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>{msg.body}</div>
                    <div style={{ fontSize: 11, color: '#6cb6ff' }}>
                      {new Date(msg.created_at).toLocaleDateString('de-DE')}{' '}
                      {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {postfachTab === 'sent' && (
          <div>
            <div className="pk-card" style={{ marginBottom: 24, padding: 16 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>
                ✉️ Neue Nachricht verfassen
              </h3>

              {/* Empfänger-Auswahl */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>Empfänger</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() =>
                      setBroadcastForm(prev => ({ ...prev, recipient_mode: 'all', recipient_user_id: '' }))
                    }
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      background:
                        broadcastForm.recipient_mode === 'all' ? 'rgba(22,132,255,.2)' : 'rgba(255,255,255,.05)',
                      color: broadcastForm.recipient_mode === 'all' ? '#6cb6ff' : '#aeb9c8',
                      border: `1px solid ${
                        broadcastForm.recipient_mode === 'all' ? 'rgba(22,132,255,.4)' : 'rgba(255,255,255,.1)'
                      }`,
                    }}
                  >
                    📢 Alle Nutzer
                  </button>
                  <button
                    onClick={() => setBroadcastForm(prev => ({ ...prev, recipient_mode: 'single' }))}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      background:
                        broadcastForm.recipient_mode === 'single'
                          ? 'rgba(22,132,255,.2)'
                          : 'rgba(255,255,255,.05)',
                      color: broadcastForm.recipient_mode === 'single' ? '#6cb6ff' : '#aeb9c8',
                      border: `1px solid ${
                        broadcastForm.recipient_mode === 'single'
                          ? 'rgba(22,132,255,.4)'
                          : 'rgba(255,255,255,.1)'
                      }`,
                    }}
                  >
                    👤 Einzelner Nutzer
                  </button>
                </div>
              </div>

              {/* Nutzer-Dropdown */}
              {broadcastForm.recipient_mode === 'single' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>Nutzer auswählen *</div>
                  {managedUsers.filter(u => !u.isOwnerAccount).length === 0 ? (
                    <div
                      style={{
                        color: '#aeb9c8',
                        fontSize: 13,
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,.04)',
                        borderRadius: 8,
                      }}
                    >
                      Keine Nutzer gefunden. Zunächst Nutzer unter <strong>Kundensteuerung</strong> anlegen.
                    </div>
                  ) : (
                    <select
                      className="pk-input"
                      value={broadcastForm.recipient_user_id}
                      onChange={e =>
                        setBroadcastForm(prev => ({ ...prev, recipient_user_id: e.target.value }))
                      }
                    >
                      <option value="">— Nutzer auswählen —</option>
                      {managedUsers
                        .filter(u => !u.isOwnerAccount)
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.fullName || u.email} (
                            {u.accessStatus === 'active'
                              ? 'Aktiv'
                              : u.accessStatus === 'pending'
                                ? 'Ausstehend'
                                : 'Gesperrt'}
                            )
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}

              {/* Betreff */}
              <label style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Betreff *</span>
                <input
                  className="pk-input"
                  value={broadcastForm.subject}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="z.B. Wichtige Benachrichtigung"
                />
              </label>

              {/* Text */}
              <label style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>Nachrichtentext *</span>
                <textarea
                  className="pk-input"
                  style={{ minHeight: 100, resize: 'vertical' }}
                  value={broadcastForm.body}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Nachricht eingeben…"
                />
              </label>

              <button className="pk-btn" onClick={handleBroadcast} disabled={sendingMessage}>
                {sendingMessage
                  ? '⏳ Wird gesendet…'
                  : broadcastForm.recipient_mode === 'single'
                    ? '📨 An Nutzer senden'
                    : '📢 Rundmail an alle senden'}
              </button>
            </div>

            <div className="pk-card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800 }}>
                📤 Versendete Nachrichten
              </h3>
              {loadingMessages ? (
                <div style={{ color: '#aeb9c8' }}>Laden…</div>
              ) : ownerSentMessages.length === 0 ? (
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Nachrichten versendet</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {ownerSentMessages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,.02)',
                        border: '1px solid rgba(255,255,255,.05)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 4,
                          gap: 8,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{msg.subject}</div>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            background:
                              msg.recipient_type === 'all'
                                ? 'rgba(22,132,255,.15)'
                                : 'rgba(37,211,102,.12)',
                            color: msg.recipient_type === 'all' ? '#6cb6ff' : '#4ddb7e',
                          }}
                        >
                          {msg.recipient_type === 'all' ? '📢 Alle' : '👤 Einzeln'}
                        </span>
                      </div>
                      {msg.recipient_type === 'single' && msg.recipient_user_id && (
                        <div style={{ fontSize: 11, color: '#20c8ff', marginBottom: 6 }}>
                          An:{' '}
                          {managedUsers.find(u => u.id === msg.recipient_user_id)?.fullName ||
                            managedUsers.find(u => u.id === msg.recipient_user_id)?.email ||
                            msg.recipient_user_id}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>{msg.body}</div>
                      <div style={{ fontSize: 11, color: '#6cb6ff' }}>
                        {new Date(msg.created_at).toLocaleDateString('de-DE')}{' '}
                        {new Date(msg.created_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Member-View: Nachricht an Support + eigene Historie
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>📬 Postfach</h2>

      <div className="pk-card" style={{ marginBottom: 24, padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800 }}>Nachricht an Support</h3>
        <label style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#aeb9c8' }}>Betreff *</span>
          <input
            className="pk-input"
            value={messageForm.subject}
            onChange={e => setMessageForm(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Beispiel: Frage zu LagerPilot"
          />
        </label>
        <label style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#aeb9c8' }}>Nachrichtentext *</span>
          <textarea
            className="pk-input"
            style={{ minHeight: 120, resize: 'vertical' }}
            value={messageForm.body}
            onChange={e => setMessageForm(prev => ({ ...prev, body: e.target.value }))}
            placeholder="Ihre Nachricht…"
          />
        </label>
        <button className="pk-btn" onClick={handleSendSupport} disabled={sendingMessage}>
          {sendingMessage ? '⏳ Wird versendet…' : '📬 Versenden'}
        </button>
      </div>

      <div className="pk-card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800 }}>📜 Versendete Nachrichten</h3>
        {loadingMessages ? (
          <div style={{ color: '#aeb9c8' }}>Laden…</div>
        ) : userMessages.length === 0 ? (
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Noch keine Nachrichten versendet</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {userMessages.map(msg => (
              <div
                key={msg.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.05)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{msg.subject}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>{msg.body}</div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#6cb6ff',
                  }}
                >
                  <span>
                    {new Date(msg.created_at).toLocaleDateString('de-DE')}{' '}
                    {new Date(msg.created_at).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.is_read ? (
                    <span style={{ color: '#25d366' }}>✓ Gelesen</span>
                  ) : (
                    <span style={{ color: '#f59e0b' }}>⏱️ Ungelesen</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
