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

- **HEAD:** DP14-Refactor Schritt 3b — Einstellungen 3.773 → 1.116 LOC (−70,4 %)
- **Letzte Iteration:** 2026-05-21 — useManagedUsers-Hook + BillingTab + AktivitaetslogTab
- **TypeScript:** `npx tsc --noEmit` — ✅ 0 Fehler
- **Tests:** 87 Tests in 7 Files — ✅ alle grün
- **CI/CD:** Vercel Auto-Deploy auf `main` — ✅

---

## 2. Aktueller Arbeitsstand (letzte 3 Iterationen)

### 2.1 DP14 — Monster-Page-Refactor (Aufgabe #1 aus Marktreife-Audit)
**Scope kumuliert:** `app/dashboard/einstellungen/page.tsx` 3.773 → **1.116 LOC (−70,4 %)**

**Schritt 3b (2026-05-21):** Custom-Hook + zwei kleine Tabs.
- `lib/hooks/useManagedUsers.ts` (464 LOC) — komplette Owner-Tool-State-Machine in einem Hook:
  - 17 useState-Felder (managedUsers, drafts, entitlement, forms, transient UI)
  - 7 Async-Actions (load, save, create/invite, disable, delete, resendInvite, applyPreset)
  - Exportiert `ManagedUser` / `ManagedUserAccessDraft` / `ManagedUsersEntitlement` Typen
  - + pure helper `buildRegistrationMailHref()`
- `BillingTab.tsx` (90 LOC) — Stripe-Callback-Banner + PricingSettingsPage, kapselt URL-Param-Cleanup
- `AktivitaetslogTab.tsx` (50 LOC) — Refresh-Button trickst jetzt `refreshKey` in AuditLogSection (vorher Bug: rief `loadManagedUsers` auf, lud also User-Liste statt Logs)
- AuditLogSection bekam `refreshKey?: number`-Prop (deps-Trigger)
- page.tsx: 3 Typdefs, 17 useState, 1 useCallback, 6 Handler, 1 pure helper, 1 broken-useEffect entfernt — alle 149 Bezüge in JSX automatisch auf `mu.*` umgestellt

**Schritt 3a (2026-05-21):** PostfachTab ausgelagert.
- `PostfachTab.tsx` (583 LOC) — Inhaber-Inbox + Versendete + Broadcast-Form + Member-Postfach in einer Komponente
- Eigener State: `userMessages`, `ownerInbox`, `ownerSentMessages`, `messageForm`, `broadcastForm`, `loadingMessages`, `sendingMessage`, `postfachTab` (8 useState aus page entfernt)
- Eigene Handler: `handleBroadcast`, `handleSendSupport` (vorher inline-onClick)
- Lädt Nachrichten beim Mount (statt section-getriggerter useEffect in der Page)
- Props: `isInhaberAccount`, `isDemo`, `showToast`, `managedUsers` (minimal-typisiert via lokalem `RecipientUser`)

**Schritt 2 (2026-05-21):** 4 bereits inline definierte Sub-Components in eigene Files verschoben.
- `InfoSection.tsx` (286 LOC) — App-Info/Datenschutz/Impressum/AGB
- `AuditLogSection.tsx` (114 LOC) — inkl. `CustomerInvoicePreview` als Named-Export
- `CompanySettingsSection.tsx` (567 LOC) — Firmenstammdaten + Logo + Briefpapier
- `ImportWizard.tsx` (652 LOC) — CSV-Import + `runBulkImport` + Types + Demo-Daten
- page.tsx: nicht mehr benötigte Imports entfernt (`useRef`, `Image`, `genId`, alle Bulk-Import-Funktionen, `FirmaEinstellungen`, `ImportSource`-Typen, `emptyFirma`, `NotifSettings`)

**Schritt 1 (2026-05-20):**
- `Toggle.tsx` (62 LOC) — wiederverwendbarer iOS-Style-Toggle
- `ProfilTab.tsx` (263 LOC) — kapselt profil/pwForm/isDemo + Handler + User-Load
- `BenachrichtigungenTab.tsx` (326 LOC) — kapselt notif/push-State + Handler + Push-Subscription

**Pattern etabliert:** Sections aus page.tsx werden zu eigenständigen Components in `components/einstellungen/`, die nur noch `showToast` (und ggf. minimalste Props) bekommen. Page.tsx wird zur dünnen Tab-Routing-Schicht.

