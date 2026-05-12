'use client'
import { useState, useEffect } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import {
  getMarketingKampagnen, upsertMarketingKampagne,
  getMarketingLeads, upsertMarketingLead,
  getMarketingNewsletter, upsertMarketingNewsletter,
} from '@/lib/db'

// ── Typen ─────────────────────────────────────────────────────────────────────

type KampagneStatus = 'Entwurf' | 'Aktiv' | 'Pausiert' | 'Abgeschlossen'
type LeadStatus = 'Neu' | 'Kontaktiert' | 'Qualifiziert' | 'Angebot' | 'Gewonnen' | 'Verloren'
type LeadQuelle = 'Website' | 'Empfehlung' | 'Messe' | 'Social Media' | 'Kaltakquise' | 'Sonstiges'

type Kampagne = {
  id: string; name: string; typ: 'E-Mail' | 'Social Media' | 'Newsletter' | 'Anzeige'
  status: KampagneStatus; zielgruppe: string; start: string; ende: string
  empfaenger: number; geoeffnet: number; geklickt: number; konversionen: number
  budget: string
}

type Lead = {
  id: string; name: string; firma: string; email: string; telefon: string
  quelle: LeadQuelle; status: LeadStatus; wert: string; erstellt: string; betreuer: string
}

type Newsletter = {
  id: string; betreff: string; vorschau: string; empfaenger: number
  datum: string; status: 'Entwurf' | 'Geplant' | 'Versendet'
  oeffnungsrate: number; klickrate: number
}

type DemoMarketingFeature = {
  id: string
  title: string
  navLabel: string
  short: string
  detail: string
  icon: string
  accent: string
  stats: { label: string; value: string; trend: string }[]
  board: { title: string; value: string; note: string }[]
  insights: string[]
}

// ── Demo-Daten ────────────────────────────────────────────────────────────────

const demoKampagnen: Kampagne[] = [
  { id: 'KMP-001', name: 'Frühjahrs-Aktion 2025', typ: 'E-Mail', status: 'Aktiv', zielgruppe: 'Bestandskunden', start: '01.04.2025', ende: '31.05.2025', empfaenger: 234, geoeffnet: 89, geklickt: 41, konversionen: 12, budget: '800 €' },
  { id: 'KMP-002', name: 'LinkedIn Reichweite Mai', typ: 'Social Media', status: 'Aktiv', zielgruppe: 'B2B-Neukunden', start: '01.05.2025', ende: '31.05.2025', empfaenger: 1840, geoeffnet: 612, geklickt: 188, konversionen: 7, budget: '350 €' },
  { id: 'KMP-003', name: 'Monatlicher Newsletter', typ: 'Newsletter', status: 'Abgeschlossen', zielgruppe: 'Alle Kunden', start: '01.04.2025', ende: '01.04.2025', empfaenger: 312, geoeffnet: 141, geklickt: 58, konversionen: 9, budget: '0 €' },
  { id: 'KMP-004', name: 'Google Ads – Sommer', typ: 'Anzeige', status: 'Entwurf', zielgruppe: 'Neukunden Region', start: '01.06.2025', ende: '31.07.2025', empfaenger: 0, geoeffnet: 0, geklickt: 0, konversionen: 0, budget: '1.200 €' },
  { id: 'KMP-005', name: 'Messe-Nachfass-Mail', typ: 'E-Mail', status: 'Pausiert', zielgruppe: 'Messekontakte', start: '15.03.2025', ende: '15.04.2025', empfaenger: 67, geoeffnet: 18, geklickt: 6, konversionen: 1, budget: '0 €' },
]

const demoLeads: Lead[] = [
  { id: 'LD-001', name: 'Peter Braun', firma: 'Braun Metall GmbH', email: 'p.braun@braun-metall.de', telefon: '040 55512', quelle: 'Website', status: 'Qualifiziert', wert: '15.000 €', erstellt: '28.04.2025', betreuer: 'K. Petersen' },
  { id: 'LD-002', name: 'Maria Vogel', firma: 'Vogel Technik KG', email: 'm.vogel@vogeltech.de', telefon: '0511 8834', quelle: 'Messe', status: 'Angebot', wert: '8.200 €', erstellt: '22.04.2025', betreuer: 'K. Petersen' },
  { id: 'LD-003', name: 'Klaus Werner', firma: 'Einzelkunde', email: 'k.werner@gmail.com', telefon: '0172 3314455', quelle: 'Empfehlung', status: 'Kontaktiert', wert: '2.400 €', erstellt: '15.04.2025', betreuer: 'M. Fischer' },
  { id: 'LD-004', name: 'BauGroup Nord AG', firma: 'BauGroup Nord AG', email: 'einkauf@baugroup.de', telefon: '030 44400', quelle: 'Kaltakquise', status: 'Neu', wert: '32.000 €', erstellt: '05.05.2025', betreuer: 'K. Petersen' },
  { id: 'LD-005', name: 'Rainer Holm', firma: 'Holm Elektrotechnik', email: 'r.holm@holm-et.de', telefon: '089 22113', quelle: 'Social Media', status: 'Gewonnen', wert: '6.800 €', erstellt: '10.03.2025', betreuer: 'M. Fischer' },
  { id: 'LD-006', name: 'Stadt Logistik AG', firma: 'Stadt Logistik AG', email: 'info@stadtlog.de', telefon: '0211 77700', quelle: 'Website', status: 'Verloren', wert: '18.500 €', erstellt: '01.03.2025', betreuer: 'K. Petersen' },
]

