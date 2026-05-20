# PROJECT_STATUS.md

> WICHTIG FÜR CODEX/CLAUDE:
> Lies zuerst diese Datei.
> Aktualisiere sie nach jeder relevanten Änderung.
> Ergänze neue Erkenntnisse im Abschnitt „Aktueller Arbeitsstand“.
> Halte alles kompakt und aktuell.
> Entferne veraltete Infos.
> Ziel: minimale Tokens, maximaler Kontext.

## 0. Schnellzugriff
- **Empfohlene Lesereihenfolge fuer Agenten**:
  1. `0. Schnellzugriff`
  2. `2. Aktueller Arbeitsstand`
  3. `5. Bekannte Probleme`
  4. `6. Offene Aufgaben`
  5. `15. Nächste Empfehlung`
- **Nur bei Bedarf lesen**:
  - `3. Wichtige technische Verknüpfungen`
  - `4. Relevante Dateien und Ordner`
  - `8. Änderungsverlauf`
  - `9.-14.` Analyse-, Roadmap- und Bewertungsabschnitte
- **Nicht jedes Mal komplett lesen, wenn nicht nötig**:
  - Der vollständige Verlauf bleibt absichtlich erhalten.
  - Für schnelle Statusfragen reichen meistens `0`, `2`, `5`, `6`, `15`.

### 0.1 Aktueller Kurzstatus
- Projekt: modulare Betriebssteuerung/ERP-Web-App mit `Next.js`, `TypeScript`, `Supabase`, `OpenAI`.
- Letzter dokumentierter Live-Stand: `2026-05-20`, `main`, **Design-Customization-Panel DP1–DP12 (vollmodular: Theme + Akzent + Intensität + 7 Features)** (3 Commits `2a4f02b`–`89dc391`): Komplette User-Personalisierung des Designs. **DP1** `2a4f02b` (Foundation, Teil 1 - lib): `lib/design-flag.ts` um vollständiges `DesignPrefs`-Objekt erweitert mit `theme`, `accent` (6 Farben: blue/cyan/purple/green/orange/red), `glowIntensity` (off/subtle/medium/strong), `features` (7 Booleans: A5/A6/A7/P1/P2/P3/P4). Neue Hooks `useDesignPrefs()` + `readDesignPrefs()` + `writeDesignPrefs()` + `patchDesignPrefs()`. Migration aus Legacy-Keys, alle alten APIs rückwärtskompatibel. 11 Body-Attribute werden automatisch gesetzt. **DP2–DP10** (Foundation, Teil 2 - CSS): ~250 Zeilen CSS in `app/globals.css` mit allen `body[data-*]`-Selektoren: DP2 6 Akzentfarben via CSS-Variablen, DP3 Glow-Intensität als Schatten-Multiplikator, DP4 (A5) Badges als Status-Pills mit Punkt-Prefix, DP5 (A6) akzentfarbener Focus-Ring App-weit, DP6 (A7) Toast-Scale+Blur-Animation, DP7 (P1) vereinheitlichte KPI-Cards, DP8 (P2) Sticky Table-Headers, DP9 (P3) sanftere Sidebar-Slide, DP10 (P4) aufgehelltes Hintergrund-Schema. **DP11+DP12** `89dc391` (UI + Integration): Neue Komponente `components/einstellungen/DesignCustomizationPanel.tsx` mit 4 Sektionen — Theme-Radio-Cards, Akzent-Farbkacheln (disabled außerhalb Glow), Intensität-Stufen, 7 Feature-Switches mit eigenem Icon+Beschreibung. „Standard"-Button für Reset auf `DEFAULT_PREFS`. URL-Tipp-Box. A11y `role=radio/radiogroup/switch`. Einstellungen-Seite rendert jetzt `DesignCustomizationPanel`. Alte Komponenten `DesignV2Toggle` + `DesignThemeSelector` bleiben im Codebase für Rückwärtskompat. Default-Prefs = classic + blue + medium + alle Features aus → bestehende User sehen weiterhin klassisches Design. HEAD `89dc391`.
- Davor: **Glow-Design G1–G4 (3-Wege-Theme-Selector classic/modern/glow)** (4 Commits `4bab9aa`–`b814b5c`, plus Deploy-Trigger `40ef52d`): Drittes Design-Theme „Glow" zusätzlich zu Klassisch und Modern eingeführt — übernimmt das Pondruff-Glow-Feeling (Gradient + Box-Shadow-Glow) auf die App-Hauptfarbe Blau. **G1** `4bab9aa`: `lib/design-flag.ts` um Theme-Enum erweitert (`'classic'|'modern'|'glow'`), neuer Hook `useDesignTheme()` + `setDesignTheme()`, alter `useDesignV2()` bleibt rückwärtskompatibel. Neuer localStorage-Key `pk_design_theme`, Legacy-Key gespiegelt. URL akzeptiert `?design=classic|modern|glow|v1|v2`. **G2** `a9f8d66`: `app/globals.css` mit Blue-Glow-CSS-Block (`body[data-design="glow"]`): Body-Hintergrund verstärkt, Primär-Button mit Gradient + Glow + Hover-Lift, Ghost-Button blau getönt, Karten mit Tiefen-Gradient + Glow-Border, Inputs mit blauem Focus-Ring, Tabellen-Header + Links + Status-Pills + Legacy-Badges mit Akzent-Glow. **G3** `579970b`: Glow für Sidebar (dunkler Gradient + Inset-Glow + Active-Push), Bottom-Nav (Glas-Effekt + Backdrop-Blur + Active-Icon-Lift + Push-Filter). `Sidebar.tsx` um `data-active`-Attribut auf allen 3 Nav-Listen erweitert (robusterer Selector). **G4** `b814b5c`: Neue Komponente `components/einstellungen/DesignThemeSelector.tsx` mit 3 Auswahl-Karten (a11y `role=radio/radiogroup`, Gradient-Preview, Emoji + Beschreibung + aktive Markierung mit Glow). Ersetzt visuell den alten `DesignV2Toggle` in `einstellungen/page.tsx` — alte Komponente bleibt im Codebase. Default `classic` → keine Änderung für aktuelle User ohne Aktion. HEAD `40ef52d`.
- Davor: **Design-V2 Migration M1–M6 (Feature-Flag-basiert)** (6 Commits `9301bad`–`be8a7c7`, plus Design-Vorschau `37fd975` + Trigger-Empty `195f1f1`): Neues Design als opt-in via Feature-Flag aktivierbar — bestehende Nutzer sehen weiterhin klassisches v1. **M1** `9301bad`: `lib/design-flag.ts` mit `useDesignV2()`-Hook + URL-Param `?design=v2/v1` + localStorage + Tab-Sync via `storage`-Event + Body-Attribut `data-design="v2"`. **M2** `31e93eb`: `components/Sidebar.tsx` — neue `V2_ICONS`-Map + `NavIcon`-Helper, Logo (PNG vs. SVG-Komponente), alle 3 Listen (Hauptnav, Pondruff, Piloten) conditional. **M3** `0949f00`: `app/dashboard/layout.tsx` Bottom-Nav mit `BN_V2_ICONS`-Map. **M4** `9c8d154`: CSS-Regel `body[data-design="v2"] .pk-card.fade-in` aktiviert Scale+Blur-Animation App-weit ohne TSX-Refactor (nutzt `pk-modal-card-in` Keyframe aus G8). **M5** `63ff7e2`: `components/EmptyState.tsx` als Drop-in mit Auto-Detect der `kind` aus `usePathname()` → bei v2 intern `EmptyStateIllustrated`, bestehende 5 Aufrufer unverändert. **M6** `be8a7c7`: `components/einstellungen/DesignV2Toggle.tsx` mit Switch in Einstellungen (vor Push-Benachrichtigungen). **Design-Vorschau** `37fd975`: `/dashboard/design-vorschau` Route zeigt alle G1–G8 Bausteine interaktiv. Default v1 → keine sichtbare Änderung für aktuelle User. HEAD `be8a7c7`.
- Davor: **AB-PDF: Rabatt + Rabatt-Preis Spalten**: PDF-Tabelle zeigt bei Rabatt > 0 jetzt 7 Spalten: Pos | Beschr | Menge | Einzelpreis (= Listenpreis) | Rabatt% (rot) | Rabatt-Preis (fett) | Gesamt; bei AB ohne Rabatt klassisches 5-Spalten-Layout. HEAD `b27244a`.
- Davor: **Pondruff Preise: Single Source of Truth (JSON-only)**: Admin-Bereich entfernt, `getPriceConfig()` liest jetzt ausschließlich `lib/pondruff-price-config.json` (keine DB-Override mehr), DB-Tabelle `pondruff_price_config` gedroppt. Formel verifiziert gegen User-Excel: 10×20×30 Meta-S = 8.50 €, Ø30×30 Meta-S = 25.50 €. HEAD `2ac0eb8`.
- Davor: **Design-Sprint G1–G8 (Grafikdesigner-Vorbereitung)** (8 Commits `7143c2c`–`4a9a980`): Komplett additiv — keine bestehende Komponente/Klasse entfernt. G1: `lucide-react@1.16.0` + `components/brand/PilotIcon.tsx` (semantisches Name-Mapping). G2: Typography-Scale (`pk-h1/h2/h3/h4`, `pk-body`, `pk-body-lg`, `pk-caption`, `pk-label`, `pk-mono`) in `app/globals.css`. G3: `components/brand/Logo.tsx` als reines SVG (Varianten `full`/`mark`/`wordmark`). G4: `components/EmptyStateIllustrated.tsx` mit 12 pilot-spezifischen SVG-Motiven + Akzentfarben. G5: `components/OnboardingProgress.tsx` (numbered/bar/dots, a11y-konform). G6: `docs/DESIGN_HANDOVER.md` als Übergabe-Doku an Grafikdesigner (Marketing-Site separates Repo). G7: Semantische Farb-Tokens `--success/--warning/--danger/--info/--neutral` + Pilot-Tokens + `.pk-status-*` Pill-Klassen. G8: Modal-Animationen (`pk-modal-overlay/card/sheet`, Out-States via `data-state="closing"`, prefers-reduced-motion). HEAD `4a9a980`.
- Davor: **QM-KI Feature-Flags + Auto-Access Inhaber/Pondruff** (Aufgaben 1–8 + 10, Commits `3e122ee`–`a7bb87e`): Inhaber + Pondruff auto-QM-Pilot-Zugang in `getAccessProfile()`, SQL-Migration `qm_ki_zeichnungs_analyse/qm_ki_sichtpruefung` DEFAULT false, `getQmKiSettings()` + `updateQmKiSettings()` in `lib/db.ts`, `getServerQmKiSettings()` in `lib/ai-settings.ts`, API-Guards in beiden QM-KI-Routen (Demo-Mock → Feature-Flag → Rate/Cost), Client-seitige UI-Sperre (disabled Button + Teal-Hinweis-Box), QM-KI-Sektion im `OwnerAiControlPanel` mit Kunden-Dropdown + Teal-Toggles + Auto-Lock für Inhaber/Pondruff, Owner-API `GET/PATCH /api/owner/qm-ki-flags` mit Auto-Schutz + Audit-Log. Manuelle E2E-Tests (Aufgabe 9) in Production ausstehend. HEAD `a7bb87e`.
- Davor: **AB-Rabatt-Klarstellung**: User-Klarstellung — AB hat 2 Rows pro Position (Beschichtung + Polieren) mit selber Pos.-Nr, Beschichtungs-Row zeigt literalen Rabatt% (z.B. 10), Polier-Row hat 0% Rabatt; im AB-PDF neue Rabatt-Summenzeile vor Netto ("Rabatt 10% auf Beschichtungen: -9,00 €"); PDFPosition Type um listenpreis + rabatt_pct erweitert. HEAD `ae798e4`.
- Davor: **WE-AB-Fix: 1 Row pro Position + Art.-Nr. im PDF + Datei-Picker + Arbeitskarte-Layout**: AB-Konvertierung kombiniert Beschichtung + Polieren in 1 Row (multi-line Beschreibung) statt 2 separate Rows; Artikelnummer wird im AB-PDF "Art.-Nr.: ABC" vor Beschreibung prepended; Foto-Inputs öffnen jetzt OS-Picker (Galerie+Kamera) statt nur Kamera; Arbeitskarte: GAP_Y 1.5→4mm zwischen Reihen, BOTTOM_H 30→28mm, kompaktere Zeilen damit Zusatzinfos in Pos.1 nicht in Pos.3 ragen. HEAD `ffb5d46`.
- Davor: **QM Phase 3B: SPC-Trend-Analyse (Cp/Cpk)**: API `/api/qm/spc-daten`, `calculateSPC()` mit Cp/Cpk/CPU/CPL/Trend (lineare Regression), SPC-Panel im Statistiken-Tab (Bauteil/Messstelle-Dropdown, 4 KPI-Karten, LineChart mit USL/LSL/Soll/Ø), Cpk-Warn-Karte im Dashboard (< 1.0), Demo-Modus mit 20 statischen Messwerten. HEAD `299b4b1`.
- Davor: **WE-Workflow: Artikelnummer, Polierkosten, AB-Rabatt**. HEAD `04fd0d7`.
- Davor: **QM Phase 3A komplett** (4 Aufgaben): CSV-Export Archiv, QR-Code Bauteil-ID (PDF+UI), E-Mail PDF via Resend/mailto, Messmittel-Kalibrierungs-Tab (ISO 9001 §7.1.5). HEAD `7ce3a3d`.
- Davor: **Arbeitskarte 2×3 Grid + neues Footer-Layout**: 2 Spalten × 3 Reihen = 6 Pos./Seite. HEAD `10e46df`.
- Davor: **QM Phase 2 — KI-Sichtprüfung live**: `POST /api/qm/sichtpruefung` mit gpt-4o Vision, neue Spalte `qm_fotos.ki_analyse_ergebnis` (jsonb), Wizard-Schritt 5 mit aktivem KI-Button + Ergebnis-Card (Befunde, Empfehlung, Hinweise) + „Befund übernehmen"-Logik, 🤖 KI-Badge in Dashboard + Archiv, Demo-Mock-Response, Cost-Tracking + Rate-Limit + RLS-Pfad-Check. HEAD `28b89b7`. Damit Phase 2A 5/5 ✅.
- Davor: **Arbeitskarte kompakt 3×2 Grid + WE-Workflow-Erweiterungen**: 6 Positionen/Seite statt 2 (3 Spalten × 2 Reihen), Service-Checkboxen 2×3 eng, Meta-Header 1-zeilig; WE-Löschen mit Bestätigung; Büro/WISO: 📦 Archivieren + 💶 AB-Konvertierung (Preis aus Maßen); Archiv zeigt nur archivierte WEs mit 🖨️-Button. HEAD `f9228ce`.
- Davor: **QM Phase 2A (4/5 Aufgaben)**: Team-Management (qm_team_mitglieder, Tab 👥), Push-Alerts Cron, Prüfplan-Generator (Regel-Engine, Drucken), Statistik-Dashboard mit echten Supabase-Queries + Recharts-Charts (PieChart, LineChart, BarChart). HEAD `f3d85e4` (nach Merge mit WE-Features).
- Davor: **Mobile-Fix Arbeitskarte PDF**: `window.open` → `doc.save()` — PDF lädt jetzt als direkter Download auf iOS/Android. HEAD `cc8f743`.
- Davor: **QM-Pilot Phase 1 VOLLSTÄNDIG** (8 Commits `9cef745` → `ccb4389`): DB-Schema + Storage-Buckets + CRUD (`lib/db/qm.ts`), Zeichnungs-Upload mit KI-Analyse, Zeichnungs-Detail + Edit, Prüfbericht-Wizard 6 Schritte (Messwert-Ampel + Mobile-Fotos + Sichtprüfung + DB-Speicherung), PDF-Export (`lib/qm-pdf.ts`), Archiv + Dashboard-KPIs aus echter Supabase-DB. Alle 13 Phase-1-Aufgaben ✅.
- Davor: `2026-05-20`, `main`, **QM-Pilot Konzept + Access-Grundgerüst** (2 Commits `d94a1e7` + `34056cc`): QM als buchbares Modul, Sidebar-Eintrag, Pricing (40€), Enterprise-Paket (279€), Demo-Dashboard 4 Tabs. Vollständiges Konzept-Dokument: `QM_PILOT_KONZEPT.md`.
- Davor: **5 Wareneingang-Optimierungen**: Multi-Image-OCR (bis 6 Fotos), Post-Save-Druckbutton, WE-Liste am Seitenende, visuelle Checkboxen auf Arbeitskarte, Status-Zeilen. HEAD `3fd88a8`.
- Davor: **Arbeitskarte PDF + Büropilot-Sync**: A5-Arbeitskarte druckbar, alle WE-Daten vollständig. HEAD `0d485c6`.
- Davor: **Wareneingang-Workflow-Redesign**: KI-Modus + Manuell-Modus, neue OCR-API, Positions-Details, Büro/WISO-Detailansicht. HEAD `b6f97eb`.
- Davor: **API-Konsolidierung**: Anthropic vollständig entfernt, alles über OpenAI (`gpt-4o-mini`). HEAD `fbbd1b1`.
- Davor: **BUGFIX-SPRINT-2** (P1-1 bis P1-8): 8 wichtige P1-Bugs behoben. HEAD `55821e3`.
- Davor: `2026-05-20`, `main`, **BUGFIX-SPRINT-1** (P0-1 bis P0-10): Alle 10 Release-Blocker behoben. HEAD `2b0fa7f`.
- Davor: `2026-05-20`, Branch `sprint-20-phase-d`, **Demo-Mode-Code-Migration (Sprint 20D)**: 10 Piloten-Seiten von isDemo-Daten-Routing-Branches befreit (~150 Branches), Demo-User nutzt jetzt RLS-DB-Pfad. Tests 87/87, Build grün.
- Davor: `2026-05-19`, `main`, **Demo-Mode-Foundation-Sprint** (Aufgabe 20A+B+C+E): Demo-User als echter Supabase-Account, Seed-SQL, Reset-CRON, Login-Flow, UI-Banner.
- Davor: **Compliance-Sprint** (Aufgaben 15-18): DSGVO-Export UI-Button, CONTRIBUTING+PR-Template, Backup-Restore-Drill.
- Davor: **Optimierungs-Sprint Phase-3** (HEAD `c0bbb45`): 13 Verbesserungen live (paralleler Agent).
- Davor: **Phase-2-Sprint** (HEAD `0e89a9f`): Audit-Logs, OpenAI-Cost-Tracking, Modal/Toast-Konsolidierung, Test-Coverage +47, API-Versionierung.
- Davor: **Security-Sprint** (Commits `bb920c0`–`4ceb16d`): Zod, Rate-Limiting, KI-Cache.
- Live-Deploy: https://app.petersen-ki-pilot.de (Vercel, Auto-Deploy bei Push auf main).
- TypeScript: `npx tsc --noEmit` — ✅ 0 Fehler (Stand 2026-05-19).
- Tests: `npm test` — ✅ **87 Tests** in 7 Files.
- CI: GitHub Actions (tsc + test + build) — ✅ Workflow aktiv auf main.
- Supabase Storage: ~100 GB Plan — neue Buckets `lager-bilder`, `ocr-originale`, `firma-branding`, `db-backups` (alle privat, user-scoped RLS).

### Demo-Mode-Foundation-Sprint (2026-05-19) — Aufgabe 20A+B+C+E aus Optimierungs-Plan

Foundation für RLS-basierten Demo-Mode gelegt — Demo-User ist jetzt ein echter Supabase-Account mit echten Daten in der DB statt hardcoded Frontend-Konstanten.

| Phase | Aufgabe | Commit |
|---|---|---|
| A | Demo-User in `auth.users` angelegt (UUID `5ff2cb0a-1ea0-4ba5-a6cc-54762710b68f`) + Seed-SQL mit 46 Datensätzen in 11 Tabellen | `3fbafed` |
| B | `/api/admin/demo-reset` Endpoint (GET, Auth via CRON_SECRET) — löscht alle 35 user-scoped Tabellen + Storage-Files + spielt Seed neu ein. Vercel-CRON 03:00 Uhr UTC in `vercel.json` | `29f3bbe` |
| C | `app/login/page.tsx` — Demo-Login läuft jetzt über echte `supabase.auth.signInWithPassword`-Session; `pk_demo`-Cookie wird zusätzlich gesetzt (nur noch für UI-Banner, kein Auth-Pfad mehr) | `e79c224` |
| E | `components/DemoBanner.tsx` — sichtbarer 🧪-Hinweis im Dashboard-Layout bei aktiver Demo-Session, per X dismissible (sessionStorage) | `c80e2e4` |

**Seed-Inhalt (46 Datensätze):** firma_einstellungen (1), lager_artikel (8), lager_stellplaetze (6), lager_bewegungen (6), buero_kunden (5), einkauf_lieferanten (4), werkstatt_karten (4), planung_projekte (3), marketing_kampagnen (3), marketing_leads (3), steuer_belege (3).

**Phase D bleibt offen** (graduelle Code-Migration): 580+ `if (isDemo)`-Branches in den Pilot-Pages → schrittweise pro Pilot entfernen. Demo-User kann jetzt zwar bereits den echten Daten-Pfad nutzen, aber die alten Branches blocken ihn noch teils. Empfehlung: pro Pilot ein PR, getestet mit Demo-Login.

### Zod-Hardening-Sprint (2026-05-19) — Aufgabe 17 aus Optimierungs-Plan

22 API-Routen mit Zod-Schemas abgesichert (zusätzlich zu den 5 in Aufgabe 7). Insgesamt sind jetzt **27 Routen Zod-validiert** — alle eingehenden JSON-Bodies werden geprüft, 400 + detaillierte Issues bei ungültigem Input.

| Cluster | Commit | Routen |
|---------|--------|--------|
| Admin + Auth | `d589806` | admin/users (POST/PATCH/DELETE/PUT), auth/register |
| Billing | `23fee88` | billing/stripe-link, billing/stripe-sync |
| KI/OCR/Generator | `31d7df7` | generate-angebot, ocr-beleg |
| Marketing | `9f529ca` | marketing/{autopilot, content-daily, sales-assistant} |
| Messages | `69c09fe` | messages |
| Owner | `3eb364d` | owner/{audit-log, pondruff-flags} |
| Pondruff (10) | `ede7084` | pondruff/{admin-price-config, bauteil-suche, embed-bauteil, match-kunde, ocr-lieferschein, ocr-price, sync-buero-auftrag, sync-buero-wareneingang, wiso-export, wiso-export-wareneingang} |
| Push | `51539b9` | push (POST/DELETE), push/send |

**Übersprungen (kein JSON-Body):**
- `document-ai/route.ts` — Multipart-Upload via `req.formData()`
- `pondruff/embed-backfill/route.ts` — kein Body, nur Background-Trigger
- `pondruff/wiso-debug/route.ts` — kein Body, nur ENV-Check
- `billing/stripe-webhook/route.ts` — eigene Stripe-Signatur-Validierung

### Compliance-Sprint (2026-05-19) — Aufgaben 15, 16, 18 aus Optimierungs-Plan

| # | Aufgabe | Dateien |
|---|---------|---------|
| 15 | DSGVO Datenexport (Art. 15) | API: `app/api/user/data-export/route.ts` (vom parallelen Agent, `b9d7cea`) — alle 32 User-Tabellen als JSON-Download mit `Content-Disposition: attachment`<br>UI: `components/einstellungen/DataExportButton.tsx` (Self-Service-Button mit Loading/Error-State, kann in `einstellungen/page.tsx` eingebunden werden) |
| 16 | Vercel Preview-Branches Workflow | `CONTRIBUTING.md` (Feature-Branch-Strategie, Direct-Push vs PR, Commit-Konvention)<br>`.github/PULL_REQUEST_TEMPLATE.md` (Checkliste, Test-Hinweise) |
| 18 | Backup-Restore-Drill | `docs/RESTORE.md` (3 Szenarien: Einzeltabelle / User-Recovery / Catastrophe-Recovery, 6-Monats-Drill-Plan, JSONB-Restore-Approach) |

**Phase-3 (Compliance & Ops) komplett abgeschlossen**: Aufgaben 15, 16, 17, 18 alle live. Übrig aus 20-Tasks-Plan: nur noch Phase-4-Refactorings (19 db.ts-Split bereits done durch parallelen Agent; 20 Demo-RLS offen).

### Optimierungs-Sprint Phase-3 (2026-05-19) — 13 Verbesserungen aus CTO-Analyse

| # | Verbesserung | Dateien / Commits | Status |
|---|---|---|---|
| 1 | db.ts Domain-Barrel-Split | `lib/db/{lager,buero,werkstatt,marketing,planung,index}.ts` — `eb4ef43` | ✅ |
| 2 | Aktivitätsprotokoll-UI | `components/ui/ActivityLog.tsx`, Cloud-Pilot — `b9d7cea` | ✅ |
| 3 | Onboarding-Wizard 5 Schritte | `components/OnboardingWizard.tsx`, layout.tsx — `0d4727b` | ✅ |
| 4 | ⌘K Schnellaktionen (8 Quick-Actions) | `components/GlobalSearch.tsx` — `73f40ce` | ✅ |
| 5 | KI-Cost-Limit 5 €/Monat pro User | `lib/ai-usage.ts`, 5 KI-Routen — `c3454bc` | ✅ |
| 6 | Multi-Tenant | — | ⏳ Nächster Architektur-Sprint (zu groß) |
| 7 | Idempotency-Keys Middleware + DB | `lib/idempotency.ts`, Migration — `0d4727b` | ✅ |
| 8 | OCR Async-Pipeline | — | ⏳ Braucht Queue-Infra (Inngest/Trigger.dev) |
| 9 | PDF via Workers | — | ⚠️ jsPDF ausreichend für aktuelle Scale |
| 11 | Supabase Realtime (NotificationBell) | `hooks/useRealtime.ts`, NotificationBell — `73f40ce` | ✅ |
| 12 | pg_trgm Search-Indexes (9 Tabellen) | Migration `20260519950000` — `233047e` | ✅ |
| 14 | EmptyState breiter eingesetzt | Archiv-Pilot — `28686ca` | ✅ |
| 15 | Tooltip / HelpTooltip-Komponente | `components/ui/Tooltip.tsx` — `28686ca` | ✅ |
| 16 | Skeleton-Loader | — | ✅ Bereits done (Quick-Wins-Sprint) |
| 17 | Bulk-Aktionen Lager-Bestand | `app/dashboard/lager/page.tsx` — `233047e` | ✅ |
| 18 | „Was ist neu" Changelog-Modal | `components/ui/WhatsNewModal.tsx` — `28686ca` | ✅ |
| 21 | Owner MRR/Churn Dashboard | `components/billing/OwnerMrrPanel.tsx`, `/api/owner/mrr-stats` — `b9d7cea` | ✅ |
| 23 | /api/v1 Prefix | — | ✅ Bereits done (Phase-2-Sprint) |
| 24 | Nightly DB-Backup | — | ✅ Bereits done (Storage-Sprint) |

**Noch offen (nächste Sprints):**
- 🔴 Multi-Tenant-Architektur (`organizations`-Tabelle, RLS auf `org_id`) — eigenes Sprint-Ticket nötig
- 🟡 OCR async via Inngest/Trigger.dev — Queue-Infra aufsetzen
- 🟡 Rate-Limit auf Upstash Redis migrieren (aktuell In-Memory, auf Vercel Serverless wirkungslos)
- 🟡 AVV mit Supabase/Vercel/OpenAI/Sentry — rechtlich zwingend vor Public Release
- 🟡 Datenschutzerklärung + Impressum + Cookie-Banner — rechtlich zwingend
- 🟡 DSFA für KI-Verarbeitung dokumentieren
- 🟡 Stripe Integration vollständig (Abos + Self-Service + MwSt + Rechnungsversand)
- 🟡 Test-Coverage auf 30 % (aktuell: 87 Tests, vorw. Hilfsfunktionen)
- 🟢 MFA/2FA (Supabase Auth TOTP)
- 🟢 Statuspage + öffentliches Changelog
- 🟢 Self-Service Datenlöschung + Datenexport (Art. 17/20 DSGVO)

### Phase-2-Sprint (2026-05-19) — Aufgaben 10-14 aus Optimierungs-Plan

| # | Aufgabe | Dateien | Commit |
|---|---------|---------|--------|
| 10 | User-Audit-Logs (8 Delete-Funktionen) | `supabase/migrations/20260519910000_user_audit_log.sql`, `lib/user-audit.ts`, `lib/db.ts` | `39a5790` |
| 11 | OpenAI-Cost-Tracking pro User + Owner-Panel | `supabase/migrations/20260519920000_ai_usage.sql`, `lib/ai-usage.ts`, 5 KI-Routen, `app/api/owner/ai-usage-per-user/route.ts` | `587a770` |
| 12 | Modal/Toast Foundation + 8 Refactor-Commits | `components/ui/{ConfirmModal,ToastProvider,index}.ts`, `app/layout.tsx` + 9 Dashboards/Components | `ed5dee7` → `8d2dae2` |
| 13 | Test-Coverage Phase 1 — 47 neue Tests | `tests/{validation,ai-usage,ai-cache,rate-limit}.test.ts` | `21ebce3` |
| 14 | API-Versionierung /api/v1/ (Rewrite + ADR) | `next.config.js`, `ARCHITECTURE.md` (ADR-Abschnitt) | `0e89a9f` |

**Auswirkung:**
- **Audit (10):** Lösch/Anonymize-Aktionen werden in `user_audit_log` (RLS, append-only) protokolliert — DSGVO/Forensik-Basis
- **Cost-Tracking (11):** Pro User + Route + Modell + Tokens + EUR — Owner-Cockpit kann Top-50-User auswerten, Cache-Hits zählen separat
- **Konsolidierung (12):** −260 Zeilen Boilerplate; einheitlicher Toast-Stack über `ToastProvider`; 8 Dateien auf zentrale Komponenten migriert
- **Tests (13):** 40 → 87 grüne Tests; deckt Validation, Cost-Berechnung, Cache-Key-Hashing, Rate-Limit-Buckets ab; entdeckter Bug in `hashCacheKey(undefined)` direkt mitgefixt
- **API-Versionierung (14):** `/api/v1/foo` → `/api/foo` Rewrite ist additiv (keine Breaking-Changes); ADR dokumentiert Migrationsstrategie für künftiges v2

### Security-Sprint (2026-05-19) — Aufgaben 7-9 aus Optimierungs-Plan

| # | Aufgabe | Dateien | Commit |
|---|---------|---------|--------|
| 7 | Zod-Validation auf 5 KI-Routen | `lib/validation.ts`, `app/api/openai/{mahnung,email-assistent,monatsbericht,steuerprognose}/route.ts`, `app/api/chat/route.ts` | `bb920c0` |
| 8 | Rate-Limiting auf 10 KI/OCR-Routen | `lib/rate-limit.ts`, alle KI/OCR-Routen (ai: 20/min, ocr: 10/min) | `c4d647d` |
| 9 | KI-Response-Caching für Tagesbericht | `supabase/migrations/20260519900000_ki_response_cache.sql`, `lib/ai-cache.ts`, `app/api/chat/route.ts` | `4ceb16d` |

**Schutz-Wirkung:**
- **Zod (7):** Server-seitige Input-Validierung mit Längen-Limits → kein Crash + keine 8MB-Prompts mehr möglich
- **Rate-Limit (8):** In-Memory-Limiter pro User → kostet selbst nichts, blockt Abuse-Szenarien (ai-Bucket: 20 Req/Min, ocr-Bucket: 10 Req/Min)
- **Cache (9):** Tagesbericht wird in `ki_response_cache` (user-scoped RLS, 1h TTL) zwischengespeichert → identische Anfragen sparen Token-Kosten

### Quick-Wins-Sprint (2026-05-19) — 6 Aufgaben aus Optimierungs-Plan

| # | Aufgabe | Dateien | Commit | Status |
|---|---------|---------|--------|--------|
| 1 | Sentry Error-Tracking | `sentry.client/server/edge.config.ts`, `next.config.js`, `@sentry/nextjs` | `4dc83a1` | ✅ |
| 2 | React Error Boundaries | `components/ErrorBoundary.tsx`, `app/dashboard/layout.tsx` | `d3a38c0` | ✅ |
| 3 | Loading-Skeletons (10 Piloten) | `components/ui/SkeletonCard.tsx`, `PilotSkeleton.tsx`, `*/loading.tsx` | `8ea13c4` | ✅ |
| 4 | GitHub Actions CI-Pipeline | `.github/workflows/ci.yml` | `c25e6c2` | ✅ |
| 5 | README.md + ARCHITECTURE.md | `README.md`, `ARCHITECTURE.md` | `aaf8dbd` | ✅ |
| 6 | eslint-plugin-jsx-a11y | `.eslintrc.json`, `eslint-plugin-jsx-a11y` | `5db72fb` | ✅ |

