# Petersen KI – Vollständige Projektmappe

> Letzte Aktualisierung: 2026-05-12

---

## 1. Gesamt-Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER / PWA                                │
│  manifest.json  ·  Viewport-Meta  ·  iOS Safe-Areas  ·  Bottom-Nav │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────────┐
│                    VERCEL (Next.js 14 App Router)                    │
│                                                                      │
│  app/layout.tsx ──────────────────────────────────────────────────  │
│    └─ app/page.tsx            → Redirect → /login                   │
│    └─ app/login/page.tsx      → Auth-Formular                       │
│    └─ app/register/page.tsx   → Registrierung                       │
│    └─ app/dashboard/layout.tsx → Auth-Guard + Shell                 │
│         └─ Sidebar.tsx + NotificationBell.tsx + GlobalSearch.tsx    │
│         └─ SupportButton.tsx + Bottom-Nav (Mobile)                  │
│         └─ [alle Piloten-Seiten]                                    │
│                                                                      │
│  app/api/chat/route.ts  ──────→  Anthropic API (Claude Sonnet)      │
│    ├── Demo: DEMO_CONTEXT (statisch)                                 │
│    ├── Live: Server-Supabase via lib/server-auth.ts                  │
│    ├── buildContextBlock() → Lagerdaten + Problem-Analyse im Prompt │
│    └── structuredOutput → JSON { message, probleme[], actions[] }   │
│                                                                      │
│  middleware.ts  ──────────────→  Auth-Redirect-Schutz               │
└──────────┬─────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│                       SUPABASE                                       │
│  Auth  ·  PostgreSQL (22 Tabellen)  ·  Storage (dokumente)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Routing-Struktur

```
/                          → app/page.tsx          (Redirect zu /login)
/login                     → app/login/page.tsx
/register                  → app/register/page.tsx

/dashboard                 → app/dashboard/page.tsx
/dashboard/lager           → app/dashboard/lager/page.tsx       ← LagerPilot (12 Tabs)
/dashboard/buero           → app/dashboard/buero/page.tsx       ← BüroPilot (6 Tabs)
/dashboard/werkstatt       → app/dashboard/werkstatt/page.tsx
/dashboard/marketing       → app/dashboard/marketing/page.tsx          ← CRUD + KI-Menü mit Vorschau-Dashboards
/dashboard/analyse         → app/dashboard/analyse/page.tsx
/dashboard/planung         → app/dashboard/planung/page.tsx
/dashboard/ki-erkennung    → app/dashboard/ki-erkennung/page.tsx ← KI-Assistent (3 Tabs)
/dashboard/cloud           → app/dashboard/cloud/page.tsx              ← Live-Kennzahlen + Backup-/Geräteübersicht
/dashboard/archiv          → app/dashboard/archiv/page.tsx             ← Büro-Dokumente + Steuerbelege
/dashboard/buero/[entity]/[id] → app/dashboard/buero/[entity]/[id]/page.tsx
/dashboard/einstellungen   → app/dashboard/einstellungen/page.tsx

POST /api/chat             → app/api/chat/route.ts               ← KI-Chat + Lagerdaten
```

---

## 3. Dashboard Shell (Layout)

```
app/dashboard/layout.tsx
├── Auth-Check (Supabase Session OR Cookie pk_demo=1)
│     ├── kein Auth + kein Demo → redirect /login
│     └── ok → render Shell
│
├── Sidebar.tsx
│     ├── Logo (/public/logo.jpg)
│     ├── Links zu allen Piloten (mit Rollen-Badge)
│     ├── NotificationBell.tsx (Auto-Refresh 60s)
│     │     └── getAppWarnings(isDemo) ← lib/warnings.ts ← lib/db.ts
│     └── GlobalSearch.tsx (⌘K)
│
├── Bottom-Nav (Mobile ≤768px, .bottom-nav CSS-Klasse)
│     ├── /dashboard         ⊞ Start
│     ├── /dashboard/lager   📦 Lager
│     ├── /dashboard/buero   🧾 Büro
│     ├── /dashboard/werkstatt 🛠️ Werkstatt
│     ├── /dashboard/ki-erkennung 🧠 KI
│     └── #menu              ☰ → öffnet Sidebar
│
└── SupportButton.tsx (fixed bottom-right, .support-btn-wrap)
      ├── WhatsApp: +4917656392975
      ├── E-Mail: info@petersen-ki-pilot.de
      └── Telefon
```

