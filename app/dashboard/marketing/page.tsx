'use client'

import { useEffect, useState } from 'react'
import { hasDemoCookie } from '@/lib/auth'
import EmptyState from '@/components/EmptyState'
import {
  getMarketingAutomationRules,
  getMarketingKampagnen,
  getMarketingContentIdeas,
  getMarketingIntegrationItems,
  getMarketingLeads,
  getMarketingNewsletter,
  getMarketingPostingPlans,
  getMarketingSeoKeywords,
  upsertMarketingAutomationRule,
  upsertMarketingKampagne,
  upsertMarketingContentIdea,
  upsertMarketingIntegrationItem,
  upsertMarketingLead,
  upsertMarketingNewsletter,
  upsertMarketingPostingPlan,
  upsertMarketingSeoKeyword,
  deleteMarketingKampagne,
  deleteMarketingLead,
  deleteMarketingNewsletter,
} from '@/lib/db'

type KampagneStatus = 'Entwurf' | 'Aktiv' | 'Pausiert' | 'Abgeschlossen'
type LeadStatus = 'Neu' | 'Kontaktiert' | 'Qualifiziert' | 'Angebot' | 'Gewonnen' | 'Verloren'
type LeadQuelle = 'Website' | 'Empfehlung' | 'Messe' | 'Social Media' | 'Kaltakquise' | 'Sonstiges'
type NewsletterStatus = 'Entwurf' | 'Geplant' | 'Versendet'
type SeoIntent = 'Informativ' | 'Transaktional' | 'Lokal' | 'Brand'
type SeoStatus = 'Neu' | 'In Arbeit' | 'Optimiert'
type ContentStatus = 'Idee' | 'In Arbeit' | 'Freigabe' | 'Fertig'
type PostingStatus = 'Entwurf' | 'Geplant' | 'Veroeffentlicht'
type PostingChannel = 'LinkedIn' | 'Instagram' | 'Facebook' | 'Newsletter' | 'Blog' | 'WhatsApp'
type AutomationStatus = 'Aktiv' | 'Entwurf' | 'Pausiert'
type IntegrationStatus = 'Nicht gestartet' | 'Vorbereitet' | 'In Umsetzung' | 'Live'
type Tab = 'demo-lab' | 'seo' | 'content' | 'posting' | 'automationen' | 'integrationen' | 'kampagnen' | 'leads' | 'newsletter' | 'auswertungen'

type Kampagne = {
  id: string
  name: string
  typ: 'E-Mail' | 'Social Media' | 'Newsletter' | 'Anzeige'
  status: KampagneStatus
  zielgruppe: string
  start: string
  ende: string
  empfaenger: number
  geoeffnet: number
  geklickt: number
  konversionen: number
  budget: string
}

type Lead = {
  id: string
  name: string
  firma: string
  email: string
  telefon: string
  quelle: LeadQuelle
  status: LeadStatus
  wert: string
  erstellt: string
  betreuer: string
}

type Newsletter = {
  id: string
  betreff: string
  vorschau: string
  empfaenger: number
  datum: string
  status: NewsletterStatus
  oeffnungsrate: number
  klickrate: number
}

type DemoMarketingFeature = {
  id: string
  title: string
  short: string
  detail: string
  icon: string
  level: 'Gamechanger' | 'Stark' | 'Ausbau'
}

type FeatureSignal = {
  label: string
  value: string
  tone: string
}

type FeatureAction = {
  tab: Tab
  title: string
  detail: string
}

type SeoKeyword = {
  id: string
  keyword: string
  zielseite: string
  intent: SeoIntent
  suchvolumen: number
  schwierigkeit: number
  ranking: number
  klicks: number
  status: SeoStatus
}

type ContentIdea = {
  id: string
  titel: string
  kanal: PostingChannel
  ziel: string
  keyword: string
  hook: string
  cta: string
  status: ContentStatus
}

type PostingPlan = {
  id: string
  titel: string
  kanal: PostingChannel
  datum: string
  status: PostingStatus
  owner: string
  quelle: string
}

type AutomationRule = {
  id: string
  name: string
  trigger: string
  aktion: string
  kanal: PostingChannel | 'CRM' | 'E-Mail'
  owner: string
  status: AutomationStatus
}

type IntegrationItem = {
  id: string
  name: string
  status: IntegrationStatus
  datenbasis: string
  letzterSync: string
  naechsterSchritt: string
}

const COLOR = '#f59e0b'
const leadPipeline: LeadStatus[] = ['Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen', 'Verloren']

const demoKampagnen: Kampagne[] = [
  { id: 'KMP-001', name: 'Frühjahrs-Aktion 2025', typ: 'E-Mail', status: 'Aktiv', zielgruppe: 'Bestandskunden', start: '01.04.2025', ende: '31.05.2025', empfaenger: 234, geoeffnet: 89, geklickt: 41, konversionen: 12, budget: '800 €' },
  { id: 'KMP-002', name: 'LinkedIn Reichweite Mai', typ: 'Social Media', status: 'Aktiv', zielgruppe: 'B2B-Neukunden', start: '01.05.2025', ende: '31.05.2025', empfaenger: 1840, geoeffnet: 612, geklickt: 188, konversionen: 7, budget: '350 €' },
  { id: 'KMP-003', name: 'Monatlicher Newsletter', typ: 'Newsletter', status: 'Abgeschlossen', zielgruppe: 'Alle Kunden', start: '01.04.2025', ende: '01.04.2025', empfaenger: 312, geoeffnet: 141, geklickt: 58, konversionen: 9, budget: '0 €' },
  { id: 'KMP-004', name: 'Google Ads - Sommer', typ: 'Anzeige', status: 'Entwurf', zielgruppe: 'Neukunden Region', start: '01.06.2025', ende: '31.07.2025', empfaenger: 0, geoeffnet: 0, geklickt: 0, konversionen: 0, budget: '1.200 €' },
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
  { id: 'NL-006', betreff: 'Mai-News: Neue KI-Funktionen & Sommer-Angebote', vorschau: 'Entdecken Sie unsere neuesten Entwicklungen...', empfaenger: 312, datum: '01.05.2025', status: 'Entwurf', oeffnungsrate: 0, klickrate: 0 },
  { id: 'NL-005', betreff: 'April: Fruehjahrs-Aktion startet jetzt!', vorschau: 'Nur bis Ende April: 10% Rabatt auf alle Wartungsvertraege...', empfaenger: 312, datum: '01.04.2025', status: 'Versendet', oeffnungsrate: 45.2, klickrate: 18.6 },
  { id: 'NL-004', betreff: 'Maerz: Messennachbericht & neue Referenzen', vorschau: 'Wir berichten von der Hannover Messe und stellen neue Kunden vor...', empfaenger: 298, datum: '01.03.2025', status: 'Versendet', oeffnungsrate: 38.7, klickrate: 12.4 },
  { id: 'NL-003', betreff: 'Februar: Produktneuheiten 2025', vorschau: 'Alle neuen Leistungen und Pakete fuer das neue Jahr...', empfaenger: 287, datum: '01.02.2025', status: 'Versendet', oeffnungsrate: 41.1, klickrate: 15.8 },
]

const demoMarketingFeatures: DemoMarketingFeature[] = [
  { id: 'autopilot', title: 'Autopilot-Marketing', short: 'Vom Ziel zum Funnel', detail: 'Der Nutzer sagt nur, wofuer er mehr Kunden will. Danach zeigt der Flow Zielgruppe, Kampagne, Funnel und den naechsten operativen Schritt.', icon: '🚀', level: 'Gamechanger' },
  { id: 'seo', title: 'SEO-/Keywords-Analyse', short: 'Keywords, Klicks, Sichtbarkeit', detail: 'Prueft Suchbegriffe, grobe Nachfrage, Sichtbarkeit und zeigt Themen, die direkt in Kampagnen und Content einfliessen koennen.', icon: '🔎', level: 'Stark' },
  { id: 'lead-intelligence', title: 'Lead Intelligence Engine', short: 'Heisse Leads erkennen', detail: 'Bewertet Leads nach Reife, Potenzial und Quelle und priorisiert die naechste Aktion im Vertrieb.', icon: '🔥', level: 'Stark' },
  { id: 'ab-testing', title: 'Automatisches A/B Testing', short: 'Varianten testen lassen', detail: 'Hilft dabei, Kampagnen kreativ zu variieren, Performance zu vergleichen und die naechste Testhypothese sichtbar zu machen.', icon: '🧪', level: 'Ausbau' },
  { id: 'content-ai', title: 'KI-Content & Reels', short: 'Hooks, Clips, Thumbnails', detail: 'Leitet aus aktiven Themen konkrete Hooks, Formate und Content-Serien fuer Social und Newsletter ab.', icon: '🎥', level: 'Stark' },
  { id: 'funnel-brain', title: 'Funnel-Builder mit Gehirn', short: 'Struktur + Conversion-Ideen', detail: 'Ordnet den aktuellen Prozess von Reichweite ueber Lead bis Abschluss und zeigt Bruchstellen im Funnel.', icon: '🧩', level: 'Ausbau' },
  { id: 'sales-assistant', title: 'KI-Vertriebsassistent', short: 'Antwortet wie ein Verkaeufer', detail: 'Leitet Follow-ups, Nachrichten und Prioritaeten direkt aus Leadstatus, Quelle und Potenzial ab.', icon: '🗣️', level: 'Stark' },
  { id: 'sales-clone', title: 'Besten Verkaeufer klonen', short: 'Calls zu Skripten machen', detail: 'Verdichtet erfolgreiche Muster in wiederholbare Vertriebsbausteine fuer E-Mail, Telefon und Kampagnen.', icon: '🧬', level: 'Ausbau' },
  { id: 'content-daily', title: 'Was soll ich morgen posten?', short: 'Taegliche Content-Ideen', detail: 'Macht aus Kampagnenzielen und Themen sofort den naechsten konkreten Content-Vorschlag.', icon: '📊', level: 'Stark' },
  { id: 'predictive', title: 'Predictive Marketing', short: 'Flops und Gewinner vorhersagen', detail: 'Nutzen wir fuer eine einfache Risiko- und Chancenanzeige anhand der bisher sichtbaren Performance.', icon: '🔮', level: 'Ausbau' },
  { id: 'templates', title: 'Branchen-Templates', short: 'Flows je Markt', detail: 'Strukturiert Kampagnen und Inhalte nach Zielgruppenlogik, damit wiederkehrende Setups schneller bereitstehen.', icon: '🧩', level: 'Stark' },
  { id: 'integrations', title: 'Integrationen', short: 'CRM, Ads, WhatsApp, Kalender', detail: 'Zeigt, welche Marketingbereiche bereits im System angekommen sind und welche Daten fuer weitere Integrationen bereitstehen.', icon: '⚙️', level: 'Ausbau' },
]

const demoKeywordStats = [
  { keyword: 'ki warenwirtschaft', klicks: 148, sichtbarkeit: 82, trend: '+12%' },
  { keyword: 'erp handwerk', klicks: 94, sichtbarkeit: 61, trend: '+7%' },
  { keyword: 'lager software mittelstand', klicks: 67, sichtbarkeit: 54, trend: '+18%' },
  { keyword: 'dokumenten ki rechnung', klicks: 39, sichtbarkeit: 48, trend: '+9%' },
]

const defaultSeoKeywords: SeoKeyword[] = [
  { id: 'SEO-001', keyword: 'ki warenwirtschaft', zielseite: '/lagerpilot', intent: 'Transaktional', suchvolumen: 148, schwierigkeit: 42, ranking: 11, klicks: 31, status: 'In Arbeit' },
  { id: 'SEO-002', keyword: 'erp handwerk', zielseite: '/werkstattpilot', intent: 'Informativ', suchvolumen: 94, schwierigkeit: 55, ranking: 18, klicks: 18, status: 'Neu' },
  { id: 'SEO-003', keyword: 'marketing automation mittelstand', zielseite: '/marketingpilot', intent: 'Transaktional', suchvolumen: 72, schwierigkeit: 38, ranking: 7, klicks: 27, status: 'Optimiert' },
]

