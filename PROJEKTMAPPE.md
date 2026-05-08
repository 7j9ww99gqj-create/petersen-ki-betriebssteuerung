# Petersen KI – Vollständige Projektmappe

> Letzte Aktualisierung: 2026-05-08

---

## 1. Gesamt-Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER / PWA                                │
│  manifest.json  ·  Viewport-Meta  ·  iOS Safe-Areas  ·  Bottom-Nav │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────────┐
│                    VERCEL (Next.js 14)                               │
│                                                                      │
│  app/layout.tsx ──────────────────────────────────────────────────  │
│    └─ app/page.tsx            → Redirect → /login                   │
│    └─ app/login/page.tsx      → Auth-Formular                       │
│    └─ app/register/page.tsx   → Registrierung                       │
│    └─ app/dashboard/layout.tsx → Auth-Guard + Shell                 │
│         └─ Sidebar.tsx                                              │
│         └─ NotificationBell.tsx                                     │
│         └─ GlobalSearch.tsx                                         │
│         └─ SupportButton.tsx                                        │
│         └─ Bottom-Nav (Mobile)                                      │
│         └─ [alle Piloten-Seiten]                                    │
│                                                                      │
│  app/api/chat/route.ts  ──────→  Anthropic API (Claude)             │
│                                                                      │
│  middleware.ts  ──────────────→  Auth-Redirect-Schutz               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                       SUPABASE                                       │
│  Auth  ·  PostgreSQL (19 Tabellen)  ·  Storage (dokumente)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Routing-Struktur

```
/                          → app/page.tsx          (Redirect zu /login)
/login                     → app/login/page.tsx
/register                  → app/register/page.tsx

/dashboard                 → app/dashboard/page.tsx         ← Haupt-Dashboard (KPIs)
/dashboard/lager           → app/dashboard/lager/page.tsx   ← LagerPilot
/dashboard/buero           → app/dashboard/buero/page.tsx   ← BüroPilot
/dashboard/werkstatt       → app/dashboard/werkstatt/page.tsx
/dashboard/marketing       → app/dashboard/marketing/page.tsx
/dashboard/analyse         → app/dashboard/analyse/page.tsx
/dashboard/planung         → app/dashboard/planung/page.tsx
/dashboard/ki-erkennung    → app/dashboard/ki-erkennung/page.tsx
/dashboard/cloud           → app/dashboard/cloud/page.tsx
/dashboard/archiv          → app/dashboard/archiv/page.tsx
/dashboard/einstellungen   → app/dashboard/einstellungen/page.tsx
/dashboard/[pilot]         → app/dashboard/[pilot]/page.tsx (Catch-All Fallback)

POST /api/chat             → app/api/chat/route.ts          ← KI-Chat
```

---

## 3. Dashboard Shell (Layout)

```
app/dashboard/layout.tsx
├── Auth-Check (Supabase Session + Demo-Cookie)
│     ├── kein Auth + kein Demo → redirect /login
│     └── ok → render Shell
│
├── Sidebar.tsx
│     ├── Logo (/public/logo.jpg)
│     ├── Links zu allen Piloten
│     ├── NotificationBell.tsx
│     │     └── getAppWarnings() ← lib/warnings.ts ← lib/db.ts
│     └── GlobalSearch.tsx (⌘K)
│
├── Bottom-Nav (Mobile ≤768px)
│     ├── /dashboard      ⊞ Start
│     ├── /dashboard/lager 📦 Lager
│     ├── /dashboard/buero 🧾 Büro
│     ├── /dashboard/werkstatt 🛠️ Werkstatt
│     ├── /dashboard/ki-erkennung 🧠 KI
│     └── #menu ☰ → öffnet Sidebar
│
└── SupportButton.tsx (fixed bottom-right)
      ├── WhatsApp: +4917656392975
      ├── E-Mail: info@petersen-ki-pilot.de
      └── Telefon
```

---

## 4. Piloten – Tabs & Features

