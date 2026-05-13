# PROJECT_STATUS.md

> WICHTIG FÜR CODEX/CLAUDE:
> Lies zuerst diese Datei.
> Aktualisiere sie nach jeder relevanten Änderung.
> Ergänze neue Erkenntnisse im Abschnitt „Aktueller Arbeitsstand“.
> Halte alles kompakt und aktuell.
> Entferne veraltete Infos.
> Ziel: minimale Tokens, maximaler Kontext.

## 1. Kurzüberblick
- Zweck: modulare Betriebssteuerung/ERP-ähnliche Web-App für Lager, Büro, Werkstatt, Steuer, Planung, Marketing, Dokumente und KI-gestützte Erfassung.
- Stack: `Next.js 14 App Router`, `React 18`, `TypeScript`, `Supabase Auth/Postgres/Storage`, `OpenAI` für Dokument-KI, `Anthropic` für Lager-/Chat-KI.
- Hauptmodule:
  - `LagerPilot`: Bestand, Bewegungen, Ein-/Ausgang, Inventur, Bestellvorschläge, Stellplätze, Umlagerung, Pickliste, Tagesbericht.
  - `BüroPilot`: Kunden, Angebote, Aufträge, Rechnungen, Eingangsrechnungen, Dokumente, Einkauf.
  - `WerkstattPilot`: Arbeitskarten, Zeiten, Material, Prüfungen, Mitarbeiter, Bereiche, Wartungen, Störungen.
  - `SteuerPilot`: Belege, UStVA, Prüfhinweise.
  - `PlanungPilot`: Projekte, Aufgaben, Termine, Ressourcen.
  - `MarketingPilot`: Kampagnen, Leads, Newsletter.
  - Zusatz: Dashboard, KI-Erkennung, Cloud, Archiv, Einstellungen.

