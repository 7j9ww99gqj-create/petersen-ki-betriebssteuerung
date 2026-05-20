# Design-Übergabe an Grafikdesigner

Stand: 2026-05-20 — Pre-Release Polishing

Diese Datei bündelt alles, was der Grafikdesigner zum produktiven Start
braucht. Sie ist **rein dokumentarisch** und ergänzt CLAUDE.md, AGENTS.md
und PROJECT_STATUS.md — bestehende Inhalte werden nicht ersetzt.

---

## 1. Repository-Übersicht

Die Marke „Petersen KI" verteilt sich auf **zwei separate Repos** mit
**unterschiedlichen Tech-Stacks**:

| Repo | Pfad | Stack | Live |
|------|------|-------|------|
| **App** | `/Users/kevinpetersen/Documents/petersen-ki` | Next.js 14 App Router + Supabase | https://app.petersen-ki-pilot.de |
| **Marketing-Site** | `/Users/kevinpetersen/Documents/petersen_ki_betriebssteuerung_website_v25_mobile_fix` | Statisches HTML, Apache, IONOS Deploy Now | https://petersen-ki-pilot.de |

Push auf `main` deployed beide Sites automatisch.

---

## 2. Bereits ausgelieferte Design-Bausteine (App)

| ID | Lieferung | Datei |
|----|-----------|-------|
| G1 | Icon-Library auf Lucide-Basis | `components/brand/PilotIcon.tsx` |
| G2 | Typography-Scale CSS-Klassen | `app/globals.css` ab `.pk-h1` |
| G3 | SVG-Logo (full / mark / wordmark) | `components/brand/Logo.tsx` |
| G4 | Illustrierte Empty-States (12 Motive) | `components/EmptyStateIllustrated.tsx` |
| G5 | Onboarding-Progress (numbered/bar/dots) | `components/OnboardingProgress.tsx` |
| G7 | Semantische Farb-Tokens | `app/globals.css` ab `--success` |
| G8 | Modal-Animationen | `app/globals.css` ab `@keyframes pk-modal-*` |

Alle Bausteine sind **additiv** — bestehende Komponenten/Klassen bleiben
unverändert und funktionsfähig. Der Designer kann graduell migrieren.

---

## 3. Design-Tokens

### Marken-Farben
```
--bg     #05070b      Hintergrund
--panel  #0b1420      Sidebar / Panels
--card   #101a28      Karten
--text   #f8fbff      Primärtext
--muted  #aeb9c8      Sekundärtext
--blue   #1684ff      Primär-Akzent
--blue2  #20c8ff      Sekundär-Akzent / Gradient-Endpunkt
```

### Semantische Tokens (NEU — G7)
```
--success  #10b981 / --success-bg rgba(16,185,129,.12)
--warning  #f59e0b / --warning-bg rgba(245,158,11,.12)
--danger   #ef4444 / --danger-bg  rgba(239,68,68,.12)
--info     #38bdf8 / --info-bg    rgba(56,189,248,.12)
```

### Pilot-Farben (bleiben)
```
LagerPilot       #1684ff   blau
BüroPilot        #20c8ff   cyan
WerkstattPilot   #a78bfa   violett
MarketingPilot   #f59e0b   orange
AnalysePilot     #10b981   grün
PlanungPilot     #f43f5e   rot/pink
KI-Assistent     #7c3aed   lila
QM-Pilot         #14b8a6   teal
Pondruff         #e50909   rot
```

---

## 4. Marketing-Site Refresh — offene Punkte (G6)

Die Marketing-Site liegt in **einem anderen Repo** und wird **nicht** von
diesem Sprint angefasst. Empfohlene Folge-Schritte (kein Code hier — nur
Übergabe):

### 4.1 Aktuelle Stärken (nicht anfassen)
- PageSpeed Insights Desktop+Mobile **100/100**
- SEO komplett (sitemap.xml, robots.txt, Schema.org auf allen 12 Pilot-Seiten)
- Cookie-Consent + Microsoft Clarity DSGVO-konform
- 18 HTML-Seiten, alle responsive