**Manuelle Folge-Schritte (alle erledigt):**
- ✅ jsx-a11y Warnings fixen — Commit `796a416`: 430 Warnings → 0 (label `htmlFor`/`id`, `div onClick` → `role="button"` + `onKeyDown`, `<img>` → `<Image>` wo möglich)
- ✅ Sentry DSN aktiviert — Commits `d593a38` + `e0f4170`: Vercel-Env-Vars gesetzt (Org `content-creators-agency`, Project `javascript-nextjs`), Free-Tier-Schutz (Performance + Replays deaktiviert, nur Errors), 5k-Errors-Limit/Monat
- ⏳ Optional offen: `SENTRY_AUTH_TOKEN` für Source-Maps-Upload (sonst minifizierte Stack-Traces in Sentry)

### Code-Qualität-Sprint (2026-05-19) — 10-Aufgaben-Optimierung
Pragmatischer Soft-Split-Ansatz: kleine sichere Wins zuerst live, große Refactorings als Vorbereitung für Folge-Sessions.

| # | Aufgabe | Datei(en) | Commit | Status |
|---|---------|-----------|--------|--------|
| 10 | PRICE_TABLE in JSON-Konfig auslagern | `lib/pondruff-price-config.json`, `lib/pondruff.ts` | `0e65aa8` | ✅ |
| 9  | OCR-Vision-Helper konsolidieren | `lib/pondruff-ocr.ts`, `app/api/pondruff/ocr-*/route.ts` | `6b9a020` | ✅ |
| 4  | Vision-Fallback in Bauteilsuche entfernen (Kosten-Spar) | `app/api/pondruff/bauteil-suche/route.ts` | `19747d3` | ✅ |
| 6  | Vitest + 22 Kern-Tests einrichten | `vitest.config.ts`, `tests/pondruff-price.test.ts`, `package.json` | `41444b3` | ✅ |
| 5  | Zentrale Modal/Toast-Komponenten + useToast-Hook | `components/ui/Modal.tsx`, `components/ui/Toast.tsx`, `components/buero/shared.tsx` | `9425e05` | ✅ |
| 7  | Service Worker beim App-Start auto-registrieren + Asset-Cache | `public/sw.js v3`, `components/ServiceWorkerRegister.tsx`, `app/layout.tsx` | `a200596` | ✅ |
| 8  | KI-Streaming-Support in /api/chat (SSE für freie Texte) | `app/api/chat/route.ts` | `3665a28` (parallel-merge) | ✅ |
| 3  | Demo-Mode-Wrapper (ifLive / skipInDemo / useDemoCheck) + 7 Tests | `lib/demo.ts`, `tests/demo-helpers.test.ts` | `26278c4` | ✅ |
| 1  | lib/db.ts Soft-Split — Helpers/Types/Normalize in _shared.ts (3412 → 3036 Zeilen) | `lib/db/_shared.ts`, `lib/db.ts` | `3022b2e` | ✅ |
| 2  | lager-helpers Soft-Split (mhdStatus, getBestStellplatz) + 11 Tests | `lib/lager-helpers.ts`, `tests/lager-helpers.test.ts`, `app/dashboard/lager/page.tsx` | `d28aa39` | ✅ |

**Voll-Refactorings bleiben offen für Folge-Sessions** (zu groß für sicheren Auto-Push):
- lib/db.ts vollständig nach Domains splitten (lager.ts, buero.ts, einkauf.ts, …) — derzeit 3036 Zeilen
- lager/page.tsx 12 Tabs in eigene Files extrahieren — derzeit ~3760 Zeilen, tief verschachtelter Page-State
- Demo-Wrapper auf alle 580 `if (isDemo)`-Altstellen anwenden — graduell, pro neuer Aufgabe

### Rechnungs-/Angebots-Archiv (2026-05-19) — GoBD-konform
- **Bucket** `rechnungen-archiv` (privat, user-scoped RLS, KEIN delete-policy für anon/auth → unveränderlich)
- **Migration** `20260519600000_rechnungen_archiv.sql`: 3 neue Spalten je Tabelle `buero_rechnungen` + `buero_angebote`: `pdf_path`, `pdf_hash` (SHA-256), `pdf_archived_at`
- **`lib/db.ts`**: `archiveRechnungPdf()`, `archiveAngebotPdf()`, `getArchivPdfSignedUrl()` — Base64 → SHA-256 → Blob → Upload → DB-Update
- **`lib/pondruff-pdf.ts`**: Auto-Wrapper bekommen `opts?: { archive?: boolean }`. Bei `archive: true` wird PDF mit `returnBase64=true` generiert, in Storage geuploadet, und parallel zum Download getriggert
- **`RechnungenTab.tsx`** + **`AngeboteTab.tsx`**: PDF-Button archiviert standardmäßig (BüroPilot-Workflow). Zusätzlicher `📎 Archiv`-Button öffnet die archivierte Version via Signed URL (1h TTL)
- **Pfad-Konvention**: `<user_id>/<jahr>/rechnung_<nummer>.pdf` (Jahresordner für einfache Steuer-Übergabe)

### Storage-Sprint (2026-05-19) — Nutzung erweiterten Supabase-Storages
| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1 | RLS Storage-Buckets anlegen | `20260519500000_storage_buckets.sql` | ✅ |
| 2 | Bild-Kompression-Util (WebP, max 1600px) | `lib/image-compress.ts` | ✅ |
| 3 | Artikel-Bild im Lager (1 Bild pro Artikel) | `lager/page.tsx`, `lib/db.ts`, `20260519510000_lager_artikel_bild.sql` | ✅ |
| 4 | OCR-Originale aufbewahren (GoBD) | `app/api/document-ai/route.ts` | ✅ |
| 5 | Firmenlogo-Kompression vor Upload | `einstellungen/page.tsx` | ✅ |
| 6 | Nightly DB-Backup (vollständiger JSON-Dump, gzipped, 30 Tage Retention) | `app/api/backup/auto/route.ts`, `20260519520000_cloud_backups_storage_path.sql` | ✅ |

**Details:**
- **Aufgabe 1**: 4 neue private Buckets mit user-scoped RLS-Policies (Pfad-Konvention `<user_id>/...`). `db-backups` ohne anon/auth-Policies — nur Service-Role-Zugriff.
- **Aufgabe 2**: `lib/image-compress.ts` mit `compressImage()` (WebP, max 1600×1600px, q=0.82) — wird in Artikel-Modal und Logo-Upload genutzt.
- **Aufgabe 3**: Spalte `bild_path` in `lager_artikel`. Modal mit Upload-Vorschau + Kompressions-Info (Original→Komprimiert KB). Thumbnail-Spalte in Bestand-Tabelle (Lazy-Loading). Signed URLs (1h TTL, CDN-cached). Cleanup: `deleteLagerArtikel()` entfernt das Bild aus Storage.
- **Aufgabe 4**: `app/api/document-ai/route.ts` archiviert Original (PDF/PNG/JPG) im Bucket `ocr-originale` BEVOR OpenAI analysiert — best-effort, blockiert die Analyse nicht. Pfad: `<user_id>/<date>/<timestamp>-<filename>`. Response enthält `originalPath` zur Verknüpfung.
- **Aufgabe 5**: Logo wird vor Upload via `compressImage()` auf 800×800px komprimiert (q=0.9). SVG bleibt unverändert (Vektor). PDF-Branding war bereits vollständig (`lib/pdf.ts` mit Logo-Header in 4 Layouts).
- **Aufgabe 6**: `/api/backup/auto` jetzt mit vollständigem JSON-Dump aller 26 User-Tabellen, gzipped (`zlib.gzipSync`), Upload in `db-backups/<user_id>/<date>.json.gz`. CRON_SECRET-Auth. Retention: Backups älter als 30 Tage werden automatisch gelöscht. `cloud_backups` um `storage_path` + `size_bytes` erweitert.

### OpenAI Piloten-Tools (2026-05-19, Commit 6ea978a)
- **4 neue OpenAI-gestützte Tools** — alle standardmäßig DEAKTIVIERT
  - `📊 Steuerprognose` → AnalysePilot KI-Tab · `/api/openai/steuerprognose`
  - `📨 Mahnungsgenerator` → BüroPilot KI-Tools Tab · `/api/openai/mahnung`
  - `✉️ E-Mail Assistent` → BüroPilot KI-Tools Tab · `/api/openai/email-assistent`
  - `📋 Monatsbericht Generator` → AnalysePilot KI-Tab · `/api/openai/monatsbericht`

### OpenAI Piloten-Tools (2026-05-19, Commit 6ea978a)
- **4 neue OpenAI-gestützte Tools** — alle standardmäßig DEAKTIVIERT
  - `📊 Steuerprognose` → AnalysePilot KI-Tab · `/api/openai/steuerprognose`
  - `📨 Mahnungsgenerator` → BüroPilot KI-Tools Tab · `/api/openai/mahnung`
  - `✉️ E-Mail Assistent` → BüroPilot KI-Tools Tab · `/api/openai/email-assistent`
  - `📋 Monatsbericht Generator` → AnalysePilot KI-Tab · `/api/openai/monatsbericht`
- **Supabase Migration** `20260519120000_openai_tools.sql`: 4 neue Spalten in `firma_einstellungen` (default `false`)
- **`lib/db.ts`**: `OpenAiToolSettings` Typ, `getOpenAiToolSettings()`, `updateOpenAiToolSettings()` — analog zu Marketing-KI-Pattern
- **`lib/ai-settings.ts`**: `getServerOpenAiToolSettings(userId)` — Server-Side Feature-Flag-Check
- **`OwnerAiControlPanel.tsx`**: Neue „✨ OpenAI Piloten-Tools" Sektion (grüne Akzentfarbe #10b981, 4 Toggles, 0/4 AKTIV Status)
- **Modell**: `gpt-4o-mini` · ca. 0,001–0,005 € / Aufruf

### AnalysePilot Mobile-Optimierung (2026-05-19, Commit 7ccbf03)
- **Header**: `page-header-row` + `header-actions` — stacked auf Mobile, Badges + Button wrappen sauber
- **Tab-Bar**: `pk-tab-bar` (overflow-x scroll, scrollbar-frei), kompaktere Labels, `whiteSpace: nowrap`
- **KPI-Grid**: `minmax(155px, 1fr)` → 2 Spalten ab ~340px Viewport
- **KPI-Cards**: kleinere Icons (42px), kompakteres Padding, `text-overflow: ellipsis` für Labels
- **Charts**: reduzierte Höhen — 200/220/240px statt 220/260/280px (weniger Scrollbedarf)
- **Umsatz-Tab**: flexWrap für Zeitraum-Buttons, CSV-Button kompakter mit `whiteSpace: nowrap`
- **Bestand-Tab**: `pk-table-wrap` für horizontales Scrollen der Tabelle
- **KI-Tab**: KPI-Mini-Karten 120px min, `mobile-1col` für unteres Grid
- **Zahlungsmoral**: Kundenkarten stacked mit `flexWrap`, Stats-Zeile kompakter

### 10-Aufgaben-Sprint (2026-05-19) — Alle Aufgaben abgeschlossen
| # | Aufgabe | Commit | Status |
|---|---------|--------|--------|
| 1 | Supabase DB-Indizes (23 Indexes auf Haupttabellen) | `9d63694` | ✅ |
| 2 | Standardisiertes Error-Handling + Retry in allen 8 Piloten | `b656e66` | ✅ |
| 3 | Tab-Lazy-Loading in Lager- und BüroPilot | `ef6e0ba` | ✅ |
| 4 | Marketing Edit/Delete | — | ✅ bereits implementiert |
| 5 | Büro Workflow-Buttons | — | ✅ bereits implementiert |
| 6 | URL Filter-/Tab-Persistenz (Lager, Büro, Werkstatt, Marketing, Steuer) | `24ae1d7` | ✅ |
| 7 | Dashboard „Zuletzt besucht"-Widget (localStorage) | `02299f4` | ✅ |
| 8 | Globale Suche erweitert (Lager, Kunden, Rechnungen, Werkstatt live) | `bfdd70c` | ✅ |
| 9 | PDF-Berichte für Analyse und Lager (jsPDF, Dark-Theme) | `3288426` | ✅ |
| 10 | Mobile Swipe-Gesten für Tab-Navigation (`useSwipeTabs` Hook) | `2a6c4de` | ✅ |

#### Details Sprint-Aufgaben
- **Aufgabe 1**: `supabase/migrations/20260519100000_performance_indexes.sql` — 23 Indexes über lager, buero, werkstatt, marketing, planung, steuer, cloud.
- **Aufgabe 2**: Alle Piloten (lager, buero, werkstatt, marketing, analyse, planung, steuer, cloud) haben jetzt standardisierten Error-Banner mit `pk-btn-ghost`-Retry-Button und `loadData()`-Funktion auf Komponentenebene.
- **Aufgabe 3**: `loadedTabs: Set<string>` in lager/page.tsx und buero/page.tsx; stellplaetze/umlagerung/angebote+auftraege werden erst bei Tab-Wechsel geladen.
- **Aufgabe 6**: `useRouter` + `useSearchParams` in allen Piloten; `setTab`-Wrapper schreibt URL-Params mit `router.replace`.
- **Aufgabe 7**: `lib/recent.ts` (neu) — `trackVisit()` + `getRecentVisits()` via localStorage; Dashboard zeigt „🕐 Zuletzt besucht"-Widget.
- **Aufgabe 8**: `components/GlobalSearch.tsx` neu geschrieben — live Supabase-Queries (Promise.allSettled, 300ms Debounce, max 3 Treffer/Kategorie); Demo-Fallback auf statische Daten.
- **Aufgabe 9**: `lib/pdf.ts` um `generateAnalysePDF()` und `generateLagerberichtPDF()` erweitert; dynamischer jsPDF-Import (SSR-sicher); Buttons in analyse/page.tsx und lager/page.tsx.
- **Aufgabe 10**: `hooks/useSwipeTabs.ts` (neu) — passive Touch-Events, 60px Mindest-Swipe; in LagerPilot, BüroPilot, WerkstattPilot integriert.

- Jüngste Fortschritte (2026-05-19 – Marketing-KI Sprint):
  - **Marketing-KI Module (offline by default):** 3 neue OpenAI-gestützte KI-Suite-Kacheln live eingebaut
    - `📊 Was soll ich morgen posten?` → `/api/marketing/content-daily`
    - `🚀 Autopilot-Marketing` → `/api/marketing/autopilot`
    - `🗣️ KI-Vertriebsassistent` → `/api/marketing/sales-assistant`
  - **Feature-Flag-System:** 3 neue Spalten in `firma_einstellungen` (default `false`) — Migration eingespielt
  - **Owner-Dashboard:** `OwnerAiControlPanel` um „Marketing-KI Module" Sektion erweitert (3 Toggles)
  - **MarketingPilot KI-Suite:** `DemoLabTab` zeigt „✨ KI jetzt ausführen" Button für die 3 aktiven Module mit strukturierter Ergebnis-Anzeige
  - **Sicherheit:** Alle Routen prüfen Auth + Feature-Flag vor OpenAI-Aufruf — kein API-Kosten ohne Aktivierung
  - **OpenAI Kostenübersicht (2026-05-19):** Live-Kostenanzeige im Inhaber-Kundensteuerung-Bereich — Commit `7c77673`
    - `app/api/owner/openai-usage/route.ts`: fetcht tagesweise Usage-Daten von OpenAI API, berechnet EUR-Kosten
    - `components/billing/OwnerOpenAiCostsPanel.tsx`: Gesamtkosten, Tokens, Balkendiagramm, ausklappbare Preistabelle
    - Preistabelle listet alle 7 KI-Tools mit Richtwertkosten pro Aufruf
    - Link zu platform.openai.com/usage direkt in der Ansicht
  - Aufgabe 2: cron push-alerts Spaltenfehler behoben (summe statt gesamtbetrag) + early-return ohne Subscriptions — Commit `ef5c142`
  - Aufgabe 3: Zod-Validierung für /api/chat — 400 Bad Request bei malformed Body — Commit `2ab7b25`
  - Aufgabe 6: DB-Indexes für Status/Faellig/MHD-Spalten (8 Indexes) + Migration eingespielt — Commit `01ebdce`
  - Aufgabe 7+8: EinkaufTab Demo→Live + MarketingPilot Edit/Delete waren bereits vollständig implementiert
  - Aufgabe 11: SkeletonCard-Komponente + Loading-Skeletons in Dashboard/Analyse/Lager/Werkstatt/Büro — Commit `8ef5305`
  - Aufgabe 12: EmptyState-Komponente + leere Zustände in Kunden/Karten/Projekte/Kampagnen/Bestand — Commit `69d85ad`
  - Aufgabe 13: einkaufspreis-Spalte in lager_artikel (Migration eingespielt) + Modal-Feld + upsertLagerArtikel erweitert — Commit `b9185eb`
  - ✅ Aufgabe 4 (Refactoring): BüroPilot `page.tsx` (4243 Zeilen) in separate Tab-Komponenten aufgeteilt — Commit `ef0d045`
    - `types/buero.ts`, `components/buero/shared.tsx`, `KundenTab`, `AngeboteTab`, `AuftraegeTab`, `RechnungenTab`, `EingangsrechnungenTab`, `DokumenteTab`, `PipelineKanbanTab`, `AlertsTab`, `EinkaufTab`
    - `app/dashboard/buero/page.tsx` auf ~145 Zeilen reduziert (nur noch BueroPilotPage)
- Infrastruktur: PreToolUse-Hook konfiguriert — `npx tsc --noEmit` blockiert Push bei TypeScript-Fehlern.
- ⚠️ Ausstehend: Messaging SQL-Schema manuell im Supabase SQL-Editor ausführen (Tabellen `user_messages`, `broadcast_messages`).
- ⚠️ Ausstehend: Neue SQL-Schemas ausführen (pilot_documents, tax_receipts, push_subscriptions) — Migration `20260518210000_pilot_documents.sql`.
- ⚠️ Ausstehend: VAPID Keys in Vercel Env-Vars setzen (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY).
- ⚠️ Ausstehend: Supabase Storage Bucket `pilot-documents` manuell im Dashboard erstellen.
- Produktivlage: Kernsystem vollständig; alle Hauptmodule produktionsreif und erweitert.

### 0.1.1 Optimierungs-Plan 2026-05-19 (20 Tasks, autonomes Abarbeiten)

Aus Software-Entwicklungsfirma-Audit. Reihenfolge: Quick Wins → Security → Hardening → große Refactorings. Aufruf-Befehl: `Aufgabe N starten` oder `Aufgaben 1-6 abarbeiten`.

**Quick Wins (1–3h, low-risk):**
1. Sentry Error-Tracking einrichten
2. React Error Boundaries für Dashboard
3. Loading-Skeletons pro Pilot
4. GitHub Actions CI-Pipeline (tsc + test + build)
5. README.md + ARCHITECTURE.md für Menschen
6. eslint-plugin-jsx-a11y + Auto-Fixes

**Security & Hardening (3–8h, mittel-risk):**
7. Zod-Validation-Helper + 5 kritische Routen
8. Rate-Limiting auf KI/OCR-Routen
9. KI-Response-Caching für Tagesbericht
10. Audit-Logs auf kritische Aktionen
11. OpenAI-Cost-Tracking pro User
12. Modal/Toast überall konsolidieren
13. Test-Coverage auf 60% — Phase 1
14. API-Versionierung Strategie /api/v1/

**Compliance & Operations (4–6h):**
15. DSGVO Datenexport für Nutzer (Art. 15)
16. Vercel Preview-Branches Workflow
17. Zod-Validation auf restliche 30 Routen
18. Backup-Restore-Drill dokumentieren

**Große Refactorings (1+ Tage, hoch-risk):**
19. lib/db.ts Full-Split nach Domains
20. Demo-Mode auf RLS-basiert umstellen

Status pro Task wird live in der `TaskList` gepflegt (IDs 12-31).

---

### 0.2 Top-Offene Aufgaben (Priorisiert)
- ✅ ~~**Stripe Webhook-URL** im Stripe-Dashboard prüfen und echten End-to-End-Test validieren.~~ **Erledigt 2026-05-18**.
- ✅ ~~**BüroPilot: Paketauswahl + 1-Klick-Konvertierung**~~ **Erledigt 2026-05-18**.
- ✅ ~~**Task 2: Multi-Positions-Rechnungen/-Angebote**~~ **Erledigt 2026-05-18** (Commit `043ff2e`).
- ✅ ~~**Task 3: SteuerPilot A13: ELSTER-XML-Export**~~ **Erledigt 2026-05-18** (Commit `043ff2e`).
- ✅ ~~**Task 4: MarketingPilot Edit + Delete**~~ **Erledigt 2026-05-18** (Commit `3166286`).
- ✅ ~~**Task 5: AnalysePilot Live-Daten**~~ **Erledigt 2026-05-18** (Commit `234fcc2`).
- ✅ ~~**SteuerPilot: Betrag-Input Bug + Beleg-Upload mit Kategorie/Filter/Inline-Delete**~~ **Erledigt 2026-05-18** (Commit `ec0b705`).
- ✅ ~~**MarketingPilot: Demo→Live-Calls + Edit/Delete verdrahtet**~~ **Erledigt 2026-05-18** (Commit `9c24845`).
- ✅ ~~**Supabase-Migration ausführen**: `20260518200000_steuer_belege_uploads.sql`~~ **Erledigt 2026-05-18** (manuell im SQL-Editor eingespielt).
- ✅ ~~**PlanungPilot: `deletePlanungRessource` fehlt**~~ **Erledigt 2026-05-18** — Funktion in `lib/db.ts` ergänzt + in `planung/page.tsx` importiert + `handleDelete` verdrahtet.
- ✅ ~~**AnalysePilot: Offene-Angebote-Status-Filter falsch**~~ **Erledigt 2026-05-18** — `'Entwurf'/'Gesendet'` → `'Erstellt'/'Versendet'/'Akzeptiert'` in `analyse/page.tsx:236`.
- ✅ ~~**AnalysePilot: Pilot-Nutzungs-PieChart hardcoded**~~ **Erledigt 2026-05-18** — hardcoded Werte + Chart entfernt, Placeholder-Text eingefügt; Import `PieChart/Pie/Cell` + `fmtPct` bereinigt.
- ✅ ~~**LagerPilot: EinkaufTab / Bestellung nur Toast**~~ **Erledigt 2026-05-18** — `handleBestellungBestaetigen` ruft jetzt `upsertEinkaufBestellung()` auf; `genId` importiert.
- ✅ ~~**LagerPilot: Wareneingänge nicht im KI-Kontext**~~ **Erledigt 2026-05-18** — `einkauf_wareneingaenge` in `buildContextBlock` + Live-Query in `app/api/chat/route.ts` ergänzt.
- ✅ ~~**BüroPilot: PositionenEditor in Angeboten**~~ **Erledigt 2026-05-18** (Aufgabe 26, Commit `7033146`) — `positionen` JSONB in `buero_angebote`, Zeileneditor, Konvertierung überträgt Positionen 1:1.
- ✅ ~~**WerkstattPilot: Material → LagerPilot-Sync**~~ **Erledigt 2026-05-18** (Aufgabe 27, Commit `ae1b821`) — Materialentnahme reduziert `lager_artikel.bestand` + schreibt Lager-Bewegung.
- ✅ ~~**WerkstattPilot: Ist vs. Soll Zeitanzeige**~~ **Erledigt 2026-05-18** (Aufgabe 21, Commit `8e50d12`) — Zeitbuchungen aggregiert, Pill-Badge pro Karte, Ampelfarbe.
- ✅ ~~**PlanungPilot: FK `auftrag_id`**~~ **Erledigt 2026-05-18** (Aufgabe 30, Commit `60be09b`) — `planung_projekte.auftrag_id` FK, Button in BüroPilot, Formular-Vorausfüllung.
- ✅ ~~**AnalysePilot: Zeitraum-Filter verdrahten**~~ **Erledigt 2026-05-18** (Aufgabe 15, Commit `ccc6217`) — useEffect an [zeitraum], alle DB-Queries gefiltert.
- ✅ ~~**AnalysePilot: Gewinn-KPI korrigieren**~~ **Erledigt 2026-05-18** (Aufgabe 14, Commit `148bfbe`) — steuer_fixkosten + betriebsausgaben in Gesamtkosten einbezogen.
- ✅ ~~**Analyse-Bestandstrend auf echte Snapshots umstellen**~~ **Erledigt 2026-05-18** (Aufgabe 25, Commit `5c639d7`) — Tabelle `lager_bestand_snapshots`, Snapshot-Button, Liniendiagramm.
- ✅ ~~**Owner-Sprint #7: Positions-Übernahme Angebot→Rechnung**~~ **Erledigt 2026-05-18** (Aufgabe 26, Commit `7033146`).
- ✅ ~~**Owner-Sprint #8: BüroPilot↔PlanungPilot FK**~~ **Erledigt 2026-05-18** (Aufgabe 30, Commit `60be09b`).
- ✅ ~~**Task 6: Benutzerverwaltung Deaktivieren/Löschen/Suche**~~ **Erledigt 2026-05-18** (Commit `80e0f8c`).
- ✅ ~~**Task 7: RLS-Policies vollständig**~~ **Erledigt 2026-05-18** (Commit `7aee934`).
- ✅ ~~**Task 8: Pipeline-Widget 3 KPIs**~~ **Erledigt 2026-05-18** (Commit `dadb045`).
- ✅ ~~**Owner-Sprint #2: MTD/YTD-KPIs**~~ **Erledigt 2026-05-18** (Commit `03ea362`).
- ✅ ~~**Owner-Sprint #3: Kunden-Cockpit**~~ **Erledigt 2026-05-18** (Commit `021d2fc`).
- ✅ ~~**Owner-Sprint #4: Zahlungs-Alert-Center**~~ **Erledigt 2026-05-18** (Commit `1fce336`).
- ✅ ~~**Owner-Sprint #5: AnalysePilot Zeitraum-Filter**~~ **Erledigt 2026-05-18** (Commit `9a9b0ad`).
- ✅ ~~**Einkauf-Tabellen in Supabase**~~ Bereits in Migration `20260510213000` angewendet.
- ✅ ~~**Sprint-Aufgabe 1: AnalysePilot Lagerwert-KPI**~~ **Erledigt 2026-05-18** (Commit `5de7454`) — 💰 Bestand × Einkaufspreis, Demo-Fallback.
- ✅ ~~**Sprint-Aufgabe 2: SteuerPilot VSt Fixkosten in UStVA**~~ **Erledigt 2026-05-18** (Commit `828bb19`) — separate Zeile "VSt Fixkosten".
- ✅ ~~**Sprint-Aufgabe 3: LagerPilot FIFO-Hinweis Warenausgang**~~ **Erledigt 2026-05-18** (Commit `3f888fa`) — älteste Charge aus `lager_stellplatz_bestand`.
- ✅ ~~**Sprint-Aufgabe 4: PlanungPilot Auto-Fortschritt 100%**~~ **Erledigt 2026-05-18** (Commit `7a47b1a`) — wenn alle Aufgaben erledigt.
- ✅ ~~**Sprint-Aufgabe 5: BüroPilot DSGVO-Anonymisierung**~~ **Erledigt 2026-05-18** (Commit `12d72fe`) — Admin-only, 2-Klick-Bestätigung.
- ✅ ~~**Sprint-Aufgabe 6: AnalysePilot DB-Queries auf 12 Monate begrenzen**~~ **Erledigt 2026-05-18** (Commit `225e967`).
- ✅ ~~**Sprint-Aufgabe 7: AnalysePilot CSV-Export Umsatz**~~ **Erledigt 2026-05-18** (Commit `3c8337e`) — Blob-Download, Dateiname mit Datum.
- ✅ ~~**Sprint-Aufgabe 8: PlanungPilot Empty States alle 4 Tabs**~~ **Erledigt 2026-05-18** (Commit `14398cf`).
- ✅ ~~**Sprint-Aufgabe 9: BüroPilot Duplikat-Erkennung Kunden**~~ **Erledigt 2026-05-18** (Commit `42f7e07`) — E-Mail-Check inline.
- ✅ ~~**Sprint-Aufgabe 10: SteuerPilot Fälligkeits-Kalender-Widget**~~ **Erledigt 2026-05-18** (Commit `c518952`) — Ampel + Dauerfristverlängerung-Toggle.
- ✅ ~~**Sprint-Aufgabe 11: PlanungPilot Ressourcen-Konflikt-Erkennung**~~ **Erledigt 2026-05-18** (Commit `fe81c66`) — Überlastet-Badge + Formular-Warnung.
- ✅ ~~**Sprint-Aufgabe 12: WerkstattPilot Qualitäts-KPI**~~ **Erledigt 2026-05-18** (Commit `b63ac0e`) — Fehlerquote %, Sparkline 8 Wochen.
- ✅ ~~**Sprint-Aufgabe 13: Karten-Auto-Erstellung aus BüroPilot**~~ **Erledigt 2026-05-18** (Commit `d498b72`) — URL-Params, Formular-Vorausfüllung in WerkstattPilot.
- ✅ ~~**Sprint-Aufgabe 14: AnalysePilot Gewinn-KPI strukturell korrigiert**~~ **Erledigt 2026-05-18** (Commit `148bfbe`) — Fixkosten + Betriebsausgaben einbezogen.
- ✅ ~~**Sprint-Aufgabe 15+16: Zeitraum-Filter + SteuerPilot Stripe-Einnahmen**~~ **Erledigt 2026-05-18** (Commit `ccc6217`).
- ✅ ~~**Sprint-Aufgabe 17: BüroPilot Angebots-Reminder**~~ **Erledigt 2026-05-18** (Commit `5558c75`) — Alters-Badge (7/14+ Tage), Filter-Button.
- ✅ ~~**Sprint-Aufgabe 18: PlanungPilot Zeiterfassung**~~ **Erledigt 2026-05-18** (Commit `c64eb68`) — `stunden_soll`/`stunden_ist`, Fortschrittsbalken, Migration eingespielt.
- ✅ ~~**Sprint-Aufgabe 19: Eingangsrechnung → SteuerPilot-Sync**~~ **Erledigt 2026-05-18** (Commit `8529482`) — Auto-Betriebsausgabe bei Bezahlung.
- ✅ ~~**Sprint-Aufgabe 20: BüroPilot OPOS-Dashboard**~~ **Erledigt 2026-05-18** (Commit `a677a44`) — 3 Fälligkeits-Buckets, klickbarer Filter.
- ✅ ~~**Sprint-Aufgabe 21: WerkstattPilot Ist vs. Soll Zeitanzeige**~~ **Erledigt 2026-05-18** (Commit `8e50d12`) — Pill-Badge, Ampelfarbe pro Karte.
- ✅ ~~**Sprint-Aufgabe 22: LagerPilot lieferant_id FK**~~ **Erledigt 2026-05-18** (Commit `a2762c0`) — FK auf `einkauf_lieferanten`, Dropdown, Migration eingespielt.
- ✅ ~~**Sprint-Aufgabe 23: BüroPilot KI-Angebotstext**~~ **Erledigt 2026-05-18** (Commit `159da86`) — ✨ Button, API-Route `generate-angebot`.
- ✅ ~~**Sprint-Aufgabe 24: SteuerPilot SKR04-Buchungsvorschlag**~~ **Erledigt 2026-05-18** (Commit `cd7a1b1`) — KI-Badge im Beleg-Modal, Timeout 3s.
- ✅ ~~**Sprint-Aufgabe 25: Bestandstrend-Snapshots**~~ **Erledigt 2026-05-18** (Commit `5c639d7`) — Tabelle `lager_bestand_snapshots`, 📸-Button, Liniendiagramm in AnalysePilot.
- ✅ ~~**Sprint-Aufgabe 26: BüroPilot Positionen-Editor in Angeboten**~~ **Erledigt 2026-05-18** (Commit `7033146`) — JSONB, Konvertierung überträgt Positionen.
- ✅ ~~**Sprint-Aufgabe 27: WerkstattPilot Material → Lager-Sync**~~ **Erledigt 2026-05-18** (Commit `ae1b821`) — Bestand −, Bewegungslog.
- ✅ ~~**Sprint-Aufgabe 28: WerkstattPilot Fertigungsleitstand**~~ **Erledigt 2026-05-18** (Commit `e7e76d4`) — neuer Tab, 3-Spalten-Kanban, SLA-Ampel, Batch-Aktionen.
- ✅ ~~**Sprint-Aufgabe 29: SteuerPilot OCR-Erkennung**~~ **Erledigt 2026-05-18** (Commit `a5d595c`) — API-Route `ocr-beleg`, KI füllt Felder automatisch.
- ✅ ~~**Sprint-Aufgabe 30: PlanungPilot auftrag_id FK + Meilensteine**~~ **Erledigt 2026-05-18** (Commit `60be09b`) — FK, Button in BüroPilot, Meilenstein-CRUD.
- ✅ **Mobile NotificationBell Fix** — Commit `cf8dfd3`: position:fixed, max-height calc(100dvh), scrollbar, Backdrop, Schließen-Button.
- ✅ **Dokumenten-Archiv alle Piloten** — Commit `322ad68`: PilotDocumentArchive.tsx, Tab in Lager/Werkstatt/Analyse/Planung, SQL-Migration.
- ✅ **SteuerPilot 3-stufiges Beleg-Modal** — Commit `e63cf8b`: Fixkosten/Betriebsausgaben/Anschaffungen + Kategorie + Details, Belege-Tab read-only.
- ✅ **Bottom-Nav Steuer** — Commit `f4378a6`: SteuerPilot in Bottom-Navigation hinzugefügt.
- ✅ **PWA Push-Benachrichtigungen** — Commit `02e91a0`: sw.js, lib/push.ts, API-Routen, Einstellungen-UI.
- ✅ ~~**Supabase SQL ausführen**~~ — Migration `20260518210000_pilot_documents.sql` (pilot_documents + tax_receipts + push_subscriptions) **eingespielt 2026-05-18**.
- ✅ ~~**VAPID Keys setzen**~~ — Vercel Env-Vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY **gesetzt 2026-05-18**.
- ✅ ~~**Supabase Storage Bucket**~~ — `pilot-documents` **erstellt 2026-05-18** (authenticated read/write, owner delete).
- ✅ ~~**Messaging SQL-Schema ausführen**~~ — Tabellen `user_messages` + `broadcast_messages` + RLS-Policies **eingespielt 2026-05-18**.
- ✅ ~~**LagerPilot: Umlagerung atomarisieren**~~ — RPC `umlager_artikel` in `20260519020000_umlager_artikel_rpc.sql` erstellt; `lib/db.ts` nutzt `supabase.rpc()`.
- ✅ ~~**LagerPilot: Dual-Layer-Bestandssync**~~ — Trigger `trg_sync_bestand` in `20260519030000_bestand_sync_trigger.sql` erstellt; `lager_artikel.bestand` wird automatisch bei jedem Stellplatz-Update aktualisiert.
- ✅ ~~**WerkstattPilot: FK `buero_auftrag_id`**~~ — Migration `20260519040000_werkstatt_karte_buero_auftrag_fk.sql` erstellt; `werkstatt_karten.buero_auftrag_id` referenziert `buero_auftraege.id`; UI-Dropdown im Formular.
- ✅ ~~**Owner-Sprint #6: Pipeline-Kanban-View**~~ — `PipelineKanbanTab` in `buero/page.tsx` — 5 Spalten, Σ-Summen, klickbar.
- ✅ ~~**Owner-Sprint #9: Zahlungsmoral-Report**~~ — Tab `💳 Zahlungsmoral` in `analyse/page.tsx` — Ø Verzug, Mahnquote, Ampelfarben je Kunde.
- ✅ ~~**Aufgabe 2: cron push-alerts Spaltenfehler**~~ — `ef5c142` summe statt gesamtbetrag, early-return ohne Subs.
- ✅ ~~**Aufgabe 3: Zod-Validierung /api/chat**~~ — `2ab7b25` 400 Bad Request bei malformed Body.
- ✅ ~~**Aufgabe 6: DB-Indexes**~~ — `01ebdce` 8 Indexes auf Status/Faellig/MHD, Migration eingespielt.
- ✅ ~~**Aufgabe 11: Loading Skeletons**~~ — `8ef5305` SkeletonCard in Dashboard/Analyse/Lager/Werkstatt/Büro.
- ✅ ~~**Aufgabe 12: EmptyState**~~ — `69d85ad` EmptyState-Komponente in 5 Piloten eingebaut.
- ✅ ~~**Aufgabe 13: einkaufspreis-Spalte lager_artikel**~~ — `b9185eb` Migration + lib/db.ts + Modal-Feld.
- 🟡 **Stripe Analytics Integration** (4h) — MRR-Verlauf im Marketing-Auswertungs-Tab.
- 🟡 **Mailchimp API** (5h) — Echtzeit-Öffnungsraten + Lead→Subscriber-Automatisierung.
- ✅ ~~**QM-Pilot Phase 1 Aufgabe 1: SQL-Migration**~~ **Erledigt 2026-05-20** (Commit `9cef745`) — 4 Tabellen + RLS + 2 Storage-Buckets via `exec_sql` live.
- ✅ ~~**QM-Pilot Phase 1 Aufgabe 2: DB-Funktionen**~~ **Erledigt 2026-05-20** (Commit `8e737e9`) — `lib/db/qm.ts` mit Typen + CRUD + Ampel-Logik + PB-Nr-Generator.
- ✅ ~~**QM-Pilot Phase 1 Aufgabe 3: Zeichnungs-Upload-Seite**~~ **Erledigt 2026-05-20** (Commit `59f6eaf`) — Drag&Drop + Komprimierung + Bibliothek.
- ✅ ~~**QM-Pilot Phase 1 Aufgabe 4: OpenAI Vision API**~~ **Erledigt 2026-05-20** (Commit `5e46226`) — `/api/qm/analyse-zeichnung` mit gpt-4o-mini + Cost-Tracking.
- ✅ ~~**QM-Pilot Phase 1 Aufgabe 5: Zeichnungs-Detail-Ansicht**~~ **Erledigt 2026-05-20** (Commit `52b71ee`) — Vorschau + Edit + KI-Analyse + „Prüfbericht starten".
- 🔴 **QM-Pilot Phase 1 Aufgabe 6: Prüfbericht-Wizard** — `/dashboard/qm/pruefen` mit 6 Schritten (Zeichnung wählen → Bauteil → Messwerte → Fotos → Sichtprüfung → Abschluss). Detail-Seite verlinkt bereits darauf.
- 🔴 **QM-Pilot Phase 1 Aufgaben 7–13** — Foto-Upload, Ampel-Live-Update, Gesamtstatus-Logik, PDF-Export `lib/qm-pdf.ts`, Archiv-DB-Anbindung, Dashboard-KPIs aus DB.

