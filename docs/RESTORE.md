# RESTORE.md — Backup-Restore-Drill

> Step-by-Step für ein vollständiges Restore aus dem `db-backups`-Bucket.
> Empfohlen: **mindestens alle 6 Monate üben** — sonst weiß im Ernstfall niemand wo welcher Knopf ist.

---

## Voraussetzungen

- `SUPABASE_SERVICE_ROLE_KEY` aus `.env.local` (Admin-Zugriff auf alle Tabellen)
- `psql` oder Supabase SQL-Editor
- `jq` (`brew install jq`) — JSON-Parsing
- `gunzip` (Standard auf macOS/Linux)

---

## Backup-Format (zur Orientierung)

```
Pfad in Storage:  db-backups/<user_id>/YYYY-MM-DD.json.gz
Inhalt nach gunzip:
{
  "generated_at": "2026-05-19T02:00:00Z",
  "user_id": "uuid-...",
  "tables": {
    "lager_artikel":  [ { id, name, bestand, ... }, ... ],
    "buero_kunden":   [ ... ],
    "werkstatt_karten": [ ... ],
    ...
  }
}
```

Retention: 30 Tage (Nightly-CRON löscht ältere Backups automatisch).

---

## Drill-Szenario 1: Einzelnen User-Datensatz wiederherstellen

**Ausgangslage:** Ein User hat alle seine Kunden versehentlich gelöscht. Wir spielen den Stand von vor 3 Tagen wieder ein.

### 1. User-ID identifizieren

```bash
source /Users/kevinpetersen/Documents/petersen-ki/.env.local

curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | jq '.users[] | select(.email == "kunde@beispiel.de") | .id'
```

Notiere die `user_id` (UUID).

### 2. Backup-Datei aus Storage laden

```bash
USER_ID="<aus Schritt 1>"
DATUM="2026-05-16"  # 3 Tage zurück

# Signed-URL erstellen
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/sign/db-backups/$USER_ID/$DATUM.json.gz" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expiresIn": 600}' \
  | jq -r .signedURL > /tmp/signed.txt

SIGNED_URL=$(cat /tmp/signed.txt)
SIGNED_URL="${NEXT_PUBLIC_SUPABASE_URL}/storage/v1${SIGNED_URL}"

# Download + entpacken
curl -s "$SIGNED_URL" -o /tmp/backup.json.gz
gunzip /tmp/backup.json.gz
ls -la /tmp/backup.json
```

### 3. Inhalt verifizieren

```bash
jq '.generated_at, (.tables | keys), (.tables.buero_kunden | length)' /tmp/backup.json
# Beispielausgabe:
# "2026-05-16T02:00:00.000Z"
# [ "buero_angebote", "buero_kunden", "buero_rechnungen", ... ]
# 42
```

### 4. Restore-SQL generieren

Für eine einzelne Tabelle (hier `buero_kunden`):

```bash
jq -r '.tables.buero_kunden[] |
  "INSERT INTO buero_kunden VALUES " +
  "(" + ([.id, .user_id, .name, .email, .telefon, .ort, .created_at, .updated_at]
    | map(if . == null then "NULL" else "'\''" + tostring + "'\''" end) | join(", ")) +
  ") ON CONFLICT (id) DO UPDATE SET " +
  "name=EXCLUDED.name, email=EXCLUDED.email, telefon=EXCLUDED.telefon;"' \
  /tmp/backup.json > /tmp/restore_kunden.sql

head -3 /tmp/restore_kunden.sql
wc -l /tmp/restore_kunden.sql
```

**⚠️ Achtung:** Spalten-Reihenfolge in der Tabelle prüfen! Der jq-Befehl oben ist beispielhaft — passe ihn an dein aktuelles Schema an. Ein robusterer Weg: JSONB-Insert nutzen, dann auf Spalten projizieren.

### 5. Sicherer Restore via JSONB-Approach (empfohlen)

```sql
-- 1. Backup-JSON in eine Hilfstabelle laden
CREATE TEMP TABLE _restore_buero_kunden (data jsonb);

\copy _restore_buero_kunden FROM 'STDIN'
-- Hier den gesamten buero_kunden-Array aus der backup.json einfügen
-- Tip: jq '.tables.buero_kunden | tojson' /tmp/backup.json | psql ...
\.

-- 2. Aus JSONB in Original-Tabelle expandieren
INSERT INTO buero_kunden
  SELECT
    (e->>'id')::uuid,
    (e->>'user_id')::uuid,
    e->>'name',
    e->>'email',
    e->>'telefon',
    e->>'ort',
    (e->>'created_at')::timestamptz,
    (e->>'updated_at')::timestamptz
  FROM _restore_buero_kunden, jsonb_array_elements(data) e
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  telefon = EXCLUDED.telefon,
  updated_at = EXCLUDED.updated_at;

-- 3. Verifizieren
SELECT COUNT(*) FROM buero_kunden WHERE user_id = '<USER_ID>';
```

