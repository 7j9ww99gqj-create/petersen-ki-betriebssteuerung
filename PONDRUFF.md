# Pondruff-Modul — zentrale Doku

> **Zweck:** Dieser Bereich der App ist exklusiv für den Account `info@pondruffpolierservice.de`
> reserviert. Sämtliche Pondruff-spezifischen Dateien, Tabellen und Routen sind isoliert,
> damit sie ohne Risiko für die übrige Petersen-KI-Software entfernt werden können.

**Wenn du am Pondruff-Bereich arbeitest, ist DIESE Datei der Einstiegspunkt.**
Nichts außerhalb der hier aufgelisteten Dateien anfassen.

---

## Account

| Feld     | Wert |
|----------|------|
| Email    | `info@pondruffpolierservice.de` |
| Passwort | `Pondruff1904!` |
| User-ID  | `7eb541ca-ca2e-4890-9c20-51ee20a00b43` |

Gate: `lib/pondruff.ts → isPondruffUser(email)`.
Alle UI-Elemente (Dashboard-Kacheln, Sidebar-Links, Routen) checken zuerst auf diesen
Helper. Andere Nutzer sehen **nichts** davon.

---

## Alle Pondruff-Dateien (nur diese sind „Pondruff")

```
lib/pondruff.ts                                  ← Konstanten, Preislogik, isPondruffUser()
public/pondruff/banner.png                       ← Hauptlogo (oben groß)
public/pondruff/rund.png                         ← rundes Logo (Reserve)

app/dashboard/pondruff/                          ← komplettes Pondruff-UI
  layout.tsx                                       Banner + Auth-Gate
  page.tsx                                         Übersicht (3 Kacheln)
  preisrechner/page.tsx                            Hauptseite Kalkulation
  wareneingang/page.tsx                            Erfassung + GPT-OCR
  buero-wiso/page.tsx                              Aufträge/Bestätigungen/Rechnungen

app/api/pondruff/                                ← komplettes Pondruff-API
  ocr-price/route.ts                               GPT-4 Vision OCR Preis-Positionen
  ocr-lieferschein/route.ts                        GPT-4 Vision OCR Lieferschein

supabase/migrations/
  20260519400000_pondruff_module.sql               Tabellen, RLS, Storage-Bucket
  20260519410000_pondruff_auftrag_rechnung.sql     Status/Rechnung-Spalten
```

### Minimale Eingriffe in bestehenden Code (gated, reversibel)

| Datei                          | Zeile/Block                       | Was               |
|--------------------------------|-----------------------------------|-------------------|
| `app/dashboard/page.tsx`       | Import `isPondruffUser`           | Gate              |
| `app/dashboard/page.tsx`       | State `isPondruff`                | Sichtbarkeits-Flag|
| `app/dashboard/page.tsx`       | Block `{isPondruff && (…)}`       | Banner+3 Kacheln  |
| `components/Sidebar.tsx`       | Import + State `isPondruff`       | Gate              |
| `components/Sidebar.tsx`       | Block `{isPondruff && (…)}`       | Sidebar-Sektion   |

Diese 5 Stellen sind die **einzige** Berührung mit der bestehenden Codebase. Sie schalten
nur den Pondruff-Block frei und beeinflussen keinen anderen Nutzer.

---

## Datenbank

### Tabellen (alle mit RLS auf `user_id = auth.uid()`)

| Tabelle | Inhalt |
|--------|--------|
| `pondruff_preisauftraege` | Preisaufträge / Auftragsbestätigungen / Rechnungen — Status-Spalte |
| `pondruff_wareneingaenge` | Wareneingang inkl. Bild-URLs und KI-Erkennungs-JSON |

### Status-Workflow (`pondruff_preisauftraege.status`)

```
preisauftrag  ──[📋 Auftrag]──▶ auftragsbestaetigung ──[🧾 Rechnung]──▶ rechnung
        ▲                              │                                    │
        └──────────[↩️ zurück]──────────┘                                    │
                                       └──────────────[↩️ zurück]───────────┘
```

Beim Wandeln zu Rechnung wird `invoice_no` (Format `RE-{YYYY}-{0001}`) und
`invoice_date` (heute) automatisch gesetzt.

### Storage-Bucket

Bucket `pondruff`. Pfad-Konvention: `{user_id}/{kategorie}/{timestamp}.{ext}` mit
`kategorie ∈ {receipt, parts, packaging}`. RLS so gesetzt, dass nur der
eigene Ordner les-/schreibbar ist.

---

## Erweiterung: wenn du mehr Pondruff-Logik bauen willst

**Faustregel:** alles Pondruff-spezifische lebt in `app/dashboard/pondruff/*`,
`app/api/pondruff/*`, `lib/pondruff.ts`. Greife **nie** in andere Piloten oder
Dashboards ein.

### Neuer Tab / neue Funktion

1. Eigene Route unter `app/dashboard/pondruff/<name>/page.tsx`
2. Link im Layout `app/dashboard/pondruff/layout.tsx` ergänzen
3. Sidebar-Link in `components/Sidebar.tsx` Block `{isPondruff && ...}` ergänzen
4. Doku: hier in `PONDRUFF.md` unter „Alle Pondruff-Dateien" ergänzen

### Neue Datenbank-Spalte / -Tabelle

1. Neue Migration `supabase/migrations/2026MMDD_pondruff_<thema>.sql`
2. Tabellen immer mit Prefix `pondruff_`
3. Migration via `exec_sql` RPC ausführen (siehe `AGENTS.md`)
4. Rollback-Hinweis als Kommentar oben in der SQL-Datei

