# Petersen KI Betriebssteuerung

## Projektübersicht
KI-gestütztes Warenwirtschaftssystem als produktive SaaS-WebApp.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · App Router

## Schnellstart

```bash
npm install
cp .env.example .env.local
# ANTHROPIC_API_KEY in .env.local eintragen (optional)
npm run dev
# → http://localhost:3000
```

## Auth
- Login nur mit freigeschalteten Zugangsdaten
- Demo-Zugang: `demo@petersen-ki-pilot.de` / `Demo2025!`
- Demo-Modus wird nur aktiviert wenn Demo-Credentials verwendet werden
- Zentrale Auth-Logik: `lib/auth.ts` (checkLogin, getSession, setSession, clearSession)
- Session wird im localStorage gespeichert (`pk_user`)

## Piloten

| Pilot | Route | Status |
|-------|-------|--------|
| LagerPilot | `/dashboard/lager` | ✅ Fertig |
| BüroPilot | `/dashboard/buero` | ✅ Fertig |
| WerkstattPilot | `/dashboard/werkstatt` | ✅ Fertig |
| MarketingPilot | `/dashboard/marketing` | ✅ Fertig |
| AnalysePilot | `/dashboard/analyse` | ✅ Fertig |
| PlanungPilot | `/dashboard/planung` | ✅ Fertig |
| KI Erkennung | `/dashboard/ki-erkennung` | ✅ Fertig |
| Cloud & Sync | `/dashboard/cloud` | ✅ Fertig |
| Archiv | `/dashboard/archiv` | ✅ Fertig |
| Einstellungen | `/dashboard/einstellungen` | ✅ Fertig |

## Struktur

```
app/
  login/           → Login-Seite
  dashboard/
    page.tsx        → Haupt-Dashboard
    layout.tsx      → Sidebar-Layout (Auth-Guard)
    lager/          → LagerPilot
    buero/          → BüroPilot
    werkstatt/      → WerkstattPilot
    marketing/      → MarketingPilot
    analyse/        → AnalysePilot
    planung/        → PlanungPilot
    ki-erkennung/   → KI-Erkennung + Chat
    cloud/          → Cloud-Sync
    archiv/         → Dokumentenarchiv
    einstellungen/  → Einstellungen
    [pilot]/        → Fallback (nicht mehr aktiv genutzt)
  api/
    chat/route.ts   → Anthropic-Chat API
lib/
  auth.ts           → Auth-Logik
components/
  Sidebar.tsx       → Navigations-Sidebar
  NotificationBell.tsx
  GlobalSearch.tsx
```

## Design-System (globals.css)

CSS-Variablen:
- `--bg: #05070b` · `--panel: #0b1420` · `--card: #101a28`
- `--blue: #1684ff` · `--blue2: #20c8ff`
- `--text: #f8fbff` · `--muted: #aeb9c8`

CSS-Klassen:
- `.pk-card` – Standard-Karte
- `.pk-btn` – Primär-Button (Blau)
- `.pk-btn-ghost` – Sekundär-Button
- `.pk-input` – Input-Feld
- `.pk-table` – Tabellen-Stil
- `.badge .badge-green/blue/orange/gray/red/purple` – Status-Badges
- `.fade-in` – Fade-In Animation

## UI-Features

- **Globale Suche**: `⌘K` öffnet Suchmodal, Komponente: `components/GlobalSearch.tsx`
- **Benachrichtigungsglocke**: Oben rechts im Layout, `components/NotificationBell.tsx`
- **Animierte Zähler**: Dashboard-Stats zählen bei Laden hoch (requestAnimationFrame)
- **Logo**: `/public/logo.jpg` – in Sidebar + Login eingebunden
- **recharts v3**: Installiert für AnalysePilot (Bar, Line, Area, Pie Charts)

## KI-Integration

1. `ANTHROPIC_API_KEY` in `.env.local` eintragen
2. Chat läuft über `/api/chat`
3. Ohne API-Key: simulierte Antworten

## Regeln

- Bestehenden Code nicht zerstören
- Modular erweitern
- Keine Demo-Logik außer beim Demo-Login
- UI sauber und konsistent halten
- Nach jeder Änderung: committen und auf GitHub pushen

## ToDo (Produktion)

- Echte Datenbank (Supabase / PostgreSQL + Prisma)
- Echte Authentifizierung (NextAuth.js oder Clerk)
- Stripe Integration
- Vercel Deployment
