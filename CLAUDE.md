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

- **`lib/db.ts`** – Zentrale Datenschicht für alle Piloten (~409 Zeilen)
- **`supabase/schema.sql`** – Vollständiges Schema mit RLS für alle 17 Tabellen
- Alle Tabellen haben `user_id uuid references auth.users default auth.uid()`
- RLS: jeder User sieht nur seine eigenen Daten
- Storage-Bucket: `dokumente` (Upload/Select/Delete Policies)
- **WICHTIG:** Schema muss manuell im Supabase SQL-Editor ausgeführt werden

### Tabellen
| Pilot | Tabellen |
|-------|---------|
| Lager | `lager_artikel`, `lager_bewegungen` |
| Büro | `buero_kunden`, `buero_angebote`, `buero_auftraege`, `buero_rechnungen`, `buero_dokumente` |
| Werkstatt | `werkstatt_karten`, `werkstatt_zeitbuchungen`, `werkstatt_material`, `werkstatt_pruefprotokolle` |
| Marketing | `marketing_kampagnen`, `marketing_leads`, `marketing_newsletter` |
| Planung | `planung_projekte`, `planung_aufgaben`, `planung_termine`, `planung_ressourcen` |

---

## Piloten – Aktueller Stand

| Pilot | Route | Features |
|-------|-------|---------|
| LagerPilot | `/dashboard/lager` | Bestand (CRUD), Bewegungen, Wareneingang, Warenausgang, Inventur, Bestellvorschlag-Tab, CSV-Export, Inline-Delete, Sortierung |
| BüroPilot | `/dashboard/buero` | Kunden (CRUD), Angebote (CRUD+Edit-Modal), Aufträge (CRUD+Fortschritt-Slider), Rechnungen (CRUD+KPI-Summen), Dokumente, Angebot→Auftrag-Konvertierung |
| WerkstattPilot | `/dashboard/werkstatt` | Arbeitskarten (CRUD+Edit-Modal+Fortschritt-Slider), Zeiterfassung, Materialverbrauch, Prüfprotokoll (Ergebnis inline änderbar), KPI-Karten |
| MarketingPilot | `/dashboard/marketing` | Kampagnen, Leads, Newsletter |
| AnalysePilot | `/dashboard/analyse` | Charts (recharts v3): Bar, Line, Area, Pie |
| PlanungPilot | `/dashboard/planung` | Projekte (CRUD+Edit+Meilensteine), Kalender (CRUD+Edit), Ressourcen (CRUD), Aufgaben (CRUD+Edit+Status) |
| KI Erkennung | `/dashboard/ki-erkennung` | Chat mit Anthropic API, Lieferschein-Scan-Simulation |
| Cloud & Sync | `/dashboard/cloud` | Sync-Status, Storage-Übersicht |
| Archiv | `/dashboard/archiv` | Dokumentenarchiv |
| Einstellungen | `/dashboard/einstellungen` | Benutzerprofil |

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
- `.pk-btn` – Primär-Button (Blau)
- `.pk-btn-ghost` – Sekundär-Button
- `.pk-input` – Input-Feld
- `.pk-table` – Tabellen-Stil
- `.badge .badge-green/blue/orange/gray/red/purple` – Status-Badges
- `.fade-in` / `.fade-in-scale` – Animationen
- `.hamburger-btn` – Mobiler Menü-Button (per CSS sichtbar)

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

## Komponenten (components/)

| Datei | Beschreibung |
|-------|-------------|
| `Sidebar.tsx` | Navigations-Sidebar mit allen Piloten-Links |
| `NotificationBell.tsx` | Benachrichtigungsglocke (oben rechts) |
| `GlobalSearch.tsx` | ⌘K Suchmodal |
| `SupportButton.tsx` | Floating Support-Button (WhatsApp, E-Mail, Telefon) – fixed bottom-right |

---

## UI-Features

- **Globale Suche**: `⌘K` öffnet Suchmodal
- **SupportButton**: Fixed bottom-right, 3 Kontaktoptionen (WhatsApp `+4917656392975`, E-Mail `info@petersen-ki-pilot.de`, Telefon)
- **Animierte Zähler**: Dashboard-Stats zählen bei Laden hoch
- **Logo**: `/public/logo.jpg` – in Sidebar + Login
- **recharts v3**: Installiert für AnalysePilot
- **Mobile**: Hamburger-Menü, responsive Grid-Layouts, `overflowX: auto` für Tabellen

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
- UI sauber und konsistent halten

---

## Vercel Deployment

- Auto-Deploy bei Push auf `main`
- Node.js Version: 18.x (in Vercel Settings setzen!)
- Env-Vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
- Bei Build-Fehler: Vercel Build-Log prüfen, `npx tsc --noEmit` lokal testen

---

## Offene Punkte / Nächste Schritte

- [ ] `supabase/schema.sql` im Supabase SQL-Editor ausführen (noch nicht bestätigt)
- [ ] MarketingPilot vollständig ausbauen (Edit/Delete fehlt noch)
- [ ] AnalysePilot: echte Daten aus Supabase (aktuell nur Demo-Charts)
- [ ] Stripe Integration (Abos/Bezahlung)
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand-Unterschreitung
