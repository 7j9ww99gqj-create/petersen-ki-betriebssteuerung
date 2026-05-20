# Petersen KI Betriebssteuerung

## Projektübersicht
KI-gestütztes Warenwirtschaftssystem als produktive SaaS-WebApp.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · App Router  
**Live:** https://petersen-ki-betriebssteuerung.vercel.app · https://app.petersen-ki-pilot.de  
**Repo:** https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung

---

## 🎨 Design-System — Master-Übersicht

Alles Design-Bezogene ist nach Verantwortung getrennt. Diese Tabelle ist die **Single Source of Truth** — bei Design-Themen hier zuerst nachschlagen.

| Bereich | Datei / Pfad | Verantwortlichkeit |
|---------|--------------|---------------------|
| **🎨 Piloten-Farben** | `lib/pilot-colors.ts` | Zentrale Farb-Palette für alle Piloten (Lager=Blau, Büro=Cyan, Werkstatt=Lila, Marketing=Orange, Analyse=Grün, Planung=Pink, KI=Lila-light, Steuer=Gold, QM=Teal). Mit Helpers `pilotTabStyle()` + `pilotHeaderIconStyle()` |
| **🛠 User-Personalisierung** | `lib/design-flag.ts` | 6 ein-/ausschaltbare Module: `notifications` · `typography` · `effects` · `colors` · `icons` · `layout`. Plus DP1: Theme + Akzent + Glow + 7 Features. APIs: `useDesignPrefs()`, `patchDesignPrefs()`, `writeDesignPrefs()`, `DEFAULT_PREFS` |
| **☁️ Multi-Device-Sync** | `lib/design-sync.ts` | Opt-in Cloud-Sync via Supabase. `isCloudSyncEnabled()`, `pullPrefsFromCloud()`, `pushPrefsToCloud()`, `useCloudDesignSync()`-Hook (eingebaut in dashboard/layout.tsx) |
| **🔔 Toast-Sounds** | `lib/toast-sound.ts` | WebAudio-Beep für success/error/info. `playToastSound(type)` |
| **🖼 Brand-Logo** | `components/brand/Logo.tsx` | `<Logo variant="mark" />` lädt `/public/logo.png` (Hexagon-PNG), `wordmark`-Variante als SVG-Text |
| **📐 Design-Customization-UI** | `components/einstellungen/DesignCustomizationPanel.tsx` | 6-Tab-Panel (Allgemein/Benachrichtigungen/Typografie/Effekte/Farben/Icons & Layout). Mobile: `<select>`-Dropdown, Desktop: Pill-Grid. Mit Cloud-Sync-Toggle + Live-Demo-Buttons |
| **🍞 Toast-System (global)** | `components/AppToast.tsx` | Globaler Toast-Container in `app/dashboard/layout.tsx`. Event-API `pushAppToast(msg, type)`. Auto-Dismiss, Sound, Stapelung |
| **🍞 Toast-Komponenten** | `components/ui/Toast.tsx` + `ToastProvider.tsx` | Atomic `<Toast>` + Context-Hook `useGlobalToast()`. Beide nutzen `.pk-toast`-Klasse |
| **🎨 Global Stylesheet** | `app/globals.css` | CSS-Variablen (`--bg`, `--blue`, ...), 3 Themes (`data-design="modern\|glow"`), 7 Features (`data-feat-*`), DP12-Module (`body[data-pers-*]`), Toast-Position/Animation, Mobile-Härtung |
| **💾 Cloud-Storage** | `supabase/migrations/20260523100000_user_design_prefs.sql` | Tabelle `user_design_prefs` (user_id PK + prefs JSONB + updated_at, RLS) |
| **📜 Migration-Doku** | DP1–DP12-Phase2 in dieser Datei (siehe „DP12 — Personalisierungs-Module") | Vollständige Historie der Design-Entwicklung |

**UI-Klassen-Bibliothek (globals.css):** `.pk-card` · `.pk-btn` · `.pk-btn-ghost` · `.pk-input` · `.pk-table` · `.pk-tab-bar` · `.pk-toast` · `.badge` · `.fade-in` · `.stats-grid` · `.bottom-nav`

**User-Settings-Pfad:** Einstellungen → **🎨 Design** (eigener Menüpunkt seit `31f924a`)

---

## 👑 Spezial-Accounts (Inhaber & Pondruff)

### Inhaber-Account — `info@petersen-ki-pilot.de`

| Bereich | Pfad |
|---------|------|
| E-Mail-Konstante | `lib/roles.ts` → `INHABER_EMAIL` |
| Zugriffs-Logik | `lib/access.ts` → `getAccessProfile()` (`isInhaber`-Check) |
| UI-Panels (7 Stück) | `components/billing/Owner*.tsx` (`OwnerCustomerControlPanel`, `OwnerMrrPanel`, `OwnerAiControlPanel`, `OwnerOpenAiCostsPanel`, `OwnerPondruffFeaturesPanel`, `OwnerAuditLogPanel`) |
| API | `app/api/owner/` |
| Einstellungen-Tabs (nur Inhaber sieht) | `Kundensteuerung` · `Offene Registrierungen` · `Kunden eingerichtet` · `Aktivitätslog` |
| Supabase-Tabellen | `billing_subscriptions`, `billing_entities`, `owner_billing_controls`, `owner_notifications_inbox`, `owner_ai_feature_toggles`, `owner_audit_log`, `stripe_owner_source` |

### Pondruff-Modul — `info@pondruffpolierservice.de`

> **Master-Doku:** `PONDRUFF.md` ist der Einstiegspunkt für alle Pondruff-Themen. Bei Pondruff-Arbeit zuerst diese Datei lesen.

| Bereich | Pfad |
|---------|------|
| Account-Konstanten | `lib/pondruff.ts` → `POND_USER_EMAIL`, `POND_USER_ID` |
| Gate-Helper | `lib/pondruff.ts` → `isPondruffUser(email)` |
| Libs | `lib/pondruff.ts`, `lib/pondruff-ocr.ts`, `lib/pondruff-pdf.ts`, `lib/pondruff-server.ts` |
| Preis-Config | `lib/pondruff-price-config.json` (Single Source of Truth) |
| UI | `app/dashboard/pondruff/` + `components/pondruff/` |
| API | `app/api/pondruff/` + `app/api/owner/pondruff-flags/` |
| Owner-Panel | `components/billing/OwnerPondruffFeaturesPanel.tsx` |
| Feature-Flags | `ocr_wareneingang` · `ocr_preisrechner` · `ki_bauteilsuche` · `wiso_sync` |
| Assets | `public/pondruff/` |
| Tests | `tests/pondruff-price.test.ts` |
| Supabase-Tabellen | `pondruff_module`, `pondruff_auftrag_rechnung`, `pondruff_bauteile_sync`, `pondruff_embeddings`, `pondruff_feature_flags`, `pondruff_price_config`, `pondruff_we_*` |

**Wichtig:** Pondruff-User sieht in der Bottom-Nav statt Werkstatt/Steuer/KI nur das **runde Pondruff-Logo**. Alle Pondruff-UI-Elemente und API-Routes prüfen `isPondruffUser()` — andere Nutzer sehen nichts.

---

## ⚙️ Workflow & Automation

### Automatische Hooks (in `.claude/settings.json`)

| Hook | Trigger | Was passiert |
|------|---------|--------------|
| `PreToolUse` (Bash `git push*`) | Vor jedem Push | TS-Check (`npx tsc --noEmit`) — Push blockiert bei Fehler |
| `PostToolUse` (Edit/Write/MultiEdit) | Nach jeder Datei-Änderung | TS-Check im Hintergrund — Warnung bei Fehler |
| `Stop` (Session-Ende) | Wenn Agent fertig | `.claude/auto-commit.sh` läuft → committet + pusht alle Änderungen, wenn TS grün |

**Auto-Commit-Logik (`.claude/auto-commit.sh`):**
- Committet nur, wenn Änderungen vorhanden
- Stagt **nur tracked Files** (`git add -u`) — kein neuer Müll
- TS muss grün sein, sonst Skip mit Warnung
- Auto-Push wenn ungepushte Commits da
- Schlägt **nie** den Chat ab (exit 0 bei Fehler)

### Slash-Commands (in `.claude/commands/`)

| Command | Was |
|---------|-----|
| `/status` | HEAD + letzte Commits + ungepusht + offene Tasks (kompakt, < 200 Wörter) |
| `/sprint <Aufgaben>` | Mehrere Aufgaben autonom abarbeiten: Implementieren → TS-Check → Commit → Push pro Task |
| `/deploy` | Vercel-Build-Status + Live-URL-Check |

### Dokumentations-Struktur (für Token-sparende Onboarding)

| Datei | Größe | Wird automatisch geladen? | Verantwortlich für |
|-------|-------|---------------------------|---------------------|
| `CLAUDE.md` (diese Datei) | ~8 KB | ✅ Claude Code automatisch | Regeln, UI-Patterns, Design-System, DB-Schema |
| `PROJECT_STATUS.md` | ~5 KB | ⚠️ Nur bei Statusfrage | HEAD + letzte 3 Iterationen + offene Tasks |
| `PROJECT_STATUS_ARCHIVE.md` | 197 KB | ❌ Niemals beim Onboarding | Vollständige Historie (nur bei expliziter Frage) |
| `AGENTS.md` | ~3 KB | ⚠️ Nur bei expliziter Anfrage | Multi-Tool-Spec (Codex/Cursor) |
| Memory `project_petersen_ki.md` | ~2 KB | ✅ Claude Code automatisch | Cross-Session-Pointer auf CLAUDE.md/PROJECT_STATUS.md |

**Token-Budget beim Onboarding:** ~10k (statt vorher ~70k).

---

### Aktueller Zwischenstand (2026-05-20)
- **Design-Panel als eigener Menüpunkt + Mobile-Select** (`31f924a`): `DesignCustomizationPanel` aus dem Benachrichtigungen-Tab herausgelöst und unter neuen Menüpunkt `🎨 Design` (`section = 'design'`) verlegt. Tab-Navigation im Panel ist jetzt auf Mobile ein natives `<select>`-Dropdown (≤640px) statt horizontal-scrollender Pills — kein Overflow-Bug mehr. Desktop bleibt Pill-Grid mit `auto-fit minmax(140px, 1fr)`.
- **UI-Fixes — Mobile, Logo, Piloten-Farben** (`79913d9`): (1) Mobile-Bug Einstellungen → Benachrichtigungen behoben (overflow + responsive padding). (2) Logo-Upload in Firmendaten repariert — `next.config.js` `remotePatterns` für Supabase-Storage + nativer `<img>`-Fallback mit Initialen. (3) `components/brand/Logo.tsx` mark-Variante nutzt jetzt `/public/logo.png` (echtes Hexagon-Logo). (4) `lib/pilot-colors.ts`: zentrale Pilot-Farbpalette. Jeder Pilot-Header hat farbigen Namen (`<span style={{color}}>Lager</span>Pilot`) + Glow-Box. Marketing auf `#f97316`, Steuer auf `#fbbf24` umgestellt.
- **DP12-Phase2 — Toast-Unifikation + Cloud-Sync** (`bb57741`): Alle Piloten-Toasts (Lager/Werkstatt/QM/Büro/Steuer) auf `.pk-toast` umgestellt → Position/Animation/Dauer/Größe folgen jetzt den User-Prefs. Neue `components/AppToast.tsx` mit Event-API `pushAppToast(msg, type)`. WebAudio-Beep über `lib/toast-sound.ts` (Sound für success/error/info). Demo-Buttons im Benachrichtigungen-Tab. Cloud-Sync via `user_design_prefs` (RLS, Opt-in) — `lib/design-sync.ts`.
- **DP12 — Design-Personalisierung ausgebaut** (`019efae`): 6 neue Module im Einstellungen-Tab „Benachrichtigungen" mit Master-Toggle pro Modul. Bei deaktiviertem Modul bleibt der aktuelle Look 1:1 erhalten. Tab-Layout (`Allgemein / Benachrichtigungen / Typografie / Effekte / Farben / Icons & Layout`). „↺ Alles zurücksetzen" setzt alle Module wieder auf disabled. CSS-Regeln rein additiv (`body[data-pers-*="on"]`), brechen nichts Bestehendes.
- Büro-/Einkaufsrelationen wurden weiter abgesichert: `kunde_id` und `lieferant_id` laufen jetzt in `lib/db.ts`, Schema und Büro-UI konsistenter mit.
- Büro-Detailseiten existieren jetzt unter `app/dashboard/buero/[entity]/[id]/page.tsx` für Kunden, Angebote, Aufträge, Rechnungen, Eingangsrechnungen, Dokumente, Lieferanten und Bestellungen.
- `app/api/chat/route.ts` und `app/api/document-ai/route.ts` sind serverseitig über `lib/server-auth.ts` gehärtet; Dokument-KI erlaubt jetzt auch die im UI sichtbaren Rollen `Werkstatt` und `Lager`.
- Archiv ist live angebunden und durchsucht jetzt `buero_dokumente` plus `steuer_belege`; Legacy-Dokumentpfade werden beim Öffnen berücksichtigt.
- Cloud & Sync zeigt keine Fantasiewerte mehr, sondern echte Live-Kennzahlen, eine ehrliche Backup-Historie aus Modulaktivität und eine einfache Sitzungs-/Geräteübersicht.
- Letzte relevante Commits auf `main`: `8e8183d` (Cloud-Modul an Live-Daten), `ecc1f62` (Cloud + globale Archivsuche).
- MarketingPilot hat jetzt zusätzlich eine klickbare `KI-Suite` mit sichtbaren Modulen wie Autopilot-Marketing, SEO-/Keywords-Analyse, KI-Vertriebsassistent, Content-Erstellung, Funnel-Builder, Branchen-Templates und weiteren Marketing-KI-Bausteinen.

---

## Schnellstart

```bash
npm install
cp .env.example .env.local
# ANTHROPIC_API_KEY in .env.local eintragen (optional)
npm run dev
# → http://localhost:3000
```

---

## Auth

- Login mit Supabase-Zugangsdaten (echte User)
- Demo-Zugang: `demo@petersen-ki-pilot.de` / `Demo1234!` → setzt Cookie `pk_demo=1`
- Demo-Modus: `hasDemoCookie()` aus `lib/auth.ts` – alle Piloten prüfen das zuerst
- Demo zeigt statische Daten, KEIN Supabase-Zugriff
- Login-Seite hat **keinen** Demo-Button mehr (Demo nur über manuelle Eingabe)
- Auth-Guard in `app/dashboard/layout.tsx`

---

## Datenbank (Supabase)

- **`lib/db.ts`** – Zentrale Datenschicht für alle Piloten
- **`supabase/schema.sql`** – Vollständiges Schema mit RLS
- Alle Tabellen haben `user_id uuid references auth.users default auth.uid()`
- RLS: jeder User sieht nur seine eigenen Daten
- Storage-Bucket: `dokumente` (Upload/Select/Delete Policies)
- **WICHTIG:** Schema muss manuell im Supabase SQL-Editor ausgeführt werden

### Tabellen-Übersicht
| Pilot | Tabellen |
|-------|---------|
| Lager | `lager_artikel` (+ `mindestbestand` Spalte!), `lager_bewegungen`, `lager_stellplaetze`*, `lager_stellplatz_bestand`*, `lager_umlagerungen`* |
| Büro | `buero_kunden`, `buero_angebote`, `buero_auftraege`, `buero_rechnungen`, `buero_dokumente` |
| Einkauf | `einkauf_lieferanten`⚠️, `einkauf_bestellungen`⚠️, `einkauf_wareneingaenge`⚠️ |
| Werkstatt | `werkstatt_karten`, `werkstatt_zeitbuchungen`, `werkstatt_material`, `werkstatt_pruefprotokolle` |
| Marketing | `marketing_kampagnen`, `marketing_leads`, `marketing_newsletter` |
| Planung | `planung_projekte`, `planung_aufgaben`, `planung_termine`, `planung_ressourcen` |
| Design-Sync | `user_design_prefs` (DP12-Phase2: user_id PK, prefs JSONB, updated_at) |

*) Neue Lager-Tabellen — im Supabase SQL-Editor ausführen!  
⚠️) Neue Einkauf-Tabellen — im Supabase SQL-Editor ausführen!

