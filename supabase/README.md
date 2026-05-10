# Supabase Live-Setup

Für die Live-Version muss die Datenbank im Supabase SQL Editor aktualisiert werden.

## Empfohlen

1. Supabase öffnen
2. SQL Editor öffnen
3. Inhalt von `supabase/migrations/20260510213000_live_schema_updates.sql` einfügen
4. Ausführen

Die Migration ist idempotent und kann mehrfach ausgeführt werden. Sie legt nur fehlende Tabellen, Spalten, RLS-Policies und Indexe an.

## Enthalten

- `lager_artikel.mindestbestand`
- `firma_einstellungen` für Mandanten-/Briefpapierdaten
- Einkauf-Tabellen
- `buero_eingangsrechnungen`
- Lager-Stellplatz-Tabellen
- RLS Policies und Indexe

Ohne diese Migration funktionieren die neuen Tabs im Demo-Modus, aber Live-Speichern kann wegen fehlender Tabellen fehlschlagen.
