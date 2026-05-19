# Pondruff-Modul — zentrale Doku

> **Zweck:** Dieser Bereich der App ist exklusiv für `info@pondruffpolierservice.de`.
> Alle Pondruff-spezifischen Dateien, Tabellen, API-Routen und UI-Elemente sind isoliert.
> Andere Nutzer sehen davon **nichts** und können **nicht** versehentlich gestört werden.
>
> **Wenn du am Pondruff-Bereich arbeitest, ist DIESE Datei der Einstiegspunkt.**
> Lies sie zuerst, fasse nichts außerhalb der hier aufgelisteten Dateien an.

---

## Account

| Feld     | Wert |
|----------|------|
| Email    | `info@pondruffpolierservice.de` |
| Passwort | `Pondruff1904!` |
| User-ID  | `7eb541ca-ca2e-4890-9c20-51ee20a00b43` |

Gate: `lib/pondruff.ts → isPondruffUser(email)` — alle UI-Elemente und API-Routes prüfen
diesen Helper. Andere Nutzer sehen Pondruff **nicht** in Sidebar, Bottom-Nav oder Dashboard.

---

## UI-Struktur (was der User sieht)

### Bottom-Nav (Mobile)
Pondruff-User hat **anstelle von Werkstatt/Steuer/KI-Assist** einen einzigen Pondruff-Button:
das **runde Pondruff-Logo** + Text "Pondruff". Tippen öffnet das

### Pondruff-Sheet (Slide-Up-Menü, rot)
5 große Kacheln:
1. **📥 Wareneingang** — Lieferschein fotografieren & erfassen
2. **💶 Preisrechner** — Positionen kalkulieren
3. **🧾 Büro / WISO** — Aufträge & Wareneingänge übergeben (Sub-Tabs)
4. **🤖 KI-Suche** — Bauteil per Foto wiederfinden
5. **🗂️ Archiv** — Alles durchsuchbar

### Dashboard (oben)
Großer Pondruff-Banner + 3 Direkt-Kacheln (Wareneingang/Preisrechner/Büro-WISO).

### Sidebar (Desktop)
Eigene Sektion "Pondruff Polier-Service" in Rot mit allen 5 Punkten.

---

## Workflow (vereinfacht)

```
Pondruff-Modul
  Wareneingang        Preisrechner
       │                   │
       └────┬──────────────┘
            │
            ▼
       Büro / WISO  (nur Übergabe — keine eigene Verwaltung)
            │
   ┌────────┴────────┐
   ▼                 ▼
→ BüroPilot     → WISO MeinBüro
(Aufträge dort)   (Aufträge dort)
```

**Pondruff = Erfassung + KI-Vorbereitung.**
**Verwaltung (Rechnung, Mahnung, Buchhaltung) passiert wahlweise im BüroPilot oder in WISO.**
Im Büro/WISO-Bereich gibt es nur 2 Buttons pro Zeile: `→ BüroPilot` und `→ WISO`.

---

## Alle Pondruff-Dateien (NUR DIESE sind „Pondruff")