### DB-Funktionen in `lib/db.ts` — Lager-Stellplätze (NEU)
```ts
getLagerStellplaetze()
upsertLagerStellplatz(s: { id, code, name?, bereich?, zone?, gang?, regal?, ebene?, fach?,
  typ?, warengruppe?, warenobergruppe?, temperaturzone?, max_gewicht?, max_volumen?, aktiv?, notiz? })
deleteLagerStellplatz(id: string)
getLagerStellplatzBestand()    // joined mit lager_stellplaetze(code, bereich, ...)
upsertLagerStellplatzBestand(b: { id, stellplatz_id, artikelnummer?, artikelname?, charge?,
  mhd?, menge, einheit?, status?, eingelagert_am?, notiz? })
deleteLagerStellplatzBestand(id: string)
getLagerUmlagerungen()
insertLagerUmlagerung(u: { id, artikel_id?, artikelname?, von_stellplatz_id?,
  nach_stellplatz_id?, menge, grund?, datum?, notiz? })
umlagerArtikel({ vonBestandId, nachStellplatzId, menge, charge?, mhd?, grund?,
  notiz?, artikelname?, artikelnummer?, artikelId?, vonStellplatzId? })
// → 4-Schritt Transaktion: Quelle reduzieren → Ziel erhöhen/erstellen → Umlagerung loggen
```