---

## 4. Piloten – Tabs & Features im Detail

### 📊 Dashboard (`/dashboard`)
```
app/dashboard/page.tsx
├── Demo: demoKpis (statisch)
└── Live: Promise.allSettled([
      getLagerArtikel()     → Artikel-Anzahl, kritische Bestände
      getBueroRechnungen()  → offene/überfällige Rechnungen
      getBueroAuftraege()   → laufende Aufträge
    ])
    └── 6 klickbare KPI-Cards → Navigation zu Piloten
```

---

### 📦 LagerPilot (`/dashboard/lager`) — 12 Tabs

```
app/dashboard/lager/page.tsx  (~2.500 Zeilen)
│
├── Tab: tagesbericht  🧠 KI-Tagesbericht (ERSTER TAB, NEU)
│     ├── 4 KPI-Karten (lokal, kein KI): MHD-kritisch / Unter-Mindest /
│     │     Überlastete SP / Artikel gesamt
│     ├── "Tagesbericht erstellen"-Button → POST /api/chat (structuredOutput)
│     │     └── Antwort: 🔴 Dringend / ⚠️ Wichtig / 📦 Info Karten + Prosatext
│     ├── KI-Aktions-Vorschläge mit Inline-Bestätigung + Ausführung
│     ├── "KI fragt selbst nach"-Buttons (aus Echtdaten generiert):
│     │     • Nachbestellung für [Artikel]?
│     │     • [Artikel] wegen MHD in Sperrlager umlagern?
│     │     • Überlasteter Stellplatz – Vorschläge erstellen?
│     └── Detailliste: alle kritischen Artikel (MHD + Mindestbestand)
│
├── Tab: bestand       📦 Artikelbestand
│     ├── CRUD (Inline-Edit-Modal)
│     ├── Mindestbestand-Spalte (editierbar)
│     ├── Alarm-Banner wenn Bestand < Mindestbestand
│     ├── 📈-Button → navigiert zu Tab "historie" gefiltert auf Artikel
│     ├── Inline-Delete (2-Klick-Bestätigung)
│     └── CSV-Export, Spalten-Sortierung
│
├── Tab: bewegungen    🔄 Lagerbewegungen (read-only)
│
├── Tab: eingang       📥 Wareneingang
│     ├── Formular: Artikel, Menge, Lagerplatz, Mitarbeiter
│     ├── getBestStellplatz()-Info-Box (regelbasierter Stellplatz-Vorschlag)
│     │     Scoring: warengruppe+3 / warenobergruppe+2 / lagerplatz-Prefix+1 /
│     │               freier SP+2 / Kühl-Typ+2
│     └── insertLagerBewegung('eingang')
│
├── Tab: ausgang       📤 Warenausgang
│     └── nach Buchung: prüft Mindestbestand → bestellHint-Banner
│
├── Tab: inventur      📋 Inventurliste mit Ist/Soll-Vergleich
│
├── Tab: bestellung    🛒 Bestellvorschläge
│     ├── Nur Artikel unter Mindestbestand
│     ├── BestellDetailModal: editierbare Menge + E-Mail-Vorschau (simuliert)
│     └── "Alle bestellen"-Button (Bulk)
│
├── Tab: historie      📈 Artikel-Bewegungshistorie
│     ├── Dropdown-Filter: Typ (alle/eingang/ausgang/inventur)
│     ├── Artikel-Filter
│     └── Statistik-Karten: Gesamt-Ein/Ausgang, Ø Buchungsgröße
│
├── Tab: stellplaetze  📍 Stellplatz-Verwaltung (NEU)
│     ├── 5 KPI-Karten: Gesamt / Aktiv / Überlastet (≥3 Pos.) / MHD-kritisch / Frei
│     ├── Warn-Banner bei kritischen Zuständen
│     ├── 4 Optimierungsvorschläge (regelbasiert)
│     ├── Toolbar: Suche + Bereich-Filter + "Neu"-Button
│     ├── Tabelle mit Inline-Delete
│     └── Modal (Code, Name, Bereich, Zone, Gang, Regal, Ebene, Fach,
│           Typ, Warengruppe, Warenobergruppe, Temperaturzone,
│           Max-Gewicht, Max-Volumen, Aktiv-Toggle, Notiz)
│
├── Tab: lagerbelegung 📊 Stellplatz-Bestand
│     ├── Filter: Bereich-Dropdown / MHD-kritisch-Toggle / Suche
│     ├── MHD-Status-Badge: abgelaufen / kritisch / ok / kein
│     └── Inline-Delete
│
├── Tab: umlagerung    ↔️ Artikel umlagern
│     ├── Formular:
│     │     • Quell-Position (Dropdown aus lager_stellplatz_bestand)
│     │     • Ziel-Stellplatz (Dropdown aus lager_stellplaetze)
│     │     • Menge (max: verfügbare Menge)
│     │     • Grund (Select: Wareneingang/Umsortierung/Optimierung/Sperrlager/Inventur/Sonstiges)
│     │     • Notiz
│     ├── Validierung: Pflichtfelder + Menge-Check + Quelle≠Ziel
│     ├── Demo: lokaler State-Update
│     ├── Live: umlagerArtikel() → 4-Schritt-Transaktion
│     └── Protokoll-Tabelle der letzten Umlagerungen
│
└── Tab: kommissionierung 🧺 Pickliste
      ├── Toolbar: "Auswahl zurücksetzen" + "🧺 Pickliste (N)"-Button
      ├── 4 KPI-Karten: Artikel gesamt / Bereiche / Ausgewählt / Niedrig/Leer
      ├── Artikel-Tabelle mit Checkbox-Spalte:
      │     • "Alle auswählen"-Checkbox in Thead
      │     • Zeilenklick = Toggle (grün hinterlegt wenn ausgewählt)
      │     • Gruppiert nach Bereichen
      └── Generierte Pickliste (wenn ≥1 ausgewählt + Button geklickt):
            • Sortiert: Bereich → Regal → Fach (parsed aus "A-01-03")
            • Gruppiert nach Bereichen mit Laufnummer
            • Grüne Header-Zeilen pro Bereich

DB-Calls:
  getLagerArtikel / upsertLagerArtikel / deleteLagerArtikel
  getLagerBewegungen / insertLagerBewegung
  getLagerStellplaetze / upsertLagerStellplatz / deleteLagerStellplatz
  getLagerStellplatzBestand / upsertLagerStellplatzBestand / deleteLagerStellplatzBestand
  getLagerUmlagerungen / insertLagerUmlagerung
  umlagerArtikel (4-Schritt-Transaktion)
```