```
lib/pondruff.ts                                  ← Konstanten, Preislogik, isPondruffUser()
lib/pondruff-pdf.ts                              ← PDF-Generator (Briefpapier + Rot/Schwarz)

public/pondruff/
  banner.png                                       Banner-Logo (Dashboard groß)
  icon.png                                         Rundes Logo (Bottom-Nav klein)
  rund.png                                         Alternative
  briefpapier.png                                  DIN-A4 Briefpapier (PDF-Hintergrund)

components/pondruff/
  PondruffSheet.tsx                                Slide-Up Menü, rot

app/dashboard/pondruff/                          ← komplettes Pondruff-UI
  layout.tsx                                       Banner + Auth-Gate
  page.tsx                                         Übersicht (3 Kacheln)
  preisrechner/page.tsx                            Hauptseite Kalkulation (+ prefill)
  wareneingang/page.tsx                            Erfassung + Multi-OCR + → Preisrechner
  buero-wiso/page.tsx                              Aufträge/Bestätigungen/Rechnungen + Wareneingänge + Sync-Buttons
  ki-suche/page.tsx                                Bauteil-Vergleich per Foto
  archiv/page.tsx                                  Alles durchsuchbar in einer Liste

app/api/pondruff/                                ← komplettes Pondruff-API
  ocr-price/route.ts                               GPT-4 Vision OCR mehrere Preis-Positionen
  ocr-lieferschein/route.ts                        GPT-4 Vision OCR Wareneingang (Single-Image)
  bauteil-suche/route.ts                           Embedding-Suche + Live-Vision-Fallback
  embed-bauteil/route.ts                           Embedding für ein einzelnes Bauteil generieren
  embed-backfill/route.ts                          Batch-Backfill (10 Bauteile pro Aufruf)
  sync-buero-auftrag/route.ts                      Pondruff-Auftrag → BüroPilot buero_auftraege
  sync-buero-wareneingang/route.ts                 Pondruff-Wareneingang → BüroPilot buero_dokumente
  wiso-export/route.ts                             WISO MeinBüro Direkt-Import Auftrag
  wiso-export-wareneingang/route.ts                WISO MeinBüro Direkt-Import Wareneingang

supabase/migrations/
  20260519400000_pondruff_module.sql               Basis-Tabellen, RLS, Storage-Bucket
  20260519410000_pondruff_auftrag_rechnung.sql     Status + Rechnung-Spalten (Spalten bleiben, UI nicht mehr genutzt)
  20260519420000_pondruff_bauteile_sync.sql        Bauteile-Tabelle + Sync-Spalten
  20260519430000_pondruff_embeddings.sql           pgvector + match_pondruff_bauteile RPC
```

### Minimale Eingriffe in bestehenden Code (alle gated, alle reversibel)

| Datei                          | Was               |
|--------------------------------|-------------------|
| `app/dashboard/page.tsx`       | `{isPondruff && …}` Banner + Kacheln |
| `components/Sidebar.tsx`       | `{isPondruff && …}` Sidebar-Sektion |
| `app/dashboard/layout.tsx`     | `{isPondruff && …}` Bottom-Nav-Button + PondruffSheet |
| `app/globals.css`              | `.pondruff-theme` CSS-Klasse (greift nur in Pondruff-Layout) |
| `components/buero/RechnungenTab.tsx` | `generateRechnungPDFAuto` statt `generateRechnungPDF` (Auto-Switch je User) |
| `components/buero/AuftraegeTab.tsx`  | dito für `generateAuftragsbestaetigungPDFAuto` |
| `components/buero/AngeboteTab.tsx`   | dito für `generateAngebotPDFAuto` |

Diese 7 Stellen sind die **einzige** Berührung mit der bestehenden Codebase.
Die 3 PDF-Imports sind reine Drop-In-Wrapper — andere Nutzer bekommen 1:1 dieselbe PDF wie vorher.

---

## Datenbank

### Tabellen (alle mit RLS auf `user_id = auth.uid()`)

| Tabelle | Inhalt |
|---------|--------|
| `pondruff_preisauftraege` | Preisaufträge / Auftragsbestätigungen / Rechnungen (Status-Spalte) + Sync-Status zu BüroPilot + WISO |
| `pondruff_wareneingaenge` | Wareneingang inkl. Bild-URLs (mehrere Lieferschein-Bilder mit \| getrennt), KI-Daten + Sync-Status |
| `pondruff_bauteile` | Bauteil-Bilder mit Kunde/Lieferschein für die KI-Suche |

### Status-Workflow (`pondruff_preisauftraege.status`)

```
preisauftrag  ──[📋 Auftrag]──▶ auftragsbestaetigung ──[🧾 Rechnung]──▶ rechnung
        ▲                              │                                    │
        └──────────[↩️ zurück]──────────┘                                    │
                                       └──────────────[↩️ zurück]───────────┘
```