const demoNewsletter: Newsletter[] = [
  { id: 'NL-006', betreff: 'Mai-News: Neue KI-Funktionen & Sommer-Angebote', vorschau: 'Entdecken Sie unsere neuesten Entwicklungen…', empfaenger: 312, datum: '01.05.2025', status: 'Entwurf', oeffnungsrate: 0, klickrate: 0 },
  { id: 'NL-005', betreff: 'April: Frühjahrs-Aktion startet jetzt!', vorschau: 'Nur bis Ende April: 10% Rabatt auf alle Wartungsverträge…', empfaenger: 312, datum: '01.04.2025', status: 'Versendet', oeffnungsrate: 45.2, klickrate: 18.6 },
  { id: 'NL-004', betreff: 'März: Messennachbericht & neue Referenzen', vorschau: 'Wir berichten von der Hannover Messe und stellen neue Kunden vor…', empfaenger: 298, datum: '01.03.2025', status: 'Versendet', oeffnungsrate: 38.7, klickrate: 12.4 },
  { id: 'NL-003', betreff: 'Februar: Produktneuheiten 2025', vorschau: 'Alle neuen Leistungen und Pakete für das neue Jahr…', empfaenger: 287, datum: '01.02.2025', status: 'Versendet', oeffnungsrate: 41.1, klickrate: 15.8 },
]