### DB-Funktionen — Einkauf
```ts
getEinkaufLieferanten()
upsertEinkaufLieferant(l: { id?, name, kategorie, ansprechpartner, email, telefon, zahlungsziel, bewertung, notiz })
deleteEinkaufLieferant(id: string)
getEinkaufBestellungen()
upsertEinkaufBestellung(b: { id?, lieferant_id, status, artikel, menge, einzelpreis, gesamtpreis, bestelldatum, lieferdatum_soll, notiz })
getEinkaufWareneingaenge()
insertEinkaufWareneingang(w: { bestellung_id, eingangsdatum, menge_bestellt, menge_erhalten, qualitaet, notiz })
```

---

## Piloten – Aktueller Stand

| Pilot | Route | Status | Tabs |
|-------|-------|--------|------|
| LagerPilot | `/dashboard/lager` | ✅ Vollständig | 12 Tabs (siehe unten) |
| BüroPilot | `/dashboard/buero` | ✅ Vollständig | kunden/angebote/auftraege/rechnungen/dokumente/einkauf |
| WerkstattPilot | `/dashboard/werkstatt` | ✅ Vollständig | Karten/Zeit/Material/Prüfprotokoll |
| MarketingPilot | `/dashboard/marketing` | ⚠️ Teilweise | Create OK, Edit/Delete fehlt; KI-Suite sichtbar und klickbar, aber noch ohne echte KI-Logik |
| AnalysePilot | `/dashboard/analyse` | ✅ Live-Daten | Charts aus Supabase; Demo-Fallback via hasDemoCookie() |
| PlanungPilot | `/dashboard/planung` | ✅ Vollständig | Projekte/Aufgaben/Kalender/Ressourcen |
| KI-Assistent | `/dashboard/ki-erkennung` | ✅ Vollständig | Tagesbrief/Erkennung/Chat + Aktions-Ausführung |
| Cloud & Sync | `/dashboard/cloud` | ✅ Live-Basis | echte Kennzahlen, Aktivität, Storage, ehrliche Geräte-/Backup-Übersicht |
| Archiv | `/dashboard/archiv` | ✅ Live-Basis | globales Archiv für Büro-Dokumente + Steuerbelege |
| Einstellungen | `/dashboard/einstellungen` | ✅ Vollständig | Profil/Firmendaten/Billing/Postfach/Benachrichtigungen/**Design**/Rollen/Info |

