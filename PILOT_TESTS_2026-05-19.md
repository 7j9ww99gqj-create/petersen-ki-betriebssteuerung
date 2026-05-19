# Petersen KI — Pilot-Test-Report

**Datum:** 2026-05-19
**Methode:** 12 parallele QA-Agenten, je 1 pro Pilot
**Modus:** Code-Audit (Chrome MCP nicht verbunden — kein E2E-Klicktest)
**Geprüft:** Code-Pfade, DB-Funktionen, API-Routen, Demo-Fallbacks, Sicherheit, FK-Integrität, Architektur-Risiken
**Status-Legende:** ✅ Funktioniert | ⚠️ Teilweise / Probleme | ❌ Broken

---

## 📊 Gesamt-Übersicht

| Pilot | Status | P0-Bugs | P1-Bugs | Architektur-Risiko |
|---|---|---|---|---|
| LagerPilot | ⚠️ | 1 (Spalten-Mismatch) | 2 | Niedrig |
| BüroPilot | ⚠️ | 2 (Angebot-Nr nicht atomar, PDF-Archiv toter Code) | 3 | Mittel |
| WerkstattPilot | ⚠️ | 2 (Sync-Bug, Zeit-Aggregation) | 2 | Mittel |
| MarketingPilot | ⚠️ | 1 (kein Newsletter-Versand) | 3 | Niedrig |
| AnalysePilot | ⚠️ | 2 (KW-Berechnung, PDF-Bug) | 2 | Niedrig |
| PlanungPilot | ⚠️ | 1 (ReferenceError-Risiko) | 3 | Niedrig |
| KI-Assistent | ⚠️ | 3 (Chat ungesteuert, Tagesbrief Mock, falsches Modell) | 2 | **HOCH** |
| SteuerPilot | ⚠️ | 2 (OCR nicht GoBD, FK fehlt) | 3 | **HOCH** |
| Cloud & Sync | ⚠️ | 2 (Manuell-Backup kein Dump, Cron-Auth lückenhaft) | 2 | Mittel |
| Archiv | ⚠️ | 1 (Public-URL-Leak in PilotDocArchive) | 2 | Mittel |
| Einstellungen | ⚠️ | 1 (Storage-Bucket-Mismatch) | 2 | Niedrig |
| Pondruff | ⚠️ | 1 (Admin-Preis wirkt nicht) | 1 | **HOCH** (Multi-Tenant-Anti-Pattern) |

**Insgesamt:** 0 Piloten ✅, 12 Piloten ⚠️, 0 Piloten ❌
**Kritische Bugs (P0):** 19
**Wichtige Bugs (P1):** 27

---

## 🚨 Top-10 KRITISCHE Befunde (Release-Blocker)

1. **KI-Assistent: Chat-Tab ruft API gar nicht auf** — `sendChat` ist `setTimeout`-Simulation (`page.tsx:686-699`). Streaming/Aktionen/Cost-Logging im UI komplett tot.
2. **KI-Assistent: Tagesbrief ruft API gar nicht auf** — `generateBrief` baut Prompt, verwirft mit `void`, gibt `buildStaticBrief()` zurück.
3. **KI-Assistent: Default-Model `gpt-5.4-mini` existiert nicht** — bei fehlendem `OPENAI_CHAT_MODEL` Env-Var schlägt jeder Aufruf fehl.
4. **BüroPilot: `pk_next_angebot_number` ist NICHT atomar** — `SELECT max(...)` + return → Race-Condition mit Doppelvergabe möglich. UNIQUE-Constraint fehlt.
5. **BüroPilot: PDF-GoBD-Archiv ist toter Code** — `archiveRechnungPdf` / `archiveAngebotPdf` werden nirgends aufgerufen. `pdf_path/pdf_hash/pdf_archived_at` bleiben leer.
6. **SteuerPilot: OCR-Pipeline ist GoBD-Lücke** — `app/api/ocr-beleg/route.ts` verwendet text-only (kein Bild!) + veraltetes `claude-haiku-20240307` + speichert Original NICHT in `ocr-originale`-Bucket.
7. **SteuerPilot: FK `steuer_buchungen.beleg_id → steuer_belege.id` fehlt** — Buchungen ohne Belege möglich, keine referentielle Integrität.
8. **Einstellungen: Storage-Bucket-Mismatch** — Migration legt `firma-branding` an, aber `uploadFirmenLogo`/`uploadBriefpapier` schreiben in `dokumente`. Neue Bucket-Policies greifen nie.
9. **Archiv: Public-URL-Leak in `PilotDocumentArchive.tsx:157`** — nutzt `getPublicUrl` statt `createSignedUrl`. Dokumente potenziell öffentlich erreichbar.
10. **Cloud & Sync: Manueller Backup-Trigger erzeugt KEIN echtes Backup** — nur Count-Head-Queries + DB-Row, kein gzip-Dump in Storage. Im Disaster-Fall wertlos.