### Neue OpenAI/KI-Funktion

1. Route unter `app/api/pondruff/<funktion>/route.ts`
2. Email-Check zuerst:
   ```ts
   const access = await getRouteAccess(req)
   if (access.error) return access.error
   if (!access.user || access.user.email?.toLowerCase() !== POND_USER_EMAIL) {
     return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 })
   }
   ```

---

## Funktionen — aktueller Stand

### ✅ Live

| Funktion | Datei | Beschreibung |
|----------|-------|--------------|
| Preisrechner | `preisrechner/page.tsx` | Voller Streamlit-Port: 44-stufige PRICE_TABLE, R4-Faktoren, TiN-Sonderfall, Rund/Eckig-Volumen, Rabatt, WISO-Vorschau |
| OCR Preis-Positionen | `api/pondruff/ocr-price` | GPT-4 Vision liest Lieferscheine, extrahiert mehrere Positionen mit Beschichtung |
| OCR Lieferschein | `api/pondruff/ocr-lieferschein` | GPT-4 Vision für Wareneingang (Einzelartikel) |
| Wareneingang-Erfassung | `wareneingang/page.tsx` | Formular + 3 Bild-Uploads + KI-Vorbefüllung |
| Auftrag-Workflow | `buero-wiso/page.tsx` | Preisauftrag → Auftragsbestätigung → Rechnung mit automatischer Rechnungsnr. |
| WISO Copy/Paste | `buero-wiso/page.tsx` | Clipboard-Format identisch zum Streamlit-Original (Tab-Separated) |
| TSV-Export | `buero-wiso/page.tsx` | Pro Auftrag + Sammel-Export |
| HTML-Bericht | `buero-wiso/page.tsx` | Druckbarer Bericht pro Auftragsstatus |

### 🟡 Noch offen (Vorschläge für nächste Sessions)

| Funktion | Geplanter Ort | Aufwand |
|----------|---------------|---------|
| Bauteil-KI-Bildersuche | `api/pondruff/bauteil-suche/route.ts` + neuer Tab | Hoch (Vektor-Vergleich GPT-4-Vision oder Embeddings) |
| WISO MeinBüro REST-API direkt | `api/pondruff/wiso-import/route.ts` + ENV `WISO_*` | Mittel (API-Credentials nötig) |
| Statistik-Seite | `app/dashboard/pondruff/statistik/page.tsx` | Mittel (Aggregationen) |
| Echte PDF-Berichte | Mit `jsPDF` (schon im Projekt: `lib/pdf.ts`) | Mittel |
| Mehrere Lieferschein-Bilder im Wareneingang | OCR-Route nimmt schon multiple, UI muss erweitert werden | Klein |
| Auftrag aus Wareneingang erzeugen | Button in `wareneingang/page.tsx` der direkt eine Preiskalkulation öffnet | Klein |
| KPI-Widget im Pondruff-Übersichts-Dashboard | `pondruff/page.tsx` mit Live-Zahlen | Klein |
| Mahn-Status + Bezahlt-Markierung Rechnungen | Spalten `paid_at`, `payment_due` in Migration | Mittel |

---

## Rollback (kompletter sauberer Ausbau)

```bash
# 1. User löschen — wegen RLS sind seine Daten danach unsichtbar / autom. weg
source /Users/kevinpetersen/Documents/petersen-ki/.env.local
curl -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/7eb541ca-ca2e-4890-9c20-51ee20a00b43" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"

# 2. Tabellen + Bucket droppen
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql":"drop table if exists pondruff_preisauftraege cascade; drop table if exists pondruff_wareneingaenge cascade; delete from storage.objects where bucket_id=''pondruff''; delete from storage.buckets where id=''pondruff''; drop sequence if exists pondruff_invoice_seq;"}'

# 3. Code entfernen
rm -rf app/dashboard/pondruff app/api/pondruff lib/pondruff.ts public/pondruff
rm supabase/migrations/2026051940*pondruff*.sql supabase/migrations/2026051941*pondruff*.sql

# 4. Die 5 Stellen in app/dashboard/page.tsx + components/Sidebar.tsx entfernen
#    (Suche nach "isPondruff" und "pondruffTiles" / "pondruffNav")

git add -A && git commit -m "chore: Pondruff-Modul entfernt" && git push origin main
```

Nach Schritt 1–3 kann die App ohne Probleme weiter laufen — Pondruff-Stellen bleiben
für andere Nutzer sowieso unsichtbar; Schritt 4 macht sie auch im Code unsichtbar.

---

## Wer wo arbeitet

| Du willst… | Datei |
|------------|-------|
| Preisformel anpassen (PRICE_TABLE, Faktor, Multiplikator) | `lib/pondruff.ts` |
| Neuen Tab/Funktion bauen | `app/dashboard/pondruff/<name>/page.tsx` |
| WISO-Spalten/Format anpassen | `lib/pondruff.ts` → `buildWisoPriceOrder`/`wisoClipboard*` |
| GPT-Prompt für OCR ändern | `app/api/pondruff/ocr-*/route.ts` |
| Neue Datenbank-Felder | neue Migration in `supabase/migrations/2026MMDD_pondruff_*.sql` |
| Logo austauschen | `public/pondruff/banner.png` |
| Dashboard-Banner-Größe | `app/dashboard/page.tsx` Block `{isPondruff && ...}` (maxWidth) |
| Sidebar-Reihenfolge | `components/Sidebar.tsx` Array `pondruffNav` |

---

**Letzte Aktualisierung:** 2026-05-19
