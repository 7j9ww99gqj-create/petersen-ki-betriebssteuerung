# PROJECT_STATUS.md

> 🚀 Schlanke Live-Status-Datei. Nur die **letzten 3 Iterationen** + offene Punkte.
> Für vollständige Historie siehe [`PROJECT_STATUS_ARCHIVE.md`](./PROJECT_STATUS_ARCHIVE.md).
> Design-System & Patterns → [`CLAUDE.md`](./CLAUDE.md).
> Token-Ziel: < 5k bei Onboarding.

---

## 0. Schnellzugriff

**Stack:** Next.js 14 · TypeScript · Tailwind · Supabase · OpenAI · Vercel
**Live:** https://app.petersen-ki-pilot.de (Vercel Auto-Deploy bei Push auf `main`)
**Repo:** https://github.com/7j9ww99gqj-create/petersen-ki-betriebssteuerung

**Lesereihenfolge für Agenten:**
1. `CLAUDE.md` (lädt Claude Code automatisch) — Regeln, UI-Patterns, Design-System
2. Diese Datei (`PROJECT_STATUS.md`) — Sektion 1 (HEAD) + Sektion 2 (letzte 3 Iterationen)
3. Bei Bedarf: `PROJECT_STATUS_ARCHIVE.md` (alte Iterationen)

---

## 1. Aktueller Stand

- **HEAD:** `939e831` (`docs: Design-System Master-Übersicht in CLAUDE.md`)
- **Letzte Iteration:** 2026-05-20 — Design-Panel Umzug + Token-Optimierung (in Arbeit)
- **TypeScript:** `npx tsc --noEmit` — ✅ 0 Fehler
- **Tests:** 87 Tests in 7 Files — ✅
- **CI/CD:** Vercel Auto-Deploy auf `main` — ✅

---

## 2. Aktueller Arbeitsstand (letzte 3 Iterationen)

### 2.1 UI-Polish & Mobile-Fixes + Pilot-Farb-System (2026-05-20)
**Commits:** `79913d9` → `13b02b8` → `31f924a` → `423cba2` → `939e831`

- **Mobile-Bug behoben:** `DesignCustomizationPanel` läuft auf Handy nicht mehr über. Tabs sind auf Mobile (≤640px) jetzt natives `<select>`-Dropdown, auf Desktop Pill-Grid.
- **Design-Panel umgezogen:** Aus Benachrichtigungen → eigener Menüpunkt `🎨 Design` in Einstellungen.
- **Logo-Upload Firmendaten repariert:** `next.config.js` erhält `images.remotePatterns` für `*.supabase.co`. Native `<img>` mit `onError`-Fallback statt next/image.
- **Sidebar-Logo:** Echtes Hexagon-PNG aus `/public/logo.png` statt SVG-„P".
- **Pilot-Farb-System:** Neue zentrale Palette in `lib/pilot-colors.ts`. Jeder Pilot hat farbigen Namen im Header (z.B. `<Lager>Pilot` blau, `<Steuer>Pilot` gold) + Glow-Box + Tab-Active-Highlight in Pilot-Farbe.
- **Design-System-Master-Übersicht** in `CLAUDE.md` als Single Source of Truth.

### 2.2 DP12-Phase2 — Toast-Unifikation + Cloud-Sync (2026-05-20)
**Commits:** `bb57741` → `25ce34f`

- Alle Piloten-Toasts (Lager/Werkstatt/QM/Büro/Steuer) auf `.pk-toast`-Klasse umgestellt → Position/Animation/Dauer respektieren User-Prefs.
- Neue `components/AppToast.tsx` mit Event-API `pushAppToast(msg, type)` + globaler Container in `app/dashboard/layout.tsx`.
- WebAudio-Beep (`lib/toast-sound.ts`) für success/error/info — kein Asset nötig.
- Demo-Vorschau-Buttons im Benachrichtigungen-Tab.
- Multi-Device Cloud-Sync via Supabase-Tabelle `user_design_prefs` (RLS, Opt-in via `lib/design-sync.ts`).

### 2.3 DP12 — Personalisierungs-Module (2026-05-20)
**Commits:** `019efae` → `990e58b`

- 6 neue Module mit Master-Toggle pro Modul: `notifications` · `typography` · `effects` · `colors` · `icons` · `layout`.
- Bei deaktiviertem Modul bleibt der aktuelle Look 1:1 erhalten.
- 6-Tab-UI im Design-Panel (Allgemein/Benachrichtigungen/Typografie/Effekte/Farben/Icons & Layout) mit „↺ Alles zurücksetzen".
- CSS-Regeln rein additiv (`body[data-pers-*="on"]`), bricht nichts Bestehendes.

> **Ältere Iterationen** (DP1–DP11, QM-Pilot, BugFix-Sprints, Wareneingang-Redesign, etc.) → siehe `PROJECT_STATUS_ARCHIVE.md`

---

## 3. Bekannte Probleme

- Inhaber-Live-Datenrisiko: `app/api/chat/route.ts` ist Server-SSR-gehärtet, weitere API-Routen noch nicht durchgängig.
- MarketingPilot: Edit + Delete für Kampagnen/Leads/Newsletter fehlen.
- Cloud & Sync: zeigt echte Kennzahlen, aber kein vollwertiges Backup-Backend.

---

## 4. Offene Aufgaben

### 🔴 Pre-Release-Blocker
- [ ] **Key-Rotation:** Supabase Service Role + Vercel Token rotieren; OpenAI-Key auf Commit-History prüfen.
- [ ] **Manuelle E2E-Tests QM-Pilot** in Production.

### 🟡 Feature-Vervollständigung
- [ ] MarketingPilot Edit + Delete für Kampagnen/Leads/Newsletter.
- [ ] LagerPilot Umlagerung atomarisieren: Supabase-RPC `pk_umlager_artikel` statt 4 sequentieller Awaits.
- [ ] Rechnungsmodell für Buchungen/Abos (`invoices` + Versandstatus + PDF-Flow).

### 🟢 Grafikdesigner-Folge (Übergabe in `docs/DESIGN_HANDOVER.md`)
- [ ] H1 Schriftart entscheiden (Inter / IBM Plex / System).
- [ ] H2 Produktfotos für Hero / OG-Images.
- [ ] H5 PDF-Vorlagen-Header (Logo + Briefpapier).
- [ ] H7/H8 Bottom-Nav + Sidebar Icons von Emoji auf `<PilotIcon />`.

### 🔵 Langfristig
- [ ] Stripe Integration (Abos/Bezahlung).
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand (echte E-Mail).
- [ ] Rollen-basierte Sidebar-Filterung.
- [ ] PWA-Push-Service-Worker erweitern.

---

## 5. Nächste Empfehlung

1. **Key-Rotation** (Release-Blocker).
2. **QM-Pilot E2E-Tests** in Production.
3. **MarketingPilot Edit/Delete** als nächste Feature-Iteration.
4. **PDF-Header mit Logo** für Briefpapier (Vorbereitung Grafikdesigner-Übergabe).

---

## 📚 Archiv

Alle früheren Iterationen, BugFix-Sprints, Phase-Berichte, ausführliche Schema-Analysen → **[`PROJECT_STATUS_ARCHIVE.md`](./PROJECT_STATUS_ARCHIVE.md)** (197 KB Historie, NICHT beim Onboarding lesen — nur bei spezifischen Fragen).
