# Petersen KI Betriebssteuerung

> Modulare ERP/KI-WebApp für den Mittelstand — Next.js, TypeScript, Supabase, OpenAI

**Live:** https://app.petersen-ki-pilot.de

[![CI](https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung/actions/workflows/ci.yml/badge.svg)](https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung/actions/workflows/ci.yml)

---

## Schnellstart

```bash
git clone https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung.git
cd petersen-ki-betriebssteuerung
npm install
cp .env.example .env.local   # Env-Vars eintragen (siehe unten)
npm run dev                  # → http://localhost:3000
```

### Pflicht-Env-Vars in `.env.local`

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service-Role Key (serverseitig) |
| `OPENAI_API_KEY` | OpenAI Key für KI-Features |
| `ANTHROPIC_API_KEY` | Anthropic Key für KI-Chat |
| `STRIPE_SECRET_KEY` | Stripe (Abos/Billing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook-Signatur |
| `CRON_SECRET` | Secret für Cron-Jobs (/api/backup/auto) |
| `VAPID_PUBLIC_KEY` | Web-Push VAPID public |
| `VAPID_PRIVATE_KEY` | Web-Push VAPID private |
| `VAPID_EMAIL` | Web-Push VAPID E-Mail |
| `VERCEL_TOKEN` | Vercel API-Token |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (optional, Error-Tracking) |
| `SENTRY_AUTH_TOKEN` | Sentry Auth (optional, Source-Maps) |

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript 5 |
| Styling | Tailwind CSS + eigenes Design-System (globals.css) |
| Datenbank | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| KI | OpenAI GPT-4o-mini + Anthropic Claude |
| PDF | jsPDF |
| Charts | Recharts |
| Testing | Vitest |
| Error-Tracking | Sentry |
| Deployment | Vercel (Auto-Deploy bei Push auf `main`) |
| PWA | Service Worker (Asset-Cache, Offline-Support) |

---

## Pilot-Übersicht

| Pilot | Route | Beschreibung | Status |
|---|---|---|---|
| Dashboard | `/dashboard` | Übersicht, KPIs, Zuletzt besucht | ✅ |
| LagerPilot | `/dashboard/lager` | Bestand, Wareneingang/-ausgang, Stellplätze, Kommissionierung, KI-Tagesbericht | ✅ |
| BüroPilot | `/dashboard/buero` | Kunden, Angebote, Aufträge, Rechnungen (GoBD-konformes Archiv), Dokumente, Einkauf | ✅ |
| WerkstattPilot | `/dashboard/werkstatt` | Karten, Zeitbuchungen, Material (Lager-Sync), Prüfprotokoll, Fertigungsleitstand | ✅ |
| SteuerPilot | `/dashboard/steuer` | USt-VA, Betriebsausgaben, Beleg-OCR, ELSTER-XML-Export, Fälligkeits-Kalender | ✅ |
| MarketingPilot | `/dashboard/marketing` | Kampagnen, Leads, Newsletter, KI-Content-Tools | ✅ |
| PlanungPilot | `/dashboard/planung` | Projekte, Aufgaben, Kalender, Ressourcen, Meilensteine | ✅ |
| AnalysePilot | `/dashboard/analyse` | Live-Charts, KPI-Auswertungen, Zeitraum-Filter, Bestandstrend, PDF-Export | ✅ |
| CloudPilot | `/dashboard/cloud` | Backup-Historie, Storage-Übersicht, Geräte-/Sitzungsverwaltung | ✅ |
| KI-Assistent | `/dashboard/ki-erkennung` | Chat, OCR-Dokumentenerkennung, Tagesbrief | ✅ |
| Einstellungen | `/dashboard/einstellungen` | Firmenprofil, Briefpapier, Rollen, Benachrichtigungen | ✅ |
| Pondruff | `/dashboard/pondruff` | Spezialpilot: Wareneingang, Preisrechner, Archiv, Büro-WISO-Export | ✅ |

---

## Demo-Zugang

```
E-Mail:   demo@petersen-ki-pilot.de
Passwort: Demo1234!
```

Demo-Modus: statische Daten, kein Schreiben, kein Supabase-Zugriff.

---

## Entwicklung

```bash
npm run dev      # Dev-Server (http://localhost:3000)
npm run build    # Produktions-Build
npm test         # Vitest (40 Tests)
npx tsc --noEmit # TypeScript-Check
npm run lint     # ESLint
```

---

Weitere Details zur Architektur: [ARCHITECTURE.md](ARCHITECTURE.md)