### LagerPilot — Alle Tabs
```ts
type LagerTab =
  | 'tagesbericht'    // 🧠 KI-Tagesbericht (NEU)
  | 'bestand'         // 📦 Artikelbestand CRUD
  | 'bewegungen'      // 🔄 Lagerbewegungen read-only
  | 'eingang'         // 📥 Wareneingang + getBestStellplatz-Vorschlag
  | 'ausgang'         // 📤 Warenausgang
  | 'inventur'        // 📋 Inventurliste
  | 'bestellung'      // 🛒 Bestellvorschlag-Modal
  | 'historie'        // 📈 Artikel-Bewegungshistorie
  | 'stellplaetze'    // 📍 Stellplatz-CRUD + KPIs + Optimierungsvorschläge
  | 'lagerbelegung'   // 📊 Stellplatz-Bestand + MHD-Filter
  | 'umlagerung'      // ↔️ Umlagerungs-Formular + Protokoll
  | 'kommissionierung'// 🧺 Artikel-Auswahl + Pickliste (route-optimiert)
```

**Stellplaetze-Tab Features:**
- CRUD mit Modal (Code, Bereich, Zone, Gang, Regal, Ebene, Fach, Typ, Warengruppe, Temperaturzone, Max-Gewicht/-Volumen)
- 5 KPI-Karten: Gesamt / Aktiv / Überlastet / MHD-kritisch / Frei
- Warn-Banner bei kritischen Zuständen
- 4 Optimierungsvorschläge (regelbasiert): überlastete SP / MHD-kritische Chargen / Sperr-Typ-Artikel / freie Kapazität
- Inline-Delete (kein `confirm()`)

**Lagerbelegung-Tab Features:**
- Alle Positionen aus lager_stellplatz_bestand
- Filter: Bereich / MHD-kritisch / Suche
- MHD-Status-Badge (abgelaufen/kritisch/ok/kein) via `mhdStatus()`
- Inline-Delete

**Umlagerungs-Tab Features:**
- Formular: Quell-Position auswählen (Dropdown aus Bestand), Ziel-Stellplatz, Menge, Grund (Select), Notiz
- Validierung: Pflichtfelder + Menge ≤ verfügbarer Menge + Quelle ≠ Ziel
- Demo: lokaler State; Live: `umlagerArtikel()` → 4-Schritt Transaktion
- Protokoll-Tabelle darunter

**Kommissionierungs-Tab Features:**
- Artikel mit Bestand > 0, sortiert nach Lagerplatz
- Checkbox-Auswahl je Artikel + "Alle auswählen" im Tabellenkopf
- Zeilenklick = Toggle-Auswahl
- "🧺 Pickliste (N)"-Button: öffnet/schließt Pickliste
- Pickliste sortiert nach: Bereich → Regal → Fach (parsed aus "A-01-03")
- Gruppiert nach Bereichen mit Laufnummern
- "Auswahl zurücksetzen"-Button

