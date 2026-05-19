'use client'
import React, { useState } from 'react'
import type { Rechnung } from '@/types/buero'

type Props = {
  isDemo: boolean
  rechnungen: Rechnung[]
}

export default function KiToolsTab({ isDemo, rechnungen }: Props) {
  const ueberfaellige = rechnungen.filter(r => r.status === 'Überfällig' || r.status === 'Mahnung')

  // E-Mail Assistent State
  const [emailAnfrage, setEmailAnfrage] = useState('')
  const [emailEmpfaenger, setEmailEmpfaenger] = useState('')
  const [emailTon, setEmailTon] = useState<'professionell' | 'freundlich' | 'formell'>('professionell')
  const [emailResult, setEmailResult] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)

  // Mahnung State
  const [mahnRechnungId, setMahnRechnungId] = useState('')
  const [mahnTon, setMahnTon] = useState<'freundlich' | 'bestimmt' | 'streng'>('freundlich')
  const [mahnResult, setMahnResult] = useState('')
  const [mahnLoading, setMahnLoading] = useState(false)
  const [mahnError, setMahnError] = useState('')
  const [mahnCopied, setMahnCopied] = useState(false)

  async function handleEmailGenerieren() {
    if (!emailAnfrage.trim()) return
    setEmailLoading(true)
    setEmailError('')
    setEmailResult('')
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 800))
        setEmailResult(`Betreff: Re: ${emailAnfrage.slice(0, 40)}\n\nSehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Wir werden uns baldmöglichst bei Ihnen melden.\n\nMit freundlichen Grüßen\nIhr Team`)
        return
      }
      const res = await fetch('/api/openai/email-assistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anfrage: emailAnfrage, empfaenger: emailEmpfaenger, ton: emailTon }),
      })
      const data = await res.json() as { reply?: string; disabled?: boolean; error?: string }
      if (data.disabled) {
        setEmailError('E-Mail Assistent ist deaktiviert. Bitte unter Einstellungen → Kundensteuerung aktivieren.')
        return
      }
      if (data.error) { setEmailError(data.error); return }
      setEmailResult(data.reply ?? '')
    } catch {
      setEmailError('Fehler beim Generieren.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleMahnungGenerieren() {
    const rechnung = rechnungen.find(r => r.id === mahnRechnungId)
    if (!rechnung && !isDemo) return
    setMahnLoading(true)
    setMahnError('')
    setMahnResult('')
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 800))
        setMahnResult(`Sehr geehrte Damen und Herren,\n\nhiermit erinnern wir Sie freundlich an die offene Rechnung über ${rechnung?.betrag ?? '1.500,00 €'}, fällig am ${rechnung?.faellig ?? '01.04.2025'}.\n\nBitte überweisen Sie den Betrag innerhalb von 7 Werktagen.\n\nMit freundlichen Grüßen\nIhr Unternehmen`)
        return
      }
      const rech = rechnung!
      const res = await fetch('/api/openai/mahnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rechnung: { nummer: rech.nummer, kunde: rech.kunde, betrag: rech.betrag, faellig: rech.faellig, mahnung_count: rech.mahnung_count }, ton: mahnTon }),
      })
      const data = await res.json() as { reply?: string; disabled?: boolean; error?: string }
      if (data.disabled) {
        setMahnError('Mahnungsgenerator ist deaktiviert. Bitte unter Einstellungen → Kundensteuerung aktivieren.')
        return
      }
      if (data.error) { setMahnError(data.error); return }
      setMahnResult(data.reply ?? '')
    } catch {
      setMahnError('Fehler beim Generieren.')
    } finally {
      setMahnLoading(false)
    }
  }

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
    color: '#f8fbff', outline: 'none', boxSizing: 'border-box',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  }

  const resultBoxStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, padding: 14, fontSize: 13, color: '#dbe4ef',
    whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 12, minHeight: 120,
  }

  const demoUeberfaellige: Rechnung[] = [
    { id: 'RE-2025-077', kunde: 'Schmidt & Partner', betrag: '2.700,00 €', faellig: '08.05.2025', status: 'Überfällig', erstellt: '', mahnung_count: 0 },
    { id: 'RE-2025-074', kunde: 'Hans Werner', betrag: '1.500,00 €', faellig: '01.04.2025', status: 'Mahnung', erstellt: '', mahnung_count: 1 },
  ]

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* E-Mail Assistent */}
      <div className="pk-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>✉️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>E-Mail Assistent</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aeb9c8' }}>Professionelle Antwort-E-Mails in Sekunden generieren</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label htmlFor="field-kundenanfrage-was-soll-be" style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Kundenanfrage / Was soll beantwortet werden?</label>
            <textarea id="field-kundenanfrage-was-soll-be"
              className="pk-input"
              value={emailAnfrage}
              onChange={e => setEmailAnfrage(e.target.value)}
              placeholder="z.B. Kunde fragt nach Lieferstatus seiner Bestellung vom 10.05."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor="field-empfnger-optional" style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Empfänger (optional)</label>
              <input id="field-empfnger-optional" className="pk-input" value={emailEmpfaenger} onChange={e => setEmailEmpfaenger(e.target.value)} placeholder="z.B. Müller GmbH" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="field-ton" style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Ton</label>
              <select id="field-ton" value={emailTon} onChange={e => setEmailTon(e.target.value as typeof emailTon)} style={selectStyle}>
                <option value="professionell">Professionell</option>
                <option value="freundlich">Freundlich</option>
                <option value="formell">Formell</option>
              </select>
            </div>
          </div>
          <button
            className="pk-btn"
            onClick={() => void handleEmailGenerieren()}
            disabled={emailLoading || !emailAnfrage.trim()}
            style={{ alignSelf: 'flex-start' }}
          >
            {emailLoading ? '⏳ Generiere…' : '✨ E-Mail generieren'}
          </button>
        </div>

        {emailError && <div style={{ color: '#ff8080', fontSize: 13, marginTop: 10, padding: '10px 14px', background: 'rgba(255,80,80,.08)', borderRadius: 8, border: '1px solid rgba(255,80,80,.2)' }}>{emailError}</div>}

        {emailResult && (
          <div>
            <div style={resultBoxStyle}>{emailResult}</div>
            <button
              className="pk-btn-ghost"
              onClick={() => copyToClipboard(emailResult, setEmailCopied)}
              style={{ marginTop: 8, fontSize: 12 }}
            >
              {emailCopied ? '✓ Kopiert!' : '📋 Kopieren'}
            </button>
          </div>
        )}
      </div>

      {/* Mahnungsgenerator */}
      <div className="pk-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>📨</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Mahnungsgenerator</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aeb9c8' }}>KI-Mahnschreiben für überfällige Rechnungen</p>
          </div>
        </div>

        {ueberfaellige.length === 0 && !isDemo ? (
          <div style={{ color: '#aeb9c8', fontSize: 13, padding: '16px 0' }}>
            Keine überfälligen oder Mahnung-Rechnungen vorhanden.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label htmlFor="field-rechnung-auswhlen" style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Rechnung auswählen</label>
              <select id="field-rechnung-auswhlen"
                value={mahnRechnungId}
                onChange={e => setMahnRechnungId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- Rechnung wählen --</option>
                {(isDemo ? demoUeberfaellige : ueberfaellige).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.id} – {r.kunde} – {r.betrag} – fällig {r.faellig} ({r.status}{r.mahnung_count ? `, ${r.mahnung_count}. Mahnung` : ''})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="field-ton-2" style={{ fontSize: 12, color: '#aeb9c8', fontWeight: 600, display: 'block', marginBottom: 5 }}>Ton</label>
              <select id="field-ton-2" value={mahnTon} onChange={e => setMahnTon(e.target.value as typeof mahnTon)} style={selectStyle}>
                <option value="freundlich">Freundlich (1. Mahnung)</option>
                <option value="bestimmt">Bestimmt (2. Mahnung)</option>
                <option value="streng">Streng (3. Mahnung / letzte Warnung)</option>
              </select>
            </div>
            <button
              className="pk-btn"
              onClick={() => void handleMahnungGenerieren()}
              disabled={mahnLoading || (!mahnRechnungId && !isDemo)}
              style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
            >
              {mahnLoading ? '⏳ Generiere…' : '📨 Mahnung generieren'}
            </button>
          </div>
        )}

        {mahnError && <div style={{ color: '#ff8080', fontSize: 13, marginTop: 10, padding: '10px 14px', background: 'rgba(255,80,80,.08)', borderRadius: 8, border: '1px solid rgba(255,80,80,.2)' }}>{mahnError}</div>}

        {mahnResult && (
          <div>
            <div style={resultBoxStyle}>{mahnResult}</div>
            <button
              className="pk-btn-ghost"
              onClick={() => copyToClipboard(mahnResult, setMahnCopied)}
              style={{ marginTop: 8, fontSize: 12 }}
            >
              {mahnCopied ? '✓ Kopiert!' : '📋 Kopieren'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
