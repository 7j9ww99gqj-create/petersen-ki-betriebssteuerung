'use client'
import { useEffect, useState } from 'react'
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushSubscription,
} from '@/lib/push'
import { Toggle } from './Toggle'

type NotifSettings = {
  wareneingaenge: boolean
  niedrigerBestand: boolean
  auftraege: boolean
  rechnungen: boolean
  cloudSync: boolean
  kiErkennungen: boolean
}

/**
 * BenachrichtigungenTab — In-App-Toggles + PWA-Push-Subscription.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 1).
 *
 * Eigenständiger State für In-App-Toggles, Push-Subscription, Stille-Stunden.
 * Push-Support wird beim Mount geprüft (isPushSupported + getCurrentPushSubscription).
 */
export default function BenachrichtigungenTab({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [notif, setNotif] = useState<NotifSettings>({
    wareneingaenge: true,
    niedrigerBestand: true,
    auftraege: true,
    rechnungen: true,
    cloudSync: false,
    kiErkennungen: true,
  })

  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushNotifTypes, setPushNotifTypes] = useState({
    postfach: true,
    fehler: true,
    erinnerungen: true,
    archiv: false,
  })
  const [pushStilleVon, setPushStilleVon] = useState('22:00')
  const [pushStilleBis, setPushStilleBis] = useState('07:00')

  useEffect(() => {
    const check = async () => {
      setPushSupported(isPushSupported())
      if (isPushSupported()) {
        const sub = await getCurrentPushSubscription()
        setPushEnabled(sub !== null)
      }
    }
    void check()

    const saved = localStorage.getItem('pk_notif')
    if (saved) setNotif(JSON.parse(saved) as NotifSettings)
  }, [])

  const handleNotifSave = () => {
    localStorage.setItem('pk_notif', JSON.stringify(notif))
    showToast('✅ Benachrichtigungseinstellungen gespeichert')
  }

  const handlePushToggle = async () => {
    if (pushLoading) return
    setPushLoading(true)
    try {
      if (pushEnabled) {
        const ok = await unsubscribeFromPush()
        if (ok) {
          await fetch('/api/push', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          setPushEnabled(false)
          showToast('Push-Benachrichtigungen deaktiviert')
        }
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          showToast('Benachrichtigungen wurden nicht erlaubt', 'error')
          return
        }
        const sub = await subscribeToPush()
        if (!sub) {
          showToast('Service Worker nicht verfügbar', 'error')
          return
        }
        const subJson = sub.toJSON()
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh ?? '',
              auth: subJson.keys?.auth ?? '',
            },
          }),
        })
        setPushEnabled(true)
        showToast('Push-Benachrichtigungen aktiviert!')
      }
    } catch (err) {
      console.error('[push toggle]', err)
      showToast('Fehler bei Push-Benachrichtigungen', 'error')
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pk-card">
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>🔔 In-App Benachrichtigungen</h3>
        <p style={{ margin: '0 0 20px', color: '#aeb9c8', fontSize: 14 }}>
          Legen Sie fest, welche System-Meldungen Sie erhalten möchten.
        </p>
        <Toggle
          checked={notif.wareneingaenge}
          onChange={() => setNotif(p => ({ ...p, wareneingaenge: !p.wareneingaenge }))}
          label="Wareneingänge"
          desc="Benachrichtigung bei neuen Wareneingängen im LagerPilot"
        />
        <Toggle
          checked={notif.niedrigerBestand}
          onChange={() => setNotif(p => ({ ...p, niedrigerBestand: !p.niedrigerBestand }))}
          label="Niedriger Bestand"
          desc="Alarm wenn Artikel unter den Mindestbestand fallen"
        />
        <Toggle
          checked={notif.auftraege}
          onChange={() => setNotif(p => ({ ...p, auftraege: !p.auftraege }))}
          label="Auftrags-Updates"
          desc="Statusänderungen bei Werkstatt-Aufträgen und Arbeitskarten"
        />
        <Toggle
          checked={notif.rechnungen}
          onChange={() => setNotif(p => ({ ...p, rechnungen: !p.rechnungen }))}
          label="Überfällige Rechnungen"
          desc="Erinnerung bei Zahlungsverzug im BüroPilot"
        />
        <Toggle
          checked={notif.cloudSync}
          onChange={() => setNotif(p => ({ ...p, cloudSync: !p.cloudSync }))}
          label="Cloud-Sync Status"
          desc="Meldungen zu Backup und Synchronisierungsstatus"
        />
        <Toggle
          checked={notif.kiErkennungen}
          onChange={() => setNotif(p => ({ ...p, kiErkennungen: !p.kiErkennungen }))}
          label="KI-Assistenten-Auswertungen"
          desc="Benachrichtigungen nach automatischer Dokumentenanalyse"
        />
        <div style={{ marginTop: 20 }}>
          <button className="pk-btn" onClick={handleNotifSave} style={{ fontWeight: 700 }}>
            Einstellungen speichern
          </button>
        </div>
      </div>

      {/* Design-Customization wurde in eigenen Menüpunkt „🎨 Design" verschoben */}

      {/* ── Push-Benachrichtigungen (PWA) ─────────────────────────────────── */}
      <div className="pk-card">
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>📲 Push-Benachrichtigungen</h3>
        <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 14 }}>
          Erhalten Sie Benachrichtigungen direkt auf Ihr Gerät, auch wenn die App nicht geöffnet ist.
        </p>

        {!pushSupported ? (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(255,165,0,.1)',
              border: '1px solid rgba(255,165,0,.3)',
              color: '#fbbf24',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            ⚠️ Push-Benachrichtigungen werden von diesem Browser nicht unterstützt. Bitte nutzen Sie Chrome, Firefox oder
            Safari 16+ als PWA.
          </div>
        ) : (
          <>
            {/* Haupt-Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 10,
                background: pushEnabled ? 'rgba(22,132,255,.08)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${pushEnabled ? 'rgba(22,132,255,.3)' : 'rgba(255,255,255,.1)'}`,
                marginBottom: 16,
                transition: 'all .2s',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: pushEnabled ? '#6cb6ff' : '#f8fbff' }}>
                  {pushEnabled ? '✅ Push aktiviert' : 'Push-Benachrichtigungen aktivieren'}
                </div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>
                  {pushEnabled ? 'Klicken zum Deaktivieren' : 'Permission-Anfrage beim Aktivieren'}
                </div>
              </div>
              <button
                onClick={handlePushToggle}
                disabled={pushLoading}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: pushEnabled ? 'rgba(244,63,94,.15)' : 'rgba(22,132,255,.2)',
                  color: pushEnabled ? '#fb7185' : '#6cb6ff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: pushLoading ? 'wait' : 'pointer',
                  transition: 'all .15s',
                }}
              >
                {pushLoading ? '⏳ Laden…' : pushEnabled ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>

            {/* Benachrichtigungstypen */}
            {pushEnabled && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#aeb9c8' }}>
                  Welche Benachrichtigungen?
                </div>
                <Toggle
                  checked={pushNotifTypes.postfach}
                  onChange={() => setPushNotifTypes(p => ({ ...p, postfach: !p.postfach }))}
                  label="Neue Nachrichten im Postfach"
                  desc="Wenn Sie eine neue Nachricht erhalten"
                />
                <Toggle
                  checked={pushNotifTypes.fehler}
                  onChange={() => setPushNotifTypes(p => ({ ...p, fehler: !p.fehler }))}
                  label="Fehler & Systemwarnungen"
                  desc="Kritische Systemfehler und Warnungen"
                />
                <Toggle
                  checked={pushNotifTypes.erinnerungen}
                  onChange={() => setPushNotifTypes(p => ({ ...p, erinnerungen: !p.erinnerungen }))}
                  label="Erinnerungen & Fälligkeiten"
                  desc="Fällige Rechnungen, Termine und Deadlines"
                />
                <Toggle
                  checked={pushNotifTypes.archiv}
                  onChange={() => setPushNotifTypes(p => ({ ...p, archiv: !p.archiv }))}
                  label="Archiv-Updates"
                  desc="Neue Dokumente im Archiv"
                />
              </div>
            )}

            {/* Stille Stunden */}
            {pushEnabled && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.08)',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🌙 Stille Stunden</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>Von</span>
                  <input
                    className="pk-input"
                    type="time"
                    value={pushStilleVon}
                    onChange={e => setPushStilleVon(e.target.value)}
                    style={{ maxWidth: 110 }}
                  />
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>bis</span>
                  <input
                    className="pk-input"
                    type="time"
                    value={pushStilleBis}
                    onChange={e => setPushStilleBis(e.target.value)}
                    style={{ maxWidth: 110 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                  In dieser Zeit werden keine Push-Benachrichtigungen gesendet.
                </div>
              </div>
            )}
          </>
        )}

        {/* Info-Box */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(22,132,255,.06)',
            border: '1px solid rgba(22,132,255,.15)',
            fontSize: 12,
            color: '#6cb6ff',
          }}
        >
          💡 <strong>Tipp:</strong> Für beste Push-Unterstützung die App als PWA auf dem Startbildschirm hinzufügen:
          Safari → Teilen → &bdquo;Zum Home-Bildschirm hinzufügen&ldquo; · Chrome → Menü → &bdquo;App installieren&ldquo;
        </div>
      </div>
    </div>
  )
}
