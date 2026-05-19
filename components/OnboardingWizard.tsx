'use client'
import { useState } from 'react'

type CompanyForm = {
  firmenname: string
  adresse?: string
  plz?: string
  ort?: string
  email?: string
  telefon?: string
  website?: string
  ansprechpartner?: string
  ust_id?: string
  iban?: string
}

type LogoFile = File | null

interface OnboardingWizardProps {
  form: CompanyForm
  onFieldChange: (key: keyof CompanyForm, value: string) => void
  onLogoChange: (file: LogoFile) => void
  onSave: () => Promise<void>
  onSkip: () => void
  saving: boolean
  error?: string
}

const STEPS = [
  { icon: '🏢', label: 'Firma' },
  { icon: '📍', label: 'Adresse' },
  { icon: '📞', label: 'Kontakt' },
  { icon: '💶', label: 'Finanzen' },
  { icon: '🚀', label: 'Los geht\'s' },
]

const QUICK_START = [
  { icon: '📦', label: 'Ersten Artikel anlegen', href: '/dashboard/lager?tab=bestand&action=new', color: '#1684ff' },
  { icon: '🏢', label: 'Ersten Kunden anlegen', href: '/dashboard/buero?tab=kunden&action=new', color: '#20c8ff' },
  { icon: '💶', label: 'Erste Rechnung erstellen', href: '/dashboard/buero?tab=rechnungen&action=new', color: '#f59e0b' },
  { icon: '🛠️', label: 'Arbeitskarte eröffnen', href: '/dashboard/werkstatt?action=new', color: '#a78bfa' },
  { icon: '🧠', label: 'KI-Assistent nutzen', href: '/dashboard/ki-erkennung?tab=chat', color: '#7c3aed' },
  { icon: '📊', label: 'Analyse anzeigen', href: '/dashboard/analyse', color: '#10b981' },
]