### 0.3 Aktuelle Blocker
- **Keine Blocker.** Alle SQL-Schemas eingespielt, alle Env-Vars gesetzt, Storage Bucket erstellt.
- Einige ältere Verlaufs-/Offen-Punkte weiter unten koennen historisch sein; bei Konflikten gilt der neueste Eintrag in `2. Aktueller Arbeitsstand`.

### 0.4 Quick Status Summary (für Statusabfragen)
**Letzter Stand:** 2026-05-20, **QM-Pilot Phase 2A (4/5 Aufgaben)** — Team-Management, Push-Alerts, Prüfplan-Generator, Statistik-Dashboard  
**Letzte Session:** 4 Phase-2A-Aufgaben: (1) `qm_team_mitglieder` Tabelle + RLS, DB-Funktionen, 👥 Team-Tab mit Rolle-Badges + Modal, Prüfer-Dropdown im Wizard. (2) Cron `/api/cron/qm-alerts` (07:00 täglich, Push für ungeprüfte Zeichnungen). (3) API `/api/qm/pruefplan` (Regel-Engine: Mikrometer/Messschieber/Rauheitsgerät), Prüfplan-Tab auf Detail-Seite + Drucken, Wizard-Integration. (4) 4 echte Supabase-Stat-Queries + Recharts (PieChart/LineChart/BarChart), Zeitraum-Filter.  
**Nächster Focus:** QM Phase 2B: KI-Sichtprüfung (Foto → OpenAI Vision → Befund) — oder andere Features.  
**Blocker:** Keine — Build grün, alle 4 Aufgaben committed.  
**Modell-Tipps:** Haiku für Fixes/Docs | Sonnet für Standard-Features | Opus für Architektur

## 1. Kurzüberblick
- Zweck: modulare Betriebssteuerung/ERP-ähnliche Web-App für Lager, Büro, Werkstatt, Steuer, Planung, Marketing, Dokumente und KI-gestützte Erfassung.
- Stack: `Next.js 14 App Router`, `React 18`, `TypeScript`, `Supabase Auth/Postgres/Storage`, `OpenAI` für Dokument-KI und Lager-/Chat-KI.
- Hauptmodule:
  - `LagerPilot`: Bestand, Bewegungen, Ein-/Ausgang, Inventur, Bestellvorschläge, Stellplätze, Umlagerung, Pickliste, Tagesbericht.
  - `BüroPilot`: Kunden, Angebote, Aufträge, Rechnungen, Eingangsrechnungen, Dokumente, Einkauf.
  - `WerkstattPilot`: Arbeitskarten, Zeiten, Material, Prüfungen, Mitarbeiter, Bereiche, Wartungen, Störungen.
  - `SteuerPilot`: Belege, UStVA, Prüfhinweise.
  - `PlanungPilot`: Projekte, Aufgaben, Termine, Ressourcen.
  - `MarketingPilot`: Kampagnen, Leads, Newsletter.
  - Zusatz: Dashboard, KI-Erkennung, Cloud, Archiv, Einstellungen.

## 2. Aktueller Arbeitsstand

- **Zuletzt erledigt (2026-05-20 — Design-Customization-Panel DP1–DP12, Commits `2a4f02b`→`89dc391`):**
  - **DP1 Prefs-System** (Teil von `2a4f02b`): `lib/design-flag.ts` mit vollständigem `DesignPrefs`-Objekt — `theme` (classic/modern/glow), `accent` (6 Farben), `glowIntensity` (4 Stufen), `features` (7 Booleans). Hooks: `useDesignPrefs/readDesignPrefs/writeDesignPrefs/patchDesignPrefs`. Migration aus Legacy `pk_design_theme` + `pk_design_v2`. 11 Body-Attribute werden gesetzt: `data-design`, `data-accent`, `data-glow-intensity`, `data-feat-{pills,focus,toasts,kpi,sticky,sidebar}`, `data-bg-light`.
  - **DP2–DP10 CSS-Block** (Teil von `2a4f02b`): ~250 Zeilen in `app/globals.css`. **DP2** 6 Akzentfarben (blue/cyan/purple/green/orange/red) via `--acc-1/-2/-3/-rgb` CSS-Variablen — überschreibt Glow-Btns/Cards/Inputs/Sidebar-Active. **DP3** Glow-Intensität: `off`=alle Glows aus, `subtle`=schwächer, `medium`=Standard, `strong`=intensiver+Scale-Hover. **DP4 (A5)** `.badge-*` werden Pills mit Punkt-Prefix. **DP5 (A6)** `*:focus-visible` mit akzentfarbenem 2px+5px Doppel-Ring App-weit. **DP6 (A7)** Toast-Selektoren bekommen `pk-toast-in` Animation. **DP7 (P1)** `.stats-grid > div` vereinheitlicht (Padding, Gradient, Hover-Lift). **DP8 (P2)** `.pk-table thead th { position: sticky; top: 0 }` + Backdrop-Blur. **DP9 (P3)** Sidebar `cubic-bezier(.22,1,.36,1)` Slide. **DP10 (P4)** Body-Bg heller (Karten bleiben dunkel).
  - **DP11 UI-Panel** (`89dc391`): `components/einstellungen/DesignCustomizationPanel.tsx` mit 4 Sektionen — (1) Theme-Radio-Cards mit Gradient-Preview, (2) 6 Akzent-Farbkacheln (disabled wenn !glow), (3) 4 Intensität-Stufen (disabled wenn !glow), (4) 7 Feature-Switches mit Icon + Beschreibung. „Standard"-Reset-Button. URL-Tipp-Box. A11y konform.
  - **DP12 Integration** (`89dc391`): `app/dashboard/einstellungen/page.tsx` rendert jetzt `DesignCustomizationPanel`. Alte `DesignV2Toggle` + `DesignThemeSelector` Komponenten bleiben im Codebase. `patchDesignPrefs`-TS-Signatur mit `Omit<DesignPrefs, 'features'>` korrigiert.
  - **Default-Verhalten:** Alle Defaults sind off / classic / blue / medium → bestehende User sehen keine Änderung. Aktivierung über Einstellungen → Benachricht. → „🎨 Design & Erscheinungsbild" → einzelne Schalter klicken. ODER URL `?design=glow`.

- **Zuletzt erledigt (2026-05-20 — Glow-Design G1–G4, 3-Wege-Theme-Selector, Commits `4bab9aa`→`b814b5c`):**
  - **G1 Theme-Erweiterung** (`4bab9aa`): `lib/design-flag.ts` — neuer Typ `DesignTheme = 'classic' | 'modern' | 'glow'`, Hook `useDesignTheme()`, Setter `setDesignTheme()`. Alter `useDesignV2()` bleibt — gibt `true` zurück wenn Theme ≠ `'classic'`. Neuer localStorage-Key `pk_design_theme`, Legacy-Key `pk_design_v2` wird gespiegelt für Rückwärtskompat. URL `?design=classic|modern|glow|v1|v2`. Body-Attribut `data-design="modern"` oder `"glow"` oder leer.
  - **G2 Blue-Glow Basis** (`a9f8d66`): `app/globals.css` mit 140 Zeilen Glow-CSS. Body-Background mit stärkeren radialen Gradients. `.pk-btn` mit `linear-gradient(135deg, #1684ff, #0d5cbf)` + Box-Shadow-Glow + Hover-Lift (`translateY(-1px)`) + Active-Press. `.pk-btn-ghost` mit blauem Tinted-Background + Hover-Glow. `.pk-card` mit Tiefen-Gradient + zarter Glow-Border + Hover-Highlight. `.pk-input:focus` mit blauem 3px-Glow-Ring + Background-Aufhellung. Tabellen-Header bläulich. Links mit Hover-Text-Shadow. Status-Pills (`pk-status-*`) und Legacy-Badges (`badge-blue/green/orange/red/purple`) bekommen Box-Shadow-Glow. `prefers-reduced-motion` respektiert. M4 Modal-Animationen auch für `modern` + `glow`.
  - **G3 Glow für Navigation** (`579970b`): Sidebar im Glow-Modus mit dunklerem Gradient + Inner-Glow-Border. Sidebar-Buttons mit Hover-`translateX(2px)` + Inset-Shadow. Aktive Buttons mit `linear-gradient(90deg, rgba(22,132,255,.30), ...)` + 2px Border-Left + Inset-Glow + Text-Shadow. Logo-Container mit Outer-Glow-Ring. Bottom-Nav mit Glas-Effekt (`backdrop-filter: blur(14px)`) + Blau-Akzent-Border. Aktives Bottom-Nav-Item mit `drop-shadow` Glow + Icon-Lift + Scale(1.06). Active-Click mit `filter: brightness(1.4)` Push. Tab-Bar, NotificationBell, Search-Trigger ebenfalls mit Hover-Glow. `components/Sidebar.tsx` um `data-active="true|false"` auf allen 3 Listen erweitert.
  - **G4 Theme-Selector** (`b814b5c`): Neue Komponente `components/einstellungen/DesignThemeSelector.tsx` — `role="radiogroup"` mit 3 `role="radio"` Karten. Jede Karte: Gradient-Preview-Streifen (40px hoch mit Emoji), Titel + Beschreibung + Radio-Indikator-Punkt. Aktive Karte: 2px Border in Akzentfarbe + 6px Glow + Inset-Background. Aria-checked, Click toggelt `setDesignTheme()`. URL-Hinweis am Fuß. `app/dashboard/einstellungen/page.tsx` rendert jetzt `DesignThemeSelector` statt `DesignV2Toggle` (alter Toggle bleibt im Codebase für Rückwärtskompat).
  - **Deploy-Trigger** (`40ef52d`): leerer Commit, weil Vercel-API-Limit (100/Tag) gerade erreicht ist. Auto-Deploy via Git Push fängt das auf.
  - **Default `classic`** — bestehende User sehen weiterhin klassisches Design. Aktivierung über Einstellungen-Selector ODER URL-Param `?design=glow`.

- **Zuletzt erledigt (2026-05-20 — Design-V2 Migration M1–M6 mit Feature-Flag, Commits `9301bad`→`be8a7c7`):**
  - **M1 Design-Flag** (`9301bad`): `lib/design-flag.ts` — Hook `useDesignV2()` + `setDesignV2()` + `readDesignV2()`. URL-Param `?design=v2` / `?design=v1` schreibt in localStorage. Tab-Sync via `storage`-Event. Body-Attribut `data-design="v2"` für CSS-Regeln. Default = false (klassisch).
  - **M2 Sidebar** (`31e93eb`): `components/Sidebar.tsx` — `V2_ICONS`-Map (href → PilotIconName), `NavIcon`-Helper-Komponente. Logo bei v2: neue SVG-Komponente; v1: PNG. Drei Nav-Listen (Hauptnav, Pondruff, Piloten) alle conditional.
  - **M3 Bottom-Nav** (`0949f00`): `app/dashboard/layout.tsx` — `BN_V2_ICONS`-Map + conditional Rendering im `bn-icon`-Span. PondruffSheet-Trigger nutzt weiterhin PNG-Icon.
  - **M4 Modal-Animationen** (`9c8d154`): `app/globals.css` — CSS-Regel `body[data-design="v2"] .pk-card.fade-in, .fade-in-scale` überschreibt mit `pk-modal-card-in` Keyframe (aus G8). Respektiert `prefers-reduced-motion`. Kein TSX-Refactor nötig.
  - **M5 EmptyState** (`63ff7e2`): `components/EmptyState.tsx` — bei v2 intern `EmptyStateIllustrated` mit Auto-Detect der `kind` aus `usePathname()` (lager/buero/werkstatt/marketing/analyse/planung/steuer/qm/cloud/archiv/allgemein). Optionale explizite `kind`-Prop. Bestehende 5 Aufrufer (archiv/werkstatt/lager/marketing/planung) unverändert.
  - **M6 Toggle Einstellungen** (`be8a7c7`): `components/einstellungen/DesignV2Toggle.tsx` — Switch-Komponente (role=switch, aria-checked) + Status-Anzeige + URL-Param-Hinweis. Integration in `app/dashboard/einstellungen/page.tsx`: 1 Import + 1 Render-Block direkt vor Push-Benachrichtigungen-Karte. Bestehender Inhalt zu 100% erhalten.
  - **Design-Vorschau-Seite** (`37fd975`): `/dashboard/design-vorschau` — interaktive Übersicht aller G1–G8 Bausteine. Logo, alle 22 Pilot-Icons, Typography-Scale, 12 Illustrationen, 3 Progress-Varianten, Status-Pills + Token-Kacheln, animiertes Modal. Sprung-Nav oben.
  - **Vercel-Redeploy** (`195f1f1`): leerer Commit hat ausstehende Builds für G3–G8 + Design-Vorschau getriggert (Vercel hatte die Folge-Pushes übersprungen).
  - **Default-Verhalten:** Alle bestehenden User sehen weiterhin v1 (Emoji-Icons, PNG-Logo, klassische Animationen, Emoji-EmptyStates). v2 aktivieren über Einstellungen-Toggle, `?design=v2` URL-Param oder direkten Aufruf von `/dashboard/design-vorschau`.

- **Zuletzt erledigt (2026-05-20 — Design-Sprint G1–G8 für Grafikdesigner-Übergabe, Commits `7143c2c`→`4a9a980`):**
  - **G1 Icon-Library** (`7143c2c`): `lucide-react@1.16.0` installiert. Neue Komponente `components/brand/PilotIcon.tsx` mit semantischem Namen-Mapping (`lager`/`buero`/`werkstatt`/`marketing`/`analyse`/`planung`/`steuer`/`ki`/`cloud`/`archiv`/`einstellungen`/`qm`/`pondruff` + UI-Icons `suche`/`glocke`/`start`/`menue`/`wareneingang`/`auftrag`/`beleg`/`kunden`/`preis`). Parallel zu bestehenden Emojis nutzbar — keine Migration erzwungen.
  - **G2 Typography-Scale** (`0fc5072`): `app/globals.css` um `.pk-h1` (28/24px), `.pk-h2` (22/20px), `.pk-h3` (18/17px), `.pk-h4`, `.pk-body`, `.pk-body-lg`, `.pk-caption`, `.pk-label`, `.pk-mono` ergänzt. Responsive Mobile-Breakpoint. Bestehende inline-styles unangetastet.
  - **G3 Logo-Komponente** (`bbcecb4`): `components/brand/Logo.tsx` mit drei Varianten (`full`/`mark`/`wordmark`). Reines SVG mit Brand-Gradient (`#1684ff` → `#20c8ff`), skaliert verlustfrei. Bestehende PNG-Logos und `/pondruff/banner.png` bleiben.
  - **G4 Empty-States illustriert** (`cd88f43`): `components/EmptyStateIllustrated.tsx` mit 12 pilot-spezifischen SVG-Motiven (`lager`/`buero`/`werkstatt`/`marketing`/`analyse`/`planung`/`steuer`/`qm`/`cloud`/`archiv`/`suche`/`allgemein`), pilot-eigene Akzentfarben (aus CLAUDE.md Pilot-Farben-Tabelle), Primary + Secondary Action. Bestehende `components/EmptyState.tsx` unverändert.
  - **G5 Onboarding-Progress** (`632d415`): `components/OnboardingProgress.tsx` mit drei Varianten (`numbered`/`bar`/`dots`), connector-lines zwischen Schritten, a11y (`role=progressbar`, `aria-valuenow`, `aria-current=step`). Bestehender `OnboardingWizard.tsx` bleibt unverändert.
  - **G6 Design-Handover-Doku** (`31afddd`): `docs/DESIGN_HANDOVER.md` als Übergabe an Grafikdesigner — Repo-Übersicht App vs. Marketing-Site (separates Repo), Token-Inventar, vollständige Liste der ausgelieferten Bausteine, offene H1–H8-Aufgaben (App-Icon, Favicon, PDF-Header, Email-Templates, Bottom-Nav-Migration, Sidebar-Migration), empfohlener Workflow mit `design/refresh`-Branch.
  - **G7 Semantische Farb-Tokens** (`f9acd0f`): `app/globals.css` um CSS-Variablen `--success/--warning/--danger/--info/--neutral` (jeweils mit `-bg` und `-border` Varianten) ergänzt. Pilot-Tokens `--pilot-lager`, `--pilot-buero`, … aus CLAUDE.md übernommen. Neue `.pk-status` / `.pk-status-{success,warning,danger,info,neutral}` Pill-Klassen. Bestehende `--bg`/`--panel`/`--card`/`--blue`/`--blue2`/`--green`/`--purple` und `.badge-*` Klassen unverändert.
  - **G8 Modal-Animationen** (`4a9a980`): `app/globals.css` um Keyframes `pk-modal-overlay-in/out`, `pk-modal-card-in/out`, `pk-sheet-in` ergänzt. Neue Klassen `.pk-modal-overlay` / `.pk-modal-card` / `.pk-modal-sheet`, Out-States via `data-state="closing"`, `prefers-reduced-motion` respektiert (A11y). Bestehende `.fade-in` / `.fade-in-scale` bleiben verfügbar.
  - **Strikt additiv**: Keine bestehende Komponente, Klasse oder Datei wurde gelöscht oder verändert. Migration auf neue Bausteine ist opt-in. Build + tsc beide grün, alle 8 Commits live.
  - **Folge-Aufgaben** (siehe `docs/DESIGN_HANDOVER.md`): H1 Schriftart-Entscheidung, H2 Produktfotos, H3 App-Icon, H4 Favicon-Set, H5 PDF-Header, H6 Email-Templates, H7 Bottom-Nav-Migration, H8 Sidebar-Migration. Bewusst offen — Designer-Entscheidung mit Live-Vorschau pro Schritt.