### 6. Verify

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/buero_kunden?user_id=eq.$USER_ID&select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" -I | grep -i "content-range"
```

---

## Drill-Szenario 2: Komplettes User-Konto wiederherstellen

**Ausgangslage:** Ein User wurde versehentlich gelöscht (`auth.users` DELETE) — alle 26 Tabellen sind durch CASCADE leer.

### 1. User in auth.users neu anlegen

```sql
-- Achtung: gleiche user_id wie im Backup nötig!
INSERT INTO auth.users (id, email, created_at, encrypted_password, role)
VALUES (
  '<ORIGINAL_USER_ID>',
  'kunde@beispiel.de',
  '<ORIGINAL_CREATED_AT>',
  crypt('temp-passwort-123', gen_salt('bf')),
  'authenticated'
);
```

→ Danach muss der User sein Passwort zurücksetzen (Magic-Link oder `/freischaltung`).

### 2. Alle Tabellen aus Backup wiederherstellen

```bash
# Liste aller Tabellen aus Backup
jq -r '.tables | keys[]' /tmp/backup.json

# Für jede Tabelle: JSONB-Approach wie in Szenario 1
# (Skript-Beispiel: scripts/restore-all.sh — TODO bei nächstem Drill anlegen)
```

### 3. Smoke-Test

User einloggen lassen (oder als Service-Role testen):

```bash
# Anzahl Datensätze pro Tabelle ausgeben
for table in lager_artikel buero_kunden werkstatt_karten planung_projekte; do
  count=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$table?user_id=eq.$USER_ID&select=count" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -I | grep -i "content-range" | awk -F'/' '{print $2}')
  echo "$table: $count Datensätze"
done
```

---

## Drill-Szenario 3: Komplettes Catastrophe-Recovery

**Ausgangslage:** Supabase-Datenbank ist physisch zerstört. Wir haben nur noch das `db-backups`-Storage.

### 1. Neue Supabase-Instanz aufsetzen

- Neues Projekt: https://supabase.com/dashboard
- `supabase/schema.sql` einspielen
- Alle Migrations in `supabase/migrations/` chronologisch ausführen
- Storage-Buckets neu anlegen (siehe `20260519500000_storage_buckets.sql`)
- RLS-Policies prüfen (Migration `20260518...rls_policies.sql`)

### 2. Env-Vars in Vercel umschreiben

- Neue `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` aus neuem Projekt
- Neuer `SUPABASE_SERVICE_ROLE_KEY`
- Vercel-Deploy triggern

### 3. User-Liste aus alter Storage

⚠️ **Problem:** Wenn die Datenbank weg ist, gibt es auch keine `auth.users` mehr.
**Lösung:** User-Liste aus den Backup-Storage-Pfaden rekonstruieren (`<user_id>/...`).
**Vorbeugend:** Halte eine separate User-Mapping-Liste (E-Mail → user_id) regelmäßig aus `auth.users` exportiert vor.

### 4. Pro User Schritte aus Szenario 2

… für alle ~N User. Das ist langwierig — daher ist das hauptsächlich ein **last-resort**-Pfad.
**Besser:** Supabase Point-in-Time-Recovery (PITR) aktivieren (Pro-Plan).

---

## Drill-Plan (alle 6 Monate)

Termin im Kalender: **alle 6 Monate, je 1 Stunde**.

1. Szenario 1 üben (Einzelner User, einzelne Tabelle) — 30 min
2. Szenario 2 ansehen (User wiederherstellen) — 15 min (kein echtes Ausführen, nur Sichtung)
3. Notizen aktualisieren — 15 min

**Letzter Drill:** _noch nicht durchgeführt_ — bitte Datum hier eintragen bei nächster Übung.

---

## Bekannte Limitationen

- **Storage-Files (Dokumente, Bilder)** sind **NICHT** im `db-backups`-Dump enthalten. Diese müssen separat gesichert werden (Supabase Storage-Replication oder manueller `rsync`).
- **OCR-Originale** (Bucket `ocr-originale`) sind ebenfalls nicht im JSON-Backup.
- **Stripe-Daten** (Webhooks, Subscriptions) sind in Stripe selbst — kein Petersen-KI-Backup nötig.
- **30-Tage-Retention** im `db-backups`-Bucket → wer länger zurück muss, braucht externe Archive.

---

## Mögliche Verbesserungen (Backlog)

- [ ] `scripts/restore.sh` mit Auto-Loop über alle Tabellen
- [ ] User-Mapping-Export als monatlicher CRON (E-Mail → user_id)
- [ ] Storage-Files in DB-Backup integrieren (oder eigener Storage-Backup)
- [ ] Supabase PITR aktivieren (Pro-Plan-Upgrade)
- [ ] Off-site-Backup (S3 Glacier o.ä.) für Backups älter als 30 Tage