export default function OnboardingWizard({ form, onFieldChange, onLogoChange, onSave, onSkip, saving, error }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [finished, setFinished] = useState(false)

  const canNext = () => {
    if (step === 0) return form.firmenname.trim().length > 0
    return true
  }

  async function handleNext() {
    if (step < 3) { setStep(s => s + 1); return }
    if (step === 3) {
      await onSave()
      setStep(4)
      setFinished(true)
    }
  }

  const inputStyle = { display: 'grid', gap: 6 }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#aeb9c8', fontWeight: 600 }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="pk-card fade-in" style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#1684ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Einrichtung {step + 1} / {STEPS.length}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  fontSize: i < step ? 14 : 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? 'rgba(16,185,129,.2)' : i === step ? 'rgba(22,132,255,.2)' : 'rgba(255,255,255,.04)',
                  border: `2px solid ${i < step ? '#10b981' : i === step ? '#1684ff' : 'rgba(255,255,255,.1)'}`,
                  color: i < step ? '#10b981' : i === step ? '#6cb6ff' : '#4a5568',
                  fontWeight: 700,
                  transition: 'all .2s',
                }}>
                  {i < step ? '✓' : s.icon}
                </div>
                <div style={{ fontSize: 10, color: i === step ? '#6cb6ff' : '#4a5568', fontWeight: i === step ? 700 : 400 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {step < 4 && (
            <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(step / 4) * 100}%`, background: '#1684ff', borderRadius: 2, transition: 'width .3s' }} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.28)', color: '#ff8aa0', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Step 0 — Firma + Logo */}
        {step === 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900 }}>Willkommen bei Petersen KI! 👋</h2>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
                Richte deine Firmendaten ein — sie erscheinen auf Angeboten, Aufträgen und Rechnungen.
              </p>
            </div>
            <label style={inputStyle}>
              <span style={labelStyle}>Firmenname *</span>
              <input className="pk-input" value={form.firmenname} onChange={e => onFieldChange('firmenname', e.target.value)} placeholder="z.B. Muster GmbH" autoFocus />
            </label>
            <label style={inputStyle}>
              <span style={labelStyle}>Firmenlogo (optional)</span>
              <input className="pk-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => onLogoChange(e.target.files?.[0] ?? null)} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>PNG, JPG oder SVG — wird automatisch komprimiert</span>
            </label>
          </div>
        )}

        {/* Step 1 — Adresse */}
        {step === 1 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900 }}>Unternehmensadresse</h2>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Erscheint im Briefkopf und auf Dokumenten.</p>
            </div>
            <label style={inputStyle}>
              <span style={labelStyle}>Straße + Hausnummer</span>
              <input className="pk-input" value={form.adresse ?? ''} onChange={e => onFieldChange('adresse', e.target.value)} placeholder="Musterstraße 1" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
              <label style={inputStyle}>
                <span style={labelStyle}>PLZ</span>
                <input className="pk-input" value={form.plz ?? ''} onChange={e => onFieldChange('plz', e.target.value)} placeholder="20095" />
              </label>
              <label style={inputStyle}>
                <span style={labelStyle}>Ort</span>
                <input className="pk-input" value={form.ort ?? ''} onChange={e => onFieldChange('ort', e.target.value)} placeholder="Hamburg" />
              </label>
            </div>
          </div>
        )}

        {/* Step 2 — Kontakt */}
        {step === 2 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900 }}>Kontaktdaten</h2>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>Für Rechnungen, Angebote und den Briefkopf.</p>
            </div>
            <label style={inputStyle}>
              <span style={labelStyle}>E-Mail</span>
              <input className="pk-input" type="email" value={form.email ?? ''} onChange={e => onFieldChange('email', e.target.value)} placeholder="info@muster.de" />
            </label>
            <label style={inputStyle}>
              <span style={labelStyle}>Telefon</span>
              <input className="pk-input" value={form.telefon ?? ''} onChange={e => onFieldChange('telefon', e.target.value)} placeholder="+49 40 12345678" />
            </label>
            <label style={inputStyle}>
              <span style={labelStyle}>Website</span>
              <input className="pk-input" value={form.website ?? ''} onChange={e => onFieldChange('website', e.target.value)} placeholder="https://muster.de" />
            </label>
            <label style={inputStyle}>
              <span style={labelStyle}>Ansprechpartner</span>
              <input className="pk-input" value={form.ansprechpartner ?? ''} onChange={e => onFieldChange('ansprechpartner', e.target.value)} placeholder="Max Mustermann" />
            </label>
          </div>
        )}

        {/* Step 3 — Finanzen */}
        {step === 3 && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900 }}>Finanzdaten</h2>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>USt-ID und IBAN erscheinen auf Rechnungen.</p>
            </div>
            <label style={inputStyle}>
              <span style={labelStyle}>USt-IdNr. (oder Steuernummer)</span>
              <input className="pk-input" value={form.ust_id ?? ''} onChange={e => onFieldChange('ust_id', e.target.value)} placeholder="DE123456789" />
            </label>
            <label style={inputStyle}>
              <span style={labelStyle}>IBAN</span>
              <input className="pk-input" value={form.iban ?? ''} onChange={e => onFieldChange('iban', e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" />
            </label>
          </div>
        )}

        {/* Step 4 — Fertig */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900 }}>Alles eingerichtet!</h2>
              <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
                {form.firmenname} ist jetzt eingerichtet. Hier sind deine ersten Schritte:
              </p>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {QUICK_START.map(item => (
                <a key={item.href} href={item.href} onClick={onSkip} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  background: `${item.color}0d`, border: `1px solid ${item.color}22`,
                  textDecoration: 'none', color: '#f8fbff',
                  transition: 'background .15s',
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${item.color}20`, flexShrink: 0,
                  }}>{item.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                  <span style={{ marginLeft: 'auto', color: item.color, fontSize: 16 }}>›</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
          {step === 4 ? (
            <button className="pk-btn" onClick={onSkip} style={{ flex: 1 }}>
              Zum Dashboard →
            </button>
          ) : (
            <>
              <button className="pk-btn-ghost" onClick={onSkip} disabled={saving} style={{ fontSize: 13 }}>
                {step === 0 ? 'Überspringen' : 'Später'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && (
                  <button className="pk-btn-ghost" onClick={() => setStep(s => s - 1)} disabled={saving}>
                    ← Zurück
                  </button>
                )}
                <button
                  className="pk-btn"
                  onClick={handleNext}
                  disabled={!canNext() || saving}
                >
                  {saving ? '⏳ Speichere…' : step === 3 ? '✓ Abschließen' : 'Weiter →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