Beim Wandeln zu Rechnung wird `invoice_no` (`RE-{YYYY}-{0001}` aufsteigend) und
`invoice_date` (heute) automatisch gesetzt.

### Sync-Spalten

```
pondruff_preisauftraege:
  synced_buero_auftrag_id     → ID in buero_auftraege (nach Sync)
  synced_buero_at             → Zeitstempel BüroPilot-Sync
  synced_wiso_at              → Zeitstempel WISO MeinBüro Push
  synced_wiso_response        → komplettes WISO API-Response JSON

pondruff_wareneingaenge:
  synced_buero_dokument_id    → ID in buero_dokumente (nach Sync)
  synced_buero_at             → Zeitstempel BüroPilot-Sync
```

### Storage-Bucket

Bucket `pondruff`. Pfad-Konvention: `{user_id}/{kategorie}/{timestamp}.{ext}` mit
`kategorie ∈ {receipt, parts, packaging}`. RLS so gesetzt, dass nur der eigene Ordner les-/schreibbar ist.

---

## Environment-Variablen

```bash
# .env.local (lokal) bzw. Vercel Env (Production)

# OpenAI — bereits vorhanden, wird für alle OCR + KI-Suche genutzt
OPENAI_API_KEY=...

# WISO MeinBüro (nötig für "→ WISO"-Buttons)
WISO_MEINBUERO_API_KEY=c4655a2196bb41dd8b686ef52b268654       ✅ in Vercel gesetzt
WISO_MEINBUERO_API_SECRET=e1591015479444b58559e7b530055b32    ✅ in Vercel gesetzt
WISO_MEINBUERO_OWNERSHIP_ID=343725                            ✅ in Vercel gesetzt
```

WISO-Vars in Vercel setzen (Beispiel):
```bash
source .env.local
curl -s -X POST "https://api.vercel.com/v10/projects/prj_ovhLIo8GAvHKCjz5UWhVmLinVObI/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d '[{"key":"WISO_MEINBUERO_API_KEY","value":"...","type":"encrypted","target":["production","preview"]},
       {"key":"WISO_MEINBUERO_API_SECRET","value":"...","type":"encrypted","target":["production","preview"]},
       {"key":"WISO_MEINBUERO_OWNERSHIP_ID","value":"...","type":"encrypted","target":["production","preview"]}]'
```

---

## Erweiterung — wenn du mehr Pondruff-Logik bauen willst

**Faustregel:** alles Pondruff-spezifische lebt in den 4 Ordnern oben. Greife **nie** in
andere Piloten oder Dashboards ein. Wenn du etwas brauchst, das schon im normalen
Petersen-KI existiert (z.B. Rechnungs-Verwaltung), nutz die Sync-Routen statt zu duplizieren.

### Neue Funktion / neuer Tab im Pondruff-Modul

1. Route unter `app/dashboard/pondruff/<name>/page.tsx`
2. Link im PondruffSheet `components/pondruff/PondruffSheet.tsx` ergänzen
3. Sidebar-Link in `components/Sidebar.tsx` Block `{isPondruff && …}` ergänzen
4. Hier in `PONDRUFF.md` unter „Alle Pondruff-Dateien" ergänzen

### Neue DB-Spalte / -Tabelle

1. Neue Migration `supabase/migrations/2026MMDD_pondruff_<thema>.sql`
2. Tabellen immer mit Prefix `pondruff_`
3. RLS-Policies auf `user_id = auth.uid()` (vier: select/insert/update/delete)
4. Migration via `exec_sql` RPC ausführen (siehe `AGENTS.md`)
5. Rollback-Hinweis als Kommentar oben in der SQL-Datei

### Neue KI/OpenAI-Funktion

1. Route unter `app/api/pondruff/<funktion>/route.ts`
2. Email-Check zuerst:
   ```ts
   const access = await getRouteAccess(req)
   if (access.error) return access.error
   if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
     return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
   }
   ```
3. OpenAI-Key aus `process.env.OPENAI_API_KEY`, Modell `gpt-4o` für Vision, `gpt-4o-mini` für Text.