const demoMarketingFeatures: DemoMarketingFeature[] = [
  { id: 'autopilot', title: 'Autopilot-Marketing', navLabel: '🚀 Autopilot', short: 'Vom Ziel zum Funnel', detail: 'Von der Zielsetzung bis zur ersten Kampagnenstruktur mit Zielgruppe, Angebot, Funnel und Startpunkten für den Rollout.', icon: '🚀', accent: '#f59e0b', stats: [{ label: 'Funnels bereit', value: '4', trend: '+1 heute' }, { label: 'Kampagnenpfade', value: '12', trend: '+18%' }, { label: 'Launch-Fokus', value: 'B2B', trend: 'hoch' }], board: [{ title: 'Zielgruppe', value: 'KMU Dienstleister', note: 'primärer Markt' }, { title: 'Hook-Cluster', value: '6 aktiv', note: 'Angebot + Problem' }, { title: 'Landingpages', value: '3 Entwürfe', note: 'Hero bis CTA' }], insights: ['Top-Funnel: Beratung → Case Study → Termin', 'Kaltstart-Kampagne priorisiert bezahlte Reichweite', 'Upsell-Pfad wird nach Erstkontakt eingeplant'] },
  { id: 'seo', title: 'SEO-/Keywords-Analyse', navLabel: '🔎 SEO', short: 'Keywords, Klicks, Sichtbarkeit', detail: 'Keyword-Lage, geschätzte Klickstärke, Ranking-Chancen und sichtbare Themencluster rund um die eigene Seite.', icon: '🔎', accent: '#1684ff', stats: [{ label: 'Keywords im Fokus', value: '24', trend: '+4' }, { label: 'Geschätzte Klicks', value: '348', trend: '+12%' }, { label: 'Eigene Seitenklicks', value: '127', trend: '+9%' }], board: [{ title: 'Top-Chance', value: 'ERP Handwerk', note: 'niedriger Wettbewerb' }, { title: 'Sichtbarkeit', value: '61%', note: 'auf Kernbegriffen' }, { title: 'Content-Lücke', value: '5 Themen', note: 'noch offen' }], insights: ['Keyword-Cluster „Automatisierung“ steigt am stärksten', 'Landingpage-Traffic konzentriert sich auf zwei Kernseiten', 'Neue Begriffe können direkt in Anzeigen und Content überführt werden'] },
  { id: 'lead-intelligence', title: 'Lead Intelligence Engine', navLabel: '🔥 Leads', short: 'Heiße Leads erkennen', detail: 'Lead-Qualität, Abschlusswahrscheinlichkeit, nächster Kontaktzeitpunkt und empfohlene Vertriebsaktion auf einen Blick.', icon: '🔥', accent: '#ef4444', stats: [{ label: 'Heiße Leads', value: '9', trend: '+2' }, { label: 'Kaufwahrscheinlichkeit', value: '74%', trend: '+6%' }, { label: 'Heute anrufen', value: '3', trend: 'sofort' }], board: [{ title: 'Hot Queue', value: 'LD-002', note: 'Angebot offen' }, { title: 'Timing-Fenster', value: 'Morgen 09:00', note: 'beste Antwortquote' }, { title: 'Empfohlene Aktion', value: 'Follow-up Mail', note: 'mit Referenz' }], insights: ['Website-Leads reagieren aktuell schneller als Messekontakte', 'Hoher Warenkorb korreliert mit Terminbuchung binnen 48h', 'Empfehlungsleads zeigen die beste Abschlussquote'] },
  { id: 'ab-testing', title: 'Automatisches A/B Testing', navLabel: '🧪 A/B Tests', short: 'Varianten testen lassen', detail: 'Mehrere Anzeigen-, Hook- und Landingpage-Varianten im direkten Vergleich mit Gewinner- und Verliererbild.', icon: '🧪', accent: '#a855f7', stats: [{ label: 'Varianten aktiv', value: '5', trend: '+2' }, { label: 'Gewinnerquote', value: '38%', trend: '+8%' }, { label: 'Budget gespart', value: '420 €', trend: 'laufend' }], board: [{ title: 'Beste Anzeige', value: 'Variante B', note: 'CTR am stärksten' }, { title: 'Schwächste Hook', value: 'Variante D', note: 'früh gestoppt' }, { title: 'Skalierung', value: '2 Gewinner', note: 'bereit' }], insights: ['Kurze Headline schlägt lange Erklärtexte', 'Video-Ads ziehen aktuell bessere CTR als statische Banner', 'Gewinneranzeigen performen besonders im Retargeting'] },
  { id: 'content-ai', title: 'KI-Content & Reels', navLabel: '🎥 Content', short: 'Hooks, Clips, Thumbnails', detail: 'Reels, Anzeigenvideos, Hooks und Thumbnail-Richtungen als schneller Content-Überblick für Social und Ads.', icon: '🎥', accent: '#10b981', stats: [{ label: 'Content-Ideen', value: '15', trend: '+5' }, { label: 'Reel-Konzepte', value: '6', trend: '+2' }, { label: 'Hook-Stacks', value: '12', trend: 'bereit' }], board: [{ title: 'Nächster Reel', value: 'Kundenproblem', note: '15 Sekunden' }, { title: 'Thumbnail-Stil', value: 'Bold Contrast', note: 'hohe Aufmerksamkeit' }, { title: 'Ad-Angles', value: '4 live', note: 'Preis, Zeit, KI, Ordnung' }], insights: ['Problem-Hooks schneiden besser als Feature-Hooks', 'Carousel-Ideen eignen sich als Blog- und Reel-Basis', 'Kurzclips können direkt für Ads recycelt werden'] },
  { id: 'funnel-brain', title: 'Funnel-Builder mit Gehirn', navLabel: '🧩 Funnel', short: 'Struktur + Conversion-Ideen', detail: 'Funnel-Struktur, kritische Ausstiegspunkte und Conversion-Hebel als übersichtliches Read-only Dashboard.', icon: '🧩', accent: '#14b8a6', stats: [{ label: 'Funnel-Stufen', value: '7', trend: 'komplett' }, { label: 'Absprung-Risiken', value: '3', trend: '-1' }, { label: 'Conversion-Hebel', value: '8', trend: '+2' }], board: [{ title: 'Schwächste Stufe', value: 'Formular', note: 'zu lang' }, { title: 'CTA-Qualität', value: '82/100', note: 'stark' }, { title: 'Mobile Flow', value: 'gut', note: 'stapelbar' }], insights: ['Die Angebotsseite braucht stärkere Beweiselemente', 'Formularverkürzung hebt voraussichtlich die Quote', 'FAQ-Block wirkt besonders in warmem Traffic'] },
  { id: 'sales-assistant', title: 'KI-Vertriebsassistent', navLabel: '🗣️ Vertrieb', short: 'Antwortet wie ein Verkäufer', detail: 'Antwortvorschläge für Chat, Mail und Messenger mit Preislogik, Einwandbehandlung und Angebotsfokus.', icon: '🗣️', accent: '#f97316', stats: [{ label: 'Offene Dialoge', value: '11', trend: '+3' }, { label: 'Antwortvorschläge', value: '27', trend: 'bereit' }, { label: 'Einwände erkannt', value: '8', trend: 'heute' }], board: [{ title: 'Top-Einwand', value: 'Preis zu hoch', note: 'am häufigsten' }, { title: 'Bester Kanal', value: 'WhatsApp', note: 'schnellste Reaktion' }, { title: 'Nächster Schritt', value: 'Demo-Termin', note: 'empfohlen' }], insights: ['Preisfragen brauchen zuerst ROI-Argumente', 'Messenger-Nachrichten funktionieren aktuell schneller als Mail', 'Kurzantwort + Termin-CTA führt am häufigsten weiter'] },
  { id: 'sales-clone', title: 'Besten Verkäufer klonen', navLabel: '🧬 Sales Clone', short: 'Calls zu Skripten machen', detail: 'Starke Verkaufsmuster, Einwandroutinen und Gesprächslogik aus Best-Performer-Calls als skalierbare Vorlage.', icon: '🧬', accent: '#8b5cf6', stats: [{ label: 'Calls analysiert', value: '18', trend: '+4' }, { label: 'Muster erkannt', value: '9', trend: 'stabil' }, { label: 'Skripte extrahiert', value: '5', trend: '+1' }], board: [{ title: 'Top-Pattern', value: 'Problem vor Produkt', note: 'höchste Wirkung' }, { title: 'Closing-Stil', value: 'sanft direkt', note: 'beste Quote' }, { title: 'Mail-Transfer', value: '4 Vorlagen', note: 'abgeleitet' }], insights: ['Die besten Calls starten mit Diagnose statt Pitch', 'Story + Zahlen wirkt stärker als reine Feature-Listen', 'Closing klappt am besten nach kurzer Zusammenfassung'] },
  { id: 'content-daily', title: 'Was soll ich morgen posten?', navLabel: '📅 Posting', short: 'Tägliche Content-Ideen', detail: 'Tägliche Themenvorschläge mit Hook, Struktur und Kanalidee für Creator, Vertrieb und Sichtbarkeit.', icon: '📅', accent: '#0ea5e9', stats: [{ label: 'Posts vorbereitet', value: '3', trend: 'morgen' }, { label: 'Hook-Ideen', value: '12', trend: '+3' }, { label: 'Kanäle bedient', value: '4', trend: 'aktiv' }], board: [{ title: 'Morgen-Post', value: 'KI spart Zeit', note: 'Hook priorisiert' }, { title: 'Format', value: 'Short Reel', note: '45 Sek.' }, { title: 'CTA', value: 'Kommentarfrage', note: 'Interaktion' }], insights: ['Praxisnahe Vorher/Nachher-Posts passen zum Funnel', 'Ein Hook pro Kanal kann mehrfach recycelt werden', 'Kurze Expertenmeinungen stärken die Markenwahrnehmung'] },
  { id: 'predictive', title: 'Predictive Marketing', navLabel: '🔮 Predictive', short: 'Flops und Gewinner vorhersagen', detail: 'Risiko- und Trendeinschätzung für Kampagnen, Themen und Kanäle, bevor Zeit oder Budget investiert wird.', icon: '🔮', accent: '#6366f1', stats: [{ label: 'Trend-Themen', value: '7', trend: '+2' }, { label: 'Flop-Risiken', value: '2', trend: '-1' }, { label: 'Gewinner-Signale', value: '5', trend: '+11%' }], board: [{ title: 'Trend-Thema', value: 'Automatisierung', note: 'steigend' }, { title: 'Risikokanal', value: 'Display Ads', note: 'schwächer' }, { title: 'Budget-Tipp', value: 'Video zuerst', note: 'beste Prognose' }], insights: ['Trend-Signale verdichten sich rund um Produktivität', 'Display verliert gegen Social bei kalter Zielgruppe', 'Schnelle Tests vor vollem Rollout bleiben sinnvoll'] },
  { id: 'templates', title: 'Branchen-Templates', navLabel: '🧑‍🤝‍🧑 Templates', short: 'Flows für Coaches, Makler, Agenturen', detail: 'Vorgefertigte Branchen-Setups mit passender Tonalität, Funnel-Struktur und Kampagnenlogik.', icon: '🧑‍🤝‍🧑', accent: '#22c55e', stats: [{ label: 'Templates bereit', value: '9', trend: '+2' }, { label: 'Branchen aktiv', value: '5', trend: 'wachsend' }, { label: 'Setup-Zeit', value: '12 Min', trend: '-4 Min' }], board: [{ title: 'Top-Branche', value: 'Agenturen', note: 'meiste Assets' }, { title: 'Coach-Flow', value: 'Leadmagnet', note: 'bewährt' }, { title: 'Makler-Set', value: 'Objektanfrage', note: 'stark' }], insights: ['Branchenspezifische Hooks vereinfachen den Start massiv', 'Template-Wechsel spart vor allem beim Funnel-Aufbau Zeit', 'Ein eigener Stil pro Branche wirkt klarer im Vertrieb'] },
  { id: 'integrations', title: 'Integrationen', navLabel: '⚙️ Integrationen', short: 'CRM, Ads, WhatsApp, Kalender', detail: 'Verknüpfungen zu den wichtigsten Systemen mit Datenfluss-Übersicht für Leads, Kampagnen und Termine.', icon: '⚙️', accent: '#64748b', stats: [{ label: 'Schnittstellen', value: '8', trend: '+1' }, { label: 'Datenflüsse', value: '21', trend: 'aktiv' }, { label: 'Sync-Ziele', value: '5', trend: 'bereit' }], board: [{ title: 'CRM Sync', value: 'stabil', note: 'zentral' }, { title: 'Ads-Kanäle', value: 'Meta + Google', note: 'priorisiert' }, { title: 'Kalenderfluss', value: 'Terminbuchung', note: 'wichtig' }], insights: ['CRM und Messenger sind die wertvollsten ersten Integrationen', 'Direkter Ads-Rückfluss spart manuelle Nachpflege', 'Kalenderkopplung stärkt den Vertriebsassistenten'] },
  { id: 'gamification', title: 'Gamification', navLabel: '🎮 Gamification', short: 'Score, Fortschritt, Achievements', detail: 'Fortschrittsanzeigen, Funnel-Scores und Leistungsmarker als sichtbare Motivationsebene im MarketingPilot.', icon: '🎮', accent: '#eab308', stats: [{ label: 'Funnel-Score', value: '72%', trend: '+5%' }, { label: 'Achievements', value: '6', trend: '+1' }, { label: 'Wochenziel', value: '84%', trend: 'nah dran' }], board: [{ title: 'Top-Achievement', value: '3 Tage aktiv', note: 'laufend' }, { title: 'Performance-Woche', value: '+15%', note: 'sichtbar' }, { title: 'Nächster Meilenstein', value: '80 Score', note: 'kurz davor' }], insights: ['Sichtbarer Fortschritt hält Nutzer länger im System', 'Wochentrends helfen bei Prioritäten im Team', 'Funnel-Score kann später mit echten Daten gekoppelt werden'] },
  { id: 'explainability', title: 'Warum funktioniert das?', navLabel: '🧠 Warum?', short: 'KI erklärt die Wirkung', detail: 'Begründungen, Wirkannahmen und Lernhinweise dazu, warum Kampagnen, Hooks oder Funnels stärker laufen als andere.', icon: '🧠', accent: '#06b6d4', stats: [{ label: 'Erklärungen', value: '14', trend: '+4' }, { label: 'Learnings', value: '9', trend: 'neu' }, { label: 'Hebel erkannt', value: '5', trend: 'klar' }], board: [{ title: 'Beste Headline', value: 'klarer Nutzen', note: 'stärkste Wirkung' }, { title: 'Grund', value: 'sofort verständlich', note: 'weniger Reibung' }, { title: 'Lernformat', value: 'Kurzbrief', note: 'kompakt' }], insights: ['Klare Nutzenkommunikation schlägt abstrakte Vision', 'Soziale Beweise stabilisieren kalten Traffic', 'Kurze Erklärblöcke machen die KI nachvollziehbarer'] },
]