- **Zuletzt erledigt (2026-05-20 — QM-KI Feature-Flags + Auto-Access, Commits `3e122ee`→`a7bb87e`):**
  - **Aufgabe 1** (`3e122ee`): `lib/access.ts` — `getAccessProfile()` erkennt Inhaber + Pondruff-Email, fügt `'qm'` automatisch zu `allowedPilotIds` hinzu. `MetadataCarrier` um `.email?` erweitert.
  - **Aufgabe 2** (`c9034e9`): SQL-Migration `20260522100000_qm_ki_flags.sql` — `firma_einstellungen` um `qm_ki_zeichnungs_analyse boolean DEFAULT false` + `qm_ki_sichtpruefung boolean DEFAULT false` erweitert. Migration via exec_sql ausgeführt.
  - **Aufgabe 3** (`63e8f99`): `lib/db.ts` — `QmKiSettings`-Typ + `getQmKiSettings()` (mit Demo/Inhaber/Pondruff-Auto-Override) + `updateQmKiSettings()`. `FirmaEinstellungen` Typ erweitert.
  - **Aufgabe 4** (`6b350df`): `lib/ai-settings.ts` — `getServerQmKiSettings(userId, email?)` mit Auto-Override für Inhaber/Pondruff, fail-closed bei fehlendem Service-Role-Key.
  - **Aufgabe 5** (`642df25`): API-Guards in `app/api/qm/analyse-zeichnung/route.ts` + `app/api/qm/sichtpruefung/route.ts` — Reihenfolge: Demo-Mock → Feature-Flag-Check (403 + `feature_disabled: true`) → Rate/Cost-Limit.
  - **Aufgabe 6** (`1789691`): Client-Side UI-Sperre — `zeichnungen/[id]/page.tsx` + `pruefen/page.tsx`: `useEffect → getQmKiSettings()`, Buttons disabled + Opacity bei fehlendem Flag, Teal-Hinweis-Box „KI-Analyse nicht freigeschaltet".
  - **Aufgabe 7** (`fbcb916`): `OwnerAiControlPanel.tsx` — neue QM-KI-Sektion (Teal #14b8a6), Kunden-Dropdown aus `listBillingSubscriptionsForOwner`, PATCH `/api/owner/qm-ki-flags`, grüner Lock für Inhaber/Pondruff-User.
  - **Aufgabe 8** (`a7bb87e`): `app/api/owner/qm-ki-flags/route.ts` — GET (aktuelle Flags) + PATCH (Upsert + Validierung), Auto-Account-Schutz (400), Audit-Log (`qm_ki_zeichnungs_analyse.toggle` / `qm_ki_sichtpruefung.toggle`). `lib/audit-log.ts` OwnerAuditAction-Typ erweitert.
  - **Aufgabe 9**: E2E-Tests in Production — manuell ausstehend (Checkliste in `QM_PILOT_KONZEPT.md`).
  - **Aufgabe 10**: Dokumentation (`PROJECT_STATUS.md` + `QM_PILOT_KONZEPT.md`).

- **Zuletzt erledigt (2026-05-20 — QM Phase 3A: 4 Aufgaben, HEAD `7ce3a3d`, Commits `2c4a7fb`→`7ce3a3d`):**
  - **Aufgabe 1 CSV-Export** (`2c4a7fb`): Archiv-Tab: Button "📥 CSV Export" exportiert gefilterte Berichte als Semikolon-CSV (UTF-8-BOM, deutsches Excel). Per Zeile: "📊"-Button exportiert Messwerte des Berichts als CSV (Messstelle/Sollwert/Tol±/Istwert/Abweichung/Status/Prüfmittel). Demo: DEMO_BERICHTE-Export / Messwerte-Toast.
  - **Aufgabe 2 QR-Code** (`f497f36`): `npm install react-qr-code`. Prüfbericht-Wizard Schritt 6 + Erfolgs-Karte: QR-Code 100–120px (JSON-Payload: bauteil_id, pruefbericht_nr, datum, system). `lib/qm-pdf.ts`: QR via qr.js + Canvas als PNG, 22×22mm oben rechts auf Seite 1. `types/qrjs.d.ts` Modul-Deklaration.
  - **Aufgabe 3 E-Mail PDF** (`f330e42`): `npm install resend`. `app/api/qm/send-pdf/route.ts` (GET: Konfigurationsstatus, POST: Resend-Versand mit PDF-Attachment). Archiv-Tab: "📧"-Button pro Zeile öffnet Modal (Email+Name). Kein RESEND_API_KEY → mailto-Fallback mit vorausgefülltem Betreff/Body. Demo-Toast.
  - **Aufgabe 4 Messmittel-Tracking** (`7ce3a3d`): SQL-Migration `20260521200000_qm_messmittel.sql` + exec_sql ausgeführt. `lib/db/qm.ts`: `getQmMessmittel/upsertQmMessmittel/deleteQmMessmittel` mit auto-Status (ok/faellig/ueberfaellig, Schwelle 30 Tage). Neuer Tab "🔧 Messmittel": Tabelle + Modal Add/Edit + 2-Klick-Delete. Dashboard-Warn-Karte bei überfälligen Messmitteln (Klick → Tab). Wizard Schritt 3: Prüfmittel-Dropdown aus qm_messmittel + ⚠️-Icon + "Sonstiges"-Fallback. Demo: 3 DEMO_MESSMITTEL (ok/faellig/ueberfaellig).

- **Zuletzt erledigt (2026-05-20 — QM Phase 2 KI-Sichtprüfung, HEAD `28b89b7`):**
  - **API** `app/api/qm/sichtpruefung/route.ts`: `POST { foto_path, bauteil_beschreibung?, material? }` → gpt-4o Vision (höhere Bildqualität als gpt-4o-mini) → strukturiertes JSON `{ gesamtbewertung, konfidenz, befunde[], empfehlung, hinweise[] }`. Cost-Tracking + Rate-Limit + RLS-Pfad-Check (erstes Segment = user_id).
  - **Migration** `20260521200000_qm_fotos_ki_analyse.sql`: Spalte `qm_fotos.ki_analyse_ergebnis jsonb`.
  - **lib/db/qm.ts**: Typen `QmKiSichtBefund`, `QmKiSichtErgebnis`, Funktionen `updateQmFotoKiAnalyse`, `getQmPruefberichtIdsMitKiAnalyse`, `uploadQmFotoTemp` (für KI vor dem Save).
  - **Wizard Schritt 5** (`app/dashboard/qm/pruefen/page.tsx`): Disabled „Phase 2"-Hinweis ersetzt durch aktiven Button (Voraussetzung: mind. 1 Foto). Lade-Animation, Fehler-Banner, Ergebnis-Card mit farbcodierter Gesamtbewertung + Befund-Liste (Schwere-Icons) + Empfehlung + Hinweise. „✓ Befund übernehmen" setzt `sichtErgebnis` + erweitert Bemerkungen. „✗ Ignorieren" verwirft. Temporärer Upload-Pfad wird beim Save wiederverwendet (kein doppelter Upload). KI-Ergebnis wird beim Save am ersten Foto in `qm_fotos.ki_analyse_ergebnis` gespeichert.
  - **Dashboard + Archiv** (`app/dashboard/qm/page.tsx`): 🤖 KI-Badge neben Status, basierend auf `getQmPruefberichtIdsMitKiAnalyse()`.
  - **Demo-Modus**: Mock-Response (kein API-Call); Demo-Bericht `PB-2026-011` markiert mit KI-Badge.
  - Damit Phase 2A komplett: 5/5 ✅.

- **Zuletzt erledigt (2026-05-20 — QM Phase 2A: 4 Aufgaben, Commits `227912e`→`a60697a`):**
  - **Aufgabe 1 Team-Management** (`227912e`): SQL-Migration `qm_team_mitglieder` (RLS), DB-Funktionen `getQmTeamMitglieder/upsertQmTeamMitglied/deleteQmTeamMitglied`, neuer Tab 👥 Team in `app/dashboard/qm/page.tsx` (Tabelle, Rolle-Badges Admin/Prüfer/Viewer, Inline-Delete, Add-Modal), Prüfbericht-Wizard Schritt 6: Prüfer-Dropdown aus DB (Fallback Freitext).
  - **Aufgabe 2 Push-Benachrichtigungen** (`6ee9e9b`): Neuer Cron-Endpunkt `app/api/cron/qm-alerts/route.ts` (07:00 täglich), sucht Zeichnungen der letzten 24h ohne Prüfbericht, sendet Push via `lib/push.server.ts`, `vercel.json` ergänzt.
  - **Aufgabe 3 Prüfplan-Generator** (`a60697a`): API `POST /api/qm/pruefplan` (pure Regel-Engine: Toleranz-Mapping → Prüfmittel, Reihenfolge kritisch-zuerst), Zeichnungs-Detail: Prüfplan-Tabelle + 🖨️ Drucken (`window.print`, `@media print` in `globals.css`), Wizard Schritt 1: "Prüfplan laden" befüllt Schritt 3 automatisch.
  - **Aufgabe 4 Statistik-Dashboard** (in HEAD nach Merge): 4 echte Supabase-Queries in `lib/db/qm.ts` (`getQmStatusVerteilung`, `getQmFehlerquoteTrend`, `getQmHaeufigsteAbweichungen`, `getQmPrueferPerformance`), Zeitraum-Filter (Woche/Monat/Quartal/Gesamt), Recharts-Charts (PieChart, LineChart, BarChart horizontal, Tabelle), Demo-Fallback.
  - **KI-Sichtprüfung** (Aufgabe 3 in Phase-2-Tabelle): in separater Session 2026-05-20 nachgereicht — siehe Block oben.

- **Zuletzt erledigt (2026-05-20 — QM-Pilot Phase 1 Aufgaben 5–13 VOLLSTÄNDIG, HEAD `ccb4389`, 3 Commits):**
  - **Aufgaben 6–10** (`9168d0f`): `app/dashboard/qm/pruefen/page.tsx` — 6-Schritte-Wizard: Schritt 1 (Zeichnung-Auswahl aus DB, Pre-select via URL `?zeichnung=ID`), Schritt 2 (Bauteil-ID, Zeichnungs-Nr, Revision, Charge, Anzahl), Schritt 3 (Messwert-Tabelle aus `erkannte_masse` vorausgefüllt, Live-Ampel-Farbcodierung Grün/Orange/Rot per `ampelStatus()`), Schritt 4 (5 Foto-Drop-Zones mit `capture="environment"` für Mobile, Komprimierung via `image-compress.ts`), Schritt 5 (Sichtprüfung: Entgratung/Beschädigung/Ergebnis-Buttons, Phase-2-KI-Button disabled), Schritt 6 (Zusammenfassung-Tabelle, Gesamtstatus-Auto-Berechnung, Prüfer/Initialen/Bemerkungen/Sperren). Speichern: `nextQmPruefberichtNummer()` → `upsertQmPruefbericht()` → `upsertQmMesswert()` × N → `uploadQmFoto()` + `insertQmFoto()` × Fotos. Demo-Fallback + Toast.
  - **Aufgabe 11** (`d63ae2f`): `lib/qm-pdf.ts` — `generateQmPruefberichtPDF(berichtId)` (browser-only, jsPDF ohne autotable). Seite 1: Header-Bar (Teal), Bericht-Nr prominent, Gesamtstatus-Badge (farbig), 2-spaltige Kopfdaten, Messwert-Tabelle mit Status-Zellen farbcodiert (eigene drawTable-Funktion mit alternierenden Zeilen). Seite 2: Fotos 2×2 Grid (signed URLs → base64), Bemerkungen, Abzeichnung (Prüfer/Initialen/Gesamtstatus). Footer auf jeder Seite. Wizard ruft PDF-Funktion direkt client-side auf.
  - **Aufgaben 12+13** (`ccb4389`): `app/dashboard/qm/page.tsx` — Dashboard-Tab: KPI-Karten (Prüfberichte diese Woche, Bestanden, Nachbesserung, Fehlerquote) aus `getQmPruefberichte()` + `computeKpis()` berechnet; Letzte-Berichte-Tabelle mit PDF-Download. Archiv-Tab: echte Supabase-Query, Filter (Freitext-Suche, Prüfer-Dropdown dynamisch aus DB, Status-Select), Ergebnis-Counter; PDF-Download per `generateQmPruefberichtPDF()`. Statistiken-Tab: Status-Verteilung + Prüfer-Performance aus DB. Header-Buttons zu echten Pages verlinkt. Demo-Fallback via `DEMO_BERICHTE` Konstanten.
  - **Noch offen aus Phase 1:** Nichts — alle 13 Aufgaben abgeschlossen. ✅

- **Zuletzt erledigt (2026-05-20 — QM-Pilot Phase 1 Aufgaben 1–5/13, HEAD `52b71ee`, 5 Commits):**
  - **Aufgabe 1** (`9cef745`): `supabase/migrations/20260520600000_qm_schema.sql` mit 4 Tabellen + RLS-Policies + 2 Storage-Buckets via `exec_sql`.
  - **Aufgabe 2** (`8e737e9`): `lib/db/qm.ts` mit Typen + CRUD + `nextQmPruefberichtNummer()` + `ampelStatus()`.
  - **Aufgabe 3** (`59f6eaf`): `app/dashboard/qm/zeichnungen/page.tsx` Drag&Drop + Multi-Upload + Bibliothek.
  - **Aufgabe 4** (`5e46226`): `app/api/qm/analyse-zeichnung/route.ts` OpenAI Vision + Cost-Tracking.
  - **Aufgabe 5** (`52b71ee`): `app/dashboard/qm/zeichnungen/[id]/page.tsx` Detail + Edit + KI-Analyse-Button.

- **Zuletzt erledigt (2026-05-20 — QM-Pilot Grundgerüst, HEAD `34056cc`, 2 Commits):**
  - `lib/access.ts`: `'qm'` als neuer `AccessPilotId` — nur bei expliziter Buchung sichtbar (NICHT in DEFAULT_ROLE_PILOTS)
  - `components/Sidebar.tsx`: QM-Pilot 🔬 am Ende der KI-Piloten-Liste → `/dashboard/qm`
  - `app/dashboard/layout.tsx`: Demo-Nutzer sieht QM, echte User nur nach Buchung
  - `app/dashboard/[pilot]/page.tsx`: QM Landing-Page (Features, 4 Stats, 4 Module) für Nutzer ohne Zugang
  - `app/dashboard/qm/page.tsx`: Demo-Dashboard (4 Tabs: Dashboard/Zeichnungen/Archiv/Statistiken, Teal-Farbe `#14b8a6`)
  - `lib/pricingConfig.ts`: QM als buchbarer PilotId (40€/85€/149€/Anfrage), Enterprise 249→279€
  - `app/dashboard/einstellungen/page.tsx`: MANAGED_PILOT_OPTIONS + PILOT_LABELS + AGB aktualisiert
  - `QM_PILOT_KONZEPT.md`: Vollständiges Konzept-Dokument (DB-Schema, Wizard, KI-Analyse, Ampel-Logik, PDF, Phasen)
  - **Phase 1 (DB + Zeichnungs-Upload + KI + Wizard + PDF) steht als nächstes an**

- **Zuletzt erledigt (2026-05-20 — Wareneingang-Workflow-Redesign, HEAD `b6f97eb`):**
  - Neue Moduswahl-Kacheln: "KI-Wareneingang" und "Wareneingang manuell erfassen"
  - KI-Modus: Upload-Schritt → neue OCR-API `/api/pondruff/ocr-wareneingang` → editierbare Felder
  - Manuell-Modus: alle Felder direkt leer + dynamische Position-Verwaltung
  - Pro Position: Menge, Artikel, Maße (L×B×H / Ø×L), Weitere Infos (Key:Value), Polieren (Ja/Nein + Wo), Entschichtung, Microstrahlen, Läppstrahlen, Polierstrahlen, Beschichtung (13 Optionen)
  - Pflichtfelder: Lieferbedingungen + Eingelagert von — Save-Button deaktiviert bis gesetzt
  - Migration `20260520500000_pondruff_we_new_fields.sql`: 5 neue Spalten ausgeführt
  - `WE_COATINGS` in `lib/pondruff.ts` exportiert
  - Büro/WISO: Wareneingänge-Tab mit neuen Spalten (Bestell-Nr., Pos., Lieferbedingungen, Eingelagert von) + anklickbare Detailansicht mit vollständiger Positions-Tabelle
  - `sync-buero-wareneingang`: alle neuen Felder in Büro-Dokument-Beschreibung

- **Davor (2026-05-20 — BUGFIX-SPRINT-2 komplett, HEAD `e374670`, P1-9 bis P1-12):**
  - P1-9: `/api/document-ai` — Cost-Limit-Check + Usage-Logging ergänzt (Parität mit `/api/chat`)
  - P1-10: `werkstatt_material.karte_id` FK → `werkstatt_karten(id)` ON DELETE SET NULL; `insertWerkstattMaterial` setzt `karte_id` automatisch via `auftragsnr`-Lookup
  - P1-11: `EingangsrechnungenTab` — localStorage-OCR: Typ-Validierung, Fehler-Toast, kein silentes Schlucken mehr
  - P1-12: `lib/ai-settings.ts` — Marketing-KI + OpenAI-Tools: fail-open bei fehlendem `SUPABASE_SERVICE_ROLE_KEY` statt stiller Komplettdeaktivierung

- **Zuletzt erledigt (2026-05-20 — API-Konsolidierung, HEAD `fbbd1b1`):**
  - Anthropic/Claude API vollständig entfernt — App läuft jetzt ausschließlich über OpenAI
  - `app/api/ocr-beleg/route.ts`: Anthropic claude-haiku → OpenAI `gpt-4o-mini` Vision (Bild-Upload + Text-Modus, ~0,001–0,002€/Scan)
  - `app/api/generate-angebot/route.ts`: Anthropic claude-haiku → OpenAI `gpt-4o-mini`
  - Vercel: `OPENAI_CHAT_MODEL` + `OPENAI_DOCUMENT_MODEL` als Env-Vars eingetragen
  - PDF-Generierung (Rechnung, Angebot, Auftrag) läuft über **jsPDF im Browser** — keine KI, keine Tokenkosten
  - KI-Kostenlimit: 5€/Monat pro User (via `lib/ai-usage.ts`)

- **Zuletzt erledigt (2026-05-20 — BUGFIX-SPRINT-2, HEAD `55821e3`, 8 P1-Bugs):**
  - P1-1: Cloud Cron-Auth — fehlendes `CRON_SECRET` → 500 statt Endpoint offen (`app/api/backup/auto/route.ts`)
  - P1-2: PlanungPilot — `showToast` vor `useEffect` in 3 Tabs (ReferenceError-Risiko behoben, `planung/page.tsx`)
  - P1-3: WerkstattPilot — Supabase-Trigger `trg_werkstatt_zeitbuchung_stunden`: Zeitbuchungen summieren in `werkstatt_karten.stunden`
  - P1-4: WerkstattPilot — `syncWerkstattMaterialToLager` nutzt jetzt `insertLagerBewegung()` statt direktem Insert (Audit-Konsistenz + konsistentes Datumsformat)
  - P1-5: AnalysePilot — ISO-8601 KW-Berechnung, Zebra-Striping via `rowIndex % 2`, PDF-Dateiname an `zeitraum`-Filter (`analyse/page.tsx`, `lib/pdf.ts`)
  - P1-6: SteuerPilot — `uploadSteuerBeleg` → `ocr-originale`-Bucket; FK `steuer_buchungen.beleg_id → steuer_belege(id)` mit `ON DELETE SET NULL`
  - P1-7: BüroPilot — `isSubmitting`-Guard auf `handleNeu` in `RechnungenTab` (verhindert Doppelklick-Duplikate)
  - P1-8: Archiv — Datum-Sort parst DE-Format `TT.MM.JJJJ` korrekt; `deleteSteuerBeleg` nutzt `db()` statt `createSupabaseClient()` für DB-Queries

- **Zuletzt erledigt (2026-05-20 — BUGFIX-SPRINT-1, HEAD `2b0fa7f`, alle 10 P0-Release-Blocker):**
  - P0-1: KI-Assistent Chat + Tagesbrief an echte `/api/chat` angeschlossen (Commits `89d37bf`)
  - P0-2: Default-Model `gpt-5.4-mini` → `gpt-4o-mini` in chat/document-ai/ai-usage (`16b6d0c`)
  - P0-3: LagerPilot Bestand-Tab Bild-`<th>` ergänzt + `colSpan` 9→10 (`c5710ea`)
  - P0-4: `archiveRechnungPdf`/`archiveAngebotPdf` werden jetzt nach Upsert automatisch aufgerufen (`668f552`)
  - P0-5: `pk_next_angebot_number` auf `billing_sequences` (atomar) + UNIQUE auf `buero_angebote.nummer` (`820a62f`)
  - P0-6: `uploadFirmenLogo`/`uploadBriefpapier` auf `firma-branding`-Bucket umgestellt (`aad9a63`)
  - P0-7: `PilotDocumentArchive` `getPublicUrl` → `createSignedUrl` 1h TTL (`8d57c40`)
  - P0-8: Manueller Backup (`createCloudBackup`) → neuer `/api/backup/manual` mit echtem gzip-Dump aller 26 Tabellen (`ca0fbbc`)
  - P0-9: `getPriceConfig(userId)` liest DB-Config aus `pondruff_price_config`; `calcPricePosition` erhält optionalen `cfg`-Parameter (`bd1364a`)
  - P0-10: OCR-Beleg-Pipeline neu: Bild/PDF via Vision + `ocr-originale`-Bucket + `claude-haiku-4-5-20251001` (`2b0fa7f`)

- **Zuletzt erledigt (2026-05-20 — Sprint 20D Demo-Mode-Code-Migration, Branch `sprint-20-phase-d`):**
  - 10 Pilot-Seiten von `isDemo`-Daten-Routing-Branches befreit. Demo-User nutzt jetzt RLS-geschützten echten DB-Pfad.
  - Entfernt: ~150 Daten-Routing-Branches (Lese-Fallbacks, Schreib-Skip, Ternary-Demo-Daten, useEffect-Blocker). Belassen: UI-Banner, Demo-Hint-Toasts, gefährliche Demo-Aktions-Blocker (Snapshot, BulkDelete, Permissions-Bypass für Rollen-Toggle).
  - Pilot-Commits: CloudPilot (4), AnalysePilot (2), KI-Erkennung (3), SteuerPilot (8), BueroPilot (5+useEffect), PlanungPilot (~30), WerkstattPilot (~50), MarketingPilot (~25), LagerPilot (~25), EinstellungenPilot (~10).
  - `npm test`: 87/87 grün. `npm run build`: erfolgreich. `npx tsc --noEmit`: 0 Fehler.
  - Verbleibende `isDemo`-Vorkommen sind reine UI-Conditionals (Banner, Disable-Schutz, Toast-Texte mit "(Demo)"-Suffix). Hardcoded `demo*`-Constants wurden mit `eslint-disable @typescript-eslint/no-unused-vars` markiert (Aufräumen in Folge-Sprint).

- **Zuletzt erledigt (2026-05-19 — Dual-Sprint A+B+C, HEAD `dcf29bb`):**
  - **Sprint A — Pondruff Datenverlust-/Duplikat-Risiko (3 Aufgaben):**
    - A1 (`e1c52d7`): `raw_dimension_text` durchgereicht von OCR → sessionStorage → Preisrechner → `pondruff_preisauftraege.positions` (jsonb) → BüroPilot-Sync → Detail-View. Wird im Auftrag-Detail unter den Positions-Mass-Zeilen als gelber Hinweis angezeigt.
    - A2 (`9a1d5fa`): `sync-buero-wareneingang` und `sync-buero-auftrag` auf `upsert` umgestellt mit ID-Wiederverwendung. Resync aktualisiert bestehende `buero_auftraege`-Zeile statt zu duplizieren.
    - A3 (`b55dd76`, `0dc021b`): Doppel-Klick-Schutz in beiden WISO-Routes (`wiso-export`, `wiso-export-wareneingang`) — `synced_wiso_at` / `ai_data.wiso.synced_at` Check vor erstem POST, gibt vorhandene Response zurück. OCR-Fehler liefern jetzt `detail` durchgereicht ins UI.
  - **Sprint B — Owner-Härtung (3 Aufgaben):**
    - B1 (`298e343`): Case-insensitive E-Mail-Vergleich in `app/api/owner/openai-usage/route.ts` — Line 30 + 59 nutzen jetzt `.toLowerCase()` einheitlich.
    - B2 (in Sammel-Commits): Neue Tabelle `owner_audit_log` (Migration `20260519700000_owner_audit_log.sql`, RLS aktiv, nur Service-Role). Helper `lib/audit-log.ts` mit `logOwnerAction()` + `listOwnerAuditLog()`. Eingehängt in `OwnerCustomerControlPanel` (unlock/suspend/status/invoice.create) und `pondruff-flags` Route (alt/neu Werte). UI-Viewer `OwnerAuditLogPanel.tsx` zeigt letzte 20 Einträge in Einstellungen → Kundensteuerung.
    - B3 (in Sammel-Commits): OpenAI-Usage In-Memory-Cache (Map<monthKey, {fetchedAt, data}>, 1h TTL). `?refresh=1` für Bypass. Response um `cached_at` + `from_cache` erweitert. `OwnerOpenAiCostsPanel`: 🔄 Refresh-Button + Cache-Status-Zeile + Skeleton-Loader.
  - **Sprint C — Pondruff UX (4 Aufgaben):**
    - C1+C2 (`556c52e`): `operator` + `status` ins sessionStorage-Prefill aufgenommen und im Preisrechner als Read-only Info-Box "🧑 Bediener: X · Status: Y" angezeigt. "← Zurück zum Wareneingang"-Button erscheint wenn `prefill=1` UND `delivery_id` vorhanden. sessionStorage wird erst nach `saveOrder()` gelöscht.
    - C3 (`9725e10`): `capture="environment"` ergänzt auf allen Pondruff Foto-Inputs (Wareneingang, Preisrechner, KI-Bauteilsuche). Auf iOS/Android öffnet sich jetzt Kamera direkt mit Option Galerie statt umgekehrt.
    - C4 (`dcf29bb` + P0-9 `bd1364a`, ✅ vollständig): Tabelle `pondruff_price_config`, Route `admin-price-config`, UI-Panel `/dashboard/pondruff/admin/page.tsx`. `getPriceConfig(userId)` liest DB-Config mit JSON-Fallback — DB hat Priorität wenn etwas geändert wurde, sonst immer statische JSON.

- **Vorheriger Stand (2026-05-19 — Pondruff Komma-Zahlen-Fix, HEAD `ec679ac`):**
  - **Inhaber-Feature-Flags** (`56854e2`): Tabelle `pondruff_feature_flags` (4 Boolean-Schalter: `ocr_wareneingang`, `ocr_preisrechner`, `ki_bauteilsuche`, `wiso_sync`, Default true, RLS select_self). Panel `OwnerPondruffFeaturesPanel` in Einstellungen → Kundensteuerung. API `/api/owner/pondruff-flags` (GET/POST, nur Inhaber-Email + Service-Role-Upsert). Server-Guard `requirePondruffFeature()` in 5 API-Routes (`ocr-price`, `ocr-lieferschein`, `bauteil-suche`, `wiso-export(-wareneingang)`). Client-Hook `usePondruffFlags` für UI-Disabled-Zustände.
  - **OCR-Bugfix Preisrechner** (`56854e2`): Smartphone-Fotos scheiterten am 4.5 MB Vercel-Body-Limit. Neuer Helper `compressImageDataUrl` (2000px / JPEG 85%) in `lib/pondruff.ts`. Eingebunden in Preisrechner, Wareneingang, KI-Suche.
  - **Preisrechner-UI Bereinigung** (`0354736`): Orange Regeln-Box und manuelle Prüf­tabelle entfernt.
  - **Sync Pondruff→Büro Positionen-Fix** (`727e3c2`): Neue Migration `20260519450000_buero_auftrag_positionen.sql` (Spalte `positionen jsonb`). `sync-buero-auftrag` baut jetzt PDFPosition[] aus `rows` und schreibt sie separat in die Spalte; `beschreibung` enthält nur noch kurze Kontextzeile. Pondruff-AB-PDF-Texte: introText "wir bestätigen … und beginnen mit der Bearbeitung." (vor Tabelle), closing nur "Vielen Dank für Ihren Auftrag." (nach Tabelle). `handleAuftragZuRechnung` reicht positionen automatisch in die Rechnung weiter.
  - **PDF-Hotfix Legacy-Parser** (`c180318`): `parseLegacyBeschreibungPositionen()` in `lib/pondruff-pdf.ts` — wenn `positionen` leer aber `beschreibung` im alten Format `01. NAME (Nx PREIS €)`, werden Positionen automatisch rekonstruiert. Existierender Auftrag `PREIS-20260519-133913` per Direct-API auf neues Format gebacked-fillt.
  - **Pondruff 1 — OCR-Korrektur-Modal**: Im Preisrechner zeigt sich nach OCR-Lauf das Modal `OcrReviewModal` mit allen erkannten Positionen + Customer/Lieferschein/Bestell-Nr. User kann editieren, Positionen per Checkbox aus-/einblenden, dann übernehmen oder verwerfen.
  - **Pondruff 2 — Kunde-Auto-Match**: Route `/api/pondruff/match-kunde` (Token-Overlap-Score gegen `buero_kunden`). Im Review-Modal Top-3-Vorschläge mit Match-% — verhindert Duplikate.
  - **Pondruff 3 — Sync-Badges im Archiv**: Pondruff-Archiv zeigt je Eintrag Badges `→ Büro ✓` und `→ WISO ✓` basierend auf `synced_buero_*` und `synced_wiso_*`.
  - **Pondruff 4 — Resync-Button**: In Büro/WISO-Seite kann ein bereits gesynced Auftrag jetzt erneut zu BüroPilot synct werden (orange 🔄-Button + Inline-Bestätigung).
  - **BüroPilot 1 — Pondruff-Quelle sichtbar**: In AuftraegeTab-Card erkennt das Frontend Pondruff-Aufträge an `id.startsWith('PREIS-')` und zeigt rotes 🔗-Pondruff-Badge mit Link zum Pondruff-Bereich.
  - **BüroPilot 2 — Workflow-Stepper**: Visuelles Stepper-Widget `WorkflowStepper` (AB → Versendet → In Arbeit → Fertig) je Auftrag-Card; aktiver Schritt blau, erledigte grün.

- **Zuletzt erledigt (2026-05-18 – 14-Task-Sprint, Commits `…`–`e325d19`):**
  - **Task 1 — Messaging SQL-Schema** (`20260519010000_messaging_schema.sql`): Tabellen `user_messages` + `broadcast_messages` + RLS-Policies + Indexes als Migration. ⚠️ Noch manuell in Supabase einzuspielen.
  - **Task 2 — pilot-documents Bucket** (`20260518210000_pilot_documents.sql`): Migration verifiziert + Timestamp-Konflikt behoben (umbenannt auf `20260518211000`). ⚠️ Bucket `pilot-documents` manuell erstellen.
  - **Task 3 — VAPID Keys**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` gesetzt; in Vercel müssen `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` noch gesetzt werden.
  - **Task 4 — Push-Alerts Cron**: `vercel.json` mit Cron `0 8 * * *` auf `/api/cron/push-alerts` verifiziert.
  - **Task 5 — Atomare Umlagerung**: RPC `umlager_artikel()` in `20260519020000_umlager_artikel_rpc.sql`; `lib/db.ts` `umlagerArtikel()` nutzt `supabase.rpc()` statt 4 sequentielle Awaits.
  - **Task 6 — Bestandssync-Trigger**: `trg_sync_bestand` in `20260519030000_bestand_sync_trigger.sql` — bei INSERT/UPDATE/DELETE auf `lager_stellplatz_bestand` wird `lager_artikel.bestand` automatisch per SUM synchronisiert.
  - **Task 7 — WerkstattPilot FK**: `20260519040000_werkstatt_karte_buero_auftrag_fk.sql` — `werkstatt_karten.buero_auftrag_id TEXT REFERENCES buero_auftraege(id) ON DELETE SET NULL`; Dropdown im Formular (auto-füllt Auftragsnr + Beschreibung).
  - **Task 8 — Pipeline-Kanban**: `PipelineKanbanTab` in `buero/page.tsx` — 5 Spalten (Angebot/Auftrag/In Bearbeitung/Rechnung/Bezahlt), Σ-Spaltensummen, klickbare Karten.
  - **Task 9 — KI-Bestellung ausführbar**: `executeBestellung()` in `ki-erkennung/page.tsx` — 2-Klick-Bestätigung, `upsertEinkaufBestellung()` + Demo-Simulation.
  - **Task 10 — KI-Hinweis Deeplinks**: Hinweis-Aktionen leiten je nach Schlüsselwort zum richtigen Pilot weiter (buero/werkstatt/steuer/planung/analyse/lager).
  - **Task 11 — Zahlungsmoral-Report**: Tab `💳 Zahlungsmoral` in `analyse/page.tsx` — Ø Verzug, Mahnquote, Ampelfarben je Kunde.
  - **Task 12 — lib/access.ts Rollen-Sync**: `DEFAULT_ROLE_PILOTS.Büro` um `'steuer'` ergänzt (war in `lib/roles.ts` bereits enthalten).
  - **Task 13 — WerkstattPilot BüroAuftrag-Link**: Dropdown `bueroAuftraege` im Arbeitskarten-Formular; Daten via `getBueroAuftraege()` + `Promise.all`.
  - **Task 14 — BüroPilot E2E-Bug behoben** (`e325d19`): `handleKonvertieren` setzt Angebot-Status auf `'Akzeptiert'` + navigiert nach Konvertierung zum `auftraege`-Tab.
  - Build ✅, TSC ✅, alle Commits gepusht.
- **Zuletzt erledigt (2026-05-18 – Messaging & Postfach-System, Commits `9ae15d1`–`f35f444`):**
  - **Settings-Icon** (`layout.tsx`): Zahnrad-Icon ⚙️ oben rechts neben Glocke ersetzt alten Buchstaben-Button. Hover-Effekt blau.
  - **Postfach-Menüpunkt** (`einstellungen/page.tsx`): Neuer NavItem 📬 zwischen Billing & Benachrichtigungen. Für alle User sichtbar.
  - **User-View**: Support-Anfragen schreiben (Betreff + Text), versendete Nachrichten mit Lesestatus (gelesen ✓ / ungelesen ⏱️).
  - **Owner-View** (nur `info@petersen-ki-pilot.de`):
    - Inbox-Tab: Alle Support-Anfragen von Nutzern, Ungelesen-Badge.
    - Versendete-Tab: Nachricht verfassen mit Empfänger-Toggle (📢 Alle / 👤 Einzelner Nutzer), Dropdown aus `managedUsers`.
    - History: Badge zeigt Empfänger-Typ + Empfängername bei Einzelversand.
  - **API**: `app/api/messages/route.ts` — GET (`?action=inbox`, `?action=sent`, standard) + POST (`send`, `broadcast`, `mark_read`).
  - **DB-Funktionen** (`lib/db.ts`): `getUserMessages`, `insertUserMessage`, `markUserMessageAsRead`, `getOwnerInbox`, `insertBroadcastMessage`, `getOwnerSentMessages`.
  - **Schema** (`supabase/schema.sql`): Tabellen `user_messages` + `broadcast_messages` + RLS-Policies + Indexes hinzugefügt. ⚠️ Manuell im SQL-Editor ausführen!
  - Build + TSC ✅ grün.
- **Zuletzt erledigt (2026-05-18 – 30-Aufgaben-Sprint, Commits `5de7454`–`2b068fc`):**
  - **Aufgabe 1** (`5de7454`): AnalysePilot Lagerwert-KPI (💰 Bestand × Einkaufspreis, Demo-Fallback). `analyse/page.tsx`
  - **Aufgabe 2** (`828bb19`): SteuerPilot VSt Fixkosten als separate UStVA-Zeile. `steuer/page.tsx`
  - **Aufgabe 3** (`3f888fa`): LagerPilot FIFO-Hinweis beim Warenausgang (älteste Charge aus `lager_stellplatz_bestand`). `lager/page.tsx`
  - **Aufgabe 4** (`7a47b1a`): PlanungPilot Auto-Fortschritt 100% wenn alle Aufgaben erledigt. `planung/page.tsx`
  - **Aufgabe 5** (`12d72fe`): BüroPilot DSGVO-Anonymisierung (Admin-only, 2-Klick). `buero/page.tsx`, `lib/db.ts`
  - **Aufgabe 6** (`225e967`): AnalysePilot DB-Queries serverseitig auf 12 Monate begrenzt. `analyse/page.tsx`
  - **Aufgabe 7** (`3c8337e`): AnalysePilot CSV-Export Umsatz-Tabelle (Blob-Download). `analyse/page.tsx`
  - **Aufgabe 8** (`14398cf`): PlanungPilot Empty States für alle 4 Tabs mit CTA-Button. `planung/page.tsx`
  - **Aufgabe 9** (`42f7e07`): BüroPilot Duplikat-Erkennung Kunden via E-Mail-Check. `buero/page.tsx`, `lib/db.ts`
  - **Aufgabe 10** (`c518952`): SteuerPilot Fälligkeits-Kalender-Widget + Dauerfristverlängerung-Toggle. `steuer/page.tsx`
  - **Aufgabe 11** (`fe81c66`): PlanungPilot Ressourcen-Überlastet-Badge + Formular-Warnung. `planung/page.tsx`
  - **Aufgabe 12** (`b63ac0e`): WerkstattPilot Qualitäts-KPI (Fehlerquote, Sparkline-Trend 8 Wochen). `werkstatt/page.tsx`
  - **Aufgabe 13** (`d498b72`): BüroPilot→WerkstattPilot Karten-Auto-Erstellung via URL-Params. `buero/page.tsx`, `werkstatt/page.tsx`
  - **Aufgabe 14** (`148bfbe`): AnalysePilot Gewinn-KPI strukturell korrigiert (+ Fixkosten + Betriebsausgaben). `analyse/page.tsx`
  - **Aufgabe 15+16** (`ccc6217`): Zeitraum-Filter verifiziert + SteuerPilot Stripe-Zahlungen als separate Einnahmen-Zeile. `analyse/page.tsx`, `steuer/page.tsx`
  - **Aufgabe 17** (`5558c75`): BüroPilot Angebots-Reminder — Alters-Badge (7/14+ Tage) + Filter-Button. `buero/page.tsx`
  - **Aufgabe 18** (`c64eb68`): PlanungPilot Zeiterfassung — `stunden_soll`/`stunden_ist` + Fortschrittsbalken. `planung/page.tsx`, `supabase/schema.sql`
  - **Aufgabe 19** (`8529482`): BüroPilot Eingangsrechnung → SteuerPilot-Beleg-Sync bei Bezahlung. `buero/page.tsx`, `lib/db.ts`
  - **Aufgabe 20** (`a677a44`): BüroPilot OPOS-Dashboard — Fälligkeits-Aging-Buckets (heute/diese Woche/>30 Tage). `buero/page.tsx`
  - **Aufgabe 21** (`8e50d12`): WerkstattPilot Ist vs. Soll Zeitanzeige pro Karte (Pill-Badge, Ampelfarbe). `werkstatt/page.tsx`
  - **Aufgabe 22** (`a2762c0`): LagerPilot `lieferant_id` FK auf `einkauf_lieferanten` + Dropdown. `lager/page.tsx`, `lib/db.ts`, `supabase/schema.sql`
  - **Aufgabe 23** (`159da86`): BüroPilot KI-Angebotstext (✨ Button, API-Route `generate-angebot`). `buero/page.tsx`, `app/api/generate-angebot/route.ts`
  - **Aufgabe 24** (`cd7a1b1`): SteuerPilot SKR04-Buchungsvorschlag im Beleg-Modal (KI-Badge). `steuer/page.tsx`
  - **Aufgabe 25** (`5c639d7`): Bestandstrend-Snapshots — Tabelle `lager_bestand_snapshots`, 📸-Button, AnalysePilot-Liniendiagramm. `lager/page.tsx`, `analyse/page.tsx`, `lib/db.ts`
  - **Aufgabe 26** (`7033146`): BüroPilot Positionen-Editor in Angeboten (JSONB, Konvertierung überträgt Positionen). `buero/page.tsx`, `lib/db.ts`
  - **Aufgabe 27** (`ae1b821`): WerkstattPilot Material-Entnahme → LagerPilot-Sync (Bestand −, Bewegungslog). `werkstatt/page.tsx`, `lib/db.ts`
  - **Aufgabe 28** (`e7e76d4`): WerkstattPilot Fertigungsleitstand — neuer Tab, 3-Spalten-Kanban, SLA-Ampel, Batch-Aktionen. `werkstatt/page.tsx`
  - **Aufgabe 29** (`a5d595c`): SteuerPilot OCR-Erkennung — API-Route `ocr-beleg`, KI füllt Beleg-Felder automatisch. `steuer/page.tsx`, `app/api/ocr-beleg/route.ts`
  - **Aufgabe 30** (`60be09b`): PlanungPilot `auftrag_id` FK + Meilenstein-CRUD (Tabelle `planung_meilensteine`). `planung/page.tsx`, `lib/db.ts`
  - **Sprint-Migration** (`2b068fc`): `20260518210000_sprint_aufgaben_18_22_25_26_30.sql` — alle fehlenden Spalten/Tabellen in Remote-DB eingespielt.
  - **PreToolUse-Hook** (`f65d7b0`): `.claude/settings.json` — `npx tsc --noEmit` blockiert Push bei TypeScript-Fehlern.
  - Tests: Build ✅, TSC ✅, alle Vercel-Deployments ✅ Ready.
- **Zuletzt erledigt (2026-05-18 – Inhaber-Briefpapier & Firmendaten, Branch `feature/briefpapier-firmendaten`)**:
  - **Briefpapier/PDF** (`lib/pdf.ts`): Template `petersen-brand` optisch näher am neuen Briefpapier ausgerichtet (heller Header, Kontaktblock, dezentes Wasserzeichen, dunkler Footer mit Diagonalfläche/Logo), Firmen-/Steuer-/Bankdaten werden sauberer genutzt.
  - **Auftragsbestätigung-PDF**: Neue Funktion `generateAuftragsbestaetigungPDF()` ergänzt; BüroPilot-Aufträge zeigen jetzt `AB-PDF` und das AB-Mail-Modal bietet PDF-Erstellung wie Angebote/Rechnungen.
  - **Firmendaten** (`einstellungen/page.tsx`, `layout.tsx`): Strukturkarte für Dokumentdaten ergänzt; Pflichtdaten-Check für Angebote/Auftragsbestätigungen/Rechnungen; Inhaber-Template wird gegen Nicht-Inhaber gesperrt.
  - **Inhaber-Dashboard** (`dashboard/page.tsx`): Owner-only Einstieg „Inhaber-Briefpapier“ mit Direktlink zu `Einstellungen → Firmendaten`.
  - Tests: `npx tsc --noEmit`, `npm run lint`, `npm run build` grün (nur bekannte Warnungen).
- **Zuletzt erledigt (2026-05-18 – Quick-Win-Sprint, 7 Fixes)**:
  - **PlanungPilot: `deletePlanungRessource`** — Funktion in `lib/db.ts` ergänzt (analog `deletePlanungTermin`); Import + `handleDelete`-Verdrahtung in `planung/page.tsx`. UI-Delete-Button läuft jetzt echte DB-Löschung.
  - **AnalysePilot: Status-Filter** — `analyse/page.tsx:236` von `'Entwurf'/'Gesendet'` auf `'Erstellt'/'Versendet'/'Akzeptiert'` korrigiert (BüroPilot-Workflow-Abgleich).
  - **AnalysePilot: PieChart entfernt** — hardcoded `pilotNutzungData` (38/24/18/10/6/4%) + beide Pie-Renderer entfernt; Import `PieChart/Pie/Cell` + `fmtPct` bereinigt; Placeholder-Text eingefügt.
  - **LagerPilot: Bestellung verdrahtet** — `handleBestellungBestaetigen` in `lager/page.tsx` ruft jetzt `upsertEinkaufBestellung()` auf (mit `genId('BS')`, Datum, Status `'Offen'`); kein Datenverlust bei Demo-Mode.
  - **LagerPilot: Wareneingänge im KI-Kontext** — `einkauf_wareneingaenge` wird in `app/api/chat/route.ts` per `Promise.allSettled` geladen; `buildContextBlock` gibt "OFFENE WARENEINGÄNGE"-Block aus; Demo-Daten + Fallback ergänzt.
  - **BüroPilot/PlanungPilot EinkaufTab**: Bestätigt bereits korrekt live-verdrahtet (`!isDemo`-Guards OK, `hasDemoCookie()`-Pattern korrekt).
  - Lint: nur bekannte Warnungen, keine neuen Fehler.
- **Zuletzt erledigt (2026-05-18 – Owner-Dashboard-Sprint, Commits `03ea362`–`9a9b0ad`)**:
  - **Task #1 — Einkauf-Tab live**: Analyse ergab, Code ist bereits live-fähig (`!isDemo`-Guards korrekt, db.ts-Funktionen fertig). Kein Code-Commit nötig. Fehlende Supabase-Tabellen müssen noch ausgeführt werden.
  - **Task #2 — MTD/YTD Umsatz-KPIs** (`03ea362`): Neue Finanzkennzahlen-Zeile im BüroPilot-Header — Umsatz MTD, Umsatz YTD (aus bezahlten Rechnungen), Überfällig/Mahnung-Counter klickbar. Datei: `buero/page.tsx`.
  - **Task #3 — Kunden-Cockpit** (`021d2fc`): Kunden-Detailansicht zu vollem Cockpit erweitert. KPI-Zeile: Umsatz bezahlt, Angebote, Aufträge, offene Rechnungen. Tabs: Angebote / Aufträge / Rechnungen. Matching per `kunde_id` mit Namens-Fallback. Datei: `buero/page.tsx`.
  - **Task #4 — Zahlungs-Alert-Center** (`1fce336`): Neuer Tab `⚠️ Alerts` im BüroPilot — überfällige Rechnungen (mit Tage-Counter), bald fällig (≤14 Tage), inaktive Kunden (>90 Tage). Überfällig-KPI-Kachel verlinkt direkt. Datei: `buero/page.tsx`.
  - **Task #5 — AnalysePilot Zeitraum-Filter** (`9a9b0ad`): `useEffect` hängt jetzt an `[zeitraum]`, lädt bei Änderung neu. `loadLiveData(zr)` berechnet `zeitraumStart` + `chartMonate` — KPI-Filter und Chart-Fenster reagieren auf 7T/30T/3M/6M/1J. Datei: `analyse/page.tsx`.
  - Tests: lint + build grün für alle Commits.
- **Zuletzt erledigt (2026-05-18 – SteuerPilot + MarketingPilot parallel, Commits `ec0b705` + `9c24845`)**:
  - **SteuerPilot — Betrag-Bug fix**: Input von `type="number"` auf `type="text" inputMode="decimal"` umgestellt; onChange normalisiert Komma→Punkt, kein `|| 0`-Override mehr. Datei: `steuer/page.tsx`.
  - **SteuerPilot — Beleg-Upload-System**: Neues Formular (Kategorie-Select: Fixkosten/Betriebsausgaben/Anschaffung/Sonstiges, Betrag, Datum, Notiz, Datei-Upload) → Upload in Bucket `steuer-belege`. Dateien: `steuer/page.tsx`, `lib/db.ts`.
  - **SteuerPilot — Kategorie-Filter-Tabs**: Alle / Fixkosten / Betriebsausgaben / Anschaffung / Sonstiges mit Zähler. Datei: `steuer/page.tsx`.
  - **SteuerPilot — Inline-Delete**: Ja/Nein-Buttons (kein `confirm()`), löscht Datei aus Storage + DB. Datei: `steuer/page.tsx`.
  - **lib/db.ts**: Neue Funktionen `getSteuerBelegUploads`, `upsertSteuerBelegUpload`, `deleteSteuerBelegUpload`, `uploadSteuerBelegFile`.
  - **Migration**: `supabase/migrations/20260518200000_steuer_belege_uploads.sql` — Tabelle `steuer_belege_uploads` + Bucket-Policies. ⚠️ Muss manuell im Supabase SQL-Editor ausgeführt werden.
  - **MarketingPilot — Demo→Live**: Live-Calls für Kampagnen/Leads/Newsletter waren bereits korrekt; Demo-Guards bestätigt. Datei: `marketing/page.tsx`.
  - **MarketingPilot — Edit + Delete vollständig**: 8 neue Delete-Funktionen in `lib/db.ts`; Edit-Modal + Inline-Confirm-Delete für Kampagnen, Leads, Newsletter in `marketing/page.tsx`.
  - Tests: lint + build grün.
- **Zuletzt erledigt (2026-05-18 – Tasks 2-8 parallel, Commits `043ff2e`–`9180136`)**:
  - **Task 2 (Multi-Positionen)**: `PositionenEditor`-Komponente in Angebote/Aufträge/Rechnungen. Positionen als JSON-Array, Betrag dynamisch berechnet, rückwärtskompatibel. Dateien: `buero/page.tsx`, `lib/db.ts`.
  - **Task 3 (ELSTER-Export)**: Neues `lib/steuer-export.ts` mit `generateElsterXml()`. Button „📥 ELSTER-XML exportieren" im UStVA-Tab + Export-Karte. Kennzahlen 81 (USt) + 83 (VSt). Datei: `steuer/page.tsx`.
  - **Task 4 (Marketing CRUD)**: Edit + Delete für Kampagnen/Leads/Newsletter. Inline-Bestätigung, 2-Klick-Delete. Neue `deleteMarketing*`-Funktionen in `lib/db.ts`. Datei: `marketing/page.tsx`.
  - **Task 5 (AnalysePilot Live)**: Fehler-Handling verbessert, `loadError`-State + rotes Fehler-Banner. `CLAUDE.md` Status aktualisiert. Datei: `analyse/page.tsx`.
  - **Task 6 (Benutzerverwaltung)**: Admin-API `app/api/admin/users/route.ts` (DELETE/PUT disable/resend-invite). UI-Suchfeld + Deaktivieren/Löschen/Einladung-Buttons mit Auth-Guard. Datei: `einstellungen/page.tsx`.
  - **Task 7 (RLS-Policies)**: Migration `supabase/migrations/20260518190000_rls_policies_complete.sql`. 10 Tabellen-Lücken geschlossen (billing_sequences, owner_event_inbox, steuer_*, audit_logs etc.).
  - **Task 8 (Pipeline-Widget)**: 3 KPI-Kacheln oben auf BüroPilot (🟡 Offene Angebote / 🔵 Laufende Aufträge / 🔴 Offene Rechnungen), klickbar mit Tab-Navigation. Datei: `buero/page.tsx`.
  - Tests: lint + build grün. Push: `9180136`.
- **Zuletzt erledigt (2026-05-18 – BüroPilot Paketauswahl + Konvertierung, Commit `de33bc3`)**:
  - **Inhaber-Paketauswahl im Angebots-Formular**: Nach Kundenauswahl erscheint (nur für Admin/Inhaber-Rolle) ein Paket-Selector (Starter/Business/Enterprise + Mitarbeiterstaffel). Wahl befüllt Titel und Betrag automatisch aus `pricingConfig`.
  - **1-Klick Angebot → Rechnung**: Neuer Button „📄 Rechnung erstellen" für akzeptierte Angebote — direkte Konvertierung ohne Auftrag-Zwischenschritt. Bestehender Button „🔄 Auftrag erstellen" bleibt erhalten.
  - **Beide Konvertierungen existieren jetzt vollständig**: Angebot→Auftrag (vorher) + Auftrag→Rechnung (vorher) + Angebot→Rechnung direkt (neu).
  - Betroffene Dateien: `app/dashboard/buero/page.tsx`.
  - Tests: lint + build grün.
- **Zuletzt erledigt (2026-05-18 – Stripe E2E)**:
  - **Stripe Webhook live**: Webhook `we_1TYSV1Ih98MCn5G32jwWGWQk` angelegt; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel gesetzt; E2E-Test im Test-Modus erfolgreich (Checkout-Session → Zahlung → Webhook empfangen).
  - Kein Code-Commit (nur Infrastruktur/Konfiguration).
- **Zuletzt erledigt (2026-05-18 – Delete-Buttons)**:
  - **BüroPilot Delete-Buttons verdrahtet**: Angebote/Aufträge/Rechnungen mit echten DB-Funktionen statt Soft-Delete.
  - Betroffene Dateien: `app/dashboard/buero/page.tsx`.
  - Tests: lint + build grün.
  - Commit: `897262b`.
- **Zuletzt erledigt (2026-05-18 – SteuerPilot Aufgaben 7–12)**:
  - **A7 – Monatsabschluss-Checkliste**: Zwei neue Checkpunkte ergänzt: „Fixkosten für diesen Monat geprüft" + „Betriebsausgaben für diesen Monat erfasst".
  - **A8 – recharts BarChart**: CSS-Balkendiagramm im Auswertungen-Tab durch echte `BarChart`-Komponente aus recharts ersetzt (X-Achse: Monat, Balken: USt rot / VSt grün, Tooltip mit `fmt()`, `ResponsiveContainer` 100% × 220px).
  - **A9 – Ausgaben-Übersicht-Karte**: Neue Karte „📊 Ausgaben-Übersicht" im Dashboard-Tab vor „Letzte Belege" — 4-Zeilen-Tabelle (Fixkosten monatl. / Betriebsausgaben / Belege Eingang / Anschaffungen) + Gesamtsumme.
  - **A10 – Aufbewahrungspflicht-Hinweis**: Beim Beleg-Löschen erscheint vor den Ja/Nein-Buttons der Hinweis „§ 147 AO: 10 Jahre Aufbewahrungspflicht".
  - **A11 – canViewSteuer**: Neue Permission `canViewSteuer` in `lib/roles.ts` (Admin/Büro/Inhaber); Rollen-Guard in `steuer/page.tsx` nach Loading-Spinner (zeigt 🔒-Hinweis für unberechtigte Rollen).
  - **A12 – Migration**: `npx supabase db push` ausgeführt — Remote-DB war bereits aktuell (Migration `20260518150000_add_steuer_erweiterung.sql` bereits angewendet).
  - Betroffene Dateien: `app/dashboard/steuer/page.tsx`, `lib/roles.ts`.
  - Tests: `npm run lint` grün (nur bekannte Warnungen); `npm run build` grün.
  - Branch: `main` (Commits `5afd134` Code, `a8259fd` Doku), gepusht und Vercel deployt.
- **Zuletzt erledigt (2026-05-18 – BüroPilot Workflow-Optimierung: Auftrag bei Buchung, Rechnung bei Zahlung)**:
  - **stripe-link/route.ts**: Nach erfolgreicher Abo-Buchung (Kunde bucht Module) wird jetzt automatisch ein Owner-Auftrag (`AUF-{subscriptionId}`) mit Status `Geplant` im Inhaber-BüroPilot angelegt (Admin-Client, `user_id=ownerUserId`, Idempotenz per Upsert).
  - **stripe-webhook/route.ts**: Nach Stripe-Zahlungsbestätigung (`paymentStatus === 'paid'`) wird eine Owner-Rechnung (Status `Erstellt`) im Inhaber-BüroPilot angelegt; dedupliziert per `payment_link_id` (checkout-session-ID); `genId` importiert.
  - **buero/page.tsx**: Nach Auftrag→Rechnung-Konvertierung öffnet das Mail-Modal nicht mehr automatisch; Tab wechselt zu Rechnungen; Versand vollständig manuell.
  - Alle Schritte (Buchung→Auftrag, Zahlung→Rechnung, Auftrag→Rechnung) sind Ein-Klick, aber kein Auto-Versand.
  - Betroffene Dateien: `app/api/billing/stripe-link/route.ts`, `app/api/billing/stripe-webhook/route.ts`, `app/dashboard/buero/page.tsx`.
  - Offene Punkte: Stripe Webhook-URL im Dashboard prüfen; echter End-to-End-Test Buchung→Auftrag→Zahlung→Rechnung ausstehend.
  - Tests: `npx tsc --noEmit` grün; `npm run build` grün.
  - Branch: `main` (Commit `7ba35c5`).
- **Zuletzt erledigt (2026-05-18 – 3 Briefpapier-Vorlagen + Template-Auswahl in Firmendaten)**:
  - **lib/pdf.ts vollständig überarbeitet**: Neuer Typ `PDFTemplate = 'modern-dark' | 'classic-light' | 'elegant-minimal'`; `briefpapier_layout.template` steuert welches Template genutzt wird.
  - **Template 1 – Modern Dark**: bisheriger Stil verfeinert (dunkler Navy-Header `(10,18,30)`, Akzentlinie, Firmenname in Akzentfarbe, dunkler Footer); Hint-Boxes dunkel mit Akzentborder.
  - **Template 2 – Classic Professional**: Deep-Navy-Header `(22,42,88)` mit weißem Firmenname + hellblauem Kontakt, Akzentlinie als Trennstreifen, hellgrauer Footer `(242,246,252)`; Hint-Boxes in Hellblau `(230,241,255)` mit marineblauem Text.
  - **Template 3 – Elegant Minimal**: kein Hintergrundfill, nur 2.5mm Akzentlinie am Seitenanfang, dunkler Ink-Firmenname, dünne graue Trennlinie; Footer nur Akzentlinie + helles Grau; Hint-Boxes mit Akzentborder auf fast-weißem Grund.
  - **Alle 3 Templates**: passen sich automatisch an Logo, Firmenname, Adresse, Steuer-IDs und Akzentfarbe des Nutzers an; werden für Rechnungen und Angebote gleichermaßen genutzt.
  - **Template-Auswahl-UI in Einstellungen → Firmendaten → Briefpapier**: 3 visuelle Mini-Vorschaukarten (proportional A4, 1:√2); ausgewähltes Template mit Akzentborder hervorgehoben; Dot-Indikator + Name + Beschreibung; Preview reagiert live auf gewählte Akzentfarbe.
  - **emptyFirma**: `briefpapier_layout.template` Default auf `'modern-dark'` gesetzt.
  - Betroffene Dateien: `lib/pdf.ts`, `app/dashboard/einstellungen/page.tsx`.
  - Tests: `npx tsc --noEmit` grün; `npm run build` grün.
  - Branch: `main` (Commit `23ec7d6`), Vercel deployed.
- **Zuletzt erledigt (2026-05-18 – Großes Feature-Paket: Inhaber-Dashboard + BüroPilot vollständig ausgebaut)**:
  - **Inhaber-Dashboard → Kunden eingerichtet**: Inhaber-User herausgefiltert (`!isOwnerAccount`); "🚫 Kunden sperren"-Button mit 2-Klick-Bestätigung (setzt `suspended`, löscht Pilot-Zuteilung); "📄 Rechnungen anzeigen"-Klapppanel pro Kunde (liest `buero_rechnungen` gefiltert nach `user_id`).
  - **Inhaber-Dashboard → Aktivitätslog**: Neue Sektion `aktivitaetslog` (nur Inhaber) mit `AuditLogSection`-Komponente, die `audit_logs` Tabelle ausließt (Zeitpunkt, Aktion, Durchgeführt von, Betrifft, Details).
  - **BüroPilot → PDF im Mail-Modal**: "📄 PDF erstellen & herunterladen"-Button direkt über dem Mail-Senden-Button im Rechnungs-Mail-Modal.
  - **BüroPilot → Mahnung-Stufen 1/2/3**: `handleMahnung` inkrementiert `mahnung_count` pro Rechnung; stufengerechte Mahntexte (freundlich / dringend / letztmalig) mit unterschiedlichen Formulierungen; Badge "N. Mahnung" in der Rechnungs-Liste; dynamischer Button-Label für Folge-Mahnungen.
  - **BüroPilot → Angebots-Gültigkeits-Reminder**: Gelber Warn-Banner oben im Angebote-Tab mit Anzahl abgelaufener/reminder-fälliger Angebote; "Abgelaufen"-Badge (badge-red) pro Angebots-Karte.
  - **Datenbereinigungs-Migration vorbereitet**: `20260518170000_cleanup_all_demo_data.sql` löscht alle Demo-/Testdaten aus allen Tabellen + Test-User aus `auth.users` (Inhaber + Demo bleiben). Muss manuell im Supabase SQL Editor ausgeführt werden (CLI-Auth temporär nicht verfügbar).
  - Betroffene Dateien: `app/dashboard/einstellungen/page.tsx`, `app/dashboard/buero/page.tsx`, `lib/db.ts`, `supabase/migrations/20260518170000_cleanup_all_demo_data.sql`.
  - Offene Punkte:
    - ✅ Datenbereinigung erfolgreich ausgeführt: alle Büro-/Lager-/Werkstatt-/Marketing-/Planung-/Steuer-/Billing-Tabellen geleert; Test-User gelöscht; nur `info@petersen-ki-pilot.de` bleibt in `auth.users`.
    - ✅ `mahnung_count`-Spalte in `buero_rechnungen` erfolgreich via Migration `20260518180000_add_buero_rechnung_mahnung_count.sql` angelegt.
  - Tests: `npm run build` grün.
  - Branch: `main` (Commits `435eaed`, `787ab12`, `0fe61f6`)
- **Zuletzt erledigt (2026-05-18 – Inhaber-Dashboard Pilot-Zuteilung + Kunden eingerichtet + BüroPilot Mahnungen/AB-Nummern)**:
  - **Inhaber-Dashboard → Offene Registrierungen**: Pilot-Auswahl (7 Toggle-Buttons: LagerPilot, BüroPilot, WerkstattPilot, MarketingPilot, AnalysePilot, PlanungPilot, SteuerPilot) pro pending User-Karte; Default `['buero', 'lager', 'analyse']`; beim Klick auf Demo7/Demo14/Standard werden die gewählten Piloten übergeben statt Hardcode.
  - **Inhaber-Dashboard → Neue Sektion "Kunden eingerichtet"**: Zeigt alle aktiven User; pro Karte: Status-Badge (aktiv/demo/Standard), Pilot-Übersicht (readonly) + editierbare Toggle-Buttons, Testzeitraum-Quick-Buttons (+7/+14/+30 Tage) + manuelles Datum, Save-Button (nutzt `handleManagedUserSave`), mailto-Kontakt-Button mit vorausgefülltem Text.
  - **BüroPilot → Mahnung öffnet mailto**: `handleMahnung` setzt jetzt Status auf `'Mahnung'` UND öffnet `mailto:` mit vorausgefülltem Mahnungstext (Rechnungsnummer, Betrag, Fälligkeitsdatum, 7-Tage-Frist); kein automatischer Versand; Toast sagt "Mail-Entwurf vorbereitet".
  - **BüroPilot → 2. Mahnung**: Bei Status `'Mahnung'` erscheint zusätzlich ein "📮 2. Mahnung"-Button.
  - **BüroPilot → AB-Nummern fortlaufend**: `handleABErstellen` generiert jetzt `AB-YYYY-NNN`-Nummern (z.B. `AB-2026-001`); wird im State, DB (`buero_auftraege.ab_nummer`) und Mail-Betreff (`handleABMailSend`) genutzt; im Demo-Modus: `AB-YYYY-DEMO`.
  - **BüroPilot → Rechnung sofort sichtbar + Mail-Modal**: Nach Auftrag→Rechnung-Konvertierung wird die neue Rechnung sofort im Rechnungen-State sichtbar und das Mail-Dialog öffnet sich direkt.
  - **lib/db.ts**: `BueroAuftragRecord` und `upsertBueroAuftrag` um `ab_nummer?: string` erweitert; `normalizeBueroAuftrag` liest `ab_nummer` aus DB.
  - Betroffene Dateien: `app/dashboard/einstellungen/page.tsx`, `app/dashboard/buero/page.tsx`, `lib/db.ts`.
  - Offene Punkte:
    - DB-Migration für `buero_auftraege.ab_nummer`-Spalte per `npx supabase db push` anwenden (Spalte existiert lokal noch nicht in Remote-DB).
    - Echten End-to-End-Test: Registrierung → Pilot-Zuteilung → Freischaltung → Login → Pilot-Zugang prüfen.
  - Tests: `npm run lint` grün (nur bekannte Warnungen); `npm run build` grün.
  - Branch: `feature/owner-dashboard-buero-pilot-v2` (Commits `24bb433`, `7998757`)
- **Zuletzt erledigt (2026-05-18 – SteuerPilot Massiverweiterung)**:
  - **Neue Navigation**: 9 Tabs (Dashboard, Einnahmen, Belege, Fixkosten, Betriebsausgaben, Anschaffungen, UStVA, Auswertungen, Export) mit Icon + Label.
  - **Fixkosten-Modul**: Vollständiges CRUD mit 16 Kategorien, Zahlungsintervallen (monatlich/quartalsweise/halbjährlich/jährlich), automatischem monatlichem Anteil, Vorsteuerberechnung, Datei-Upload, Kategorie-Balkendiagramm, Aktiv/Inaktiv-Toggle, Suche & Filter.
  - **Betriebsausgaben-Modul**: Variable Einzelausgaben mit 15 Kategorien, Monatsfilter, Tabellen- & Kartenansicht, Summenspalte, Vorsteuer-Ausweis, Upload.
  - **Anschaffungen-Modul**: Wirtschaftsgüter-Verwaltung mit GWG-Erkennung (≤ 800 € netto), AfA-Berechnung nach amtlicher Nutzungsdauer, Restbuchwert, Seriennummer, Garantiedatum, Upload.
  - **Einnahmen-Tab**: Liest echte `buero_rechnungen` je Monat, zeigt USt aus Rechnungen, Status-Übersicht; verbindet BüroPilot mit SteuerPilot.
  - **Dashboard**: Zentrale KPI-Übersicht mit USt/VSt/Zahllast, Warnungs-Panel, klickbare Schnellzugriffe, Letzte Belege.
  - **Belege verbessert**: Inline-Status-Dropdown (ohne Modal), Duplikat-Erkennung (gleicher Lieferant + Betrag ±7 Tage), Datei-Vorschau-Link, Suche/Filter, Prüfungs-Checkliste.
  - **UStVA verbessert**: Auto-Aggregat aus `buero_rechnungen` (USt) + Belegen (VSt), Ampel-Badge, Einnahmen-Zeile, klickbarer Verlauf.
  - **Auswertungen**: CSS-Balkendiagramm USt/VSt, Jahrestabelle mit Summen, Vorsteuer nach Steuersatz.
  - **Shared-Komponenten**: `components/steuer/shared.tsx` mit wiederverwendbaren Typen, Helpers und UI-Atomen.
  - **DB-Migration**: `20260518150000_add_steuer_erweiterung.sql` — Tabellen `steuer_fixkosten`, `steuer_betriebsausgaben`, `steuer_anschaffungen` mit RLS.
  - **lib/db.ts**: Neue Funktionen `getSteuerFixkosten/upsertSteuerFixkosten/deleteSteuerFixkosten`, `getSteuerBetriebsausgaben/upsertSteuerBetriebsausgabe/deleteSteuerBetriebsausgabe`, `getSteuerAnschaffungen/upsertSteuerAnschaffung/deleteSteuerAnschaffung`, `uploadSteuerDokument`.
  - Betroffene Dateien: `app/dashboard/steuer/page.tsx`, `components/steuer/shared.tsx`, `components/steuer/SteuerFixkosten.tsx`, `components/steuer/SteuerBetriebsausgaben.tsx`, `components/steuer/SteuerAnschaffungen.tsx`, `lib/db.ts`, `supabase/migrations/20260518150000_add_steuer_erweiterung.sql`.
  - Offene Punkte:
    - ✅ Migration `20260518150000_add_steuer_erweiterung.sql` — Remote war bereits aktuell (A12, 2026-05-18).
    - ✅ Fixkosten/Betriebsausgaben/Anschaffungen in UStVA-VSt einbezogen — `vorsteuerGesamt` (A1–4, 2026-05-18).
    - ✅ Auswertungs-Charts: recharts `BarChart` ersetzt CSS-Balken (A8, 2026-05-18).
  - Tests: `npm run lint` grün (nur bestehende Warnungen); `npm run build` grün.
  - Branch: `main`
- **Zuletzt erledigt (2026-05-18 – BüroPilot Angebot→Auftrag→Rechnung Vollprozess)**:
  - **Angebote**: Status `Entwurf` → `Erstellt` (Freigabe) → `Versendet` (nach mailto); fortlaufende Nummern via `pk_next_angebot_number()`; ⏰-Reminder-Badge nach 10 Tagen ohne Auftragskonvertierung; Mail öffnet lokales Mailprogramm mit vorausgefülltem Empfänger/Betreff.
  - **Aufträge**: neue Stati `AB erforderlich` → `AB erstellt` → `AB versendet` → `In Bearbeitung`; AB per mailto verschicken; Workflow-Buttons pro Status; „→ Rechnung erstellen" wechselt direkt in Rechnungen-Tab.
  - **Rechnungen**: neue Rechnungen starten als `Erstellt` (muss verschickt werden); „✉️ Verschicken"-Button setzt Status auf `Offen`.
  - **DB-Migration**: `20260518120000_add_buero_workflow_columns.sql` – Spalten `buero_angebote.nummer`, `buero_angebote.verschickt_am`, `buero_auftraege.angebot_id`, `buero_auftraege.ab_verschickt_am`, Funktion `pk_next_angebot_number()`.
  - Betroffene Dateien: `supabase/migrations/20260518120000_add_buero_workflow_columns.sql`, `lib/db.ts`, `app/dashboard/buero/page.tsx`.
  - Offene Punkte:
    - Echten End-to-End-Durchlauf testen: Angebot erstellen → freigeben → verschicken → Auftrag → AB → Rechnung.
  - Remote-DB: Migration `20260518120000_add_buero_workflow_columns.sql` per `npx supabase db push` angewendet; Local = Remote.
  - Tests: `npm run lint` grün (bekannte Warnungen); `npm run build` grün.
  - Branch: `main` (Merge-Commit `0ecb4fc`, zuvor `feature/buero-workflow`), Vercel deployt automatisch.
- **Zuletzt erledigt (2026-05-18 – Manueller Registrierungs-/Billing-Prozess ohne automatischen Mailversand)**:
  - **Automatischen Mailversand aus dem Zielprozess entfernt**: keine automatische Rechnungs-/Angebotsmail mehr; vorhandene Mail-Aktionen öffnen nur noch einen lokalen `mailto:`-Entwurf.
  - **Registrierung läuft serverseitig ohne Bestätigungsmail**: neue Route `app/api/auth/register/route.ts` erstellt Supabase-Auth-User per Admin API, setzt `access_status = pending` und legt im Inhaber-BüroPilot automatisch einen Kunden aus den Registrierungsdaten an.
  - **Eigener Tab `Offene Registrierungen` ergänzt**: Inhaber können Registrierungen direkt als `Demo 7 Tage`, `Demo 14 Tage` oder `Standard` freischalten und passende Mail-Textbausteine öffnen.
  - **Inhaber-Dashboard erweitert**: offene Registrierungen erscheinen direkt im Inhaber-Cockpit mit Schnellbuttons und Mailtext.
  - **Billing-Prozess manuell strukturiert**: Kundenbuchung erzeugt keine Rechnung mehr automatisch; Billing-Sync legt Kunden- und Auftragskontext im Inhaber-BüroPilot an. Die Rechnung wird erst per Inhaber-Klick erstellt und erscheint danach im BüroPilot unter Rechnungen.
  - **DB-Fundament ergänzt**: neue Migration `20260518103000_manual_registration_billing_flow.sql` verknüpft `buero_auftraege` mit `billing_subscription_id` und synchronisiert Billing-Buchungen als Owner-Aufträge; `20260518120000_add_buero_workflow_columns.sql` ergänzt Angebots-/Auftragsworkflow-Felder.
  - Betroffene Dateien: `app/api/auth/register/route.ts`, `app/register/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/einstellungen/page.tsx`, `components/billing/OwnerCustomerControlPanel.tsx`, `app/dashboard/buero/page.tsx`, `lib/billing.ts`, `lib/db.ts`, `supabase/schema.sql`, `supabase/migrations/20260518103000_manual_registration_billing_flow.sql`, `supabase/migrations/20260518120000_add_buero_workflow_columns.sql`, `.env.example`, `package.json`, `package-lock.json`, `PROJECT_STATUS.md`.
  - Remote-DB: Migrationen `20260518103000_manual_registration_billing_flow.sql` und `20260518120000_add_buero_workflow_columns.sql` am `2026-05-18` per `npx supabase db push` angewendet. Remote geprüft: `buero_auftraege.billing_subscription_id`, `buero_auftraege.angebot_id`, `buero_auftraege.ab_verschickt_am`, `buero_angebote.nummer`, `buero_angebote.verschickt_am` existieren; Trigger `trg_sync_billing_subscription_to_owner_customer` ist vorhanden.
  - Offene Punkte:
    - Echten Registrierungs-/Buchungsdurchlauf testen.
    - Optional spaeter: Rechnungs-PDF-Erzeugung/Download direkt im manuellen Mailprozess komfortabler machen.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
  - Branch: `feature/manual-registration-billing-flow`
- **Zuletzt erledigt (2026-05-18 – Registrierungsfreigabe + Pilot-Zuteilung)**:
  - **Neue Registrierungen starten jetzt gesperrt**: `register` schreibt neue Accounts mit `access_status = pending`, ohne Demo-Freigabe und ohne zugewiesene Piloten.
  - **Dashboard-Zugang serverseitig abgesichert**: `middleware.ts` blockiert nicht freigeschaltete, gesperrte oder abgelaufene Zugänge und leitet auf `/freischaltung` um; direkte Pilot-URLs werden nur noch bei expliziter Zuteilung zugelassen.
  - **Inhaber-Steuerung erweitert**: `Einstellungen -> Rollen` kann jetzt pro Benutzer Freigabestatus, Zugangsart (`standard` / `demo`), Ablaufdatum und erlaubte Piloten speichern; zusätzlich gibt es einen vorbereiteten `mailto:`-Kontaktlink.
  - **Navigation und Dashboard gefiltert**: Sidebar, Mobile-Navigation und Dashboard zeigen nur noch freigegebene Piloten; ohne Zuteilung erscheint ein klarer Hinweis statt Modulen.
  - **Owner-Dashboard ergänzt**: Inhaber sehen offene Registrierungen jetzt direkt als Kennzahl und Hinweisblock im Dashboard.
  - Betroffene Dateien: `app/register/page.tsx`, `app/login/page.tsx`, `app/freischaltung/page.tsx`, `middleware.ts`, `app/api/admin/users/route.ts`, `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`, `components/Sidebar.tsx`, `app/dashboard/einstellungen/page.tsx`, `lib/access.ts`, `PROJECT_STATUS.md`.
  - Offene Punkte:
    - Optional spaeter: separate E-Mail-Textbaustein-Auswahl je Freigabetyp, Einladung erneut öffnen und echte Deaktivieren/Loeschen-Aktionen fuer Benutzer.
    - Optional spaeter: eigene Historie/Benachrichtigung nur fuer Registrierungsfreigaben statt reiner Benutzerlisten-Auswertung.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
  - Branch: `main`
- Stand `2026-05-15` — Branch: `main` (Commit `30f0e47`), Vercel Production deployed und Ready.
- **Zuletzt erledigt (2026-05-15 – Demo-Daten bereinigt + AnalysePilot live)**:
  - **Dashboard Fake-KPIs entfernt**: `kpi`-Initialstate war `demoKpis` (8 Artikel, 3 kritisch…) — jetzt Nullwerte; echte User sehen keine Fake-Zahlen mehr vor dem Laden.
  - **Owner-Snapshot nur für Inhaber**: `getOwnerDashboardSnapshot()` wird jetzt nur noch aufgerufen wenn `role === 'Inhaber'` (sequenziert nach `loadRole()`).
  - **Inhaber-Cockpit verbessert**: Empty-State für „Letzte Aktivitäten" wenn keine Billing-Events; neuer `↻ Aktualisieren`-Button zum manuellen Reload des Snapshots.
  - **AnalysePilot vollständig auf Live-Daten umgestellt**:
    - KPI-Initialstate war `DEMO_KPI` → jetzt `ZERO_KPI`; Demo-Pfad explizit getrennt.
    - KI-Tab: echte Daten aus `buero_dokumente` (letzte 7 Tage) statt statischer Beispielwerte. Erkennungen pro Wochentag, Genauigkeit aus `confidence >= 0.7`, Dokumenttypen-Verteilung als neue Tabelle. Empty-State wenn keine KI-Dokumente vorhanden.
    - Bestandstrend: kein fake 0-Befüllen für Vorwochen mehr; zeigt nur echten aktuellen Snapshot mit ehrlichem Hinweis.
    - Pilot-Nutzungsgrafik: Label „Indikativ – kein Session-Logging aktiv" hinzugefügt.
  - Betroffene Dateien: `app/dashboard/page.tsx`, `app/dashboard/analyse/page.tsx`, `PROJECT_STATUS.md`.
  - Offene Punkte:
    - Analyse-Bestandstrend: Wochensnapshots in eigener Tabelle für echten Verlauf (optional später).
    - Stripe Webhook-URL in Stripe-Dashboard prüfen.
  - Tests: `npm run build` grün. Auf `main` gemergt + deployed.
- **Zuletzt erledigt (2026-05-15 – Benutzer-Einladung/Anlage mit Abo-Limit)**:
  - **Einladen und Anlegen erweitert**: die zentrale Live-Benutzerverwaltung kann jetzt neue Benutzer entweder per E-Mail einladen oder direkt mit temporaerem Passwort anlegen.
  - **Abo-/Seat-Limit serverseitig erzwungen**: die Admin-Route loest zuerst den Billing-Kontext des aktuellen Accounts auf und erlaubt neue Benutzer nur bei aktivem, freigeschaltetem Abo. Ohne Abo oder ohne freie Plaetze wird serverseitig blockiert.
  - **Mitarbeiterstaffel wird live beruecksichtigt**: `1-3` erlaubt max. `3`, `4-10` max. `10`, `11-30` max. `30`, `30+` sehr hohe Obergrenze. Gezaehlt werden der buchende Hauptaccount plus bereits angelegte/eingeladene Team-Benutzer, die an dieselbe `billing_subscription_id` gebunden sind.
  - **Admin-/Owner-Schutz bleibt aktiv**: normale Admins duerfen weiter keine `Inhaber`-Rolle vergeben; die eigene Rolle kann nicht ueber diese Verwaltung veraendert werden.
  - **UI erweitert**: `Einstellungen -> Rollen` zeigt jetzt Seat-Auslastung, Begruendung bei Blockierung, Invite-Form und Direktanlage-Form.
  - Betroffene Dateien: `app/api/admin/users/route.ts`, `app/dashboard/einstellungen/page.tsx`, `PROJECT_STATUS.md`.
  - Offene Punkte:
    - Optional spaeter: Benutzer deaktivieren/loeschen, Einladung erneut öffnen, Such-/Filterfunktionen.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-15 – Live-Benutzerverwaltung / Rollen serverseitig)**:
  - **Zentrale Live-Benutzerverwaltung eingebaut**: neue Admin-Route `app/api/admin/users/route.ts` listet echte Supabase-Auth-Benutzer serverseitig und speichert Rollen serverseitig per Admin API statt lokal im Browser.
  - **Rollenvergabe jetzt zentral steuerbar**: In `Einstellungen -> Rollen` gibt es fuer Inhaber/Admin eine Live-Tabelle mit Benutzerliste, Rollenwahl und Speichern pro Benutzer.
  - **Sicherheitsleitplanken aktiv**: keine Selbst-Aenderung der eigenen Rolle, normale Admins duerfen keine `Inhaber`-Rolle vergeben oder bestehende Inhaber-Konten aendern; Rollenwechsel werden ins `audit_logs` geschrieben.
  - **Rechte erweitert**: `canManageUsers` gilt jetzt fuer `Inhaber` und `Admin`, passend zum neuen Produktivfluss.
  - Betroffene Dateien: `app/api/admin/users/route.ts` (neu), `app/dashboard/einstellungen/page.tsx`, `lib/roles.ts`, `PROJECT_STATUS.md`.
  - Offene Punkte:
    - Optional spaeter: Filter/Suche, Deaktivieren/Entfernen von Benutzern, gesonderte Owner-Ansicht fuer Einladungen.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-15 – Infra-Validierung + Produktiv-Haertung)**:
  - **Remote-Supabase geprueft**: `supabase migration list` zeigt, dass `20260514040000_add_stripe_webhook_events.sql` und `20260515090000_add_owner_ai_feature_toggles.sql` bereits remote angewendet sind; die alten "offen"-Hinweise waren veraltet.
  - **Alter automatischer Mailversand validiert**: Der fruehere serverseitige Versandpfad wurde technisch geprueft, ist aber durch den neuen manuellen Mailprozess abgeloest.
  - **Stripe-Webhook live geprueft**: `vercel curl` auf `app/api/billing/stripe-webhook` antwortet auf unsignierten Request korrekt mit `Stripe-Webhook konnte nicht verifiziert werden.`; Route ist aktiv, Signaturpruefung greift.
  - **Rollen produktionsnah gehaertet**: Self-Service-Rollenwechsel im Live-Betrieb entfernt; Rollen koennen nur noch im Demo-Modus lokal gewechselt werden. Die Einstellungen-UI zeigt produktiv jetzt klar, dass Rollen zentral ueber Inhaber/Admin vergeben werden muessen.
  - **Büro-Detailansichten erweitert**: Angebote, Auftraege und Rechnungen haben jetzt echte verknuepfte Detailkontexte mit Kundenbezug, Dokumenten, Folgeobjekten bzw. Zahlungsverlauf statt nur generischer Feldlisten.
  - Betroffene Dateien: `lib/roles.ts`, `app/dashboard/einstellungen/page.tsx`, `lib/db.ts`, `app/dashboard/buero/[entity]/[id]/page.tsx`, `PROJECT_STATUS.md`.
  - Offene Punkte:
    - Vollstaendige Stripe-Ende-zu-Ende-Zahlung konnte in dieser Session nicht simuliert werden, weil die echten Secret-Werte lokal nicht verfuegbar sind und das Deployment hinter Vercel Protection liegt.
    - Zentrale Live-Benutzerverwaltung fuer vorhandene Auth-Benutzer ist jetzt implementiert; Einladungen/Neuanlage fehlen noch.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-15 – Owner KI-Toggle / Testphase ohne API-Kosten)**:
  - **Owner-KI-Steuerung eingebaut**: neues `OwnerAiControlPanel` im Inhaber-Cockpit und in `Einstellungen -> Kundensteuerung` mit Schaltern fuer `KI global`, `Lager-KI / Tagesbericht` und `Dokumenten-KI`.
  - **Serverseitige Absicherung aktiv**: `app/api/chat/route.ts` und `app/api/document-ai/route.ts` pruefen jetzt vor jedem externen API-Call die globale Owner-Freigabe. Bei `Aus` werden Requests sauber lokal geblockt statt kostenpflichtig ausgefuehrt.
  - **DB-/Schema-Fundament ergaenzt**: `firma_einstellungen` um `ai_enabled`, `ai_chat_enabled`, `ai_document_enabled` erweitert; neue SQL-Funktion `pk_get_ai_settings()` liefert den Status fuer alle Rollen trotz RLS sicher aus.
  - **UI-Hinweise ergaenzt**: LagerPilot und KI-Assistent zeigen bei deaktivierter KI klare Hinweise und deaktivieren passende Aktionen/Buttons.
  - Betroffene Dateien: `components/billing/OwnerAiControlPanel.tsx` (neu), `app/dashboard/page.tsx`, `app/dashboard/einstellungen/page.tsx`, `app/dashboard/lager/page.tsx`, `app/dashboard/ki-erkennung/page.tsx`, `app/api/chat/route.ts`, `app/api/document-ai/route.ts`, `lib/db.ts`, `lib/ai-settings.ts` (neu), `supabase/schema.sql`, `supabase/migrations/20260510213000_live_schema_updates.sql`, `supabase/migrations/20260515090000_add_owner_ai_feature_toggles.sql`.
  - Offene Punkte:
    - Migration `20260515090000_add_owner_ai_feature_toggles.sql` muss noch auf Remote-Supabase angewendet werden.
    - `ANTHROPIC_API_KEY` konnte in dieser Session nicht in Vercel eingetragen werden: lokal liegt kein sicherer Key vor, und die `vercel`-CLI ist hier nicht installiert.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-15 – KI-Vereinheitlichung auf OpenAI)**:
  - `app/api/chat/route.ts` nutzt jetzt ebenfalls die OpenAI Responses API statt Anthropic.
  - Lager-KI, Tagesbericht und Dokument-KI koennen damit ueber denselben `OPENAI_API_KEY` laufen.
  - `ANTHROPIC_API_KEY` ist fuer die aktive KI-Schiene damit nicht mehr erforderlich.
  - Betroffene Dateien: `app/api/chat/route.ts`, `PROJECT_STATUS.md`.
  - Tests: `npm run lint` gruen (nur bekannte Warnungen); `npm run build` gruen.
- Aktueller Branch: `feature/infra-validation-and-hardening`
- **Zuletzt erledigt (2026-05-14 – Welle 7 / alte automatische Mail-Integration, inzwischen abgeloest)**:
  - **Automatischer Versand angebunden**: frueherer serverseitiger Dokumentversand mit PDF-Anhang und Audit-Log.
  - **PDF-Funktionen erweitert**: `generateRechnungPDF` und `generateAngebotPDF` haben optionalen `returnBase64`-Parameter; Download-Verhalten unveraendert.
  - **BueroePilot**: `✉️ Mail`-Button neben PDF bei Rechnungen und Angeboten; oeffnet Modal mit vorausgefuellter Kunden-Email (aus `buero_kunden`), editierbar; Toast-Feedback; Audit-Log bei Versand.
  - **Env**: fruehere Mail-Variablen wurden mit dem manuellen Prozess wieder entfernt.
  - Betroffene Dateien damals: `lib/pdf.ts`, `app/dashboard/buero/page.tsx`, `.env.example`, `package.json`.
  - Tests: lint gruen (keine neuen Fehler); build gruen.
- **Vercel Env-Stand (2026-05-14, nach Session-Ende)**:
  - ✅ `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` gesetzt
  - ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt
  - ✅ `OPENAI_API_KEY` gesetzt
  - ℹ️ `ANTHROPIC_API_KEY` fuer die aktive KI-Schiene nicht mehr noetig, da Lager-/Chat-KI jetzt ebenfalls ueber OpenAI laeuft
- **Naechster Schritt morgen**:
  - Hinweis: Dieser automatische Versandpfad ist nicht mehr Teil des aktuellen Zielprozesses.
  - 🟡 Sicherstellen, dass `OPENAI_API_KEY` gesetzt bleibt; optional `OPENAI_CHAT_MODEL` definieren
  - 🟢 Mail-Versand testen: BueroPilot → Rechnung → ✉️ Mail → Test-Mail an eigene Adresse
  - 🟢 Naechste Features: Stripe Customer Portal Link, Mahnwesen/Dunning, Onboarding-Mail bei Freischaltung


- **Zuletzt erledigt (2026-05-14 – Welle 6 / Webhook-Idempotenz + Owner KPIs Phase 2)**:
  - **Stripe-Webhook Event-ID-Dedupe**: neue Tabelle `stripe_webhook_events` (PK `event_id`) plus Migration `20260514040000_add_stripe_webhook_events.sql`; Webhook-Route prueft jetzt zuerst `event.id` und antwortet bei Wiederholung `202 already_processed`. Verhindert doppelte `billing_payments` und `audit_logs` bei Stripe-Retries (bis zu 3 Tage). Bestehender Status-Mapping- und Owner-Event-Pfad (`syncStripeInvoiceState`) bleibt unveraendert.
  - **Owner-Dashboard erweitert**: `OwnerDashboardSnapshot` um `revenueLast30Days` und `overdueInvoices` ergaenzt. Dashboard zeigt jetzt zusaetzlich zwei Kacheln: `Umsatz 30 Tage` und `Überfällig >14 T` als Delta auf der `Offene Rechnungen`-Karte. UI bleibt Petersen-KI-konform (gleiche Kachel-Logik, eigene Akzentfarbe `#34d399` fuer 30-Tage-Umsatz).
  - **Architekturentscheidung kurz**: Idempotenz wird bewusst nicht ueber `provider_event_id`-Spaltenumdeutung gemacht, sondern ueber eine eigenstaendige Tabelle. So bleibt das bestehende Datenmodell stabil und der Dedupe-Pfad ist unabhaengig vom Audit-/Payment-Schreibpfad.
  - Betroffene Dateien: `app/api/billing/stripe-webhook/route.ts`, `app/dashboard/page.tsx`, `lib/db.ts`, `supabase/schema.sql`, `supabase/migrations/20260514040000_add_stripe_webhook_events.sql`.
  - Offene Punkte:
    - Migration `20260514040000_add_stripe_webhook_events.sql` muss noch auf Remote-Supabase angewendet werden (`supabase db push`).
    - Polling-Pfad (`/api/billing/stripe-sync`) bleibt bewusst dedupe-frei, da bewusst Owner-getrieben.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen, alle Routen kompilieren.


- **Leitplanken fuer weitere Arbeit**:
  - Keine Login-Daten, Secrets, Zugangsdaten oder Tokens ins Repo schreiben.
  - Fuer Owner-/Billing-Planung bei Bedarf Zusatzkontext in `/Users/kevinpetersen/owner-dashboard-project/project-status.md`.
- **Zuletzt erledigt (2026-05-14 – Welle 3B / Stripe statt Qonto)**:
  - **Zahlungsanbieter umgestellt**: die aktive Checkout-/Webhook-/Polling-Integration laeuft jetzt ueber Stripe Checkout Sessions statt ueber Qonto.
  - **Serverseitige Stripe-Schicht eingebaut**: neue Dateien `lib/stripe.ts`, `lib/stripe-sync.ts` sowie API-Routen `app/api/billing/stripe-link/route.ts`, `app/api/billing/stripe-sync/route.ts` und `app/api/billing/stripe-webhook/route.ts`.
  - **Qonto-Pfade entfernt**: bisherige Qonto-Routen und -Helper wurden aus der aktiven Integrationsschicht entfernt, damit das Projekt klar auf Stripe zeigt.
  - **Bestehendes Rechnungsmodell beibehalten**: vorhandene Rechnungs-/Payment-/Owner-Tabellen wurden bewusst weiterverwendet; `payment_link_*` Felder tragen jetzt Stripe-Checkout-Session-Daten.
  - **Owner-Events erweitert**: Supabase-Checks erlauben jetzt auch Quelle `stripe`; Dashboard-/Aktivitaetsansicht und Demo-Texte sprechen entsprechend Stripe.
  - **Architekturentscheidung kurz**: statt eines grossen Refactorings bleibt das Datenmodell generisch, nur die Provider-Kapselung wurde ausgetauscht. Idempotenz bleibt je Rechnung ueber `payment_link_reference`.
  - Betroffene Dateien: `app/api/billing/stripe-link/route.ts`, `app/api/billing/stripe-sync/route.ts`, `app/api/billing/stripe-webhook/route.ts`, `components/billing/PaymentInstructions.tsx`, `app/dashboard/page.tsx`, `lib/billing.ts`, `lib/db.ts`, `lib/stripe.ts`, `lib/stripe-sync.ts`, `package.json`, `package-lock.json`, `supabase/schema.sql`, `supabase/migrations/20260514030000_add_stripe_owner_source.sql`, `.env.example`.
  - Offene Punkte:
    - Fuer Live-Betrieb werden `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` und `SUPABASE_SERVICE_ROLE_KEY` serverseitig benoetigt.
    - Stripe-Webhook deckt `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` und `checkout.session.expired` ab; echte Sandbox-/Testmode-Validierung sollte als naechstes erfolgen.
    - Falls spaeter weitere Stripe-Zahlarten oder Billing-Subscriptions gewuenscht sind, sollte das bewusst als eigener Ausbauschritt erfolgen.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
  - Commit: `8fc7e9a` auf `feature/billing-cart-fix` – alle neuen Dateien und Migrations eingecheckt; leere Qonto-Ordner entfernt.
  - **Live-Test bestätigt (2026-05-14)**: Stripe-Checkout funktioniert auf `app.petersen-ki-pilot.de`; Zahlungsbestätigung per SMS erhalten. Fehlende Migrationen nachgezogen (`db push`). Invoice-Anlage server-seitig gefixt (Commits `f29ba53`, `001e500`).
- **Zuletzt erledigt (2026-05-14 – Welle 3A / Qonto Invoice Sync + Owner KPIs)**:
  - **Qonto-Link an echte Rechnung gekoppelt**: neue Server-Route `app/api/billing/qonto-link/route.ts` erzeugt/reused Qonto-Payment-Links jetzt direkt aus `buero_rechnungen`, speichert Link-Metadaten an der Rechnung und haelt eine interne Referenz fuer Idempotenz.
  - **Sicherer Fallback bleibt aktiv**: wenn Qonto/API/Provider noch nicht fertig konfiguriert ist, wird kein Secret benoetigt; Rechnung markiert den sauberen Fallback und die UI bleibt beim Banktransfer/WhatsApp-Belegfluss nutzbar.
  - **Webhook-/Polling-Struktur vorbereitet**: `app/api/billing/qonto-webhook/route.ts`, `app/api/billing/qonto-sync/route.ts` sowie `lib/qonto-sync.ts` mappen Qonto-Link-/Payment-Status auf Rechnung + `billing_payments`, schreiben Audit-Logs und stoßen Owner-Events ueber neue DB-Funktion `pk_register_owner_event()` an.
  - **Owner-Dashboard erweitert**: neue Snapshot-Logik fuer Umsatz, ausstehende Freischaltungen, offene Rechnungen, fehlgeschlagene Zahlungen und letzte Aktivitaeten; UI bleibt im bestehenden Dashboard.
  - **Architekturentscheidung kurz**: Qonto bleibt komplett serverseitig gekapselt; Client-UI fragt nur interne API-Routen an. Idempotenz laeuft ueber `payment_link_reference` je echter Rechnung statt ueber harte Fremd-Header/Secrets im Frontend.
  - Betroffene Dateien: `app/api/billing/qonto-link/route.ts`, `app/api/billing/qonto-sync/route.ts`, `app/api/billing/qonto-webhook/route.ts`, `app/dashboard/page.tsx`, `components/billing/PaymentInstructions.tsx`, `components/billing/PricingSettingsPage.tsx`, `lib/db.ts`, `lib/qonto.ts`, `lib/qonto-sync.ts`, `lib/supabase-admin.ts`, `supabase/schema.sql`, `supabase/migrations/20260514023000_add_qonto_invoice_sync_fields.sql`, `.env.example`.
  - Offene Punkte:
    - Qonto-Provider-Connection (`/v2/payment_links/connections`) wird noch nicht aktiv im UI geprueft; aktuell wird fehlende Konfiguration sauber als Fallback behandelt.
    - Webhook ist signaturpruefend vorbereitet, braucht fuer Live-Nutzung aber `QONTO_WEBHOOK_SECRET` und `SUPABASE_SERVICE_ROLE_KEY`.
    - Qonto-Webhooks liefern laut Doku Payment-Link- und Payment-Status; fuer Sonderfaelle wie Teilzahlungen/Mehrfachzahlungen ist noch ein fachlicher Owner-Entscheid noetig.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-14 – Welle 1 / Owner Notifications)**:
  - **Owner-Event-Inbox vorbereitet**: neues DB-Fundament fuer `owner_event_inbox` und `owner_notifications` in `schema.sql` plus Migration angelegt.
  - **Billing → Glocke gekoppelt**: Billing-Insert/Statuswechsel/Freischaltung erzeugen jetzt Owner-Events/Notifications ueber DB-Trigger.
  - **NotificationBell erweitert**: Owner-Billing-Hinweise laufen jetzt in die bestehende Glocke; Read-State wird lokal gespeichert.
  - **DB-Zugriff ergänzt**: `listOwnerNotifications()` in `lib/db.ts` ergaenzt; `lib/warnings.ts` mischt Owner-Hinweise in die bestehende Warnungslogik.
  - Betroffene Dateien: `supabase/schema.sql`, `supabase/migrations/20260514010000_add_owner_notifications_inbox.sql`, `lib/db.ts`, `lib/warnings.ts`, `components/NotificationBell.tsx`.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-14 – Welle 4 / Billing UX & Owner Actions)**:
  - **Stripe-Callback-Banner eingebaut**: `app/dashboard/einstellungen/page.tsx` liest URL-Params `?payment=success/cancelled` aus; zeigt grünes/oranges Banner im Billing-Tab und bereinigt die URL danach. `?section=kundensteuerung` öffnet direkt die Kundensteuerung.
  - **Freischaltungs-Review-Flow**: `OwnerCustomerControlPanel` zeigt Kunden mit `proof_sent`-Status prominent oben als Quick-Action "Jetzt freischalten" (grüner Banner); Kunden mit `pending_payment` bekommen einen gelben Hinweis mit "Erneut kontaktieren" (mailto) und Stornieren-Button.
  - **Inhaber-Dashboard Action-Banner**: Dashboard-Cockpit zeigt bei `pendingActivations > 0` einen grünen Aktions-Banner und bei `failedPayments > 0` einen roten Banner – beide mit Direktlink zur Kundensteuerung.
  - Betroffene Dateien: `components/billing/OwnerCustomerControlPanel.tsx`, `app/dashboard/einstellungen/page.tsx`, `app/dashboard/page.tsx`.
  - Tests: lint + build grün; bekannte Warnungen unverändert. Commit `8d76a46` auf `feature/billing-ux-improvements`.
