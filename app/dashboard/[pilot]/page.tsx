'use client'
import { useRouter } from 'next/navigation'

const pilotData: Record<string, {
  label: string; icon: string; color: string; desc: string;
  features: string[]; stats: { label: string; value: string; icon: string }[];
  modules: { name: string; desc: string; icon: string }[];
}> = {
  buero: {
    label: 'BüroPilot', icon: '🧾', color: '#20c8ff',
    desc: 'Kundenstammdaten, Angebote, Aufträge, Rechnungen, Mahnungen und Dokumente.',
    features: ['Kundenstammdaten verwalten', 'Angebote erstellen & versenden', 'Aufträge bearbeiten', 'Rechnungen & Mahnungen', 'Dokumentenablage', 'E-Mail-Integration'],
    stats: [
      { label: 'Offene Angebote', value: '12', icon: '📋' },
      { label: 'Offene Rechnungen', value: '8', icon: '🧾' },
      { label: 'Kunden gesamt', value: '234', icon: '👥' },
      { label: 'Aufträge diesen Monat', value: '47', icon: '✅' },
    ],
    modules: [
      { name: 'Kundenverwaltung', desc: 'Stammdaten, Kontakte, Historie', icon: '👥' },
      { name: 'Angebote & Aufträge', desc: 'Erstellen, versenden, nachverfolgen', icon: '📋' },
      { name: 'Rechnungswesen', desc: 'Rechnungen, Mahnungen, Zahlungen', icon: '💶' },
      { name: 'Dokumentenarchiv', desc: 'Alle Dateien zentral verwaltet', icon: '🗂️' },
    ],
  },
  werkstatt: {
    label: 'WerkstattPilot', icon: '🛠️', color: '#a78bfa',
    desc: 'Arbeitskarten, Arbeitsplanung, Zeiterfassung, Materialverbrauch und Qualitätskontrolle.',
    features: ['Arbeitskarten erstellen', 'Ressourcenplanung', 'Zeiterfassung per Mitarbeiter', 'Materialverbrauch buchen', 'Qualitätsprüfungen', 'Fehlerprotokolle'],
    stats: [
      { label: 'Offene Arbeitskarten', value: '7', icon: '🛠️' },
      { label: 'Mitarbeiter aktiv', value: '5', icon: '👷' },
      { label: 'Heutige Stunden', value: '38h', icon: '⏱️' },
      { label: 'Abgeschlossen heute', value: '3', icon: '✅' },
    ],
    modules: [
      { name: 'Arbeitskarten', desc: 'Aufgaben, Status, Zuweisung', icon: '📝' },
      { name: 'Zeiterfassung', desc: 'Stunden pro Auftrag & Mitarbeiter', icon: '⏱️' },
      { name: 'Materialverbrauch', desc: 'Verbrauch direkt buchen', icon: '🔩' },
      { name: 'Qualitätskontrolle', desc: 'Prüfprotokolle & Freigaben', icon: '✅' },
    ],
  },
  marketing: {
    label: 'MarketingPilot', icon: '📣', color: '#f59e0b',
    desc: 'Kampagnen, Kundenkommunikation, E-Mail Marketing, Social Media und Lead Management.',
    features: ['E-Mail Kampagnen', 'Social Media Posts', 'Lead-Erfassung', 'Kundengruppen', 'Newsletter', 'Auswertungen'],
    stats: [
      { label: 'Aktive Kampagnen', value: '3', icon: '📣' },
      { label: 'Leads diesen Monat', value: '28', icon: '🎯' },
      { label: 'E-Mails versendet', value: '1.240', icon: '✉️' },
      { label: 'Öffnungsrate', value: '34%', icon: '📊' },
    ],
    modules: [
      { name: 'E-Mail Marketing', desc: 'Kampagnen, Newsletter, Automation', icon: '✉️' },
      { name: 'Lead Management', desc: 'Kontakte, Pipeline, Follow-up', icon: '🎯' },
      { name: 'Social Media', desc: 'Posts planen & veröffentlichen', icon: '📱' },
      { name: 'Auswertungen', desc: 'Öffnungsraten, Klicks, Conversions', icon: '📊' },
    ],
  },
  analyse: {
    label: 'AnalysePilot', icon: '📊', color: '#10b981',
    desc: 'Dashboards, Kennzahlen, Berichte, Datenanalyse, Prognosen und Business Intelligence.',
    features: ['Echtzeit-Dashboards', 'KPI-Übersicht', 'Automatische Berichte', 'Prognose-Funktionen', 'Datenexport', 'Vergleichsanalysen'],
    stats: [
      { label: 'Ø Tagesumsatz', value: '4.280 €', icon: '💶' },
      { label: 'Wachstum (MoM)', value: '+12%', icon: '📈' },
      { label: 'Aktive KPIs', value: '18', icon: '🎯' },
      { label: 'Berichte diese Woche', value: '6', icon: '📋' },
    ],
    modules: [
      { name: 'KPI-Dashboard', desc: 'Alle Kennzahlen auf einen Blick', icon: '📊' },
      { name: 'Berichte & Auswertungen', desc: 'Automatisch oder manuell', icon: '📋' },
      { name: 'Prognosen', desc: 'KI-gestützte Vorhersagen', icon: '🔮' },
      { name: 'Datenexport', desc: 'Excel, PDF, API-Integration', icon: '📤' },
    ],
  },
  planung: {
    label: 'PlanungPilot', icon: '📅', color: '#f43f5e',
    desc: 'Produktionsplanung, Ressourcenplanung, Kapazitäten, Termine, Projekte und Ablaufplanung.',
    features: ['Produktionsplanung', 'Ressourcenzuteilung', 'Kapazitätsübersicht', 'Terminmanagement', 'Projektverwaltung', 'Engpassanalyse'],
    stats: [
      { label: 'Laufende Projekte', value: '4', icon: '📁' },
      { label: 'Termine diese Woche', value: '12', icon: '📅' },
      { label: 'Kapazität genutzt', value: '78%', icon: '⚡' },
      { label: 'Offene Aufgaben', value: '23', icon: '✏️' },
    ],
    modules: [
      { name: 'Produktionsplanung', desc: 'Aufträge, Kapazitäten, Termine', icon: '🏭' },
      { name: 'Ressourcen', desc: 'Personal, Maschinen, Material', icon: '⚙️' },
      { name: 'Projektverwaltung', desc: 'Meilensteine, Aufgaben, Status', icon: '📁' },
      { name: 'Kalender & Termine', desc: 'Teamkalender, Erinnerungen', icon: '📅' },
    ],
  },
  qm: {
    label: 'QM-Pilot', icon: '🔬', color: '#14b8a6',
    desc: 'Digitales Qualitätsmanagementsystem — Zeichnungsanalyse, Prüfberichte, Messwerterfassung und Archivierung.',
    features: ['Zeichnungen hochladen & KI-Analyse', 'Automatische Maß- & Toleranzextraktion', 'Prüfberichte erstellen (6-Schritt-Wizard)', 'Messwert-Ampel (Grün/Orange/Rot)', 'Foto-Dokumentation', 'PDF-Export druckfertig', 'Prüfberichte-Archiv & Suche', 'KI-Sichtprüfung (Oberflächenanalyse)', 'Team-Management & Rollen', 'Statistik-Dashboard & Fehlertrends'],
    stats: [
      { label: 'Prüfberichte gesamt', value: '48', icon: '📋' },
      { label: 'Bestanden diese Woche', value: '12', icon: '✅' },
      { label: 'Fehlerquote', value: '2,5%', icon: '📊' },
      { label: 'Ø Prüfzeit', value: '18 min', icon: '⏱️' },
    ],
    modules: [
      { name: 'Zeichnungs-Analyse', desc: 'KI liest Maße, Toleranzen & Material automatisch aus', icon: '🖼️' },
      { name: 'Prüfbericht-Wizard', desc: '6-Schritt-Formular mit Live-Ampel & Foto-Upload', icon: '📋' },
      { name: 'Messwert-Ampel', desc: 'Grün/Orange/Rot nach Toleranzabweichung, PDF-Export', icon: '🟢' },
      { name: 'Archiv & Statistiken', desc: 'Suche, Filter, Fehlerquoten, Prüfer-Performance', icon: '📈' },
    ],
  },
}

