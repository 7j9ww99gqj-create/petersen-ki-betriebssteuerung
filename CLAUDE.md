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

### Tabellen
| Pilot | Tabellen |
|-------|---------|
| Lager | `lager_artikel` (+ `mindestbestand` Spalte!), `lager_bewegungen` |
| Büro | `buero_kunden`, `buero_angebote`, `buero_auftraege`, `buero_rechnungen`, `buero_dokumente` |
| Einkauf | `einkauf_lieferanten`, `einkauf_bestellungen`, `einkauf_wareneingaenge` ⚠️ neu – noch im SQL-Editor ausführen! |
| Werkstatt | `werkstatt_karten`, `werkstatt_zeitbuchungen`, `werkstatt_material`, `werkstatt_pruefprotokolle` |
| Marketing | `marketing_kampagnen`, `marketing_leads`, `marketing_newsletter` |
| Planung | `planung_projekte`, `planung_aufgaben`, `planung_termine`, `planung_ressourcen` |

### Neue DB-Funktionen in `lib/db.ts` (Einkauf-Modul)
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

| Pilot | Route | Features |
|-------|-------|---------|
| LagerPilot | `/dashboard/lager` | Bestand (CRUD), Bewegungen, Wareneingang, Warenausgang, Inventur, Bestellvorschlag-Tab, CSV-Export, Inline-Delete, Spalten-Sortierung, **Mindestbestand-Alarm** (rotes Banner + Bestellvorschlag-Modal), **Alle bestellen**-Button, **Historie-Tab** (Bewegungsfilter je Artikel, Statistik-Karten) |
| BüroPilot | `/dashboard/buero` | Kunden/Angebote/Aufträge/Rechnungen/Dokumente (alle CRUD+Edit), PDF-Export (jsPDF), Angebot→Auftrag-Konvertierung, echtes File-Upload, **Einkauf/Lieferanten-Tab** (Lieferanten-CRUD+Bewertung, Bestellungen-Workflow, Wareneingänge+Qualitätskontrolle, KPI-Karten) |
| WerkstattPilot | `/dashboard/werkstatt` | Arbeitskarten (CRUD+Edit+Fortschritt-Slider), Zeiterfassung, Materialverbrauch, Prüfprotokoll (Ergebnis inline), KPI-Karten |
| MarketingPilot | `/dashboard/marketing` | Kampagnen, Leads, Newsletter |
| AnalysePilot | `/dashboard/analyse` | Charts (recharts v3): Bar, Line, Area, Pie |
| PlanungPilot | `/dashboard/planung` | Projekte (CRUD+Edit+Meilensteine), Kalender (CRUD+Edit), Ressourcen (CRUD), Aufgaben (CRUD+Edit+Status) |
| KI-Assistent | `/dashboard/ki-erkennung` | Tab Tagesbrief (Was heute / Nachbestellung / Kunden), Tab Dokument-Erkennung, Tab Chat (via /api/chat) |
| Cloud & Sync | `/dashboard/cloud` | Sync-Status, Storage-Übersicht |
| Archiv | `/dashboard/archiv` | Dokumentenarchiv |
| Einstellungen | `/dashboard/einstellungen` | Profil, Benachrichtigungen, Rollen & Rechte (Tabelle + Wechsel) |

### LagerPilot Tab-Typen
```ts
type LagerTab = 'bestand' | 'bewegungen' | 'eingang' | 'ausgang' | 'inventur' | 'bestellung' | 'historie'
```
- **Bestellvorschlag-Flow**: Warenausgang → prüft Mindestbestand → zeigt `bestellHint`-Banner → Modal mit Bestellmenge + E-Mail-Vorschau
- **Alle bestellen**: Bulk-Bestellung aller offenen Vorschläge auf einmal
- **📈-Button** per Artikelzeile → navigiert zu Historie-Tab gefiltert auf diesen Artikel
- **BestellDetailModal**: Artikel-Info, editierbare Menge, E-Mail-Simulation

### BüroPilot Einkauf-Tab (`EinkaufTab`-Komponente)
```ts
type Tab = 'kunden' | 'angebote' | 'auftraege' | 'rechnungen' | 'dokumente' | 'einkauf'
```
- **Sub-Tabs**: Lieferanten · Bestellungen · Wareneingänge
- **Lieferanten**: CRUD, Sternebewertung (★/☆), Zahlungsziel, Kategorie, 🛒-Quicklink zu Bestellung
- **Bestellungen**: Status-Workflow Entwurf→Bestellt→Teillieferung→Geliefert, "WE buchen"-Quicklink
- **Wareneingänge**: Qualitätskontrolle (OK/Mängel/Abgelehnt), auto Bestellstatus-Update
- ⚠️ Aktuell Demo-State (db.ts-Funktionen vorbereitet aber noch nicht in EinkaufTab verdrahtet)

