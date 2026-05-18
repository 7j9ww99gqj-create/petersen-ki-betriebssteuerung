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
- Letzter dokumentierter Live-Stand: `2026-05-18`, `main`, Commit `9180136`.
- Jüngste Fortschritte: Tasks 2-8 parallel abgeschlossen — Multi-Positionen, ELSTER-Export, Marketing CRUD, AnalysePilot Live, Benutzerverwaltung, RLS-Policies, Pipeline-Widget.
- Wichtigste externe Restpunkte: E-Mail-Versand bleibt bewusst manuell über das lokale Mailprogramm.
- Produktivlage: Kernsystem weitgehend vollständig; Hauptmodule produktionsreif.

### 0.2 Top-Offene Aufgaben (Priorisiert)
- ✅ ~~**Stripe Webhook-URL** im Stripe-Dashboard prüfen und echten End-to-End-Test validieren.~~ **Erledigt 2026-05-18**.
- ✅ ~~**BüroPilot: Paketauswahl + 1-Klick-Konvertierung**~~ **Erledigt 2026-05-18**.
- ✅ ~~**Task 2: Multi-Positions-Rechnungen/-Angebote**~~ **Erledigt 2026-05-18** (Commit `043ff2e`).
- ✅ ~~**Task 3: SteuerPilot A13: ELSTER-XML-Export**~~ **Erledigt 2026-05-18** (Commit `043ff2e`).
- ✅ ~~**Task 4: MarketingPilot Edit + Delete**~~ **Erledigt 2026-05-18** (Commit `3166286`).
- ✅ ~~**Task 5: AnalysePilot Live-Daten**~~ **Erledigt 2026-05-18** (Commit `234fcc2`).
- ✅ ~~**Task 6: Benutzerverwaltung Deaktivieren/Löschen/Suche**~~ **Erledigt 2026-05-18** (Commit `80e0f8c`).
- ✅ ~~**Task 7: RLS-Policies vollständig**~~ **Erledigt 2026-05-18** (Commit `7aee934`).
- ✅ ~~**Task 8: Pipeline-Widget 3 KPIs**~~ **Erledigt 2026-05-18** (Commit `dadb045`).
- 🟡 **EinkaufTab**: Demo-State auf echte Supabase-Calls umstellen.
- 🟡 **KI-Aktion "Bestellung"** ausführbar machen (analog zu Umlagerung).
- 🟢 Analyse-Bestandstrend auf echte Wochensnapshots umstellen.

### 0.3 Aktuelle Blocker
- Keine kritischen Blocker. Stripe E2E validiert.
- Einige ältere Verlaufs-/Offen-Punkte weiter unten koennen historisch sein; bei Konflikten gilt der neueste Eintrag in `2. Aktueller Arbeitsstand`.

### 0.4 Quick Status Summary (für Statusabfragen)
**Letzter Stand:** 2026-05-18, Commit `9180136`  
**Letzte Session:** Tasks 2-8 parallel — Multi-Positionen, ELSTER-Export, Marketing CRUD, AnalysePilot Live, Benutzerverwaltung, RLS-Policies, Pipeline-Widget  
**Nächster Focus:** EinkaufTab Live-Daten → KI-Bestellaktion ausführbar  
**Blocker:** Keine  
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
- [ ] AnalysePilot auf echte Supabase-Daten umstellen (Charts laufen bereits, nur Demo-Daten ersetzen).
- [ ] `deleteBueroAngebot`/`Auftrag`/`Rechnung` in `buero/page.tsx` verdrahten (Funktionen existieren seit Runde 3).

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
- Als NÄCHSTES umsetzen:
  1. **SteuerPilot: ELSTER-XML-Export vorbereiten** (Aufgabe 13): Formular-Mapping §§ 81/83 UStVA; schrittweise als Download-Dummy umsetzen.
  2. **SteuerPilot: Jahres-Zusammenfassung** mit vereinfachter G&V (Einnahmen – Gesamtausgaben) auf Basis der vorhandenen Daten.
  3. **Stripe Webhook-URL** im Stripe-Dashboard prüfen; echter End-to-End-Test Buchung → Auftrag → Zahlung → Rechnung.
  4. **Multi-Positions-Rechnungen/-Angebote** im BüroPilot (aktuell nur 1 Position hardcoded).
  5. **Autopilot-Marketing**: Flow „Ziel → Zielgruppe → Kampagne → Funnel" aus echten Leads/Kampagnen/SEO ableiten.