**Status:** TS 0 Fehler · 87/87 Tests grün · Verhalten identisch.

### 2.2 DP13 — Design-System Phase 3: Marktreife (2026-05-20)
**Commits:** `2831819`

- **Light-Theme** (`body[data-design="light"]`): vollständig in `globals.css` — alle CSS-Vars, .pk-card, .pk-btn, .pk-input, .pk-table, Badges, Scrollbar, Bottom-Nav.
- **Auto-Theme**: `DesignPrefs.autoTheme` toggle; `lib/design-flag.ts` liest `prefers-color-scheme` in `applyBodyAttrs()` + Real-Time `matchMedia`-Listener in `useDesignPrefs()`.
- **Font-Family-Picker**: 5 Optionen (System/Inter/Roboto/Mono/Georgia) mit visuellen Schrift-Samples. `lib/design-flag.ts`: `FontFamily`-Typ + `VALID_FONT_FAMILIES` + `body[data-font]`-Attribut. `globals.css`: `body[data-pers-typo="on"][data-font="..."]`-Regeln.
- **Color Presets**: 6 kuratierte Farbsets (Standard/Smaragd/Lila/Sunset/Arktis/Rose). Ein Klick setzt alle 5 Farbfelder gleichzeitig.
- **WCAG-Kontrast-Check**: `wcagContrastVsWhite(hex)` berechnet Kontrastverhältnis; Warnung bei < 4.5:1 (AA-Fail) direkt im Farb-Tab.
- **LivePreview**: Miniatur-Karte im Panel-Header zeigt aktuellen Theme/Farb-/Typografie-Zustand live.
- **FOUC-Prevention**: Inline-Sync-Script in `app/layout.tsx` `<head>` setzt Body-Attribute + CSS-Vars vor dem ersten React-Paint — kein Theme-Flash.
- **`prefers-reduced-motion`**: Global-Catch-All-Block in `globals.css` — alle Animationen/Transitions auf `0.01ms` bei aktivierter Systemeinstellung.

### 2.3 DP12-Phase2 — Toast-Unifikation + Cloud-Sync (2026-05-20)
**Commits:** `bb57741` → `25ce34f`

- Alle Piloten-Toasts (Lager/Werkstatt/QM/Büro/Steuer) auf `.pk-toast`-Klasse umgestellt → Position/Animation/Dauer respektieren User-Prefs.
- Neue `components/AppToast.tsx` mit Event-API `pushAppToast(msg, type)` + globaler Container in `app/dashboard/layout.tsx`.
- WebAudio-Beep (`lib/toast-sound.ts`) für success/error/info — kein Asset nötig.
- Demo-Vorschau-Buttons im Benachrichtigungen-Tab.
- Multi-Device Cloud-Sync via Supabase-Tabelle `user_design_prefs` (RLS, Opt-in via `lib/design-sync.ts`).

### 2.4 DP12 + UI-Polish — Design-Panel + Pilot-Farben + Mobile-Fixes (2026-05-20)
**Commits:** `019efae` → `990e58b` → `79913d9` → `13b02b8` → `31f924a` → `423cba2` → `939e831`

- 6 Personalisierungs-Module mit Master-Toggle: `notifications` · `typography` · `effects` · `colors` · `icons` · `layout`.
- Design-Panel aus Benachrichtigungen herausgelöst → eigener Menüpunkt `🎨 Design` in Einstellungen.
- Mobile: Tab-Navigation ist natives `<select>`-Dropdown (≤640px), Desktop: Pill-Grid.
- `lib/pilot-colors.ts`: zentrale Farbpalette für alle Piloten mit `pilotTabStyle()` + `pilotHeaderIconStyle()`.
- Logo-Upload in Firmendaten repariert (`next.config.js` `remotePatterns`).

> **Ältere Iterationen** (DP1–DP11, QM-Pilot, BugFix-Sprints, Wareneingang-Redesign, etc.) → siehe `PROJECT_STATUS_ARCHIVE.md`

---

## 3. Piloten-Status