---

## 📋 Detaillierte Pilot-Reports

### 1️⃣ LagerPilot — Status: ⚠️

**🟢 Was funktioniert:**
- URL-Persistenz für Tab + Status-Filter (`useSearchParams` + `router.replace`)
- `useSwipeTabs` korrekt integriert
- Tab-Lazy-Loading via `loadedTabs`-Set
- `umlagerArtikel` ist jetzt atomare RPC `umlager_artikel` (kein Datenverlust mehr)
- Bulk-Select mit CSV-Export + Bulk-Delete + Demo-Block

**🔴 Bugs:**
- **P0 [page.tsx:2154-2243]**: Spalten-Mismatch im Bestand-Tab. Header hat 9 `<th>`, Body 10 `<td>` (Bild-Spalte ungelabelt). `colSpan={9}` falsch.
- **P1 [page.tsx:1130-1136]**: KI-Tagesbericht respektiert `aiSettings.enabled` nicht.
- **P1 [page.tsx:2127-2137]**: Bulk-Delete schluckt Fehler silent. Toast zeigt `count` als erfolgreich.

**🟡 Schwächen:**
- 3865 Zeilen monolithische Datei — Tabs in eigene Files extrahieren
- 47+ redundante Inline-Type-Casts statt typisierter Return-Signaturen
- `lib/db/lager.ts` ist nur Barrel — Soft-Split-Migration nicht beendet

**📋 Empfehlungen:**
1. Spalten-Mismatch fixen (P0)
2. Bulk-Delete-Fehlerzähler
3. KI-Auto-Brief feature-gated
4. `page.tsx` aufsplitten in `_tabs/*.tsx` + `next/dynamic`

---

### 2️⃣ BüroPilot — Status: ⚠️

**🟢 Was funktioniert:**
- `getNextInvoiceNumber` ist atomar via `INSERT ... ON CONFLICT DO UPDATE`
- `checkBueroKundeDuplicate` wird in `KundenTab.tsx:59` tatsächlich aufgerufen
- Mahnung-Route mit Cost-Limit-Check verdrahtet
- Detail-Pages existieren unter `[entity]/[id]/page.tsx`
- RLS-Härtung in `billing_sequences`

**🔴 Bugs:**
- **P0 [schema.sql:662-680]**: `pk_next_angebot_number` NICHT atomar — Race-Condition.
- **P0 [lib/db.ts:1189-1248]**: `archiveRechnungPdf`/`archiveAngebotPdf` werden NIRGENDS aufgerufen. PDFs gehen nie ins GoBD-Archiv.
- **P1 [RechnungenTab.tsx:219-253]**: Kein `isSubmitting`-Guard → Doppelklick erzeugt zwei Rechnungen.
- **P1 [PipelineKanbanTab.tsx]**: Kein Drag-and-Drop, nur `onClick={setTab(...)}`. Status persistiert nicht.
- **P1 [EingangsrechnungenTab.tsx]**: OCR-Übernahme via `localStorage` — fragil, schluckt JSON-Parse-Fehler.

**🟡 Schwächen:**
- PDF-Archivierung nicht idempotent (kein Hash-Vergleich)
- Detail-Pages ohne Pagination
- KiToolsTab hardgecodete Demo-Rechnungen Datum 2025

**📋 Empfehlungen:**
1. `pk_next_angebot_number` atomar machen + UNIQUE INDEX
2. `archiveRechnungPdf` aus `RechnungenTab.handleNeu` aufrufen
3. `isSubmitting`-Guard auf Create-Buttons
4. Pipeline-Kanban mit `@dnd-kit` aufrüsten
5. GoBD: `upsert: false` + Hash-Vergleich

---

### 3️⃣ WerkstattPilot — Status: ⚠️

