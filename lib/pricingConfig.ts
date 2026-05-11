export type EmployeeTierId = '1-3' | '4-10' | '11-30' | '30+'
export type PilotId = 'lager' | 'buero' | 'werkstatt' | 'marketing' | 'analyse' | 'planung' | 'steuer' | 'custom'
export type PackageId = 'starter' | 'business' | 'enterprise'
export type BookingStatus = 'no_subscription' | 'pending_payment' | 'proof_sent' | 'active' | 'rejected' | 'cancelled'

export type PriceValue = number | 'request'

export const EMPLOYEE_TIERS: { id: EmployeeTierId; label: string; description: string }[] = [
  { id: '1-3', label: '1-3 Mitarbeiter', description: 'Kleine Teams und Einzelbetriebe' },
  { id: '4-10', label: '4-10 Mitarbeiter', description: 'Wachsende Betriebe' },
  { id: '11-30', label: '11-30 Mitarbeiter', description: 'Etablierte Teams' },
  { id: '30+', label: '30+ Mitarbeiter', description: 'Preis auf Anfrage' },
]

export const PAYMENT_CONFIG = {
  accountHolder: 'Carsten Petersen',
  iban: 'DE43100101231748226890',
  whatsappNumber: '+4917656392975',
}

export const PILOT_PRICING: Record<PilotId, {
  id: PilotId
  name: string
  icon: string
  description: string
  prices: Record<EmployeeTierId, PriceValue>
}> = {
  lager: {
    id: 'lager',
    name: 'LagerPilot',
    icon: '📦',
    description: 'Bestand, Stellplätze, Umlagerung und Kommissionierung',
    prices: { '1-3': 49, '4-10': 99, '11-30': 179, '30+': 'request' },
  },
  buero: {
    id: 'buero',
    name: 'BüroPilot',
    icon: '🧾',
    description: 'Kunden, Angebote, Rechnungen und Eingangsrechnungen',
    prices: { '1-3': 49, '4-10': 99, '11-30': 179, '30+': 'request' },
  },
  werkstatt: {
    id: 'werkstatt',
    name: 'WerkstattPilot',
    icon: '🔧',
    description: 'Arbeitskarten, Mitarbeiter, Zeiten und Aufträge',
    prices: { '1-3': 59, '4-10': 119, '11-30': 199, '30+': 'request' },
  },
  marketing: {
    id: 'marketing',
    name: 'MarketingPilot',
    icon: '📣',
    description: 'Kampagnen, Leads und Content-Planung',
    prices: { '1-3': 29, '4-10': 69, '11-30': 129, '30+': 'request' },
  },
  analyse: {
    id: 'analyse',
    name: 'AnalysePilot',
    icon: '📊',
    description: 'Kennzahlen, Auswertungen und Betriebsanalysen',
    prices: { '1-3': 39, '4-10': 89, '11-30': 149, '30+': 'request' },
  },
  planung: {
    id: 'planung',
    name: 'PlanungPilot',
    icon: '📅',
    description: 'Kapazitäten, Projekte und Aufgabenplanung',
    prices: { '1-3': 49, '4-10': 99, '11-30': 169, '30+': 'request' },
  },
  steuer: {
    id: 'steuer',
    name: 'SteuerPilot',
    icon: '💶',
    description: 'Belege, Steuerdaten und Auswertungen',
    prices: { '1-3': 39, '4-10': 89, '11-30': 149, '30+': 'request' },
  },
  custom: {
    id: 'custom',
    name: 'Custom Features',
    icon: '✨',
    description: 'Individuelle Erweiterungen und Sonderfunktionen',
    prices: { '1-3': 'request', '4-10': 'request', '11-30': 'request', '30+': 'request' },
  },
}

export const PACKAGE_PRICING: Record<PackageId, {
  id: PackageId
  name: string
  icon: string
  recommended?: boolean
  pilots: PilotId[]
  included: string[]
  prices: Record<EmployeeTierId, PriceValue>
  singlePrices: Record<EmployeeTierId, PriceValue>
}> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    icon: '🚀',
    pilots: ['buero', 'lager'],
    included: ['BüroPilot', 'LagerPilot', 'KI-Erkennung inklusive'],
    prices: { '1-3': 89, '4-10': 179, '11-30': 299, '30+': 'request' },
    singlePrices: { '1-3': 98, '4-10': 198, '11-30': 358, '30+': 'request' },
  },
  business: {
    id: 'business',
    name: 'Business',
    icon: '⭐',
    recommended: true,
    pilots: ['buero', 'lager', 'werkstatt', 'marketing'],
    included: ['BüroPilot', 'LagerPilot', 'WerkstattPilot', 'MarketingPilot', 'KI-Erkennung inklusive'],
    prices: { '1-3': 159, '4-10': 329, '11-30': 549, '30+': 'request' },
    singlePrices: { '1-3': 186, '4-10': 386, '11-30': 686, '30+': 'request' },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🏢',
    pilots: ['buero', 'lager', 'werkstatt', 'marketing', 'analyse', 'planung', 'steuer'],
    included: ['BüroPilot', 'LagerPilot', 'WerkstattPilot', 'MarketingPilot', 'AnalysePilot', 'PlanungPilot', 'SteuerPilot', 'KI-Erkennung inklusive'],
    prices: { '1-3': 249, '4-10': 549, '11-30': 899, '30+': 'request' },
    singlePrices: { '1-3': 313, '4-10': 663, '11-30': 1153, '30+': 'request' },
  },
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  no_subscription: 'Noch kein Paket gebucht',
  pending_payment: 'Zahlung ausstehend',
  proof_sent: 'Zahlungsbeleg gesendet',
  active: 'Aktiv',
  rejected: 'Abgelehnt',
  cancelled: 'Gekündigt',
}

export function formatPrice(price: PriceValue) {
  return price === 'request' ? 'auf Anfrage' : `${price.toLocaleString('de-DE')} € / Monat`
}