const demoKeywordStats = [
  { keyword: 'ki warenwirtschaft', klicks: 148, sichtbarkeit: 82, trend: '+12%' },
  { keyword: 'erp handwerk', klicks: 94, sichtbarkeit: 61, trend: '+7%' },
  { keyword: 'lager software mittelstand', klicks: 67, sichtbarkeit: 54, trend: '+18%' },
  { keyword: 'dokumenten ki rechnung', klicks: 39, sichtbarkeit: 48, trend: '+9%' },
]

// ── Helper ────────────────────────────────────────────────────────────────────

const COLOR = '#f59e0b'

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 16, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#4ddb7e', fontSize: 14, fontWeight: 600 }}>{msg}</div>
  )
}

const kampagneStatusBadge: Record<KampagneStatus, string> = {
  Entwurf: 'badge-gray', Aktiv: 'badge-green', Pausiert: 'badge-orange', Abgeschlossen: 'badge-blue',
}
const leadStatusBadge: Record<LeadStatus, string> = {
  Neu: 'badge-gray', Kontaktiert: 'badge-blue', Qualifiziert: 'badge-orange',
  Angebot: 'badge-purple', Gewonnen: 'badge-green', Verloren: 'badge-gray',
}
const leadStatusColor: Record<LeadStatus, string> = {
  Neu: '#aeb9c8', Kontaktiert: '#1684ff', Qualifiziert: '#f59e0b',
  Angebot: '#a78bfa', Gewonnen: '#25d366', Verloren: '#4a5568',
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', borderRadius: 999, background: color }} />
      </div>
      <span style={{ fontSize: 11, color: '#aeb9c8', minWidth: 34 }}>{value.toFixed(1)}%</span>
    </div>
  )
}