- **Zuletzt erledigt (2026-05-14 – Welle 5 / Nummernkreis + PDF)**:
  - **Nummernkreis finalisiert**: Manuelle Büro-Rechnungen holen jetzt `getNextInvoiceNumber()` und setzen `nummer` (RE-YYYY-XXXXX); Rechnungsliste und Kunden-Detailansicht zeigen `nummer` statt `id`; PDF-Dateiname nutzt `nummer`.
  - **PDF grundlegend veredelt** (`lib/pdf.ts`): Petersen-KI-konformes dunkles Header-Band mit vollem Firmenkontakt, DIN-5008-Absenderzeile, Metadaten-Block rechts, dunkle Tabellen-Header, Netto/MwSt/Brutto aus DB-Feldern, Zahlungshinweis-Box mit Bankdaten + Verwendungszweck, dunkler Footer. Gilt für Rechnung und Angebot.
  - Betroffene Dateien: `lib/pdf.ts`, `app/dashboard/buero/page.tsx`. Commit `32be432` auf `feature/invoice-numbering-pdf`.
  - Tests: lint + build grün, nur bekannte Warnungen.
- **Naechster Umsetzungsschritt**:
  - Branch `feature/invoice-numbering-pdf` mergen und pushen
  - Webhook-URL in Stripe-Dashboard auf `app.petersen-ki-pilot.de/api/billing/stripe-webhook` prüfen
