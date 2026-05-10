# Petersen KI Betriebssteuerung

## Projektübersicht
KI-gestütztes Warenwirtschaftssystem als produktive SaaS-WebApp.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · App Router  
**Live:** https://petersen-ki-betriebssteuerung.vercel.app  
**Repo:** https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung

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
| MarketingPilot | `/dashboard/marketing` | ⚠️ Teilweise | Create OK, Edit/Delete fehlt |
| AnalysePilot | `/dashboard/analyse` | ⚠️ Demo-Daten | Charts laufen, kein Supabase |
| PlanungPilot | `/dashboard/planung` | ✅ Vollständig | Projekte/Aufgaben/Kalender/Ressourcen |
| KI-Assistent | `/dashboard/ki-erkennung` | ✅ Vollständig | Tagesbrief/Erkennung/Chat + Aktions-Ausführung |
| Cloud & Sync | `/dashboard/cloud` | ✅ Basis | Sync-Status, Storage |
| Archiv | `/dashboard/archiv` | ✅ Basis | Dokumentenarchiv |
| Einstellungen | `/dashboard/einstellungen` | ✅ Vollständig | Profil/Benachrichtigungen/Rollen |

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
- Live: `Promise.allSettled([getLagerArtikel(), getLagerStellplaetze(), getLagerStellplatzBestand(), getLagerUmlagerungen()])`
- **Bekannte Einschränkung:** `createBrowserClient` hat keine User-Session in API-Routes → RLS gibt leere Arrays zurück. Fix: auf `createServerClient` mit Cookie-Forwarding umstellen (noch offen)

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

### Piloten-Farben
| Pilot | Farbe | Hex |
|-------|-------|-----|
| LagerPilot | Blau | `#1684ff` |
| BüroPilot | Cyan | `#20c8ff` |
| WerkstattPilot | Violett | `#a78bfa` / `#7c3aed` |
| MarketingPilot | Orange | `#f59e0b` |
| AnalysePilot | Grün | `#10b981` |
| PlanungPilot | Pink/Rot | `#f43f5e` / `#e11d48` |
| KI-Assistent | Lila | `#7c3aed` / `#a78bfa` |

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
- [ ] **AnalysePilot**: echte Daten aus Supabase statt Demo-Charts

### 🟢 Langfristig
- [ ] Stripe Integration (Abos/Bezahlung)
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand (echte E-Mail, aktuell simuliert)
- [ ] Rollen-basierte Sidebar-Filterung
- [ ] Benutzer-Verwaltung für Admin
- [ ] PDF-Vorlagen: Firmenlogo + echte Adressdaten
- [ ] Push-Benachrichtigungen (PWA Service Worker)
- [ ] Offline-Modus