**🟢 Was funktioniert:**
- `syncWerkstattMaterialToLager` reduziert Bestand mit `Math.max(0, …)`
- FK-Migration `werkstatt_karten.buero_auftrag_id` mit `ON DELETE SET NULL`
- Soll/Ist-Stunden-Aggregation mit Überstunden-Warnung
- Demo-Daten realistisch (6 Karten, 5 Zeitbuchungen)
- Inline-Delete-Confirm + `useSwipeTabs`

**🔴 Bugs:**
- **P0 [db.ts:1021]**: `syncWerkstattMaterialToLager` ruft `insertLagerBewegung` NICHT auf, sondern direkten `client.from('lager_bewegungen').insert` → umgeht Audit-Log + inkonsistentes Datumsformat.
- **P0 [page.tsx:741+]**: Zeitbuchung addiert NICHT zur `werkstatt_karten.stunden`. Karte-Datensatz bleibt nach Reload veraltet.
- **P1 [schema.sql:921]**: `werkstatt_material.auftragsnr` ohne FK — Material auf nicht-existierende Aufträge buchbar.
- **P1 [page.tsx:921]**: Sync-Fehler silent geschluckt → User sieht "Erfolg" obwohl Lager nicht synchron.

**🟡 Schwächen:**
- `ilike` exakt — Whitespace-Differenzen führen zu stillem Fehlschlag
- Keine Lager-Bestandsprüfung VOR Verbrauch
- Mobile: Status-Schnellwechsel-Buttons nur ~24px hoch (CLAUDE.md verlangt 44px)

**📋 Empfehlungen:**
1. Sync auf `insertLagerBewegung()` umbauen (P0)
2. Zeitbuchung → Karte-Update via Supabase-Trigger (P0)
3. FK `werkstatt_material → werkstatt_karten(id)` (P1)
4. Toast bei Sync-Fehler statt silent catch (P1)
5. Touch-Targets auf 44px

---

### 4️⃣ MarketingPilot — Status: ⚠️

**🟢 Was funktioniert:**
- **Edit + Delete für alle Hauptentitäten vorhanden** (CLAUDE.md-Status veraltet!)
- KI-Routen sauber gehärtet: Demo-Block, Feature-Flag-Check, OpenAI-Aufruf nur bei Aktivierung
- KI-Suite hat echte Logik via `runKi` → OpenAI Responses-API
- SEO-Keywords + Content-Ideas + Posting-Plans werden persistiert
- openRate/clickRate aus echten Daten + simulierte Metriken

**🔴 Bugs:**
- **P0 [page.tsx:1789]**: "Jetzt versenden" simuliert nur — KEINE echte E-Mail-Integration (kein Resend/SMTP).
- **P1 [vercel.json]**: Nur `/api/cron/push-alerts` — keine Cron-Triggers für Posting-Plan/Automation.
- **P1**: Doppelte `id`-Attribute in Formularen → a11y-Bug.
- **P1 [lib/ai-settings.ts:49]**: `if (!isSupabaseAdminConfigured()) return DEFAULT_MARKETING_KI` (alle `false`) → ohne Service-Role-Key sind ALLE Marketing-KI-Features dauerhaft aus.

**🟡 Schwächen:**
- KI-Suite-Button schickt rohe Leads/Kampagnen an OpenAI — PII (E-Mail/Telefon) leakt
- `createNewsletterMetrics` deterministisch-pseudo — täuscht echte Analytics
- Keine Newsletter-Empfänger-Tabelle
- CLAUDE.md veraltet ("Edit/Delete fehlt" — stimmt nicht mehr)

**📋 Empfehlungen:**
1. CLAUDE.md aktualisieren
2. Echten Newsletter-Versand via Resend/SES + Empfänger-Tabelle
3. PII-Filter in `runKi`
4. Cron-Job für Posting-Plan in `vercel.json`
5. Fallback in `ai-settings.ts:49` korrigieren

---

### 5️⃣ AnalysePilot — Status: ⚠️

**🟢 Was funktioniert:**
- Live-Daten via `Promise.allSettled` über 10 Tabellen — robust
- Demo-Fallback via `hasDemoCookie()`
- Recharts via `ResponsiveContainer` SSR-sicher
- PDF dynamischer jsPDF-Import, Dark-Theme
- KI-Routen mit Owner-Flag + Rate/Cost-Limit + Demo-Block

