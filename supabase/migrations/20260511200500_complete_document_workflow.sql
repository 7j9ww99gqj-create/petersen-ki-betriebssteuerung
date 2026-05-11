-- Petersen KI - Dokumentenworkflow KI-Erkennung

alter table buero_dokumente
  add column if not exists status text default 'erkannt',
  add column if not exists document_type text,
  add column if not exists confidence numeric default 0,
  add column if not exists summary text,
  add column if not exists extracted jsonb default '{}',
  add column if not exists suggested_actions jsonb default '[]',
  add column if not exists search_text text,
  add column if not exists updated_at timestamptz default now();