function AiModuleTab({ feature }: { feature: DemoMarketingFeature }) {
  const keywordRows = feature.id === 'seo' ? demoKeywordStats : []

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 18, border: `1px solid ${feature.accent}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: `${feature.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {feature.icon}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{feature.title}</div>
            <div style={{ fontSize: 13, color: '#aeb9c8', marginTop: 4 }}>{feature.detail}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        {feature.stats.map(item => (
          <div key={item.label} className="pk-card" style={{ padding: '16px 14px' }}>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: feature.accent }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#d0d9e8', marginTop: 6 }}>{item.trend}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div className="pk-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${feature.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {feature.icon}
            </div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Dashboard-Überblick</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {feature.board.map(item => (
              <div key={item.title} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fbff' }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 4 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="pk-card">
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Signale & Hinweise</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {feature.insights.map(item => (
              <div key={item} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', color: '#d0d9e8', fontSize: 13 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {keywordRows.length > 0 && (
        <div className="pk-card">
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 14 }}>Keyword-Vorschau</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {keywordRows.map(row => (
              <div
                key={row.keyword}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 10,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                  color: '#f8fbff',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>{row.keyword}</span>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>{row.klicks} Klicks</span>
                <span style={{ fontSize: 12, color: '#aeb9c8' }}>{row.sichtbarkeit}% Sichtbarkeit</span>
                <span style={{ fontSize: 12, color: '#4ddb7e', fontWeight: 700 }}>{row.trend}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const aiTabs = demoMarketingFeatures.map(feature => ({
  id: feature.id,
  label: feature.navLabel,
}))

type Tab =
  | 'kampagnen'
  | 'leads'
  | 'newsletter'
  | 'auswertungen'
  | 'autopilot'
  | 'seo'
  | 'lead-intelligence'
  | 'ab-testing'
  | 'content-ai'
  | 'funnel-brain'
  | 'sales-assistant'
  | 'sales-clone'
  | 'content-daily'
  | 'predictive'
  | 'templates'
  | 'integrations'
  | 'gamification'
  | 'explainability'

function isAiTab(tab: Tab) {
  return demoMarketingFeatures.some(feature => feature.id === tab)
}

function getAiFeature(tab: Tab) {
  return demoMarketingFeatures.find(feature => feature.id === tab) || demoMarketingFeatures[0]
}

const marketingTabs: { id: Tab; label: string }[] = [
  { id: 'kampagnen', label: '📣 Kampagnen' },
  { id: 'leads', label: '🎯 Leads' },
  { id: 'newsletter', label: '📰 Newsletter' },
  { id: 'auswertungen', label: '📊 Auswertungen' },
  ...aiTabs as { id: Tab; label: string }[],
]
// ── Kampagnen-Tab ─────────────────────────────────────────────────────────────

function KampagnenTab({ isDemo }: { isDemo: boolean }) {
  const [kampagnen, setKampagnen] = useState<Kampagne[]>(isDemo ? demoKampagnen : [])
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [form, setForm] = useState({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })

  useEffect(() => {
    if (isDemo) return
    getMarketingKampagnen()
      .then(data => setKampagnen(data as Kampagne[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Kampagnen'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg); else setToast(msg)
    setTimeout(() => { setToast(''); setErrorMsg('') }, 4000)
  }

  const filtered = kampagnen.filter(k => filterStatus === 'Alle' || k.status === filterStatus)
  const counts: Record<string, number> = { Alle: kampagnen.length }
  kampagnen.forEach(k => { counts[k.status] = (counts[k.status] || 0) + 1 })

  const handleSave = async () => {
    if (!form.name || !form.zielgruppe) return
    const newK: Kampagne = {
      id: `KMP-00${kampagnen.length + 1}`, name: form.name,
      typ: form.typ as Kampagne['typ'], status: 'Entwurf',
      zielgruppe: form.zielgruppe, start: form.start || '—', ende: form.ende || '—',
      empfaenger: 0, geoeffnet: 0, geklickt: 0, konversionen: 0,
      budget: form.budget ? `${form.budget} €` : '0 €',
    }
    if (!isDemo) {
      try { await upsertMarketingKampagne(newK) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKampagnen(prev => [newK, ...prev])
    setForm({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })
    setShowForm(false)
    showToast(`✅ Kampagne "${newK.name}" als Entwurf angelegt`)
  }

  const handleStatus = async (id: string, status: KampagneStatus) => {
    const k = kampagnen.find(k => k.id === id)
    if (!isDemo && k) {
      try { await upsertMarketingKampagne({ ...k, status }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setKampagnen(prev => prev.map(k => k.id === id ? { ...k, status } : k))
    showToast(`✅ Kampagne auf "${status}" gesetzt`)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Kampagnen…</div>
      </div>
    </div>
  )

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Aktiv', 'Entwurf', 'Pausiert', 'Abgeschlossen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 13px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(245,158,11,.15)' : 'transparent',
              color: filterStatus === s ? '#fbbf24' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Kampagne'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📣 Neue Kampagne erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { label: 'Kampagnenname *', key: 'name', placeholder: 'z.B. Sommer-Aktion 2025' },
              { label: 'Zielgruppe *', key: 'zielgruppe', placeholder: 'z.B. Bestandskunden' },
              { label: 'Budget (€)', key: 'budget', placeholder: 'z.B. 500' },
              { label: 'Start', key: 'start', placeholder: 'TT.MM.JJJJ' },
              { label: 'Ende', key: 'ende', placeholder: 'TT.MM.JJJJ' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['E-Mail', 'Social Media', 'Newsletter', 'Anzeige'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Kampagne anlegen</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(k => {
          const oeffRate = k.empfaenger > 0 ? (k.geoeffnet / k.empfaenger) * 100 : 0
          const klickRate = k.geoeffnet > 0 ? (k.geklickt / k.geoeffnet) * 100 : 0
          return (
            <div key={k.id} className="pk-card" style={{ border: `1px solid ${COLOR}18` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: COLOR + '18', border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {k.typ === 'E-Mail' ? '✉️' : k.typ === 'Social Media' ? '📱' : k.typ === 'Newsletter' ? '📰' : '📢'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{k.id}</span>
                    <span className="badge badge-gray">{k.typ}</span>
                    <span className={`badge ${kampagneStatusBadge[k.status]}`}>{k.status}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{k.name}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>👥 {k.zielgruppe} · 📅 {k.start} – {k.ende} · 💶 {k.budget}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {k.status === 'Entwurf' && <button onClick={() => handleStatus(k.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Starten</button>}
                  {k.status === 'Aktiv' && <button onClick={() => handleStatus(k.id, 'Pausiert')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>⏸ Pausieren</button>}
                  {k.status === 'Aktiv' && <button onClick={() => handleStatus(k.id, 'Abgeschlossen')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✅ Abschließen</button>}
                  {k.status === 'Pausiert' && <button onClick={() => handleStatus(k.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Fortsetzen</button>}
                </div>
              </div>
              {k.empfaenger > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'Empfänger', value: k.empfaenger.toLocaleString('de-DE'), icon: '👥' },
                    { label: 'Geöffnet', value: k.geoeffnet.toLocaleString('de-DE'), icon: '👁️' },
                    { label: 'Geklickt', value: k.geklickt.toLocaleString('de-DE'), icon: '🖱️' },
                    { label: 'Konversionen', value: k.konversionen.toLocaleString('de-DE'), icon: '🎯' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: COLOR }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: '#aeb9c8', marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {k.empfaenger > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Öffnungsrate</div>
                    <PctBar value={oeffRate} color={COLOR} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Klickrate (von Geöffnet)</div>
                    <PctBar value={klickRate} color="#1684ff" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Leads-Tab ─────────────────────────────────────────────────────────────────

function LeadsTab({ isDemo }: { isDemo: boolean }) {
  const [leads, setLeads] = useState<Lead[]>(isDemo ? demoLeads : [])
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [form, setForm] = useState({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })

  useEffect(() => {
    if (isDemo) return
    getMarketingLeads()
      .then(data => setLeads(data as Lead[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Leads'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg); else setToast(msg)
    setTimeout(() => { setToast(''); setErrorMsg('') }, 4000)
  }

  const filtered = leads.filter(l =>
    (filterStatus === 'Alle' || l.status === filterStatus) &&
    (l.name.toLowerCase().includes(search.toLowerCase()) || l.firma.toLowerCase().includes(search.toLowerCase()))
  )
  const counts: Record<string, number> = { Alle: leads.length }
  leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1 })

  const handleSave = async () => {
    if (!form.name || !form.email) return
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newL: Lead = {
      id: `LD-00${leads.length + 1}`, ...form,
      quelle: form.quelle as LeadQuelle, status: 'Neu',
      wert: form.wert ? `${form.wert} €` : '—', erstellt: today,
    }
    if (!isDemo) {
      try { await upsertMarketingLead(newL) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setLeads(prev => [newL, ...prev])
    setForm({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })
    setShowForm(false)
    showToast(`✅ Lead "${newL.name}" wurde angelegt`)
  }

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const lead = leads.find(l => l.id === id)
    if (!isDemo && lead) {
      try { await upsertMarketingLead({ ...lead, status }) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    showToast(`✅ Lead-Status auf "${status}" gesetzt`)
  }

  const pipeline: LeadStatus[] = ['Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen', 'Verloren']

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Leads…</div>
      </div>
    </div>
  )

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />

      {/* Pipeline Visual */}
      <div className="pk-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Pipeline-Übersicht</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }}>
          {pipeline.slice(0, 5).map((s, i) => {
            const n = leads.filter(l => l.status === s).length
            const wert = leads.filter(l => l.status === s).reduce((sum, l) => sum + parseFloat(l.wert.replace(/[^0-9.]/g, '') || '0'), 0)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  minWidth: 110, padding: '10px 14px', borderRadius: 12, textAlign: 'center',
                  background: n > 0 ? leadStatusColor[s] + '15' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${n > 0 ? leadStatusColor[s] + '30' : 'rgba(255,255,255,.06)'}`,
                }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: n > 0 ? leadStatusColor[s] : '#4a5568' }}>{n}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 1 }}>{s}</div>
                  {n > 0 && <div style={{ fontSize: 10, color: leadStatusColor[s], marginTop: 2, fontWeight: 700 }}>{wert.toLocaleString('de-DE')} €</div>}
                </div>
                {i < 4 && <span style={{ color: '#4a5568', fontSize: 18 }}>›</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Leads suchen…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
              background: filterStatus === s ? 'rgba(245,158,11,.15)' : 'transparent',
              color: filterStatus === s ? '#fbbf24' : '#aeb9c8', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{s} <span style={{ opacity: .6 }}>({counts[s] ?? 0})</span></button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Lead'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>🎯 Neuen Lead anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Vor- und Nachname' },
              { label: 'Firma', key: 'firma', placeholder: 'Firmenname' },
              { label: 'E-Mail *', key: 'email', placeholder: 'email@firma.de' },
              { label: 'Telefon', key: 'telefon', placeholder: '040 12345' },
              { label: 'Potenzieller Wert (€)', key: 'wert', placeholder: 'z.B. 5000' },
              { label: 'Betreuer', key: 'betreuer', placeholder: 'Mitarbeitername' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{f.label}</label>
                <input className="pk-input" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Quelle</label>
              <select className="pk-input" value={form.quelle} onChange={e => setForm(p => ({ ...p, quelle: e.target.value }))} style={{ cursor: 'pointer' }}>
                {['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise', 'Sonstiges'].map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Lead anlegen</button>
        </div>
      )}

      <div className="pk-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Lead</th><th>Quelle</th><th>Status</th><th>Wert</th><th>Betreuer</th><th>Erstellt</th><th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{l.firma} · {l.email}</div>
                </td>
                <td><span className="badge badge-gray">{l.quelle}</span></td>
                <td><span className={`badge ${leadStatusBadge[l.status]}`}>{l.status}</span></td>
                <td style={{ fontWeight: 700, color: l.status === 'Gewonnen' ? '#4ddb7e' : COLOR }}>{l.wert}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{l.betreuer}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{l.erstellt}</td>
                <td>
                  {l.status !== 'Gewonnen' && l.status !== 'Verloren' && (
                    <select
                      className="pk-input"
                      style={{ fontSize: 11, padding: '3px 8px', width: 'auto', cursor: 'pointer' }}
                      value={l.status}
                      onChange={e => handleStatusChange(l.id, e.target.value as LeadStatus)}
                    >
                      {pipeline.map(s => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#aeb9c8' }}>{filtered.length} Leads</div>
    </div>
  )
}

// ── Newsletter-Tab ────────────────────────────────────────────────────────────

function NewsletterTab({ isDemo }: { isDemo: boolean }) {
  const [newsletter, setNewsletter] = useState<Newsletter[]>(isDemo ? demoNewsletter : [])
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(!isDemo)
  const [form, setForm] = useState({ betreff: '', vorschau: '', datum: '' })

  useEffect(() => {
    if (isDemo) return
    getMarketingNewsletter()
      .then(data => setNewsletter(data as Newsletter[]))
      .catch(() => setErrorMsg('Fehler beim Laden der Newsletter'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg); else setToast(msg)
    setTimeout(() => { setToast(''); setErrorMsg('') }, 4000)
  }

  const handleSave = async () => {
    if (!form.betreff) return
    const newNL: Newsletter = {
      id: `NL-00${newsletter.length + 1}`, betreff: form.betreff,
      vorschau: form.vorschau || 'Klicken Sie hier, um mehr zu erfahren…',
      empfaenger: 312, datum: form.datum || new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      status: 'Entwurf', oeffnungsrate: 0, klickrate: 0,
    }
    if (!isDemo) {
      try { await upsertMarketingNewsletter(newNL) } catch { showToast('Fehler beim Speichern', true); return }
    }
    setNewsletter(prev => [newNL, ...prev])
    setForm({ betreff: '', vorschau: '', datum: '' })
    setShowForm(false)
    showToast(`✅ Newsletter "${newNL.betreff.substring(0, 40)}…" als Entwurf gespeichert`)
  }

  const handleVersenden = async (id: string) => {
    const nl = newsletter.find(n => n.id === id)
    const updated = nl ? { ...nl, status: 'Versendet' as const, oeffnungsrate: 34 + Math.random() * 15, klickrate: 10 + Math.random() * 8 } : null
    if (!isDemo && updated) {
      try { await upsertMarketingNewsletter(updated) } catch { showToast('Fehler beim Versenden', true); return }
    }
    setNewsletter(prev => prev.map(n => n.id === id
      ? { ...n, status: 'Versendet', oeffnungsrate: 34 + Math.random() * 15, klickrate: 10 + Math.random() * 8 }
      : n
    ))
    showToast('✅ Newsletter wurde versendet' + (isDemo ? ' (Demo-Simulation)' : ''))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade Newsletter…</div>
      </div>
    </div>
  )

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Abonnenten', value: '312', icon: '👥', color: COLOR },
          { label: 'Ø Öffnungsrate', value: '41.7%', icon: '👁️', color: '#10b981' },
          { label: 'Ø Klickrate', value: '15.6%', icon: '🖱️', color: '#1684ff' },
          { label: 'Versendet (gesamt)', value: String(newsletter.filter(n => n.status === 'Versendet').length), icon: '📰', color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Newsletter'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>📰 Neuen Newsletter erstellen</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Betreff *</label>
              <input className="pk-input" placeholder="E-Mail-Betreff eingeben…" value={form.betreff} onChange={e => setForm(p => ({ ...p, betreff: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Vorschautext</label>
              <input className="pk-input" placeholder="Kurze Vorschau für den Posteingang…" value={form.vorschau} onChange={e => setForm(p => ({ ...p, vorschau: e.target.value }))} />
            </div>
            <div style={{ maxWidth: 260 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Versanddatum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {newsletter.map(n => (
          <div key={n.id} className="pk-card" style={{ border: `1px solid ${COLOR}15` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: COLOR + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📰</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={`badge ${n.status === 'Versendet' ? 'badge-green' : n.status === 'Geplant' ? 'badge-blue' : 'badge-gray'}`}>{n.status}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{n.id}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{n.betreff}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: n.status === 'Versendet' ? 10 : 0 }}>
                  {n.vorschau.substring(0, 80)}… · 📅 {n.datum} · 👥 {n.empfaenger} Empfänger
                </div>
                {n.status === 'Versendet' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Öffnungsrate</div>
                      <PctBar value={n.oeffnungsrate} color={COLOR} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Klickrate</div>
                      <PctBar value={n.klickrate} color="#1684ff" />
                    </div>
                  </div>
                )}
              </div>
              {n.status === 'Entwurf' && (
                <button onClick={() => handleVersenden(n.id)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  📤 Jetzt versenden
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Auswertungen-Tab ──────────────────────────────────────────────────────────

function AuswertungenTab({ leads, kampagnen }: { leads: Lead[]; kampagnen: Kampagne[] }) {
  const gesamtLeads = leads.length
  const gewonneneLeads = leads.filter(l => l.status === 'Gewonnen').length
  const konvRate = gesamtLeads > 0 ? ((gewonneneLeads / gesamtLeads) * 100).toFixed(1) : '0.0'
  const pipelineWert = leads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
    .reduce((s, l) => s + parseFloat(l.wert.replace(/[^0-9.]/g, '') || '0'), 0)

  const quellenStats = ['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise'].map(q => ({
    quelle: q,
    count: leads.filter(l => l.quelle === q).length,
    gewonnen: leads.filter(l => l.quelle === q && l.status === 'Gewonnen').length,
  }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Leads gesamt', value: String(gesamtLeads), icon: '🎯', color: COLOR },
          { label: 'Gewonnen', value: String(gewonneneLeads), icon: '🏆', color: '#10b981' },
          { label: 'Konversionsrate', value: `${konvRate}%`, icon: '📈', color: '#1684ff' },
          { label: 'Pipeline-Wert', value: `${pipelineWert.toLocaleString('de-DE')} €`, icon: '💶', color: '#a78bfa' },
          { label: 'Aktive Kampagnen', value: String(kampagnen.filter(k => k.status === 'Aktiv').length), icon: '📣', color: COLOR },
          { label: 'Ø Öffnungsrate', value: '41.7%', icon: '👁️', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📊 Leads nach Quelle</h3>
          {quellenStats.filter(q => q.count > 0).map(q => (
            <div key={q.quelle} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{q.quelle}</span>
                <span style={{ color: '#aeb9c8' }}>{q.count} Leads · {q.gewonnen} gewonnen</span>
              </div>
              <PctBar value={gesamtLeads > 0 ? (q.count / gesamtLeads) * 100 : 0} color={COLOR} />
            </div>
          ))}
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>📣 Kampagnen-Performance</h3>
          {kampagnen.filter(k => k.empfaenger > 0).map(k => {
            const rate = ((k.geoeffnet / k.empfaenger) * 100).toFixed(1)
            return (
              <div key={k.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{k.name}</span>
                  <span style={{ color: '#aeb9c8' }}>{rate}% Öffnungsrate</span>
                </div>
                <PctBar value={parseFloat(rate)} color={COLOR} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────────────────────

export default function MarketingPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<Tab>('kampagnen')
  const [kampagnen, setKampagnen] = useState<Kampagne[]>(isDemo ? demoKampagnen : [])
  const [leads, setLeads] = useState<Lead[]>(isDemo ? demoLeads : [])
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isDemo) return
    Promise.all([getMarketingKampagnen(), getMarketingLeads()])
      .then(([k, l]) => { setKampagnen(k as Kampagne[]); setLeads(l as Lead[]) })
      .catch(() => setErrorMsg('Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }, [isDemo])

  const aktiveKampagnen = kampagnen.filter(k => k.status === 'Aktiv').length
  const neueLeads = leads.filter(l => l.status === 'Neu').length
  const gesamtLeads = leads.length
  const gesamtEmpfaenger = 1240

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade MarketingPilot…</div>
      </div>
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📣</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>MarketingPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kampagnen · Leads · Newsletter · Auswertungen · KI-Automation</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Aktive Kampagnen', value: String(aktiveKampagnen), icon: '📣', color: COLOR },
          { label: 'Neue Leads', value: String(neueLeads), icon: '🎯', color: '#f43f5e' },
          { label: 'Leads gesamt', value: String(gesamtLeads), icon: '👥', color: '#1684ff' },
          { label: 'E-Mails versendet', value: gesamtEmpfaenger.toLocaleString('de-DE'), icon: '✉️', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {marketingTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', borderBottom: tab === t.id ? `2px solid ${COLOR}` : '2px solid transparent',
            color: tab === t.id ? '#fbbf24' : '#aeb9c8', marginBottom: -1, transition: 'color .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'kampagnen' && <KampagnenTab isDemo={isDemo} />}
      {tab === 'leads' && <LeadsTab isDemo={isDemo} />}
      {tab === 'newsletter' && <NewsletterTab isDemo={isDemo} />}
      {tab === 'auswertungen' && <AuswertungenTab leads={leads} kampagnen={kampagnen} />}
      {isAiTab(tab) && <AiModuleTab feature={getAiFeature(tab)} />}
    </div>
  )
}
