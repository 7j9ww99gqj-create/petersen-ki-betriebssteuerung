# Petersen KI Betriebssteuerung – CLAUDE.md

## Projektübersicht

Dies ist eine **Next.js 14 Web-App** – ein KI-unterstütztes Warenwirtschaftssystem (Demo-Version).

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · App Router

## Schnellstart

```bash
npm install
cp .env.example .env.local
# ANTHROPIC_API_KEY in .env.local eintragen (optional für Demo)
npm run dev
# → http://localhost:3000
```

## Login (Demo)
- Beliebige E-Mail + Passwort eingeben → sofortiger Zugang
- Kein Backend, keine Datenbank nötig für die Demo
- Daten werden im localStorage gespeichert

## Struktur

```
app/
  login/           → Login-Seite
  dashboard/
    page.tsx        → Haupt-Dashboard
    layout.tsx      → Sidebar-Layout (Auth-Guard)
    lager/          → LagerPilot (vollständig)
    ki-erkennung/   → KI-Erkennung + Chat
    cloud/          → Cloud-Sync Simulation
    archiv/         → Dokumentenarchiv
    [pilot]/        → Dynamische Seite für BüroPilot, WerkstattPilot, etc.
  api/
    chat/route.ts   → API Route für Anthropic-Chat
components/
  Sidebar.tsx       → Navigations-Sidebar
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
- `.badge .badge-green/blue/orange/gray` – Status-Badges
- `.fade-in` – Fade-In Animation

## KI-Integration

Die KI-Erkennung und der Chat nutzen die Anthropic API:
1. `ANTHROPIC_API_KEY` in `.env.local` eintragen
2. Chat läuft über `/api/chat`
3. Im Demo-Modus: simulierte Antworten ohne API-Key

## Demo → Produktion

Um die Demo zur echten Version zu erweitern:
1. **Datenbank**: PostgreSQL oder Supabase hinzufügen (z.B. Prisma ORM)
2. **Auth**: NextAuth.js oder Clerk integrieren
3. **API**: REST-Routen für CRUD-Operationen anlegen
4. **Cloud**: Vercel (Frontend) + Supabase (Backend) empfohlen
5. **KI-Erkennung**: Anthropic API für Dokument-Analyse aktivieren

## Piloten

| Pilot | Route | Status |
|-------|-------|--------|
| LagerPilot | `/dashboard/lager` | ✅ Vollständig (Suche: Name, Nr, Lagerplatz) |
| BüroPilot | `/dashboard/buero` | ✅ Vollständig |
| WerkstattPilot | `/dashboard/werkstatt` | ✅ Vollständig |
| MarketingPilot | `/dashboard/marketing` | ✅ Vollständig (Kampagnen, Leads, Newsletter, Auswertungen) |
| AnalysePilot | `/dashboard/analyse` | ✅ Vollständig (Recharts) |
| PlanungPilot | `/dashboard/planung` | ✅ Vollständig (Projekte, Kalender, Ressourcen, Aufgaben) |
| KI Erkennung | `/dashboard/ki-erkennung` | ✅ Vollständig |
| Cloud & Sync | `/dashboard/cloud` | ✅ Vollständig |
| Archiv | `/dashboard/archiv` | ✅ Vollständig |
| Einstellungen | `/dashboard/einstellungen` | ✅ Vollständig |

## UI-Features

- **Globale Suche**: `⌘K` öffnet Suchmodal (durchsucht alle Piloten-Daten), Komponente: `components/GlobalSearch.tsx`
- **Benachrichtigungsglocke**: Oben rechts im Layout, 5 System-Meldungen, `components/NotificationBell.tsx`
- **Animierte Zähler**: Dashboard-Stats zählen bei Laden hoch (requestAnimationFrame)
- **Logo**: `/public/logo.jpg` – in Sidebar + Login eingebunden
- **recharts v3**: Installiert für AnalysePilot (Bar, Line, Area, Pie Charts)
