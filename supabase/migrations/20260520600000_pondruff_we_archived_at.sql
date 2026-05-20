-- Pondruff Wareneingänge: Archivierungs-Spalte
alter table pondruff_wareneingaenge
  add column if not exists archived_at timestamptz;
