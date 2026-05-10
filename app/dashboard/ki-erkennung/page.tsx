'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ─── Demo-Daten ───────────────────────────────────────────────────────────────

type DemoAufgabe = {
  id: string
  titel: string
  status: 'Offen' | 'In Arbeit' | 'Erledigt'
  prioritaet: 'Hoch' | 'Mittel' | 'Niedrig'
  projekt: string
}

type DemoKarte = {
  id: string
  titel: string
  status: 'Offen' | 'In Arbeit' | 'Fertig'
  prioritaet: 'Kritisch' | 'Hoch' | 'Normal' | 'Niedrig'
  fahrzeug: string
}

type DemoArtikel = {
  id: string
  name: string
  bestand: number
  mindestbestand: number
  einheit: string
  status: 'ok' | 'niedrig' | 'leer'
  vorschlag: number
}

type DemoRechnung = {
  id: string
  rechnungsnummer: string
  kunde: string
  betrag: number
  status: 'Entwurf' | 'Offen' | 'Bezahlt' | 'Überfällig' | 'Mahnung'
  faelligAm: string
  tageUeberfaellig: number
}

const demoAufgaben: DemoAufgabe[] = [
  { id: 'A1', titel: 'Angebot AN-2025-0042 finalisieren', status: 'Offen', prioritaet: 'Hoch', projekt: 'Büro' },
  { id: 'A2', titel: 'Inventur Q2 durchführen', status: 'In Arbeit', prioritaet: 'Hoch', projekt: 'Lager' },
  { id: 'A3', titel: 'Lieferantenvergleich Stahlrohr', status: 'Offen', prioritaet: 'Mittel', projekt: 'Einkauf' },
]

const demoKarten: DemoKarte[] = [
  { id: 'K1', titel: 'Bremsanlage erneuern – Fahrzeug HH-KP-42', status: 'Offen', prioritaet: 'Kritisch', fahrzeug: 'HH-KP-42' },
  { id: 'K2', titel: 'Ölwechsel – Fahrzeug HH-AB-11', status: 'In Arbeit', prioritaet: 'Hoch', fahrzeug: 'HH-AB-11' },
]

const demoArtikel: DemoArtikel[] = [
  { id: 'L1', name: 'Motoröl 5W-30 (5L)', bestand: 2, mindestbestand: 10, einheit: 'Stk', status: 'niedrig', vorschlag: 20 },
  { id: 'L2', name: 'Bremsflüssigkeit DOT4', bestand: 0, mindestbestand: 5, einheit: 'Fl.', status: 'leer', vorschlag: 10 },
  { id: 'L3', name: 'Luftfilter Universal', bestand: 3, mindestbestand: 8, einheit: 'Stk', status: 'niedrig', vorschlag: 15 },
  { id: 'L4', name: 'Zündkerzen NGK BKR6E', bestand: 0, mindestbestand: 12, einheit: 'Stk', status: 'leer', vorschlag: 24 },
]

const demoRechnungen: DemoRechnung[] = [
  { id: 'R1', rechnungsnummer: 'RE-2025-0089', kunde: 'Müller & Söhne GmbH', betrag: 4850.00, status: 'Überfällig', faelligAm: '2025-04-10', tageUeberfaellig: 27 },
  { id: 'R2', rechnungsnummer: 'RE-2025-0076', kunde: 'Bauer Transporte KG', betrag: 1290.50, status: 'Mahnung', faelligAm: '2025-03-28', tageUeberfaellig: 40 },
]

// ─── Typen ────────────────────────────────────────────────────────────────────

type RecognitionResult = {
  type: string
  confidence: number
  fields: Record<string, string>
  raw: string
}

type KiAction = {
  type: 'umlagerung' | 'bestellung' | 'hinweis'
  artikel?: string
  von?: string
  nach?: string
  menge?: number
  beschreibung?: string
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; actions?: KiAction[] }