| Pilot | Status | Anmerkung |
|-------|--------|-----------|
| LagerPilot | ✅ Vollständig | 12 Tabs, Stellplätze, Umlagerung, Kommissionierung, KI-Tagesbericht |
| BüroPilot | ✅ Vollständig | Kunden/Angebote/Aufträge/Rechnungen/Dokumente/Einkauf + Detailseiten |
| WerkstattPilot | ✅ Vollständig | Karten/Zeit/Material/Prüfprotokoll |
| MarketingPilot | ⚠️ Teilweise | Create OK; **Edit + Delete fehlen** für Kampagnen/Leads/Newsletter |
| AnalysePilot | ✅ Live-Daten | Recharts + Supabase, Demo-Fallback |
| PlanungPilot | ✅ Vollständig | Projekte/Aufgaben/Kalender/Ressourcen |
| KI-Assistent | ✅ Vollständig | Tagesbrief/OCR/Chat + Aktions-Ausführung (gpt-4o-mini) |
| SteuerPilot | ✅ Vollständig | Belege, OCR-Upload, DATEV-Export |
| QM-Pilot | ✅ Vollständig | Checklisten, Audits, Maßnahmen |
| Cloud & Sync | ✅ Live-Basis | echte Kennzahlen, Aktivität, Storage — kein vollwertiges Backup-Backend |
| Einstellungen | ✅ Vollständig | Profil/Firmendaten/Billing/Benachrichtigungen/Design/Rollen/Info |
| PondruffPilot | ✅ Vollständig | OCR, Preisrechner, Bauteile-Sync, Feature-Flags |

---

## 4. Bekannte Bugs (P0 — aus QA 2026-05-19, **verifiziert 2026-05-20**)

### ✅ Race Condition Angebots-Nummer (erledigt 2026-05-20)
- Migration `20260524100000_pk_next_angebot_number_atomic.sql` deployed.
- `pk_next_angebot_number()` nutzt jetzt atomare `INSERT ... ON CONFLICT` auf `billing_sequences` (analog zu `pk_next_invoice_number`).
- Pro Jahr mit aktuellem MAX seeded → keine Doppelvergabe möglich.
- Smoke-Test live: 2× hintereinander → ANG-2026-00001, ANG-2026-00002 ✓

### ✅ PDF-Archivierung (erledigt)
- `archiveRechnungPdf`/`archiveAngebotPdf` werden über `generateRechnungPDFAuto`/`generateAngebotPDFAuto` (`lib/pondruff-pdf.ts`) aufgerufen.
- `components/buero/RechnungenTab.tsx` + `AngeboteTab.tsx` nutzen die `*Auto`-Variante mit `{ archive: true }`.

### ✅ Pondruff: Preiskonfig (erledigt — heute 2026-05-20)
- `lib/pondruff.ts` Z. 50–51: „Single source of truth: pondruff-price-config.json — KEINE DB-Überschreibung mehr."
- DB-Tabelle `pondruff_price_config` ist obsolet; Werte sind im Code fix.

### ✅ Cloud-Backup (erledigt)
- `app/api/backup/manual/route.ts` existiert: dumpt 25 Tabellen, gzip, lädt in Storage-Bucket `db-backups`.
- `createCloudBackup()` in `lib/db.ts` ruft diesen Endpoint auf.

---

## 5. Offene Aufgaben

### 🟡 Feature-Vervollständigung
- [ ] **MarketingPilot**: Edit + Delete für Kampagnen/Leads/Newsletter

### 🟢 Grafikdesigner-Folge
- [ ] H1 Schriftart entscheiden (Inter / IBM Plex / System)
- [ ] H2 Produktfotos für Hero / OG-Images
- [ ] H5 PDF-Vorlagen-Header (Logo + Briefpapier)

### 🔵 Langfristig
- [ ] Stripe Integration (Abos/Bezahlung)
- [ ] E-Mail-Benachrichtigungen bei Mindestbestand (echte E-Mail)
- [ ] Rollen-basierte Sidebar-Filterung
- [ ] PWA-Push-Service-Worker erweitern
- [ ] Offline-Modus

---

## 6. Nächste Empfehlung

1. **MarketingPilot Edit/Delete** als nächste Feature-Iteration.
2. **PDF-Vorlagen-Header** mit Logo (Vorbereitung Grafikdesigner-Übergabe).
3. **PWA-Push** Service-Worker erweitern.

---

## 📚 Archiv

Alle früheren Iterationen, BugFix-Sprints, Phase-Berichte → **[`PROJECT_STATUS_ARCHIVE.md`](./PROJECT_STATUS_ARCHIVE.md)** (197 KB, NICHT beim Onboarding lesen).