---

## Funktionen — aktueller Stand

### ✅ Live

| Funktion | Datei | Beschreibung |
|----------|-------|--------------|
| Banner-Logo Dashboard + Sub-Pages | `public/pondruff/banner.png` | Pondruff-Branding |
| Bottom-Nav Pondruff-Logo + Sheet | `app/dashboard/layout.tsx` + `components/pondruff/PondruffSheet.tsx` | Mobile-Navigation |
| Preisrechner | `preisrechner/page.tsx` | 44-stufige PRICE_TABLE, R4, TiN-Sonderfall, Rund/Eckig, Rabatt, WISO-Vorschau |
| Preisrechner Prefill | URL `?prefill=1` + sessionStorage | Übernahme aus Wareneingang |
| Multi-Bild Wareneingang-OCR | `api/pondruff/ocr-price` (Multi) + `ocr-lieferschein` (Single) | Erkennt automatisch |
| Wareneingang-Erfassung | `wareneingang/page.tsx` | Mehrere Bilder + KI + Bauteil-Save |
| Wareneingang → Preisrechner | Button in Wareneingang | übernimmt Positionen |
| Auftrag-Workflow | `buero-wiso/page.tsx` | Preisauftrag → Auftragsbestätigung → Rechnung |
| Büro/WISO Sub-Tabs | `buero-wiso/page.tsx` | Aufträge / Wareneingänge |
| Sync → BüroPilot Auftrag | `api/pondruff/sync-buero-auftrag` | Wird als ganz normaler buero_auftrag verfügbar |
| Sync → BüroPilot Dokument | `api/pondruff/sync-buero-wareneingang` | Wird als buero_dokument (Kategorie "Wareneingang") |
| WISO MeinBüro Direkt-API | `api/pondruff/wiso-export` | OAuth + Kundensuche + Order POST |
| KI-Suche Bauteile | `api/pondruff/bauteil-suche` + `ki-suche/page.tsx` | Foto → Vergleich mit gespeicherten Bauteilen |
| Archiv | `archiv/page.tsx` | Alles in einer Liste, filterbar |
| HTML-Bericht | `buero-wiso/page.tsx` | Pro Auftrag/Rechnung druckbar |
| WISO Copy/Paste | `buero-wiso/page.tsx` | Clipboard im exakten WISO-Format |
| TSV-Export | `buero-wiso/page.tsx` | Pro Auftrag + Sammel-Export |
| **Rotes Theme** | `app/globals.css` Klasse `.pondruff-theme` + Wrap in `pondruff/layout.tsx` | pk-card / pk-btn / pk-input alle in Rot |
| **Pondruff-PDF mit Briefpapier** | `lib/pondruff-pdf.ts` | PNG-Briefpapier als Hintergrund + Inhalte in Rot/Schwarz |
| **BüroPilot PDF-Auto-Switch** | `components/buero/*Tab.tsx` nutzen `generate*PDFAuto` | Bei Pondruff-User automatisch Pondruff-PDF, sonst Standard |

### 🟡 Noch denkbar (Vorschläge für nächste Sessions)

| Funktion | Geplanter Ort | Aufwand |
|----------|---------------|---------|
| Vektor-Embeddings für Bauteil-Suche (statt Live GPT-Vision-Vergleich) | `pondruff_bauteile.embedding` Spalte + pgvector | Hoch — schneller, billiger |
| Echte PDF-Rechnungen (statt HTML) für Pondruff | `buero-wiso/page.tsx` mit `lib/pdf.ts` | Mittel |
| Statistik-Seite mit Charts | `pondruff/statistik/page.tsx` | Mittel |
| Bezahlt/Mahn-Status für Pondruff-Rechnungen direkt im Pondruff-UI | neue Migration + `buero-wiso/page.tsx` | Mittel — alternativ über BüroPilot-Sync |
| WISO-Auftrag aus BüroPilot zurücksynchronisieren | Reverse-Sync | Mittel |
| Drag&Drop Foto-Upload | `wareneingang/page.tsx` + `ki-suche/page.tsx` | Klein |
| Bauteil manuell ohne Wareneingang anlegen | neuer Tab oder Button in KI-Suche | Klein |

