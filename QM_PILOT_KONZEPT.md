# QM-Pilot — Vollständiges Konzept & Design-Dokument

> Erstellt: 2026-05-20 | Stack: Next.js 14 · TypeScript · Tailwind · Supabase · OpenAI Vision  
> Route: `/dashboard/qm` | Pilot-Farbe: Teal `#14b8a6` | Preis: ab 40 €/Monat  
> Pilot-ID im Access-System: `'qm'` | In Enterprise-Paket (279 €/Monat) enthalten

---

## Überblick

QM-Pilot ist ein **eigenständiges, zubuchbares Modul** für kleine/mittlere Werkstätten, Prüflabore und Fertigungsbetriebe. Es digitalisiert die Qualitätskontrolle: von der Zeichnungsanalyse über Prüfberichte bis zur Archivierung. Es hat **keine Abhängigkeiten zu Pondruff** oder anderen Piloten.

---

## Phasen-Plan

### Phase 1 — MVP (implementieren als nächstes)

| # | Aufgabe | Dateien | Effort |
|---|---------|---------|--------|
| 1 | DB-Schema + Supabase-Migrations | `supabase/migrations/YYYYMMDDHHMMSS_qm_schema.sql` | Niedrig |
| 2 | Storage-Buckets anlegen | `qm-zeichnungen`, `qm-fotos` (RLS user_id) | Niedrig |
| 3 | Zeichnungs-Upload + Vorschau | `app/dashboard/qm/zeichnungen/page.tsx` | Mittel |
| 4 | OpenAI Vision KI-Analyse API | `app/api/qm/analyse-zeichnung/route.ts` | Hoch |
| 5 | Prüfbericht-Wizard (6 Schritte) | `app/dashboard/qm/pruefen/page.tsx` | Mittel |
| 6 | Messwert-Ampel-Logik | (inline in Wizard) | Niedrig |
| 7 | Foto-Upload in Prüfbericht | (inline in Wizard, Schritt 4) | Mittel |
| 8 | Gesamtstatus-Auto-Berechnung | (inline in Wizard) | Niedrig |
| 9 | PDF-Export Prüfbericht | `lib/qm-pdf.ts` | Mittel |
| 10 | Archiv mit Suche/Filter | `app/dashboard/qm/archiv/page.tsx` (Unterseite oder Tab) | Niedrig |
| 11 | Demo-Daten + Demo-Modus | (statische DEMO_* Konstanten in page.tsx) | Niedrig |

### Phase 2 — Quick Wins

| # | Aufgabe | Effort | Status |
|---|---------|--------|--------|
| 1 | Team-Management (Prüfer hinzufügen) | Mittel | ✅ 2026-05-20 |
| 2 | Push-Benachrichtigungen (VAPID vorhanden) | Niedrig | ✅ 2026-05-20 |
| 3 | KI-Sichtprüfung (Foto → OpenAI Vision → Befund) | Hoch | ✅ 2026-05-20 |
| 4 | Prüfplan-Generator aus Zeichnungs-Daten | Mittel | ✅ 2026-05-20 |
| 5 | Statistik-Dashboard (Fehlerquoten, Trends) | Mittel | ✅ 2026-05-20 |

### Phase 3 — Nice-to-Have

| # | Aufgabe | Status |
|---|---------|--------|
| 1 | SPC-Trend-Analyse (Cp/Cpk vereinfacht) | ✅ 2026-05-20 |
| 2 | Messmittel-Kalibrierungs-Tracking | ✅ 2026-05-20 |
| 3 | E-Mail PDF direkt an Kunden | ✅ 2026-05-20 |
| 4 | Barcode/QR-Code für Bauteil-ID | ✅ 2026-05-20 |
| 5 | CSV/Excel-Export | ✅ 2026-05-20 |

---

## Datenmodell (Supabase-Tabellen)