**Lager-Typen:**
```ts
type Stellplatz = { id, code, name?, bereich?, zone?, typ?, warengruppe?,
  warenobergruppe?, temperaturzone?, aktiv?, notiz? }
type StellplatzBestand = { id, stellplatz_id, artikelnummer?, artikelname?,
  charge?, mhd?, menge, einheit?, status?, eingelagert_am?, notiz?,
  lager_stellplaetze?: { code, bereich? } }
type Umlagerung = { id, artikelname?, artikelnummer?, von_stellplatz_id?,
  nach_stellplatz_id?, menge, grund?, datum?, notiz? }
type KiAktion = { type: 'umlagerung'|'bestellung'|'hinweis', artikel?,
  von?, nach?, menge?, beschreibung? }
```

---

### 🧾 BüroPilot (`/dashboard/buero`) — 6 Tabs + Detailseiten

```
app/dashboard/buero/page.tsx
│
├── Tab: kunden       Kundenstamm (CRUD + Edit-Modal)
├── Tab: angebote     Angebote (CRUD + Edit + → Auftrag konvertieren)
│     └── generateAngebotPDF() ← lib/pdf.ts
├── Tab: auftraege    Aufträge (CRUD + Edit + Statusverlauf)
├── Tab: rechnungen   Rechnungen (CRUD + Edit + PDF-Download)
│     └── generateRechnungPDF() ← lib/pdf.ts
├── Tab: dokumente    Dokumente (Upload → Supabase Storage + Download)
│     └── uploadDokument / getDokumentUrl ← lib/db.ts
│
└── Tab: einkauf      🏭 Lieferanten / Bestellungen / Wareneingänge
      ├── Sub-Tab: Lieferanten
      │     ├── CRUD (Name, Kategorie, Ansprechpartner, E-Mail, Tel, Zahlungsziel)
      │     ├── Sternebewertung ★/☆ (1–5)
      │     └── 🛒-Button → springt zu Bestellungen
      │
      ├── Sub-Tab: Bestellungen
      │     ├── Status-Workflow: Entwurf → Bestellt → Teillieferung → Geliefert
      │     ├── "Auslösen"-Button (Entwurf → Bestellt)
      │     └── "WE buchen"-Button → springt zu Wareneingänge
      │
      ├── Sub-Tab: Wareneingänge
      │     ├── Qualitätskontrolle: OK / Mängel / Abgelehnt
      │     └── auto: Bestellstatus → Geliefert / Teillieferung
      │
      └── 4 KPI-Karten
      ⚠️ Teile des Einkaufs sind fachlich noch leichter als Lager, aber Relationen Kunde/Lieferant/Dokument wurden bereits nachgezogen

Zusätzlich:
- `app/dashboard/buero/[entity]/[id]/page.tsx`
- generische Detailroute für:
  - Kunden
  - Angebote
  - Aufträge
  - Rechnungen
  - Eingangsrechnungen
  - Dokumente
  - Lieferanten
  - Bestellungen

Relationen-Stand:
- `buero_angebote.kunde_id`
- `buero_auftraege.kunde_id`
- `buero_rechnungen.kunde_id`
- `buero_eingangsrechnungen.lieferant_id`
- `buero_dokumente` mit Relationsfeldern für Eingangsrechnung/Rechnung/Angebot/Auftrag

Archiv-/Cloud-Stand:
- Archiv ist nicht mehr nur Demo-UI, sondern zieht echte Büro-Dokumente und Steuerbelege
- Cloud zeigt echte Live-Kennzahlen statt fester Demo-Sync-Werte

### 📣 MarketingPilot (`/dashboard/marketing`)

Aktueller Stand:
- Bestehende Live-Bereiche: Kampagnen, Leads, Newsletter, Auswertungen
- Neue KI-Menüpunkte direkt im MarketingPilot

KI-Menüpunkte im UI:
- Autopilot-Marketing
- SEO-/Keywords-Analyse
- Lead Intelligence Engine
- Automatisches A/B Testing
- KI-Content & Reels
- Funnel-Builder
- KI-Vertriebsassistent
- Verkäufer-Klon
- Daily Content Ideas
- Predictive Marketing
- Branchen-Templates
- Integrationen
- Gamification
- Explainability

Wichtig:
- jedes Modul hat einen eigenen Menüpunkt
- neue KI-Bereiche sind read-only aufgebaut
- noch keine echte Datenlogik
- SEO-/Keywords-Analyse zeigt aktuell grobe Kennzahlen
```

