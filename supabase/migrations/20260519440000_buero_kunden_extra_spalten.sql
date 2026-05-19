-- Fehlende Standard-Kunden-Spalten ergänzen damit CSV-Imports nicht abstürzen
-- Rollback: alter table buero_kunden drop column mobil, drop column land, drop column ust_id;

alter table buero_kunden
  add column if not exists mobil text,
  add column if not exists land text,
  add column if not exists ust_id text;

-- Spalte imported_ids in import_protokolle damit Rollback funktioniert
alter table import_protokolle
  add column if not exists imported_ids jsonb default '[]'::jsonb,
  add column if not exists ziel_tabelle text;