### `qm_zeichnungen`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid REFERENCES auth.users DEFAULT auth.uid()
name             text NOT NULL           -- "Stempel-B Rev.A"
zeichnungsnummer text
revision         text                    -- "A", "B", "C"
datei_pfad       text                    -- Storage-Pfad qm-zeichnungen/
material         text
oberflaeche_anforderung text
beschichtung     text
sonderanforderungen text[]
ki_konfidenz     integer                 -- 0-100%
erkannte_masse   jsonb                   -- [{ name, wert, einheit, toleranz_plus, toleranz_minus, kritisch, konfidenz }]
erstellt_am      timestamptz DEFAULT now()
```
**RLS:** SELECT/INSERT/UPDATE/DELETE nur eigene `user_id`

### `qm_pruefberichte`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES auth.users DEFAULT auth.uid()
zeichnung_id        uuid REFERENCES qm_zeichnungen(id) ON DELETE SET NULL
pruefbericht_nr     text UNIQUE NOT NULL   -- "PB-2026-001" (auto-generated)
bauteil_id          text
chargennummer       text
anzahl_geprueft     integer DEFAULT 1
pruef_datum         date DEFAULT CURRENT_DATE
pruefer_name        text
gesamtstatus        text CHECK (gesamtstatus IN ('bestanden','nachbesserung','ausschuss','offen'))
bemerkungen         text
unterschrift_initialen text
gesperrt            boolean DEFAULT false
erstellt_am         timestamptz DEFAULT now()
```

### `qm_messwerte`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
pruefbericht_id uuid REFERENCES qm_pruefberichte(id) ON DELETE CASCADE
messstelle      text NOT NULL    -- "Länge", "Ø Bohrung"
sollwert        numeric
toleranz_plus   numeric
toleranz_minus  numeric
istwert         numeric
abweichung      numeric GENERATED ALWAYS AS (istwert - sollwert) STORED
einheit         text DEFAULT 'mm'
status          text CHECK (status IN ('gruen','orange','rot','offen'))
pruefmittel     text
reihenfolge     integer DEFAULT 0
```

### `qm_fotos`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
pruefbericht_id uuid REFERENCES qm_pruefberichte(id) ON DELETE CASCADE
typ             text CHECK (typ IN ('gesamt','detail','oberflaeche','referenz'))
datei_pfad      text NOT NULL    -- Storage-Pfad qm-fotos/
beschreibung    text
erstellt_am     timestamptz DEFAULT now()
```

### `qm_team_mitglieder` (Phase 2)
```sql
id      uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES auth.users DEFAULT auth.uid()
name    text NOT NULL
email   text
rolle   text CHECK (rolle IN ('admin','pruefer','viewer'))
aktiv   boolean DEFAULT true
```

---

## Ampel-Logik (Messwerte)

```
Abweichung = |istwert - sollwert|
Toleranzband_gesamt = toleranz_plus + toleranz_minus

Grün   → Abweichung ≤ 80% des Toleranzbands
Orange → 80% < Abweichung ≤ 100% des Toleranzbands
Rot    → Abweichung > Toleranzband
Grau   → istwert noch nicht eingetragen (offen)
```

**Gesamtstatus-Formel:**
```
ALLE Grün + Sichtprüfung OK           → "bestanden"
Mind. 1× Orange ODER Sichtprüfung Mangelhaft → "nachbesserung"
Mind. 1× Rot ODER Sichtprüfung Ausschuss     → "ausschuss"
Noch offene Messstellen                       → "offen"
```

---

## Prüfbericht-Nr Auto-Format

```
PB-{YYYY}-{NNN}
Beispiel: PB-2026-001
```
Generierung: `SELECT count(*) FROM qm_pruefberichte WHERE user_id=... AND pruef_datum >= '2026-01-01'`  
→ `'PB-' + year + '-' + (count+1).toString().padStart(3,'0')`

---

## KI-Analyse (OpenAI Vision)

### Zeichnungs-Analyse
**API-Route:** `POST /api/qm/analyse-zeichnung`  
**Input:** `{ datei_path: string }` — Signed URL aus Storage  
**Modell:** `gpt-4o-mini` (Vision, ~0,002–0,005 €/Analyse)

### Sichtprüfung (Phase 2 — ✅ live seit 2026-05-20)
**API-Route:** `POST /api/qm/sichtpruefung`  
**Input:** `{ foto_path: string, bauteil_beschreibung?: string, material?: string }`  
**Modell:** `gpt-4o` (höhere Bildqualität als gpt-4o-mini)  
**Output-Schema:**
```json
{
  "gesamtbewertung": "ok" | "mangelhaft" | "ausschuss",
  "konfidenz": 0-100,
  "befunde": [{ "typ": "kratzer|delle|grat|verschmutzung|polierfehler|beschaedigung|sonstiges", "schwere": "leicht|mittel|schwer", "position": "...", "beschreibung": "..." }],
  "empfehlung": "...",
  "hinweise": ["..."]
}
```
- Ergebnis wird in `qm_fotos.ki_analyse_ergebnis` (jsonb) gespeichert
- Cost-Tracking via `lib/ai-usage.ts` (5 €/Monat-Limit greift)
- Demo-Modus: Mock-Antwort (kein API-Call)
- Pfad-Check: erstes Segment muss `user_id` sein (RLS-Safety)