---

### 🛠️ WerkstattPilot (`/dashboard/werkstatt`)
```
├── Arbeitskarten (CRUD + Edit + Fortschritt-Slider 0–100%)
├── Zeiterfassung (Start/Stop + manuelle Buchung)
├── Materialverbrauch
└── Prüfprotokoll (Ergebnis inline)
```

### 📣 MarketingPilot (`/dashboard/marketing`)
```
├── Kampagnen (Create ✅ – Edit/Delete ❌ fehlt noch)
├── Leads
└── Newsletter
```

### 📈 AnalysePilot (`/dashboard/analyse`)
```
├── Bar Chart / Line Chart / Area Chart / Pie Chart (recharts v3)
⚠️ Aktuell Demo-Daten – noch nicht mit Supabase verbunden
```

### 📅 PlanungPilot (`/dashboard/planung`)
```
├── Projekte (CRUD + Edit + Meilensteine)
├── Aufgaben (CRUD + Edit + Status)
├── Kalender (CRUD + Edit + Monatsansicht)
└── Ressourcen (CRUD)
```

---

### 🧠 KI-Assistent (`/dashboard/ki-erkennung`) — 3 Tabs

```
app/dashboard/ki-erkennung/page.tsx
│
├── Tab: Tagesbrief
│     ├── Lädt echte Daten (Aufgaben, Werkstatt-Karten, Artikel, Rechnungen)
│     ├── POST /api/chat → KI-generierter Tagesbrief (plain text)
│     └── Fallback: statischer Tagesbrief wenn kein API-Key
│
├── Tab: Dokument-Erkennung
│     └── OCR-Simulation (Upload → Analyse → Felder extrahiert)
│
└── Tab: Chat
      ├── ChatMessage-Typ: { role, content, actions?: KiAction[] }
      ├── structuredOutput: true → JSON { message, actions[] }
      ├── Aktionskarten unter Textblase:
      │     📦 Umlagerung (blau) – mit "Umlagerung ausführen →" Button
      │     🛒 Bestellung (orange) – nur Anzeige [Vorschlag]
      │     💡 Hinweis (lila) – nur Anzeige [Vorschlag]
      ├── Inline-Bestätigung: "Wirklich ausführen?" → [✓ Ja] [Abbrechen]
      ├── executeUmlagerung():
      │     1. getLagerStellplaetze() → Code → UUID (nach-Stellplatz)
      │     2. getLagerStellplatzBestand() → Artikelname+Code → vonBestandId
      │     3. umlagerArtikel({ vonBestandId, nachStellplatzId, menge })
      │     Demo: simulierter Delay + Toast (kein DB-Call)
      └── actionToast: success/error (fixed bottom-right, zIndex 9999)
```

