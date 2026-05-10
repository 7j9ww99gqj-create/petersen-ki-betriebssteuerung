'use client'
import { useState, useEffect } from 'react'

export default function CloudPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(100)
  const [lastSync, setLastSync] = useState('Vor 2 Minuten')
  const [syncLog, setSyncLog] = useState([
    { time: '14:22', action: 'LagerPilot Bestände synchronisiert', status: 'ok' },
    { time: '14:20', action: 'Neuer Wareneingang gespeichert', status: 'ok' },
    { time: '13:58', action: 'KI-Assistent Ergebnis archiviert', status: 'ok' },
    { time: '13:40', action: 'BüroPilot Rechnungen synchronisiert', status: 'ok' },
    { time: '12:15', action: 'Verbindung kurz unterbrochen', status: 'warn' },
    { time: '12:16', action: 'Automatisch wiederverbunden', status: 'ok' },
  ])

  const triggerSync = () => {
    setSyncing(true)
    setSyncProgress(0)
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setSyncing(false)
          setLastSync('Gerade eben')
          setSyncLog(prev => [
            { time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), action: 'Manueller Sync abgeschlossen', status: 'ok' },
            ...prev,
          ])
          return 100
        }
        return prev + 8
      })
    }, 120)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(32,200,255,.15)', border: '1px solid rgba(32,200,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>☁️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>Cloud & Sync</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Datensicherung · Echtzeit-Synchronisation · Zugriff überall</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● ONLINE</span>
      </div>

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Cloud-Status', value: 'Verbunden', icon: '🟢', color: '#10b981' },
          { label: 'Letzter Sync', value: lastSync, icon: '🔄', color: '#1684ff' },
          { label: 'Gespeicherte Daten', value: '2,4 GB', icon: '💾', color: '#a78bfa' },
          { label: 'Verbundene Geräte', value: '3', icon: '📱', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Sync control */}
        <div>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>🔄 Synchronisation</h3>

            {syncing ? (
              <div>
                <div style={{ marginBottom: 10, fontSize: 14, color: '#aeb9c8' }}>
                  Synchronisierung läuft… {syncProgress}%
                </div>
                <div style={{
                  height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)',
                  overflow: 'hidden', marginBottom: 16,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: 'linear-gradient(90deg, #1684ff, #20c8ff)',
                    width: `${syncProgress}%`,
                    transition: 'width .15s',
                    boxShadow: '0 0 10px rgba(22,132,255,.5)',
                  }} />
                </div>
                <div style={{ fontSize: 13, color: '#aeb9c8' }}>
                  {syncProgress < 30 && '📦 LagerPilot wird synchronisiert…'}
                  {syncProgress >= 30 && syncProgress < 60 && '🧾 BüroPilot wird synchronisiert…'}
                  {syncProgress >= 60 && syncProgress < 85 && '🧠 KI-Assistenten-Auswertungen werden gesichert…'}
                  {syncProgress >= 85 && '✅ Abschließende Prüfung…'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                  background: 'rgba(37,211,102,.08)', border: '1px solid rgba(37,211,102,.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#4ddb7e' }}>Alles synchronisiert</div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>Letzter Sync: {lastSync}</div>
                  </div>
                </div>
                <button className="pk-btn" onClick={triggerSync} style={{ width: '100%', fontWeight: 700 }}>
                  ☁️ Jetzt synchronisieren
                </button>
              </div>
            )}
          </div>

          {/* Modules */}
          <div className="pk-card">
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>Pilot-Module</h3>
            {[
              { name: 'LagerPilot', size: '820 MB', status: 'sync', icon: '📦' },
              { name: 'BüroPilot', size: '340 MB', status: 'sync', icon: '🧾' },
              { name: 'KI-Assistenten-Auswertungen', size: '1,1 GB', status: 'sync', icon: '🧠' },
              { name: 'WerkstattPilot', size: '95 MB', status: 'sync', icon: '🛠️' },
              { name: 'Archiv', size: '65 MB', status: 'sync', icon: '🗂️' },
            ].map(m => (
              <div key={m.name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                borderBottom: '1px solid rgba(255,255,255,.04)',
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{m.size}</div>
                </div>
                <span className="badge badge-green">✓ Sync</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync log */}
        <div className="pk-card">
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>📋 Sync-Protokoll</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {syncLog.map((log, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)',
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>{log.status === 'ok' ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: log.status === 'warn' ? '#f59e0b' : '#f8fbff' }}>
                    {log.action}
                  </div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{log.time} Uhr</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 20 }}>
        {[
          { icon: '🔒', title: 'Verschlüsselt', desc: 'Alle Daten sind AES-256 verschlüsselt und sicher übertragen.' },
          { icon: '🌍', title: 'Überall verfügbar', desc: 'Zugriff von Smartphone, Tablet, Laptop und PC.' },
          { icon: '⚡', title: 'Echtzeit-Sync', desc: 'Änderungen werden sofort auf alle Geräte übertragen.' },
          { icon: '🔁', title: 'Automatisches Backup', desc: 'Tägliche Datensicherung, 30 Tage Verlauf.' },
        ].map(c => (
          <div key={c.title} className="pk-card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