- **Zuletzt erledigt (2026-05-14 – Welle 2A / Billing Entities)**:
  - **Billing-faehige Stammdaten erweitert**: `buero_kunden` und `buero_rechnungen` um Billing-/Abo-/Rechnungsfelder erweitert.
  - **Neue Tabellen vorbereitet**: `billing_payments` und `audit_logs` inkl. RLS/Indizes als Fundament fuer Zahlungen und Nachvollziehbarkeit.
  - **Owner-Kundensync gehaertet**: Trigger schreibt jetzt `auth_user_id`, `source`, `billing_subscription_id` und `software_enabled` mit.
  - **Service-Helfer ergänzt**: in `lib/billing.ts` jetzt Helfer fuer Customer-Sync, Invoice-Draft/Invoice-Erzeugung und Payment-Recording.
  - Betroffene Dateien: `supabase/schema.sql`, `supabase/migrations/20260514013000_add_billing_entities_and_audit.sql`, `lib/db.ts`, `lib/billing.ts`.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-14 – Welle 2B / Booking Automation)**:
  - **Buchung -> Kunde -> Rechnung verdrahtet**: `createBookingRequest()` erzeugt bei echter Buchung jetzt automatisch Owner-Kunde und Initialrechnung.
  - **Idempotenz gegen Doppelrechnung**: bei erneuter Buchung fuer dasselbe Abo wird eine bestehende Subscription-Rechnung wiederverwendet statt neu erzeugt.
  - **Rechnungsabfrage ergänzt**: `getLatestBueroRechnungBySubscriptionId()` in `lib/db.ts` dient als sichere Wiederverwendungspruefung.
  - **Parallel Owner-Ideen verdichtet**: MarketingPilot sowie Planung/Steuer wurden als Inhaber-Workstreams separat dokumentiert in `/Users/kevinpetersen/owner-dashboard-project/agents/agent-marketing-owner.md` und `/Users/kevinpetersen/owner-dashboard-project/agents/agent-planung-steuer-owner.md`.
  - Betroffene Dateien: `lib/billing.ts`, `lib/db.ts`, `PROJECT_STATUS.md`.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-14 – Welle 2C / Qonto Adapter Start)**:
  - **Qonto-Adapter angelegt**: neue Datei `lib/qonto.ts` kapselt Payment-Link-Erzeugung ueber Qonto Business API mit Env-basierten Zugangsdaten.
  - **Keine feste IBAN mehr in Billing-UI**: `PaymentInstructions` liest Bank-/IBAN-Daten jetzt aus den Firmendaten statt aus statischer Pricing-Konfiguration.
  - **Env-Vorlage ergänzt**: `.env.example` enthaelt jetzt Qonto-Variablen ohne echte Zugangsdaten.
  - **Wichtige Folgepunkte festgehalten**: fortlaufender Rechnungsnummernkreis und schoener Petersen-KI-Rechnungsstil bleiben naechste direkte Ausbauschritte.
  - Betroffene Dateien: `lib/qonto.ts`, `components/billing/PaymentInstructions.tsx`, `.env.example`, `PROJECT_STATUS.md`.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Zuletzt erledigt (2026-05-14 – Welle 3 Start / Nummernkreis + Owner KPIs)**:
  - **Fortlaufender Rechnungsnummernkreis vorbereitet**: neue DB-Funktion `pk_next_invoice_number()` plus `billing_sequences`.
  - **Invoice-Drafts nutzen jetzt fortlaufende Nummern** statt ad-hoc Zeitstempelnummern.
  - **Rechnungs-PDF verbessert**: sichtbare Rechnungsnummer, klarerer Petersen-KI-Abo-Text, staerkerer Markenhinweis im Zahlbereich.
  - **Inhaber-Dashboard gestartet**: erste Owner-KPI-Kacheln fuer aktive Kunden, MRR, Freischaltungen, offene Rechnungen, Fehler-Zahlungen und ungelesene Hinweise.
  - Betroffene Dateien: `supabase/migrations/20260514020000_add_invoice_sequence_function.sql`, `supabase/schema.sql`, `lib/db.ts`, `lib/billing.ts`, `lib/pdf.ts`, `app/dashboard/page.tsx`.
  - Tests: `npm run lint` gruen mit bekannten Warnungen (`<img>`, `useEffect`-Dependency); `npm run build` gruen.
- **Parallele Agenten-Notizen (2026-05-14)**:
  - Qonto-Owner-Flow kompakt dokumentiert: `/Users/kevinpetersen/owner-dashboard-project/agents/agent-qonto-owner-flow.md`
  - Rechnungsdesign-Regeln kompakt dokumentiert: `/Users/kevinpetersen/owner-dashboard-project/agents/agent-invoice-design.md`
- **Zuletzt erledigt (2026-05-14 – Billing Schritt 3 / Inhaber-Setup)**:
  - **Inhaber-Account angelegt**: interner Firmen-Account `info@petersen-ki-pilot.de` in Supabase Auth erstellt; Zugangsdaten wurden bewusst nicht im Projekt abgelegt.
  - **Versteckte Rolle `Inhaber`**: neue Betreiberrolle ergänzt; nur Inhaber-Account sieht sie in der UI und bekommt die exklusive Kundensteuerung.
  - **Kundensteuerung nur fuer Inhaber**: neue Admin-Fläche in Einstellungen erlaubt zentrale Sicht auf Buchungen sowie `Status` und `Software aktiv/aus` pro Kunde.
  - **Buchung → BüroPilot**: Billing-Trigger spiegelt neue/aktualisierte `billing_subscriptions` automatisch als zentrale `buero_kunden` in den Firmen-Account.
  - **Remote-Supabase aktualisiert**: Migration `20260514002000_add_owner_billing_controls.sql` live auf Projekt `cchmjrnzaqvowqihcdte` angewendet; Local/Remote sind synchron.
  - Betroffene Dateien: `app/dashboard/einstellungen/page.tsx`, `components/billing/OwnerCustomerControlPanel.tsx`, `lib/billing.ts`, `lib/db.ts`, `lib/roles.ts`, `lib/server-auth.ts`, `supabase/schema.sql`, `supabase/migrations/20260514002000_add_owner_billing_controls.sql`.
  - Tests: lint + build grün; nur bekannte `<img>`/`useEffect`-Warnungen.
