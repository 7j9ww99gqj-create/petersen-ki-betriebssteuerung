'use client'
// Design-Vorschau-Seite — zeigt alle Bausteine aus dem Design-Sprint G1–G8.
// Additiv: nur neue Route, keine bestehende Seite verändert.
// URL: /dashboard/design-vorschau

import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { PilotIcon, type PilotIconName } from '@/components/brand/PilotIcon'
import { EmptyStateIllustrated, type EmptyKind } from '@/components/EmptyStateIllustrated'
import { OnboardingProgress } from '@/components/OnboardingProgress'

const PILOT_ICONS: PilotIconName[] = [
  'lager','buero','werkstatt','marketing','analyse','planung','steuer',
  'ki','cloud','archiv','einstellungen','qm','pondruff',
  'suche','glocke','start','menue','wareneingang','auftrag','beleg','kunden','preis',
]

const EMPTY_KINDS: EmptyKind[] = [
  'lager','buero','werkstatt','marketing','analyse','planung',
  'steuer','qm','cloud','archiv','suche','allgemein',
]

const ONBOARDING_STEPS = [
  { label: 'Firma' },
  { label: 'Adresse' },
  { label: 'Kontakt' },
  { label: 'Finanzen' },
  { label: 'Fertig' },
]

const STATUS_PILLS: Array<{ label: string; cls: string }> = [
  { label: 'Erfolg',  cls: 'pk-status pk-status-success' },
  { label: 'Warnung', cls: 'pk-status pk-status-warning' },
  { label: 'Fehler',  cls: 'pk-status pk-status-danger' },
  { label: 'Info',    cls: 'pk-status pk-status-info' },
  { label: 'Neutral', cls: 'pk-status pk-status-neutral' },
]

const SEMANTIC_TOKENS = [
  { name: '--success', val: '#10b981' },
  { name: '--warning', val: '#f59e0b' },
  { name: '--danger',  val: '#ef4444' },
  { name: '--info',    val: '#38bdf8' },
  { name: '--neutral', val: '#94a3b8' },
]

const PILOT_TOKENS = [
  { name: '--pilot-lager',     val: '#1684ff' },
  { name: '--pilot-buero',     val: '#20c8ff' },
  { name: '--pilot-werkstatt', val: '#a78bfa' },
  { name: '--pilot-marketing', val: '#f59e0b' },
  { name: '--pilot-analyse',   val: '#10b981' },
  { name: '--pilot-planung',   val: '#f43f5e' },
  { name: '--pilot-steuer',    val: '#facc15' },
  { name: '--pilot-qm',        val: '#14b8a6' },
  { name: '--pilot-ki',        val: '#7c3aed' },
  { name: '--pilot-pondruff',  val: '#e50909' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 40 }}>
      <h2 className="pk-h2" style={{ marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <span style={{ color: '#1684ff', marginRight: 8, fontFamily: 'ui-monospace, monospace', fontSize: 14 }}>{id}</span>
        {title}
      </h2>
      <div className="pk-card">{children}</div>
    </section>
  )
}