---

## 5. KI-API (`app/api/chat/route.ts`)

```
POST /api/chat
│
├── Cookie pk_demo=1?
│     ├── Ja  → DEMO_CONTEXT (statische Artikel/Stellplätze/Bestand/Umlagerungen)
│     └── Nein → Promise.allSettled([
│           getLagerArtikel(), getLagerStellplaetze(),
│           getLagerStellplatzBestand(), getLagerUmlagerungen()
│         ])  ← Hinweis: ohne SSR-Auth-Client gibt RLS leere Arrays zurück!
│
├── buildContextBlock(systemContext)
│     ├── Artikelbestand-Tabelle (alle Artikel mit Status)
│     ├── Vorberechnete Problem-Analyse:
│     │     🔴 DRINGEND: MHD abgelaufen + Bestand leer
│     │     ⚠️ WICHTIG:  MHD kritisch (< 30 Tage) + Bestand niedrig
│     │     📦 INFO:     Stellplatz überlastet (≥3 Pos.) + Artikel verteilt (≥2 SP)
│     ├── Stellplatz-Liste
│     └── Letzte Umlagerungen
│
├── System-Prompt:
│     "Du bist KI-Assistent für Warenwirtschaftssystem.
│      Du erkennst proaktiv Probleme: MHD, Mindestbestand, überlastete SP, verteilte Artikel.
│      Antworte konkret basierend auf Daten — echte Namen, Mengen, Codes."
│
├── structuredOutput: false → plain text reply
└── structuredOutput: true →
      JSON Schema: { message, probleme[{ level, text }], actions[{ type, ... }] }
      Fallback: plain text wenn JSON.parse() schlägt fehl
      Levels: "dringend" | "wichtig" | "info"
      Action-Types: "umlagerung" | "bestellung" | "hinweis"
```

---

## 6. Datenschicht (lib/)