### 📊 Dashboard (`/dashboard`)
```
app/dashboard/page.tsx
├── Demo-Modus: demoKpis (statisch)
├── Live-Modus: Promise.allSettled([
│     getLagerArtikel()      → Artikel-Anzahl, kritische Bestände
│     getBueroRechnungen()   → offene Rechnungen, überfällige Zahlungen
│     getBueroAuftraege()    → laufende Aufträge
│   ])
└── 6 klickbare KPI-Cards (Navigation zu Piloten)
```

### 📦 LagerPilot (`/dashboard/lager`)
```
app/dashboard/lager/page.tsx
│
├── Tab: bestand      Artikelbestand (CRUD + Inline-Delete + Sortierung)
│     ├── + Mindestbestand-Spalte (editierbar)
│     ├── 📈-Button → navigiert zu Tab "historie" gefiltert auf Artikel
│     └── Alarm-Banner wenn Bestand < Mindestbestand
│
├── Tab: bewegungen   Alle Lagerbewegungen (read-only)
│
├── Tab: eingang      Wareneingang buchen → insertLagerBewegung('eingang')
│
├── Tab: ausgang      Warenausgang buchen → insertLagerBewegung('ausgang')
│     └── nach Buchung: prüft Mindestbestand → bestellHint-Banner
│
├── Tab: inventur     Inventurliste mit Ist/Soll-Vergleich
│
├── Tab: bestellung   Bestellvorschläge (Artikel unter Mindestbestand)
│     ├── BestellDetailModal
│     │     ├── Artikel-Info + editierbare Bestellmenge
│     │     └── E-Mail-Vorschau (simuliert)
│     └── "Alle bestellen"-Button (Bulk)
│
└── Tab: historie     Artikel-Bewegungshistorie
      ├── Dropdown-Filter: alle / eingang / ausgang / inventur
      ├── Artikel-Filter (Dropdown: alle Artikel)
      └── Statistik-Karten: Gesamt-Ein/Ausg., Ø Buchungsgröße, Buchungsanzahl

DB-Calls:
  getLagerArtikel()          → Bestand anzeigen
  upsertLagerArtikel()       → CRUD Artikel
  deleteLagerArtikel()       → Löschen
  getLagerBewegungen()       → Bewegungen anzeigen
  insertLagerBewegung()      → Eingang/Ausgang/Inventur buchen
```

### 🧾 BüroPilot (`/dashboard/buero`)
```
app/dashboard/buero/page.tsx
│
├── Tab: kunden       Kundenstamm (CRUD + Edit-Modal)
├── Tab: angebote     Angebote (CRUD + Edit + → Auftrag konvertieren)
├── Tab: auftraege    Aufträge (CRUD + Edit + Statusverlauf)
├── Tab: rechnungen   Rechnungen (CRUD + Edit + PDF-Download)
│     └── generateRechnungPDF() ← lib/pdf.ts
├── Tab: dokumente    Dokumente (Upload → Supabase Storage + Download)
│     └── uploadDokument() / getDokumentUrl() ← lib/db.ts
│
└── Tab: einkauf      🏭 Einkauf / Lieferanten (NEU)
      │
      ├── Sub-Tab: Lieferanten
      │     ├── CRUD (Name, Kategorie, Ansprechpartner, E-Mail, Tel, Zahlungsziel)
      │     ├── Sternebewertung ★/☆ (1–5)
      │     └── 🛒-Button → springt zu Bestellungen + prefill
      │
      ├── Sub-Tab: Bestellungen
      │     ├── Status-Workflow: Entwurf → Bestellt → Teillieferung → Geliefert
      │     ├── "Auslösen"-Button (Entwurf → Bestellt)
      │     └── "WE buchen"-Button → springt zu Wareneingänge + prefill
      │
      ├── Sub-Tab: Wareneingänge
      │     ├── Qualitätskontrolle: OK / Mängel / Abgelehnt
      │     └── auto: Bestellstatus → Geliefert / Teillieferung
      │
      └── 4 KPI-Karten: Aktive Lieferanten · Offene Bestellungen ·
                        Wareneingänge · Gesamt-Bestellwert

DB-Calls (alle vorbereitet, EinkaufTab noch Demo-State):
  getBueroKunden/upsertBueroKunde/deleteBueroKunde
  getBueroAngebote/upsertBueroAngebot
  getBueroAuftraege/upsertBueroAuftrag
  getBueroRechnungen/upsertBueroRechnung
  getBueroDokumente/insertBueroDokument/deleteBueroDokument
  uploadDokument / getDokumentUrl
  getEinkaufLieferanten / upsertEinkaufLieferant / deleteEinkaufLieferant
  getEinkaufBestellungen / upsertEinkaufBestellung
  getEinkaufWareneingaenge / insertEinkaufWareneingang
```