**🔴 Bugs:**
- **P0 [page.tsx:1739]**: PDF-Dateiname zeigt aktuellen Monat statt `zeitraum`-Filter.
- **P0 [page.tsx:1793]**: Zebra-Striping kaputt (`y % 12 === 0` trifft nie).
- **P1 [page.tsx:398]**: KW-Berechnung naiv statt ISO-8601 → falsche KW am Monatsanfang.
- **P1 [page.tsx:413-424]**: KI-Wochentag-Aggregation buggy → Doppelzählung möglich.

**🟡 Schwächen:**
- Zahlungsmoral nur indirekt (Verzug nur bei bezahlten) — offene überfällige Rechnungen NICHT gezählt
- 7T/30T-Filter zeigen 1-2 Balken — sinnlos
- Mobile-KPI-Grid bricht <320px
- Steuerprognose ignoriert Fixkosten/Betriebsausgaben

**📋 Empfehlungen:**
1. ISO-8601 KW-Berechnung
2. PDF-Filename an Zeitraum koppeln + Zebra-Fix
3. Offene überfällige Rechnungen einbeziehen
4. KI-Tag-Aggregation: ISO-Datum als Key

---

### 6️⃣ PlanungPilot — Status: ⚠️

**🟢 Was funktioniert:**
- Vollständiges CRUD für Projekte/Aufgaben/Termine/Ressourcen
- Demo-Fallback korrekt
- Ressourcen-Überlast-Warnung
- Auto-Fortschritt 100% wenn alle Aufgaben erledigt
- Stunden-Soll/Ist mit ProgressBar
- RLS sauber

**🔴 Bugs:**
- **P0 [page.tsx:566/752/970]**: `showToast` wird in `.catch()` VOR Definition aufgerufen. ReferenceError-Risiko (nur in ProjekteTab via `useCallback` gefixt).
- **P1**: "Kalender" ist gar kein Kalender — nur sortierte Liste, keine Monats-/Wochenansicht.
- **P1**: Keine Ressourcen-Konflikt-Erkennung — zwei Aufgaben gleichzeitig nicht erkannt.
- **P1 [schema.sql:1153]**: `planung_aufgaben.projekt` ist Text statt FK → Tippfehler-Links.

**🟡 Schwächen:**
- Kein Drag-and-Drop für Status
- Datum als Textfeld `TT.MM.JJJJ` statt `<input type="date">`
- Termine ohne End-Uhrzeit — Überschneidung nicht modellierbar
- a11y: doppelte `htmlFor`-IDs

**📋 Empfehlungen:**
1. `showToast` in `useCallback` umwandeln (P0)
2. Echten Monats-/Wochen-Grid einbauen
3. FK + Dropdown für Projekt-Verknüpfung
4. Ressourcen-Konflikt-Check
5. `<input type="date">` mit ISO↔DE-Konvertierung

---

### 7️⃣ KI-Assistent — Status: ⚠️ (kritischste Befunde!)

**🟢 Was funktioniert:**
- Server-Side Auth via `getRouteAccess` + `createServerClient`
- Zod-Validation auf Chat-POST-Body
- Rate-Limit 20/min + Cost-Limit 5€/Monat verdrahtet
- SSE-Streaming-Pipeline korrekt
- OCR-Original in `ocr-originale` Bucket archiviert (best-effort)

**🔴 Bugs:**
- **P0 [page.tsx:686-699]**: **Chat-Tab ruft API gar nicht auf** — `sendChat` ist `setTimeout`-Simulation. Streaming/Aktionen/Kosten-Logging im Chat-UI komplett tot.
- **P0 [page.tsx:300-337]**: **Tagesbrief ruft API gar nicht auf** — Prompt wird gebaut, mit `void` verworfen, `buildStaticBrief()` zurückgegeben.
- **P0 [chat/route.ts:400 + document-ai/route.ts:139]**: Default-Model `gpt-5.4-mini` existiert nicht. Bei fehlendem ENV crasht jeder Aufruf.
- **P1 [ai-usage.ts:5-10]**: Pricing-Tabelle inkonsistent: `gpt-5.4-mini` und `gpt-4o-mini` als gleicher Preis hardcoded.
- **P1 [document-ai/route.ts:46-62]**: KEIN Cost-Limit-Check. Nur Rate-Limit.