**System-Prompt:**
```
Du bist Experte für technische Zeichnungen nach DIN/ISO-Normen.
Analysiere die Zeichnung und extrahiere ALLE Maße, Toleranzen, Materialangaben und Anforderungen.
Antworte NUR mit validem JSON, kein Markdown, keine Erklärung.
```

**Erwartetes JSON-Output:**
```json
{
  "masse": [
    { "name": "Länge", "wert": 150, "einheit": "mm", "toleranz_plus": 0.1, "toleranz_minus": 0.1, "kritisch": false, "konfidenz": 94 }
  ],
  "material": "C45",
  "oberflaeche": { "ra": 0.8, "rz": null, "anforderung": "poliert" },
  "gewinde": [{ "bezeichnung": "M12×1,5-6H", "anzahl": 2, "position": "oben" }],
  "beschichtung": "verzinkt 8µm",
  "sonderanforderungen": ["scharfkantig verboten", "entgraten"],
  "zeichnungsnummer": "ZN-2041",
  "revision": "A",
  "gesamt_konfidenz": 88
}
```

**Konfidenz-Handling im UI:**
- ≥ 85%: Grüner Haken, direkt übernommen
- 70–84%: Oranger Hinweis „Bitte prüfen"
- < 70%: Roter Hinweis „KI unsicher — manuell korrigieren"

**Cost-Limit:** Prüft `lib/ai-usage.ts` vor jedem Aufruf (5 €/Monat-Limit greift)

---

## Prüfbericht-Wizard (6 Schritte)

### Schritt 1 — Zeichnung auswählen
- Dropdown: bestehende Zeichnungen des Users
- ODER: neue Zeichnung inline hochladen (mit Mini-Upload-Flow)
- Zeigt Zeichnungs-Vorschau + erkannte Daten

### Schritt 2 — Bauteil-Infos
- Bauteil-ID (aus Zeichnung vorausgefüllt, editierbar)
- Zeichnungsnummer (readonly wenn aus Zeichnung)
- Revision
- Chargennummer (optional)
- Anzahl geprüfte Stücke

### Schritt 3 — Messwerte
- Tabelle mit einer Zeile pro erkannter Messstelle
- Felder: Messstelle | Sollwert | Tol+ | Tol- | Istwert | Einheit | Prüfmittel | Ampel
- Ampel-Live-Update beim Tippen
- Button: „+ Messstelle manuell hinzufügen"

### Schritt 4 — Fotos
- 5 Drop-Zones: Gesamt / Detail 1 / Detail 2 / Oberfläche / Referenz
- Mobile: `<input type="file" capture="environment">` → direkt Kamera
- Client-seitige Komprimierung: max 1200px / 80% JPEG (`lib/image-compress.ts` existiert!)

### Schritt 5 — Sichtprüfung
- Entgratung: Ja / Nein / Nicht erforderlich
- Beschädigungen: Ja (+ Freitext) / Nein
- Sichtprüfungs-Ergebnis: OK / Mangelhaft / Ausschuss
- „🔍 KI-Sichtprüfung starten" (Phase 2 ✅ live):
  - Voraussetzung: mind. 1 Foto in Schritt 4 hochgeladen
  - `POST /api/qm/sichtpruefung` → gpt-4o Vision → strukturierter Befund
  - Ergebnis-Card: Gesamtbewertung (ok/mangelhaft/ausschuss), Konfidenz, Befunde (typ/schwere/position/beschreibung), Empfehlung, Hinweise
  - „Befund übernehmen" befüllt Sichtprüfungs-Ergebnis + Bemerkungen
  - KI-Resultat wird beim Speichern in `qm_fotos.ki_analyse_ergebnis` (jsonb) am ersten Foto gespeichert
  - Demo-Modus: Mock-Antwort (kein API-Call)

### Schritt 6 — Abschluss & Abzeichnung
- Zusammenfassung: alle Messwerte tabellarisch + Gesamtstatus
- Prüfer-Name (Freitext, Dropdown in Phase 2 mit `qm_team_mitglieder`)
- Initialen-Feld (Text, max 4 Zeichen)
- Bemerkungen (Freitext)
- Checkbox: „Bericht nach Speicherung sperren (nicht mehr änderbar)"
- Button: „💾 Speichern & PDF erzeugen"

---

## PDF-Export (`lib/qm-pdf.ts`)

Nutzt `jsPDF` + `jspdf-autotable` (bereits installiert, vgl. `lib/pdf.ts`).