- **Zuletzt erledigt (2026-05-13 – Billing Schritt 2)**:
  - **Live-Persistenz statt localStorage**: Billing läuft für echte Nutzer jetzt über Supabase-Tabelle `billing_subscriptions`; `localStorage` bleibt nur noch für Demo und als einmaliger Legacy-Fallback.
  - **DB-Layer ergänzt**: `lib/db.ts` hat jetzt `getBillingSubscription`, `upsertBillingSubscription`, `updateBillingSubscriptionStatus`.
  - **Legacy-Migration im Client**: Falls ein Nutzer noch alte lokale Billing-Daten hat und noch kein Live-Datensatz existiert, werden diese beim Laden einmalig in Supabase übernommen.
  - **Billing-Härtung**: Billing-UI zeigt Lade-/Statusfehler jetzt sauber per Toast statt still zu scheitern.
  - **Remote-Supabase aktualisiert**: Migration `20260513234500_add_billing_subscriptions.sql` wurde auf das verknüpfte Live-Projekt `cchmjrnzaqvowqihcdte` angewendet; Local/Remote für Billing wieder synchron.
  - Betroffene Dateien: `lib/billing.ts`, `lib/db.ts`, `components/billing/PricingSettingsPage.tsx`, `supabase/schema.sql`, `supabase/migrations/20260513234500_add_billing_subscriptions.sql`.
  - Tests: lint + build grün; nur bekannte `<img>`/`useEffect`-Warnungen.
- **Zuletzt erledigt (2026-05-13 – Billing Schritt 1)**:
  - **Buchung & Abonnement / Warenkorb**: Standard-Vorauswahl `Business` entfernt; Warenkorb startet leer statt automatisch befüllt.
  - **Warenkorb editierbar**: Paket oder einzelne Piloten können direkt im Warenkorb entfernt werden; zusätzlich gibt es `Alles entfernen`.
  - **UX-Hinweis**: Ausgewählte Pakete zeigen jetzt klar `Paket entfernen` statt nur `Ausgewählt`.
  - Betroffene Dateien: `components/billing/PricingSettingsPage.tsx`, `components/billing/BookingSummary.tsx`, `components/billing/PackageCard.tsx`.
  - Tests: lint + build grün; nur bekannte `<img>`/`useEffect`-Warnungen.
- **Zuletzt erledigt (2026-05-13 – Runde 3)**:
  - **Storage-Cleanup**: `deleteSteuerBeleg` entfernt jetzt `datei_url`-Datei vor DB-Delete (analog zu `deleteBueroDokument`).
  - **Zentrale ID-Generierung**: `lib/ids.ts` mit `genId(prefix)` (Format `PREFIX-TIMESTAMP36-RANDOM4`); 6 lokale Kopien + 8 length-basierte Muster ersetzt; Präfix-Konvention dokumentiert.
  - **Fehlende Delete-Funktionen**: `deleteBueroAngebot`, `deleteBueroAuftrag`, `deleteBueroRechnung` in `lib/db.ts` ergänzt.
  - Betroffene Dateien: `lib/db.ts`, `lib/ids.ts` (neu), `app/dashboard/buero/page.tsx`, `app/dashboard/werkstatt/page.tsx`, `app/dashboard/steuer/page.tsx`, `app/dashboard/planung/page.tsx`, `app/dashboard/ki-erkennung/page.tsx`, `app/dashboard/einstellungen/page.tsx`.
  - Tests: lint + build grün.
- **Zuletzt erledigt (2026-05-13 – Runde 2)**:
  - **Rollen/Rechte serverseitig**: `lib/server-auth.ts` um `getServerComponentSession()` erweitert; Werkstatt- und Lager-Detailseiten als echte Next.js Server Components umgeschrieben — Supabase läuft mit Server-Auth (Cookie-Forwarding), kein Browser-Client mehr; Redirect zu `/login` wenn nicht authentifiziert.
  - **Fehlerbehandlung/Empty States**: Werkstatt-Sub-Komponenten (Karten, Zeit, Material, Pruef) haben jetzt `retryKey`-Pattern + Retry-Button bei Ladeferhlern + Icons+Text für leere Tabellen. Lager-Hauptseite zeigt persistenten Fehler-Block statt flüchtigem Toast. Büro KundenTab hat separaten `loadError`-State + Retry.
  - **Import-Pfade Werkstatt**: `ImportDataType` um `werkstatt_zeitbuchungen` und `werkstatt_material` erweitert; `TARGET_FIELDS` ergänzt; `bulkImportWerkstattZeitbuchungen()` / `bulkImportWerkstattMaterial()` in `lib/db.ts` hinzugefügt; Import-Wizard in Einstellungen zeigt + importiert beide Typen.
  - Betroffene Dateien: `lib/server-auth.ts`, `app/dashboard/werkstatt/[id]/page.tsx`, `app/dashboard/lager/[id]/page.tsx`, `app/dashboard/werkstatt/page.tsx`, `app/dashboard/lager/page.tsx`, `app/dashboard/buero/page.tsx`, `lib/importer.ts`, `lib/db.ts`, `app/dashboard/einstellungen/page.tsx`.
  - Tests: lint + build grün; nur bekannte `<img>`/`useEffect`-Warnungen.
- **Davor (2026-05-13)**:
  - Rollenbasierte RLS-Policies live deployed.
  - Archiv: KI-Erkennungsverläufe als Badge/Filter; Werkstatt/Lager als „kein Dokumentarchiv".
  - Cloud: „Datenstand-Übersicht" mit ehrlichen Hinweisen.
  - Marketing KI-Suite: SEO live aus `marketing_seo_keywords`, Lead Intelligence live aus `marketing_leads`.
- **Stabile Basis (2026-05-12/13)**:
  - Einkaufsschema vereinheitlicht; alle 12 Migrationen Local = Remote.
  - `handleKonvertieren`-Bug (fehlende `kunde_id`) behoben.
  - Büro-Detailseiten unter `app/dashboard/buero/[entity]/[id]/page.tsx` für alle Kernentitäten vorhanden.
  - API-Routen (`/api/chat`, `/api/document-ai`) serverseitig mit Auth/Rolle gehärtet.
  - Live-Testdatensatz vorhanden: 3 Lieferanten, 3 Kunden, 1 Angebot, 1 Auftrag, 1 Rechnung, 1 Bestellung, 2 Eingangsrechnungen.
- **Stabil bzw. weit**:
  - Auth-Grundfluss, Dashboard-Shell, Sidebar, Rollen-Badge.
  - LagerPilot als funktionsstärkstes Modul.
  - BüroPilot Kernlisten inkl. Dokument-Upload/Preview.
  - WerkstattPilot mit mehreren echten CRUD-Bereichen.
  - Einstellungen/Firma/Import-Grundlagen.
- Teilweise implementiert:
  - KI-Erkennung: Upload, Klassifikation, Übernahmeflüsse vorhanden; Qualität abhängig von API-Key/Mapping.
  - SteuerPilot: funktional, aber noch nicht sauber mit Eingangsrechnungen verzahnt.
  - Planung: Live-CRUD vorhanden, aber fachlich noch leichtgewichtig.
  - Marketing: Kampagnen, Leads, Newsletter, `SEO`, `Content`, `Posting`, `Automationen` und `Integrationen` haben jetzt Live-Persistenz; echte externe Kanal-/SEO-/CRM-Integrationen fehlen aber weiter.
- Fehlt oder ist schwach:
  - Durchgängige relationale Verknüpfungen zwischen Modulen.
  - Zentrale Detailseiten/Objektansichten.
  - Rechte-/Benutzerverwaltung auf produktivem Niveau.
  - Echtes globales Archiv/Cloud-Modul.
  - Saubere Produktionsreife bei Fehlerbehandlung, Datenkonsistenz, Schema-Governance.

## 3. Wichtige technische Verknüpfungen
- Dokumentenspeicherung:
  - Supabase Storage Bucket `dokumente`.
  - Pfade meist `userId/timestamp_filename`; Steuer-Belege abweichend `steuer/userId/...`.
  - Helfer: `lib/documents.ts`, `normalizeDocumentStoragePath()`, `getDokumentUrl()`.
- Datenbanktabellen / Models / Collections:
  - Zentrale CRUDs in [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts).
  - Schema in [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql) plus Migrations.
- Beziehungen:
  - Echte FKs v. a. bei `lager_stellplatz_bestand`, `lager_umlagerungen`, `einkauf_wareneingaenge.bestellung_id`.
  - Viele Business-Bezüge sind nur `text` statt FK: Kunde, Lieferant, Auftrag, Dokumentbezug.
  - Beispiel Soll-Beziehung heute nur textbasiert: Rechnung ↔ Kunde, Angebot ↔ Kunde, Auftrag ↔ Kunde, Eingangsrechnung ↔ Dokument.