### Dashboard KPIs (P4)
- `app/dashboard/page.tsx` lädt echte Supabase-Daten via `Promise.allSettled` (graceful degradation)
- Im Demo-Modus: statische `demoKpis`-Werte
- 6 klickbare KPI-Cards mit Navigation zum jeweiligen Piloten

---

## Mobile / PWA Optimierungen

### Viewport & PWA (app/layout.tsx)
```tsx
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: 'cover', themeColor: '#05070b',
}
// PWA Meta-Tags: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style
// manifest.json in public/manifest.json
```

### Bottom Navigation (app/dashboard/layout.tsx)
```tsx
const bottomNavItems = [
  { href: '/dashboard',              icon: '⊞',  label: 'Start' },
  { href: '/dashboard/lager',        icon: '📦', label: 'Lager' },
  { href: '/dashboard/buero',        icon: '🧾', label: 'Büro' },
  { href: '/dashboard/werkstatt',    icon: '🛠️', label: 'Werkstatt' },
  { href: '/dashboard/ki-erkennung', icon: '🧠', label: 'KI' },
  { href: '#menu',                   icon: '☰',  label: 'Menü' },  // öffnet Sidebar
]
// Sichtbar bei ≤768px via CSS display:flex
```

### iOS-Fixes
- `font-size: 16px !important` auf `.pk-input` (verhindert Auto-Zoom)
- `min-height: 44px` auf `.pk-btn`, `.pk-btn-ghost` (Touch-Target Apple HIG)
- `env(safe-area-inset-*)` in padding-Werten für Notch/Home-Indicator
- `100dvh` statt `100vh` (behebt iOS Safari-Viewport-Bug)
- `-webkit-overflow-scrolling: touch` auf `.pk-table-wrap` (in globals.css)

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
function Toast({ msg, type = 'success' }) {
  if (!msg) return null
  const isErr = type === 'error'
  return (
    <div style={{
      position:'fixed', bottom:90, right:24, zIndex:9999,
      padding:'14px 20px', borderRadius:12, maxWidth:360,
      background: isErr ? 'rgba(255,80,80,.15)' : 'rgba(37,211,102,.12)',
      border: `1px solid ${isErr ? 'rgba(255,80,80,.4)' : 'rgba(37,211,102,.35)'}`,
      color: isErr ? '#ff8080' : '#4ddb7e',
      fontSize:14, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.4)',
    }}>{msg}</div>
  )
}
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

### ID-Generierung
```ts
function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`
}
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
- `.badge .badge-green/blue/orange/gray/red/purple` – Status-Badges
- `.fade-in` / `.fade-in-scale` – Animationen
- `.hamburger-btn` – Mobiler Menü-Button (per CSS sichtbar, Desktop versteckt)
- `.bottom-nav` – Bottom Navigation Bar (nur Mobile ≤768px)
- `.bottom-nav-item` – Einzelner Nav-Eintrag (flex column, touch-target)
- `.bn-icon` – Icon in Bottom Nav
- `.stats-grid` – Responsive KPI-Grid (1–4 Spalten je Viewport)
- `.mobile-1col` – Erzwingt 1-Spalten-Layout auf Mobile
- `.pk-tab-bar` – Horizontaler Tab-Container (scroll ohne Scrollbar)
- `.support-btn-wrap` – SupportButton-Wrapper (hebt Button über Bottom-Nav auf Mobile)
- `.role-badge-desktop` – Rollen-Badge (nur Desktop sichtbar)
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

---

## Neue Lib-Dateien

| Datei | Beschreibung |
|-------|-------------|
| `lib/roles.ts` | Rollen & Rechte: `AppRole`, `PERMISSIONS`, `useRole()`, `getRole()`, `setRole()` |
| `lib/warnings.ts` | Warnsystem: `getAppWarnings(isDemo)` liest Lager/Büro/Werkstatt/Planung |
| `lib/pdf.ts` | PDF-Generierung: `generateRechnungPDF()`, `generateAngebotPDF()` via jsPDF |
| `lib/db.ts` | Zentrale Datenschicht für alle Piloten (Supabase CRUD) inkl. Einkauf-Funktionen |