const defaultContentIdeas: ContentIdea[] = [
  { id: 'CNT-001', titel: '3 Gruende warum Mittelstand an Nachfrage verliert', kanal: 'LinkedIn', ziel: 'Leadaufbau', keyword: 'marketing automation mittelstand', hook: 'Viele Teams machen Marketing ohne System.', cta: 'Demo fuer MarketingPilot anfragen', status: 'In Arbeit' },
  { id: 'CNT-002', titel: 'SEO-Check fuer KI-Piloten Landingpages', kanal: 'Blog', ziel: 'Sichtbarkeit', keyword: 'ki warenwirtschaft', hook: 'So findest du Keywords mit echter Kaufabsicht.', cta: 'Keyword-Liste im Pilot pruefen', status: 'Idee' },
  { id: 'CNT-003', titel: 'Newsletter-Aufhaenger fuer Fruehjahrsaktion', kanal: 'Newsletter', ziel: 'Reaktivierung', keyword: 'erp handwerk', hook: 'Was Kunden gerade wirklich automatisieren wollen.', cta: 'Angebot und Beratung sichern', status: 'Freigabe' },
]

const defaultPostingPlans: PostingPlan[] = [
  { id: 'PST-001', titel: 'Case-Post zur Fruehjahrsaktion', kanal: 'LinkedIn', datum: '15.05.2026', status: 'Geplant', owner: 'K. Petersen', quelle: 'CNT-001' },
  { id: 'PST-002', titel: 'SEO-Blogartikel veroeffentlichen', kanal: 'Blog', datum: '17.05.2026', status: 'Entwurf', owner: 'Marketing', quelle: 'CNT-002' },
  { id: 'PST-003', titel: 'Newsletter Mai versenden', kanal: 'Newsletter', datum: '20.05.2026', status: 'Geplant', owner: 'Marketing', quelle: 'NL-006' },
]

const defaultAutomationRules: AutomationRule[] = [
  { id: 'AUT-001', name: 'Lead Follow-up nach Qualifizierung', trigger: 'Lead wechselt auf Qualifiziert', aktion: 'Aufgabe fuer persoenlichen Rueckruf und Demo vorbereiten', kanal: 'CRM', owner: 'Vertrieb', status: 'Aktiv' },
  { id: 'AUT-002', name: 'Newsletter aus Entwurf in Planung', trigger: '2 aktive Kampagnen ohne Newsletter-Begleitung', aktion: 'Newsletter-Briefing an Content senden', kanal: 'E-Mail', owner: 'Marketing', status: 'Entwurf' },
  { id: 'AUT-003', name: 'Posting-Follow-up fuer heisse Leads', trigger: 'Lead Score ueber 80', aktion: 'WhatsApp oder LinkedIn Follow-up vorbereiten', kanal: 'WhatsApp', owner: 'K. Petersen', status: 'Pausiert' },
]

const defaultIntegrationItems: IntegrationItem[] = [
  { id: 'INT-001', name: 'CRM Hub', status: 'Vorbereitet', datenbasis: 'Leads, Pipeline, Follow-ups', letzterSync: 'Heute', naechsterSchritt: 'Lead-Felder und Deal-Stufen bidirektional mappen' },
  { id: 'INT-002', name: 'Meta / Facebook Ads', status: 'In Umsetzung', datenbasis: 'Kampagnenbudget, Klicks, Zielgruppen', letzterSync: 'Gestern', naechsterSchritt: 'Adsets und CPL je Kampagne anbinden' },
  { id: 'INT-003', name: 'WhatsApp Vertrieb', status: 'Vorbereitet', datenbasis: 'Heisse Leads, Follow-up Aufgaben', letzterSync: 'Kein Sync', naechsterSchritt: 'Nachrichtenvorlagen und Lead-Zuordnung definieren' },
  { id: 'INT-004', name: 'Google Search / SEO', status: 'Nicht gestartet', datenbasis: 'Keywords, Rankings, Landingpages', letzterSync: 'Kein Sync', naechsterSchritt: 'Keyword-Import und Ranking-Verlauf einbauen' },
]

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 16, background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.3)', color: '#4ddb7e', fontSize: 14, fontWeight: 600 }}>{msg}</div>
  )
}

const kampagneStatusBadge: Record<KampagneStatus, string> = {
  Entwurf: 'badge-gray',
  Aktiv: 'badge-green',
  Pausiert: 'badge-orange',
  Abgeschlossen: 'badge-blue',
}

const leadStatusBadge: Record<LeadStatus, string> = {
  Neu: 'badge-gray',
  Kontaktiert: 'badge-blue',
  Qualifiziert: 'badge-orange',
  Angebot: 'badge-purple',
  Gewonnen: 'badge-green',
  Verloren: 'badge-gray',
}

