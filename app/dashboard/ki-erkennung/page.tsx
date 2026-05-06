'use client'
import { useState } from 'react'

type RecognitionResult = {
  type: string
  confidence: number
  fields: Record<string, string>
  raw: string
}

export default function KiErkennungPage() {
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: 'Hallo! Ich bin Ihre KI-Erkennung. Laden Sie ein Dokument hoch oder stellen Sie mir eine Frage zu Ihrem Lager.' }
  ])
  const [chatLoading, setChatLoading] = useState(false)

  const simulateRecognition = () => {
    setStage('uploading')
    setTimeout(() => {
      setStage('analyzing')
      setTimeout(() => {
        setResult({
          type: 'Lieferschein',
          confidence: 97,
          fields: {
            'Lieferant': 'Metallbau GmbH & Co. KG',
            'Lieferschein-Nr.': 'LS-2025-08847',
            'Datum': '06.05.2025',
            'Artikel 1': 'Stahlrohr 40x40 – 50 Stk',
            'Artikel 2': 'Schrauben M8x30 – 500 Stk',
            'Gewicht gesamt': '124,5 kg',
            'Empfänger': 'Petersen KI Betriebssteuerung',
          },
          raw: 'Lieferschein erkannt mit 97% Konfidenz. Alle Felder wurden automatisch extrahiert und können jetzt in den Wareneingang übertragen werden.',
        })
        setStage('done')
      }, 2200)
    }, 800)
  }

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoading) return
    const userMsg = chatMsg.trim()
    setChatMsg('')
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Du bist der KI-Assistent der "Petersen KI Betriebssteuerung", einem modularen Warenwirtschaftssystem. Du hilfst bei Fragen zu Lager, Wareneingang, Warenausgang, Artikeln, Dokumentenerkennung und Betriebsabläufen. Antworte auf Deutsch, professionell und präzise. Halte Antworten kurz und hilfreich.`,
          messages: [
            ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user' as const, content: userMsg }
          ],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const reply = data.content?.[0]?.text || 'Entschuldigung, ich konnte keine Antwort generieren.'
        setChatHistory(prev => [...prev, { role: 'assistant', content: reply }])
      } else {
        // Fallback demo response
        const demos: Record<string, string> = {
          default: 'Im Demo-Modus simuliere ich KI-Antworten. Mit einem Anthropic API Key (in .env.local) aktivieren Sie den echten KI-Chat.',
        }
        const keywords = ['lager', 'bestand', 'artikel', 'lieferschein', 'eingang', 'ausgang']
        const matched = keywords.find(k => userMsg.toLowerCase().includes(k))
        const reply = matched
          ? `Zu "${matched}": Im LagerPilot finden Sie alle Informationen dazu. ${demos.default}`
          : demos.default
        setChatHistory(prev => [...prev, { role: 'assistant', content: reply }])
      }
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Demo-Modus: Konfigurieren Sie ANTHROPIC_API_KEY in .env.local für den echten KI-Chat.' }])
    }
    setChatLoading(false)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🧠</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>KI Erkennung</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Dokumente & Fotos automatisch erfassen · KI-Chat</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Document recognition */}
        <div>
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>📸 Dokument-Erkennung</h3>
            <p style={{ margin: '0 0 16px', color: '#aeb9c8', fontSize: 13 }}>
              Laden Sie ein Foto eines Lieferscheins, einer Rechnung oder eines Dokuments hoch – die KI extrahiert alle relevanten Daten automatisch.
            </p>

            {stage === 'idle' && (
              <div>
                <div
                  style={{
                    border: '2px dashed rgba(22,132,255,.3)', borderRadius: 16,
                    padding: '40px 20px', textAlign: 'center', marginBottom: 14,
                    background: 'rgba(22,132,255,.04)', cursor: 'pointer',
                    transition: 'border-color .2s, background .2s',
                  }}
                  onClick={simulateRecognition}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = 'rgba(22,132,255,.6)'
                    el.style.background = 'rgba(22,132,255,.08)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = 'rgba(22,132,255,.3)'
                    el.style.background = 'rgba(22,132,255,.04)'
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Dokument hochladen</div>
                  <div style={{ color: '#aeb9c8', fontSize: 13 }}>Klicken zum Demo-Start · JPG, PNG, PDF</div>
                </div>
                <button className="pk-btn" onClick={simulateRecognition} style={{ width: '100%', fontWeight: 700 }}>
                  🧠 Demo: Lieferschein erkennen
                </button>
              </div>
            )}

            {stage === 'uploading' && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⬆️</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Dokument wird hochgeladen…</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Bitte warten</div>
              </div>
            )}

            {stage === 'analyzing' && (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ width: 48, height: 48, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>KI analysiert Dokument…</div>
                <div style={{ color: '#aeb9c8', fontSize: 13 }}>Daten werden extrahiert</div>
              </div>
            )}

            {stage === 'done' && result && (
              <div>
                <div style={{
                  padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                  background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.25)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#4ddb7e' }}>
                      {result.type} erkannt – {result.confidence}% Konfidenz
                    </div>
                    <div style={{ fontSize: 12, color: '#aeb9c8' }}>{result.raw}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                  {Object.entries(result.fields).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)',
                    }}>
                      <span style={{ fontSize: 12, color: '#aeb9c8' }}>{key}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="pk-btn" style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>
                    📥 In Wareneingang übernehmen
                  </button>
                  <button className="pk-btn-ghost" onClick={() => setStage('idle')} style={{ fontSize: 13 }}>
                    Neu
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent recognitions */}
          <div className="pk-card">
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>Letzte Erkennungen</h3>
            {[
              { doc: 'Lieferschein LS-2025-08844', time: 'Vor 2h', conf: 99, typ: '📄' },
              { doc: 'Rechnung RE-2025-1123', time: 'Gestern', conf: 95, typ: '🧾' },
              { doc: 'Artikelfoto Stahlrohr', time: 'Gestern', conf: 88, typ: '📸' },
            ].map(r => (
              <div key={r.doc} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,.05)',
              }}>
                <span style={{ fontSize: 20 }}>{r.typ}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.doc}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{r.time}</div>
                </div>
                <span className="badge badge-green">{r.conf}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* KI Chat */}
        <div className="pk-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 500 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>💬 KI-Assistent</h3>
          <p style={{ margin: '0 0 14px', color: '#aeb9c8', fontSize: 13 }}>
            Stellen Sie Fragen zu Ihrem Lager, Artikeln oder Prozessen.
          </p>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 360 }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.5,
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #1684ff, #005bea)'
                    : 'rgba(255,255,255,.07)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,.1)',
                  color: msg.role === 'user' ? 'white' : '#f8fbff',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', fontSize: 14 }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#aeb9c8',
                        animation: `pulse 1.2s ${i * 0.2}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="pk-input"
              placeholder="Frage eingeben… z.B. 'Welche Artikel haben niedrigen Bestand?'"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              style={{ flex: 1 }}
            />
            <button
              className="pk-btn"
              onClick={sendChat}
              disabled={chatLoading || !chatMsg.trim()}
              style={{ padding: '0 18px', fontWeight: 700, flexShrink: 0 }}
            >
              →
            </button>
          </div>

          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)', fontSize: 11, color: '#93b8ff' }}>
            💡 Demo: ANTHROPIC_API_KEY in .env.local für echte KI-Antworten eintragen
          </div>
        </div>
      </div>
    </div>
  )
}