```
lib/
├── supabase.ts       createSupabaseClient() (createBrowserClient aus @supabase/ssr)
│                     isSupabaseConfigured()
│
├── auth.ts           hasDemoCookie() / setDemoCookie() / clearDemoCookie()
│                     isDemoUser(email) / DEMO_EMAIL / DEMO_PASSWORD
│
├── db.ts             Alle CRUD-Funktionen
│     ├── Lager:      getLagerArtikel, upsertLagerArtikel, deleteLagerArtikel
│     │               getLagerBewegungen, insertLagerBewegung
│     │               getLagerStellplaetze, upsertLagerStellplatz, deleteLagerStellplatz
│     │               getLagerStellplatzBestand, upsertLagerStellplatzBestand, deleteLagerStellplatzBestand
│     │               getLagerUmlagerungen, insertLagerUmlagerung
│     │               umlagerArtikel (4-Schritt-Transaktion)
│     ├── Büro:       getBueroKunden/upsert/delete, getBueroAngebote/upsert,
│     │               getBueroAuftraege/upsert, getBueroRechnungen/upsert,
│     │               getBueroDokumente/insert/delete, uploadDokument, getDokumentUrl
│     ├── Werkstatt:  getWerkstattKarten/upsert/delete, getWerkstattZeitbuchungen/insert,
│     │               getWerkstattMaterial/insert, getWerkstattPruefprotokolle/insert
│     ├── Marketing:  getMarketingKampagnen/upsert, getMarketingLeads/upsert,
│     │               getMarketingNewsletter/upsert
│     ├── Planung:    getPlanungProjekte/upsert/delete, getPlanungAufgaben/upsert/delete,
│     │               getPlanungTermine/upsert/delete, getPlanungRessourcen/upsert
│     └── Einkauf:    getEinkaufLieferanten/upsert/delete, getEinkaufBestellungen/upsert,
│                     getEinkaufWareneingaenge/insert
│
├── roles.ts          AppRole, PERMISSIONS, useRole/getRole/setRole
├── warnings.ts       getAppWarnings(isDemo) → Warning[]
└── pdf.ts            generateRechnungPDF, generateAngebotPDF (via jsPDF)
```

---

## 7. Datenbankschema (Supabase) — 22 Tabellen

```
auth.users  (Supabase intern)
    │  user_id → alle Tabellen (RLS: jeder sieht nur eigene Daten)
    │
    ├── LAGER ─────────────────────────────────────────────────────
    │
    ├── lager_artikel
    │     id(text PK) · user_id · name · einheit · bestand · mindestbestand(int,0)
    │     preis · kategorie · lagerplatz · status · updated_at
    │
    ├── lager_bewegungen
    │     id(text PK) · user_id · artikel_id(FK) · typ(eingang|ausgang|inventur)
    │     menge · datum · notiz · mitarbeiter · status · erstellt_am
    │
    ├── lager_stellplaetze                    ← NEU — SQL ausführen!
    │     id(uuid PK) · user_id · code(unique) · name · bereich · zone
    │     gang · regal · ebene · fach · typ · warengruppe · warenobergruppe
    │     temperaturzone · max_gewicht · max_volumen · aktiv(bool,true) · notiz
    │     created_at · updated_at
    │
    ├── lager_stellplatz_bestand              ← NEU — SQL ausführen!
    │     id(text PK) · user_id · stellplatz_id(FK→lager_stellplaetze)
    │     artikel_id · artikelnummer · artikelname · charge · mhd · menge
    │     einheit · status · eingelagert_am · notiz · created_at
    │
    ├── lager_umlagerungen                    ← NEU — SQL ausführen!
    │     id(text PK) · user_id · artikel_id · artikelnummer · artikelname
    │     von_stellplatz_id(FK?) · nach_stellplatz_id(FK?) · charge · mhd
    │     menge · grund · datum · notiz · erstellt_am
    │
    ├── BÜRO ──────────────────────────────────────────────────────
    │
    ├── buero_kunden
    │     id · user_id · firma · ansprechpartner · email · telefon · adresse · notiz
    │
    ├── buero_angebote
    │     id · user_id · kunde_id(FK) · nummer · datum · gueltig_bis
    │     positionen(JSON) · summe · status · notiz
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
    ├── EINKAUF ───────────────────────────────────────────────────
    │
    ├── einkauf_lieferanten                   ← NEU — SQL ausführen!
    │     id · user_id · name · kategorie · ansprechpartner · email · telefon
    │     zahlungsziel · bewertung(1-5) · notiz · erstellt_am
    │
    ├── einkauf_bestellungen                  ← NEU — SQL ausführen!
    │     id · user_id · lieferant_id(FK) · status(Entwurf|Bestellt|Teillieferung|Geliefert)
    │     artikel · menge · einzelpreis · gesamtpreis · bestelldatum
    │     lieferdatum_soll · notiz · erstellt_am
    │
    ├── einkauf_wareneingaenge                ← NEU — SQL ausführen!
    │     id · user_id · bestellung_id(FK) · eingangsdatum · menge_bestellt
    │     menge_erhalten · qualitaet(OK|Mängel|Abgelehnt) · notiz · erstellt_am
    │
    ├── WERKSTATT ─────────────────────────────────────────────────
    │
    ├── werkstatt_karten
    │     id · user_id · titel · fahrzeug · kennzeichen · kunde · status
    │     fortschritt(0-100) · prioritaet · erstellt_am · faellig_am · notiz
    │
    ├── werkstatt_zeitbuchungen
    │     id · user_id · karte_id(FK) · mitarbeiter · datum · stunden · notiz
    │
    ├── werkstatt_material
    │     id · user_id · karte_id(FK) · bezeichnung · menge · einheit · einzelpreis · erstellt_am
    │
    ├── werkstatt_pruefprotokolle
    │     id · user_id · karte_id(FK) · pruefdatum · pruefer
    │     ergebnis(bestanden|nicht bestanden) · punkte(JSON) · notiz
    │
    ├── MARKETING ─────────────────────────────────────────────────
    │
    ├── marketing_kampagnen / marketing_leads / marketing_newsletter
    │
    ├── PLANUNG ───────────────────────────────────────────────────
    │
    └── planung_projekte / planung_aufgaben / planung_termine / planung_ressourcen

Storage:
  Bucket: dokumente (private, RLS: SELECT/INSERT/DELETE nur eigene Dateien)
```

