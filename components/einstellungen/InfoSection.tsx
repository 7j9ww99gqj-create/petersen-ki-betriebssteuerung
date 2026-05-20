'use client'
import { useState } from 'react'

/**
 * InfoSection — App-Info / Datenschutz / Impressum / AGB.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 2).
 */
export default function InfoSection({ isDemo }: { isDemo: boolean }) {
  type InfoTab = 'app' | 'datenschutz' | 'impressum' | 'agb'
  const [infoTab, setInfoTab] = useState<InfoTab>('app')

  const infoTabs: { id: InfoTab; label: string; icon: string }[] = [
    { id: 'app', label: 'App-Info', icon: 'ℹ️' },
    { id: 'datenschutz', label: 'Datenschutz', icon: '🔒' },
    { id: 'impressum', label: 'Impressum', icon: '📋' },
    { id: 'agb', label: 'AGB', icon: '📄' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tab-Leiste */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {infoTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setInfoTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
              fontWeight: infoTab === t.id ? 800 : 600,
              background: infoTab === t.id ? 'rgba(22,132,255,.15)' : 'rgba(255,255,255,.04)',
              border: infoTab === t.id ? '1px solid rgba(22,132,255,.4)' : '1px solid rgba(255,255,255,.08)',
              color: infoTab === t.id ? '#6cb6ff' : '#aeb9c8',
              transition: 'all .15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* App-Info */}
      {infoTab === 'app' && (
        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>ℹ️ App-Informationen</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { label: 'Anwendung', value: 'Petersen KI Betriebssteuerung' },
              { label: 'Version', value: 'v1.1.2' },
              { label: 'Stack', value: 'Next.js 14 · TypeScript · Tailwind CSS' },
              { label: 'KI-Modell', value: 'OpenAI & Claude' },
              { label: 'Auth', value: 'Supabase Authentication' },
              { label: 'Modus', value: isDemo ? 'Demo – Beispieldaten' : 'Produktiv' },
              { label: 'Copyright', value: '© 2026 Petersen KI' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ width: 180, fontSize: 13, color: '#aeb9c8', fontWeight: 600, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Datenschutz */}
      {infoTab === 'datenschutz' && (
        <div className="pk-card" style={{ lineHeight: 1.7 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>🔒 Datenschutzerklärung</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 13, color: '#d0d9e8' }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>1. Verantwortlicher</h4>
              <p style={{ margin: 0 }}>
                Verantwortlicher im Sinne der DSGVO ist:<br />
                <strong style={{ color: '#f8fbff' }}>Carsten Petersen</strong><br />
                Im Sträßchen 14, 40789 Monheim am Rhein<br />
                E-Mail: <a href="mailto:info@petersen-ki-pilot.de" style={{ color: '#6cb6ff' }}>info@petersen-ki-pilot.de</a><br />
                Telefon: +49 176 56392975
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>2. Erhobene Daten</h4>
              <p style={{ margin: 0 }}>
                Im Rahmen der Nutzung von Petersen KI Betriebssteuerung werden folgende personenbezogene Daten erhoben und verarbeitet:
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong style={{ color: '#f8fbff' }}>Zugangsdaten:</strong> E-Mail-Adresse und verschlüsseltes Passwort (gespeichert bei Supabase)</li>
                <li><strong style={{ color: '#f8fbff' }}>Betriebsdaten:</strong> Artikel, Kunden, Rechnungen, Aufträge und weitere von Ihnen eingegebene Unternehmensdaten</li>
                <li><strong style={{ color: '#f8fbff' }}>Zahlungsdaten:</strong> Abonnement- und Zahlungsinformationen über Stripe (Kreditkartendaten werden ausschließlich von Stripe verarbeitet)</li>
                <li><strong style={{ color: '#f8fbff' }}>Nutzungsdaten:</strong> Log-Daten, Sitzungsinformationen und Geräteinformationen</li>
                <li><strong style={{ color: '#f8fbff' }}>Kommunikation:</strong> Supportanfragen und Nachrichten innerhalb der App</li>
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>3. Zweck der Verarbeitung</h4>
              <p style={{ margin: 0 }}>Ihre Daten werden verarbeitet zur:</p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Bereitstellung und Verbesserung der Software-as-a-Service-Plattform</li>
                <li>Abwicklung von Abonnements und Zahlungen über Stripe</li>
                <li>Authentifizierung und Zugriffskontrolle über Supabase</li>
                <li>KI-gestützter Analyse und Verarbeitung Ihrer Betriebsdaten (OpenAI & Claude)</li>
                <li>Kommunikation und Support</li>
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>4. Rechtsgrundlage</h4>
              <p style={{ margin: 0 }}>Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen) für die Bereitstellung und Verbesserung des Dienstes.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>5. Drittanbieter</h4>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong style={{ color: '#f8fbff' }}>Supabase:</strong> Datenspeicherung und Authentifizierung (USA/EU — SCCs abgeschlossen)</li>
                <li><strong style={{ color: '#f8fbff' }}>Stripe:</strong> Zahlungsabwicklung (USA/EU — SCCs abgeschlossen, PCI DSS zertifiziert)</li>
                <li><strong style={{ color: '#f8fbff' }}>OpenAI / Anthropic Claude:</strong> KI-Verarbeitung von Eingaben (Daten werden nicht dauerhaft trainiert)</li>
                <li><strong style={{ color: '#f8fbff' }}>Vercel:</strong> Hosting und Deployment (USA/EU — SCCs abgeschlossen)</li>
                <li><strong style={{ color: '#f8fbff' }}>Resend:</strong> E-Mail-Versand (EU-Server)</li>
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>6. Datenspeicherung & Löschung</h4>
              <p style={{ margin: 0 }}>Ihre Daten werden so lange gespeichert, wie Ihr Nutzerkonto aktiv ist oder wie es zur Erfüllung rechtlicher Aufbewahrungspflichten erforderlich ist (z. B. 10 Jahre für steuerlich relevante Belege). Nach Kündigung Ihres Abonnements können Sie die Löschung Ihrer Daten beantragen.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>7. Ihre Rechte</h4>
              <p style={{ margin: '0 0 8px' }}>Gemäß DSGVO haben Sie folgende Rechte:</p>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
                <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
                <li>Recht auf Löschung (Art. 17 DSGVO)</li>
                <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
                <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
                <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
              </ul>
              <p style={{ margin: '8px 0 0' }}>Zur Ausübung Ihrer Rechte wenden Sie sich an: <a href="mailto:info@petersen-ki-pilot.de" style={{ color: '#6cb6ff' }}>info@petersen-ki-pilot.de</a></p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>8. Beschwerderecht</h4>
              <p style={{ margin: 0 }}>Sie haben das Recht, sich bei einer Datenschutzbehörde zu beschweren. Die zuständige Aufsichtsbehörde richtet sich nach Ihrem Wohnsitz.</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Stand: Mai 2026 · Petersen KI · info@petersen-ki-pilot.de</div>
            </div>
          </div>
        </div>
      )}

      {/* Impressum */}
      {infoTab === 'impressum' && (
        <div className="pk-card" style={{ lineHeight: 1.7 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>📋 Impressum</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 13, color: '#d0d9e8' }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Angaben gemäß § 5 TMG</h4>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#f8fbff' }}>Carsten Petersen</strong><br />
                Inhaber und Betreiber<br />
                Petersen KI Betriebssteuerung<br />
                Im Sträßchen 14<br />
                40789 Monheim am Rhein
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Kontakt</h4>
              <p style={{ margin: 0 }}>
                Telefon: <a href="tel:+4917656392975" style={{ color: '#6cb6ff' }}>+49 176 56392975</a><br />
                E-Mail: <a href="mailto:info@petersen-ki-pilot.de" style={{ color: '#6cb6ff' }}>info@petersen-ki-pilot.de</a><br />
                Web: <a href="https://www.petersen-ki-pilot.de" target="_blank" rel="noopener noreferrer" style={{ color: '#6cb6ff' }}>www.petersen-ki-pilot.de</a>
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Steuerliche Angaben</h4>
              <p style={{ margin: 0 }}>
                Steuernummer: 5332/5130/4970
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Inhaltlich Verantwortlicher</h4>
              <p style={{ margin: 0 }}>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:<br />
              Carsten Petersen, Im Sträßchen 14, 40789 Monheim am Rhein</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Haftungsausschluss</h4>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#f8fbff' }}>Haftung für Inhalte:</strong> Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
              </p>
              <p style={{ margin: '8px 0 0' }}>
                <strong style={{ color: '#f8fbff' }}>KI-generierte Inhalte:</strong> Die in der App verwendeten KI-Funktionen (OpenAI & Claude) erzeugen automatisierte Auswertungen und Empfehlungen. Diese stellen keine verbindliche Rechts- oder Steuerberatung dar.
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Urheberrecht</h4>
              <p style={{ margin: 0 }}>© 2026 Petersen KI — Carsten Petersen. Alle Rechte vorbehalten. Die durch uns erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>Streitschlichtung</h4>
              <p style={{ margin: 0 }}>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. Wir sind nicht verpflichtet, an einem Streitbeilegungsverfahren teilzunehmen.</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Stand: Mai 2026 · Petersen KI</div>
            </div>
          </div>
        </div>
      )}

      {/* AGB */}
      {infoTab === 'agb' && (
        <div className="pk-card" style={{ lineHeight: 1.7 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800 }}>📄 Allgemeine Geschäftsbedingungen</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontSize: 13, color: '#d0d9e8' }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 1 Geltungsbereich</h4>
              <p style={{ margin: 0 }}>Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen Carsten Petersen (Petersen KI Betriebssteuerung) und dem Kunden über die Nutzung der SaaS-Plattform Petersen KI Betriebssteuerung.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 2 Leistungsbeschreibung</h4>
              <p style={{ margin: 0 }}>Petersen KI stellt eine modulare, KI-gestützte Betriebssteuerungs-Software als SaaS bereit. Der Funktionsumfang richtet sich nach dem gebuchten Paket:</p>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong style={{ color: '#f8fbff' }}>Starter (ab 89 €/Monat):</strong> BüroPilot, LagerPilot, KI-Erkennung — für 1–3 Mitarbeiter</li>
                <li><strong style={{ color: '#f8fbff' }}>Business (ab 159 €/Monat):</strong> BüroPilot, LagerPilot, WerkstattPilot, MarketingPilot, KI-Erkennung — für 1–3 Mitarbeiter</li>
                <li><strong style={{ color: '#f8fbff' }}>Enterprise (ab 279 €/Monat):</strong> Alle Module inkl. AnalysePilot, PlanungPilot, SteuerPilot, QM-Pilot, KI-Erkennung — für 1–3 Mitarbeiter</li>
                <li><strong style={{ color: '#f8fbff' }}>Einzelmodule:</strong> Buchung einzelner Piloten ab 29 €/Monat möglich (QM-Pilot ab 40 €/Monat)</li>
                <li>Preise für größere Teams (4–10, 11–30, 30+ Mitarbeiter) auf Anfrage über das Buchungsportal</li>
              </ul>
              <p style={{ margin: '8px 0 0' }}>Alle Preise inkl. MwSt. Abweichende Preise für größere Teamgrößen — siehe Buchungsbereich.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 3 Vertragsschluss & Zahlung</h4>
              <p style={{ margin: 0 }}>Der Vertrag kommt mit dem Abschluss des Buchungsvorgangs und der Freischaltung durch den Betreiber zustande. Die Zahlung erfolgt monatlich im Voraus über Stripe (Kreditkarte, SEPA-Lastschrift) oder auf Rechnung. Das Abonnement verlängert sich automatisch monatlich, sofern es nicht gekündigt wird.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 4 Kündigung</h4>
              <p style={{ margin: 0 }}>Das Abonnement kann jederzeit zum Ende des laufenden Abrechnungszeitraums gekündigt werden. Die Kündigung erfolgt per E-Mail an <a href="mailto:info@petersen-ki-pilot.de" style={{ color: '#6cb6ff' }}>info@petersen-ki-pilot.de</a> oder über das Kundenportal. Eine Erstattung bereits gezahlter Beträge erfolgt nicht.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 5 Verfügbarkeit & Support</h4>
              <p style={{ margin: 0 }}>Wir bemühen uns um eine Verfügbarkeit von 99 % im Jahresdurchschnitt. Wartungsarbeiten werden wenn möglich vorab angekündigt. Support erfolgt per E-Mail (<a href="mailto:info@petersen-ki-pilot.de" style={{ color: '#6cb6ff' }}>info@petersen-ki-pilot.de</a>) und WhatsApp (+49 176 56392975) zu Geschäftszeiten (Mo–Fr, 9–18 Uhr).</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 6 Nutzungsrechte & Pflichten</h4>
              <p style={{ margin: 0 }}>Der Kunde erhält ein nicht-übertragbares, nicht-exklusives Nutzungsrecht an der Software für die Dauer des Abonnements. Die Weitergabe von Zugangsdaten an Dritte ist untersagt. Der Kunde ist für die Richtigkeit der eingegebenen Daten verantwortlich.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 7 Datenschutz</h4>
              <p style={{ margin: 0 }}>Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer Datenschutzerklärung (siehe Tab &bdquo;Datenschutz&ldquo;) und der DSGVO. Zahlungsdaten werden ausschließlich über Stripe verarbeitet und nicht auf unseren Servern gespeichert.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 8 Haftungsbeschränkung</h4>
              <p style={{ margin: 0 }}>Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt. Für Datenverluste, die nicht durch unsere Systeme verursacht wurden, sowie für KI-generierte Auswertungen und Empfehlungen wird keine Haftung übernommen. Die KI-Funktionen ersetzen keine professionelle Rechts- oder Steuerberatung.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 9 Änderungen der AGB</h4>
              <p style={{ margin: 0 }}>Wir behalten uns vor, diese AGB zu ändern. Änderungen werden dem Kunden mindestens 4 Wochen vor Inkrafttreten per E-Mail mitgeteilt. Widerspricht der Kunde nicht innerhalb von 2 Wochen, gelten die neuen AGB als akzeptiert.</p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#f8fbff' }}>§ 10 Anwendbares Recht & Gerichtsstand</h4>
              <p style={{ margin: 0 }}>Es gilt deutsches Recht. Gerichtsstand für Kaufleute ist der Sitz des Anbieters.</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Stand: Mai 2026 · Carsten Petersen · Petersen KI</div>
            </div>
          </div>
        </div>
      )}

      {/* Demo-Hinweis */}
      {isDemo && (
        <div style={{
          padding: '18px 20px', borderRadius: 16,
          background: 'rgba(255,165,0,.08)', border: '1px solid rgba(255,165,0,.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Demo-Modus aktiv</div>
              <p style={{ margin: 0, fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
                Sie sind mit dem Demo-Zugang eingeloggt. Alle Daten sind Beispieldaten.
                Für den produktiven Einsatz besuchen Sie{' '}
                <a href="https://petersen-ki-pilot.de" target="_blank" rel="noopener noreferrer" style={{ color: '#6cb6ff', textDecoration: 'underline' }}>
                  petersen-ki-pilot.de
                </a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