export default function PilotPage({ params }: { params: { pilot: string } }) {
  const router = useRouter()
  const data = pilotData[params.pilot]

  if (!data) {
    return (
      <div className="fade-in" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <h2>Pilot nicht gefunden</h2>
        <button className="pk-btn" onClick={() => router.push('/dashboard')}>Zurück zum Dashboard</button>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${data.color}18`, border: `1px solid ${data.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
        }}>{data.icon}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.04em' }}>{data.label}</h1>
          <p style={{ margin: 0, color: '#aeb9c8', fontSize: 14 }}>{data.desc}</p>
        </div>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>● AKTIV (DEMO)</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {data.stats.map(s => (
          <div key={s.label} className="pk-card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: data.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#aeb9c8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modules grid */}
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Module</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
        {data.modules.map(m => (
          <div key={m.name} className="pk-card" style={{ border: `1px solid ${data.color}20` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.name}</div>
            <div style={{ fontSize: 13, color: '#aeb9c8' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="pk-card">
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>Alle Funktionen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {data.features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: data.color, fontWeight: 700 }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Demo notice */}
      <div style={{
        marginTop: 20, padding: '14px 18px', borderRadius: 14,
        background: 'rgba(22,132,255,.08)', border: '1px solid rgba(22,132,255,.2)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>🎯</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Demo-Modus</div>
          <div style={{ fontSize: 13, color: '#aeb9c8' }}>
            Diese Seite zeigt die Demo-Ansicht des {data.label}. In der vollständigen Version sind alle Funktionen live und mit echten Daten verbunden.
          </div>
        </div>
      </div>
    </div>
  )
}