---

## 8. Auth-Flow

```
Browser öffnet /dashboard
        │
        ▼
middleware.ts
  ├── Supabase Session vorhanden? → weiter
  ├── Cookie pk_demo=1?           → weiter
  └── sonst                       → redirect /login

/login (app/login/page.tsx)
  ├── E-Mail = demo@petersen-ki-pilot.de + Passwort = Demo1234!
  │     └── setDemoCookie() → pk_demo=1 → /dashboard
  └── Andere Credentials
        └── supabase.auth.signInWithPassword() → Session → /dashboard

Demo-Modus-Check in allen Piloten:
  const [isDemo] = useState(() => hasDemoCookie())
  // Wenn isDemo: statische Daten, kein Supabase-Call

Demo-Modus-Check in API-Route (server-side):
  const isDemo = req.cookies.get('pk_demo')?.value === '1'
```

---

## 9. KI-Aktions-Ausführungs-Flow

```
KI-Antwort enthält action { type: "umlagerung", artikel, von, nach, menge }
         │
         ▼
User sieht Aktionskarte mit "Umlagerung ausführen →"
         │
    Klick
         ▼
confirmAction gesetzt → Inline-Confirm erscheint:
  "Wirklich ausführen?" [✓ Ja] [Abbrechen]
         │
    User klickt "Ja"
         │
         ▼
executeUmlagerung(action):
  Demo?
  ├─ Ja  → 900ms delay → Toast "Demo: simuliert"
  └─ Nein →
      1. getLagerStellplaetze() → findet SP mit code === action.nach → UUID
      2. getLagerStellplatzBestand() → findet Zeile mit artikelname + code=action.von → vonBestandId
      3. umlagerArtikel({ vonBestandId, nachStellplatzId, menge, grund: 'KI-Vorschlag' })
         ├─ Fehler → Toast (rot) mit Fehlermeldung
         └─ Erfolg → Toast (grün) "erfolgreich ausgeführt"
```

---

## 10. Mobile / PWA

```
app/layout.tsx → Viewport: device-width, maximumScale:1, viewportFit:cover, themeColor:#05070b
public/manifest.json → name:"Petersen KI Betriebssteuerung", display:"standalone"

iOS-Fixes (globals.css):
  .pk-input { font-size: 16px !important }   → kein Auto-Zoom
  .pk-btn   { min-height: 44px }             → Touch-Target
  padding: env(safe-area-inset-*)            → Notch/Home-Indicator
  height:  100dvh                            → iOS Safari Viewport-Fix
  -webkit-overflow-scrolling: touch          → .pk-table-wrap

CSS-Klassen für Mobile:
  .bottom-nav / .bottom-nav-item / .pk-tab-bar / .stats-grid / .mobile-1col
```

---

## 11. Externe Dienste & Umgebungsvariablen

```
NEXT_PUBLIC_SUPABASE_URL        → Supabase PostgreSQL + Auth + Storage
NEXT_PUBLIC_SUPABASE_ANON_KEY   → Supabase Anon-Key (RLS)
ANTHROPIC_API_KEY               → Claude Sonnet (claude-sonnet-4-20250514)
                                   → /api/chat/route.ts
                                   → Ohne Key: simulierte Antworten
```