### 4.2 Was angeglichen werden sollte
1. **Wordmark übernehmen** — das neue SVG aus `components/brand/Logo.tsx`
   exportieren und in `/assets/logo.svg` der Marketing-Site einbinden.
2. **Farb-Hierarchie synchronisieren** — semantische Tokens aus diesem
   Repo in `assets/style.css` der Marketing-Site spiegeln, damit Buttons
   und Banner identisch aussehen.
3. **Hero-Section Re-Design** — aktuell Text-lastig; visuelle Hierarchie
   stärken mit Produkt-Screenshot + Brand-Gradient.
4. **CTA-Konsistenz** — „Zur App →"-Buttons der Marketing-Site auf das
   gleiche Padding/Radius wie `.pk-btn` der App bringen.
5. **Pilot-Seiten** — Icons der Pilot-Cards von Emoji auf Lucide-SVG
   umstellen (gleiche Set wie in der App, ergibt einheitliches Bild).

### 4.3 Empfohlener Workflow
```
cd /Users/kevinpetersen/Documents/petersen_ki_betriebssteuerung_website_v25_mobile_fix
git checkout -b design/refresh
# Schritt für Schritt anpassen
git push origin design/refresh
# IONOS Deploy Now baut Preview automatisch
```

---

## 5. Komponenten-Inventar (App)

### Vorhandene Brand-Komponenten
- `components/brand/Logo.tsx` — SVG-Logo (NEU)
- `components/brand/PilotIcon.tsx` — Icon-Wrapper (NEU)

### Bestehende UI-Bausteine (CLAUDE.md beachten)
- `.pk-card` — Standardkarte
- `.pk-btn` / `.pk-btn-ghost` — Primär/Sekundär
- `.pk-input` — Input mit iOS-Zoom-Schutz
- `.pk-table` / `.pk-table-wrap` — Tabellen
- `.badge .badge-{green,blue,orange,red,gray,purple}` — Status
- `.fade-in` / `.fade-in-scale` — Animationen (existierend)
- `.pk-modal-overlay` / `.pk-modal-enter` — Modal-Animationen (NEU, G8)

### Empty-States
- `components/EmptyState.tsx` — Emoji-basiert (bestehend)
- `components/EmptyStateIllustrated.tsx` — SVG-basiert (NEU)

---

## 6. Manuelle Folge-Schritte für den Grafikdesigner

| # | Aufgabe | Wo |
|---|---------|-----|
| H1 | Schriftart entscheiden (Inter / IBM Plex / System-Stack) | App-weit |
| H2 | Produktfotos für Hero, OG-Images aktualisieren | Marketing-Site |
| H3 | App-Icon (PWA + Apple-Touch) durch finales Logo ersetzen | `public/` |
| H4 | Favicon-Set generieren (16/32/180/192/512) | `public/` |
| H5 | PDF-Vorlagen-Header (Logo + Briefpapier) prüfen | `lib/pdf.ts` |
| H6 | Email-Templates Branding (Resend) | `lib/` |
| H7 | Bottom-Nav Icons in der App von Emoji auf `<PilotIcon />` umstellen | `app/dashboard/layout.tsx` |
| H8 | Sidebar-Icons in der App von Emoji auf `<PilotIcon />` umstellen | `components/Sidebar.tsx` |

H7 und H8 sind bewusst **noch nicht** ausgeführt: sie verändern bestehenden
Inhalt und sollen vom Designer mit Live-Vorschau einzeln entschieden werden.

---

## 7. Kontakt & Übergabe

- Marken-E-Mail: `info@petersen-ki-pilot.de`
- Repo-Zugang via GitHub (Inhaber-Account)
- Vercel-Preview-Branches sind erlaubt (siehe `CONTRIBUTING.md`)
- Bei Fragen zu DB / Auth / Roles: zuerst `CLAUDE.md`, dann `PROJECT_STATUS.md`