**🟡 Schwächen:**
- `executeBestellung` existiert, UI hat aber keinen Confirm-Handler → unverdrahtet
- Demo-Cookie umgeht Cost-Limit komplett → bei Leak unbegrenzte Kosten
- Streaming-Pfad loggt KEIN Usage — Kostenerfassung für Streams fehlt
- Zod fehlt bei `/api/document-ai`

**📋 Empfehlungen:**
1. **P0**: Chat-Tab + Tagesbrief tatsächlich an `/api/chat` anschließen
2. **P0**: Default-Model auf existierendes `gpt-4o-mini` korrigieren
3. **P1**: Rate/Cost-Limit auch für `/api/document-ai` + Demo-IP-Drosselung
4. **P1**: Usage-Logging im Streaming-Pfad
5. `executeBestellung` UI verdrahten

---

### 8️⃣ SteuerPilot — Status: ⚠️ (GoBD-Risiko!)

**🟢 Was funktioniert:**
- UStVA-Berechnung sauber: 19%/7%-Split + Vorsteuer aggregiert
- ELSTER-XML mit Kz81/Kz83 + Vorbereitungs-Hinweis sichtbar
- SKR-04-Konten-Map vollständig
- AfA linear nach amtlicher Nutzungsdauer-Tabelle + GWG-Erkennung
- Stripe-Zahlungen real angebunden

**🔴 Bugs:**
- **P0 [ocr-beleg/route.ts:54]**: OCR ist text-only (kein Bild!) + veraltetes `claude-haiku-20240307` + speichert Original NICHT in `ocr-originale` → GoBD-Lücke!
- **P0 [lib/db.ts:2436-2444]**: `upsertSteuerBuchung` akzeptiert `beleg_id?` als optional, KEINE FK-Validierung im Code.
- **P1 [lib/db.ts:2419]**: `uploadSteuerBeleg` lädt in `dokumente`, nicht in `ocr-originale` → GoBD-Archivpfad fehlt.
- **P1**: Kein PDF-Export für UStVA-Voranmeldung — nur CSV+XML.
- **P1**: DATEV-Export mischt SKR03/SKR04 Konten.

**🟡 Schwächen:**
- `calcUStVA` ignoriert Reverse-Charge/innergem. Erwerb
- AfA nur linear (keine degressive für 2024)
- Duplikat-Erkennung O(n²)

**📋 Empfehlungen:**
1. **OCR-Pipeline neu bauen**: Bild/PDF → `ocr-originale` → Vision-Modell → `steuer_belege` (P0)
2. FK `steuer_buchungen.beleg_id → steuer_belege.id` erzwingen (P0)
3. DATEV-Export auf SKR04 vereinheitlichen
4. Haiku-Modell auf `claude-haiku-4-5` aktualisieren
5. PDF-Export UStVA ergänzen

---

### 9️⃣ Cloud & Sync — Status: ⚠️

**🟢 Was funktioniert:**
- Nightly-Cron `0 2 * * *` → `/api/backup/auto`, CRON_SECRET-Auth
- Auto-Backup dumpt 26 User-Tabellen, gzipped, Retention 30 Tage
- ActivityLog liest `user_audit_log` korrekt
- RLS schützt per `auth.uid() = user_id`
- Demo-Fallback

**🔴 Bugs:**
- **P0 [lib/db.ts:2992-3046]**: Manueller `createCloudBackup` schreibt KEIN echtes Dump in Storage — nur Count-Head-Queries. Im DR-Fall wertlos.
- **P0**: `createCloudBackup` deckt 16 Tabellen ab, Cron 26 (10 Tabellen fehlen).
- **P1 [page.tsx:738-766]**: Geräte-Liste ist statisch/inferiert — keine echten Supabase-Sessions.
- **P1**: Cron-Auth `if (cronSecret && ...)` — bei fehlendem Secret ist Endpoint OFFEN.

**🟡 Schwächen:**
- ActivityLog schluckt Fehler still
- Storage-Quota limit:1000 ohne Pagination
- Kein Restore-Pfad im UI

**📋 Empfehlungen:**
1. Manuellen Backup auf gleiches Verhalten wie Cron umstellen (P0)
2. CRON_SECRET-Auth härten — fehlendes Secret = 500 (P0)
3. Restore-Funktion (Download + Import)
4. Echte Sessions via `supabase.auth.admin.listUserSessions`
5. Sync-Protokoll mit echten Audit-Events anreichern