---

## 12. Offene Punkte (priorisiert)

### 🔴 Kritisch — Supabase-SQL noch ausführen
| # | SQL-Schritt |
|---|------------|
| 1 | Neue Lager-Tabellen: `lager_stellplaetze`, `lager_stellplatz_bestand`, `lager_umlagerungen` |
| 2 | Einkauf-Tabellen: `einkauf_lieferanten`, `einkauf_bestellungen`, `einkauf_wareneingaenge` |
| 3 | `ALTER TABLE lager_artikel ADD COLUMN IF NOT EXISTS mindestbestand integer default 0` |

### 🟡 KI-Features — Nächste Priorität
| # | Aufgabe | Datei |
|---|---------|-------|
| 1 | **Supabase SSR-Auth in API-Route**: `createServerClient` mit Cookie-Forwarding → Live-Nutzer bekommen echte Lagerdaten im KI-Chat | `lib/supabase.ts`, `app/api/chat/route.ts` |
| 2 | **KI-Aktion "Bestellung" ausführbar** (analog zu Umlagerung — derzeit nur Anzeige) | `app/dashboard/ki-erkennung/page.tsx`, `app/dashboard/lager/page.tsx` |
| 3 | **KI-Aktion "Hinweis"** — Link zum relevanten Tab + Artikel-Filter vorausfüllen | beide KI-Chat-Seiten |

### 🟡 Feature-Vervollständigung
| # | Aufgabe | Datei | Aufwand |
|---|---------|-------|---------|
| 4 | **EinkaufTab** auf echte Supabase-Calls umstellen | `app/dashboard/buero/page.tsx` | klein (DB-Funktionen fertig) |
| 5 | **MarketingPilot**: Edit + Delete implementieren | `app/dashboard/marketing/page.tsx` | mittel |
| 6 | **AnalysePilot**: echte Supabase-Daten statt Demo-Charts | `app/dashboard/analyse/page.tsx` | mittel |
| 7 | **Rollen-basierte Sidebar-Filterung** (ROLE_PILOTS in roles.ts bereits definiert) | `components/Sidebar.tsx` | klein |

### 🟢 Langfristig
| # | Aufgabe |
|---|---------|
| 8 | Stripe Integration (Abo/Bezahlung) |
| 9 | E-Mail-Benachrichtigungen bei Mindestbestand (aktuell nur simuliert) |
| 10 | Benutzer-Verwaltung für Admin (Rollen an andere User vergeben) |
| 11 | PDF-Vorlagen: Firmenlogo + echte Adressdaten einbinden |
| 12 | Push-Benachrichtigungen (PWA Service Worker) |
| 13 | Offline-Modus (Service Worker + Cache) |
| 14 | Multi-Mandanten (mehrere Betriebe pro Account) |

---

## 13. Wichtige Architektur-Entscheidungen & Bekannte Eigenheiten

| Thema | Entscheidung | Grund |
|-------|-------------|-------|
| `lager_stellplaetze` PK | UUID (nicht text wie andere Tabellen) | Supabase-Standard für neue Tabellen |
| Demo-Detection in API-Route | `req.cookies.get('pk_demo')` | `hasDemoCookie()` ist browser-only |
| IIFE-Pattern in Tabs | `{tab === 'x' && (() => { ... })()}` | Lokale Funktionen + Berechnungen ohne Extra-Komponente |
| Kein `confirm()` | Immer Inline-Bestätigung | Browser-`confirm()` blockiert UI, nicht anpassbar |
| `Promise.allSettled` im Dashboard | Graceful degradation | Teilfehler sollen nicht die ganze Seite brechen |
| EinkaufTab Demo-State | DB-Funktionen fertig, UI noch nicht verdrahtet | Schrittweise Migration |
| KI-Aktions-Ausführung | 2-Klick (Anzeigen → Bestätigen → Ausführen) | Keine stillen Hintergrundänderungen |
| `buildContextBlock` | Vorberechnete Problem-Analyse im Prompt | KI muss nicht selbst rechnen → genauere Antworten |