### 🛠️ WerkstattPilot (`/dashboard/werkstatt`)
```
app/dashboard/werkstatt/page.tsx
├── Arbeitskarten (CRUD + Edit + Fortschritt-Slider 0–100%)
├── Zeiterfassung (Start/Stop + manuelle Buchung)
├── Materialverbrauch
├── Prüfprotokoll (Ergebnis inline bearbeitbar)
└── KPI-Karten: offene Karten, Stunden heute, Material-Wert

DB-Calls:
  getWerkstattKarten / upsertWerkstattKarte / deleteWerkstattKarte
  getWerkstattZeitbuchungen / insertWerkstattZeitbuchung
  getWerkstattMaterial / insertWerkstattMaterial
  getWerkstattPruefprotokolle / insertWerkstattPruefprotokoll
```

### 📣 MarketingPilot (`/dashboard/marketing`)
```
app/dashboard/marketing/page.tsx
├── Kampagnen (Create – Edit/Delete noch offen!)
├── Leads
└── Newsletter

DB-Calls:
  getMarketingKampagnen / upsertMarketingKampagne
  getMarketingLeads / upsertMarketingLead
  getMarketingNewsletter / upsertMarketingNewsletter
```

### 📈 AnalysePilot (`/dashboard/analyse`)
```
app/dashboard/analyse/page.tsx
├── Bar Chart    (recharts v3)
├── Line Chart
├── Area Chart
└── Pie Chart
⚠️ Aktuell Demo-Daten – noch nicht mit Supabase verbunden
```

### 📅 PlanungPilot (`/dashboard/planung`)
```
app/dashboard/planung/page.tsx
├── Projekte (CRUD + Edit + Meilensteine)
├── Aufgaben (CRUD + Edit + Status: offen/in Bearbeitung/erledigt)
├── Kalender (CRUD + Edit + Monatsansicht)
└── Ressourcen (CRUD: Mitarbeiter/Maschinen/Material)

DB-Calls:
  getPlanungProjekte / upsertPlanungProjekt / deletePlanungProjekt
  getPlanungAufgaben / upsertPlanungAufgabe / deletePlanungAufgabe
  getPlanungTermine / upsertPlanungTermin / deletePlanungTermin
  getPlanungRessourcen / upsertPlanungRessource
```

### 🧠 KI-Assistent (`/dashboard/ki-erkennung`)
```
app/dashboard/ki-erkennung/page.tsx
├── Tab: Tagesbrief    Was heute anliegt / Nachbestellungen / Kunden
├── Tab: Dokument-Erkennung  (OCR-Simulation)
└── Tab: Chat          Freitext-Chat → POST /api/chat/route.ts → Anthropic API
```

---

## 5. Datenschicht (lib/)