---

## Rollback (kompletter sauberer Ausbau)

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local

# 1. User löschen — Daten verschwinden danach durch RLS
curl -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/7eb541ca-ca2e-4890-9c20-51ee20a00b43" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"

# 2. Tabellen + Bucket droppen
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql":"drop table if exists pondruff_bauteile cascade; drop table if exists pondruff_preisauftraege cascade; drop table if exists pondruff_wareneingaenge cascade; delete from storage.objects where bucket_id=''pondruff''; delete from storage.buckets where id=''pondruff''; drop sequence if exists pondruff_invoice_seq;"}'

# 3. Code entfernen
rm -rf app/dashboard/pondruff app/api/pondruff lib/pondruff.ts public/pondruff components/pondruff PONDRUFF.md
rm supabase/migrations/2026051940*pondruff*.sql supabase/migrations/2026051941*pondruff*.sql supabase/migrations/2026051942*pondruff*.sql

# 4. Die 3 Stellen entfernen
#    - app/dashboard/page.tsx: Block "{isPondruff && (...)}" und imports
#    - components/Sidebar.tsx: Block "{isPondruff && (...)}" und imports
#    - app/dashboard/layout.tsx: Block "{isPondruff && (...)}" + PondruffSheet imports
#    (Suche nach "isPondruff" und "pondruff")

git add -A && git commit -m "chore: Pondruff-Modul entfernt" && git push origin main
```

Nach Schritt 1–3 ist Pondruff für andere Nutzer sowieso unsichtbar (gated). Schritt 4 macht den Code auch komplett raus.

---

## Wer wo arbeitet — Quick-Reference

| Du willst… | Datei |
|------------|-------|
| Preisformel anpassen (PRICE_TABLE, Faktor, Multiplikator) | `lib/pondruff.ts` |
| Banner-Logo austauschen | `public/pondruff/banner.png` |
| Bottom-Nav-Icon austauschen | `public/pondruff/icon.png` |
| Sheet-Menü-Punkte ändern | `components/pondruff/PondruffSheet.tsx` |
| Sidebar-Reihenfolge | `components/Sidebar.tsx` Array `pondruffNav` |
| Dashboard-Kacheln | `app/dashboard/page.tsx` Block `{isPondruff && …}` |
| Neue Spalte in DB | neue Migration in `supabase/migrations/2026MMDD_pondruff_*.sql` |
| WISO-Beschreibung formatieren | `lib/pondruff.ts → wisoDescriptionForPricePosition` |
| GPT-Prompt für OCR ändern | `app/api/pondruff/ocr-*/route.ts` |
| GPT-Prompt für Bauteil-Match ändern | `app/api/pondruff/bauteil-suche/route.ts` |
| BüroPilot-Sync-Logik ändern | `app/api/pondruff/sync-buero-*/route.ts` |
| WISO API-Aufrufe ändern | `app/api/pondruff/wiso-export/route.ts` |
| Rechnungsnr.-Format ändern | `buero-wiso/page.tsx → makeInvoice()` |

---

**So sprichst du Pondruff-Änderungen gezielt an:**

Benutze das Präfix `PONDRUFF:` in deiner Anfrage — dann lese ich zuerst diese Datei und
ändere nur Pondruff-Dateien. Beispiele:

- `PONDRUFF: Preisrechner-Faktor für CrN auf 1.20 ändern` → `lib/pondruff.ts`
- `PONDRUFF: bei der KI-Suche auch Beschichtungstyp anzeigen` → `ki-suche/page.tsx`
- `PONDRUFF: Statistik-Seite bauen` → neue Route + Sheet-Eintrag + Sidebar-Eintrag

---

**Letzte Aktualisierung:** 2026-05-19 (Commit folgt nach diesem Push)