## 2. Aktueller Arbeitsstand
- Stand `2026-05-13` — Aktueller Branch: `main` (Commit `daea60f`), live auf Vercel deployed (nach Push).
- **Zuletzt erledigt (2026-05-13)**:
  - Marketing KI-Suite Autopilot: Echter Flow aus Leads/Kampagnen/SEO — Zielgruppe, Kampagnenvorschlag, Funnel-Lücke, Nächster Schritt; kein Fake mehr.
  - Werkstatt Detailseite: `app/dashboard/werkstatt/[id]/page.tsx` mit Stammdaten, Zeitbuchungen, Material, Prüfprotokoll; 🔍-Link in Karten-Liste.
  - Lager Detailseite: `app/dashboard/lager/[id]/page.tsx` mit Bestandsinfo, Stellplatz-Belegung, letzten Bewegungen; 🔍-Link in Bestand-Tabelle.
  - Betroffene Dateien: [`app/dashboard/marketing/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/marketing/page.tsx), [`app/dashboard/werkstatt/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/werkstatt/page.tsx), [`app/dashboard/werkstatt/[id]/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/werkstatt/[id]/page.tsx), [`app/dashboard/lager/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/lager/page.tsx), [`app/dashboard/lager/[id]/page.tsx`](/Users/kevinpetersen/Documents/petersen-ki/app/dashboard/lager/[id]/page.tsx).
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
  - `app/api/chat/route.ts`: Lager-KI via Anthropic.
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
| [`app/api/chat/route.ts`](/Users/kevinpetersen/Documents/petersen-ki/app/api/chat/route.ts) | Lager-KI | Anthropic, `lib/db.ts` | bei KI-Kontext / Live-Datenzugriff |
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
- [x] ~~Datenmodell für Kunde/Lieferant/Auftrag/Rechnung/Dokument sauber relationalisieren.~~ **Erledigt 2026-05-13**: FK-Spalten existieren und werden korrekt beschrieben; `handleKonvertieren`-Bug behoben.
- [x] ~~Einkaufsmigration auf Live-Datenbank anwenden und Bestellungen/Wareneingänge mit Echtdaten gegen Alt- und Neuschema validieren.~~ **Erledigt 2026-05-13**: Alle 12 Migrationen Local = Remote, dual-write validiert.
- [x] ~~Neue Dokumentrelationen für Eingangsrechnungen, Rechnungen, Angebote und Aufträge live migrieren und mit Echtdaten durchtesten.~~ **Erledigt 2026-05-13**: FK-Spalten live auf Remote-DB vorhanden.
- [x] ~~Archiv um globale Suche über weitere Module außerhalb `buero_dokumente` erweitern.~~ **Erledigt 2026-05-13**: KI-Erkennungsverläufe (document_type, confidence) als Badge und Filter im Archiv sichtbar; Werkstatt/Lager klar als „kein Dokumentarchiv" gekennzeichnet.
- [x] ~~Cloud-Modul um echte Hintergrundjobs, Backup-Historie und Geräteverwaltung ergänzen oder diese Funktionen klar getrennt als nicht-live kennzeichnen.~~ **Erledigt 2026-05-13**: „Backup-Historie" → „Datenstand-Übersicht" mit Hinweis „kein echtes Backup"; Geräte-Sektion klar als kein Multi-Device-Backend gekennzeichnet.
- [x] ~~Weitere Archivquellen nachziehen, v. a. KI-Erkennungs-Verläufe und ggf. Werkstatt-/Lagerdokumente, falls diese eigenständige Dokumenttabellen bekommen.~~ **Erledigt 2026-05-13**: KI-Verlaufe sind Teil des Archivs via buero_dokumente-Felder; keine separaten Werkstatt-/Lager-Dokumenttabellen vorhanden.
- [x] ~~Marketing-KI-Suite schrittweise mit echter Logik hinterlegen, zuerst SEO-/Keyword-Daten und danach Lead-Intelligence / Autopilot-Marketing.~~ **Erledigt 2026-05-13**: KI-Suite DemoLabTab liest jetzt echte `marketing_seo_keywords` (Top-Keywords, Klicks, Ranking) und echte `marketing_leads` (Score-Tabelle, Pipeline-Wert); keine Demo-Daten mehr in diesen Bereichen.
- [x] ~~Detailseiten für Kernobjekte einführen.~~ **Erledigt 2026-05-13**: Werkstatt- und Lager-Detailseiten live; Büro-Detailseiten existieren seit 2026-05-12.
- [ ] Rollen/Rechte von lokalem UI-Status auf echte serverseitige Autorisierung heben.
- [ ] Fehlerbehandlung und Leersituationen je Pilot systematisch härten.
- [ ] Importpfade für weitere Datentypen vervollständigen.
- [ ] Löschlogik für Storage-Dateien ergänzen, nicht nur DB-Zeilen löschen.
- [ ] Einheitliche IDs, Nummernkreise und Referenzfelder definieren.

## 7. Regeln für Coding-Agenten
- Vor Änderungen zuerst diese Datei, dann betroffene Seite, dann `lib/db.ts`, dann Schema/Migration prüfen.
- Keine DB-Spalten umbenennen, ohne UI, `lib/db.ts`, `schema.sql` und Migrationen gemeinsam abzugleichen.
- Bei neuen Features zuerst prüfen, ob bereits Demo-State, Live-State und Importpfad existieren.
- Bei Dokumentfunktionen immer drei Ebenen prüfen: DB-Metadaten, Storage-Pfad, Preview/Download.
- Große Seiten (`lager`, `buero`, `werkstatt`) vorsichtig ändern; sie bündeln viel Logik und State.
- Jede relevante Erkenntnis kurz im Änderungsverlauf ergänzen.

## 8. Änderungsverlauf
| Datum | Agent | Änderungen | Betroffene Dateien | Nächste Schritte |
| --- | --- | --- | --- | --- |
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
  1. **Autopilot-Marketing mit echter Logik**: Flow „Ziel → Zielgruppe → Kampagne → Funnel → nächster Schritt" aus echten Leads/Kampagnen/SEO ableiten; schrittweise im KI-Suite-Tab umsetzen.
  2. **Detailseiten für Werkstatt-/Lager-Kernobjekte**: Arbeitskarten und Artikel haben keine dedizierten Detailseiten/URLs; tiefere Verlinkung und Objektkontext fehlen noch.
  3. **Rollen/Rechte serverseitig vervollständigen**: RLS-Policies pro Aktion/Datensatz weiter ausbauen; Grundlage für Mehrbenutzer-Launch.