const leadStatusColor: Record<LeadStatus, string> = {
  Neu: '#aeb9c8',
  Kontaktiert: '#1684ff',
  Qualifiziert: '#f59e0b',
  Angebot: '#a78bfa',
  Gewonnen: '#25d366',
  Verloren: '#4a5568',
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

function parseCurrency(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('de-DE')} €`
}

function findChangedItem<T extends { id: string }>(next: T[], current: T[]) {
  return next.find(item => {
    const existing = current.find(currentItem => currentItem.id === item.id)
    return !existing || JSON.stringify(existing) !== JSON.stringify(item)
  })
}

function nextId(prefix: string, ids: string[]) {
  const next = ids.reduce((max, id) => {
    const match = id.match(/(\d+)$/)
    const numeric = match ? Number.parseInt(match[1], 10) : 0
    return Math.max(max, numeric)
  }, 0) + 1

  return `${prefix}-${String(next).padStart(3, '0')}`
}

function getLeadScore(lead: Lead) {
  const statusScore: Record<LeadStatus, number> = {
    Neu: 35,
    Kontaktiert: 50,
    Qualifiziert: 72,
    Angebot: 88,
    Gewonnen: 100,
    Verloren: 5,
  }

  const sourceBonus: Partial<Record<LeadQuelle, number>> = {
    Website: 8,
    Empfehlung: 10,
    Messe: 6,
    'Social Media': 5,
  }

  const valueBonus = Math.min(20, Math.floor(parseCurrency(lead.wert) / 2500))
  return Math.min(100, statusScore[lead.status] + (sourceBonus[lead.quelle] ?? 0) + valueBonus)
}

function getLeadAction(lead: Lead) {
  if (lead.status === 'Neu') return 'Innerhalb von 24h persoenlich anrufen'
  if (lead.status === 'Kontaktiert') return 'Konkreten Bedarf und Termin bestaetigen'
  if (lead.status === 'Qualifiziert') return 'Use-Case und ROI mit Demo unterlegen'
  if (lead.status === 'Angebot') return 'Follow-up mit Einwandbehandlung senden'
  if (lead.status === 'Gewonnen') return 'Onboarding und Referenzchance sichern'
  return 'Lead fuer spaetere Reaktivierung markieren'
}

function getNewsletterAverages(newsletter: Newsletter[]) {
  const sent = newsletter.filter(item => item.status === 'Versendet')
  if (sent.length === 0) return { openRate: 0, clickRate: 0 }
  return {
    openRate: sent.reduce((sum, item) => sum + item.oeffnungsrate, 0) / sent.length,
    clickRate: sent.reduce((sum, item) => sum + item.klickrate, 0) / sent.length,
  }
}

function createNewsletterMetrics(newsletter: Newsletter, kampagnen: Kampagne[]) {
  const activeCampaigns = kampagnen.filter(k => k.status === 'Aktiv').length
  const baseOpenRate = newsletter.empfaenger > 300 ? 39 : 34
  const openRate = Math.min(58, baseOpenRate + activeCampaigns * 1.7 + newsletter.betreff.length * 0.12)
  const clickRate = Math.min(24, Math.max(8, openRate * 0.42))
  return {
    oeffnungsrate: Number(openRate.toFixed(1)),
    klickrate: Number(clickRate.toFixed(1)),
  }
}

function getFeatureSignals(featureId: string, kampagnen: Kampagne[], leads: Lead[], newsletter: Newsletter[]) {
  const hotLeads = leads.filter(lead => getLeadScore(lead) >= 75 && !['Gewonnen', 'Verloren'].includes(lead.status))
  const activeCampaigns = kampagnen.filter(k => k.status === 'Aktiv')
  const draftAssets = kampagnen.filter(k => k.status === 'Entwurf').length + newsletter.filter(n => n.status !== 'Versendet').length
  const averages = getNewsletterAverages(newsletter)

  const sharedActions: FeatureAction[] = [
    { tab: 'kampagnen', title: 'Aktive Kampagnen nachschaerfen', detail: `${activeCampaigns.length} Kampagnen laufen gerade mit direkten Hebeln fuer Performance.` },
    { tab: 'leads', title: 'Heisse Leads zuerst bearbeiten', detail: `${hotLeads.length} Leads liegen aktuell im schnellen Abschlussfenster.` },
    { tab: 'newsletter', title: 'Offene Newsletter operationalisieren', detail: `${newsletter.filter(n => n.status !== 'Versendet').length} Newsletter warten auf Planung oder Versand.` },
  ]

  if (featureId === 'lead-intelligence' || featureId === 'sales-assistant') {
    return {
      signals: [
        { label: 'Heisse Leads', value: String(hotLeads.length), tone: '#25d366' },
        { label: 'Pipeline-Wert', value: formatCurrency(leads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status)).reduce((sum, lead) => sum + parseCurrency(lead.wert), 0)), tone: '#a78bfa' },
        { label: 'Naechste Aufgabe', value: hotLeads[0] ? `${hotLeads[0].name}: ${getLeadAction(hotLeads[0])}` : 'Neue Leads sammeln', tone: COLOR },
      ],
      actions: sharedActions,
    }
  }

  if (featureId === 'seo' || featureId === 'content-ai' || featureId === 'content-daily') {
    return {
      signals: [
        { label: 'Aktive Themen', value: String(activeCampaigns.length || kampagnen.length), tone: '#1684ff' },
        { label: 'Newsletter-Resonanz', value: `${averages.openRate.toFixed(1)}% Oeffnungsrate`, tone: '#10b981' },
        { label: 'Content-Luecke', value: `${draftAssets} offene Assets warten auf Inhalt`, tone: COLOR },
      ],
      actions: sharedActions,
    }
  }

  if (featureId === 'integrations') {
    return {
      signals: [
        { label: 'Systemobjekte live', value: `${kampagnen.length + leads.length + newsletter.length}`, tone: '#6cb6ff' },
        { label: 'Bereiche angebunden', value: 'Kampagnen, Leads, Newsletter', tone: '#25d366' },
        { label: 'Naechster Schritt', value: 'Automationen und externe Kanaele andocken', tone: COLOR },
      ],
      actions: sharedActions,
    }
  }

  if (featureId === 'autopilot') {
    const active = leads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
    const bySource: Record<string, number> = {}
    active.forEach(l => { bySource[l.quelle] = (bySource[l.quelle] ?? 0) + 1 })
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]
    const bestCampaign = activeCampaigns[0]
    return {
      signals: [
        { label: 'Top-Zielgruppe', value: topSource ? `${topSource[0]} (${topSource[1]} Leads)` : 'Keine Leads', tone: COLOR },
        { label: 'Kampagnen-Hebel', value: bestCampaign ? bestCampaign.name : 'Keine aktive Kampagne', tone: '#1684ff' },
        { label: 'Naechster Schritt', value: hotLeads[0] ? `${hotLeads[0].name}: ${getLeadAction(hotLeads[0])}` : 'Neue Leads sammeln', tone: '#25d366' },
      ],
      actions: sharedActions,
    }
  }

  return {
    signals: [
      { label: 'Aktive Kampagnen', value: String(activeCampaigns.length), tone: COLOR },
      { label: 'Entwuerfe im System', value: String(draftAssets), tone: '#a78bfa' },
      { label: 'Newsletter-Mittelwert', value: `${averages.clickRate.toFixed(1)}% Klickrate`, tone: '#1684ff' },
    ],
    actions: sharedActions,
  }
}

function AutopilotFlowPanel({ kampagnen, leads, seoKeywords }: { kampagnen: Kampagne[]; leads: Lead[]; seoKeywords: SeoKeyword[] }) {
  const active = leads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
  const bySource: Record<string, number> = {}
  active.forEach(l => { bySource[l.quelle] = (bySource[l.quelle] ?? 0) + 1 })
  const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]
  const bestCampaign = kampagnen.find(k => k.status === 'Aktiv')
  const bestKeyword = [...seoKeywords].sort((a, b) => b.klicks - a.klicks)[0]
  const byStatus: Record<string, number> = {}
  active.forEach(l => { byStatus[l.status] = (byStatus[l.status] ?? 0) + 1 })
  const stuckStage = Object.entries(byStatus).sort((a, b) => b[1] - a[1])[0]
  const hotLead = [...active].sort((a, b) => getLeadScore(b) - getLeadScore(a))[0]

  const steps = [
    {
      nr: '01', label: 'Zielgruppe', icon: '🎯', color: COLOR,
      value: topSource ? `${topSource[0]}-Leads fokussieren` : 'Alle offenen Leads aktivieren',
      detail: topSource
        ? `${topSource[1]} von ${active.length} Leads kommen ueber ${topSource[0]}`
        : 'Noch keine klare Kanal-Quelle erkennbar',
    },
    {
      nr: '02', label: 'Kampagnenvorschlag', icon: '📣', color: '#1684ff',
      value: bestCampaign ? `Kampagne „${bestCampaign.name}" nutzen` : bestKeyword ? `Neues Thema: „${bestKeyword.keyword}"` : 'Neue Kampagne erstellen',
      detail: bestCampaign
        ? `${bestCampaign.typ} · Status: ${bestCampaign.status}`
        : bestKeyword ? `${bestKeyword.klicks} Klicks · Rang #${bestKeyword.ranking}` : 'Noch keine aktiven Kampagnen vorhanden',
    },
    {
      nr: '03', label: 'Funnel-Luecke', icon: '🔍', color: '#f59e0b',
      value: stuckStage ? `Meiste Leads bei „${stuckStage[0]}" (${stuckStage[1]})` : 'Funnel prufen',
      detail: stuckStage
        ? `${stuckStage[1]} Leads warten in Stufe „${stuckStage[0]}" auf naechste Aktion`
        : 'Keine offenen Leads im Funnel',
    },
    {
      nr: '04', label: 'Naechster Schritt', icon: '⚡', color: '#25d366',
      value: hotLead ? `${hotLead.name} · Score ${getLeadScore(hotLead)}` : 'Neuen Lead anlegen',
      detail: hotLead ? getLeadAction(hotLead) : 'Leads manuell aufnehmen oder Kampagne starten',
    },
  ]

  return (
    <div className="pk-card" style={{ marginTop: 18, border: '1px solid rgba(245,158,11,.2)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>🚀 Autopilot-Flow — Vom Ziel zum naechsten Schritt</div>
        <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>
          Abgeleitet aus {leads.length} Leads, {kampagnen.length} Kampagnen und {seoKeywords.length} Keywords
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {steps.map(step => (
          <div key={step.nr} style={{ padding: '14px 16px', borderRadius: 14, background: `${step.color}0d`, border: `1px solid ${step.color}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${step.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{step.icon}</div>
              <div style={{ fontSize: 10, color: '#aeb9c8', textTransform: 'uppercase' as const, fontWeight: 800, letterSpacing: '.06em' }}>Schritt {step.nr} · {step.label}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: step.color, marginBottom: 4 }}>{step.value}</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.5 }}>{step.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DemoFeatureCard({ feature, active, onClick }: { feature: DemoMarketingFeature; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        width: '100%',
        padding: 16,
        borderRadius: 14,
        cursor: 'pointer',
        background: active ? 'rgba(245,158,11,.14)' : 'rgba(255,255,255,.03)',
        border: active ? '1px solid rgba(245,158,11,.38)' : '1px solid rgba(255,255,255,.08)',
        color: '#f8fbff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{feature.icon}</span>
        <span className={feature.level === 'Gamechanger' ? 'badge badge-orange' : feature.level === 'Stark' ? 'badge badge-blue' : 'badge badge-gray'}>
          {feature.level}
        </span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{feature.title}</div>
      <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.45 }}>{feature.short}</div>
    </button>
  )
}

function DemoLabTab({
  kampagnen,
  leads,
  newsletter,
  seoKeywords,
  onJump,
}: {
  kampagnen: Kampagne[]
  leads: Lead[]
  newsletter: Newsletter[]
  seoKeywords: SeoKeyword[]
  onJump: (tab: Tab) => void
}) {
  const [selected, setSelected] = useState<DemoMarketingFeature>(demoMarketingFeatures[0])
  const hotLead = [...leads]
    .filter(lead => !['Gewonnen', 'Verloren'].includes(lead.status))
    .sort((a, b) => getLeadScore(b) - getLeadScore(a))[0]
  const featureView = getFeatureSignals(selected.id, kampagnen, leads, newsletter)
  const draftAssets = kampagnen.filter(k => k.status === 'Entwurf').length + newsletter.filter(n => n.status !== 'Versendet').length

  return (
    <div>
      <div className="pk-card" style={{ marginBottom: 18, border: '1px solid rgba(245,158,11,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em' }}>KI-Suite</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>MarketingPilot mit operativen KI-Bausteinen</div>
          </div>
          <span className="badge badge-orange">Live mit Kampagnen, Leads und Newsletter-Daten</span>
        </div>
        <div style={{ fontSize: 13, color: '#aeb9c8', lineHeight: 1.6 }}>
          Die neuen Module sind jetzt nicht mehr nur Vorschau. Sie lesen den aktuellen Marketing-Bestand, zeigen Prioritaeten und springen direkt in den passenden Arbeitsbereich.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Aktive Kampagnen', value: String(kampagnen.filter(k => k.status === 'Aktiv').length), icon: '📣', color: COLOR },
          { label: 'Heisse Leads', value: String(leads.filter(lead => getLeadScore(lead) >= 75 && !['Gewonnen', 'Verloren'].includes(lead.status)).length), icon: '🔥', color: '#25d366' },
          { label: 'Offene Assets', value: String(draftAssets), icon: '🧩', color: '#a78bfa' },
          { label: 'Newsletter geplant', value: String(newsletter.filter(item => item.status === 'Geplant').length), icon: '📰', color: '#1684ff' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 18 }}>
        <div className="pk-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {demoMarketingFeatures.map(feature => (
              <DemoFeatureCard key={feature.id} feature={feature} active={selected.id === feature.id} onClick={() => setSelected(feature)} />
            ))}
          </div>
        </div>

        <div className="pk-card" style={{ border: '1px solid rgba(245,158,11,.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {selected.icon}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.title}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{selected.short}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#d0d9e8', lineHeight: 1.6, marginBottom: 14 }}>{selected.detail}</div>

          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            {featureView.signals.map(signal => (
              <div key={signal.label} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 5 }}>{signal.label}</div>
                <div style={{ color: signal.tone, fontWeight: 800, fontSize: 14 }}>{signal.value}</div>
              </div>
            ))}
          </div>

          {hotLead && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
              <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 5 }}>Sofort sinnvoll</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{hotLead.name} · Score {getLeadScore(hotLead)}</div>
              <div style={{ fontSize: 12, color: '#d0d9e8' }}>{getLeadAction(hotLead)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="pk-card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Naechste sinnvolle Systemschritte</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Direkt aus den eingebundenen Marketing-Daten abgeleitet</div>
          </div>
          <span className="badge badge-blue">Ins System eingepflegt</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {featureView.actions.map(action => (
            <button
              key={action.title}
              onClick={() => onJump(action.tab)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.03)',
                color: '#f8fbff',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{action.title}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8', lineHeight: 1.5 }}>{action.detail}</div>
            </button>
          ))}
        </div>
      </div>

      {selected.id === 'autopilot' && (
        <AutopilotFlowPanel kampagnen={kampagnen} leads={leads} seoKeywords={seoKeywords} />
      )}

      {leads.length > 0 && (() => {
        const active = leads.filter(l => !['Gewonnen', 'Verloren'].includes(l.status))
        const hot = active.filter(l => getLeadScore(l) >= 75)
        const pipelineWert = active.reduce((sum, l) => sum + parseCurrency(l.wert), 0)
        const byStatus: Record<string, number> = {}
        active.forEach(l => { byStatus[l.status] = (byStatus[l.status] ?? 0) + 1 })
        const sorted = [...active].sort((a, b) => getLeadScore(b) - getLeadScore(a)).slice(0, 5)
        return (
          <div className="pk-card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>🔥 Lead Intelligence</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Live-Auswertung aus {leads.length} Leads in marketing_leads</div>
              </div>
              <span className="badge badge-green">Live aus marketing_leads</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Aktive Leads', value: String(active.length), icon: '👤', color: COLOR },
                { label: 'Heisse Leads ≥75', value: String(hot.length), icon: '🔥', color: '#25d366' },
                { label: 'Pipeline-Wert', value: formatCurrency(pipelineWert), icon: '💶', color: '#a78bfa' },
                { label: 'Stufen', value: String(Object.keys(byStatus).length), icon: '📊', color: '#1684ff' },
              ].map(item => (
                <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 4 }}>Top-Leads nach Score</div>
              {sorted.map(lead => (
                <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: getLeadScore(lead) >= 75 ? 'rgba(37,211,102,.06)' : 'rgba(255,255,255,.03)', border: `1px solid ${getLeadScore(lead) >= 75 ? 'rgba(37,211,102,.2)' : 'rgba(255,255,255,.06)'}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>{lead.firma || lead.quelle}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#aeb9c8' }}>{lead.wert}</span>
                  <span className={`badge ${getLeadScore(lead) >= 75 ? 'badge-green' : 'badge-blue'}`}>Score {getLeadScore(lead)}</span>
                  <span style={{ fontSize: 11, color: '#aeb9c8', whiteSpace: 'nowrap' }}>{getLeadAction(lead)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {seoKeywords.length > 0 && (() => {
        const totalKlicks = seoKeywords.reduce((sum, item) => sum + item.klicks, 0)
        const avgRanking = seoKeywords.length > 0 ? Math.round(seoKeywords.reduce((sum, item) => sum + item.ranking, 0) / seoKeywords.length) : 0
        const topChance = [...seoKeywords].sort((a, b) => a.ranking - b.ranking)[0]
        const optimiert = seoKeywords.filter(item => item.status === 'Optimiert').length
        const sortedByKlicks = [...seoKeywords].sort((a, b) => b.klicks - a.klicks)
        return (
          <div className="pk-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>SEO-/Keywords-Analyse</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Live-Auswertung aus {seoKeywords.length} gespeicherten Keywords</div>
              </div>
              <span className="badge badge-green">Live aus marketing_seo_keywords</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Keywords gesamt', value: String(seoKeywords.length), icon: '🏷️', color: COLOR },
                { label: 'Klicks gesamt', value: String(totalKlicks), icon: '🖱️', color: '#1684ff' },
                { label: 'Ø Ranking', value: `#${avgRanking}`, icon: '📊', color: '#10b981' },
                { label: 'Optimiert', value: String(optimiert), icon: '✅', color: '#a78bfa' },
              ].map(item => (
                <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 10 }}>Top-Keywords nach Klicks</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {sortedByKlicks.slice(0, 5).map(row => (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{row.keyword}</span>
                      <span style={{ fontSize: 12, color: '#aeb9c8' }}>{row.klicks} Klicks</span>
                      <span style={{ fontSize: 12, color: '#aeb9c8' }}>#{row.ranking}</span>
                      <span className={`badge ${row.status === 'Optimiert' ? 'badge-green' : row.status === 'In Arbeit' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 10 }}>{row.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {topChance && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.06em', marginBottom: 6 }}>Bestes Ranking</div>
                    <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 4 }}>{topChance.keyword}</div>
                    <div style={{ fontSize: 12, color: '#d0d9e8' }}>Rang #{topChance.ranking} · {topChance.klicks} Klicks · {topChance.zielseite}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    'Keyword-Liste in Kampagnenbriefings uebernehmen',
                    'Top-Themen fuer Newsletter und Social Posts ableiten',
                    'Schwache Rankings gezielt mit Content verbessern',
                  ].map(item => (
                    <div key={item} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', color: '#d0d9e8', fontSize: 13 }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {seoKeywords.length === 0 && (
        <div className="pk-card" style={{ textAlign: 'center', color: '#aeb9c8', padding: 24 }}>
          Noch keine Keywords im SEO-Workspace gepflegt. Wechsel in den SEO-Tab, um Keywords hinzuzufügen.
        </div>
      )}
    </div>
  )
}

function KampagnenTab({
  isDemo,
  kampagnen,
  onChange,
}: {
  isDemo: boolean
  kampagnen: Kampagne[]
  onChange: (next: Kampagne[]) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Kampagne | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })
  const [editForm, setEditForm] = useState({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg)
    else setToast(msg)
    setTimeout(() => {
      setToast('')
      setErrorMsg('')
    }, 4000)
  }

  const filtered = kampagnen.filter(item => filterStatus === 'Alle' || item.status === filterStatus)
  const counts: Record<string, number> = { Alle: kampagnen.length }
  kampagnen.forEach(item => {
    counts[item.status] = (counts[item.status] || 0) + 1
  })

  const avgOpenRate = kampagnen.filter(item => item.empfaenger > 0).reduce((sum, item, _, arr) => {
    const rate = item.empfaenger > 0 ? (item.geoeffnet / item.empfaenger) * 100 : 0
    return sum + rate / arr.length
  }, 0)

  const handleSave = async () => {
    if (!form.name || !form.zielgruppe) return
    const newCampaign: Kampagne = {
      id: nextId('KMP', kampagnen.map(item => item.id)),
      name: form.name,
      typ: form.typ as Kampagne['typ'],
      status: 'Entwurf',
      zielgruppe: form.zielgruppe,
      start: form.start || '—',
      ende: form.ende || '—',
      empfaenger: 0,
      geoeffnet: 0,
      geklickt: 0,
      konversionen: 0,
      budget: form.budget ? `${form.budget} €` : '0 €',
    }

    if (!isDemo) {
      try {
        await upsertMarketingKampagne(newCampaign)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange([newCampaign, ...kampagnen])
    setForm({ name: '', typ: 'E-Mail', zielgruppe: '', start: '', ende: '', budget: '' })
    setShowForm(false)
    showToast(`✅ Kampagne "${newCampaign.name}" als Entwurf angelegt`)
  }

  const handleStatus = async (id: string, status: KampagneStatus) => {
    const updated = kampagnen.map(item => item.id === id ? { ...item, status } : item)
    const current = updated.find(item => item.id === id)

    if (!isDemo && current) {
      try {
        await upsertMarketingKampagne(current)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange(updated)
    showToast(`✅ Kampagne auf "${status}" gesetzt`)
  }

  const handleDelete = async (id: string) => {
    if (!isDemo) {
      try {
        await deleteMarketingKampagne(id)
      } catch {
        showToast('Fehler beim Löschen', true)
        setDeleteConfirm(null)
        return
      }
    }
    onChange(kampagnen.filter(item => item.id !== id))
    setDeleteConfirm(null)
    showToast('✅ Kampagne gelöscht')
  }

  const openEdit = (item: Kampagne) => {
    setEditItem(item)
    setEditForm({
      name: item.name,
      typ: item.typ,
      zielgruppe: item.zielgruppe,
      start: item.start === '—' ? '' : item.start,
      ende: item.ende === '—' ? '' : item.ende,
      budget: item.budget.replace(' €', '').replace(/\./g, ''),
    })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.zielgruppe) return
    const updated: Kampagne = {
      ...editItem,
      name: editForm.name,
      typ: editForm.typ as Kampagne['typ'],
      zielgruppe: editForm.zielgruppe,
      start: editForm.start || '—',
      ende: editForm.ende || '—',
      budget: editForm.budget ? `${editForm.budget} €` : editItem.budget,
    }
    if (!isDemo) {
      try {
        await upsertMarketingKampagne(updated)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }
    onChange(kampagnen.map(item => item.id === updated.id ? updated : item))
    setEditItem(null)
    showToast(`✅ Kampagne "${updated.name}" gespeichert`)
  }

  return (
    <div>
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditItem(null)}>
          <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Kampagne bearbeiten</h3>
              <button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {([
                { label: 'Kampagnenname *', key: 'name', placeholder: 'z.B. Sommer-Aktion' },
                { label: 'Zielgruppe *', key: 'zielgruppe', placeholder: 'z.B. Bestandskunden' },
                { label: 'Start', key: 'start', placeholder: 'TT.MM.JJJJ' },
                { label: 'Ende', key: 'ende', placeholder: 'TT.MM.JJJJ' },
                { label: 'Budget (€)', key: 'budget', placeholder: 'z.B. 1200' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{field.label}</label>
                  <input className="pk-input" placeholder={field.placeholder} value={(editForm as Record<string, string>)[field.key]} onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
                <select className="pk-input" value={editForm.typ} onChange={e => setEditForm(prev => ({ ...prev, typ: e.target.value }))}>
                  {['E-Mail', 'Social Media', 'Newsletter', 'Anzeige'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleEditSave}>Speichern</button>
              <button className="pk-btn-ghost" onClick={() => setEditItem(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Aktiv', value: String(kampagnen.filter(item => item.status === 'Aktiv').length), icon: '▶', color: '#25d366' },
          { label: 'Entwuerfe', value: String(kampagnen.filter(item => item.status === 'Entwurf').length), icon: '📝', color: COLOR },
          { label: 'Pausiert', value: String(kampagnen.filter(item => item.status === 'Pausiert').length), icon: '⏸', color: '#ffb347' },
          { label: 'Ø Oeffnungsrate', value: `${avgOpenRate.toFixed(1)}%`, icon: '📈', color: '#1684ff' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Aktiv', 'Entwurf', 'Pausiert', 'Abgeschlossen'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '6px 13px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,.1)',
                background: filterStatus === status ? 'rgba(245,158,11,.15)' : 'transparent',
                color: filterStatus === status ? '#fbbf24' : '#aeb9c8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {status} <span style={{ opacity: 0.6 }}>({counts[status] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
          {showForm ? '✕ Abbrechen' : '+ Neue Kampagne'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Neue Kampagne erstellen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { label: 'Kampagnenname *', key: 'name', placeholder: 'z.B. Sommer-Aktion' },
              { label: 'Zielgruppe *', key: 'zielgruppe', placeholder: 'z.B. Bestandskunden' },
              { label: 'Start', key: 'start', placeholder: 'TT.MM.JJJJ' },
              { label: 'Ende', key: 'ende', placeholder: 'TT.MM.JJJJ' },
              { label: 'Budget (€)', key: 'budget', placeholder: 'z.B. 1200' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{field.label}</label>
                <input className="pk-input" placeholder={field.placeholder} value={(form as Record<string, string>)[field.key]} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Typ</label>
              <select className="pk-input" value={form.typ} onChange={event => setForm(prev => ({ ...prev, typ: event.target.value }))}>
                {['E-Mail', 'Social Media', 'Newsletter', 'Anzeige'].map(type => <option key={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <button className="pk-btn" style={{ marginTop: 16, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Kampagne anlegen</button>
        </div>
      )}

      {filtered.length === 0 && (
        <EmptyState icon="📣" title="Keine Kampagnen vorhanden" description="Lege deine erste Kampagne an, um den Überblick über E-Mail, Social Media und Newsletter zu behalten." actionLabel="+ Kampagne anlegen" onAction={() => setShowForm(true)} />
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(item => {
          const openRate = item.empfaenger > 0 ? (item.geoeffnet / item.empfaenger) * 100 : 0
          const clickRate = item.geoeffnet > 0 ? (item.geklickt / item.geoeffnet) * 100 : 0
          const conversionRate = item.geklickt > 0 ? (item.konversionen / item.geklickt) * 100 : 0
          return (
            <div key={item.id} className="pk-card" style={{ border: `1px solid ${COLOR}18` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${COLOR}18`, border: `1px solid ${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {item.typ === 'E-Mail' ? '✉️' : item.typ === 'Social Media' ? '📱' : item.typ === 'Newsletter' ? '📰' : '📢'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{item.id}</span>
                    <span className="badge badge-gray">{item.typ}</span>
                    <span className={`badge ${kampagneStatusBadge[item.status]}`}>{item.status}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>👥 {item.zielgruppe} · 📅 {item.start} - {item.ende} · 💶 {item.budget}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {item.status === 'Entwurf' && <button onClick={() => handleStatus(item.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Starten</button>}
                  {item.status === 'Aktiv' && <button onClick={() => handleStatus(item.id, 'Pausiert')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(245,158,11,.3)', background: 'transparent', color: '#ffb347', cursor: 'pointer' }}>⏸ Pausieren</button>}
                  {item.status === 'Aktiv' && <button onClick={() => handleStatus(item.id, 'Abgeschlossen')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer' }}>✅ Abschliessen</button>}
                  {item.status === 'Pausiert' && <button onClick={() => handleStatus(item.id, 'Aktiv')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer' }}>▶ Fortsetzen</button>}
                  <button onClick={() => openEdit(item)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✏️</button>
                  {deleteConfirm === item.id ? (
                    <>
                      <button onClick={() => handleDelete(item.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.4)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>Löschen</button>
                      <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(item.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>🗑️</button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Empfaenger', value: item.empfaenger.toLocaleString('de-DE'), icon: '👥' },
                  { label: 'Geoeffnet', value: item.geoeffnet.toLocaleString('de-DE'), icon: '👁️' },
                  { label: 'Geklickt', value: item.geklickt.toLocaleString('de-DE'), icon: '🖱️' },
                  { label: 'Konversionen', value: item.konversionen.toLocaleString('de-DE'), icon: '🎯' },
                ].map(stat => (
                  <div key={stat.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{stat.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: COLOR }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: '#aeb9c8', marginTop: 1 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Oeffnungsrate</div>
                  <PctBar value={openRate} color={COLOR} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Klickrate</div>
                  <PctBar value={clickRate} color="#1684ff" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>Conversion aus Klicks</div>
                  <PctBar value={conversionRate} color="#10b981" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeadsTab({
  isDemo,
  leads,
  onChange,
}: {
  isDemo: boolean
  leads: Lead[]
  onChange: (next: Lead[]) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [editLeadForm, setEditLeadForm] = useState({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })
  const [filterStatus, setFilterStatus] = useState('Alle')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg)
    else setToast(msg)
    setTimeout(() => {
      setToast('')
      setErrorMsg('')
    }, 4000)
  }

  const filtered = leads.filter(lead =>
    (filterStatus === 'Alle' || lead.status === filterStatus) &&
    (lead.name.toLowerCase().includes(search.toLowerCase()) || lead.firma.toLowerCase().includes(search.toLowerCase()))
  )

  const counts: Record<string, number> = { Alle: leads.length }
  leads.forEach(lead => {
    counts[lead.status] = (counts[lead.status] || 0) + 1
  })

  const topLeads = [...leads]
    .filter(lead => !['Gewonnen', 'Verloren'].includes(lead.status))
    .sort((a, b) => getLeadScore(b) - getLeadScore(a))
    .slice(0, 3)

  const handleSave = async () => {
    if (!form.name || !form.email) return
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const newLead: Lead = {
      id: nextId('LD', leads.map(item => item.id)),
      name: form.name,
      firma: form.firma,
      email: form.email,
      telefon: form.telefon,
      quelle: form.quelle as LeadQuelle,
      status: 'Neu',
      wert: form.wert ? `${form.wert} €` : '—',
      erstellt: today,
      betreuer: form.betreuer,
    }

    if (!isDemo) {
      try {
        await upsertMarketingLead(newLead)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange([newLead, ...leads])
    setForm({ name: '', firma: '', email: '', telefon: '', quelle: 'Website', wert: '', betreuer: '' })
    setShowForm(false)
    showToast(`✅ Lead "${newLead.name}" wurde angelegt`)
  }

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const updated = leads.map(lead => lead.id === id ? { ...lead, status } : lead)
    const current = updated.find(lead => lead.id === id)

    if (!isDemo && current) {
      try {
        await upsertMarketingLead(current)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange(updated)
    showToast(`✅ Lead-Status auf "${status}" gesetzt`)
  }

  const handleDeleteLead = async (id: string) => {
    if (!isDemo) {
      try {
        await deleteMarketingLead(id)
      } catch {
        showToast('Fehler beim Löschen', true)
        setDeleteConfirm(null)
        return
      }
    }
    onChange(leads.filter(lead => lead.id !== id))
    setDeleteConfirm(null)
    showToast('✅ Lead gelöscht')
  }

  const openEditLead = (lead: Lead) => {
    setEditLead(lead)
    setEditLeadForm({
      name: lead.name,
      firma: lead.firma,
      email: lead.email,
      telefon: lead.telefon,
      quelle: lead.quelle,
      wert: lead.wert === '—' ? '' : lead.wert.replace(' €', '').replace(/\./g, ''),
      betreuer: lead.betreuer,
    })
  }

  const handleEditLeadSave = async () => {
    if (!editLead || !editLeadForm.name || !editLeadForm.email) return
    const updated: Lead = {
      ...editLead,
      name: editLeadForm.name,
      firma: editLeadForm.firma,
      email: editLeadForm.email,
      telefon: editLeadForm.telefon,
      quelle: editLeadForm.quelle as LeadQuelle,
      wert: editLeadForm.wert ? `${editLeadForm.wert} €` : editLead.wert,
      betreuer: editLeadForm.betreuer,
    }
    if (!isDemo) {
      try {
        await upsertMarketingLead(updated)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }
    onChange(leads.map(lead => lead.id === updated.id ? updated : lead))
    setEditLead(null)
    showToast(`✅ Lead "${updated.name}" gespeichert`)
  }

  return (
    <div>
      {editLead && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditLead(null)}>
          <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Lead bearbeiten</h3>
              <button onClick={() => setEditLead(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
              {([
                { label: 'Name *', key: 'name', placeholder: 'Vor- und Nachname' },
                { label: 'Firma', key: 'firma', placeholder: 'Firmenname' },
                { label: 'E-Mail *', key: 'email', placeholder: 'email@firma.de' },
                { label: 'Telefon', key: 'telefon', placeholder: '040 12345' },
                { label: 'Potenzieller Wert (€)', key: 'wert', placeholder: 'z.B. 5000' },
                { label: 'Betreuer', key: 'betreuer', placeholder: 'Mitarbeitername' },
              ] as const).map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{field.label}</label>
                  <input className="pk-input" placeholder={field.placeholder} value={(editLeadForm as Record<string, string>)[field.key]} onChange={e => setEditLeadForm(prev => ({ ...prev, [field.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Quelle</label>
                <select className="pk-input" value={editLeadForm.quelle} onChange={e => setEditLeadForm(prev => ({ ...prev, quelle: e.target.value }))}>
                  {['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise', 'Sonstiges'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleEditLeadSave}>Speichern</button>
              <button className="pk-btn-ghost" onClick={() => setEditLead(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />

      {topLeads.length > 0 && (
        <div className="pk-card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Lead Intelligence</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {topLeads.map(lead => (
              <div key={lead.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>{lead.name}</div>
                  <span className={`badge ${leadStatusBadge[lead.status]}`}>Score {getLeadScore(lead)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>{lead.firma || 'Ohne Firma'} · {lead.quelle}</div>
                <div style={{ fontSize: 12, color: '#d0d9e8', lineHeight: 1.5 }}>{getLeadAction(lead)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pk-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#aeb9c8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Pipeline-Uebersicht</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }}>
          {leadPipeline.slice(0, 5).map((status, index) => {
            const count = leads.filter(lead => lead.status === status).length
            const amount = leads.filter(lead => lead.status === status).reduce((sum, lead) => sum + parseCurrency(lead.wert), 0)
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 110, padding: '10px 14px', borderRadius: 12, textAlign: 'center', background: count > 0 ? `${leadStatusColor[status]}15` : 'rgba(255,255,255,.04)', border: `1px solid ${count > 0 ? `${leadStatusColor[status]}30` : 'rgba(255,255,255,.06)'}` }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: count > 0 ? leadStatusColor[status] : '#4a5568' }}>{count}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 1 }}>{status}</div>
                  {count > 0 && <div style={{ fontSize: 10, color: leadStatusColor[status], marginTop: 2, fontWeight: 700 }}>{formatCurrency(amount)}</div>}
                </div>
                {index < 4 && <span style={{ color: '#4a5568', fontSize: 18 }}>›</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="pk-input" placeholder="🔍 Leads suchen..." value={search} onChange={event => setSearch(event.target.value)} style={{ maxWidth: 260 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Neu', 'Kontaktiert', 'Qualifiziert', 'Angebot', 'Gewonnen'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,.1)',
                background: filterStatus === status ? 'rgba(245,158,11,.15)' : 'transparent',
                color: filterStatus === status ? '#fbbf24' : '#aeb9c8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {status} <span style={{ opacity: 0.6 }}>({counts[status] ?? 0})</span>
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ marginLeft: 'auto', fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Lead'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Neuen Lead anlegen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Vor- und Nachname' },
              { label: 'Firma', key: 'firma', placeholder: 'Firmenname' },
              { label: 'E-Mail *', key: 'email', placeholder: 'email@firma.de' },
              { label: 'Telefon', key: 'telefon', placeholder: '040 12345' },
              { label: 'Potenzieller Wert (€)', key: 'wert', placeholder: 'z.B. 5000' },
              { label: 'Betreuer', key: 'betreuer', placeholder: 'Mitarbeitername' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>{field.label}</label>
                <input className="pk-input" placeholder={field.placeholder} value={(form as Record<string, string>)[field.key]} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Quelle</label>
              <select className="pk-input" value={form.quelle} onChange={event => setForm(prev => ({ ...prev, quelle: event.target.value }))}>
                {['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise', 'Sonstiges'].map(source => <option key={source}>{source}</option>)}
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
              <th>Lead</th>
              <th>Quelle</th>
              <th>Status</th>
              <th>Wert</th>
              <th>Score</th>
              <th>Betreuer</th>
              <th>Erstellt</th>
              <th>Aktion</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>{lead.firma || 'Ohne Firma'} · {lead.email}</div>
                </td>
                <td><span className="badge badge-gray">{lead.quelle}</span></td>
                <td><span className={`badge ${leadStatusBadge[lead.status]}`}>{lead.status}</span></td>
                <td style={{ fontWeight: 700, color: lead.status === 'Gewonnen' ? '#4ddb7e' : COLOR }}>{lead.wert}</td>
                <td style={{ color: '#f8fbff', fontWeight: 700 }}>{getLeadScore(lead)}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{lead.betreuer || '—'}</td>
                <td style={{ color: '#aeb9c8', fontSize: 13 }}>{lead.erstellt}</td>
                <td>
                  {lead.status !== 'Gewonnen' && lead.status !== 'Verloren' && (
                    <select className="pk-input" style={{ fontSize: 11, padding: '3px 8px', width: 'auto', cursor: 'pointer' }} value={lead.status} onChange={event => handleStatusChange(lead.id, event.target.value as LeadStatus)}>
                      {leadPipeline.map(status => <option key={status}>{status}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => openEditLead(lead)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>✏️</button>
                    {deleteConfirm === lead.id ? (
                      <>
                        <button onClick={() => handleDeleteLead(lead.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,80,80,.4)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>Löschen</button>
                        <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(lead.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>🗑️</button>
                    )}
                  </div>
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

function NewsletterTab({
  isDemo,
  kampagnen,
  newsletter,
  onChange,
}: {
  isDemo: boolean
  kampagnen: Kampagne[]
  newsletter: Newsletter[]
  onChange: (next: Newsletter[]) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editNewsletter, setEditNewsletter] = useState<Newsletter | null>(null)
  const [editNlForm, setEditNlForm] = useState({ betreff: '', vorschau: '', datum: '', empfaenger: '' })
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Alle' | NewsletterStatus>('Alle')
  const [form, setForm] = useState({ betreff: '', vorschau: '', datum: '' })

  const showToast = (msg: string, error = false) => {
    if (error) setErrorMsg(msg)
    else setToast(msg)
    setTimeout(() => {
      setToast('')
      setErrorMsg('')
    }, 4000)
  }

  const averages = getNewsletterAverages(newsletter)
  const filtered = newsletter.filter(item => statusFilter === 'Alle' || item.status === statusFilter)

  const handleSave = async () => {
    if (!form.betreff) return
    const newItem: Newsletter = {
      id: nextId('NL', newsletter.map(item => item.id)),
      betreff: form.betreff,
      vorschau: form.vorschau || 'Klicken Sie hier, um mehr zu erfahren...',
      empfaenger: 312,
      datum: form.datum || new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      status: 'Entwurf',
      oeffnungsrate: 0,
      klickrate: 0,
    }

    if (!isDemo) {
      try {
        await upsertMarketingNewsletter(newItem)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange([newItem, ...newsletter])
    setForm({ betreff: '', vorschau: '', datum: '' })
    setShowForm(false)
    showToast(`✅ Newsletter "${newItem.betreff.substring(0, 40)}" als Entwurf gespeichert`)
  }

  const updateNewsletter = async (id: string, updater: (current: Newsletter) => Newsletter, successMessage: string) => {
    const current = newsletter.find(item => item.id === id)
    if (!current) return
    const updatedItem = updater(current)

    if (!isDemo) {
      try {
        await upsertMarketingNewsletter(updatedItem)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }

    onChange(newsletter.map(item => item.id === id ? updatedItem : item))
    showToast(successMessage)
  }

  const handleDeleteNewsletter = async (id: string) => {
    if (!isDemo) {
      try {
        await deleteMarketingNewsletter(id)
      } catch {
        showToast('Fehler beim Löschen', true)
        setDeleteConfirm(null)
        return
      }
    }
    onChange(newsletter.filter(item => item.id !== id))
    setDeleteConfirm(null)
    showToast('✅ Newsletter gelöscht')
  }

  const openEditNewsletter = (item: Newsletter) => {
    setEditNewsletter(item)
    setEditNlForm({
      betreff: item.betreff,
      vorschau: item.vorschau,
      datum: item.datum,
      empfaenger: String(item.empfaenger),
    })
  }

  const handleEditNlSave = async () => {
    if (!editNewsletter || !editNlForm.betreff) return
    const updated: Newsletter = {
      ...editNewsletter,
      betreff: editNlForm.betreff,
      vorschau: editNlForm.vorschau || editNewsletter.vorschau,
      datum: editNlForm.datum || editNewsletter.datum,
      empfaenger: Number(editNlForm.empfaenger) || editNewsletter.empfaenger,
    }
    if (!isDemo) {
      try {
        await upsertMarketingNewsletter(updated)
      } catch {
        showToast('Fehler beim Speichern', true)
        return
      }
    }
    onChange(newsletter.map(item => item.id === updated.id ? updated : item))
    setEditNewsletter(null)
    showToast(`✅ Newsletter "${updated.betreff.substring(0, 40)}" gespeichert`)
  }

  return (
    <div>
      {editNewsletter && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditNewsletter(null)}>
          <div className="pk-card fade-in" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Newsletter bearbeiten</h3>
              <button onClick={() => setEditNewsletter(null)} style={{ background: 'none', border: 'none', color: '#aeb9c8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Betreff *</label>
                <input className="pk-input" value={editNlForm.betreff} onChange={e => setEditNlForm(prev => ({ ...prev, betreff: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Vorschautext</label>
                <input className="pk-input" value={editNlForm.vorschau} onChange={e => setEditNlForm(prev => ({ ...prev, vorschau: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Versanddatum</label>
                  <input className="pk-input" placeholder="TT.MM.JJJJ" value={editNlForm.datum} onChange={e => setEditNlForm(prev => ({ ...prev, datum: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Empfänger</label>
                  <input className="pk-input" type="number" value={editNlForm.empfaenger} onChange={e => setEditNlForm(prev => ({ ...prev, empfaenger: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleEditNlSave}>Speichern</button>
              <button className="pk-btn-ghost" onClick={() => setEditNewsletter(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Abonnenten', value: '312', icon: '👥', color: COLOR },
          { label: 'Ø Oeffnungsrate', value: `${averages.openRate.toFixed(1)}%`, icon: '👁️', color: '#10b981' },
          { label: 'Ø Klickrate', value: `${averages.clickRate.toFixed(1)}%`, icon: '🖱️', color: '#1684ff' },
          { label: 'Geplant + Entwurf', value: String(newsletter.filter(item => item.status !== 'Versendet').length), icon: '🗂️', color: '#a78bfa' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Alle', 'Entwurf', 'Geplant', 'Versendet'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,.1)',
                background: statusFilter === status ? 'rgba(245,158,11,.15)' : 'transparent',
                color: statusFilter === status ? '#fbbf24' : '#aeb9c8',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {status}
            </button>
          ))}
        </div>
        <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
          {showForm ? '✕ Abbrechen' : '+ Neuer Newsletter'}
        </button>
      </div>

      {showForm && (
        <div className="pk-card fade-in" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,.2)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Neuen Newsletter erstellen</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Betreff *</label>
              <input className="pk-input" placeholder="E-Mail-Betreff eingeben..." value={form.betreff} onChange={event => setForm(prev => ({ ...prev, betreff: event.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Vorschautext</label>
              <input className="pk-input" placeholder="Kurze Vorschau fuer den Posteingang..." value={form.vorschau} onChange={event => setForm(prev => ({ ...prev, vorschau: event.target.value }))} />
            </div>
            <div style={{ maxWidth: 260 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase' }}>Versanddatum</label>
              <input className="pk-input" placeholder="TT.MM.JJJJ" value={form.datum} onChange={event => setForm(prev => ({ ...prev, datum: event.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="pk-btn" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Als Entwurf speichern</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(item => (
          <div key={item.id} className="pk-card" style={{ border: `1px solid ${COLOR}15` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${COLOR}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📰</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span className={`badge ${item.status === 'Versendet' ? 'badge-green' : item.status === 'Geplant' ? 'badge-blue' : 'badge-gray'}`}>{item.status}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aeb9c8' }}>{item.id}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{item.betreff}</div>
                <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: item.status === 'Versendet' ? 10 : 8 }}>
                  {item.vorschau.substring(0, 80)}... · 📅 {item.datum} · 👥 {item.empfaenger} Empfaenger
                </div>
                {item.status === 'Versendet' && (
                  <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Oeffnungsrate</div>
                      <PctBar value={item.oeffnungsrate} color={COLOR} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 3 }}>Klickrate</div>
                      <PctBar value={item.klickrate} color="#1684ff" />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                {item.status === 'Entwurf' && (
                  <button onClick={() => updateNewsletter(item.id, current => ({ ...current, status: 'Geplant' }), '✅ Newsletter wurde eingeplant')} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(22,132,255,.3)', background: 'transparent', color: '#6cb6ff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    📅 Planen
                  </button>
                )}
                {item.status !== 'Versendet' && (
                  <button
                    onClick={() => updateNewsletter(item.id, current => ({ ...current, status: 'Versendet', ...createNewsletterMetrics(current, kampagnen) }), `✅ Newsletter wurde versendet${isDemo ? ' (Demo-Simulation)' : ''}`)}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(37,211,102,.3)', background: 'transparent', color: '#4ddb7e', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    📤 Jetzt versenden
                  </button>
                )}
                {item.status === 'Geplant' && (
                  <button onClick={() => updateNewsletter(item.id, current => ({ ...current, status: 'Entwurf' }), '✅ Newsletter zurueck in Entwurf gesetzt')} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ↺ Entwurf
                  </button>
                )}
                <button onClick={() => openEditNewsletter(item)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer', whiteSpace: 'nowrap' }}>✏️ Bearbeiten</button>
                {deleteConfirm === item.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleDeleteNewsletter(item.id)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,80,80,.4)', background: 'transparent', color: '#ff8080', cursor: 'pointer' }}>Löschen</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer' }}>Nein</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(item.id)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: '#aeb9c8', cursor: 'pointer', whiteSpace: 'nowrap' }}>🗑️ Löschen</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeoTab({
  isDemo,
  seoKeywords,
  onChange,
}: {
  isDemo: boolean
  seoKeywords: SeoKeyword[]
  onChange: (next: SeoKeyword[]) => Promise<boolean>
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ keyword: '', zielseite: '/marketingpilot', intent: 'Transaktional', suchvolumen: '', schwierigkeit: '', ranking: '', klicks: '' })
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const avgRanking = seoKeywords.length > 0 ? seoKeywords.reduce((sum, item) => sum + item.ranking, 0) / seoKeywords.length : 0
  const totalClicks = seoKeywords.reduce((sum, item) => sum + item.klicks, 0)
  const topChance = [...seoKeywords].sort((a, b) => a.ranking - b.ranking)[0]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const showError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(''), 4000)
  }

  const handleSave = async () => {
    if (!form.keyword) return
    const nextItem: SeoKeyword = {
      id: nextId('SEO', seoKeywords.map(item => item.id)),
      keyword: form.keyword,
      zielseite: form.zielseite,
      intent: form.intent as SeoIntent,
      suchvolumen: Number(form.suchvolumen || 0),
      schwierigkeit: Number(form.schwierigkeit || 0),
      ranking: Number(form.ranking || 0),
      klicks: Number(form.klicks || 0),
      status: 'Neu',
    }
    const saved = await onChange([nextItem, ...seoKeywords])
    if (!saved) {
      showError('Fehler beim Speichern')
      return
    }
    setForm({ keyword: '', zielseite: '/marketingpilot', intent: 'Transaktional', suchvolumen: '', schwierigkeit: '', ranking: '', klicks: '' })
    setShowForm(false)
    showToast(`✅ Keyword "${nextItem.keyword}" aufgenommen${isDemo ? ' (lokal)' : ''}`)
  }

  const updateStatus = async (id: string, status: SeoStatus) => {
    const saved = await onChange(seoKeywords.map(item => item.id === id ? { ...item, status } : item))
    if (!saved) {
      showError('Fehler beim Speichern')
      return
    }
    showToast(`✅ SEO-Status auf "${status}" gesetzt${isDemo ? ' (lokal)' : ''}`)
  }

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Keywords aktiv', value: String(seoKeywords.length), icon: '🏷️', color: COLOR },
          { label: 'Gesamt-Klicks', value: String(totalClicks), icon: '🖱️', color: '#1684ff' },
          { label: 'Ø Ranking', value: avgRanking > 0 ? avgRanking.toFixed(1) : '—', icon: '📈', color: '#10b981' },
          { label: 'Top-Chance', value: topChance ? topChance.keyword : '—', icon: '🚀', color: '#a78bfa' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: item.label === 'Top-Chance' ? 14 : 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="pk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>SEO-Workspace</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Keywords, Landingpages, Rankings und naechste Optimierungsschritte direkt im Pilot</div>
          </div>
          <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
            {showForm ? '✕ Abbrechen' : '+ Keyword'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Keyword *', key: 'keyword', placeholder: 'z.B. seo marketing pilot' },
              { label: 'Zielseite', key: 'zielseite', placeholder: '/marketingpilot' },
              { label: 'Suchvolumen', key: 'suchvolumen', placeholder: '80' },
              { label: 'Schwierigkeit', key: 'schwierigkeit', placeholder: '45' },
              { label: 'Ranking', key: 'ranking', placeholder: '12' },
              { label: 'Klicks', key: 'klicks', placeholder: '18' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>{field.label}</label>
                <input className="pk-input" value={(form as Record<string, string>)[field.key]} placeholder={field.placeholder} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Intent</label>
              <select className="pk-input" value={form.intent} onChange={event => setForm(prev => ({ ...prev, intent: event.target.value }))}>
                {['Informativ', 'Transaktional', 'Lokal', 'Brand'].map(intent => <option key={intent}>{intent}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="pk-btn" style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Speichern</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {seoKeywords.map(item => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.keyword}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{item.zielseite} · {item.intent} · Ranking {item.ranking}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${item.status === 'Optimiert' ? 'badge-green' : item.status === 'In Arbeit' ? 'badge-blue' : 'badge-gray'}`}>{item.status}</span>
                  <select className="pk-input" style={{ width: 'auto', padding: '5px 10px' }} value={item.status} onChange={event => updateStatus(item.id, event.target.value as SeoStatus)}>
                    {['Neu', 'In Arbeit', 'Optimiert'].map(status => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Volumen', value: item.suchvolumen },
                  { label: 'Schwierigkeit', value: item.schwierigkeit },
                  { label: 'Klicks', value: item.klicks },
                  { label: 'Chance', value: Math.max(0, 100 - item.schwierigkeit + (20 - item.ranking)) },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
                    <div style={{ fontSize: 11, color: '#aeb9c8' }}>{stat.label}</div>
                    <div style={{ fontWeight: 800, marginTop: 3 }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ContentTab({
  isDemo,
  seoKeywords,
  contentIdeas,
  onChange,
}: {
  isDemo: boolean
  seoKeywords: SeoKeyword[]
  contentIdeas: ContentIdea[]
  onChange: (next: ContentIdea[]) => Promise<boolean>
}) {
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ titel: '', kanal: 'LinkedIn', ziel: '', keyword: seoKeywords[0]?.keyword ?? '', hook: '', cta: '' })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleSave = async () => {
    if (!form.titel) return
    const nextItem: ContentIdea = {
      id: nextId('CNT', contentIdeas.map(item => item.id)),
      titel: form.titel,
      kanal: form.kanal as PostingChannel,
      ziel: form.ziel || 'Sichtbarkeit',
      keyword: form.keyword,
      hook: form.hook,
      cta: form.cta,
      status: 'Idee',
    }
    const saved = await onChange([nextItem, ...contentIdeas])
    if (!saved) {
      setErrorMsg('Fehler beim Speichern')
      return
    }
    setForm({ titel: '', kanal: 'LinkedIn', ziel: '', keyword: seoKeywords[0]?.keyword ?? '', hook: '', cta: '' })
    setShowForm(false)
    showToast(`✅ Content-Idee "${nextItem.titel}" angelegt${isDemo ? ' (lokal)' : ''}`)
  }

  const updateStatus = async (id: string, status: ContentStatus) => {
    const saved = await onChange(contentIdeas.map(item => item.id === id ? { ...item, status } : item))
    if (!saved) {
      setErrorMsg('Fehler beim Speichern')
    }
  }

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />
      <div className="pk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Content-Studio</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Hooks, Ziele, Keywords und CTA sauber pro Asset ausarbeiten</div>
          </div>
          <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
            {showForm ? '✕ Abbrechen' : '+ Content-Idee'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Titel *', key: 'titel', placeholder: 'z.B. LinkedIn Story ueber Prozesschaos' },
              { label: 'Ziel', key: 'ziel', placeholder: 'Leadaufbau' },
              { label: 'Hook', key: 'hook', placeholder: 'Viele Teams verlieren Geld durch...' },
              { label: 'CTA', key: 'cta', placeholder: 'Demo buchen' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>{field.label}</label>
                <input className="pk-input" value={(form as Record<string, string>)[field.key]} placeholder={field.placeholder} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Kanal</label>
              <select className="pk-input" value={form.kanal} onChange={event => setForm(prev => ({ ...prev, kanal: event.target.value }))}>
                {['LinkedIn', 'Instagram', 'Facebook', 'Newsletter', 'Blog', 'WhatsApp'].map(channel => <option key={channel}>{channel}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Keyword</label>
              <select className="pk-input" value={form.keyword} onChange={event => setForm(prev => ({ ...prev, keyword: event.target.value }))}>
                {seoKeywords.map(item => <option key={item.id} value={item.keyword}>{item.keyword}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="pk-btn" style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Speichern</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {contentIdeas.map(item => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.titel}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{item.kanal} · Ziel: {item.ziel} · Keyword: {item.keyword}</div>
                </div>
                <select className="pk-input" style={{ width: 'auto', padding: '5px 10px' }} value={item.status} onChange={event => updateStatus(item.id, event.target.value as ContentStatus)}>
                  {['Idee', 'In Arbeit', 'Freigabe', 'Fertig'].map(status => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div className="mobile-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>Hook</div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{item.hook || 'Noch kein Hook hinterlegt'}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8' }}>CTA</div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{item.cta || 'Noch kein CTA hinterlegt'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PostingTab({
  isDemo,
  postingPlans,
  contentIdeas,
  onChange,
}: {
  isDemo: boolean
  postingPlans: PostingPlan[]
  contentIdeas: ContentIdea[]
  onChange: (next: PostingPlan[]) => Promise<boolean>
}) {
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ titel: '', kanal: 'LinkedIn', datum: '', owner: 'Marketing', quelle: contentIdeas[0]?.id ?? '' })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleSave = async () => {
    if (!form.titel || !form.datum) return
    const nextItem: PostingPlan = {
      id: nextId('PST', postingPlans.map(item => item.id)),
      titel: form.titel,
      kanal: form.kanal as PostingChannel,
      datum: form.datum,
      status: 'Entwurf',
      owner: form.owner,
      quelle: form.quelle || 'Manuell',
    }
    const saved = await onChange([nextItem, ...postingPlans])
    if (!saved) {
      setErrorMsg('Fehler beim Speichern')
      return
    }
    setForm({ titel: '', kanal: 'LinkedIn', datum: '', owner: 'Marketing', quelle: contentIdeas[0]?.id ?? '' })
    setShowForm(false)
    showToast(`✅ Posting "${nextItem.titel}" angelegt${isDemo ? ' (lokal)' : ''}`)
  }

  const updateStatus = async (id: string, status: PostingStatus) => {
    const saved = await onChange(postingPlans.map(item => item.id === id ? { ...item, status } : item))
    if (!saved) {
      setErrorMsg('Fehler beim Speichern')
    }
  }

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />
      <div className="pk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Posting-Planung</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Kalender, Status und Verantwortliche fuer alle Kanaele in einer Liste</div>
          </div>
          <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
            {showForm ? '✕ Abbrechen' : '+ Posting'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Titel *', key: 'titel', placeholder: 'z.B. LinkedIn Case Study' },
              { label: 'Datum *', key: 'datum', placeholder: '18.05.2026' },
              { label: 'Owner', key: 'owner', placeholder: 'Marketing' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>{field.label}</label>
                <input className="pk-input" value={(form as Record<string, string>)[field.key]} placeholder={field.placeholder} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Kanal</label>
              <select className="pk-input" value={form.kanal} onChange={event => setForm(prev => ({ ...prev, kanal: event.target.value }))}>
                {['LinkedIn', 'Instagram', 'Facebook', 'Newsletter', 'Blog', 'WhatsApp'].map(channel => <option key={channel}>{channel}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Quelle</label>
              <select className="pk-input" value={form.quelle} onChange={event => setForm(prev => ({ ...prev, quelle: event.target.value }))}>
                <option value="Manuell">Manuell</option>
                {contentIdeas.map(item => <option key={item.id} value={item.id}>{item.titel}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="pk-btn" style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Speichern</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {postingPlans.map(item => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.titel}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>{item.kanal} · {item.datum} · Owner: {item.owner}</div>
                </div>
                <select className="pk-input" style={{ width: 'auto', padding: '5px 10px' }} value={item.status} onChange={event => updateStatus(item.id, event.target.value as PostingStatus)}>
                  {['Entwurf', 'Geplant', 'Veroeffentlicht'].map(status => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#d0d9e8' }}>Quelle: {contentIdeas.find(content => content.id === item.quelle)?.titel ?? item.quelle}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AutomationenTab({
  isDemo,
  automationRules,
  leads,
  onChange,
}: {
  isDemo: boolean
  automationRules: AutomationRule[]
  leads: Lead[]
  onChange: (next: AutomationRule[]) => Promise<boolean>
}) {
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', trigger: '', aktion: '', kanal: 'CRM', owner: 'Marketing' })

  const hotLeads = leads.filter(lead => getLeadScore(lead) >= 75 && !['Gewonnen', 'Verloren'].includes(lead.status))

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleSave = async () => {
    if (!form.name || !form.trigger) return
    const nextItem: AutomationRule = {
      id: nextId('AUT', automationRules.map(item => item.id)),
      name: form.name,
      trigger: form.trigger,
      aktion: form.aktion,
      kanal: form.kanal as AutomationRule['kanal'],
      owner: form.owner,
      status: 'Entwurf',
    }
    const saved = await onChange([nextItem, ...automationRules])
    if (!saved) {
      setErrorMsg('Fehler beim Speichern')
      return
    }
    setForm({ name: '', trigger: '', aktion: '', kanal: 'CRM', owner: 'Marketing' })
    setShowForm(false)
    showToast(`✅ Automation "${nextItem.name}" angelegt${isDemo ? ' (lokal)' : ''}`)
  }

  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <Toast msg={toast} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aktive Regeln', value: String(automationRules.filter(item => item.status === 'Aktiv').length), icon: '⚙️', color: COLOR },
          { label: 'Heisse Leads', value: String(hotLeads.length), icon: '🔥', color: '#25d366' },
          { label: 'Entwuerfe', value: String(automationRules.filter(item => item.status === 'Entwurf').length), icon: '📝', color: '#a78bfa' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {hotLeads.length > 0 && (
        <div className="pk-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 12 }}>Follow-up Queue</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {hotLeads.slice(0, 5).map(lead => (
              <div key={lead.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{lead.name} · Score {getLeadScore(lead)}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>{lead.firma || 'Ohne Firma'} · {lead.status} · {lead.quelle}</div>
                </div>
                <div style={{ fontSize: 12, color: '#d0d9e8', maxWidth: 320 }}>{getLeadAction(lead)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Automationen & Follow-up</div>
            <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>Fuer Leads, Newsletter und Vertriebsaktionen vorbereitete Regeln im Pilot</div>
          </div>
          <button className="pk-btn" style={{ fontSize: 13, background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={() => setShowForm(open => !open)}>
            {showForm ? '✕ Abbrechen' : '+ Automation'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Name *', key: 'name', placeholder: 'Lead-Follow-up' },
              { label: 'Trigger *', key: 'trigger', placeholder: 'Lead wechselt auf Angebot' },
              { label: 'Aktion', key: 'aktion', placeholder: 'WhatsApp + Aufgabe erstellen' },
              { label: 'Owner', key: 'owner', placeholder: 'Vertrieb' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>{field.label}</label>
                <input className="pk-input" value={(form as Record<string, string>)[field.key]} placeholder={field.placeholder} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#aeb9c8', marginBottom: 6, fontWeight: 700 }}>Kanal</label>
              <select className="pk-input" value={form.kanal} onChange={event => setForm(prev => ({ ...prev, kanal: event.target.value }))}>
                {['CRM', 'E-Mail', 'WhatsApp', 'LinkedIn'].map(channel => <option key={channel}>{channel}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="pk-btn" style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleSave}>Speichern</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {automationRules.map(item => (
            <div key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 2 }}>Trigger: {item.trigger}</div>
                </div>
                <select className="pk-input" style={{ width: 'auto', padding: '5px 10px' }} value={item.status} onChange={async event => {
                  const saved = await onChange(automationRules.map(rule => rule.id === item.id ? { ...rule, status: event.target.value as AutomationStatus } : rule))
                  if (!saved) setErrorMsg('Fehler beim Speichern')
                }}>
                  {['Aktiv', 'Entwurf', 'Pausiert'].map(status => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 13, color: '#d0d9e8', marginBottom: 4 }}>{item.aktion || 'Aktion noch offen'}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>{item.kanal} · Owner: {item.owner}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IntegrationenTab({
  isDemo,
  integrationItems,
  onChange,
}: {
  isDemo: boolean
  integrationItems: IntegrationItem[]
  onChange: (next: IntegrationItem[]) => Promise<boolean>
}) {
  const [errorMsg, setErrorMsg] = useState('')
  return (
    <div>
      {errorMsg && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.3)', color: '#ff8080', fontSize: 13 }}>{errorMsg}</div>}
      <div className="pk-card">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Integrationen vorbereiten</div>
          <div style={{ fontSize: 12, color: '#aeb9c8', marginTop: 3 }}>CRM, Ads, WhatsApp und SEO-Schnittstellen als echter Arbeitsbereich fuer den weiteren Ausbau</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {integrationItems.map(item => (
            <div key={item.id} style={{ padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <select className="pk-input" style={{ width: 'auto', padding: '5px 10px' }} value={item.status} onChange={async event => {
                  const saved = await onChange(integrationItems.map(current => current.id === item.id ? { ...current, status: event.target.value as IntegrationStatus } : current))
                  if (!saved) setErrorMsg(`Fehler beim Speichern${isDemo ? ' (lokal)' : ''}`)
                }}>
                  {['Nicht gestartet', 'Vorbereitet', 'In Umsetzung', 'Live'].map(status => <option key={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: '#aeb9c8', marginBottom: 8 }}>Datenbasis: {item.datenbasis}</div>
              <div style={{ fontSize: 13, color: '#d0d9e8', marginBottom: 6 }}>{item.naechsterSchritt}</div>
              <div style={{ fontSize: 12, color: '#aeb9c8' }}>Letzter Sync: {item.letzterSync}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuswertungenTab({
  leads,
  kampagnen,
  newsletter,
  seoKeywords,
  contentIdeas,
  postingPlans,
}: {
  leads: Lead[]
  kampagnen: Kampagne[]
  newsletter: Newsletter[]
  seoKeywords: SeoKeyword[]
  contentIdeas: ContentIdea[]
  postingPlans: PostingPlan[]
}) {
  const totalLeads = leads.length
  const wonLeads = leads.filter(lead => lead.status === 'Gewonnen').length
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0.0'
  const pipelineValue = leads.filter(lead => !['Gewonnen', 'Verloren'].includes(lead.status)).reduce((sum, lead) => sum + parseCurrency(lead.wert), 0)
  const averages = getNewsletterAverages(newsletter)
  const avgSeoRanking = seoKeywords.length > 0 ? seoKeywords.reduce((sum, item) => sum + item.ranking, 0) / seoKeywords.length : 0
  const publishedPosts = postingPlans.filter(item => item.status === 'Veroeffentlicht').length
  const readyContent = contentIdeas.filter(item => item.status === 'Fertig').length

  const sourceStats = ['Website', 'Empfehlung', 'Messe', 'Social Media', 'Kaltakquise'].map(source => ({
    quelle: source,
    count: leads.filter(lead => lead.quelle === source).length,
    gewonnen: leads.filter(lead => lead.quelle === source && lead.status === 'Gewonnen').length,
  }))

  const campaignPerformance = kampagnen
    .filter(item => item.empfaenger > 0)
    .map(item => ({
      id: item.id,
      name: item.name,
      openRate: item.empfaenger > 0 ? (item.geoeffnet / item.empfaenger) * 100 : 0,
      clickRate: item.geoeffnet > 0 ? (item.geklickt / item.geoeffnet) * 100 : 0,
      conversionRate: item.geklickt > 0 ? (item.konversionen / item.geklickt) * 100 : 0,
    }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Leads gesamt', value: String(totalLeads), icon: '🎯', color: COLOR },
          { label: 'Gewonnen', value: String(wonLeads), icon: '🏆', color: '#10b981' },
          { label: 'Konversionsrate', value: `${conversionRate}%`, icon: '📈', color: '#1684ff' },
          { label: 'Pipeline-Wert', value: formatCurrency(pipelineValue), icon: '💶', color: '#a78bfa' },
          { label: 'Aktive Kampagnen', value: String(kampagnen.filter(item => item.status === 'Aktiv').length), icon: '📣', color: COLOR },
          { label: 'Ø Oeffnungsrate', value: `${averages.openRate.toFixed(1)}%`, icon: '👁️', color: '#10b981' },
          { label: 'Ø SEO-Ranking', value: avgSeoRanking > 0 ? avgSeoRanking.toFixed(1) : '—', icon: '🔎', color: '#6cb6ff' },
          { label: 'Content fertig', value: String(readyContent), icon: '✍️', color: '#f472b6' },
          { label: 'Posts live', value: String(publishedPosts), icon: '📅', color: '#f97316' },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>Leads nach Quelle</h3>
          {sourceStats.filter(item => item.count > 0).map(item => (
            <div key={item.quelle} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.quelle}</span>
                <span style={{ color: '#aeb9c8' }}>{item.count} Leads · {item.gewonnen} gewonnen</span>
              </div>
              <PctBar value={totalLeads > 0 ? (item.count / totalLeads) * 100 : 0} color={COLOR} />
            </div>
          ))}
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>Kampagnen-Performance</h3>
          {campaignPerformance.map(item => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span style={{ color: '#aeb9c8' }}>{item.openRate.toFixed(1)}% Oeffnungsrate</span>
              </div>
              <PctBar value={item.openRate} color={COLOR} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6, fontSize: 12, color: '#aeb9c8' }}>
                <span>Klickrate: {item.clickRate.toFixed(1)}%</span>
                <span>Conversion: {item.conversionRate.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>Newsletter-Funnel</h3>
          {[
            { label: 'Entwurf', value: newsletter.filter(item => item.status === 'Entwurf').length, color: '#aeb9c8' },
            { label: 'Geplant', value: newsletter.filter(item => item.status === 'Geplant').length, color: '#1684ff' },
            { label: 'Versendet', value: newsletter.filter(item => item.status === 'Versendet').length, color: '#25d366' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span>
              </div>
              <PctBar value={newsletter.length > 0 ? (item.value / newsletter.length) * 100 : 0} color={item.color} />
            </div>
          ))}
        </div>

        <div className="pk-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800 }}>SEO & Content-Fortschritt</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {seoKeywords.slice(0, 4).map(item => (
              <div key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{item.keyword}</span>
                  <span style={{ color: '#aeb9c8' }}>Ranking {item.ranking}</span>
                </div>
                <PctBar value={Math.max(0, 100 - item.ranking * 4)} color="#6cb6ff" />
              </div>
            ))}
            <div style={{ marginTop: 4, fontSize: 12, color: '#aeb9c8' }}>
              {contentIdeas.filter(item => item.status === 'In Arbeit' || item.status === 'Freigabe').length} Content-Stuecke sind gerade in Arbeit oder Freigabe.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MarketingPilotPage() {
  const [isDemo] = useState(() => hasDemoCookie())
  const [tab, setTab] = useState<Tab>('demo-lab')
  const [kampagnen, setKampagnen] = useState<Kampagne[]>(isDemo ? demoKampagnen : [])
  const [leads, setLeads] = useState<Lead[]>(isDemo ? demoLeads : [])
  const [newsletter, setNewsletter] = useState<Newsletter[]>(isDemo ? demoNewsletter : [])
  const [seoKeywords, setSeoKeywords] = useState<SeoKeyword[]>(isDemo ? defaultSeoKeywords : [])
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>(isDemo ? defaultContentIdeas : [])
  const [postingPlans, setPostingPlans] = useState<PostingPlan[]>(isDemo ? defaultPostingPlans : [])
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(isDemo ? defaultAutomationRules : [])
  const [integrationItems, setIntegrationItems] = useState<IntegrationItem[]>(isDemo ? defaultIntegrationItems : [])
  const [loading, setLoading] = useState(!isDemo)
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = () => {
    if (isDemo) return
    setLoading(true)
    setErrorMsg('')
    Promise.all([
      getMarketingKampagnen(),
      getMarketingLeads(),
      getMarketingNewsletter(),
      getMarketingSeoKeywords(),
      getMarketingContentIdeas(),
      getMarketingPostingPlans(),
      getMarketingAutomationRules(),
      getMarketingIntegrationItems(),
    ])
      .then(([campaignRows, leadRows, newsletterRows, seoRows, contentRows, postingRows, automationRows, integrationRows]) => {
        setKampagnen(campaignRows as Kampagne[])
        setLeads(leadRows as Lead[])
        setNewsletter(newsletterRows as Newsletter[])
        setSeoKeywords(seoRows as SeoKeyword[])
        setContentIdeas((contentRows as ContentIdea[]).length > 0 ? contentRows as ContentIdea[] : defaultContentIdeas)
        setPostingPlans((postingRows as PostingPlan[]).length > 0 ? postingRows as PostingPlan[] : defaultPostingPlans)
        setAutomationRules((automationRows as AutomationRule[]).length > 0 ? automationRows as AutomationRule[] : defaultAutomationRules)
        setIntegrationItems((integrationRows as IntegrationItem[]).length > 0 ? integrationRows as IntegrationItem[] : defaultIntegrationItems)
      })
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Fehler beim Laden der Daten'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const saveSeoKeywords = async (next: SeoKeyword[]) => {
    const changedItem = findChangedItem(next, seoKeywords)

    if (!changedItem) {
      setSeoKeywords(next)
      return true
    }

    if (!isDemo) {
      try {
        await upsertMarketingSeoKeyword(changedItem)
      } catch {
        return false
      }
    }

    setSeoKeywords(next)
    return true
  }

  const saveContentIdeas = async (next: ContentIdea[]) => {
    const changedItem = findChangedItem(next, contentIdeas)
    if (!changedItem) {
      setContentIdeas(next)
      return true
    }
    if (!isDemo) {
      try {
        await upsertMarketingContentIdea(changedItem)
      } catch {
        return false
      }
    }
    setContentIdeas(next)
    return true
  }

  const savePostingPlans = async (next: PostingPlan[]) => {
    const changedItem = findChangedItem(next, postingPlans)
    if (!changedItem) {
      setPostingPlans(next)
      return true
    }
    if (!isDemo) {
      try {
        await upsertMarketingPostingPlan(changedItem)
      } catch {
        return false
      }
    }
    setPostingPlans(next)
    return true
  }

  const saveAutomationRules = async (next: AutomationRule[]) => {
    const changedItem = findChangedItem(next, automationRules)
    if (!changedItem) {
      setAutomationRules(next)
      return true
    }
    if (!isDemo) {
      try {
        await upsertMarketingAutomationRule(changedItem)
      } catch {
        return false
      }
    }
    setAutomationRules(next)
    return true
  }

  const saveIntegrationItems = async (next: IntegrationItem[]) => {
    const changedItem = findChangedItem(next, integrationItems)
    if (!changedItem) {
      setIntegrationItems(next)
      return true
    }
    if (!isDemo) {
      try {
        await upsertMarketingIntegrationItem(changedItem)
      } catch {
        return false
      }
    }
    setIntegrationItems(next)
    return true
  }

  const activeCampaigns = kampagnen.filter(item => item.status === 'Aktiv').length
  const newLeads = leads.filter(item => item.status === 'Neu').length
  const totalLeads = leads.length
  const sentEmails = newsletter.filter(item => item.status === 'Versendet').reduce((sum, item) => sum + item.empfaenger, 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${COLOR}40`, borderTopColor: COLOR, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
          <div style={{ color: '#aeb9c8', fontSize: 13 }}>Lade MarketingPilot...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>📣</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>MarketingPilot</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>Kampagnen · Leads · Newsletter · Auswertungen · KI-Suite</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV</span>
      </div>

      {errorMsg && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,80,80,.1)', border: '1px solid rgba(255,80,80,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: '#ff8080' }}>⚠️ {errorMsg}</span>
          <button className="pk-btn-ghost" onClick={() => { setErrorMsg(''); void loadData() }}
            style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
            ↻ Erneut versuchen
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Aktive Kampagnen', value: String(activeCampaigns), icon: '📣', color: COLOR, tab: 'kampagnen' as Tab },
          { label: 'Neue Leads', value: String(newLeads), icon: '🎯', color: '#f43f5e', tab: 'leads' as Tab },
          { label: 'Leads gesamt', value: String(totalLeads), icon: '👥', color: '#1684ff', tab: 'leads' as Tab },
          { label: 'E-Mails versendet', value: sentEmails.toLocaleString('de-DE'), icon: '✉️', color: '#10b981', tab: 'newsletter' as Tab },
        ].map(item => (
          <div key={item.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px', cursor: 'pointer' }} onClick={() => setTab(item.tab)}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {([
          { id: 'demo-lab', label: '🚀 KI-Suite' },
          { id: 'seo', label: '🔎 SEO' },
          { id: 'content', label: '✍️ Content' },
          { id: 'posting', label: '📅 Posting' },
          { id: 'automationen', label: '⚙️ Automationen' },
          { id: 'integrationen', label: '🔌 Integrationen' },
          { id: 'kampagnen', label: '📣 Kampagnen' },
          { id: 'leads', label: '🎯 Leads' },
          { id: 'newsletter', label: '📰 Newsletter' },
          { id: 'auswertungen', label: '📊 Auswertungen' },
        ] as const).map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              padding: '10px 16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              borderBottom: tab === item.id ? `2px solid ${COLOR}` : '2px solid transparent',
              color: tab === item.id ? '#fbbf24' : '#aeb9c8',
              marginBottom: -1,
              transition: 'color .15s',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'demo-lab' && <DemoLabTab kampagnen={kampagnen} leads={leads} newsletter={newsletter} seoKeywords={seoKeywords} onJump={setTab} />}
      {tab === 'seo' && <SeoTab isDemo={isDemo} seoKeywords={seoKeywords} onChange={saveSeoKeywords} />}
      {tab === 'content' && <ContentTab isDemo={isDemo} seoKeywords={seoKeywords} contentIdeas={contentIdeas} onChange={saveContentIdeas} />}
      {tab === 'posting' && <PostingTab isDemo={isDemo} postingPlans={postingPlans} contentIdeas={contentIdeas} onChange={savePostingPlans} />}
      {tab === 'automationen' && <AutomationenTab isDemo={isDemo} automationRules={automationRules} leads={leads} onChange={saveAutomationRules} />}
      {tab === 'integrationen' && <IntegrationenTab isDemo={isDemo} integrationItems={integrationItems} onChange={saveIntegrationItems} />}
      {tab === 'kampagnen' && <KampagnenTab isDemo={isDemo} kampagnen={kampagnen} onChange={setKampagnen} />}
      {tab === 'leads' && <LeadsTab isDemo={isDemo} leads={leads} onChange={setLeads} />}
      {tab === 'newsletter' && <NewsletterTab isDemo={isDemo} kampagnen={kampagnen} newsletter={newsletter} onChange={setNewsletter} />}
      {tab === 'auswertungen' && <AuswertungenTab leads={leads} kampagnen={kampagnen} newsletter={newsletter} seoKeywords={seoKeywords} contentIdeas={contentIdeas} postingPlans={postingPlans} />}
    </div>
  )
}