- Routen / Navigation:
  - Hauptnavi über [`components/Sidebar.tsx`](/Users/kevinpetersen/Documents/petersen-ki/components/Sidebar.tsx) und [`app/dashboard/layout.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/layout.tsx).
  - Viele Detailflüsse bleiben innerhalb großer Einzelseiten via Tabs/Modals statt eigener Detailrouten.
- Services / APIs:
- `app/api/chat/route.ts`: Lager-KI via OpenAI Responses API.
  - `app/api/document-ai/route.ts`: Dokumentklassifikation via OpenAI Responses API.
  - Supabase Browser Client in `lib/supabase.ts`; Server-seitige Nutzung ist nicht überall sauber gelöst.

## 4. Relevante Dateien und Ordner
| Datei/Ordner | Zweck | Abhängigkeiten | Wann ändern? |
| --- | --- | --- | --- |
| [`app/dashboard/lager/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/lager/page.tsx) | größtes Kernmodul Lager | `lib/db.ts`, `/api/chat` | bei Lagerlogik, Stellplatzfluss, Picklisten |
| [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx) | Büro, Dokumente, Einkauf | `lib/db.ts`, `lib/pdf.ts`, `DocumentPreviewModal` | bei Büro-/Dokumenten-/Einkaufslogik |
| [`app/dashboard/werkstatt/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/werkstatt/page.tsx) | Werkstattmodul | `lib/db.ts` | bei Werkstattprozessen |
| [`app/dashboard/ki-erkennung/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/ki-erkennung/page.tsx) | Dokument-KI + Übernahme | `app/api/document-ai`, `lib/db.ts` | bei OCR/KI/Übernahmeflüssen |
| [`app/dashboard/einstellungen/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/einstellungen/page.tsx) | Profil, Firma, Rollen, Import, Billing | `lib/importer.ts`, `lib/db.ts` | bei Setup, Import, Admin |
| [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx) | Kampagnen, Leads, Newsletter, KI-Suite | `lib/db.ts` | bei Marketing-Workflows, SEO-/Autopilot-Modulen |
| [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts) | zentraler Datenlayer | Supabase | bei Tabellen, CRUD, Storage-Pfaden |
| [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql) | Soll-Schema | Migrations, UI-Felder | bei strukturellen DB-Änderungen |
| [`supabase/migrations/`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations) | Live-Nachzüge | Supabase Live-System | bei Deployment-relevanten Änderungen |
| [`components/DocumentPreviewModal.tsx`](/Users/kevinpetersen/Documents/petersen-ki/components/DocumentPreviewModal.tsx) | Dokumentvorschau | `lib/documents.ts` | bei Preview-/Öffnungsproblemen |
| [`app/api/chat/route.ts`](/Users/kevinpetersen/Documents/petersen-ki/app/api/chat/route.ts) | Lager-KI | OpenAI, `lib/db.ts` | bei KI-Kontext / Live-Datenzugriff |
| [`app/api/document-ai/route.ts`](/Users/kevinpetersen/Documents/petersen-ki/app/api/document-ai/route.ts) | Dokumentanalyse | OpenAI | bei Klassifikation / Extraktion |

## 5. Bekannte Probleme
- Dokumente öffnen:
  - Büro/KI-Dokumentvorschau wurde am `2026-05-12` verbessert.
- Nicht klickbare Elemente:
  - Viele Kennzahlen führen nur zu Tabs, nicht zu echten Detailseiten/Objektansichten.
- Fehlende Detailansichten:
  - Für mehrere Kernobjekte gibt es jetzt erste dedizierte Büro-Detailseiten; außerhalb des Büros lebt Detailkontext oft noch in Modals/Tabs großer Sammelseiten.
- Inkonsistenzen LagerPilot vs. BüroPilot:
  - Lager ist deutlich tiefer/funktionaler als Büro-Einkauf; das Cloud-Modul zeigt jetzt echte Kennzahlen, ist aber noch kein vollständiges Sync-/Backup-Backend.
  - Einkaufs-/Steuer-/Dokumentenbezüge sind fachlich nicht durchgängig verknüpft.
- Live-Datenrisiko:
  - `app/api/chat/route.ts` nutzt jetzt Server-Supabase mit Cookie-Forwarding; weitere Serverpfade außerhalb der zwei API-Routen sind aber noch nicht zentral über ein produktionsreifes Rechtekonzept abgesichert.
- Schema-Risiko:
  - ~~`schema.sql`, Migrationen und UI-Feldnamen divergieren, besonders im Einkauf.~~ **Behoben 2026-05-13**: Einkaufsschema-Migration live, dual-write in `lib/db.ts` bestätigt.

## 6. Offene Aufgaben
- [ ] Rechnungsmodell fuer Buchungen/Abos ergänzen (`invoices`, Versandstatus, Rechnungsnummern, PDF-Flow).
- [ ] Billing um Lastschrift-/Mandatsmodell für Qonto/SEPA erweitern.
- [ ] Zentrale Kundensteuerung von Billing auf echte Benutzerverwaltung erweitern (z. B. Login-Zugriff pro Kunde sperren/freischalten statt nur Billing-Status).
- [ ] Einzelne Piloten nicht nur auswählbar, sondern vollständig als eigene Buchungsart inkl. Zahlungs-/Statusfluss abbilden.
- [ ] Firmenkonto/Qonto, Lastschrift-Mandat und monatliche Zahlungslogik konzipieren und integrieren.
- [ ] MarketingPilot Edit + Delete für Kampagnen, Leads, Newsletter ergänzen.
- [x] ~~AnalysePilot auf echte Supabase-Daten umstellen~~ **Erledigt 2026-05-18** (Sprint-Aufgabe 5).
- [x] ~~`deleteBueroAngebot`/`Auftrag`/`Rechnung` verdrahten~~ **Erledigt 2026-05-18** — Delete-Buttons live.

### Grafikdesign – Folge-Aufgaben aus Design-Sprint (2026-05-20)

Bausteine G1–G8 sind ausgeliefert und additiv. Folgende Schritte sollen vom
Grafikdesigner mit Live-Vorschau entschieden werden (siehe `docs/DESIGN_HANDOVER.md`):

- [ ] **H1 Schriftart entscheiden** (Inter / IBM Plex / System-Stack) — App-weit.
- [ ] **H2 Produktfotos** für Hero, OG-Images aktualisieren — Marketing-Site.
- [ ] **H3 App-Icon** (PWA + Apple-Touch) durch finales Logo ersetzen — `public/`.
- [ ] **H4 Favicon-Set** generieren (16/32/180/192/512) — `public/`.
- [ ] **H5 PDF-Vorlagen-Header** (Logo + Briefpapier) prüfen — `lib/pdf.ts`.
- [ ] **H6 Email-Templates Branding** (Resend) — `lib/`.
- [ ] **H7 Bottom-Nav Icons** in App von Emoji auf `<PilotIcon />` umstellen — `app/dashboard/layout.tsx`.
- [ ] **H8 Sidebar Icons** in App von Emoji auf `<PilotIcon />` umstellen — `components/Sidebar.tsx`.
- [ ] **Marketing-Site Refresh** (separates Repo): Wordmark übernehmen, Farb-Hierarchie synchronisieren, Hero-Redesign, CTA-Konsistenz, Pilot-Cards-Icons.

### LagerPilot – Offene Optimierungen (Analyse 2026-05-18)

- [ ] 🔴 **Umlagerung atomarisieren**: Supabase-RPC `pk_umlager_artikel` (PL/pgSQL) statt 4 sequentieller Awaits — verhindert Datenverlust bei Teil-Fehlern. Dateien: Migration, `lib/db.ts`.
- [ ] 🔴 **Dual-Layer-Bestandssync**: `handleEingang`/`handleAusgang` schreiben nur `lager_artikel.bestand`, `umlagerArtikel` nur `lager_stellplatz_bestand` — beide Schichten laufen auseinander. Fix: Eingang/Ausgang auch in `lager_stellplatz_bestand` spiegeln. Datei: `lager/page.tsx`.
- [x] ~~🔴 **KI-Aktion "Bestellung" verdrahten**~~ **Erledigt 2026-05-18** — `handleBestellungBestaetigen` ruft `upsertEinkaufBestellung()` auf.
- [x] ~~🟡 **EinkaufTab LagerPilot live schalten**~~ **Erledigt 2026-05-18** — bereits korrekt verdrahtet (`!isDemo`-Guard OK).
- [x] ~~🟡 **`lieferant_id` FK auf `lager_artikel`**~~ **Erledigt 2026-05-18** (Sprint-22) — Migration + `lib/db.ts` + `lager/page.tsx` verdrahtet.
- [x] ~~🟡 **Wareneingänge in KI-Kontext aufnehmen**~~ **Erledigt 2026-05-18** — `einkauf_wareneingaenge` in `buildContextBlock` + Live-Query in `app/api/chat/route.ts`.
- [x] ~~🟡 **Bestandstrend-Snapshots**~~ **Erledigt 2026-05-18** (Sprint-25) — Tabelle `analyse_bestand_snapshots` + Snapshot-Button im AnalysePilot.
- [x] ~~🟢 **FIFO-Hinweis beim Ausgang**~~ **Erledigt 2026-05-18** (Sprint-3) — Älteste Charge nach MHD/`eingelagert_am` beim Ausgang vorgeschlagen.
- [ ] 🟢 **WerkstattPilot → Lager-Reservierung**: FK `werkstatt_material.artikel_id` → `lager_artikel`. Dateien: Migration, `lib/db.ts`.

### WerkstattPilot – Offene Optimierungen (Analyse 2026-05-18)

- [ ] 🔴 **FK `buero_auftrag_id` auf `werkstatt_karten`**: `auftragsnr` ist aktuell reiner Text ohne Referenzintegrität. Migration: `ALTER TABLE werkstatt_karten ADD COLUMN buero_auftrag_id uuid REFERENCES buero_auftraege(id)`. Dateien: Migration, `lib/db.ts`, `werkstatt/page.tsx`.
- [x] ~~🔴 **Material-Entnahme → LagerPilot-Sync**~~ **Erledigt 2026-05-18** (Sprint-27) — `insertWerkstattMaterial()` schreibt jetzt parallel in `lager_bewegungen` und reduziert `lager_artikel.bestand`.
- [x] ~~🔴 **Ist vs. Soll Zeitanzeige auf Arbeitskarte**~~ **Erledigt 2026-05-18** (Sprint-21) — Zeitbuchungen pro `auftragsnr` aggregiert, `Ist: Xh / Soll: Yh` auf jeder Karte angezeigt.
- [x] ~~🟡 **Fertigungsleitstand-Widget**~~ **Erledigt 2026-05-18** (Sprint-28) — Echtzeit-Übersicht mit Status-Ampel + SLA-Warnung bei überfälligen Karten.
- [x] ~~🟡 **Qualitäts-KPI**~~ **Erledigt 2026-05-18** (Sprint-12) — Fehlerquote + Trend-Chart im Qualität-Tab implementiert.
- [ ] 🟡 **Prüfpunkt-Vorlagen pro Maschinentyp**: Neue Tabelle `werkstatt_pruef_vorlagen (id, maschinen_typ, pruefpunkte jsonb)` — beim Karte-Anlegen auto-befüllen statt freier Texteingabe. Dateien: Migration, `lib/db.ts`, `werkstatt/page.tsx`.
- [ ] 🟡 **Export**: Zeitkonto pro Mitarbeiter (CSV) + Fertigungsbericht (PDF via `lib/pdf.ts`). Dateien: `lib/pdf.ts`, `werkstatt/page.tsx`.
- [ ] 🟢 **KI-Tagesbericht WerkstattPilot**: Analog LagerPilot — überfällige Karten (SLA), überfällige Wartungen, offene Kritisch-Störungen als strukturierten Bericht über `/api/chat`. Dateien: `werkstatt/page.tsx`, `app/api/chat/route.ts`.
- [x] ~~🟢 **Karten-Auto-Erstellung aus BüroPilot-Auftrag**~~ **Erledigt 2026-05-18** (Sprint-13) — Button „🛠️ Arbeitskarte erstellen" auf akzeptiertem Auftrag in `buero/page.tsx` mit vorausgefülltem Formular.

- [x] ~~Datenmodell für Kunde/Lieferant/Auftrag/Rechnung/Dokument sauber relationalisieren.~~ **Erledigt 2026-05-13**: FK-Spalten existieren und werden korrekt beschrieben; `handleKonvertieren`-Bug behoben.
- [x] ~~Einkaufsmigration auf Live-Datenbank anwenden und Bestellungen/Wareneingänge mit Echtdaten gegen Alt- und Neuschema validieren.~~ **Erledigt 2026-05-13**: Alle 12 Migrationen Local = Remote, dual-write validiert.
- [x] ~~Neue Dokumentrelationen für Eingangsrechnungen, Rechnungen, Angebote und Aufträge live migrieren und mit Echtdaten durchtesten.~~ **Erledigt 2026-05-13**: FK-Spalten live auf Remote-DB vorhanden.
- [x] ~~Archiv um globale Suche über weitere Module außerhalb `buero_dokumente` erweitern.~~ **Erledigt 2026-05-13**: KI-Erkennungsverläufe (document_type, confidence) als Badge und Filter im Archiv sichtbar; Werkstatt/Lager klar als „kein Dokumentarchiv" gekennzeichnet.
- [x] ~~Cloud-Modul um echte Hintergrundjobs, Backup-Historie und Geräteverwaltung ergänzen oder diese Funktionen klar getrennt als nicht-live kennzeichnen.~~ **Erledigt 2026-05-13**: „Backup-Historie" → „Datenstand-Übersicht" mit Hinweis „kein echtes Backup"; Geräte-Sektion klar als kein Multi-Device-Backend gekennzeichnet.
- [x] ~~Weitere Archivquellen nachziehen, v. a. KI-Erkennungs-Verläufe und ggf. Werkstatt-/Lagerdokumente, falls diese eigenständige Dokumenttabellen bekommen.~~ **Erledigt 2026-05-13**: KI-Verlaufe sind Teil des Archivs via buero_dokumente-Felder; keine separaten Werkstatt-/Lager-Dokumenttabellen vorhanden.
- [x] ~~Marketing-KI-Suite schrittweise mit echter Logik hinterlegen, zuerst SEO-/Keyword-Daten und danach Lead-Intelligence / Autopilot-Marketing.~~ **Erledigt 2026-05-13**: KI-Suite DemoLabTab liest jetzt echte `marketing_seo_keywords` (Top-Keywords, Klicks, Ranking) und echte `marketing_leads` (Score-Tabelle, Pipeline-Wert); keine Demo-Daten mehr in diesen Bereichen.
- [x] ~~Detailseiten für Kernobjekte einführen.~~ **Erledigt 2026-05-13**: Werkstatt- und Lager-Detailseiten live; Büro-Detailseiten existieren seit 2026-05-12.
- [x] ~~Rollen/Rechte von lokalem UI-Status auf echte serverseitige Autorisierung heben.~~ **Erledigt 2026-05-13**: Werkstatt- und Lager-Detailseiten als Server Components mit `getServerComponentSession()`; API-Routen waren bereits gehärtet.
- [x] ~~Fehlerbehandlung und Leersituationen je Pilot systematisch härten.~~ **Erledigt 2026-05-13**: Retry-Buttons + verbesserte Empty States in Werkstatt (4 Sub-Komponenten), Lager (persistenter Error-Block) und Büro (KundenTab).
- [x] ~~Importpfade für weitere Datentypen vervollständigen.~~ **Erledigt 2026-05-13**: Werkstatt-Zeitbuchungen und -Material als neue Import-Typen in Wizard/Importer/db.
- [x] ~~Löschlogik für Storage-Dateien ergänzen, nicht nur DB-Zeilen löschen.~~ **Erledigt 2026-05-13**: `deleteSteuerBeleg` liest jetzt `datei_url` und entfernt die Datei aus Storage vor dem DB-Delete (analog zu `deleteBueroDokument`).
- [x] ~~Einheitliche IDs, Nummernkreise und Referenzfelder definieren.~~ **Erledigt 2026-05-13**: `lib/ids.ts` mit `genId(prefix)` eingeführt (Format: `PREFIX-TIMESTAMP36-RANDOM4`); 6 lokale Kopien und 8 length-basierte Muster in buero/werkstatt/steuer/planung/ki-erkennung/einstellungen ersetzt; Präfix-Konvention vollständig dokumentiert.

### BüroPilot – Offene Optimierungen

- [x] ~~🔴 **PositionenEditor in Angeboten absichern**~~ **Erledigt 2026-05-18** (Sprint-26) — `positionen`-Feld auf `Angebot`-Typ; Angebot→Rechnung-Konvertierung überträgt Positionsdaten 1:1.
- [x] ~~🔴 **EinkaufTab live schalten**~~ **Erledigt 2026-05-18** — Demo-Guards entfernt, `getEinkaufBestellungen()` / `getEinkaufLieferanten()` echt verdrahtet.
- [x] ~~🔴 **Duplikat-Erkennung Kunden**~~ **Erledigt 2026-05-18** (Sprint-9) — `UNIQUE` Constraint auf `email` in `buero_kunden` + Pre-Insert-Check mit UI-Warnung.
- [x] ~~🟡 **OPOS-Dashboard**~~ **Erledigt 2026-05-18** (Sprint-20) — Offene-Posten-Liste sortiert nach Fälligkeit als Widget im Rechnungen-Tab.
- [ ] 🟡 **Meilenstein-Schema für Aufträge**: Tabelle `buero_meilensteine` (auftrag_id, titel, faellig, betrag, status) + Rechnungsplan-Workflow (Vorauszahlung / Meilenstein / Schlussrechnung)
- [x] ~~🟡 **Auto-Reminder bei ausstehenden Angeboten**~~ **Erledigt 2026-05-18** (Sprint-17) — Cron/Scheduled Function für 7/14-Tage-Follow-Up bei `status='Versendet'`.
- [ ] 🟡 **Kundenprofil-Analyse**: `umsatz` als berechnetes DB-View (`SUM(betrag) WHERE status='Bezahlt'`), Ø Zahlungsdauer als View; in Kunden-Detailseite anzeigen
- [x] ~~🟡 **Eingangsrechnung → SteuerPilot Sync**~~ **Erledigt 2026-05-18** (Sprint-19) — Bei `markEingangsrechnungBezahlt()` automatisch Eintrag in `steuer_betriebsausgaben`.
- [x] ~~🟡 **DSGVO-Anonymisierung**~~ **Erledigt 2026-05-18** (Sprint-5) — `anonymisiereBueroKunde(id)` implementiert.
- [x] ~~🟢 **KI-Angebotstext**~~ **Erledigt 2026-05-18** (Sprint-23) — Button „Beschreibung generieren" im Angebot-Formular via `app/api/ki-angebot/route.ts`.
- [ ] 🟢 **QR-Code im PDF**: SEPA/Stripe-QR in `lib/pdf.ts` via `qrcode`-Bibliothek in `generateAngebotPDF()` / `generateRechnungPDF()`
- [ ] 🟢 **DATEV-CSV-Export**: Buchungsjournal-Export aus `buero_rechnungen` + `buero_eingangsrechnungen` als Steuer-Export

### SteuerPilot – Offene Optimierungen

- [x] ~~🔴 **Migration einspielen**~~ **Erledigt 2026-05-18** — `steuer_belege_uploads`-Tabelle + Bucket `steuer-belege` + Policies live.
- [x] ~~🟡 **OCR-Erkennung für Belege**~~ **Erledigt 2026-05-18** (Sprint-29) — Claude Vision liest Betrag, Datum, Lieferant aus Uploads → `app/api/steuer-ocr/route.ts`.
- [ ] 🟡 **Steuerberater-Export-ZIP**: Alle Belege + Uploads eines Monats inkl. strukturiertem PDF-Index als ZIP bündeln und herunterladen
- [ ] 🟡 **Wiederkehrende Belege**: Vorlagen-Funktion für Dauerbelege (Miete, Leasing, Software-Abo) — legt monatlich automatisch einen Entwurf in `steuer_belege` an
- [x] ~~🟡 **Fälligkeits-Kalender-Widget**~~ **Erledigt 2026-05-18** (Sprint-10) — UStVA-Abgabefristen + Vorauszahlungstermine als Banner/Badge im SteuerPilot-Dashboard.
- [x] ~~🟡 **Fixkosten → VSt in UStVA**~~ **Erledigt 2026-05-18** (Sprint-2) — Vorsteuer aus `steuer_fixkosten` in `vorsteuerGesamt` einbezogen.
- [x] ~~🟡 **Einnahmen-Verknüpfung verfeinern**~~ **Erledigt 2026-05-18** (Sprint-16) — Stripe-Zahlungen aus `billing_events` zusätzlich zu `buero_rechnungen` einbezogen.
- [x] ~~🟢 **SKR 04 Buchungsvorschlag**~~ **Erledigt 2026-05-18** (Sprint-24) — KI-gestützte Konten-Zuordnung als Tooltip/Badge bei Beleg-Eingabe.
- [ ] 🟢 **Jahres-G&V-Zusammenfassung**: Einfache Gewinn-und-Verlust-Rechnung im Auswertungen-Tab (Einnahmen – Fixkosten – Betriebsausgaben – Anschaffungs-AfA = Ergebnis)

### MarketingPilot – Offene Optimierungen

- [ ] 🔴 **Stripe Analytics Integration** (4 h, einfach): MRR-Verlauf als Line-Chart im Marketing-Auswertungs-Tab; API-Key bereits vorhanden, Pattern aus `/api/billing` wiederverwendbar
- [ ] 🔴 **Mailchimp API** (5 h, einfach): Echtzeit-Öffnungsraten + Klickraten ersetzen simulierte Werte; Lead → Mailchimp-Subscriber-Automatisierung bei Lead-Anlage
- [ ] 🟡 **Lead-Scoring-Alerts** (3 h): Wenn Lead-Score ≥ 75, automatisch E-Mail via Resend (bereits integriert) an Betreuer — kein heißer Lead wird mehr übersehen
- [ ] 🟡 **Pipeline-Conversion-Funnel** (2 h): Durchlaufzeiten je Lead-Stufe + Quellen-Vergleich (Website / Messe / Empfehlung) aus bestehenden `erstellt`-Timestamps ableiten
- [ ] 🟡 **Kampagnen-ROI-Karte** (2 h): `Kosten pro Konversion` (budget / konversionen) + `Umsatz-ROI` pro Kampagnen-Karte berechnen und anzeigen
- [ ] 🟡 **Newsletter-Segment-Builder** (4 h): Zielgruppe beim Erstellen wählbar (Nur Qualifizierte Leads / Bestandskunden / Neue Leads <30 Tage) → höhere Öffnungsraten
- [ ] 🟡 **CRM-Trigger: Auto-Aufgabe bei Statuswechsel** (3 h): Wenn Lead auf „Angebot" gesetzt wird, automatisch Planungs-Aufgabe „Follow-up in 3 Tagen" anlegen
- [ ] 🟡 **Reaktivierungs-Queue** (3 h): Tab in KI-Suite für verlorene Leads >90 Tage + hohem ursprünglichem Wert + KI-generiertem Reaktivierungstext
- [ ] 🟡 **UTM-Parameter-Tracking** (4 h): `utm_source` beim Lead-Anlegen speichern (URL-Parameter) → echte Multi-Touch-Attribution
- [ ] 🟢 **Lead-Import via CSV** (4 h): Spalten-Mapping-Wizard für Messe-Kontakte (Name, E-Mail, Firma, Quelle) — Bulk-Upload statt Einzeleingabe
- [ ] 🟢 **Kampagnen-Kalender-Ansicht** (3 h): Kampagnen und Postings in Monatsansicht (analog PlanungPilot) — verhindert Lücken im Kanal-Mix

### PlanungPilot – Offene Optimierungen (Analyse 2026-05-18)

- [x] ~~🔴 **`deletePlanungRessource` implementieren**~~ **Erledigt 2026-05-18** — Funktion in `lib/db.ts`, Import + `handleDelete` in `planung/page.tsx` verdrahtet.
- [x] ~~🔴 **Live-Daten-Verifizierung**~~ **Erledigt 2026-05-18** — Guard korrekt: `hasDemoCookie()`-Pattern funktioniert, Live-Calls werden ausgeführt.
- [x] ~~🔴 **FK `auftrag_id` auf `planung_projekte`**~~ **Erledigt 2026-05-18** (Sprint-30) — Migration + „Projekt aus Auftrag erstellen"-Button in BüroPilot-Auftragsdetail.
- [x] ~~🟡 **Meilensteine als eigene Tabelle**~~ **Erledigt 2026-05-18** (Sprint-30) — `planung_meilensteine` (projekt_id FK, titel, faellig, status) statt JSONB-Array.
- [x] ~~🟡 **Ressourcen-Konflikt-Erkennung**~~ **Erledigt 2026-05-18** (Sprint-11) — Badge „Überlastet" + Warnung wenn `genutzt >= kapazitaet`.
- [x] ~~🟡 **Zeiterfassung**~~ **Erledigt 2026-05-18** (Sprint-18) — Spalten `geschaetzte_stunden` + `geleistete_stunden` auf `planung_aufgaben` + UI-Felder.
- [ ] 🟡 **Fälligkeits-Erinnerungen**: Supabase Edge Function (Daily Cron) prüft `planung_aufgaben.faellig < now() + interval '2 days'` → Resend-E-Mail an Verantwortlichen
- [ ] 🟡 **WerkstattPilot-Verlinkung**: Optionales `planung_aufgabe_id` auf `werkstatt_karten` (Migration + bidirektionaler Link in beiden UIs)
- [x] ~~🟡 **Empty States**~~ **Erledigt 2026-05-18** (Sprint-8) — Hilfreiche Leer-Zustände für alle 4 Tabs implementiert.
- [x] ~~🟢 **Fortschritts-Auto-Update**~~ **Erledigt 2026-05-18** (Sprint-4) — Wenn alle Aufgaben `Erledigt` → `fortschritt = 100` automatisch gesetzt.
- [ ] 🟢 **Timeline/Gantt-View**: Visuelle Projektübersicht mit Abhängigkeiten (z. B. `react-gantt-task`)
- [ ] 🟢 **Projekt-Statusbericht PDF**: Export-Button im Projekts-Tab → `lib/pdf.ts` mit Meilensteinen, Aufgaben-Status und Ressourcen-Auslastung

### AnalysePilot – Offene Optimierungen (Analyse 2026-05-18)

- [x] ~~🔴 **Zeitraum-Filter verdrahten**~~ **Erledigt 2026-05-18** (Sprint-15) — `useEffect([zeitraum])` + DB-Query mit `.gte('datum', startDate)` statt client-seitigem Filter.
- [x] ~~🔴 **Offene-Angebote-Status abgleichen**~~ **Erledigt 2026-05-18** — Filter in `analyse/page.tsx:236` auf `'Erstellt'/'Versendet'/'Akzeptiert'` korrigiert.
- [x] ~~🟡 **Gewinn-Berechnung korrigieren**~~ **Erledigt 2026-05-18** (Sprint-14) — `steuer_fixkosten` + `steuer_betriebsausgaben` fließen jetzt in Gewinn-KPI ein.
- [x] ~~🟡 **Bestandstrend-Snapshot-Mechanismus**~~ **Erledigt 2026-05-18** (Sprint-25) — Tabelle `analyse_bestand_snapshots` + „📸 Snapshot"-Button im Bestand-Tab.
- [x] ~~🟡 **Pilot-Nutzungs-PieChart entfernen**~~ **Erledigt 2026-05-18** — hardcoded Werte + beide Chart-Blöcke entfernt; Placeholder-Text eingefügt.
- [ ] 🟡 **WerkstattPilot-KPIs ergänzen**: `werkstatt_karten` (offene/überfällige Aufträge) und `werkstatt_zeitbuchungen` (Produktivität) werden gar nicht ausgewertet — für einen "AnalysePilot" fehlt die wichtigste operative Quelle. Datei: `analyse/page.tsx`.
- [x] ~~🟡 **DB-Abfragen serverseitig begrenzen**~~ **Erledigt 2026-05-18** (Sprint-6) — `.gte('datum', startDate).lte('datum', endDate)` direkt im Query in `analyse/page.tsx:173`.
- [x] ~~🟢 **CSV-Export für Umsatz-Tabelle**~~ **Erledigt 2026-05-18** (Sprint-7) — Download-Button im Umsatz-Tab für `monat, umsatz, kosten, gewinn` als CSV.
- [x] ~~🟢 **Bestandswert-KPI**~~ **Erledigt 2026-05-18** (Sprint-1) — Artikelanzahl × Einkaufspreis als Lagerwert-KPI in Übersicht.

## 7. Regeln für Coding-Agenten
- Vor Änderungen zuerst diese Datei, dann betroffene Seite, dann `lib/db.ts`, dann Schema/Migration prüfen.
- Keine DB-Spalten umbenennen, ohne UI, `lib/db.ts`, `schema.sql` und Migrationen gemeinsam abzugleichen.
- Bei neuen Features zuerst prüfen, ob bereits Demo-State, Live-State und Importpfad existieren.
- Bei Dokumentfunktionen immer drei Ebenen prüfen: DB-Metadaten, Storage-Pfad, Preview/Download.
- Große Seiten (`lager`, `buero`, `werkstatt`) vorsichtig ändern; sie bündeln viel Logik und State.
- Jede relevante Erkenntnis kurz im Änderungsverlauf ergänzen.

> Ab hier folgen Detail-, Verlauf- und Langzeitabschnitte.
> Diese Bereiche nicht automatisch komplett auswerten, wenn nur ein schneller Projektstatus benötigt wird.

## 8. Änderungsverlauf
| Datum | Agent | Änderungen | Betroffene Dateien | Nächste Schritte |
| --- | --- | --- | --- | --- |
| 2026-05-14 | Claude | Billing UX: Stripe-Callback-Banner (success/cancelled), Freischaltungs-Review-Flow im Owner-Panel (proof_sent Quick-Action + pending_payment Hinweis + Stornieren), Inhaber-Dashboard Action-Banner für Freischaltungen und fehlgeschlagene Zahlungen | `components/billing/OwnerCustomerControlPanel.tsx`, `app/dashboard/einstellungen/page.tsx`, `app/dashboard/page.tsx` | Webhook-URL in Stripe umstellen; Branch in main mergen |
| 2026-05-14 | Codex | Inhaber-Setup: internen Firmen-Account `info@petersen-ki-pilot.de` angelegt; versteckte Rolle `Inhaber`; neue exklusive Kundensteuerung; Billing-Trigger spiegelt Buchungen als `buero_kunden`; Migration `20260514002000_add_owner_billing_controls.sql` live ausgerollt | `app/dashboard/einstellungen/page.tsx`, `components/billing/OwnerCustomerControlPanel.tsx`, `lib/billing.ts`, `lib/db.ts`, `lib/roles.ts`, `lib/server-auth.ts`, `supabase/schema.sql`, `supabase/migrations/20260514002000_add_owner_billing_controls.sql`, `PROJECT_STATUS.md` | Rechnungsmodell und Qonto-/SEPA-Flow als naechsten Billing-Schritt aufbauen |
| 2026-05-13 | Codex | Remote-Supabase-Zugriff wiederhergestellt; CLI lokal via `npx supabase` genutzt; Migration `20260513234500_add_billing_subscriptions.sql` erfolgreich auf Live-Projekt `cchmjrnzaqvowqihcdte` angewendet | `PROJECT_STATUS.md` | Einzel-Piloten als echte Buchungsart ausbauen; danach Billing/Invoice/Qonto/SEPA-Flow fachlich sauber aufsetzen |
| 2026-05-13 | Codex | Billing Schritt 2: Live-Persistenz fuer Buchung & Abonnement via neue Tabelle `billing_subscriptions`; DB-Layer in `lib/db.ts`; Billing-UI von reinem localStorage auf Supabase umgestellt; Legacy-localStorage wird beim Laden einmalig migriert | `lib/billing.ts`, `lib/db.ts`, `components/billing/PricingSettingsPage.tsx`, `supabase/schema.sql`, `supabase/migrations/20260513234500_add_billing_subscriptions.sql`, `PROJECT_STATUS.md` | Remote-Migration anwenden; danach Einzel-Piloten als vollwertige Buchungsart und Qonto/SEPA-Fluss ausbauen |
| 2026-05-13 | Codex | Billing Schritt 1: automatische `Business`-Vorauswahl entfernt; Warenkorb startet leer und ist direkt editierbar (`Entfernen`, `Alles entfernen`); Paket-CTA klarer benannt | `components/billing/PricingSettingsPage.tsx`, `components/billing/BookingSummary.tsx`, `components/billing/PackageCard.tsx`, `PROJECT_STATUS.md` | Billing von localStorage auf Live-Daten heben; danach Einzel-Piloten als vollwertige Buchungsart und Qonto/SEPA vorbereiten |
| 2026-05-13 | Claude | Zentrale ID-Generierung: `lib/ids.ts` mit `genId(prefix)` (PREFIX-TIMESTAMP36-RANDOM4); 6 lokale Kopien + 8 length-basierte Muster ersetzt; Präfix-Konvention dokumentiert | `lib/ids.ts`, `buero/page.tsx`, `werkstatt/page.tsx`, `steuer/page.tsx`, `planung/page.tsx`, `ki-erkennung/page.tsx`, `einstellungen/page.tsx` | — |
| 2026-05-13 | Claude | Storage-Cleanup: `deleteSteuerBeleg` entfernt jetzt `datei_url`-Datei aus Storage vor DB-Delete | `lib/db.ts` | Einheitliche IDs/Nummernkreise definieren |
| 2026-05-13 | Claude | Server-Auth für Detailseiten (getServerComponentSession, Server Components); Retry+Empty States in Werkstatt/Lager/Büro; Werkstatt-Import (Zeitbuchungen+Material) in Importer/db/Einstellungen | `lib/server-auth.ts`, `app/dashboard/werkstatt/[id]/page.tsx`, `app/dashboard/lager/[id]/page.tsx`, `app/dashboard/werkstatt/page.tsx`, `app/dashboard/lager/page.tsx`, `app/dashboard/buero/page.tsx`, `lib/importer.ts`, `lib/db.ts`, `app/dashboard/einstellungen/page.tsx` | Löschlogik Storage; IDs/Nummernkreise definieren |
| 2026-05-13 | Claude | Autopilot-Marketing mit echter Logik (Zielgruppe/Kampagnenvorschlag/Funnel-Lücke/Nächster Schritt aus Leads+Kampagnen+SEO); Werkstatt-Detailseite [id] mit Stammdaten/Zeit/Material/Prüfprotokoll; Lager-Detailseite [id] mit Bestand/Stellplätze/Bewegungen; 🔍-Links in Listen | [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`app/dashboard/werkstatt/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/werkstatt/page.tsx), `app/dashboard/werkstatt/[id]/page.tsx`, [`app/dashboard/lager/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/lager/page.tsx), `app/dashboard/lager/[id]/page.tsx` | Rollen/Rechte serverseitig härten; Fehlerbehandlung/Empty States systematisieren |
| 2026-05-13 | Claude | Archiv um KI-Erkennungsverläufe erweitert (Badge/Filter/Stat); Cloud-Modul ehrlich als Datenstand-Übersicht ohne echtes Backup gekennzeichnet; Marketing KI-Suite DemoLabTab liest echte marketing_seo_keywords und marketing_leads | [`app/dashboard/archiv/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/archiv/page.tsx), [`app/dashboard/cloud/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/cloud/page.tsx), [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Autopilot-Marketing mit echter Logik; Detailseiten Werkstatt/Lager |
| 2026-05-13 | Claude | Einkaufsschema und FK-Beziehungen validiert: alle 12 Migrationen Local=Remote bestätigt; Bug in `handleKonvertieren` behoben (kunde_id wurde beim Angebot→Auftrag-Konvertieren nicht weitergegeben); lint+build grün; auf main gepusht (Commit `5d590cf`) | [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Rollen/Rechte serverseitig härten, AnalysePilot Live-Daten anbinden, Archiv weiter ausbauen |
| 2026-05-13 | Codex | Marketing-Workspaces `Content`, `Posting`, `Automationen` und `Integrationen` auf echte Supabase-Persistenz gehoben; Rollenquelle im Frontend auf Benutzer-Metadaten vereinheitlicht; neue Remote-Migration erfolgreich ausgerollt | [`app/dashboard/layout.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/layout.tsx), [`app/dashboard/einstellungen/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/einstellungen/page.tsx), [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`app/register/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/register/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`lib/roles.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/roles.ts), [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql), [`supabase/migrations/20260513103000_add_marketing_workspace_tables.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260513103000_add_marketing_workspace_tables.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Externe Marketing-Integrationen anbinden, Rollenprüfung pro Aktion weiter serverseitig vertiefen, relationale Modellhärtung zwischen Büro/Einkauf/Archiv fortsetzen |
| 2026-05-13 | Codex | Mobile Topbar im Dashboard fuer kleine Geraete nachgeschaerft: mehr oberer Safe-Area-Abstand und groessere Touch-Flaeche fuer die Benachrichtigungsglocke; nebenbei fehlenden `useLocalStorageState`-Helper im MarketingPilot wiederhergestellt, damit `build` wieder gruen laeuft | [`app/dashboard/layout.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/layout.tsx), [`components/NotificationBell.tsx`](/Users/kevinpetersen/Documents/petersen-ki/components/NotificationBell.tsx), [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Mobile Header kurz auf echtem Geraet gegenpruefen; danach nur bei Bedarf weitere Topbar-Abstaende feintunen |
| 2026-05-13 | Codex | Remote-Supabase-Migration `20260512190000_add_marketing_seo_keywords.sql` erfolgreich angewendet; Live-Datenbank kennt jetzt `marketing_seo_keywords` inkl. RLS/Policy | [`supabase/migrations/20260512190000_add_marketing_seo_keywords.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260512190000_add_marketing_seo_keywords.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Content/Posting/Automationen/Integrationen als naechste Marketing-Bereiche ebenfalls serverseitig anbinden |
| 2026-05-12 | Codex | MarketingPilot-SEO auf echte Supabase-Persistenz gehoben: neue Tabelle `marketing_seo_keywords`, Datenlayer erweitert und SEO-Workspace von rein lokalem State auf Live-Laden/Speichern umgestellt | [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql), [`supabase/migrations/20260512190000_add_marketing_seo_keywords.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260512190000_add_marketing_seo_keywords.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Migration remote anwenden, danach Content/Posting/Automationen/Integrationen schrittweise ebenfalls persistieren |
| 2026-05-12 | Codex | Live-Migrationen vollständig ausgerollt, Kernrelationen (`kunde_id`/`lieferant_id`) ergänzt, Archiv auf Live-Dokumente umgestellt, Detailseiten eingeführt, Chat-/Dokument-API serverseitig mit Session/Rolle gehärtet, Dokumentlöschung um Storage-Cleanup erweitert | [`app/api/chat/route.ts`](/Users/kevinpetersen/Documents/petersen-ki/app/api/chat/route.ts), [`app/api/document-ai/route.ts`](/Users/kevinpetersen/Documents/petersen-ki/app/api/document-ai/route.ts), [`app/dashboard/archiv/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/archiv/page.tsx), [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`app/dashboard/buero/[entity]/[id]/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/[entity]/[id]/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`lib/server-auth.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/server-auth.ts), [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql), [`supabase/migrations/20260512142000_add_buero_core_relations.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260512142000_add_buero_core_relations.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Live-Stammdaten für Kunden/Lieferanten ergänzen, Detailseiten weiter verlinken, Rollenmodell von Metadata-Guard auf echtes Domänenmodell heben |
| 2026-05-12 | Codex | Dokumentauswahl im Büro gegen Doppelverknüpfungen abgesichert und Wareneingänge-Lesefallback für gemischte Live-Schemata ergänzt | [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Dokumentrelationen und Einkaufsmigration mit Echtdaten gegen die Live-Datenbank validieren |
| 2026-05-12 | Codex | Dokumentverknüpfung im Büro-UI auf Rechnungen, Angebote und Aufträge erweitert; Formulare können archivierte Dokumente auswählen und Listen/Karten zeigen den Link sichtbar an | [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Beide Migrationen live anwenden und Relationslogik mit Echtdaten für Einkauf + alle vier Belegtypen prüfen |
| 2026-05-12 | Codex | Erste echte Büro-Dokumentrelation ergänzt: `buero_dokumente` mit FK-Spalten erweitert, Eingangsrechnungen können archivierte Dokumente auswählen und die Dokumentliste zeigt die Verknüpfung | [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql), [`supabase/migrations/20260512114500_add_buero_document_relations.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260512114500_add_buero_document_relations.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Migration live anwenden, Eingangsrechnungs-Linking mit Echtdaten prüfen, danach gleiche Relationstiefe für Rechnungen/Angebote/Aufträge nachziehen |
| 2026-05-12 | Codex | Phase 1 begonnen: Einkaufsschema vereinheitlicht, Datenlayer für Alt-/Neuschema kompatibel gemacht, Migrationspfad für Wareneingänge/Bestellungen ergänzt | [`app/dashboard/buero/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/buero/page.tsx), [`lib/db.ts`](/Users/kevinpetersen/Documents/petersen-ki/lib/db.ts), [`supabase/schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/schema.sql), [`supabase/migrations/20260512103000_align_einkauf_schema.sql`](/Users/kevinpetersen/Documents/petersen-ki/supabase/migrations/20260512103000_align_einkauf_schema.sql), [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Migration live anwenden, Einkaufsdaten durchtesten, dann Phase-1-FKs angehen |
| 2026-05-12 | Codex | Projektanalyse erstellt, Statusdatei angelegt, Architektur/DB/Marktreife bewertet | [`PROJECT_STATUS.md`](/Users/kevinpetersen/Documents/petersen-ki/PROJECT_STATUS.md) | Einkauf-Schema-Divergenz beheben, Kernrelationen definieren |
| 2026-05-12 | Entwickler | Dokumentöffnung und klickbare Detailflüsse verbessert | `app/dashboard/buero/page.tsx`, `app/dashboard/ki-erkennung/page.tsx`, `components/DocumentPreviewModal.tsx`, `lib/db.ts`, `lib/documents.ts` | Archiv/echte Detailseiten nachziehen |
| 2026-05-11 | Entwickler | Werkstatt-Wartungen/Störungen ergänzt | `app/dashboard/werkstatt/page.tsx`, `lib/db.ts`, `supabase/schema.sql`, Migration | relationale Verknüpfung zur Auftrags-/Maschinenstruktur fehlt noch |
| 2026-05-11 | Entwickler | Dokumentworkflow, Lager-Scanning, Pickliste, Live-Schema erweitert | mehrere Dashboard-Seiten, `lib/db.ts`, Migrations | fachliche Konsistenz und Produktionshärtung |

## 9. Datenbank-Analyse
- Bestehende Struktur:
  - `36` Tabellen im Schema.
  - Gute Breite für ERP-nahe Domänen: Firma, Lager, Büro, Einkauf, Werkstatt, Marketing, Planung, Steuer, Import, Dokumente.
  - RLS ist fast überall vorhanden.
- Probleme / Risiken:
  - Viele Kernbeziehungen nur als `text` statt FK: `kunde`, `lieferant`, `auftrag`, `bezug`, `dokument_id`.
  - IDs uneinheitlich: `text`, `uuid`, `bigserial` parallel; fachlich okay, aber ohne klare Standards riskant.
  - Datums-/Betragsfelder oft als `text`; erschwert Filter, Konsistenz, Auswertung, Internationalisierung.
  - Dokument-Metadaten und Business-Objekte sind nur lose gekoppelt.
  - Löschvorgänge entfernen oft nur DB-Zeilen, nicht zugehörige Storage-Dateien.
  - Serverseitige KI-Routen greifen nicht überall mit sauberem Auth-Kontext auf Benutzerdaten zu.
- Fehlende Tabellen oder Beziehungen:
  - Kein echtes `users/roles/permissions`-Domänenmodell.
  - Kein sauberes CRM-Aktivitäten-/Kontaktverlaufsmodell.
  - Keine Artikelstammdaten mit Preis-/Lieferanten-/Einheitenhistorie auf ERP-Niveau.
  - Keine saubere Verknüpfung `buero_rechnungen -> buero_kunden`.
  - Keine saubere Verknüpfung `buero_angebote -> buero_kunden`.
  - Keine saubere Verknüpfung `buero_auftraege -> buero_kunden`.
  - Keine saubere Verknüpfung `buero_eingangsrechnungen -> einkauf_lieferanten`.
  - Keine saubere Verknüpfung `buero_eingangsrechnungen.dokument_id -> buero_dokumente.id`.
  - Keine saubere Verknüpfung `einkauf_bestellungen -> einkauf_lieferanten` im tatsächlich von UI genutzten Feldmodell.
- Verbesserungsvorschläge:
  - Einheitliches Referenzmodell mit FK-Spalten (`kunde_id`, `lieferant_id`, `auftrag_id`, `dokument_id`) einführen.
  - Geld-/Datumsfelder konsequent auf `numeric`/`date`/`timestamptz` umstellen.
  - Geschäftsnummern (`RE-...`, `ANG-...`) als fachliche Nummern behalten, aber interne Primärschlüssel sauber trennen.
  - `schema.sql` und Migrations strikt synchronisieren; aktuell besonders kritisch im Einkauf:
    - Migration nutzt `lieferant_id`, `einzelpreis`, `gesamtpreis`, `bestelldatum`, `lieferdatum_soll`.
    - UI/`lib/db.ts` nutzen `lieferant`, `einkaufspreis`, `gesamt`, `bestellt_am`, `erwartet_am`, `geliefert_am`.
  - Dokumente als zentrale Entität mit optionalen Relationsspalten pro Fachobjekt ausbauen.

## 10. Funktionsabdeckung
- Vorhanden:
  - Dokumentenmanagement grundlegend.
  - Rechnungen/Aufträge/Angebote grundlegend.
  - Kundenverwaltung grundlegend.
  - Lieferanten/Einkauf grundlegend.
  - Artikel/Lager/Bestände stark.
  - Aufgaben/Planung/Werkstatt/Marketing/Steuer als eigenständige Module.
  - Dashboard, Warnungen, KI-Erkennung, PDF-Erzeugung.
- Unvollständig:
  - Dokumentenmanagement ohne global saubere Verknüpfung und Archiv.
  - Buchhaltung/Steuer ohne vollständige Verzahnung zu Eingangsrechnungen.
  - Angebote/Rechnungen/Aufträge ohne echte Detailseiten und Relationstiefe.
  - CRM ohne Historie, Kontakte, Aktivitäten, Wiedervorlagen.
  - Einkauf ohne verlässliches Live-Schema und Bestellmodell.
  - Benutzer/Rollen nur oberflächlich; keine belastbare Rechteprüfung pro Datensatz/Aktion.
- Fehlt komplett oder nahezu:
  - Mandantenfähige Benutzer-/Rechteverwaltung mit Rollenmatrix.
  - Audit-Log / Änderungsverlauf pro Objekt.
  - Zahlungsabgleich, Mahnwesen mit Automatisierung, OPOS.
  - Lieferanten-/Kundenhistorie und Kommunikationsjournal.
  - Produktionsreife Export-/Schnittstellenebene (DATEV/ERP/API) als durchgängiger Prozess.

## 11. UX-/Navigationsprobleme
- Archivseite ist Demo-only; `Öffnen` wirkt klickbar, macht aber nichts.
- Cloud-Modul simuliert Sync/Status rein lokal; UI suggeriert Live-Funktionalität.
- Viele Kernobjekte sind nur Tabellenzeilen ohne dedizierte Detailseite oder URL.
- Navigation ist tab-lastig; Deep-Linking und Rücksprünge sind inkonsistent.
- Große Monolith-Seiten erschweren konsistente UX zwischen Piloten.
- Login-Form nutzt visuelle Labels, aber nicht sauber gebundene Feldlabels; Accessibility/Testbarkeit leidet.
- LagerPilot ist UX-seitig am weitesten; Archiv/Cloud/Analyse wirken im Vergleich eher präsentationsnah.

## 12. Marktreife-Bewertung
- Aktueller Stand: ca. `55%`.
- Nicht produktionsreif.
- Größte Risiken:
  - Datenkonsistenz durch fehlende FKs und textbasierte Beziehungen.
  - Schema-Drift zwischen Code, `schema.sql` und Live-Migrationen.
  - UX-Inkonsistenz zwischen starken Kernmodulen und Demo-/Simulationsmodulen.
  - Fehlerhandling/Leersituationen nicht überall robust.
  - Rechte-/Sicherheitsmodell nur teilweise belastbar.
  - KI-/Serverrouten greifen Live-Daten nicht überall sauber mit Auth-Kontext ab.
- Blocker für Launch:
  - Einkaufsschema vereinheitlichen.
  - Kernbeziehungen modellieren.
  - Archiv/Dokumentverknüpfung finalisieren.
  - Rollen/Rechte serverseitig absichern.
  - Demo-/Mock-Module klar trennen oder produktiv machen.

## 13. Roadmap
### Phase 1 – Kritische Fixes (Blocker)
- Einkaufstabellen, `lib/db.ts` und UI auf ein konsistentes Schema bringen.
  - Begründung: aktueller größter Live-/Datenverlust-Risikofaktor.
- Echte FK-Beziehungen für Kunde/Lieferant/Dokument/Auftrag/Rechnung einführen.
  - Begründung: verhindert Inkonsistenzen und fehlerhafte Zuordnungen.
- `app/api/chat/route.ts` auf sauberen serverseitigen Supabase-Zugriff mit Auth-Kontext umstellen.
  - Begründung: KI darf nicht mit leeren/inkonsistenten Live-Daten arbeiten.
- Archiv- und Dokument-Löschpfade vervollständigen.
  - Begründung: Dokumentmanagement ist Kernfunktion.

### Phase 2 – Kernfunktionen vervollständigen
- Detailseiten für Kunde, Lieferant, Auftrag, Angebot, Rechnung, Beleg einführen.
  - Begründung: bessere Arbeitsflüsse, Verknüpfungen, Nachvollziehbarkeit.
- Eingangsrechnung ↔ Lieferant ↔ Dokument ↔ Steuerbeleg sauber verketten.
  - Begründung: Büro/Einkauf/Steuer müssen durchgängig sein.
- CRM-Historie, Aufgaben-/Wiedervorlagen pro Kunde/Lieferant ergänzen.
  - Begründung: marktreife Betriebssoftware braucht Verlauf und Follow-up.
- Importpfade für fehlende Datentypen fertigstellen.
  - Begründung: Datenmigration ist kaufentscheidend.

### Phase 3 – UX & Effizienz
- Tabs/Modals um Deep-Links und einheitliche Detailnavigation ergänzen.
  - Begründung: bessere Bedienbarkeit im Tagesbetrieb.
- Archiv und Cloud an reale Daten anbinden oder klar als nicht-live kennzeichnen.
  - Begründung: irreführende UI schwächt Vertrauen.
- Global Search auf echte Objekt-Navigation und Treffergruppen ausbauen.
  - Begründung: spart Klicks und erhöht Nutzwert.
- Konsistente Statuslogik, Fehlermeldungen und Empty States über alle Piloten hinweg.
  - Begründung: weniger Supportaufwand.

### Phase 4 – Skalierung & Feinschliff
- Rollen-/Rechtekonzept serverseitig härten.
  - Begründung: nötig für Mehrbenutzerbetrieb.
- Audit-Log, Änderungsverlauf, Soft-Delete/Restore.
  - Begründung: Compliance und Nachvollziehbarkeit.
- Automatisierungen/Benachrichtigungen/Mahnwesen/Schnittstellen ausbauen.
  - Begründung: echte Betriebssoftware lebt von Prozessautomatisierung.
- Performance- und Teststrategie für große Seiten einführen.
  - Begründung: Stabilität bei wachsendem Datenvolumen.

## 14. Wichtigste Erkenntnisse
- Das Projekt ist breit und ambitioniert; Lager, Büro, Werkstatt und Marketing haben jetzt echten Substanzgrad.
- Einkaufsschema ist vereinheitlicht; FK-Spalten für Kernentitäten sind live und werden korrekt beschrieben.
- Archiv, Cloud und Marketing KI-Suite sind jetzt ehrlich live – keine Demo-Fantasiewerte mehr.
- Marketing KI-Suite zeigt echte Leads und SEO-Keywords; nächster Schritt: Autopilot mit echter Logik.
- Viele Business-Bezüge sind noch textbasiert; für Marktreife müssen mehr FK-Beziehungen entstehen.
- Ohne serverseitige Rechteprüfung und Auditierbarkeit ist kein sicherer Mehrbenutzer-Launch ratsam.

## 15. Nächste Empfehlung
- Als NÄCHSTES umsetzen (Pre-Release-Polish, nach Design-Sprint G1–G8):
  1. **Key-Rotation** (Release-Blocker) — Supabase Service Role Key + Vercel Token rotieren; OpenAI Key prüfen ob committed.
  2. **Pondruff Preisrechner DB-Live** (Pondruff-Folgesprint) — `getPriceConfig()` async aus `pondruff_price_config` laden statt aus `lib/pondruff-price-config.json`.
  3. **Grafikdesigner-Übergabe** — `docs/DESIGN_HANDOVER.md` an Designer geben, H1–H8 Folge-Aufgaben einplanen (Schriftart, App-Icon, Favicon, PDF-Header, Email-Templates, Bottom-Nav/Sidebar-Icon-Migration).
  4. **Manuelle E2E-Tests QM-Pilot** in Production (Aufgabe 9 aus QM-KI-Sprint, offen).
- Vorher empfohlen (bestehende Reihenfolge):
  1. **QM-Pilot Phase 1 Aufgabe 6** — Prüfbericht-Wizard (`/dashboard/qm/pruefen` + `/dashboard/qm/pruefen/[id]`) mit 6 Schritten: Zeichnung wählen → Bauteil-Infos → Messwerte (Live-Ampel) → Fotos (Drop-Zones inkl. Mobile-Kamera) → Sichtprüfung → Abschluss/Abzeichnung. Detail-Seite verlinkt bereits darauf.
  2. **QM-Pilot Phase 1 Aufgaben 7–9** — Foto-Upload-Inline im Wizard, Messwert-Ampel-Live-Update beim Tippen, Gesamtstatus-Auto-Logik (bestanden/nachbesserung/ausschuss/offen).
  3. **QM-Pilot Phase 1 Aufgabe 10** — `lib/qm-pdf.ts` (jsPDF + jspdf-autotable) mit Seite 1 (Header + Bauteil-Infos + farbige Messwert-Tabelle) und Seite 2 (Sichtprüfung + Foto-Grid + Bemerkungen). `/api/qm/pdf/[id]`-Route.
  4. **QM-Pilot Phase 1 Aufgaben 11–13** — Archiv-Tab + Dashboard-KPIs auf echte DB-Abfragen umstellen; Prüfbericht-Nr Auto-Generierung im Wizard integrieren.
  5. **Marketing-KI testen + live schalten** (Folge-Sprint nach QM).

### Marketing-KI Aktivierungs-Anleitung (Owner)
1. Login als `info@petersen-ki-pilot.de`
2. Einstellungen → KI-Funktionen → Marketing-KI Module
3. Toggle für gewünschtes Modul einschalten (je ~0,01–0,02 € / Run)
4. Im MarketingPilot → KI-Suite → Modul auswählen → „✨ KI jetzt ausführen"

### Marketing-KI Neue Dateien (2026-05-19)
| Datei | Funktion |
|---|---|
| `app/api/marketing/content-daily/route.ts` | GPT-4o → tägl. Content-Idee |
| `app/api/marketing/autopilot/route.ts` | GPT-4o → Strategie + Funnel-Plan |
| `app/api/marketing/sales-assistant/route.ts` | GPT-4o → Lead-Priorisierung + Follow-up |
| `supabase/migrations/20260519200000_marketing_ki_features.sql` | 3 neue Spalten in firma_einstellungen |
| `lib/db.ts` | `MarketingKiSettings` Typ + `getMarketingKiSettings()` + `updateMarketingKiSettings()` |
| `lib/ai-settings.ts` | `getServerMarketingKiSettings(userId)` (server-only) |
| `components/billing/OwnerAiControlPanel.tsx` | Marketing-KI Toggles ergänzt |
| `app/dashboard/marketing/page.tsx` | KI-Button + Ergebnis-Panel in KI-Suite |