---

### 🔟 Archiv — Status: ⚠️

**🟢 Was funktioniert:**
- Globale Suche joined `buero_dokumente` + `steuer_belege`
- `normalizeDocumentStoragePath` deckt 3 Legacy-Varianten ab
- Signed URLs mit 1h TTL
- EmptyState differenziert leerer DB vs. leerer Filter
- Filter wirken kumulierend (UND-Logik)

**🔴 Bugs:**
- **P0 [PilotDocumentArchive.tsx:157]**: Nutzt `getPublicUrl` statt `createSignedUrl` → potenzieller Public-Leak.
- **P1 [db.ts:2388]**: `deleteSteuerBeleg` nutzt direkten `createSupabaseClient()` statt `db()` — Auth-Inkonsistenz.
- **P1**: Datum-Format-Mix (`2025-05-03` vs `06.05.2025`) → `localeCompare` sortiert unzuverlässig.
- **P1**: Ausgangsrechnungs-PDFs aus `buero_rechnungen` NICHT integriert.

**🟡 Schwächen:**
- Keine Pagination (>500 Dokumente → Performance-Risiko)
- Kein Datumsfilter
- Demo-Daten dünn (3 Einträge)

**📋 Empfehlungen:**
1. `PilotDocumentArchive` auf Signed URLs umstellen (P0)
2. Datum vor Sortierung parsen
3. Rechnungs-PDFs ins Archiv joinen
4. Datumsfilter + Pagination

---

### 1️⃣1️⃣ Einstellungen — Status: ⚠️

**🟢 Was funktioniert:**
- MRR-API `/api/owner/mrr-stats` mit Owner-Check + 403
- Alle 6 Owner-Panels gerendert, `null` bei `!enabled`
- Push-Stack vollständig (VAPID + SW + Subscription)
- DSGVO-Export `/api/user/data-export` existiert (30+ Tabellen)
- Rollen-Härtung: `setRole()` wirft im Live-Modus Error

**🔴 Bugs:**
- **P0**: **Storage-Bucket-Mismatch** — Migration legt `firma-branding` an, aber `uploadFirmenLogo`/`uploadBriefpapier` laden in `dokumente`. Bucket-Policies/Size-Limits greifen nie.
- **P1**: `OwnerMrrPanel` baut ungenutzten `serviceClient()` per anon-key im Browser — toter Code.
- **P1**: `uploadFirmenLogo` nutzt 1-Jahres-SignedURL — läuft ab ohne Renewal.

**🟡 Schwächen:**
- `briefpapier_url` in JSONB statt eigene Spalte
- Logo-Kompression nur 800×800 — für Briefkopf zu klein
- Server-Route `/api/push` nicht verifiziert

**📋 Empfehlungen:**
1. `uploadFirmenLogo`/`uploadBriefpapier` auf `firma-branding`-Bucket (P0)
2. `/api/push`-Route-Existenz prüfen (P1)
3. Toten `serviceClient()` aus `OwnerMrrPanel` entfernen
4. `briefpapier_url` als eigene Spalte

---

### 1️⃣2️⃣ Pondruff — Status: ⚠️ (Multi-Tenant-Anti-Pattern bestätigt)

**🟢 Was funktioniert:**
- Sauberes Tenant-Gate: `POND_USER_EMAIL` + RLS auf allen `pondruff_*` Tabellen
- Feature-Flags vollständig (Owner-Toggle + `requirePondruffFeature` + Audit-Log)
- pgvector-Embedding-Suche (HNSW + Kosinus) ersetzt teure Vision-Aufrufe
- OCR-Helper konsolidiert + durchgängig genutzt
- Auftrag→Rechnung-Sync idempotent

**🔴 Bugs:**
- **P0 [admin/page.tsx:87 + lib/pondruff.ts:33]**: **Preis-Admin wirkt NICHT** — POST schreibt in `pondruff_price_config`, aber `lib/pondruff.ts` importiert weiterhin static JSON. Owner-Änderungen wirkungslos.
- **P1 [lib/pondruff.ts:39]**: `PRICE_COATINGS = Object.keys(coating_factors)` — Insertion-Order-abhängig.

