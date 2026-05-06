# Petersen KI Betriebssteuerung

> KI-unterstütztes Warenwirtschaftssystem – Modulare Piloten für Ihren Betrieb

## 🚀 Schnellstart

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen einrichten
cp .env.example .env.local
# Optional: ANTHROPIC_API_KEY in .env.local eintragen

# 3. Entwicklungsserver starten
npm run dev
```

Dann öffnen: **http://localhost:3000**

## 🔐 Login (Demo)

Beliebige E-Mail-Adresse und ein Passwort eingeben – kein echtes Konto nötig.

## 📦 Enthaltene Seiten

- **Login** – Anmeldeseite mit Petersen-Branding
- **Dashboard** – Übersicht mit allen Piloten & Kennzahlen
- **LagerPilot** – Vollständige Lagerverwaltung (Bestand, Wareneingang/-ausgang, Bewegungen)
- **KI Erkennung** – Dokumentenerkennung & KI-Chat
- **Cloud & Sync** – Cloud-Synchronisation mit Animationen
- **Archiv** – Dokumentenarchiv mit Suche & Filter
- **Alle weiteren Piloten** – BüroPilot, WerkstattPilot, MarketingPilot, AnalysePilot, PlanungPilot (Demo-Ansicht)

## 🧠 KI-Funktionen aktivieren

1. Account auf [console.anthropic.com](https://console.anthropic.com) erstellen
2. API Key generieren
3. In `.env.local` eintragen: `ANTHROPIC_API_KEY=sk-ant-...`
4. Server neu starten

## 🏗️ Tech-Stack

- [Next.js 14](https://nextjs.org) – App Router
- TypeScript
- Tailwind CSS
- Anthropic Claude API (optional)

## 📁 Projektstruktur

```
app/
├── login/              Login-Seite
├── dashboard/
│   ├── page.tsx        Haupt-Dashboard
│   ├── layout.tsx      Auth-Guard + Sidebar
│   ├── lager/          LagerPilot
│   ├── ki-erkennung/   KI-Erkennung
│   ├── cloud/          Cloud-Sync
│   ├── archiv/         Dokumentenarchiv
│   └── [pilot]/        Dynamische Pilot-Seiten
└── api/
    └── chat/           KI-Chat API Route

components/
└── Sidebar.tsx         Navigation
```

## 🔄 Demo → Produktion

Für die echte Version empfehlen wir:
- **Datenbank**: Supabase (PostgreSQL)
- **Authentifizierung**: Supabase Auth oder Clerk
- **Deployment**: Vercel
- **KI**: Anthropic Claude API

---

© 2025 Petersen KI Betriebssteuerung – Demo Version