**Seite 1:**
- Header: Firmenname (aus `firma_einstellungen`) + QM-Pilot Logo-Teal
- Bauteil-Infos: Bericht-Nr, Datum, Prüfer, Bauteil-ID, Zeichnung
- Messwert-Tabelle: Farbige Zeilen (grün/orange/rot)

**Seite 2:**
- Sichtprüfungs-Ergebnis
- Fotos: 2×2 Grid (komprimiert)
- Bemerkungen + Initialen

**Footer:** Seitennummer + Datum + „Erstellt mit Petersen KI QM-Pilot"

---

## Routing-Struktur

```
/dashboard/qm                    → QM Dashboard (bereits live: Tabs)
/dashboard/qm/zeichnungen        → Zeichnungs-Bibliothek + Upload (Phase 1)
/dashboard/qm/pruefen            → Prüfbericht-Wizard (Phase 1)
/dashboard/qm/pruefen/[id]       → Bestehenden Bericht anzeigen/bearbeiten
/dashboard/qm/archiv             → Alle Berichte (Suche/Filter/PDF)
/api/qm/analyse-zeichnung        → OpenAI Vision Analyse (Phase 1)
/api/qm/pdf/[id]                 → PDF generieren/abrufen (Phase 1)
```

---

## Farbschema

```
Pilot-Farbe:      #14b8a6  (Teal)
Hover/Dark:       #0d9488
Grün (OK):        #10b981
Orange (Grenz.):  #f59e0b
Rot (Fehler):     #ef4444
Neutral (offen):  #aeb9c8
```

Badge-Stile (wie andere Piloten):
```tsx
.badge-bestanden     { bg: rgba(16,185,129,.15); color: #10b981 }
.badge-nachbesserung { bg: rgba(245,158,11,.15);  color: #f59e0b }
.badge-ausschuss     { bg: rgba(239,68,68,.15);   color: #ef4444 }
```

---

## Tech-Stack (QM-spezifisch)

| Bereich | Technologie | Status |
|---------|-------------|--------|
| Framework | Next.js 14 App Router | vorhanden |
| KI Vision | OpenAI `gpt-4o-mini` Vision | vorhanden (`OPENAI_API_KEY`) |
| Storage | Supabase Storage (neue Buckets) | neu anlegen |
| PDF | jsPDF + jspdf-autotable | vorhanden (`lib/pdf.ts`) |
| Foto-Komprimierung | `lib/image-compress.ts` | vorhanden! |
| Cost-Tracking | `lib/ai-usage.ts` | vorhanden! |
| Demo-Modus | `hasDemoCookie()` Pattern | vorhanden |

**Neu zu installieren:** nichts — alles vorhanden!

---

## Aktueller Status (2026-05-20)

### ✅ Erledigt (in diesem Chat)
- [x] `lib/access.ts`: `'qm'` als `AccessPilotId` + in `ACCESS_PILOTS`
- [x] `lib/access.ts`: `DEFAULT_ROLE_PILOTS` enthält **kein** `'qm'` → nur per expliziter Buchung sichtbar
- [x] `components/Sidebar.tsx`: QM-Pilot 🔬 im KI-Piloten-Menü
- [x] `app/dashboard/layout.tsx`: Demo sieht QM, echte User nur bei Buchung
- [x] `app/dashboard/[pilot]/page.tsx`: QM Landing-Page mit Features/Stats/Modulen
- [x] `app/dashboard/qm/page.tsx`: QM Dashboard (4 Tabs, Demo-Daten, Coming-Soon-Banner)
- [x] `lib/pricingConfig.ts`: QM als buchbarer `PilotId` (40 €/85 €/149 €/Anfrage)
- [x] `lib/pricingConfig.ts`: Enterprise-Paket enthält QM (249→279 €/Monat)
- [x] `app/dashboard/einstellungen/page.tsx`: `MANAGED_PILOT_OPTIONS` + `PILOT_LABELS` + AGB

### ✅ Phase 1 — Vollständig (alle 13 Aufgaben)
### ✅ Phase 2 — Vollständig (alle 5 Aufgaben)
### ✅ Phase 3A+B — Vollständig (2026-05-20)

| # | Aufgabe | Commit |
|---|---------|--------|
| 5 | CSV/Excel-Export (Archiv + Messwerte pro Bericht) | `2c4a7fb` |
| 4 | QR-Code für Bauteil-ID (UI Wizard + PDF oben rechts) | `f497f36` |
| 3 | E-Mail PDF (Resend API + mailto-Fallback) | `f330e42` |
| 2 | Messmittel-Kalibrierungs-Tracking (Tab, DB, Dashboard-Warn) | `7ce3a3d` |