### Rollen-System (`lib/roles.ts`)
```ts
type AppRole = 'Admin' | 'Mitarbeiter' | 'Büro' | 'Werkstatt' | 'Lager'
PERMISSIONS.canDelete(role)  // nur Admin
PERMISSIONS.canCreate(role)  // Admin + Mitarbeiter
PERMISSIONS.canEdit(role)    // alle außer Lager
PERMISSIONS.canExport(role)  // Admin + Büro
// Gespeichert in localStorage 'pk_role', Demo immer 'Admin'
const { role, setRole, permissions } = useRole()
```

### Warnsystem (`lib/warnings.ts`)
```ts
// Liest Supabase-Daten und generiert Warning-Objekte
// Bei isDemo: 6 statische Beispiel-Warnungen
await getAppWarnings(isDemo: boolean): Promise<Warning[]>
```

### PDF (`lib/pdf.ts`)
```ts
// Dynamic import von jsPDF (SSR-sicher)
await generateRechnungPDF(rechnung: PDFRechnung, kundenName: string)
await generateAngebotPDF(angebot: PDFAngebot, kundenName: string)
```

## Komponenten (components/)

| Datei | Beschreibung |
|-------|-------------|
| `Sidebar.tsx` | Navigations-Sidebar mit allen Piloten-Links |
| `NotificationBell.tsx` | Echte Live-Warnungen (Tabs: Alle/Fehler/Warnung), Auto-Refresh 60s, Links zu Piloten |
| `GlobalSearch.tsx` | ⌘K Suchmodal |
| `SupportButton.tsx` | Floating Support-Button (WhatsApp, E-Mail, Telefon) – fixed bottom-right, className="support-btn-wrap" für Mobile-Override |

---

## UI-Features

- **Globale Suche**: `⌘K` öffnet Suchmodal
- **SupportButton**: Fixed bottom-right, 3 Kontaktoptionen (WhatsApp `+4917656392975`, E-Mail `info@petersen-ki-pilot.de`, Telefon)
- **Animierte Zähler**: Dashboard-Stats zählen bei Laden hoch
- **Logo**: `/public/logo.jpg` – in Sidebar + Login
- **recharts v3**: Installiert für AnalysePilot
- **Mobile Bottom-Nav**: 6 Einträge, sichtbar ≤768px, '#menu'-Eintrag öffnet Sidebar
- **PWA**: `public/manifest.json`, Viewport-Meta in `app/layout.tsx`

---

## KI-Integration

1. `ANTHROPIC_API_KEY` in `.env.local`
2. Chat läuft über `app/api/chat/route.ts`
3. Ohne API-Key: simulierte Antworten

---

## Regeln

- **Demo-Modus immer prüfen**: `if (isDemo) return` vor jedem Supabase-Call
- **Bestehende Funktionalität nie entfernen**
- **Kein Browser `confirm()`** – immer Inline-Bestätigung
- **Toasts immer fixed bottom-right** (zIndex 9999, bottom 90px – über SupportButton)
- **IDs immer via `genId(prefix)`** (Date.now().toString(36))
- **snake_case in DB-Typen**: z.B. `bezahlt_am` nicht `bezahltAm`
- **Nach jeder Änderung**: `git add <datei> && git commit -m "..." && git push`
- **TypeScript prüfen**: `npx tsc --noEmit` nach größeren Änderungen
- UI sauber und konsistent halten

---

## Vercel Deployment

- Auto-Deploy bei Push auf `main`
- Node.js Version: 18.x (in Vercel Settings setzen!)
- Env-Vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
- Bei Build-Fehler: Vercel Build-Log prüfen, `npx tsc --noEmit` lokal testen

---

## Offene Punkte / Nächste Schritte

### Dringend (Supabase)
- [ ] `supabase/schema.sql` im Supabase SQL-Editor ausführen – 3 neue Einkauf-Tabellen + `ALTER TABLE lager_artikel ADD COLUMN mindestbestand integer default 0`

### Features
- [ ] EinkaufTab: Demo-State auf echte Supabase-Calls umstellen (db.ts-Funktionen bereits fertig)
- [ ] MarketingPilot vollständig ausbauen (Edit/Delete fehlt noch)
- [ ] AnalysePilot: echte Daten aus Supabase statt Demo-Charts
- [ ] Stripe Integration (Abos/Bezahlung)
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand-Unterschreitung (aktuell nur simuliert)
- [ ] Rollen-basierte Sidebar-Filterung (aktuell nur in Einstellungen wählbar)
- [ ] Benutzer-Verwaltung für Admin (andere User Rollen zuweisen)
- [ ] PDF-Vorlagen: Firmenlogo und echte Adressdaten einbinden