```
lib/
├── supabase.ts       Supabase-Client erstellen + isConfigured-Check
│     exports: createSupabaseClient(), isSupabaseConfigured()
│
├── auth.ts           Auth-Hilfsfunktionen
│     exports: DEMO_EMAIL, DEMO_PASSWORD
│               setDemoCookie(), clearDemoCookie(), hasDemoCookie()
│               isDemoUser(email)
│
├── db.ts             Zentrale CRUD-Schicht (Supabase)
│     ├── Lager:      getLagerArtikel, upsertLagerArtikel, deleteLagerArtikel
│     │               getLagerBewegungen, insertLagerBewegung
│     ├── Büro:       getBueroKunden/upsert/delete
│     │               getBueroAngebote/upsert
│     │               getBueroAuftraege/upsert
│     │               getBueroRechnungen/upsert
│     │               getBueroDokumente/insert/delete
│     │               uploadDokument, getDokumentUrl
│     ├── Werkstatt:  getWerkstattKarten/upsert/delete
│     │               getWerkstattZeitbuchungen/insert
│     │               getWerkstattMaterial/insert
│     │               getWerkstattPruefprotokolle/insert
│     ├── Marketing:  getMarketingKampagnen/upsert
│     │               getMarketingLeads/upsert
│     │               getMarketingNewsletter/upsert
│     ├── Planung:    getPlanungProjekte/upsert/delete
│     │               getPlanungAufgaben/upsert/delete
│     │               getPlanungTermine/upsert/delete
│     │               getPlanungRessourcen/upsert
│     └── Einkauf:    getEinkaufLieferanten/upsert/delete
│                     getEinkaufBestellungen/upsert
│                     getEinkaufWareneingaenge/insert
│
├── roles.ts          Rollen-System
│     exports: AppRole ('Admin'|'Mitarbeiter'|'Büro'|'Werkstatt'|'Lager')
│               PERMISSIONS.canDelete/canCreate/canEdit/canExport(role)
│               getRole(), setRole(), useRole()
│               ROLE_PILOTS (welche Piloten pro Rolle)
│
├── warnings.ts       Warn-System (Notification Bell)
│     exports: Warning (Typ), getAppWarnings(isDemo)
│               → liest Lager/Büro/Werkstatt/Planung aus DB
│               → Demo: 6 statische Beispiel-Warnungen
│
└── pdf.ts            PDF-Generierung via jsPDF
      exports: PDFRechnung (Typ), PDFAngebot (Typ)
               generateRechnungPDF(), generateAngebotPDF()
```

---

## 6. Datenbankschema (Supabase)