**KI-Tagesbericht-Tab Features (NEU):**
- 4 KPI-Karten (lokal berechnet, ohne KI): MHD kritisch/abgelaufen, Unter Mindestbestand, Überlastete Stellplätze, Artikel gesamt
- "✨ Tagesbericht erstellen"-Button → /api/chat mit structuredOutput
- KI-Antwort mit kategorisierten Problemen: 🔴 Dringend / ⚠️ Wichtig / 📦 Info
- KI-Aktions-Vorschläge mit Inline-Bestätigung + Ausführung
- "💬 KI fragt selbst nach"-Buttons (aus Echtdaten generiert)
- Detailliste aller kritischen Artikel

### KI-Assistent — Chat mit Aktionen
```
app/dashboard/ki-erkennung/page.tsx
  ├── Tab: Tagesbrief    allgemeiner Brief (Aufgaben/Rechnungen/Karten/Artikel)
  ├── Tab: Erkennung     OCR-Simulation
  └── Tab: Chat
        ├── KiAction-Typ: { type, artikel, von, nach, menge, beschreibung }
        ├── structuredOutput: true → JSON-Antwort mit message + actions
        ├── Aktionskarten: 📦 Umlagerung (blau) / 🛒 Bestellung (orange) / 💡 Hinweis (lila)
        └── Inline-Bestätigung → executeUmlagerung() → codes→UUIDs→umlagerArtikel()
```

---

## KI-Integration (`app/api/chat/route.ts`)

### Request-Format
```ts
POST /api/chat
{
  messages: { role: 'user'|'assistant', content: string }[]
  system?: string          // überschreibt System-Prompt teilweise
  context?: string         // wird vor Lagerdaten eingefügt
  structuredOutput?: boolean  // true → JSON-Antwort mit probleme + actions
}
```

### Response-Format (structuredOutput: false)
```ts
{ reply: string }
```

### Response-Format (structuredOutput: true)
```ts
{
  reply: string                                    // parsed aus JSON.message
  probleme: { level: 'dringend'|'wichtig'|'info', text: string }[]
  actions: {
    type: 'umlagerung'|'bestellung'|'hinweis'
    artikel?: string
    von?: string         // Stellplatz-Code (für Umlagerung)
    nach?: string        // Stellplatz-Code (für Umlagerung)
    menge?: number
    beschreibung?: string
  }[]
}
```

### Daten-Loading in route.ts
- `pk_demo` Cookie aus Request → Demo: statische `DEMO_CONTEXT`-Daten
- Live: serverseitiger Supabase-Zugriff über `lib/server-auth.ts` + Session-Cookies
- Lagerdaten werden in der Route direkt über den Server-Client geladen; die frühere Browser-Client-/RLS-Leerfall-Einschränkung ist für `/api/chat` damit behoben

### buildContextBlock — Was im Prompt steht
```
=== AKTUELLE LAGERDATEN (DD.MM.YYYY) ===
ARTIKELBESTAND (N Artikel):
- Name [ID]: X Einheit | Lagerplatz: ... | Mindest: N | Status: ok/niedrig/leer

=== VORBERECHNETE PROBLEM-ANALYSE ===
🔴 DRINGEND: MHD ABGELAUFEN: ... / BESTAND LEER: ...
⚠️ WICHTIG:  MHD KRITISCH: ... / BESTAND NIEDRIG: ...
📦 INFO:     ÜBERLASTET: SP mit ≥3 Positionen / VERTEILT: Artikel auf ≥2 Stellplätzen

STELLPLÄTZE: code | Bereich | Typ
LETZTE UMLAGERUNGEN: datum: Artikel (menge) von → nach [grund]
```

---

## Mobile / PWA Optimierungen

### Viewport & PWA (app/layout.tsx)
```tsx
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: 'cover', themeColor: '#05070b',
}
```

### Bottom Navigation (app/dashboard/layout.tsx)
```tsx
const bottomNavItems = [
  { href: '/dashboard',              icon: '⊞',  label: 'Start' },
  { href: '/dashboard/lager',        icon: '📦', label: 'Lager' },
  { href: '/dashboard/buero',        icon: '🧾', label: 'Büro' },
  { href: '/dashboard/werkstatt',    icon: '🛠️', label: 'Werkstatt' },
  { href: '/dashboard/ki-erkennung', icon: '🧠', label: 'KI' },
  { href: '#menu',                   icon: '☰',  label: 'Menü' },
]
```

### iOS-Fixes
- `font-size: 16px !important` auf `.pk-input` (verhindert Auto-Zoom)
- `min-height: 44px` auf `.pk-btn`, `.pk-btn-ghost`
- `env(safe-area-inset-*)` für Notch/Home-Indicator
- `100dvh` statt `100vh`
- `-webkit-overflow-scrolling: touch` auf `.pk-table-wrap`

---

## Gemeinsame UI-Patterns (IMMER so umsetzen)