**🟡 Architektur-Risiken:**
- **Multi-Tenant-Anti-Pattern** — kundenspezifisches Modul tief im Hauptprodukt: 9 Pondruff-Refs in `app/dashboard/layout.tsx`, eigener Nav-Slot, PondruffSheet
- Sync Pondruff→BüroPilot mischt fremde Schemas — enge Kopplung zweier Tenant-Bereiche
- `POND_USER_ID` hardgecoded → neuer Pondruff-User braucht Code-Deploy
- Keine Tests für Preislogik trotz dokumentierter OCR-Fehler

**📋 Empfehlungen:**
1. `lib/pondruff.ts` auf async `getPriceConfig(userId)` umstellen — DB-Config tatsächlich verbrauchen (P0)
2. Unit-Tests für `calcPricePosition`, `parseDecimal`, `priceLookupRate`
3. Embedding-Auto-Backfill via DB-Trigger
4. Tenant-Modul in Plugin-Pattern extrahieren
5. JSON-Schema-Validation im `admin-price-config` POST

---

## 🎯 Konsolidierte Prioritäten-Roadmap

### 🔴 Sofort fixen (Release-Blocker P0):
1. **KI-Assistent Chat + Tagesbrief an echte API anschließen** (3 Stellen)
2. **Default-Model auf `gpt-4o-mini` korrigieren** (chat + document-ai)
3. **OCR-Pipeline neu bauen** (Bild/PDF + Vision + `ocr-originale`-Bucket)
4. **Storage-Bucket-Mismatch fixen** (Firma-Logo → `firma-branding`)
5. **Public-URL-Leak in PilotDocumentArchive** → Signed URLs
6. **`pk_next_angebot_number` atomar machen** + UNIQUE-Constraint
7. **PDF-Archivierung tatsächlich aufrufen** (Rechnungen + Angebote)
8. **Manuellen Backup auf gleiches Verhalten wie Cron**
9. **Pondruff Admin-Preis tatsächlich verbrauchen** (async getPriceConfig)
10. **LagerPilot Spalten-Mismatch fixen** (Bild-`<th>` ergänzen)

### 🟡 Wichtig (P1, nächster Sprint):
- Werkstatt: Sync auf `insertLagerBewegung` umstellen
- FK `steuer_buchungen.beleg_id → steuer_belege.id`
- FK `werkstatt_material → werkstatt_karten(id)`
- FK `planung_aufgaben.projekt_id → planung_projekte(id)`
- Marketing: echter Newsletter-Versand (Resend/SES) + Cron für Posting-Plan
- Cost-Limit auch auf `/api/document-ai`
- Streaming-Usage-Logging
- Pipeline-Kanban Drag-and-Drop
- `isSubmitting`-Guards gegen Doppel-Submit (Büro)

### 🟢 Optimierung (P2):
- Echter Kalender-Grid in PlanungPilot
- Datum-Inputs auf `<input type="date">`
- Unit-Tests für Pondruff-Preislogik
- Touch-Targets 44px überall
- Pagination im Archiv
- Pondruff aus Hauptprodukt extrahieren (Plugin-Pattern)
- CLAUDE.md aktualisieren (MarketingPilot-Status, atomare RPC)

---

## ⚠️ Caveat zum Test

**Chrome MCP war nicht verbunden** → kein echter Klicktest, keine Screenshots, kein UI-Interaktions-Test. Reine Code-Audits. Folgende Klassen von Bugs wurden NICHT erfasst:
- Visuelle Regressions (Charts/Layouts auf Mobile)
- Tatsächliche Klick-Pfade & Bedien-Logik
- JavaScript-Console-Fehler im Browser
- Tatsächliche Performance (Time-to-Interactive, Largest Contentful Paint)
- Form-Submit-Verhalten in echter Browser-Engine

**Empfehlung für echten E2E-Test:**
- Chrome-Extension aktivieren (oder `mcp__Claude_in_Chrome` neu verbinden)
- Playwright-Setup für CI-E2E-Tests
- BrowserStack-Account für Cross-Device-Tests

---

**Erstellt:** 2026-05-19
**Methode:** 12 parallele QA-Agenten (general-purpose subagent_type)
**Gesamtdauer:** ~95s (parallel ausgeführt)
**Gesamt-Token-Verbrauch:** ~660k Tokens (geschätzt)