export default function DesignVorschauPage() {
  const [progressStep, setProgressStep] = useState(2)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalClosing, setModalClosing] = useState(false)

  const openModal = () => { setModalClosing(false); setModalOpen(true) }
  const closeModal = () => {
    setModalClosing(true)
    setTimeout(() => { setModalOpen(false); setModalClosing(false) }, 200)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 80px 4px' }}>
      <div className="pk-card" style={{ marginBottom: 28, padding: 24 }}>
        <Logo height={40} />
        <h1 className="pk-h1" style={{ marginTop: 14 }}>Design-Vorschau (G1–G8)</h1>
        <p className="pk-body" style={{ color: '#aeb9c8', maxWidth: 720 }}>
          Diese Seite zeigt alle Design-Bausteine aus dem Sprint vom 2026-05-20.
          Alle Komponenten sind additiv — keine bestehende Komponente, Klasse oder
          CSS-Variable wurde verändert. Migration auf neue Bausteine ist opt-in.
        </p>
        <nav style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['G1','G2','G3','G4','G5','G7','G8'].map(g => (
            <a key={g} href={`#${g}`} className="pk-btn-ghost" style={{ fontSize: 12 }}>{g}</a>
          ))}
        </nav>
      </div>

      {/* G1 — Icon-Library */}
      <Section id="G1" title="Icon-Library (Lucide)">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          <code className="pk-mono">{'<PilotIcon name="lager" />'}</code> — semantische Namen statt direkter Lucide-Imports.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {PILOT_ICONS.map(n => (
            <div key={n} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 8px', borderRadius: 10, background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
            }}>
              <PilotIcon name={n} size={26} />
              <span className="pk-caption">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* G2 — Typography */}
      <Section id="G2" title="Typography-Scale">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          CSS-Klassen für konsistente Schriftgrößen. Responsive auf Mobile.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pk-h1">.pk-h1 — Hauptüberschrift 28/24px</div>
          <div className="pk-h2">.pk-h2 — Sektion 22/20px</div>
          <div className="pk-h3">.pk-h3 — Subsektion 18/17px</div>
          <div className="pk-h4">.pk-h4 — Kartentitel 15px</div>
          <div className="pk-body-lg">.pk-body-lg — Fließtext groß 15px</div>
          <div className="pk-body">.pk-body — Standard-Fließtext 14px</div>
          <div className="pk-caption">.pk-caption — Sekundärtext 12px</div>
          <div className="pk-label">.pk-label — Label/Eyebrow 11px</div>
          <div className="pk-mono">.pk-mono — Code/Monospace 13px</div>
        </div>
      </Section>

      {/* G3 — Logo */}
      <Section id="G3" title="Logo & Wordmark">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          Drei Varianten: <code className="pk-mono">full</code> / <code className="pk-mono">mark</code> / <code className="pk-mono">wordmark</code>. Reines SVG.
        </p>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="pk-label" style={{ marginBottom: 12 }}>Variant: full</div>
            <Logo variant="full" height={36} />
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="pk-label" style={{ marginBottom: 12 }}>Variant: mark</div>
            <Logo variant="mark" height={48} />
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
            <div className="pk-label" style={{ marginBottom: 12 }}>Variant: wordmark</div>
            <Logo variant="wordmark" height={36} />
          </div>
          <div style={{ padding: 16, borderRadius: 12, background: '#ffffff', border: '1px solid rgba(0,0,0,.08)' }}>
            <div className="pk-label" style={{ marginBottom: 12, color: '#475569' }}>auf hellem Hintergrund</div>
            <Logo variant="mark" height={48} />
          </div>
        </div>
      </Section>

      {/* G4 — Empty States */}
      <Section id="G4" title="Empty-States mit Illustration">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          12 pilot-spezifische SVG-Motive mit Akzentfarben aus dem Pilot-Farbsystem.
        </p>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {EMPTY_KINDS.map(k => (
            <div key={k} style={{ padding: 4, borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}>
              <EmptyStateIllustrated
                kind={k}
                title={`Empty: ${k}`}
                description="Beispieltext für den Leerzustand dieses Piloten."
              />
            </div>
          ))}
        </div>
      </Section>

      {/* G5 — Onboarding Progress */}
      <Section id="G5" title="Onboarding-Progress">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          Drei Varianten: <code className="pk-mono">numbered</code> / <code className="pk-mono">bar</code> / <code className="pk-mono">dots</code>. A11y konform.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pk-label">Aktiver Schritt:</span>
          {ONBOARDING_STEPS.map((_, i) => (
            <button
              key={i}
              className={i === progressStep ? 'pk-btn' : 'pk-btn-ghost'}
              onClick={() => setProgressStep(i)}
              style={{ minWidth: 40, padding: '6px 12px' }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="pk-label" style={{ marginBottom: 10 }}>Variant: numbered</div>
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12 }}>
          <OnboardingProgress steps={ONBOARDING_STEPS} current={progressStep} variant="numbered" />
        </div>

        <div className="pk-label" style={{ marginBottom: 10 }}>Variant: bar</div>
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12 }}>
          <OnboardingProgress steps={ONBOARDING_STEPS} current={progressStep} variant="bar" />
        </div>

        <div className="pk-label" style={{ marginBottom: 10 }}>Variant: dots</div>
        <div style={{ padding: 16, background: 'rgba(255,255,255,.02)', borderRadius: 12 }}>
          <OnboardingProgress steps={ONBOARDING_STEPS} current={progressStep} variant="dots" />
        </div>
      </Section>

      {/* G7 — Colors */}
      <Section id="G7" title="Farb-Hierarchie">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          Semantische Tokens + Status-Pills <code className="pk-mono">.pk-status-*</code>.
        </p>

        <div className="pk-label" style={{ marginBottom: 10 }}>Status-Pills</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {STATUS_PILLS.map(s => (
            <span key={s.label} className={s.cls + ' pk-status-dot'}>{s.label}</span>
          ))}
        </div>

        <div className="pk-label" style={{ marginBottom: 10 }}>Semantische Tokens</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 24 }}>
          {SEMANTIC_TOKENS.map(t => (
            <div key={t.name} style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: '100%', height: 36, borderRadius: 6, background: t.val, marginBottom: 8 }} />
              <div className="pk-mono" style={{ fontSize: 11 }}>{t.name}</div>
              <div className="pk-caption">{t.val}</div>
            </div>
          ))}
        </div>

        <div className="pk-label" style={{ marginBottom: 10 }}>Pilot-Tokens</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {PILOT_TOKENS.map(t => (
            <div key={t.name} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: '100%', height: 28, borderRadius: 6, background: t.val, marginBottom: 6 }} />
              <div className="pk-mono" style={{ fontSize: 10 }}>{t.name}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* G8 — Modal Animations */}
      <Section id="G8" title="Modal-Animationen">
        <p className="pk-caption" style={{ marginBottom: 14 }}>
          Klassen <code className="pk-mono">.pk-modal-overlay</code> + <code className="pk-mono">.pk-modal-card</code> mit Out-State über <code className="pk-mono">data-state=&quot;closing&quot;</code>.
        </p>
        <button className="pk-btn" onClick={openModal}>Animiertes Modal öffnen</button>
      </Section>

      {modalOpen && (
        <div
          className="pk-modal-overlay"
          data-state={modalClosing ? 'closing' : undefined}
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="pk-card pk-modal-card"
            data-state={modalClosing ? 'closing' : undefined}
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(480px, 100%)' }}
          >
            <h3 className="pk-h3" style={{ marginBottom: 10 }}>Beispiel-Modal</h3>
            <p className="pk-body" style={{ color: '#aeb9c8', marginBottom: 18 }}>
              Sanfte Skalierung + Blur beim Einblenden, Slide-Down beim Ausblenden.
              Respektiert <code className="pk-mono">prefers-reduced-motion</code>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="pk-btn-ghost" onClick={closeModal}>Schließen</button>
              <button className="pk-btn" onClick={closeModal}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