### Modal
```tsx
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.65)',
      backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
      justifyContent:'center', padding:16 }} onClick={onClose}>
      <div className="pk-card fade-in"
        style={{ width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{margin:0, fontSize:16, fontWeight:800}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#aeb9c8', fontSize:20, cursor:'pointer'}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

### Toast (fixed bottom-right)
```tsx
// In Lager-Seite: showToast(msg, ok=true) — nutzt { msg, ok } State
// In KI-Erkennung: actionToast { msg, type: 'success'|'error' }
<div style={{
  position:'fixed', bottom:90, right:24, zIndex:9999,
  padding:'14px 20px', borderRadius:12, maxWidth:380,
  background: isErr ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
  border: `1px solid ${isErr ? 'rgba(255,80,80,.4)' : 'rgba(37,211,102,.35)'}`,
  color: isErr ? '#ff8080' : '#4ddb7e',
  fontSize:14, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.4)',
}}>{msg}</div>
```

### Inline Delete (kein Browser confirm()!)
```tsx
{deleteConfirm === item.id ? (
  <>
    <button onClick={() => handleDelete(item.id)} style={{...rot...}}>Ja, löschen</button>
    <button onClick={() => setDeleteConfirm(null)} style={{...grau...}}>Abbrechen</button>
  </>
) : (
  <button onClick={() => setDeleteConfirm(item.id)}>🗑️</button>
)}
```

### Inline Bestätigung für KI-Aktionen
```tsx
{isConfirming ? (
  <div style={{ display:'flex', gap:8 }}>
    <span>Wirklich ausführen?</span>
    <button onClick={() => executeAktion(aktion)} disabled={isRunning}>
      {isRunning ? '⏳ Läuft…' : '✓ Ja, ausführen'}
    </button>
    <button onClick={() => setConfirm(null)}>Abbrechen</button>
  </div>
) : (
  <button onClick={() => setConfirm(idx)}>Umlagerung ausführen →</button>
)}
```

### IIFE-Pattern für komplexe Tabs
```tsx
{tab === 'stellplaetze' && (() => {
  // lokale Berechnungen, Hilfsfunktionen, async functions
  const filtered = stellplaetze.filter(...)
  async function handleSave() { ... }
  return ( <div>...</div> )
})()}
```

### ID-Generierung
```ts
// Demo-Modus:
`SP-${Date.now().toString(36).toUpperCase()}`   // Stellplatz
`SB-${Date.now().toString(36).toUpperCase()}`   // Stellplatz-Bestand
// Live-Modus: crypto.randomUUID() für UUIDs (lager_stellplaetze PK ist uuid)
```

### mhdStatus-Funktion (lager/page.tsx)
```ts
function mhdStatus(mhd: string | undefined): 'abgelaufen' | 'kritisch' | 'ok' | 'kein' {
  if (!mhd) return 'kein'
  const diff = (new Date(mhd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'abgelaufen'
  if (diff < 30) return 'kritisch'
  return 'ok'
}
```

### getBestStellplatz (lager/page.tsx — Wareneingang-Tab)
```ts
// Scoring: warengruppe-Match +3, warenobergruppe-Match +2, lagerplatz-Prefix +1, freier SP +2, Kühl-Typ +2
// Gibt höchsten Score zurück, Fallback auf ersten aktiven SP
function getBestStellplatz(a: Artikel | undefined): { stellplatz, score, grund[] } | null
```

---

## Design-System (globals.css)

CSS-Variablen:
- `--bg: #05070b` · `--panel: #0b1420` · `--card: #101a28`
- `--blue: #1684ff` · `--blue2: #20c8ff`
- `--text: #f8fbff` · `--muted: #aeb9c8`

CSS-Klassen:
- `.pk-card` – Standard-Karte
- `.pk-btn` – Primär-Button (Blau, min-height 44px)
- `.pk-btn-ghost` – Sekundär-Button (min-height 44px)
- `.pk-input` – Input-Feld (font-size 16px auf Mobile → kein iOS-Zoom)
- `.pk-table` – Tabellen-Stil
- `.pk-table-wrap` – Scroll-Container mit `-webkit-overflow-scrolling: touch`
- `.badge .badge-green/blue/orange/gray/red/purple` – Status-Badges
- `.fade-in` / `.fade-in-scale` – Animationen
- `.pk-tab-bar` – Horizontaler Tab-Container (scroll ohne Scrollbar)
- `.bottom-nav` – Bottom Navigation Bar (nur Mobile ≤768px)
- `.stats-grid` – Responsive KPI-Grid (1–4 Spalten)
- `.mobile-1col` – Erzwingt 1-Spalten-Layout auf Mobile
- `.support-btn-wrap` – SupportButton-Wrapper (über Bottom-Nav)
- `.hide-xs` – Versteckt Element auf sehr kleinen Screens

### Piloten-Farben (zentral in `lib/pilot-colors.ts`)
| Pilot | Farbe | Hex | Akzent |
|-------|-------|-----|--------|
| LagerPilot | Blau | `#1684ff` | `#20c8ff` |
| BüroPilot | Cyan | `#20c8ff` | `#67e8f9` |
| WerkstattPilot | Violett | `#a78bfa` | `#c4b5fd` |
| MarketingPilot | Orange | `#f97316` | `#fb923c` |
| AnalysePilot | Grün | `#10b981` | `#34d399` |
| PlanungPilot | Pink/Rot | `#f43f5e` | `#fb7185` |
| KI-Assistent | Lila | `#c084fc` | `#d8b4fe` |
| SteuerPilot | Gold/Gelb | `#fbbf24` | `#fcd34d` |
| QM | Teal | `#06b6d4` | `#22d3ee` |

**Pattern in jedem Pilot:**
- Header-Icon-Box: `background: c.bgSoft, border: c.border, boxShadow: c.glow`
- Header-Name: `<h1><span style={{color: c.primary}}>Lager</span>Pilot</h1>`
- Tab-Active: `borderBottom: 2px solid c.primary, color: c.primary`
- Buttons & KPIs übernehmen die Pilot-Farbe via Helper aus `lib/pilot-colors.ts`

### DP12 — Personalisierungs-Module (`lib/design-flag.ts` + `DesignCustomizationPanel.tsx`)

Jedes Modul hat einen eigenen Master-Toggle (`enabled: boolean`). Bei `enabled: false` werden **keine** CSS-Variablen / Body-Attribute gesetzt → der aktuelle Standard-Look bleibt 1:1 erhalten.

| Modul | Felder | Body-Attribute | CSS-Variablen |
|-------|--------|----------------|---------------|
| `notifications` | toastPosition, toastAnimation, toastDuration, toastSize, toastSound | `data-pers-notif`, `data-toast-pos`, `data-toast-anim`, `data-toast-size` | `--user-toast-duration` |
| `typography` | baseFontSize (12/14/16/18), headingScale, lineHeight, letterSpacing, buttonFontSize | `data-pers-typo` | `--user-font-base`, `--user-heading-scale`, `--user-line-height`, `--user-letter-spacing`, `--user-btn-font-size` |
| `effects` | animationSpeed, blurIntensity, shadowDepth, glassmorphism, scrollEffects, hoverAction | `data-pers-effects`, `data-anim-speed`, `data-blur`, `data-shadow`, `data-hover`, `data-scroll-fx`, `data-glass` | `--user-anim-speed`, `--user-blur`, `--user-shadow` |
| `colors` | primaryAccent, secondaryAccent, errorColor, successColor, backgroundColor | `data-pers-colors`, `data-bg-variant` | `--user-primary`, `--user-secondary`, `--user-error`, `--user-success`, `--user-bg` |
| `icons` | style (emoji/svg/text), size, statusIndicator | `data-pers-icons`, `data-icon-style`, `data-icon-size`, `data-status-ind` | `--user-icon-size` |
| `layout` | density (compact/comfortable/spacious) | `data-pers-layout`, `data-density` | `--user-density-padding`, `--user-density-gap` |

**APIs:**
```ts
const prefs = useDesignPrefs()        // Live-Hook, alle Module
patchDesignPrefs({ typography: { enabled: true, baseFontSize: 16 } })
writeDesignPrefs(DEFAULT_PREFS)        // Gesamtes Reset → alles disabled
```

**Reset-Logik:**
- Pro Modul: „↺ Modul zurücksetzen" → setzt nur dieses Modul auf Defaults (enabled=false)
- Global: „↺ Alles zurücksetzen" → `writeDesignPrefs(DEFAULT_PREFS)` → alle Module disabled

**CSS-Regeln (globals.css ab Ende der Datei):**
- Alle Regeln im Schema `body[data-pers-MODUL="on"]` → greifen **nur** wenn aktiviert
- Rein additiv, brechen nichts Bestehendes (Toast-Komponenten mit inline-style funktionieren weiter)
- `.pk-toast`-Klasse als optionaler Hook für neue Toast-Implementierungen

**Speicherung:** `localStorage 'pk_design_prefs'` (JSON, sanitized beim Lesen).

### DP12-Phase2 — Toast-System & Cloud-Sync (`bb57741`)

**Toast-Unifikation:**
- Alle Piloten-Toasts (Lager, Werkstatt, QM, Büro, Steuer) nutzen jetzt `<div className="pk-toast">…</div>`
- `.pk-toast`-Klasse in `globals.css` hat Default `position: fixed; bottom: 90px; right: 24px`
- Wenn `notifications.enabled = true` → Position/Animation/Größe aus `body[data-toast-*]`-Attributen
- Inline-Style für Farben (success/error/info) bleibt — nur Layout-Properties wurden entfernt

**Globale `AppToast`-Komponente:**
```tsx
import { pushAppToast } from '@/components/AppToast'
pushAppToast('Aktion erfolgreich', 'success')  // 'success' | 'error' | 'info'
```
- Komponente in `app/dashboard/layout.tsx` einmal gerendert
- Event-API: `window.dispatchEvent(new CustomEvent('pk-app-toast', { detail }))`
- Stapelt mehrere Toasts mit Offset, auto-dismiss nach `toastDuration`

**Sound-Helper (`lib/toast-sound.ts`):**
```ts
playToastSound('success')  // C5 → E5 (aufsteigend)
playToastSound('error')    // A4 → F4 (absteigend, triangle wave)
playToastSound('info')     // E5 einzeln
```
- WebAudio-API, kein Asset-Bundle nötig
- Lazy AudioContext, fail-silent

**Cloud-Sync (`lib/design-sync.ts`):**
```ts
isCloudSyncEnabled() / setCloudSyncEnabled(b)
pullPrefsFromCloud() → DesignPrefs | null
pushPrefsToCloud()   → { ok, error? }
useCloudDesignSync()  // Hook in dashboard/layout.tsx
```
- Opt-in über localStorage `pk_design_cloud_sync`
- Tabelle `user_design_prefs` (user_id PK, prefs JSONB, updated_at + Trigger, RLS)
- Demo-User: Sync wird übersprungen
- Debounce 1200ms beim Push (sammelt schnelle Pref-Changes)
- DB-Funktionen `lib/db.ts`: `getUserDesignPrefs()`, `saveUserDesignPrefs()`

---

## Lib-Dateien

| Datei | Beschreibung |
|-------|-------------|
| `lib/supabase.ts` | `createSupabaseClient()` (createBrowserClient), `isSupabaseConfigured()` |
| `lib/auth.ts` | `hasDemoCookie()`, `setDemoCookie()`, `clearDemoCookie()`, `isDemoUser()` |
| `lib/db.ts` | Alle CRUD-Funktionen für alle Piloten (inkl. neue Lager-Stellplatz-Funktionen) |
| `lib/roles.ts` | `AppRole`, `PERMISSIONS`, `useRole()`, `getRole()`, `setRole()` |
| `lib/warnings.ts` | `getAppWarnings(isDemo)` → Notification Bell |
| `lib/pdf.ts` | `generateRechnungPDF()`, `generateAngebotPDF()` via jsPDF |
| `lib/design-flag.ts` | `useDesignPrefs()`, `patchDesignPrefs()`, `writeDesignPrefs()` — alle 6 DP12-Module |
| `lib/design-sync.ts` | DP12-Phase2 Multi-Device-Sync (opt-in) — `useCloudDesignSync()`, push/pull |
| `lib/toast-sound.ts` | `playToastSound(type)` — WebAudio-Beep für success/error/info |

### Rollen-System (`lib/roles.ts`)
```ts
type AppRole = 'Admin' | 'Mitarbeiter' | 'Büro' | 'Werkstatt' | 'Lager'
PERMISSIONS.canDelete(role)  // nur Admin
PERMISSIONS.canCreate(role)  // Admin + Mitarbeiter
PERMISSIONS.canEdit(role)    // alle außer Lager
PERMISSIONS.canExport(role)  // Admin + Büro
const { role, setRole, permissions } = useRole()
```

---

## Komponenten (components/)

| Datei | Beschreibung |
|-------|-------------|
| `Sidebar.tsx` | Navigation mit allen Piloten-Links, Logo, NotificationBell, GlobalSearch |
| `NotificationBell.tsx` | Live-Warnungen (Auto-Refresh 60s), Tabs: Alle/Fehler/Warnung |
| `GlobalSearch.tsx` | ⌘K Suchmodal |
| `SupportButton.tsx` | Fixed bottom-right: WhatsApp `+4917656392975`, E-Mail, Telefon |
| `AppToast.tsx` | DP12-Phase2: globaler Toast-Container, Event-API `pushAppToast(msg, type)` |
| `ui/Toast.tsx` | Atomare Toast-Komponente (`.pk-toast` Klasse) |
| `ui/ToastProvider.tsx` | Context-basierter Toast-Hook (`useGlobalToast()`) |
| `einstellungen/DesignCustomizationPanel.tsx` | 6-Tab-Panel + Cloud-Sync-Toggle + Demo-Vorschau |

---

## Regeln

- **Demo-Modus immer prüfen**: `if (isDemo) return` vor jedem Supabase-Call
- **Bestehende Funktionalität nie entfernen**
- **Kein Browser `confirm()`** – immer Inline-Bestätigung
- **Toasts immer fixed bottom-right** (zIndex 9999, bottom 90px – über SupportButton)
- **snake_case in DB-Typen**: z.B. `bezahlt_am` nicht `bezahltAm`
- **Nach jeder Änderung**: `git add <datei> && git commit -m "..." && git push`
- **TypeScript prüfen**: `npx tsc --noEmit` nach größeren Änderungen
- **UUID vs. text PKs**: `lager_stellplaetze` hat UUID PK → `crypto.randomUUID()` im Live-Modus
- **IIFE-Pattern** für komplexe Tabs mit lokalen Funktionen und Berechnungen
- **No auto-execute**: KI-Aktionen brauchen immer User-Bestätigung (2 Klicks)

---

## Credentials & Secrets

**Alle Keys liegen in `.env.local`** (nie in Code oder CLAUDE.md schreiben — Datei ist in .gitignore).

Claude liest Keys so:
```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
echo $SUPABASE_SERVICE_ROLE_KEY
```

## Supabase SQL direkt ausführen (exec_sql)

`exec_sql` RPC-Funktion ist in Supabase hinterlegt. Key kommt aus `.env.local`:

```bash
source .env.local
curl -s -X POST "https://cchmjrnzaqvowqihcdte.supabase.co/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DEIN SQL HIER"}'
```

- Kein Rückgabewert bei Erfolg (leere Antwort = OK)
- Bei Fehler kommt JSON mit `message`-Feld
- Migrations-SQL-Dateien weiterhin unter `supabase/migrations/` speichern

---

## Vercel Deployment

- Auto-Deploy bei Push auf `main`
- Node.js Version: 18.x (in Vercel Settings setzen!)
- Env-Vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
- Bei Build-Fehler: `npx tsc --noEmit` lokal testen

---

## Offene Punkte / Nächste Schritte

### 🔴 Dringend (Supabase-SQL)
- [ ] Neue Lager-Tabellen im SQL-Editor ausführen: `lager_stellplaetze`, `lager_stellplatz_bestand`, `lager_umlagerungen`
- [ ] Einkauf-Tabellen ausführen: `einkauf_lieferanten`, `einkauf_bestellungen`, `einkauf_wareneingaenge`
- [ ] `ALTER TABLE lager_artikel ADD COLUMN mindestbestand integer default 0` — falls noch nicht ausgeführt

### 🟡 KI-Features
- [ ] **Supabase SSR-Auth in API-Route**: `createServerClient` mit Cookie-Forwarding statt `createBrowserClient` → Live-Nutzer bekommen echte Lagerdaten im KI-Chat
- [ ] **KI-Aktion "Bestellung"** ausführbar machen (analog zu Umlagerung — derzeit nur angezeigt)
- [ ] **KI-Aktion "Hinweis"** — Link zu relevantem Tab

### 🟡 Feature-Vervollständigung
- [ ] **EinkaufTab**: Demo-State auf echte Supabase-Calls umstellen (db.ts-Funktionen fertig)
- [ ] **MarketingPilot**: Edit + Delete implementieren
- [x] **AnalysePilot**: echte Daten aus Supabase, Demo-Fallback via hasDemoCookie(), Fehler-Handling mit Ladefehler-Banner

### 🟢 Langfristig
- [ ] Stripe Integration (Abos/Bezahlung)
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand (echte E-Mail, aktuell simuliert)
- [ ] Rollen-basierte Sidebar-Filterung
- [ ] Benutzer-Verwaltung für Admin
- [ ] PDF-Vorlagen: Firmenlogo + echte Adressdaten
- [ ] Push-Benachrichtigungen (PWA Service Worker)
- [ ] Offline-Modus
