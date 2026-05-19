-- Speichert Storage-Pfad zum vollen Daten-Dump (gzipped JSON in Bucket db-backups)
alter table public.cloud_backups
  add column if not exists storage_path text,
  add column if not exists size_bytes bigint;

comment on column public.cloud_backups.storage_path is
  'Pfad im Storage-Bucket db-backups: <user_id>/<YYYY-MM-DD>.json.gz';