```
auth.users  (Supabase intern)
    │  user_id → alle Tabellen (RLS)
    │
    ├── lager_artikel
    │     id · user_id · name · einheit · bestand · mindestbestand · preis · kategorie
    │
    ├── lager_bewegungen
    │     id · user_id · artikel_id(FK) · typ(eingang|ausgang|inventur)
    │     menge · datum · notiz · erstellt_am
    │
    ├── buero_kunden
    │     id · user_id · firma · ansprechpartner · email · telefon · adresse · notiz
    │
    ├── buero_angebote
    │     id · user_id · kunde_id(FK) · nummer · datum · gueltig_bis · positionen(JSON)
    │     summe · status · notiz
    │
    ├── buero_auftraege
    │     id · user_id · kunde_id(FK) · angebot_id(FK?) · nummer · datum
    │     positionen(JSON) · summe · status · notiz
    │
    ├── buero_rechnungen
    │     id · user_id · kunde_id(FK) · auftrag_id(FK?) · nummer · datum
    │     faellig_am · positionen(JSON) · summe · bezahlt · bezahlt_am · notiz
    │
    ├── buero_dokumente
    │     id · user_id · name · typ · pfad · groesse · erstellt_am
    │
    ├── einkauf_lieferanten          ⚠️ NEU – SQL noch ausführen!
    │     id · user_id · name · kategorie · ansprechpartner · email · telefon
    │     zahlungsziel · bewertung · notiz · erstellt_am
    │
    ├── einkauf_bestellungen         ⚠️ NEU – SQL noch ausführen!
    │     id · user_id · lieferant_id(FK) · status(Entwurf|Bestellt|Teillieferung|Geliefert)
    │     artikel · menge · einzelpreis · gesamtpreis · bestelldatum
    │     lieferdatum_soll · notiz · erstellt_am
    │
    ├── einkauf_wareneingaenge       ⚠️ NEU – SQL noch ausführen!
    │     id · user_id · bestellung_id(FK) · eingangsdatum · menge_bestellt
    │     menge_erhalten · qualitaet(OK|Mängel|Abgelehnt) · notiz · erstellt_am
    │
    ├── werkstatt_karten
    │     id · user_id · titel · fahrzeug · kennzeichen · kunde · status
    │     fortschritt · prioritaet · erstellt_am · faellig_am · notiz
    │
    ├── werkstatt_zeitbuchungen
    │     id · user_id · karte_id(FK) · mitarbeiter · datum · stunden · notiz
    │
    ├── werkstatt_material
    │     id · user_id · karte_id(FK) · bezeichnung · menge · einheit · einzelpreis · erstellt_am
    │
    ├── werkstatt_pruefprotokolle
    │     id · user_id · karte_id(FK) · pruefdatum · pruefer · ergebnis(bestanden|nicht bestanden)
    │     punkte(JSON) · notiz
    │
    ├── marketing_kampagnen
    │     id · user_id · name · typ · status · budget · starts_at · ends_at · notiz
    │
    ├── marketing_leads
    │     id · user_id · name · email · telefon · status · quelle · notiz · erstellt_am
    │
    ├── marketing_newsletter
    │     id · user_id · betreff · inhalt · status · geplant_am · gesendet_am
    │
    ├── planung_projekte
    │     id · user_id · name · beschreibung · status · startdatum · enddatum
    │     budget · meilensteine(JSON) · notiz
    │
    ├── planung_aufgaben
    │     id · user_id · projekt_id(FK?) · titel · beschreibung · status
    │     faellig_am · zugewiesen_an · prioritaet
    │
    ├── planung_termine
    │     id · user_id · titel · beschreibung · datum · uhrzeit · ort · typ · notiz
    │
    └── planung_ressourcen
          id · user_id · name · typ(Mitarbeiter|Maschine|Material) · verfuegbarkeit · notiz

Storage:
  Bucket: dokumente (private, RLS: SELECT/INSERT/DELETE nur eigene Dateien)
```

---

## 7. Komponenten & ihre Abhängigkeiten

```
components/Sidebar.tsx
  ← verwendet: usePathname (next/navigation)
  ← zeigt: Logo, alle Piloten-Links, Einstellungen, Rollen-Badge

components/NotificationBell.tsx
  ← verwendet: getAppWarnings(isDemo) aus lib/warnings.ts
  ← warnings.ts liest: getLagerArtikel, getBueroRechnungen,
                        getWerkstattKarten, getPlanungTermine (aus lib/db.ts)
  ← Auto-Refresh: alle 60 Sekunden
  ← Tabs: Alle / Fehler / Warnung
  ← Links führen direkt zu betroffenem Pilot

components/GlobalSearch.tsx
  ← ⌘K öffnet Modal
  ← Sucht über: Piloten-Namen, Routen

components/SupportButton.tsx
  ← Fixed bottom-right (className="support-btn-wrap" → CSS hebt über Bottom-Nav)
  ← 3 Kontakte: WhatsApp / E-Mail / Telefon
```

---

## 8. Auth-Flow

```
Browser öffnet /dashboard
        │
        ▼
middleware.ts
  ├── Supabase Session vorhanden? → weiter
  ├── Cookie pk_demo=1?          → weiter
  └── sonst                      → redirect /login

/login (app/login/page.tsx)
  ├── E-Mail = demo@petersen-ki-pilot.de + Passwort = Demo1234!
  │     └── setDemoCookie() → Cookie pk_demo=1 → /dashboard
  └── Andere Credentials
        └── supabase.auth.signInWithPassword() → Session → /dashboard

Demo-Modus in Piloten:
  if (hasDemoCookie()) {
    // zeige statische Demo-Daten
    return
  }
  // echter Supabase-Zugriff
```