type Tab = 'tagesbrief' | 'erkennung' | 'chat'

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatEuro(val: number) {
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function KiErkennungPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('tagesbrief')

  // Tab: Tagesbrief
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefText, setBriefText] = useState<string | null>(null)

  // Tab: Erkennung
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing' | 'done'>('idle')
  const [result, setResult] = useState<RecognitionResult | null>(null)

  // Tab: Chat
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hallo! Ich bin Ihr KI-Assistent. Fragen Sie mich zu Lager, Aufgaben, Rechnungen oder Betriebsabläufen.' },
  ])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Tagesbrief beim ersten Laden generieren
  useEffect(() => {
    generateBrief()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chat auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  // ── Tagesbrief generieren ──────────────────────────────────────────────────

  async function generateBrief() {
    setBriefLoading(true)
    setBriefText(null)

    const offeneAufgaben = demoAufgaben.filter(a => a.status === 'Offen' || a.status === 'In Arbeit')
    const kritischeKarten = demoKarten.filter(k => k.status !== 'Fertig' && (k.prioritaet === 'Kritisch' || k.prioritaet === 'Hoch'))
    const nachbestellArtikel = demoArtikel.filter(a => a.status === 'niedrig' || a.status === 'leer')
    const ueberfaelligeRechnungen = demoRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung')

    const contextStr = `
Aktuelle Betriebsdaten (heute, ${new Date().toLocaleDateString('de-DE')}):
- Offene/laufende Aufgaben: ${offeneAufgaben.length} (${offeneAufgaben.map(a => a.titel).join(', ')})
- Kritische/hohe Werkstatt-Arbeitskarten: ${kritischeKarten.length} (${kritischeKarten.map(k => k.titel).join(', ')})
- Artikel mit Nachbestellbedarf: ${nachbestellArtikel.length} (${nachbestellArtikel.map(a => a.name).join(', ')})
- Überfällige/gemahnte Rechnungen: ${ueberfaelligeRechnungen.length} (${ueberfaelligeRechnungen.map(r => `${r.rechnungsnummer} – ${r.kunde}`).join(', ')})
`.trim()

    const prompt = `Erstelle einen kurzen, konkreten Tagesbrief (max. 4 Sätze) basierend auf folgenden Daten. Beginne mit "Heute, [Wochentag]," und gib am Ende 1-2 priorisierte Empfehlungen.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: contextStr,
          messages: [{ role: 'user', content: prompt }],
          system: 'Du bist der KI-Tagesassistent der Petersen KI Betriebssteuerung. Antworte präzise auf Deutsch.',
        }),
      })
      const data = await res.json() as { reply: string }
      if (data.reply && !data.reply.startsWith('Demo-Modus')) {
        setBriefText(data.reply)
      } else {
        setBriefText(buildStaticBrief(offeneAufgaben.length, nachbestellArtikel.length, ueberfaelligeRechnungen.length, kritischeKarten.length))
      }
    } catch {
      setBriefText(buildStaticBrief(offeneAufgaben.length, nachbestellArtikel.length, ueberfaelligeRechnungen.length, kritischeKarten.length))
    }

    setBriefLoading(false)
  }

  function buildStaticBrief(aufgaben: number, artikel: number, rechnungen: number, karten: number) {
    const tag = new Date().toLocaleDateString('de-DE', { weekday: 'long' })
    return `Heute, ${tag}, sind ${aufgaben} Aufgaben offen, ${karten} Arbeitskarte${karten !== 1 ? 'n' : ''} kritisch/hoch priorisiert, ${artikel} Artikel müssen nachbestellt werden und ${rechnungen} Rechnung${rechnungen !== 1 ? 'en sind' : ' ist'} überfällig. Empfehlung: Starten Sie mit der kritischen Werkstatt-Arbeitskarte, prüfen Sie dann die überfälligen Rechnungen und lösen Sie den Bestellvorschlag aus.`
  }

  // ── Dokument-Erkennung ─────────────────────────────────────────────────────

  function simulateRecognition() {
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

  // ── KI-Chat ────────────────────────────────────────────────────────────────

  async function sendChat() {
    if (!chatMsg.trim() || chatLoading) return
    const userMsg = chatMsg.trim()
    setChatMsg('')
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMsg }]
    setChatHistory(newHistory)
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map(m => ({ role: m.role, content: m.content })),
          system: 'Du bist der KI-Assistent der Petersen KI Betriebssteuerung, einem modularen Warenwirtschaftssystem. Du hilfst bei Fragen zu Lager, Wareneingang, Warenausgang, Artikeln, Dokumentenerkennung, Werkstatt, Planung und Betriebsabläufen.',
          structuredOutput: true,
        }),
      })
      const data = await res.json() as { reply: string; actions?: KiAction[] }
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Keine Antwort erhalten.',
        actions: data.actions ?? [],
      }])
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Demo-Modus: ANTHROPIC_API_KEY in .env.local für echte KI-Antworten eintragen.' }])
    }
    setChatLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    border: 'none',
    transition: 'all .18s',
    background: activeTab === t ? 'rgba(167,139,250,.18)' : 'transparent',
    color: activeTab === t ? '#a78bfa' : '#aeb9c8',
    borderBottom: activeTab === t ? '2px solid #a78bfa' : '2px solid transparent',
  })

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(167,139,250,.15)', border: '1px solid rgba(167,139,250,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>🧠</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>KI-Assistent</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Tagesbrief · Dokument-Erkennung · Chat</p>
        </div>
      </div>

      {/* Tab-Leiste */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 0 }}>
        <button style={tabStyle('tagesbrief')} onClick={() => setActiveTab('tagesbrief')}>🧠 Tagesbrief</button>
        <button style={tabStyle('erkennung')} onClick={() => setActiveTab('erkennung')}>📸 Dokument-Erkennung</button>
        <button style={tabStyle('chat')} onClick={() => setActiveTab('chat')}>💬 KI-Chat</button>
      </div>

      {/* ── Tab 1: Tagesbrief ── */}
      {activeTab === 'tagesbrief' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KI-Zusammenfassung */}
          <div className="pk-card" style={{ borderColor: 'rgba(167,139,250,.3)', background: 'rgba(167,139,250,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#a78bfa' }}>✨ KI-Tagesbrief</h3>
              <button
                className="pk-btn-ghost"
                onClick={generateBrief}
                disabled={briefLoading}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ display: 'inline-block', animation: briefLoading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                Tagesbrief aktualisieren
              </button>
            </div>

            {briefLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                <div style={{ width: 28, height: 28, border: '3px solid rgba(167,139,250,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ color: '#aeb9c8', fontSize: 14 }}>Tagesbrief wird generiert…</span>
              </div>
            ) : briefText ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#f0f4ff' }}>{briefText}</p>
            ) : null}
          </div>

          {/* Karte 1: Was muss heute erledigt werden? */}
          <div className="pk-card">
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📋 Was muss heute erledigt werden?</h3>

            {/* Aufgaben */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                PlanungPilot – Aufgaben
              </div>
              {demoAufgaben
                .filter(a => a.status === 'Offen' || a.status === 'In Arbeit')
                .sort((a, b) => (a.prioritaet === 'Hoch' ? -1 : b.prioritaet === 'Hoch' ? 1 : 0))
                .map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 6,
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: a.prioritaet === 'Hoch' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.15)',
                      color: a.prioritaet === 'Hoch' ? '#f87171' : '#fb923c',
                    }}>{a.prioritaet}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.titel}</span>
                    <span style={{ fontSize: 12, color: '#aeb9c8' }}>{a.status}</span>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => router.push('/dashboard/planung')}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >➜</button>
                  </div>
                ))}
            </div>

            {/* Werkstatt-Karten */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                WerkstattPilot – Kritische Arbeitskarten
              </div>
              {demoKarten
                .filter(k => k.status !== 'Fertig' && (k.prioritaet === 'Kritisch' || k.prioritaet === 'Hoch'))
                .map(k => (
                  <div key={k.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 6,
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(239,68,68,.15)',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: k.prioritaet === 'Kritisch' ? 'rgba(239,68,68,.2)' : 'rgba(251,146,60,.15)',
                      color: k.prioritaet === 'Kritisch' ? '#f87171' : '#fb923c',
                    }}>{k.prioritaet}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{k.titel}</span>
                    <span style={{ fontSize: 12, color: '#aeb9c8' }}>{k.status}</span>
                    <button
                      className="pk-btn-ghost"
                      onClick={() => router.push('/dashboard/werkstatt')}
                      style={{ fontSize: 12, padding: '4px 10px' }}
                    >➜</button>
                  </div>
                ))}
            </div>
          </div>

          {/* Karte 2: Welche Artikel müssen nachbestellt werden? */}
          <div className="pk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🛒 Welche Artikel müssen nachbestellt werden?</h3>
              <button
                className="pk-btn-ghost"
                onClick={() => router.push('/dashboard/lager')}
                style={{ fontSize: 12 }}
              >→ Bestellvorschlag öffnen</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {demoArtikel.filter(a => a.status === 'niedrig' || a.status === 'leer').map(a => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${a.status === 'leer' ? 'rgba(239,68,68,.2)' : 'rgba(251,146,60,.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>Mindestbestand: {a.mindestbestand} {a.einheit}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>Bestand</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: a.status === 'leer' ? '#f87171' : '#fb923c' }}>{a.bestand}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>Vorschlag</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#4ddb7e' }}>+{a.vorschlag}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: a.status === 'leer' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.12)',
                    color: a.status === 'leer' ? '#f87171' : '#fb923c',
                  }}>{a.status === 'leer' ? 'Leer' : 'Niedrig'}</span>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/lager')}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >➜</button>
                </div>
              ))}
            </div>
          </div>

          {/* Karte 3: Welche Kunden sollte ich heute kontaktieren? */}
          <div className="pk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>👥 Welche Kunden sollte ich heute kontaktieren?</h3>
              <button
                className="pk-btn-ghost"
                onClick={() => router.push('/dashboard/buero')}
                style={{ fontSize: 12 }}
              >→ BüroPilot öffnen</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {demoRechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung').map(r => (
                <div key={r.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,.03)', border: `1px solid ${r.status === 'Mahnung' ? 'rgba(239,68,68,.25)' : 'rgba(251,146,60,.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.kunde}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{r.rechnungsnummer} · fällig seit {r.tageUeberfaellig} Tagen</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{formatEuro(r.betrag)}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: r.status === 'Mahnung' ? 'rgba(239,68,68,.15)' : 'rgba(251,146,60,.12)',
                    color: r.status === 'Mahnung' ? '#f87171' : '#fb923c',
                  }}>{r.status}</span>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>{r.tageUeberfaellig}d überfällig</span>
                  <button
                    className="pk-btn-ghost"
                    onClick={() => router.push('/dashboard/buero')}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >→ Rechnung öffnen</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Dokument-Erkennung ── */}
      {activeTab === 'erkennung' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Erkennung Hauptbereich */}
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

            {/* Letzte Erkennungen */}
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

          {/* Info-Bereich */}
          <div className="pk-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>📋 Unterstützte Dokumenttypen</h3>
            {[
              { icon: '📄', name: 'Lieferscheine', desc: 'Lieferant, Artikel, Mengen, Datum' },
              { icon: '🧾', name: 'Rechnungen', desc: 'Betrag, MwSt, Positionen, Zahlungsziel' },
              { icon: '📦', name: 'Packzettel', desc: 'Artikelnummern, Chargen, Gewichte' },
              { icon: '📸', name: 'Artikelfotos', desc: 'Artikelidentifikation, Barcode-Scan' },
              { icon: '📝', name: 'Bestellungen', desc: 'Bestellnummern, Positionen, Preise' },
            ].map(dt => (
              <div key={dt.name} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{dt.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{dt.name}</div>
                  <div style={{ color: '#aeb9c8', fontSize: 12 }}>{dt.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)', fontSize: 12, color: '#c4b5fd' }}>
              💡 Im Demo-Modus werden Erkennungsergebnisse simuliert. Mit ANTHROPIC_API_KEY wird echte OCR-Erkennung aktiviert.
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: KI-Chat ── */}
      {activeTab === 'chat' && (
        <div className="pk-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>💬 KI-Assistent</h3>
          <p style={{ margin: '0 0 14px', color: '#aeb9c8', fontSize: 13 }}>
            Stellen Sie Fragen zu Ihrem Lager, Artikeln, Aufgaben oder Betriebsprozessen.
          </p>

          {/* Chat-Verlauf */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: 420 }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
                {/* Textblase */}
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.55,
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                    : 'rgba(255,255,255,.07)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,.1)',
                  color: '#f8fbff',
                }}>
                  {msg.content}
                </div>
                {/* Aktionskarten */}
                {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '85%', width: '100%' }}>
                    {msg.actions.map((action, ai) => {
                      const cfg = action.type === 'umlagerung'
                        ? { icon: '📦', label: 'Umlagerung', color: '#1684ff', bg: 'rgba(22,132,255,.1)', border: 'rgba(22,132,255,.25)' }
                        : action.type === 'bestellung'
                        ? { icon: '🛒', label: 'Bestellung', color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' }
                        : { icon: '💡', label: 'Hinweis', color: '#a78bfa', bg: 'rgba(167,139,250,.1)', border: 'rgba(167,139,250,.25)' }
                      return (
                        <div key={ai} style={{
                          padding: '9px 13px', borderRadius: 10, fontSize: 13,
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{cfg.icon}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: cfg.color, marginRight: 6 }}>{cfg.label}</span>
                            {action.type === 'umlagerung' && (
                              <span style={{ color: '#f8fbff' }}>
                                <b>{action.artikel}</b>
                                {action.von && action.nach && <> · {action.von} <span style={{ color: cfg.color }}>→</span> {action.nach}</>}
                                {action.menge != null && <> · {action.menge} Einh.</>}
                              </span>
                            )}
                            {(action.type === 'bestellung' || action.type === 'hinweis') && (
                              <span style={{ color: '#f8fbff' }}>
                                {action.artikel && <><b>{action.artikel}</b>{action.beschreibung ? ' · ' : ''}</>}
                                {action.beschreibung && <span style={{ color: '#aeb9c8' }}>{action.beschreibung}</span>}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: '#aeb9c8', flexShrink: 0, alignSelf: 'center', padding: '2px 7px', borderRadius: 6, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>
                            Vorschlag
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex' }}>
                <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', fontSize: 14 }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#a78bfa',
                        animation: `pulse 1.2s ${i * 0.2}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Vorschläge */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[
              'Welche Artikel haben niedrigen Bestand?',
              'Offene Aufgaben heute?',
              'Überfällige Rechnungen?',
            ].map(q => (
              <button
                key={q}
                onClick={() => { setChatMsg(q) }}
                style={{
                  fontSize: 12, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)',
                  color: '#c4b5fd', fontWeight: 600,
                }}
              >{q}</button>
            ))}
          </div>

          {/* Eingabe */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="pk-input"
              placeholder="Frage eingeben… z.B. &quot;Welche Artikel haben niedrigen Bestand?&quot;"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              style={{ flex: 1 }}
            />
            <button
              className="pk-btn"
              onClick={sendChat}
              disabled={chatLoading || !chatMsg.trim()}
              style={{ padding: '0 18px', fontWeight: 700, flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}
            >→</button>
          </div>

          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.2)', fontSize: 11, color: '#c4b5fd' }}>
            💡 Demo: ANTHROPIC_API_KEY in .env.local für echte KI-Antworten eintragen
          </div>
        </div>
      )}
    </div>
  )
}