---

## Wichtige Referenzen im bestehenden Code

| Was | Wo |
|-----|----|
| Foto-Komprimierung | `lib/image-compress.ts` → `compressImage()` |
| PDF-Generierung Pattern | `lib/pdf.ts` → `generateRechnungPDF()` |
| OpenAI Vision Pattern | `app/api/pondruff/ocr-lieferschein/route.ts` |
| Storage Upload Pattern | `lib/db.ts` → `uploadFirmenLogo()` |
| Cost-Tracking | `lib/ai-usage.ts` → `checkAndRecordAiUsage()` |
| Demo-Modus | `lib/auth.ts` → `hasDemoCookie()` |
| Signed URL 1h | Überall: `supabase.storage.from().createSignedUrl(path, 3600)` |
| exec_sql für Migration | `source .env.local && curl ... exec_sql` |

---

## Zugriffs- & Feature-Flag-System (ab 2026-05-20)

### 4 Zugangs-Klassen

| Klasse | QM-Pilot sichtbar? | KI-Features | Steuerung |
|--------|-------------------|-------------|-----------|
| **Inhaber** (`info@petersen-ki-pilot.de`) | Immer ✅ | Beide immer AN | Auto-Override in `getAccessProfile()` + `getServerQmKiSettings()` |
| **Pondruff** (`info@pondruffpolierservice.de`) | Immer ✅ | Beide immer AN | Auto-Override (gleiche Logik) |
| **Normaler Kunde** | Nur bei Buchung (`allowed_pilot_ids: ['qm']`) | Default AUS | Owner schaltet manuell per Toggle frei |
| **Demo-Account** | Immer ✅ | Beide immer AN | `hasDemoCookie()` → Mock-Response |

### Implementierung

**Pilot-Zugang** (`lib/access.ts` → `getAccessProfile()`):
- Email wird aus `user.email` oder `user_metadata.email` gelesen
- Inhaber oder Pondruff → `'qm'` wird zu `allowedPilotIds` hinzugefügt, auch ohne DB-Buchung

**Feature-Flags in DB** (`firma_einstellungen`):
```sql
qm_ki_zeichnungs_analyse boolean DEFAULT false
qm_ki_sichtpruefung      boolean DEFAULT false
```

**Server-Side Check** (`lib/ai-settings.ts` → `getServerQmKiSettings(userId, email?)`):
1. Email = Inhaber oder Pondruff → `{ true, true }` sofort
2. Service-Role liest `firma_einstellungen` für `userId`
3. Bei Fehler / fehlendem Key → `{ false, false }` (fail-closed)

**Client-Side Check** (`lib/db.ts` → `getQmKiSettings()`):
1. Demo-Cookie → `{ true, true }`
2. Email = Inhaber/Pondruff → `{ true, true }`
3. Sonst DB lesen (via Browser-Supabase-Client)

**API-Route-Guard** (Reihenfolge in QM-KI-Routen):
```
Auth → Demo-Mock-Return → Feature-Flag-Check (403) → Rate-Limit → Cost-Limit → Body-Validation → OpenAI
```

**Owner-Steuerung**:
- UI: `components/billing/OwnerAiControlPanel.tsx` → QM-Pilot-Sektion mit Kunden-Dropdown
- API: `GET/PATCH /api/owner/qm-ki-flags`
- Schutz: Inhaber/Pondruff-User können nicht per Toggle gesteuert werden (400 Bad Request)
- Audit-Log: `qm_ki_zeichnungs_analyse.toggle` / `qm_ki_sichtpruefung.toggle`

### Cost-Implikation

| KI-Feature | Modell | Kosten/Aufruf |
|-----------|--------|--------------|
| Zeichnungs-Analyse | `gpt-4o-mini` | ~0,002–0,005 € |
| KI-Sichtprüfung | `gpt-4o` | ~0,005–0,010 € |

Zusätzlich greift das bestehende 5 €/Monat-Cost-Limit aus `lib/ai-usage.ts`.

### Aktivierungs-Workflow für neue Kunden

1. Kunde bucht QM-Pilot → `allowed_pilot_ids` wird auf `['qm']` gesetzt
2. KI-Features sind noch deaktiviert (Default false)
3. Owner öffnet Einstellungen → KI-Funktionen → QM-Pilot KI-Features → Kunden auswählen → Toggle AN
4. Kunde sieht sofort aktive Buttons nach Browser-Refresh