---

## 9. Mobile / PWA

```
app/layout.tsx
  └── export const viewport: Viewport = {
        width: 'device-width', initialScale: 1,
        maximumScale: 1, userScalable: false,
        viewportFit: 'cover', themeColor: '#05070b'
      }

public/manifest.json
  └── name: "Petersen KI Betriebssteuerung"
      short_name: "Petersen KI"
      start_url: "/dashboard"
      display: "standalone"

app/globals.css – Mobile-Klassen:
  .bottom-nav          → Bottom Navigation (flex, nur ≤768px)
  .bottom-nav-item     → Einzelner Nav-Eintrag (min-height 56px)
  .stats-grid          → Responsive 1–4 Spalten KPI-Grid
  .mobile-1col         → Erzwingt 1-Spalte auf Mobile
  .pk-tab-bar          → Horizontaler Tab-Scroll (kein Scrollbar sichtbar)
  .support-btn-wrap    → SupportButton über Bottom-Nav heben

iOS-Fixes:
  .pk-input { font-size: 16px !important }   → kein Auto-Zoom
  .pk-btn   { min-height: 44px }             → Touch-Target
  padding:  env(safe-area-inset-*)           → Notch/Home-Indicator
  height:   100dvh                           → iOS Safari Viewport-Fix
```

---

## 10. Externe Dienste & Umgebungsvariablen

```
┌─────────────────────────────────────────┐
│         Externe Dienste                  │
│                                          │
│  Supabase                               │
│    NEXT_PUBLIC_SUPABASE_URL             │
│    NEXT_PUBLIC_SUPABASE_ANON_KEY        │
│    → Auth, PostgreSQL, Storage          │
│                                          │
│  Anthropic (Claude API)                 │
│    ANTHROPIC_API_KEY                    │
│    → KI-Chat via /api/chat              │
│                                          │
│  Vercel                                 │
│    → Hosting + Auto-Deploy (main-Push)  │
│    → Node.js 18.x                       │
└─────────────────────────────────────────┘
```

---

## 11. Offene Punkte (priorisiert)

### 🔴 Kritisch / Sofort
| # | Aufgabe | Datei |
|---|---------|-------|
| 1 | **Supabase SQL ausführen**: 3 neue Einkauf-Tabellen + mindestbestand-Spalte | `supabase/schema.sql` |
| 2 | **EinkaufTab** auf echte DB-Calls umstellen (db.ts-Funktionen fertig, nur verdrahten) | `app/dashboard/buero/page.tsx` |

### 🟡 Offen / Nächste Session
| # | Aufgabe | Datei |
|---|---------|-------|
| 3 | MarketingPilot: Edit + Delete implementieren | `app/dashboard/marketing/page.tsx` |
| 4 | AnalysePilot: echte Supabase-Daten statt Demo-Charts | `app/dashboard/analyse/page.tsx` |
| 5 | Rollen-basierte Sidebar-Filterung (ROLE_PILOTS in roles.ts bereits definiert) | `components/Sidebar.tsx` |
| 6 | Benutzer-Verwaltung (Admin vergibt Rollen an andere User) | neu |
| 7 | PDF-Vorlagen: Firmenlogo + echte Adressdaten | `lib/pdf.ts` |
| 8 | E-Mail-Benachrichtigungen bei Mindestbestand (echte E-Mail, aktuell simuliert) | neu |

### 🟢 Langfristig
| # | Aufgabe |
|---|---------|
| 9 | Stripe Integration (Abo/Bezahlung) |
| 10 | Push-Benachrichtigungen (PWA Service Worker) |
| 11 | Offline-Modus (Service Worker + Cache) |
| 12 | Multi-Mandanten (mehrere Betriebe pro Account) |
